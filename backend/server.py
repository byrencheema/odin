from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import httpx
import asyncio


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")


# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")  # Ignore MongoDB's _id field
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

# Add your routes to the router instead of directly to app
@api_router.get("/")
async def root():
    return {"message": "Hello World"}

@api_router.post("/status", response_model=StatusCheck)
async def create_status_check(input: StatusCheckCreate):
    status_dict = input.model_dump()
    status_obj = StatusCheck(**status_dict)
    
    # Convert to dict and serialize datetime to ISO string for MongoDB
    doc = status_obj.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    _ = await db.status_checks.insert_one(doc)
    return status_obj

@api_router.get("/status", response_model=List[StatusCheck])
async def get_status_checks():
    # Exclude MongoDB's _id field from the query results
    status_checks = await db.status_checks.find({}, {"_id": 0}).to_list(1000)
    
    # Convert ISO string timestamps back to datetime objects
    for check in status_checks:
        if isinstance(check['timestamp'], str):
            check['timestamp'] = datetime.fromisoformat(check['timestamp'])
    
    return status_checks


# ===== ODIN ATC Console - OpenSky Network Integration =====

# Cache for OpenSky data (in-memory)
opensky_cache = {
    "data": None,
    "timestamp": None,
    "is_stale": False
}
CACHE_TTL_SECONDS = 10  # OpenSky free tier allows 1 req/10s
STALE_THRESHOLD_SECONDS = 15  # Mark as stale after 15s

# Bay Area bounding box (approximate)
BAY_AREA_BBOX = {
    "lamin": 36.8,  # South
    "lamax": 38.5,  # North
    "lomin": -123.0,  # West
    "lomax": -121.2   # East
}


class Aircraft(BaseModel):
    """Normalized aircraft state from OpenSky Network"""
    icao24: str
    callsign: Optional[str] = None
    origin_country: str
    time_position: Optional[int] = None
    last_contact: int
    longitude: Optional[float] = None
    latitude: Optional[float] = None
    baro_altitude: Optional[float] = None
    geo_altitude: Optional[float] = None
    on_ground: bool
    velocity: Optional[float] = None
    true_track: Optional[float] = None
    vertical_rate: Optional[float] = None
    squawk: Optional[str] = None


class AirPictureResponse(BaseModel):
    """Response model for air picture data"""
    aircraft: List[Aircraft]
    timestamp: int
    data_status: str  # "ok", "stale", "unavailable"
    aircraft_count: int
    bbox: Dict[str, float]


def normalize_opensky_state(state: List[Any]) -> Optional[Aircraft]:
    """
    Convert OpenSky state vector to normalized Aircraft model.
    State vector format: [icao24, callsign, origin_country, time_position, 
                          last_contact, lon, lat, baro_alt, on_ground, velocity, 
                          true_track, vertical_rate, sensors, geo_alt, squawk, 
                          spi, position_source, category]
    """
    try:
        # Basic validation
        if not state or len(state) < 17:
            return None
        
        # Skip aircraft without position
        if state[5] is None or state[6] is None:
            return None
        
        return Aircraft(
            icao24=state[0] or "",
            callsign=state[1].strip() if state[1] else None,
            origin_country=state[2] or "",
            time_position=int(state[3]) if state[3] else None,
            last_contact=int(state[4]) if state[4] else 0,
            longitude=float(state[5]) if state[5] is not None else None,
            latitude=float(state[6]) if state[6] is not None else None,
            baro_altitude=float(state[7]) if state[7] is not None else None,
            on_ground=bool(state[8]) if state[8] is not None else False,
            velocity=float(state[9]) if state[9] is not None else None,
            true_track=float(state[10]) if state[10] is not None else None,
            vertical_rate=float(state[11]) if state[11] is not None else None,
            geo_altitude=float(state[13]) if state[13] is not None else None,
            squawk=str(state[14]) if state[14] else None
        )
    except (IndexError, ValueError, TypeError) as e:
        logger.warning(f"Failed to normalize state vector: {e}")
        return None


async def fetch_opensky_data(bbox: Dict[str, float]) -> Optional[Dict[str, Any]]:
    """Fetch aircraft data from OpenSky Network API"""
    try:
        url = "https://opensky-network.org/api/states/all"
        params = {
            "lamin": bbox["lamin"],
            "lamax": bbox["lamax"],
            "lomin": bbox["lomin"],
            "lomax": bbox["lomax"]
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            
            if response.status_code == 200:
                return response.json()
            else:
                logger.error(f"OpenSky API returned status {response.status_code}")
                return None
                
    except httpx.TimeoutException:
        logger.error("OpenSky API request timed out")
        return None
    except Exception as e:
        logger.error(f"OpenSky API error: {e}")
        return None


@api_router.get("/air/opensky", response_model=AirPictureResponse)
async def get_opensky_aircraft():
    """
    Get current aircraft data from OpenSky Network for Bay Area.
    Uses caching to respect rate limits (10s TTL).
    Returns stale data if fresh data unavailable.
    """
    global opensky_cache
    
    now = datetime.now(timezone.utc)
    current_timestamp = int(now.timestamp())
    
    # Check if we have cached data
    if opensky_cache["data"] and opensky_cache["timestamp"]:
        cache_age = current_timestamp - opensky_cache["timestamp"]
        
        # If cache is fresh (< 10s), return it
        if cache_age < CACHE_TTL_SECONDS:
            logger.info(f"Returning cached data (age: {cache_age}s)")
            return AirPictureResponse(
                aircraft=opensky_cache["data"],
                timestamp=opensky_cache["timestamp"],
                data_status="ok" if cache_age < 5 else "recent",
                aircraft_count=len(opensky_cache["data"]),
                bbox=BAY_AREA_BBOX
            )
        
        # Cache is old, mark as potentially stale but try to refresh
        opensky_cache["is_stale"] = cache_age > STALE_THRESHOLD_SECONDS
    
    # Fetch fresh data from OpenSky
    logger.info("Fetching fresh data from OpenSky Network...")
    raw_data = await fetch_opensky_data(BAY_AREA_BBOX)
    
    if raw_data and "states" in raw_data and raw_data["states"]:
        # Normalize aircraft data
        aircraft_list = []
        for state in raw_data["states"]:
            aircraft = normalize_opensky_state(state)
            if aircraft:
                aircraft_list.append(aircraft)
        
        # Update cache
        opensky_cache["data"] = aircraft_list
        opensky_cache["timestamp"] = raw_data.get("time", current_timestamp)
        opensky_cache["is_stale"] = False
        
        logger.info(f"Successfully fetched {len(aircraft_list)} aircraft")
        
        return AirPictureResponse(
            aircraft=aircraft_list,
            timestamp=opensky_cache["timestamp"],
            data_status="ok",
            aircraft_count=len(aircraft_list),
            bbox=BAY_AREA_BBOX
        )
    
    # If fetch failed but we have stale cache, return it
    if opensky_cache["data"]:
        cache_age = current_timestamp - opensky_cache["timestamp"]
        logger.warning(f"OpenSky fetch failed, returning stale cache (age: {cache_age}s)")
        
        return AirPictureResponse(
            aircraft=opensky_cache["data"],
            timestamp=opensky_cache["timestamp"],
            data_status="stale",
            aircraft_count=len(opensky_cache["data"]),
            bbox=BAY_AREA_BBOX
        )
    
    # No data available at all
    logger.error("No OpenSky data available")
    raise HTTPException(status_code=503, detail="Aircraft data temporarily unavailable")


@api_router.get("/aircraft/{icao24}")
async def get_aircraft_details(icao24: str):
    """Get details for a specific aircraft by ICAO24 hex code"""
    if not opensky_cache["data"]:
        raise HTTPException(status_code=404, detail="No aircraft data available")
    
    # Find aircraft in cache
    for aircraft in opensky_cache["data"]:
        if aircraft.icao24.lower() == icao24.lower():
            return aircraft
    
    raise HTTPException(status_code=404, detail=f"Aircraft {icao24} not found")

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()