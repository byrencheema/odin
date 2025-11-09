"""
Aircraft Simulator for ODIN ATC Console
Generates realistic aircraft flight patterns for the Bay Area when OpenSky API is unavailable.
"""

import random
import math
import time
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone


class AircraftSimulator:
    """Simulates realistic aircraft movement in the Bay Area"""
    
    def __init__(self, bbox: Dict[str, float], num_aircraft: int = 15):
        """
        Initialize simulator with bounding box and number of aircraft.
        
        Args:
            bbox: Geographic bounding box {lamin, lamax, lomin, lomax}
            num_aircraft: Number of aircraft to simulate (default 15)
        """
        self.bbox = bbox
        self.num_aircraft = num_aircraft
        self.aircraft = []
        self.start_time = time.time()
        
        # Common airline callsigns for Bay Area
        self.airlines = [
            "UAL", "SWA", "DAL", "AAL", "ASA", "SKW", "JBU", 
            "FFT", "N", "FDX", "UPS", "ABX"
        ]
        
        # Initialize aircraft with random positions and velocities
        self._initialize_aircraft()
    
    def _generate_icao24(self) -> str:
        """Generate realistic ICAO 24-bit hex code"""
        return ''.join(random.choices('0123456789abcdef', k=6))
    
    def _generate_callsign(self) -> str:
        """Generate realistic callsign"""
        airline = random.choice(self.airlines)
        if airline == "N":
            # General aviation
            return f"N{random.randint(100, 999)}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}{random.choice('ABCDEFGHIJKLMNOPQRSTUVWXYZ')}"
        else:
            # Commercial flight
            return f"{airline}{random.randint(1, 9999)}"
    
    def _initialize_aircraft(self):
        """Create initial set of aircraft with random but realistic parameters"""
        for i in range(self.num_aircraft):
            # Random position within bbox
            lat = random.uniform(self.bbox["lamin"], self.bbox["lamax"])
            lon = random.uniform(self.bbox["lomin"], self.bbox["lomax"])
            
            # Flight profiles: arriving (descending), departing (climbing), or cruising
            profile = random.choice(["arriving", "departing", "cruising", "overfly"])
            
            if profile == "arriving":
                altitude = random.uniform(500, 8000)  # meters (1,640 - 26,240 ft)
                velocity = random.uniform(80, 150)  # m/s (155-291 kts)
                vertical_rate = random.uniform(-8, -2)  # m/s (descending)
            elif profile == "departing":
                altitude = random.uniform(300, 5000)  # meters
                velocity = random.uniform(70, 130)  # m/s
                vertical_rate = random.uniform(2, 10)  # m/s (climbing)
            elif profile == "cruising":
                altitude = random.uniform(9000, 12000)  # meters (29,500-39,370 ft)
                velocity = random.uniform(200, 250)  # m/s (388-485 kts)
                vertical_rate = random.uniform(-0.5, 0.5)  # m/s (level flight)
            else:  # overfly
                altitude = random.uniform(10000, 13000)  # meters
                velocity = random.uniform(220, 260)  # m/s
                vertical_rate = 0
            
            # Heading: for Bay Area, common patterns are N-S and E-W
            # With some variation for realism
            base_headings = [0, 45, 90, 135, 180, 225, 270, 315]
            heading = random.choice(base_headings) + random.uniform(-20, 20)
            heading = heading % 360
            
            aircraft = {
                "icao24": self._generate_icao24(),
                "callsign": self._generate_callsign(),
                "origin_country": "United States",
                "latitude": lat,
                "longitude": lon,
                "baro_altitude": altitude,
                "geo_altitude": altitude + random.uniform(-50, 50),
                "velocity": velocity,
                "true_track": heading,
                "vertical_rate": vertical_rate,
                "on_ground": False,
                "squawk": None if random.random() > 0.1 else f"{random.randint(1000, 7700):04d}",
                "last_contact": int(time.time()),
                "time_position": int(time.time()),
                # Internal state for simulation
                "_velocity_lat": velocity * math.cos(math.radians(heading)),
                "_velocity_lon": velocity * math.sin(math.radians(heading)),
                "_profile": profile
            }
            
            self.aircraft.append(aircraft)
    
    def _update_aircraft_position(self, aircraft: Dict[str, Any], dt: float):
        """
        Update aircraft position based on velocity and time elapsed.
        
        Args:
            aircraft: Aircraft dict to update
            dt: Time delta in seconds
        """
        # Convert velocity from m/s to degrees per second (approximate)
        # At Bay Area latitude (~37.8°), 1 degree longitude ≈ 88.8 km
        # 1 degree latitude ≈ 111 km
        meters_per_deg_lat = 111000
        meters_per_deg_lon = 88800  # at ~38° latitude
        
        # Update position
        heading_rad = math.radians(aircraft["true_track"])
        velocity_m_s = aircraft["velocity"]
        
        # Movement in meters
        dx = velocity_m_s * math.sin(heading_rad) * dt
        dy = velocity_m_s * math.cos(heading_rad) * dt
        
        # Convert to degrees and update
        aircraft["longitude"] += dx / meters_per_deg_lon
        aircraft["latitude"] += dy / meters_per_deg_lat
        
        # Update altitude
        aircraft["baro_altitude"] += aircraft["vertical_rate"] * dt
        aircraft["geo_altitude"] = aircraft["baro_altitude"] + random.uniform(-50, 50)
        
        # Add slight heading variation for realism
        aircraft["true_track"] += random.uniform(-2, 2)
        aircraft["true_track"] = aircraft["true_track"] % 360
        
        # Update timestamps
        aircraft["last_contact"] = int(time.time())
        aircraft["time_position"] = int(time.time())
        
        # Handle boundary conditions and profile transitions
        self._handle_boundaries(aircraft)
    
    def _handle_boundaries(self, aircraft: Dict[str, Any]):
        """Handle aircraft leaving bbox or altitude limits"""
        # If aircraft leaves bbox, wrap around or reverse
        if aircraft["latitude"] < self.bbox["lamin"] or aircraft["latitude"] > self.bbox["lamax"]:
            aircraft["true_track"] = (aircraft["true_track"] + 180) % 360
        
        if aircraft["longitude"] < self.bbox["lomin"] or aircraft["longitude"] > self.bbox["lomax"]:
            aircraft["true_track"] = (aircraft["true_track"] + 180) % 360
        
        # Altitude limits
        if aircraft["baro_altitude"] < 100:  # Landing
            aircraft["baro_altitude"] = 100
            aircraft["vertical_rate"] = random.uniform(2, 8)  # Start climbing (departing)
            aircraft["_profile"] = "departing"
        
        if aircraft["baro_altitude"] > 13000:  # Too high
            aircraft["baro_altitude"] = 13000
            aircraft["vertical_rate"] = random.uniform(-5, 0)  # Level off or descend
    
    def get_current_state(self) -> Dict[str, Any]:
        """
        Get current aircraft state in OpenSky API format.
        
        Returns:
            Dict with 'time' and 'states' keys matching OpenSky format
        """
        current_time = time.time()
        dt = current_time - self.start_time
        
        # Update all aircraft positions
        for aircraft in self.aircraft:
            # Update roughly every second (smooth motion)
            self._update_aircraft_position(aircraft, 1.0)
        
        # Format as OpenSky state vectors
        states = []
        for ac in self.aircraft:
            state = [
                ac["icao24"],                    # 0: icao24
                ac["callsign"],                  # 1: callsign
                ac["origin_country"],            # 2: origin_country
                ac["time_position"],             # 3: time_position
                ac["last_contact"],              # 4: last_contact
                ac["longitude"],                 # 5: longitude
                ac["latitude"],                  # 6: latitude
                ac["baro_altitude"],             # 7: baro_altitude
                ac["on_ground"],                 # 8: on_ground
                ac["velocity"],                  # 9: velocity
                ac["true_track"],                # 10: true_track
                ac["vertical_rate"],             # 11: vertical_rate
                None,                            # 12: sensors
                ac["geo_altitude"],              # 13: geo_altitude
                ac["squawk"],                    # 14: squawk
                False,                           # 15: spi
                0,                               # 16: position_source (ADS-B)
                0                                # 17: category
            ]
            states.append(state)
        
        return {
            "time": int(current_time),
            "states": states
        }
    
    def reset(self):
        """Reset simulation with new random aircraft"""
        self.aircraft = []
        self.start_time = time.time()
        self._initialize_aircraft()


# Singleton instance
_simulator_instance: Optional[AircraftSimulator] = None


def get_simulator(bbox: Dict[str, float], num_aircraft: int = 15) -> AircraftSimulator:
    """Get or create simulator singleton instance"""
    global _simulator_instance
    
    if _simulator_instance is None:
        _simulator_instance = AircraftSimulator(bbox, num_aircraft)
    
    return _simulator_instance


def reset_simulator():
    """Reset the simulator instance"""
    global _simulator_instance
    if _simulator_instance:
        _simulator_instance.reset()
