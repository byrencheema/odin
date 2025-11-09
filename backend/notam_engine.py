"""
Simulated NOTAM feed engine for the ODIN backend.

Loads a seed dataset of Bay Area NOTAMs and emits them in a rolling feed so that
the frontend can poll for updates without relying on unavailable upstream APIs.
"""

from __future__ import annotations

import asyncio
import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional
from uuid import NAMESPACE_URL, uuid5


DATA_PATH = Path(__file__).parent / "data" / "notams_seed.json"
DEFAULT_TICK_SECONDS = 5.0
DEFAULT_WINDOW_SIZE = 24
INITIAL_BATCH = 12


def _load_notam_catalog() -> List[Dict[str, str]]:
    """Load and normalize the NOTAM seed data."""
    raw_text = DATA_PATH.read_text(encoding="utf-8")
    raw_items: List[Dict[str, str]] = json.loads(raw_text)

    catalog: List[Dict[str, str]] = []
    seen_ids: set[str] = set()

    for item in raw_items:
        key = f"{item.get('location','')}|{item.get('number','')}|{item.get('classification','')}|{item.get('condition','')}"
        notam_id = uuid5(NAMESPACE_URL, key).hex

        if notam_id in seen_ids:
            # Ensure uniqueness by adding jitter to key if duplicate encountered
            notam_id = uuid5(NAMESPACE_URL, key + f"|{len(seen_ids)}").hex
        seen_ids.add(notam_id)

        catalog.append(
            {
                "id": notam_id,
                "category": item.get("category", "Digital NOTAM"),
                "location": item.get("location", "").upper(),
                "number": item.get("number", "").upper(),
                "classification": item.get("classification", "").title(),
                "start": item.get("start", ""),
                "end": item.get("end", ""),
                "condition": item.get("condition", ""),
            }
        )

    return catalog


CATALOG: List[Dict[str, str]] = _load_notam_catalog()


@dataclass
class NotamEmission:
    """Represents an emitted NOTAM instance in the simulated feed."""

    payload: Dict[str, str]
    emission: int
    received_at: datetime

    def to_dict(self, latest_emission: int) -> Dict[str, object]:
        return {
            **self.payload,
            "emission": self.emission,
            "received_at": self.received_at.isoformat(),
            "is_new": self.emission == latest_emission,
        }


class NotamEngine:
    """Cycles through the NOTAM catalog and emits entries at a steady cadence."""

    def __init__(
        self,
        catalog: Optional[List[Dict[str, str]]] = None,
        tick_seconds: float = DEFAULT_TICK_SECONDS,
        window_size: int = DEFAULT_WINDOW_SIZE,
        seed: int = 42,
    ) -> None:
        if catalog is None:
            catalog = CATALOG

        if not catalog:
            raise ValueError("NOTAM catalog is empty; cannot initialize engine.")

        self._catalog = list(catalog)
        self._tick_seconds = tick_seconds
        self._window_size = max(5, window_size)
        self._lock = asyncio.Lock()
        self._emissions: List[NotamEmission] = []
        self._sequence = 0
        self._cursor = 0
        self._last_tick = datetime.now(timezone.utc)

        rng = random.Random(seed)
        rng.shuffle(self._catalog)

        # Bootstrap the feed with an initial batch so the UI has content immediately.
        for _ in range(min(INITIAL_BATCH, len(self._catalog))):
            self._emit_next(force=True)

        # Allow the first poll to trigger a fresh emission shortly after start.
        self._last_tick -= timedelta(seconds=self._tick_seconds * 0.6)

    @property
    def tick_seconds(self) -> float:
        return self._tick_seconds

    @property
    def window_size(self) -> int:
        return self._window_size

    def _emit_next(self, *, force: bool = False) -> None:
        """Activate the next NOTAM in the catalog and update the rolling window."""
        now = datetime.now(timezone.utc)

        if not force and (now - self._last_tick).total_seconds() < self._tick_seconds:
            return

        base = self._catalog[self._cursor]
        self._cursor = (self._cursor + 1) % len(self._catalog)

        self._sequence += 1
        emission = NotamEmission(payload=dict(base), emission=self._sequence, received_at=now)
        self._emissions.insert(0, emission)

        if len(self._emissions) > self._window_size:
            self._emissions.pop()

        self._last_tick = now

    async def get_feed(self) -> Dict[str, object]:
        """Return the latest NOTAM feed snapshot."""
        async with self._lock:
            self._emit_next()
            latest_emission = self._sequence
            notams = [emission.to_dict(latest_emission) for emission in self._emissions]

            return {
                "notams": notams,
                "sequence": latest_emission,
                "last_updated": self._last_tick.isoformat(),
                "cadence_seconds": self._tick_seconds,
                "total_catalog": len(self._catalog),
                "window_size": self._window_size,
            }

    def reset(self) -> None:
        """Reset the engine and rebuild the rolling window."""
        self._emissions.clear()
        self._sequence = 0
        self._cursor = 0
        self._last_tick = datetime.now(timezone.utc)

        for _ in range(min(INITIAL_BATCH, len(self._catalog))):
            self._emit_next(force=True)

        self._last_tick -= timedelta(seconds=self._tick_seconds * 0.6)


_engine_instance: Optional[NotamEngine] = None


def get_notam_engine() -> NotamEngine:
    """Return the singleton NOTAM engine instance."""
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = NotamEngine()
    return _engine_instance


def reset_notam_engine() -> None:
    """Reset the singleton engine (primarily for tests)."""
    global _engine_instance
    if _engine_instance is not None:
        _engine_instance.reset()

