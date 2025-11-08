# ODIN ATC Console — Development Plan

Context: Real aircraft data (OpenSky Network) + MapTiler base map, NATO-style black canvas with cyan accents. Design tokens per design_guidelines.md.

## 1) Objectives
- Deliver a single-screen ATC console for the Bay Area: AIR bar, left filters, center 2D map, right info panel.
- Use live OpenSky ADS-B data (no simulation unless API is unavailable). Smooth, high-contrast, minimal UI.
- Aircraft rendered as oriented triangles with compact monospace labels; pan/zoom at 60fps feel.
- Graceful fallback: if any data is missing/unavailable, display "—" without errors.

## 2) Implementation Steps (Phased)

### Phase 1 — Core Data & Map POC (POC required; Status: In Progress)
Goal: Prove the hardest parts work in isolation: OpenSky fetch + MapTiler map + aircraft overlay + smooth motion.
- Web search: confirm OpenSky bbox query, rate limits, response schema; MapLibre best practice for performance and custom canvas overlays.
- Backend (FastAPI):
  - Create `/api/air/opensky` (GET) that accepts bbox (Bay Area default) and returns normalized aircraft fields: {icao24, callsign, lat, lon, geo_altitude, baro_altitude, velocity, true_track, vertical_rate, on_ground, last_contact} with UTC timestamps.
  - Handle rate limits/timeouts; cache last good frame for up to 5s; no simulation (return stale frame flag if reused).
- Frontend (React):
  - Integrate MapLibre GL JS with MapTiler (REACT_APP_MAPTILER_KEY). Style: matte-black, minimal labels (or hidden), thin coastlines.
  - Add Canvas overlay for aircraft (DPR-aware). Draw triangles oriented by true_track; labels: `CALLSIGN | ALT(ft) | SPD(kts)`.
  - Poll backend every 1–2s; interpolate between ticks for smooth motion; hover highlight + tooltip; click selection.
  - Stub AIR bar: Region Bay Area; live Local/UTC clocks; SIM status shows `LIVE · 1–2s tick`; Wx/Runways: "—".
- Testing: curl `/api/air/opensky`; verify frontend compiles; screenshot map + aircraft; run testing agent once to validate basic render, clocks, selection.
- Phase 1 User Stories:
  1. As an observer, I want to load the app and see the Bay Area map on a calm black canvas.
  2. As a controller-adjacent user, I want aircraft to appear and move smoothly with compact labels.
  3. As a user, I want the AIR bar to show Region, Local Time, UTC, and LIVE tick.
  4. As a user, I want hover highlight + tooltip for quick inspection.
  5. As a user, I want click-to-select to pin details in the right panel.
  6. As a user, I want Wx/Runways to display "—" if unavailable.

### Phase 2 — V1 App Development (Status: Not Started)
Goal: Ship the full MVP layout and core interactions per PRD using proven Phase 1 core.
- Backend:
  - Service wrapper for OpenSky with bbox derived from current viewport; add `/api/world/current` (simplified array) and `/api/aircraft/{icao24}`.
  - Maintain in-memory world_state with last N points per aircraft (short trail); mark `data_status` (ok/stale/down) with timestamps.
- Frontend:
  - Build AppShell per design (shadcn): top AIR bar, left Filters, center MapCanvas, right InfoPanel. Import IBM Plex Sans + Azeret Mono. Add Toaster.
  - Filters: toggles for Airports/Runways, Traffic; Layers placeholders (Weather, Incidents, Heatmap) off by default.
  - MapCanvas: aircraft + short trailing path; pan/zoom; data-testid on all interactive/critical elements.
  - Right panel: selection details (callsign, alt, spd, hdg, origin_country, time). Double-click emits `openFocus3D(id)`.
  - Runways: load static GeoJSON for SFO/OAK/SJC; crisp outlines; toggleable.
  - Performance polish: separate static/dynamic draws; requestAnimationFrame loop; DPR-aware sizes.
- Testing: call testing agent for end-to-end V1 (backend APIs, polling, toggles, selection, placeholders, accessibility basics).
- Phase 2 User Stories:
  1. As an observer, I can toggle runways and traffic to declutter the scene.
  2. As a trainee, I can view a selected aircraft’s ALT/SPD/HDG and origin quickly.
  3. As a user, I can double-click an aircraft to trigger the future 3D focus hook.
  4. As a user, I can see a short trailing path to read motion at a glance.
  5. As a user, I can pan/zoom smoothly without stutter while updates continue.
  6. As an operator, I see a subtle toast if data becomes stale and it clears on recovery.

### Phase 3 — Hardening & Extensibility (Status: Not Started)
Goal: Improve resilience, modularity, and readiness for future overlays (weather/incidents/replay).
- Backend: robust error handling; consistent normalization; caching layer; unit tests for parsers/normalizers.
- Frontend: overlay module pattern; keyboard navigation; empty/error/loading states across panels; decluttering logic by zoom.
- Viewport-driven queries: only fetch aircraft within current bbox; debounce viewport changes.
- Placeholders: Weather/Incidents/Heatmap remain toggleable (off by default) and display "—" when unavailable.
- Testing: testing agent for resilience scenarios (API down, slow data, stale recovery) and keyboard accessibility.
- Phase 3 User Stories:
  1. As a user, I see clear empty/error states instead of cryptic failures.
  2. As a controller, I can keyboard-navigate aircraft to speed inspection.
  3. As an engineer, I can change regions via config without rewrites.
  4. As a user, labels scale/hide by zoom to reduce clutter.
  5. As an operator, the console recovers gracefully from transient API errors.
  6. As an engineer, I can toggle overlays independently without side effects.

### Phase 4 — Polish & Roadmap Hooks (Status: Not Started)
Goal: Finalize MVP polish and expose stubs for roadmap features.
- Add playback strip scaffold (no replay yet), 3D focus placeholder UI, and right-panel copilot text placeholder.
- Document extension points for weather/incidents/replay/3D; ensure dark/light readiness and token-based theming.
- Final testing agent run; performance pass; bundle size sanity.
- Phase 4 User Stories:
  1. As a user, I can see where the copilot/chat will live in the UI.
  2. As a demo judge, I can interact with a playback control stub.
  3. As a developer, I can plug in a weather overlay with minimal wiring.
  4. As a user, cyan selection is consistent and amber/red are reserved.
  5. As a maintainer, I can run tests and target elements reliably via data-testids.

## 3) Next Actions (Immediate)
1. Add `REACT_APP_MAPTILER_KEY` to frontend/.env using the provided key (do not change existing vars).
2. Phase 1 build: backend `/api/air/opensky`; frontend MapLibre + canvas overlay; AIR bar + clocks; polling + interpolation.
3. Verify with curl and on preview URL; run one testing-agent pass for POC.
4. If OpenSky rate limits block us, reduce polling frequency and cache last frame (no simulation); surface stale badge/sonner toast.

## 4) Success Criteria
- Opening the app shows a recognizable Bay Area air picture within seconds.
- AIR bar displays Region, Local/UTC clocks, and LIVE tick; Wx/Runways show "—" cleanly.
- Runways + aircraft render crisply; toggles, hover, selection, and double-click hook work reliably.
- Motion appears smooth via interpolation; performance stays within a 16ms/frame budget on modern hardware.
- Codebase is modular with clear extension points for weather, incidents, replay, and 3D without re-architecture.
