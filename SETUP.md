# ODIN Setup Guide

Complete setup instructions to get ODIN running with real data.

---

## Required API Keys

### 1. OpenSky Network (Real Aircraft Data)
**Required for:** Live aircraft tracking in Bay Area

- **Sign up:** https://opensky-network.org/
- **Get OAuth credentials:** https://opensky-network.org/my-opensky
  - Go to "My OpenSky" → "OAuth Applications" → "New Application"
  - Copy your `Client ID` and `Client Secret`

**Environment variables:**
```bash
OPENSKY_CLIENT_ID=your_client_id_here
OPENSKY_CLIENT_SECRET=your_client_secret_here
```

**Alternative:** To use **simulated data** instead, set:
```bash
ENABLE_SIMULATION=true
SIMULATION_AIRCRAFT_COUNT=15
```

---

### 2. MapTiler (Map Tiles)
**Required for:** Base map rendering

- **Sign up:** https://www.maptiler.com/cloud/
- **Get API key:** https://cloud.maptiler.com/account/keys/

**Environment variables:**
```bash
REACT_APP_MAPTILER_KEY=your_maptiler_key_here
```

---

### 3. Cesium Ion (3D Viewer)
**Required for:** 3D aircraft visualization

- **Sign up:** https://ion.cesium.com/signup
- **Get access token:** https://ion.cesium.com/tokens

**Environment variables:**
```bash
REACT_APP_CESIUM_ION_TOKEN=your_cesium_token_here
```

---

### 4. WeatherAPI (Weather Data)
**Required for:** Airport weather display

- **Sign up:** https://www.weatherapi.com/signup.aspx
- **Get API key:** https://www.weatherapi.com/my/

**Environment variables:**
```bash
WEATHERAPI_KEY=your_weatherapi_key_here
```

---

### 5. OpenRouter (AI Chat - Optional)
**Required for:** AI copilot chat feature

- **Sign up:** https://openrouter.ai/
- **Get API key:** https://openrouter.ai/keys

**Environment variables:**
```bash
OPENROUTER_API_KEY=your_openrouter_key_here
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

---

### 6. MongoDB (Database)
**Required for:** Data persistence

**Option A - MongoDB Atlas (Cloud):**
- Sign up: https://www.mongodb.com/cloud/atlas/register
- Create free cluster
- Get connection string

**Option B - Local MongoDB:**
```bash
# macOS
brew install mongodb-community
brew services start mongodb-community

# Connection string
MONGO_URL=mongodb://localhost:27017
```

**Environment variables:**
```bash
MONGO_URL=your_mongodb_connection_string
DB_NAME=odin
```

---

## Setup Steps

### 1. Backend Setup

```bash
cd backend

# Create .env file
cat > .env << 'EOF'
# MongoDB
MONGO_URL=mongodb://localhost:27017
DB_NAME=odin

# OpenSky Network (for real data)
OPENSKY_CLIENT_ID=your_client_id
OPENSKY_CLIENT_SECRET=your_client_secret

# OR use simulation mode
ENABLE_SIMULATION=false
SIMULATION_AIRCRAFT_COUNT=15

# Weather
WEATHERAPI_KEY=your_weatherapi_key

# OpenRouter (optional)
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
EOF

# Install dependencies
pip install -r requirements.txt

# Run backend
python server.py
```

Backend runs on: **http://localhost:8000**

---

### 2. Frontend Setup

```bash
cd frontend

# Create .env file
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_MAPTILER_KEY=your_maptiler_key
REACT_APP_CESIUM_ION_TOKEN=your_cesium_token
EOF

# Install dependencies
npm install
# or
yarn install

# Run frontend
npm start
# or
yarn start
```

Frontend runs on: **http://localhost:3000**

---

## Quick Start (Without API Keys)

Want to test immediately? Use simulation mode:

### Backend `.env`:
```bash
MONGO_URL=mongodb://localhost:27017
DB_NAME=odin
ENABLE_SIMULATION=true
SIMULATION_AIRCRAFT_COUNT=20
```

### Frontend `.env`:
```bash
REACT_APP_BACKEND_URL=http://localhost:8000
REACT_APP_MAPTILER_KEY=get_free_key_from_maptiler
REACT_APP_CESIUM_ION_TOKEN=optional_for_3d
```

**Note:** MapTiler key is still required for map tiles. Get a free key at https://www.maptiler.com/cloud/

---

## Switching to Real Data

Once you have OpenSky credentials:

1. **Update backend/.env:**
   ```bash
   ENABLE_SIMULATION=false
   OPENSKY_CLIENT_ID=your_actual_id
   OPENSKY_CLIENT_SECRET=your_actual_secret
   ```

2. **Restart backend:**
   ```bash
   cd backend
   python server.py
   ```

3. **Verify in browser:**
   - Open http://localhost:3000
   - Check status indicator shows "LIVE" (not "STALE" or "OFFLINE")
   - Click aircraft to see real callsigns and data

---

## Feature Matrix

| Feature | Required API Keys | Status |
|---------|------------------|--------|
| **Map Display** | MapTiler | ✅ Required |
| **Aircraft Tracking** | OpenSky OR Simulation | ✅ Required |
| **Weather Data** | WeatherAPI | ✅ Active |
| **NOTAM Feed** | None (uses seed data) | ✅ Active |
| **3D Viewer** | Cesium Ion | ⚠️ Optional |
| **AI Chat** | OpenRouter | ⚠️ Optional |

---

## Troubleshooting

### Backend Issues

**MongoDB Connection Error:**
```
Error: Could not connect to MongoDB
```
→ Install MongoDB or use MongoDB Atlas connection string

**OpenSky 401 Unauthorized:**
```
Error: OpenSky authentication failed
```
→ Verify `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` are correct

**Simulation Mode Activated:**
```
⚠️ OpenSky API failed, switching to simulation mode
```
→ Normal behavior when OpenSky credentials are missing or rate-limited

### Frontend Issues

**Map Not Loading:**
```
Error: Failed to fetch map tiles
```
→ Check `REACT_APP_MAPTILER_KEY` is set and valid

**No Aircraft Visible:**
```
Loading aircraft data...
```
→ Ensure backend is running on port 8000
→ Check browser console for CORS errors

**3D Viewer Not Working:**
```
Cesium ion token missing
```
→ Add `REACT_APP_CESIUM_ION_TOKEN` to frontend/.env

---

## Rate Limits

- **OpenSky Free Tier:** 400 credits/day, ~1 request per 10 seconds
- **MapTiler Free Tier:** 100,000 tile requests/month
- **Cesium Ion Free Tier:** 1,000,000 tile/month
- **WeatherAPI Free Tier:** 1,000,000 calls/month
- **OpenRouter:** Pay-as-you-go (Claude 3.5 Sonnet ~$3/1M input tokens)

---

## Need Help?

- **OpenSky API Docs:** https://openskynetwork.github.io/opensky-api/
- **Backend API:** http://localhost:8000/docs (FastAPI auto-docs)
- **Issue Tracker:** Check `report.md` for known issues
