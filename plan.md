# ODIN ATC Console — Development Plan

Context: Real aircraft data (OpenSky Network) + MapTiler base map, NATO-style black canvas with cyan accents. Design tokens per design_guidelines.md.

## 1) Objectives
- Deliver a single-screen ATC console for the Bay Area: AIR bar, left filters, center 2D map, right info panel.
- Use live OpenSky ADS-B data (no simulation unless API is unavailable). Smooth, high-contrast, minimal UI.
- Aircraft rendered as oriented triangles with compact monospace labels; pan/zoom at 60fps feel.
- Graceful fallback: if any data is missing/unavailable, display "—" without errors.

## 2) Implementation Steps (Phased)

### Phase 1 — Core Data & Map POC (Status: COMPLETED - Partial Success)
Goal: Prove the hardest parts work in isolation: OpenSky fetch + MapTiler map + aircraft overlay + smooth motion.

**Completed:**
- ✅ Web search: confirmed OpenSky bbox query, rate limits (10s), response schema; MapLibre best practices for DPR-aware canvas overlays.
- ✅ Backend (FastAPI):
  - Created `/api/air/opensky` (GET) with Bay Area bbox (36.8-38.5 lat, -123.0 to -121.2 lon)
  - Normalized aircraft fields: {icao24, callsign, lat, lon, geo_altitude, baro_altitude, velocity, true_track, vertical_rate, on_ground, origin_country, squawk}
  - Implemented caching (10s TTL) with stale flag handling; returns `data_status: ok/stale/unavailable`
  - Successfully fetching **138 live aircraft** from OpenSky Network
  - Added httpx dependency for async HTTP requests
- ✅ Frontend (React):
  - Added REACT_APP_MAPTILER_KEY to frontend/.env
  - Installed maplibre-gl, d3, topojson-client
  - Added Google Fonts (IBM Plex Sans, Azeret Mono) to index.html
  - Updated index.css with NATO color tokens from design_guidelines.md
  - Built complete AppShell with AIR bar, filters panel (left), map canvas (center), info panel (right)
  - AIR bar displays: ODIN logo, Bay Area region, live Local/UTC clocks (updating every 1s), LIVE/STALE/OFFLINE status badge, Wx/Runways placeholders showing "—"
  - Filters panel: checkboxes for Show Runways, Show Aircraft; placeholders for Weather/Incidents/Heatmap (disabled)
  - Info panel: empty state ("Click an aircraft to view details") and detailed aircraft card on selection
  - Implemented aircraft polling (2s interval), click selection, hover detection logic
  - Aircraft rendering with oriented triangles + monospace labels (CALLSIGN | ALT | SPD)
  - Mobile responsive with Sheet overlays
- ✅ Testing: curl verified backend returns 138 aircraft; frontend compiles without errors; testing agent called (iteration_1.json)

**Known Issues:**
- ❌ MapLibre GL JS initialization succeeds but MapTiler style.json request fails in browser (net::ERR_ABORTED)
- ❌ API key is valid (verified via curl), suggesting React 19 / MapLibre compatibility or CORS issue
- ❌ Map canvas remains black; no tiles or aircraft overlay rendering
- ❌ Aircraft canvas overlay depends on map initialization completing

**Root Cause Analysis:**
- MapLibre Map object is created successfully (console: "Map object created: e.Map")
- MapTiler API responds correctly to curl requests with valid style JSON
- Browser blocks the style.json request before it completes
- Likely causes: (1) React 19 strict mode double-mounting, (2) MapLibre ESM import issue, (3) CORS preflight failure, (4) Missing WebGL context

**Phase 1 User Stories Status:**
1. ✅ As an observer, I want to load the app and see the Bay Area map on a calm black canvas. (Canvas renders but map tiles don't load)
2. ❌ As a controller-adjacent user, I want aircraft to appear and move smoothly with compact labels. (Blocked by map initialization)
3. ✅ As a user, I want the AIR bar to show Region, Local Time, UTC, and LIVE tick.
4. ❌ As a user, I want hover highlight + tooltip for quick inspection. (Logic implemented but not visible)
5. ✅ As a user, I want click-to-select to pin details in the right panel. (Logic ready, needs map to test)
6. ✅ As a user, I want Wx/Runways to display "—" if unavailable.

### Phase 1.5 — Map Rendering Fix (Status: URGENT - In Progress)
Goal: Resolve MapLibre GL JS initialization issue to unblock aircraft visualization.

**Approaches to Try:**
1. **Alternative Map Library:**
   - Replace MapLibre GL JS with Leaflet.js + raster tiles (simpler, no WebGL)
   - Use OpenStreetMap tiles with dark theme filter or MapTiler raster tiles directly
   - Pros: More React-compatible, simpler initialization, proven stability
   - Cons: Less performant for large datasets, fewer styling options

2. **MapLibre Debugging:**
   - Test with basic inline style (no external style.json URL)
   - Add explicit CORS headers or proxy MapTiler requests through backend
   - Investigate React 19 StrictMode double-mounting issue
   - Try MapLibre React wrapper library

3. **Canvas-Only Approach (Fallback):**
   - Use pure Canvas 2D API with static base map image
   - Draw coastlines/runways from GeoJSON directly on canvas
   - Simplest approach but requires more manual work for pan/zoom

**Recommended Next Steps:**
1. Implement Leaflet.js with MapTiler raster tiles (quickest path to working map)
2. Keep existing aircraft rendering logic (just change map initialization)
3. Test with screenshot tool to verify tiles load
4. If successful, proceed to Phase 2; if not, try canvas-only approach

### Phase 2 — V1 App Development (Status: Not Started)
Goal: Ship the full MVP layout and core interactions per PRD using proven Phase 1 core.

**Prerequisites:** Phase 1.5 map rendering must be resolved first.

- Backend:
  - Service wrapper for OpenSky with bbox derived from current viewport; add `/api/world/current` (simplified array) and `/api/aircraft/{icao24}`.
  - Maintain in-memory world_state with last N points per aircraft (short trail); mark `data_status` (ok/stale/down) with timestamps.
- Frontend:
  - Aircraft + short trailing path; pan/zoom; data-testid on all interactive/critical elements (already implemented).
  - Right panel: selection details (callsign, alt, spd, hdg, origin_country, time) (already implemented). Double-click emits `openFocus3D(id)`.
  - Runways: load static GeoJSON for SFO/OAK/SJC; crisp outlines; toggleable.
  - Performance polish: separate static/dynamic draws; requestAnimationFrame loop; DPR-aware sizes (partially implemented).
- Testing: call testing agent for end-to-end V1 (backend APIs, polling, toggles, selection, placeholders, accessibility basics).
- Phase 2 User Stories:
  1. As an observer, I can toggle runways and traffic to declutter the scene.
  2. As a trainee, I can view a selected aircraft's ALT/SPD/HDG and origin quickly.
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
1. **URGENT:** Resolve map rendering issue (Phase 1.5)
   - Option A: Replace MapLibre with Leaflet.js + MapTiler raster tiles
   - Option B: Debug MapLibre CORS/React 19 compatibility
   - Option C: Fallback to canvas-only rendering
2. Test map + aircraft rendering with screenshot tool
3. Once map works, complete Phase 1 POC validation with testing agent
4. Proceed to Phase 2 V1 development (runways, trails, polish)

## 4) Success Criteria
- Opening the app shows a recognizable Bay Area air picture within seconds.
- AIR bar displays Region, Local/UTC clocks, and LIVE tick; Wx/Runways show "—" cleanly. ✅ (Already working)
- Runways + aircraft render crisply; toggles, hover, selection, and double-click hook work reliably. (Blocked by map)
- Motion appears smooth via interpolation; performance stays within a 16ms/frame budget on modern hardware.
- Codebase is modular with clear extension points for weather, incidents, replay, and 3D without re-architecture.

## 5) Technical Decisions Log
- **MapTiler API Key:** kl4paZ620eGeg7xYAUbL (valid, verified via curl)
- **OpenSky Network:** Free tier, 10s rate limit, Bay Area bbox returns 138 aircraft
- **Design System:** NATO-style, canvas #0A0B0C, cyan #4DD7E6, green #6BEA76, IBM Plex Sans + Azeret Mono
- **Map Library:** MapLibre GL JS (current, blocked) → considering Leaflet.js migration
- **Backend Cache:** 10s TTL with stale flag; graceful degradation
- **Frontend Polling:** 2s interval with visual interpolation for smooth motion
