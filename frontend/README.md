## Odin Frontend

This Create React App powers the Odin ATC console. It renders the MapLibre tactical map plus an on-demand Cesium 3D chase camera for any aircraft in the feed.

### Prerequisites

1. Install dependencies
   ```bash
   yarn install
   ```
2. Copy `.env.example` to `.env.local` (or export the env vars another way) and set:
   - `REACT_APP_BACKEND_URL` – FastAPI base URL (e.g., `http://localhost:8000`)
   - `REACT_APP_MAPTILER_KEY` – MapTiler API key for the MapLibre raster layer
   - `REACT_APP_CESIUM_ION_TOKEN` – Cesium ion access token for imagery, terrain, and OSM Buildings. You can use the default token shared in the project notes, but storing it in `.env.local` keeps secrets out of source control.

### Available Scripts

```bash
yarn start   # run CRA dev server on http://localhost:3000
yarn build   # produce production bundle
yarn test    # CRA test runner
```

### 3D Viewer Notes

- Cesium assets are served from `/cesium`, configured via `craco.config.js`.
- The 3D modal disables MapLibre’s double-click zoom so the gesture exclusively opens the Cesium viewer.
- If the modal opens without terrain/imagery, confirm the ion token is valid and not rate-limited.

### Troubleshooting

- **White globe / ocean only** – ion token missing or invalid.
- **Modal doesn’t open** – be sure you double-click the aircraft glyph; map double-click zoom is disabled to avoid conflicts.

