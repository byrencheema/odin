import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import maplibregl from 'maplibre-gl';
import { Separator } from './components/ui/separator';
import { Checkbox } from './components/ui/checkbox';
import { Switch } from './components/ui/switch';
import { Label } from './components/ui/label';
import { ScrollArea } from './components/ui/scroll-area';
import { Card, CardHeader, CardContent } from './components/ui/card';
import { Toaster, toast } from 'sonner';
import { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet';
import { Button } from './components/ui/button';
import { PanelLeft, Info } from 'lucide-react';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;
const API = `${BACKEND_URL}/api`;

// Bay Area center
const BAY_AREA_CENTER = [-122.4, 37.8];

export default function App() {
  const [aircraft, setAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [dataStatus, setDataStatus] = useState('ok');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [localTime, setLocalTime] = useState('');
  const [utcTime, setUtcTime] = useState('');
  
  // Filter states
  const [showRunways, setShowRunways] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const canvasOverlay = useRef(null);
  const animationFrame = useRef(null);
  const aircraftHistory = useRef({});

  // Clock updates
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const localStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const utcStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
      setLocalTime(localStr);
      setUtcTime(utcStr);
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'maptiler': {
            type: 'raster',
            tiles: [
              `https://api.maptiler.com/maps/voyager/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
            ],
            tileSize: 256
          }
        },
        layers: [
          {
            id: 'background',
            type: 'background',
            paint: { 'background-color': '#0A0B0C' }
          },
          {
            id: 'maptiler-layer',
            type: 'raster',
            source: 'maptiler',
            paint: {
              'raster-opacity': 0.15,
              'raster-brightness-min': 0,
              'raster-brightness-max': 0.3,
              'raster-contrast': -0.2,
              'raster-saturation': -1
            }
          }
        ],
        glyphs: 'https://api.maptiler.com/fonts/{fontstack}/{range}.pbf?key=' + MAPTILER_KEY
      },
      center: BAY_AREA_CENTER,
      zoom: 8,
      pitch: 0,
      bearing: 0,
      attributionControl: false
    });

    map.current.on('load', () => {
      initializeCanvasOverlay();
    });

    return () => {
      if (animationFrame.current) cancelAnimationFrame(animationFrame.current);
      if (map.current) map.current.remove();
    };
  }, []);

  // Initialize canvas overlay for aircraft
  const initializeCanvasOverlay = () => {
    const canvas = document.createElement('canvas');
    const container = map.current.getCanvasContainer();
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    container.appendChild(canvas);
    canvasOverlay.current = canvas;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const { width, height } = container.getBoundingClientRect();
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      const ctx = canvas.getContext('2d');
      ctx.scale(dpr, dpr);
    };

    resize();
    map.current.on('resize', resize);
    map.current.on('move', () => drawAircraft());
    map.current.on('zoom', () => drawAircraft());

    // Start animation loop
    const animate = () => {
      drawAircraft();
      animationFrame.current = requestAnimationFrame(animate);
    };
    animate();
  };

  // Draw aircraft on canvas
  const drawAircraft = useCallback(() => {
    if (!canvasOverlay.current || !map.current || !showTraffic) return;

    const canvas = canvasOverlay.current;
    const ctx = canvas.getContext('2d');
    const { width, height } = canvas.getBoundingClientRect();

    ctx.clearRect(0, 0, width, height);

    aircraft.forEach((ac) => {
      if (!ac.longitude || !ac.latitude) return;

      const point = map.current.project([ac.longitude, ac.latitude]);
      const heading = (ac.true_track || 0) * Math.PI / 180;

      // Draw oriented triangle
      const size = 8;
      const isSelected = selectedAircraft && selectedAircraft.icao24 === ac.icao24;
      ctx.strokeStyle = isSelected ? '#4DD7E6' : '#E7E9EA';
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.fillStyle = 'transparent';

      ctx.beginPath();
      ctx.moveTo(
        point.x + Math.cos(heading) * size,
        point.y + Math.sin(heading) * size
      );
      ctx.lineTo(
        point.x + Math.cos(heading + 2.6) * size,
        point.y + Math.sin(heading + 2.6) * size
      );
      ctx.lineTo(
        point.x + Math.cos(heading - 2.6) * size,
        point.y + Math.sin(heading - 2.6) * size
      );
      ctx.closePath();
      ctx.stroke();

      // Draw label
      const callsign = (ac.callsign || ac.icao24).trim();
      const alt = ac.baro_altitude ? Math.round(ac.baro_altitude * 3.28084) : '---';
      const spd = ac.velocity ? Math.round(ac.velocity * 1.94384) : '---';
      const label = `${callsign} | ${alt} | ${spd}`;

      ctx.font = "12px 'Azeret Mono', monospace";
      ctx.fillStyle = isSelected ? '#4DD7E6' : '#E7E9EA';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, point.x + 12, point.y);
    });
  }, [aircraft, selectedAircraft, showTraffic]);

  // Fetch aircraft data
  const fetchAircraft = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/air/opensky`, { timeout: 8000 });
      const data = response.data;
      
      setAircraft(data.aircraft || []);
      setDataStatus(data.data_status || 'ok');
      setLastUpdate(Date.now());

      if (data.data_status === 'stale') {
        toast.warning('Aircraft data is stale', { id: 'stale-data' });
      } else if (data.data_status === 'ok' && lastUpdate) {
        toast.dismiss('stale-data');
      }
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
      setDataStatus('unavailable');
      toast.error('Aircraft data unavailable', { id: 'data-error' });
    }
  }, [lastUpdate]);

  // Poll for aircraft updates
  useEffect(() => {
    fetchAircraft();
    const interval = setInterval(fetchAircraft, 2000); // Poll every 2 seconds
    return () => clearInterval(interval);
  }, [fetchAircraft]);

  // Handle aircraft selection (click on map)
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e) => {
      const { x, y } = e.point;
      const clickRadius = 15;

      for (const ac of aircraft) {
        if (!ac.longitude || !ac.latitude) continue;
        const point = map.current.project([ac.longitude, ac.latitude]);
        const dist = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
        if (dist <= clickRadius) {
          setSelectedAircraft(ac);
          return;
        }
      }
      setSelectedAircraft(null);
    };

    map.current.on('click', handleClick);
    return () => map.current.off('click', handleClick);
  }, [aircraft]);

  const FiltersPanel = () => (
    <ScrollArea className="h-[calc(100vh-48px)] p-4" data-testid="filters-panel-scroll">
      <div className="space-y-6">
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Airports / Runways</h3>
          <label className="flex items-center gap-2">
            <Checkbox checked={showRunways} onCheckedChange={setShowRunways} data-testid="runways-checkbox" />
            <span className="text-sm text-[#E7E9EA]">Show Runways</span>
          </label>
        </div>
        <Separator className="bg-[#3A3E43]" />
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Traffic</h3>
          <label className="flex items-center gap-2">
            <Checkbox checked={showTraffic} onCheckedChange={setShowTraffic} data-testid="traffic-checkbox" />
            <span className="text-sm text-[#E7E9EA]">Show Aircraft</span>
          </label>
        </div>
        <Separator className="bg-[#3A3E43]" />
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Layers (Future)</h3>
          <div className="space-y-3 opacity-50">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Weather</Label>
              <Switch disabled data-testid="weather-switch" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Incidents</Label>
              <Switch disabled data-testid="incidents-switch" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Heatmap</Label>
              <Switch disabled data-testid="heatmap-switch" />
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );

  const InfoPanel = () => {
    if (!selectedAircraft) {
      return (
        <div className="h-[calc(100vh-48px)] flex items-center justify-center text-[#A9ADB1] px-4" data-testid="info-empty">
          <p className="text-center text-sm">Click an aircraft to view details</p>
        </div>
      );
    }

    const callsign = (selectedAircraft.callsign || selectedAircraft.icao24).trim();
    const alt = selectedAircraft.baro_altitude ? Math.round(selectedAircraft.baro_altitude * 3.28084) : '---';
    const spd = selectedAircraft.velocity ? Math.round(selectedAircraft.velocity * 1.94384) : '---';
    const hdg = selectedAircraft.true_track ? Math.round(selectedAircraft.true_track) : '---';
    const vspd = selectedAircraft.vertical_rate ? Math.round(selectedAircraft.vertical_rate * 196.85) : '---';

    return (
      <ScrollArea className="h-[calc(100vh-48px)] p-4" data-testid="aircraft-info">
        <Card className="bg-[#0E0F11] border-[#3A3E43]">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="font-['Azeret_Mono',monospace] text-lg text-[#4DD7E6]" data-testid="info-callsign">
                {callsign}
              </div>
              <div className="text-xs text-[#A9ADB1]" data-testid="info-icao">{selectedAircraft.icao24.toUpperCase()}</div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">ALTITUDE</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-alt">{alt} ft</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">SPEED</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-spd">{spd} kts</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">HEADING</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-hdg">{hdg}°</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">V/S</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-vspd">{vspd} fpm</div>
              </div>
            </div>
            <Separator className="bg-[#3A3E43]" />
            <div>
              <div className="text-[#A9ADB1] text-xs mb-1">ORIGIN</div>
              <div className="text-sm text-[#E7E9EA]" data-testid="info-origin">{selectedAircraft.origin_country}</div>
            </div>
            <div>
              <div className="text-[#A9ADB1] text-xs mb-1">ON GROUND</div>
              <div className="text-sm text-[#E7E9EA]" data-testid="info-ground">{selectedAircraft.on_ground ? 'Yes' : 'No'}</div>
            </div>
            {selectedAircraft.squawk && (
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">SQUAWK</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-squawk">{selectedAircraft.squawk}</div>
              </div>
            )}
          </CardContent>
        </Card>
        <div className="mt-4 p-3 bg-[#0E0F11] border border-[#3A3E43] rounded-lg">
          <p className="text-xs text-[#A9ADB1] italic">Future: AI copilot insights will appear here</p>
        </div>
      </ScrollArea>
    );
  };

  const getStatusColor = () => {
    switch (dataStatus) {
      case 'ok': return '#6BEA76';
      case 'stale': return '#FFC857';
      case 'unavailable': return '#FF6B6B';
      default: return '#4DD7E6';
    }
  };

  const getStatusText = () => {
    switch (dataStatus) {
      case 'ok': return 'LIVE · 2s tick';
      case 'stale': return 'STALE';
      case 'unavailable': return 'OFFLINE';
      default: return 'INIT';
    }
  };

  return (
    <div className="bg-[#0A0B0C] text-[#E7E9EA] min-h-screen">
      <Toaster theme="dark" richColors position="top-right" />
      
      {/* AIR Bar */}
      <header className="h-12 border-b border-[#3A3E43] flex items-center justify-between px-4" data-testid="air-bar">
        <div className="flex items-center gap-3">
          <div className="text-[#E7E9EA] font-semibold tracking-tight text-lg" data-testid="odin-logo">ODIN</div>
          <Separator orientation="vertical" className="h-4 bg-[#3A3E43]" />
          <span className="text-sm text-[#A9ADB1]" data-testid="region-label">Bay Area</span>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <span className="font-['Azeret_Mono',monospace] text-sm" data-testid="clock-local">LCL {localTime}</span>
          <span className="font-['Azeret_Mono',monospace] text-sm" data-testid="clock-utc">UTC {utcTime}</span>
          <span 
            className="text-xs px-2 py-1 rounded border border-[#3A3E43]" 
            style={{ color: getStatusColor() }}
            data-testid="sim-status"
          >
            {getStatusText()}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-[#A9ADB1]">
          <span data-testid="weather-summary">METAR: —</span>
          <span data-testid="active-runways">RWY: —</span>
        </div>
        <div className="md:hidden flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" data-testid="open-filters-button">
                <PanelLeft size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-80 bg-[#0E0F11] text-[#E7E9EA] border-[#3A3E43]">
              <FiltersPanel />
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button size="sm" variant="ghost" data-testid="open-info-button">
                <Info size={16} />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-[#0E0F11] text-[#E7E9EA] border-[#3A3E43]">
              <InfoPanel />
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-[18rem_minmax(0,1fr)_22rem] h-[calc(100vh-48px)]">
        <aside className="border-r border-[#3A3E43] bg-[#0E0F11]" data-testid="filters-panel">
          <FiltersPanel />
        </aside>
        <main className="relative" data-testid="map-canvas-area">
          <div ref={mapContainer} className="w-full h-full" />
          {aircraft.length === 0 && showTraffic && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-[#A9ADB1] text-sm opacity-60">Loading aircraft data...</p>
            </div>
          )}
        </main>
        <aside className="border-l border-[#3A3E43] bg-[#0E0F11]" data-testid="info-panel">
          <InfoPanel />
        </aside>
      </div>

      {/* Mobile map */}
      <div className="md:hidden h-[calc(100vh-48px)]" data-testid="map-canvas-area-mobile">
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  );
}
