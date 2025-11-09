from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Tuple
import uuid
from datetime import datetime, timezone
import httpx
import asyncio
from aircraft_simulator import get_simulator, reset_simulator
from notam_engine import get_notam_engine


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


class Notam(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    category: str
    location: str
    number: str
    classification: str
    start: str
    end: str
    condition: str
    emission: int
    received_at: datetime
    is_new: bool


class NotamFeedResponse(BaseModel):
    notams: List[Notam]
    sequence: int
    last_updated: datetime
    cadence_seconds: float
    total_catalog: int
    window_size: int

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


@api_router.get("/notams", response_model=NotamFeedResponse)
async def get_notam_feed():
    engine = get_notam_engine()
    feed_snapshot = await engine.get_feed()

    last_updated_raw = feed_snapshot.get("last_updated")
    last_updated = (
        datetime.fromisoformat(last_updated_raw)
        if isinstance(last_updated_raw, str)
        else last_updated_raw
    )

    notam_items = [
        Notam(**item) if not isinstance(item, Notam) else item
        for item in feed_snapshot.get("notams", [])
    ]

    return NotamFeedResponse(
        notams=notam_items,
        sequence=feed_snapshot.get("sequence", 0),
        last_updated=last_updated or datetime.now(timezone.utc),
        cadence_seconds=float(feed_snapshot.get("cadence_seconds", 0)),
        total_catalog=int(feed_snapshot.get("total_catalog", len(notam_items))),
        window_size=int(feed_snapshot.get("window_size", len(notam_items))),
    )


# ===== ODIN ATC Console - OpenSky Network Integration =====

# OAuth2 Configuration
OPENSKY_CLIENT_ID = os.environ.get('OPENSKY_CLIENT_ID') or os.environ.get('CLIENT_ID')
OPENSKY_CLIENT_SECRET = os.environ.get('OPENSKY_CLIENT_SECRET') or os.environ.get('CLIENT_SECRET')
OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token"
OPENSKY_API_URL = "https://opensky-network.org/api/states/all"
OPENSKY_TOKEN_CACHE_SECONDS = 1500  # ~25 minutes
OPENSKY_TOKEN_REFRESH_BUFFER_SECONDS = 60

# Simulation Configuration
ENABLE_SIMULATION = os.environ.get('ENABLE_SIMULATION', 'false').lower() == 'true'
SIMULATION_AIRCRAFT_COUNT = int(os.environ.get('SIMULATION_AIRCRAFT_COUNT', '15'))

# Token cache (in-memory)
oauth_token_cache = {
    "access_token": None,
    "expires_at": None
}

# Simulation mode tracking
simulation_mode_active = False
simulation_fail_count = 0
MAX_FAIL_COUNT = 3  # Switch to simulation after 3 consecutive failures

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
    data_status: str  # "ok", "stale", "unavailable", "simulated"
    aircraft_count: int
    bbox: Dict[str, float]
    is_simulated: bool = False


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
    """
    Fetch aircraft data from OpenSky Network API with OAuth2 authentication.
    Falls back to simulation if API is unavailable or simulation is enabled.
    """
    global simulation_mode_active, simulation_fail_count, oauth_token_cache
    
    # If simulation is explicitly enabled, use it immediately
    if ENABLE_SIMULATION and not simulation_mode_active:
        logger.info(f"Simulation mode enabled via config - starting with {SIMULATION_AIRCRAFT_COUNT} aircraft")
        simulation_mode_active = True
        simulator = get_simulator(bbox, SIMULATION_AIRCRAFT_COUNT)
        return simulator.get_current_state()
    
    # If already in simulation mode, use simulator
    if simulation_mode_active:
        simulator = get_simulator(bbox, SIMULATION_AIRCRAFT_COUNT)
        return simulator.get_current_state()
    
    params = {
        "lamin": bbox["lamin"],
        "lamax": bbox["lamax"],
        "lomin": bbox["lomin"],
        "lomax": bbox["lomax"]
    }
    
    async def _get_access_token(force_refresh: bool = False) -> Tuple[Optional[str], bool]:
        """
        Retrieve and cache OpenSky OAuth token with ~25 minute TTL.
        Returns a tuple of (token, fatal_error_flag). When fatal_error_flag is True,
        callers should not retry and should fail over to simulation immediately.
        """
        global oauth_token_cache
        now_ts = datetime.now(timezone.utc).timestamp()
        
        if not force_refresh:
            cached_token = oauth_token_cache.get("access_token")
            expires_at = oauth_token_cache.get("expires_at")
            if cached_token and expires_at and now_ts < expires_at:
                logger.debug("Using cached OpenSky OAuth token")
                return cached_token, False
        
        if not OPENSKY_CLIENT_ID or not OPENSKY_CLIENT_SECRET:
            logger.error("OpenSky OAuth credentials are not configured")
            return None, True
        
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    OPENSKY_TOKEN_URL,
                    headers={"Content-Type": "application/x-www-form-urlencoded"},
                    data={
                        "grant_type": "client_credentials",
                        "client_id": OPENSKY_CLIENT_ID,
                        "client_secret": OPENSKY_CLIENT_SECRET
                    }
                )
        except httpx.RequestError as exc:
            logger.error(f"Error obtaining OpenSky OAuth token: {exc}")
            return None, False
        
        if response.status_code != 200:
            logger.error(f"Failed to obtain OpenSky token: {response.status_code} - {response.text}")
            return None, response.status_code in {400, 401, 403}
        
        token_payload = response.json()
        access_token = token_payload.get("access_token")
        if not access_token:
            logger.error("OpenSky token response did not include an access token")
            return None, True
        
        expires_in = int(token_payload.get("expires_in", 1800))
        capped_expires_in = min(expires_in, OPENSKY_TOKEN_CACHE_SECONDS)
        cache_seconds = max(capped_expires_in - OPENSKY_TOKEN_REFRESH_BUFFER_SECONDS, 60)
        cache_seconds = min(cache_seconds, capped_expires_in)  # Never cache longer than the token is valid
        oauth_token_cache["access_token"] = access_token
        oauth_token_cache["expires_at"] = datetime.now(timezone.utc).timestamp() + cache_seconds
        logger.info("Fetched new OpenSky OAuth token")
        return access_token, False
    
    last_error_message = None
    fatal_failure = False
    
    try:
        for attempt in range(2):  # Attempt once, refresh token and retry on 401
            access_token, fatal_token_error = await _get_access_token(force_refresh=(attempt == 1))
            if not access_token:
                last_error_message = "Unable to acquire OpenSky OAuth token"
                fatal_failure = fatal_token_error
                if fatal_failure:
                    logger.error("Fatal token acquisition error encountered; failing over to simulation")
                break
            
            try:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.get(
                        OPENSKY_API_URL,
                        params=params,
                        headers={"Authorization": f"Bearer {access_token}"}
                    )
            except httpx.TimeoutException:
                last_error_message = "OpenSky API request timed out"
                logger.error(last_error_message)
                break
            except httpx.RequestError as exc:
                last_error_message = f"OpenSky API request error: {exc}"
                logger.error(last_error_message)
                break
            
            if response.status_code == 200:
                simulation_fail_count = 0
                logger.info("Successfully fetched data from OpenSky API")
                return response.json()
            
            if response.status_code == 401 and attempt == 0:
                logger.warning("OpenSky API returned 401 Unauthorized; refreshing token and retrying once")
                oauth_token_cache["access_token"] = None
                oauth_token_cache["expires_at"] = None
                continue
            
            last_error_message = f"OpenSky API returned status {response.status_code}: {response.text}"
            logger.error(last_error_message)
            break
    except Exception as exc:
        last_error_message = f"Unexpected OpenSky API error: {exc}"
        logger.error(last_error_message)
    
    # Handle failure by optionally transitioning to simulation mode
    if fatal_failure:
        simulation_fail_count = max(simulation_fail_count, MAX_FAIL_COUNT)
    else:
        simulation_fail_count += 1
    logger.warning(f"OpenSky fetch failed (attempt {simulation_fail_count}): {last_error_message}")
    
    if simulation_fail_count >= MAX_FAIL_COUNT:
        logger.warning(f"Switching to simulation mode after {MAX_FAIL_COUNT} consecutive failures")
        simulation_mode_active = True
        simulator = get_simulator(bbox, SIMULATION_AIRCRAFT_COUNT)
        return simulator.get_current_state()
    
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
        
        # Determine status based on global simulation flag
        global simulation_mode_active
        status_msg = "simulated" if simulation_mode_active else "ok"
        logger.info(f"Successfully fetched {len(aircraft_list)} aircraft [{status_msg}]")
        
        return AirPictureResponse(
            aircraft=aircraft_list,
            timestamp=opensky_cache["timestamp"],
            data_status=status_msg,
            aircraft_count=len(aircraft_list),
            bbox=BAY_AREA_BBOX,
            is_simulated=simulation_mode_active
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


# ===== ODIN COPILOT CHAT =====

from services.openrouter_client import OpenRouterClient, OpenRouterError
from fastapi.responses import StreamingResponse
import json

# OpenRouter Configuration
OPENROUTER_API_KEY = os.environ.get('OPENROUTER_API_KEY', '')
OPENROUTER_BASE_URL = os.environ.get('OPENROUTER_BASE_URL', 'https://openrouter.ai/api/v1')
OPENROUTER_MODEL = os.environ.get('OPENROUTER_MODEL', 'anthropic/claude-3.5-sonnet')
OPENROUTER_TIMEOUT = float(os.environ.get('OPENROUTER_TIMEOUT_SECONDS', '15'))
CHAT_STREAMING_ENABLED = os.environ.get('CHAT_STREAMING_ENABLED', 'true').lower() == 'true'

# Initialize OpenRouter client
openrouter_client = None
if OPENROUTER_API_KEY:
    openrouter_client = OpenRouterClient(
        api_key=OPENROUTER_API_KEY,
        base_url=OPENROUTER_BASE_URL,
        model=OPENROUTER_MODEL,
        timeout_seconds=OPENROUTER_TIMEOUT
    )
    logger.info(f"OpenRouter client initialized with model: {OPENROUTER_MODEL}")
else:
    logger.warning("OpenRouter API key not configured - chat will be unavailable")


# Chat Models
class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    role: str  # "user", "assistant", "system"
    content: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Optional[Dict[str, Any]] = None


class ChatSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    title: str = "New Conversation"
    messages: List[ChatMessage] = []
    context_state: Optional[Dict[str, Any]] = None
    latency_stats: Optional[Dict[str, Any]] = None


class ChatSessionCreate(BaseModel):
    title: Optional[str] = "New Conversation"


class ChatMessageRequest(BaseModel):
    session_id: str
    user_message: str
    console_context: Optional[Dict[str, Any]] = None
    stream: bool = False


class ChatMessageResponse(BaseModel):
    session_id: str
    message: ChatMessage
    predicted_follow_up: Optional[str] = None
    latency_ms: Optional[float] = None


# System prompt for Odin Copilot
ODIN_SYSTEM_PROMPT = """You are ODIN Copilot, the conversational assistant embedded in the Odin ATC Console for Bay Area air-traffic trainees and controllers.

Structured JSON context accompanies each request and can include:
- aircraft: details about the selected track.
- notams: relevant advisories.
- system_status: data freshness indicators and console health signals.
- history: recent dialogue turns.
- next_actions: predicted tasks the user is likely to work on next.

Guidelines:
- Deliver concise, operationally useful insights (ideally 2-4 sentences). Convert measurements to controller-friendly units such as feet, knots, and both local/UTC time.
- Confirm the user's current goal, provide the best available information, and recommend the most relevant follow-up action based on next_actions or your own inference.
- When referencing NOTAMs, cite the identifier and summarize its impact in plain language.
- If key information is missing, call that out and suggest how the user can obtain it.
- Maintain a calm, professional tone, and close by offering further help ("Ready if you need more detail.").
- Offer guidance only—never claim to execute system commands yourself.

Respond in JSON:
{
  "reply": "<assistant message>",
  "citations": [optional array of context keys used],
  "meta": {
    "confidence": "high" | "medium" | "low",
    "predicted_follow_up": "<suggested next question or action>"
  }
}"""


def strip_internal_flags(context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Remove internal flags from context before sending to LLM.
    
    Args:
        context: Raw context dict
        
    Returns:
        Sanitized context dict
    """
    sanitized = context.copy()
    
    # Remove simulation and internal flags
    if "aircraft" in sanitized:
        for aircraft in sanitized.get("aircraft", []):
            aircraft.pop("is_simulated", None)
            aircraft.pop("_profile", None)
            aircraft.pop("_velocity_lat", None)
            aircraft.pop("_velocity_lon", None)
    
    if "system_status" in sanitized:
        sanitized["system_status"].pop("is_simulated", None)
        sanitized["system_status"].pop("simulation_mode_active", None)
    
    sanitized.pop("is_simulated", None)
    
    return sanitized


async def assemble_console_context(
    selected_aircraft: Optional[str] = None,
    include_notams: bool = True
) -> Dict[str, Any]:
    """
    Assemble current console context for LLM.
    
    Args:
        selected_aircraft: ICAO24 of selected aircraft
        include_notams: Whether to include NOTAMs
        
    Returns:
        Context dict with aircraft, NOTAMs, system status
    """
    context = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "system_status": {
            "data_status": opensky_cache.get("is_stale", False) and "stale" or "ok",
            "aircraft_count": len(opensky_cache.get("data", []))
        }
    }
    
    # Add selected aircraft if provided
    if selected_aircraft and opensky_cache.get("data"):
        for aircraft in opensky_cache["data"]:
            if aircraft.icao24.lower() == selected_aircraft.lower():
                # Convert to dict and add friendly units
                ac_dict = aircraft.model_dump()
                if ac_dict.get("baro_altitude"):
                    ac_dict["altitude_ft"] = int(ac_dict["baro_altitude"] * 3.28084)
                if ac_dict.get("velocity"):
                    ac_dict["speed_kts"] = int(ac_dict["velocity"] * 1.94384)
                if ac_dict.get("vertical_rate"):
                    ac_dict["vertical_rate_fpm"] = int(ac_dict["vertical_rate"] * 196.85)
                
                context["selected_aircraft"] = ac_dict
                break
    
    # Add recent NOTAMs if requested
    if include_notams:
        try:
            engine = get_notam_engine()
            feed = await engine.get_feed()
            # Include only the 5 most recent NOTAMs
            recent_notams = feed.get("notams", [])[:5]
            context["recent_notams"] = recent_notams
        except Exception as e:
            logger.warning(f"Failed to fetch NOTAMs for context: {e}")
    
    # Strip internal flags
    return strip_internal_flags(context)


@api_router.post("/chat/session", response_model=ChatSession)
async def create_chat_session(input: ChatSessionCreate):
    """Create a new chat session."""
    session = ChatSession(title=input.title)
    
    # Store in MongoDB
    session_dict = session.model_dump()
    session_dict['messages'] = []  # Store empty initially
    await db.conversations.insert_one(session_dict)
    
    logger.info(f"Created chat session: {session.session_id}")
    return session


@api_router.get("/chat/sessions")
async def list_chat_sessions(limit: int = 20, skip: int = 0):
    """List chat sessions (paginated)."""
    sessions = await db.conversations.find(
        {},
        {"_id": 0}
    ).sort("updated_at", -1).skip(skip).limit(limit).to_list(limit)
    
    return {
        "sessions": sessions,
        "total": await db.conversations.count_documents({}),
        "limit": limit,
        "skip": skip
    }


@api_router.get("/chat/session/{session_id}", response_model=ChatSession)
async def get_chat_session(session_id: str):
    """Get a specific chat session with full transcript."""
    session = await db.conversations.find_one(
        {"session_id": session_id},
        {"_id": 0}
    )
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return session


@api_router.post("/chat/message")
async def send_chat_message(request: ChatMessageRequest):
    """Send a message and get assistant reply."""
    if not openrouter_client:
        raise HTTPException(
            status_code=503,
            detail="Chat service unavailable - OpenRouter not configured"
        )
    
    # Fetch session
    session = await db.conversations.find_one({"session_id": request.session_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Add user message
    user_msg = ChatMessage(
        role="user",
        content=request.user_message,
        metadata={"context_included": request.console_context is not None}
    )
    
    # Build messages array for LLM
    messages = [{"role": "system", "content": ODIN_SYSTEM_PROMPT}]
    
    # Add conversation history (last 10 messages)
    for msg in session.get("messages", [])[-10:]:
        messages.append({
            "role": msg["role"],
            "content": msg["content"]
        })
    
    # Add user message
    messages.append({"role": "user", "content": request.user_message})
    
    # Add context if provided
    if request.console_context:
        context = await assemble_console_context(
            selected_aircraft=request.console_context.get("selected_aircraft_icao"),
            include_notams=request.console_context.get("include_notams", True)
        )
        context_msg = f"\n\nCurrent Console Context:\n{json.dumps(context, indent=2)}"
        messages[-1]["content"] += context_msg
    
    # Handle streaming
    if request.stream and CHAT_STREAMING_ENABLED:
        async def stream_generator():
            try:
                full_response = ""
                async for token in openrouter_client.chat_completion_stream(messages):
                    full_response += token
                    yield f"data: {json.dumps({'token': token})}\n\n"
                
                # Parse final response
                try:
                    parsed = json.loads(full_response)
                    reply_text = parsed.get("reply", full_response)
                    predicted_follow_up = parsed.get("meta", {}).get("predicted_follow_up")
                except json.JSONDecodeError:
                    reply_text = full_response
                    predicted_follow_up = None
                
                # Save messages to DB
                assistant_msg = ChatMessage(
                    role="assistant",
                    content=reply_text,
                    metadata={
                        "predicted_follow_up": predicted_follow_up,
                        "model": OPENROUTER_MODEL
                    }
                )
                
                await db.conversations.update_one(
                    {"session_id": request.session_id},
                    {
                        "$push": {"messages": {"$each": [user_msg.model_dump(), assistant_msg.model_dump()]}},
                        "$set": {"updated_at": datetime.now(timezone.utc)}
                    }
                )
                
                yield f"data: {json.dumps({'done': True, 'predicted_follow_up': predicted_follow_up})}\n\n"
                
            except OpenRouterError as e:
                logger.error(f"OpenRouter error during streaming: {e}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
        
        return StreamingResponse(stream_generator(), media_type="text/event-stream")
    
    # Non-streaming response
    try:
        result = await openrouter_client.chat_completion(messages, max_tokens=500)
        
        # Parse response
        content = result["content"]
        if isinstance(content, dict):
            reply_text = content.get("reply", str(content))
            predicted_follow_up = content.get("meta", {}).get("predicted_follow_up")
        else:
            # Try to parse JSON from string
            try:
                parsed = json.loads(content)
                reply_text = parsed.get("reply", content)
                predicted_follow_up = parsed.get("meta", {}).get("predicted_follow_up")
            except json.JSONDecodeError:
                reply_text = content
                predicted_follow_up = None
        
        # Create assistant message
        assistant_msg = ChatMessage(
            role="assistant",
            content=reply_text,
            metadata={
                "predicted_follow_up": predicted_follow_up,
                "latency_ms": result.get("latency_ms"),
                "model": OPENROUTER_MODEL
            }
        )
        
        # Save both messages to DB
        await db.conversations.update_one(
            {"session_id": request.session_id},
            {
                "$push": {"messages": {"$each": [user_msg.model_dump(), assistant_msg.model_dump()]}},
                "$set": {
                    "updated_at": datetime.now(timezone.utc),
                    "latency_stats": {"last_latency_ms": result.get("latency_ms")}
                }
            }
        )
        
        # Log event
        await db.chat_events.insert_one({
            "session_id": request.session_id,
            "event": "message_sent",
            "timestamp": datetime.now(timezone.utc),
            "latency_ms": result.get("latency_ms"),
            "model": OPENROUTER_MODEL
        })
        
        return ChatMessageResponse(
            session_id=request.session_id,
            message=assistant_msg,
            predicted_follow_up=predicted_follow_up,
            latency_ms=result.get("latency_ms")
        )
        
    except OpenRouterError as e:
        logger.error(f"OpenRouter error: {e}")
        # Return fallback message
        fallback_msg = ChatMessage(
            role="assistant",
            content="I'm temporarily unable to process your request. The chat service is experiencing connectivity issues. Please try again in a moment.",
            metadata={"error": str(e), "fallback": True}
        )
        
        await db.conversations.update_one(
            {"session_id": request.session_id},
            {
                "$push": {"messages": {"$each": [user_msg.model_dump(), fallback_msg.model_dump()]}},
                "$set": {"updated_at": datetime.now(timezone.utc)}
            }
        )
        
        raise HTTPException(status_code=503, detail=str(e))


@api_router.post("/chat/session/{session_id}/reset")
async def reset_chat_session(session_id: str):
    """Clear conversation history for a session."""
    result = await db.conversations.update_one(
        {"session_id": session_id},
        {
            "$set": {
                "messages": [],
                "updated_at": datetime.now(timezone.utc)
            }
        }
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Session not found")
    
    logger.info(f"Reset chat session: {session_id}")
    return {"success": True, "session_id": session_id}


@api_router.get("/chat/health")
async def chat_health_check():
    """Check OpenRouter connectivity and configuration."""
    if not openrouter_client:
        return {
            "healthy": False,
            "error": "OpenRouter not configured",
            "config": {
                "api_key_set": bool(OPENROUTER_API_KEY),
                "model": OPENROUTER_MODEL,
                "streaming_enabled": CHAT_STREAMING_ENABLED
            }
        }
    
    health = await openrouter_client.health_check()
    health["config"] = {
        "model": OPENROUTER_MODEL,
        "streaming_enabled": CHAT_STREAMING_ENABLED,
        "timeout_seconds": OPENROUTER_TIMEOUT
    }
    
    return health


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