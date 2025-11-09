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
        self.last_update = time.time()
        self.last_spawn_time = time.time()

        # Common airline callsigns for Bay Area
        self.airlines = [
            "UAL", "SWA", "DAL", "AAL", "ASA", "SKW", "JBU",
            "FFT", "N", "FDX", "UPS", "ABX"
        ]

        # Bay Area airports with realistic approach/departure patterns
        self.airports = {
            "KSFO": {
                "lat": 37.6213, "lon": -122.3790,
                "runways": {
                    "28L/28R": {"heading": 280, "approach_alt": 600, "departure_alt": 300},
                    "01L/01R": {"heading": 10, "approach_alt": 600, "departure_alt": 300}
                }
            },
            "KOAK": {
                "lat": 37.7214, "lon": -122.2208,
                "runways": {
                    "30": {"heading": 300, "approach_alt": 500, "departure_alt": 300},
                    "12": {"heading": 120, "approach_alt": 500, "departure_alt": 300}
                }
            },
            "KSJC": {
                "lat": 37.3639, "lon": -121.9289,
                "runways": {
                    "30L/30R": {"heading": 300, "approach_alt": 500, "departure_alt": 300},
                    "12L/12R": {"heading": 120, "approach_alt": 500, "departure_alt": 300}
                }
            }
        }

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
    
    def _create_arrival_aircraft(self) -> Dict[str, Any]:
        """Create an arriving aircraft on approach to KSFO, KOAK, or KSJC"""
        # Pick random airport and runway
        airport_code = random.choice(list(self.airports.keys()))
        airport = self.airports[airport_code]
        runway = random.choice(list(airport["runways"].values()))

        # Start 20-40 nm out on final approach
        distance_nm = random.uniform(20, 40)
        distance_deg = distance_nm / 60.0  # 1 degree ≈ 60 nm

        # Calculate starting position along approach path (reverse of runway heading)
        approach_heading = (runway["heading"] + 180) % 360
        heading_rad = math.radians(approach_heading)

        start_lat = airport["lat"] + distance_deg * math.cos(heading_rad)
        start_lon = airport["lon"] + distance_deg * math.sin(heading_rad) / math.cos(math.radians(airport["lat"]))

        # Altitude decreases with distance (roughly 3 degree glideslope = 300 ft/nm)
        altitude_ft = runway["approach_alt"] + (distance_nm * 300)
        altitude_m = altitude_ft * 0.3048

        return {
            "icao24": self._generate_icao24(),
            "callsign": self._generate_callsign(),
            "origin_country": "United States",
            "latitude": start_lat,
            "longitude": start_lon,
            "baro_altitude": altitude_m,
            "geo_altitude": altitude_m + random.uniform(-50, 50),
            "velocity": random.uniform(70, 90),  # m/s (136-175 kts)
            "true_track": runway["heading"],
            "vertical_rate": random.uniform(-4, -2),  # m/s (descending)
            "on_ground": False,
            "squawk": f"{random.randint(0o1000, 0o7777):04o}",
            "last_contact": int(time.time()),
            "time_position": int(time.time()),
            "_profile": "arriving",
            "_target_airport": airport_code,
            "_target_heading": runway["heading"]
        }

    def _create_departure_aircraft(self) -> Dict[str, Any]:
        """Create a departing aircraft climbing out from KSFO, KOAK, or KSJC"""
        # Pick random airport and runway
        airport_code = random.choice(list(self.airports.keys()))
        airport = self.airports[airport_code]
        runway = random.choice(list(airport["runways"].values()))

        # Start near the airport, just after takeoff
        distance_nm = random.uniform(2, 8)
        distance_deg = distance_nm / 60.0

        heading_rad = math.radians(runway["heading"])
        start_lat = airport["lat"] + distance_deg * math.cos(heading_rad)
        start_lon = airport["lon"] + distance_deg * math.sin(heading_rad) / math.cos(math.radians(airport["lat"]))

        # Initial climb altitude
        altitude_ft = runway["departure_alt"] + (distance_nm * 500)  # Climbing
        altitude_m = altitude_ft * 0.3048

        return {
            "icao24": self._generate_icao24(),
            "callsign": self._generate_callsign(),
            "origin_country": "United States",
            "latitude": start_lat,
            "longitude": start_lon,
            "baro_altitude": altitude_m,
            "geo_altitude": altitude_m + random.uniform(-50, 50),
            "velocity": random.uniform(80, 120),  # m/s (155-233 kts)
            "true_track": runway["heading"],
            "vertical_rate": random.uniform(5, 12),  # m/s (climbing)
            "on_ground": False,
            "squawk": f"{random.randint(0o1000, 0o7777):04o}",
            "last_contact": int(time.time()),
            "time_position": int(time.time()),
            "_profile": "departing",
            "_target_airport": airport_code,
            "_target_heading": runway["heading"]
        }

    def _create_cruise_aircraft(self) -> Dict[str, Any]:
        """Create an aircraft in cruise or overflying the area"""
        # Random position within bbox
        lat = random.uniform(self.bbox["lamin"], self.bbox["lamax"])
        lon = random.uniform(self.bbox["lomin"], self.bbox["lomax"])

        profile = random.choice(["cruising", "overfly"])

        if profile == "cruising":
            altitude = random.uniform(9000, 12000)  # meters (29,500-39,370 ft)
            velocity = random.uniform(200, 250)  # m/s (388-485 kts)
            vertical_rate = random.uniform(-0.5, 0.5)  # m/s (level flight)
        else:  # overfly
            altitude = random.uniform(10000, 13000)  # meters
            velocity = random.uniform(220, 260)  # m/s
            vertical_rate = 0

        # Heading: common patterns are N-S and E-W with variation
        base_headings = [0, 45, 90, 135, 180, 225, 270, 315]
        heading = random.choice(base_headings) + random.uniform(-20, 20)
        heading = heading % 360

        return {
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
            "squawk": f"{random.randint(0o1000, 0o7777):04o}" if random.random() < 0.9 else None,
            "last_contact": int(time.time()),
            "time_position": int(time.time()),
            "_profile": profile,
            "_target_heading": heading
        }

    def _initialize_aircraft(self):
        """Create initial set of aircraft with realistic mix of arrivals/departures/cruise"""
        # Mix of different aircraft types
        num_arrivals = int(self.num_aircraft * 0.35)  # 35% arriving
        num_departures = int(self.num_aircraft * 0.35)  # 35% departing
        num_cruise = self.num_aircraft - num_arrivals - num_departures  # 30% cruise/overfly

        for _ in range(num_arrivals):
            self.aircraft.append(self._create_arrival_aircraft())

        for _ in range(num_departures):
            self.aircraft.append(self._create_departure_aircraft())

        for _ in range(num_cruise):
            self.aircraft.append(self._create_cruise_aircraft())
    
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

        # Handle heading based on profile
        if aircraft["_profile"] in ["arriving", "departing"]:
            # Arrivals/departures maintain steady heading toward target with minimal variation
            target_heading = aircraft.get("_target_heading", aircraft["true_track"])
            heading_diff = (target_heading - aircraft["true_track"] + 180) % 360 - 180
            aircraft["true_track"] += heading_diff * 0.1  # Gentle correction toward target
            aircraft["true_track"] += random.uniform(-0.5, 0.5)  # Small random variation
        else:
            # Cruise/overfly aircraft have more random heading changes
            aircraft["true_track"] += random.uniform(-1, 1)

        aircraft["true_track"] = aircraft["true_track"] % 360

        # Update timestamps
        aircraft["last_contact"] = int(time.time())
        aircraft["time_position"] = int(time.time())

        # Handle boundary conditions and profile transitions
        self._handle_boundaries(aircraft)
    
    def _should_remove_aircraft(self, aircraft: Dict[str, Any]) -> bool:
        """Determine if aircraft should be removed from simulation"""
        # Remove if out of bounds
        if (aircraft["latitude"] < self.bbox["lamin"] - 0.5 or
            aircraft["latitude"] > self.bbox["lamax"] + 0.5 or
            aircraft["longitude"] < self.bbox["lomin"] - 0.5 or
            aircraft["longitude"] > self.bbox["lomax"] + 0.5):
            return True

        # Remove arrivals that have landed (very low altitude)
        if aircraft["_profile"] == "arriving" and aircraft["baro_altitude"] < 50:
            return True

        # Remove departures that have climbed too high
        if aircraft["_profile"] == "departing" and aircraft["baro_altitude"] > 10000:
            return True

        return False

    def _handle_boundaries(self, aircraft: Dict[str, Any]):
        """Handle aircraft altitude limits and transitions"""
        # Altitude limits for cruise aircraft
        if aircraft["_profile"] in ["cruising", "overfly"]:
            if aircraft["baro_altitude"] < 8000:
                aircraft["baro_altitude"] = 8000
                aircraft["vertical_rate"] = random.uniform(0, 2)

            if aircraft["baro_altitude"] > 13000:
                aircraft["baro_altitude"] = 13000
                aircraft["vertical_rate"] = random.uniform(-2, 0)
    
    def _spawn_new_aircraft(self):
        """Spawn new aircraft periodically to maintain realistic traffic"""
        current_time = time.time()

        # Spawn new aircraft every 45-90 seconds on average
        spawn_interval = random.uniform(45, 90)

        if current_time - self.last_spawn_time > spawn_interval:
            # Decide what type of aircraft to spawn
            aircraft_type = random.choice(["arrival", "arrival", "departure", "departure", "cruise"])

            if aircraft_type == "arrival":
                new_aircraft = self._create_arrival_aircraft()
            elif aircraft_type == "departure":
                new_aircraft = self._create_departure_aircraft()
            else:
                new_aircraft = self._create_cruise_aircraft()

            self.aircraft.append(new_aircraft)
            self.last_spawn_time = current_time

    def get_current_state(self) -> Dict[str, Any]:
        """
        Get current aircraft state in OpenSky API format.

        Returns:
            Dict with 'time' and 'states' keys matching OpenSky format
        """
        current_time = time.time()
        dt = current_time - self.last_update

        # Update all aircraft positions with actual time delta
        for aircraft in self.aircraft:
            self._update_aircraft_position(aircraft, dt)

        # Remove aircraft that have left the area or completed their flight
        self.aircraft = [ac for ac in self.aircraft if not self._should_remove_aircraft(ac)]

        # Spawn new aircraft to maintain traffic levels
        self._spawn_new_aircraft()

        # Keep aircraft count around target (but allow some natural variation)
        while len(self.aircraft) < self.num_aircraft - 5:
            aircraft_type = random.choice(["arrival", "departure", "cruise"])
            if aircraft_type == "arrival":
                self.aircraft.append(self._create_arrival_aircraft())
            elif aircraft_type == "departure":
                self.aircraft.append(self._create_departure_aircraft())
            else:
                self.aircraft.append(self._create_cruise_aircraft())

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

        # Update last_update time for next iteration
        self.last_update = current_time

        return {
            "time": int(current_time),
            "states": states
        }
    
    def reset(self):
        """Reset simulation with new random aircraft"""
        self.aircraft = []
        self.start_time = time.time()
        self.last_update = time.time()
        self.last_spawn_time = time.time()
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
