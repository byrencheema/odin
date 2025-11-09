"""
Bay Area ATC Facilities Data
Includes towers, TRACON, and center with coverage radii
"""

import math
from typing import List, Dict, Any

# Bay Area ATC Facilities with coordinates and coverage
ATC_FACILITIES = [
    # Towers (Class D airspace)
    {
        "id": "KSFO",
        "name": "San Francisco Tower",
        "type": "tower",
        "lat": 37.6213,
        "lon": -122.3790,
        "frequency": "120.5",
        "coverage_nm": 5,
        "elevation_ft": 13,
        "color": "#4DD7E6"  # Cyan for towers
    },
    {
        "id": "KOAK",
        "name": "Oakland Tower",
        "type": "tower",
        "lat": 37.7214,
        "lon": -122.2208,
        "frequency": "118.3",
        "coverage_nm": 5,
        "elevation_ft": 9,
        "color": "#4DD7E6"
    },
    {
        "id": "KSJC",
        "name": "San Jose Tower",
        "type": "tower",
        "lat": 37.3639,
        "lon": -121.9289,
        "frequency": "120.9",
        "coverage_nm": 5,
        "elevation_ft": 62,
        "color": "#4DD7E6"
    },
    {
        "id": "KHWD",
        "name": "Hayward Tower",
        "type": "tower",
        "lat": 37.6592,
        "lon": -122.1219,
        "frequency": "119.0",
        "coverage_nm": 4,
        "elevation_ft": 52,
        "color": "#4DD7E6"
    },
    {
        "id": "KSQL",
        "name": "San Carlos Tower",
        "type": "tower",
        "lat": 37.5119,
        "lon": -122.2494,
        "frequency": "119.0",
        "coverage_nm": 4,
        "elevation_ft": 5,
        "color": "#4DD7E6"
    },
    {
        "id": "KPAO",
        "name": "Palo Alto Tower",
        "type": "tower",
        "lat": 37.4611,
        "lon": -122.1150,
        "frequency": "118.6",
        "coverage_nm": 4,
        "elevation_ft": 4,
        "color": "#4DD7E6"
    },
    {
        "id": "KCCR",
        "name": "Concord Tower",
        "type": "tower",
        "lat": 37.9897,
        "lon": -122.0569,
        "frequency": "119.7",
        "coverage_nm": 4,
        "elevation_ft": 26,
        "color": "#4DD7E6"
    },
    {
        "id": "KLVK",
        "name": "Livermore Tower",
        "type": "tower",
        "lat": 37.6936,
        "lon": -121.8203,
        "frequency": "119.65",
        "coverage_nm": 4,
        "elevation_ft": 400,
        "color": "#4DD7E6"
    },
    # TRACON (Terminal Radar Approach Control)
    {
        "id": "NCT",
        "name": "NorCal TRACON",
        "type": "tracon",
        "lat": 37.8,
        "lon": -122.4,  # Approximate center
        "frequency": "135.65 / 128.35",
        "coverage_nm": 60,
        "elevation_ft": 0,
        "color": "#FF6B6B"  # Red for TRACON
    },
    # Center (En-route control)
    {
        "id": "ZOA",
        "name": "Oakland Center",
        "type": "center",
        "lat": 37.8,
        "lon": -122.4,
        "frequency": "133.5",
        "coverage_nm": 150,
        "elevation_ft": 0,
        "color": "#6BEA76"  # Green for center
    }
]


def nm_to_degrees(nautical_miles: float, latitude: float) -> float:
    """
    Convert nautical miles to approximate degrees at a given latitude.
    1 NM = 1 minute of latitude = 1/60 degree
    For longitude, adjust by cosine of latitude.
    """
    # 1 nautical mile = 1/60 degree of latitude
    lat_degrees = nautical_miles / 60.0
    return lat_degrees


def create_circle_polygon(center_lat: float, center_lon: float, radius_nm: float, num_points: int = 64) -> List[List[float]]:
    """
    Create a circle as a polygon with given center and radius.
    Returns list of [lon, lat] coordinates forming a closed ring.
    """
    radius_deg_lat = nm_to_degrees(radius_nm, center_lat)
    # Adjust longitude radius by latitude (circles get narrower near poles)
    radius_deg_lon = radius_deg_lat / math.cos(math.radians(center_lat))
    
    coordinates = []
    for i in range(num_points + 1):  # +1 to close the ring
        angle = 2 * math.pi * i / num_points
        lon = center_lon + radius_deg_lon * math.cos(angle)
        lat = center_lat + radius_deg_lat * math.sin(angle)
        coordinates.append([lon, lat])
    
    return coordinates


def generate_coverage_geojson() -> Dict[str, Any]:
    """
    Generate GeoJSON FeatureCollection with coverage circles for all facilities.
    """
    features = []
    
    for facility in ATC_FACILITIES:
        # Create coverage circle polygon
        circle_coords = create_circle_polygon(
            facility["lat"],
            facility["lon"],
            facility["coverage_nm"]
        )
        
        feature = {
            "type": "Feature",
            "properties": {
                "id": facility["id"],
                "name": facility["name"],
                "type": facility["type"],
                "frequency": facility["frequency"],
                "coverage_nm": facility["coverage_nm"],
                "color": facility["color"],
                "elevation_ft": facility["elevation_ft"]
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [circle_coords]
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }


def generate_facilities_points_geojson() -> Dict[str, Any]:
    """
    Generate GeoJSON FeatureCollection with point markers for all facilities.
    """
    features = []
    
    for facility in ATC_FACILITIES:
        feature = {
            "type": "Feature",
            "properties": {
                "id": facility["id"],
                "name": facility["name"],
                "type": facility["type"],
                "frequency": facility["frequency"],
                "coverage_nm": facility["coverage_nm"],
                "color": facility["color"],
                "elevation_ft": facility["elevation_ft"]
            },
            "geometry": {
                "type": "Point",
                "coordinates": [facility["lon"], facility["lat"]]
            }
        }
        features.append(feature)
    
    return {
        "type": "FeatureCollection",
        "features": features
    }
