"""
Bay Area airspace boundaries for ODIN ATC Console.
Simplified airspace sectors based on FAA sectional charts.
"""

BAY_AREA_AIRSPACE = {
    "type": "FeatureCollection",
    "features": [
        # San Francisco Class B Airspace
        {
            "type": "Feature",
            "properties": {
                "name": "SFO Class B",
                "class": "B",
                "airport": "KSFO",
                "floor_ft": 0,
                "ceiling_ft": 10000,
                "color": "#1E40AF",  # Deep blue
                "label_color": "#60A5FA"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-122.65, 37.45],
                    [-122.15, 37.45],
                    [-122.15, 37.85],
                    [-122.65, 37.85],
                    [-122.65, 37.45]
                ]]
            }
        },
        # Oakland Class C Airspace
        {
            "type": "Feature",
            "properties": {
                "name": "KOAK Class C",
                "class": "C",
                "airport": "KOAK",
                "floor_ft": 0,
                "ceiling_ft": 4000,
                "color": "#BE185D",  # Magenta
                "label_color": "#F472B6"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-122.35, 37.60],
                    [-122.15, 37.60],
                    [-122.15, 37.82],
                    [-122.35, 37.82],
                    [-122.35, 37.60]
                ]]
            }
        },
        # San Jose Class C Airspace
        {
            "type": "Feature",
            "properties": {
                "name": "KSJC Class C",
                "class": "C",
                "airport": "KSJC",
                "floor_ft": 0,
                "ceiling_ft": 4000,
                "color": "#BE185D",  # Magenta
                "label_color": "#F472B6"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-121.95, 37.25],
                    [-121.75, 37.25],
                    [-121.75, 37.45],
                    [-121.95, 37.45],
                    [-121.95, 37.25]
                ]]
            }
        },
        # Bay Area Class E Shelf (simplified)
        {
            "type": "Feature",
            "properties": {
                "name": "Bay Area Class E",
                "class": "E",
                "airport": "Multiple",
                "floor_ft": 700,
                "ceiling_ft": 18000,
                "color": "#374151",  # Gray
                "label_color": "#9CA3AF"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-123.0, 36.8],
                    [-121.2, 36.8],
                    [-121.2, 38.5],
                    [-123.0, 38.5],
                    [-123.0, 36.8]
                ]]
            }
        },
        # Training Area (example special use airspace)
        {
            "type": "Feature",
            "properties": {
                "name": "MOA-Delta",
                "class": "MOA",
                "airport": "N/A",
                "floor_ft": 8000,
                "ceiling_ft": 18000,
                "color": "#DC2626",  # Red for restricted
                "label_color": "#F87171",
                "pattern": "restricted"
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [-122.8, 37.3],
                    [-122.6, 37.3],
                    [-122.6, 37.5],
                    [-122.8, 37.5],
                    [-122.8, 37.3]
                ]]
            }
        }
    ]
}
