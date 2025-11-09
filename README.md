<p align="center">
  <img src="frontend/public/odin-logo-white-text.png" alt="ODIN logo" width="320" />
</p>

# ODIN — Bay Area ATC Second Brain

ODIN is an operator-focused console that fuses live Bay Area aircraft surveillance, weather, ATC facility coverage, NOTAM intel, and an AI copilot into a single NATO-style surface. The system is designed to act as a "second brain" for tower and TRACON teams by keeping every critical layer one glance away while staying resilient when upstream feeds fail.

## Feature Highlights
- **Live tactical map:** MapLibre GL canvas with black-canvas styling, aircraft triangles, runway overlays, trails with altitude-based coloring, and layer toggles for traffic, weather, airspace, ATC facilities, heatmaps, and incidents.
- **Data-aware AIR bar:** Region header, dual UTC/local clocks, data status badge (`LIVE/STALE/OFFLINE`), KSFO weather summary, and runway cards that continually poll backend health.
- **Real-time sources + graceful fallback:** OAuth2 OpenSky ingestion (capped at 40 aircraft) with 10s cache, automatic switch to the physics-based simulator if the API fails three times, and local caching to avoid re-render spikes.
- **ATC facility intelligence:** Coverage polygons and points for Bay Area towers/TRACON/Center plus LiveATC audio feeds (listener counts, frequency badges, individual channel controls).
- **Shift handoff + AI copilot:** WEST-checklist briefings delivered as chat messages and ElevenLabs audio, paired with a lightweight OpenRouter-powered chat assistant for quick procedures or checklists.
- **Situational extras:** RainViewer weather overlay, NOTAM stream, aircraft 3D viewer (Cesium), and resizable panels tailored to low-light ops.

## Architecture At A Glance
```
frontend/ (React 19 + Tailwind + MapLibre)
└─ Talks to FastAPI backend at /api over HTTPS
backend/ (FastAPI + Async Mongo + OpenSky + external SDKs)
└─ Persists state + caches to MongoDB and in-memory stores
external services: OpenSky, LiveATC, WeatherAPI, MapTiler, Cesium Ion, ElevenLabs, OpenRouter
```

- **Frontend:** CRA/CRACO React 19 app, MapLibre GL, shadcn/ui, RainViewer overlay, Cesium for 3D. Live polling intervals keep the map at ~1–2 s cadence and respect MapTiler rate limits.
- **Backend:** FastAPI (Python 3.11) with async MongoDB via Motor, `httpx` for OpenSky OAuth polling, ElevenLabs + OpenRouter clients, NOTAM engine, aircraft simulator fallback, and coverage GeoJSON generators.
- **Data contracts:** Typed Pydantic responses (see `/api/docs`) feed React hooks. Aircraft, trail, airspace, facility, weather, chat, and handoff payloads are versioned in `backend/server.py`.

## Repository Layout
```
backend/            FastAPI application, services, simulators, and data modules
frontend/           React client (MapLibre UI, chat, panels, Cesium viewer)
docker-compose.yml  Single-service MongoDB dev container
LOCAL_DEV.md        Quick local workflow
SETUP.md            Full credential + environment guide
design_guidelines.mdVisual/interaction standards for the console
plan.md, summary.md Running project history and requirements trace
backend_test.py     Smoke tester that hits the deployed API
```

## Prerequisites
- Python 3.11+
- Node.js 20.x + Yarn 1.22
- Docker (for the optional MongoDB container)
- MapTiler, OpenSky, WeatherAPI, and optional Cesium / ElevenLabs / OpenRouter API keys (see below)

## Quick Start
1. **Start MongoDB (optional but recommended):**
   ```bash
   docker-compose up -d
   ```
2. **Backend setup:**
   ```bash
   cd backend
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   touch .env  # populate using the Environment Variables section
   uvicorn server:app --reload --host 0.0.0.0 --port 8001
   ```
   FastAPI docs are available at http://localhost:8001/docs once the server is running.
3. **Frontend setup:**
   ```bash
   cd frontend
   yarn install
   touch .env.local  # add the variables described below
   yarn start
   ```
   The React client runs at http://localhost:3000 and expects the backend at `REACT_APP_BACKEND_URL` (default `http://localhost:8001`).

> For a minimal offline test, set `ENABLE_SIMULATION=true` in `backend/.env` and supply a MapTiler key; aircraft will be generated locally.

## Environment Variables

### Backend (`backend/.env`)
| Variable | Required | Purpose |
| --- | --- | --- |
| `MONGO_URL` | ✅ | MongoDB connection string (`mongodb://localhost:27017` for Docker compose). |
| `DB_NAME` | ✅ | Database name (`odin`). |
| `OPENSKY_CLIENT_ID`, `OPENSKY_CLIENT_SECRET` | ⚙️ for live ops | OAuth2 credentials for real OpenSky data. |
| `ENABLE_SIMULATION` | optional | Set to `true` to force simulator data. |
| `SIMULATION_AIRCRAFT_COUNT` | optional | Number of synthetic tracks when simulation is enabled. |
| `WEATHERAPI_KEY` | ⚙️ | WeatherAPI key for KSFO weather summaries. |
| `OPENROUTER_API_KEY`, `OPENROUTER_MODEL` | optional | Enables the AI copilot chat. Defaults to Claude 3.5 Sonnet if set. |
| `ELEVENLABS_API_KEY` | optional | Generates spoken shift handoff briefs. |
| `CORS_ORIGINS` | optional | Comma-separated list of allowed origins (defaults to `*`). |

Load these with `python-dotenv` (already wired in `server.py`); see `SETUP.md` for full walkthroughs and production tips.

### Frontend (`frontend/.env.local`)
| Variable | Required | Purpose |
| --- | --- | --- |
| `REACT_APP_BACKEND_URL` | ✅ | Base URL for FastAPI (`http://localhost:8001`). |
| `REACT_APP_MAPTILER_KEY` | ✅ | Map tiles for the tactical map. |
| `REACT_APP_CESIUM_ION_TOKEN` | optional | Required for the 3D aircraft viewer. |
| `REACT_APP_ENABLE_VISUAL_EDITS` | optional | Enables the embedded visual editor when the app is iframed. |

## Key API Endpoints
- `GET /api/air/opensky` — Aircraft picture (live or simulated) + status badge metadata.
- `GET /api/air/trails` — Historical points for rendered trails.
- `GET /api/airspace/boundaries` — Class B/C/D boundaries for Bay Area airspace.
- `GET /api/atc/facilities/{coverage|points}` — GeoJSON polygons/points plus metadata for towers, TRACON, and Oakland Center.
- `GET /api/weather/current` — KSFO weather snapshot (WeatherAPI powered).
- `GET /api/notams` — Rolling NOTAM feed served by the internal engine.
- `POST /api/chat` — OpenRouter-backed assistant replies.
- `POST /api/handoff/shift` — WEST checklist shift handoff script + optional ElevenLabs audio payload.

All routes are documented via FastAPI's interactive docs at `/docs`.

## Testing & Diagnostics
- **Backend smoke test:** `python backend_test.py` targets the deployed preview URL by default; export `BASE_URL` or edit the script to point at localhost.
- **Frontend:** `yarn test` leverages CRA's Jest runner. `yarn start` + browser dev tools are the fastest way to sanity check the map, chat, and audio controls.
- **Manual verification:** Open `/api/air/opensky` and `/api/notams` in a browser/curl to inspect payloads, then flip `ENABLE_SIMULATION` to confirm fallback mode.

## Additional Documentation
- `SETUP.md` — Detailed credential acquisition, simulation vs live mode, troubleshooting, and rate-limit notes.
- `LOCAL_DEV.md` — Concise local workflow, including Mongo lifecycle commands.
- `design_guidelines.md` — Visual language, typography, and layout tokens that keep the console on-brand.
- `plan.md` / `summary.md` — Running history of shipped features, WEST checklist refinement notes, and outstanding ideas.

Use this README as the high-level index, then dive into the specialized docs above when you need design tokens, setup recipes, or feature rationales. Contributions should keep the "second brain" promise in mind: fast scans, graceful degradation, and zero surprises for controllers.
