import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
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
import Aircraft3DModal from './components/Aircraft3DModal';
import SimpleChatView from './components/SimpleChatView';
import { LIVE_ATC_FEEDS, getLiveATCUrl } from './data/liveATCFeeds';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
import '@/App.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const MAPTILER_KEY = process.env.REACT_APP_MAPTILER_KEY;
const API = `${BACKEND_URL}/api`;

// Bay Area center
const BAY_AREA_CENTER = [-122.4, 37.8];

const formatTimestamp = (value) => {
  if (!value) {
    return '—';
  }

  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleString('en-US', {
      hour12: false,
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Failed to format timestamp', error);
    return '—';
  }
};

const FiltersPanel = ({
  mapRef,
  showRunways,
  setShowRunways,
  showTraffic,
  setShowTraffic,
  showTrails,
  setShowTrails,
  showAirspace,
  setShowAirspace,
  showATCFacilities,
  setShowATCFacilities,
  showWeather,
  setShowWeather,
}) => {
  const updateLayerVisibility = (layerIds, visible) => {
    const mapInstance = mapRef?.current;
    if (!mapInstance) return;

    layerIds.forEach((layerId) => {
      if (mapInstance.getLayer(layerId)) {
        mapInstance.setLayoutProperty(layerId, 'visibility', visible ? 'visible' : 'none');
      }
    });
  };
  const toBoolean = (value) => value === true;

  return (
    <ScrollArea className="h-full p-4" data-testid="filters-panel-scroll">
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
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <Checkbox checked={showTraffic} onCheckedChange={setShowTraffic} data-testid="traffic-checkbox" />
              <span className="text-sm text-[#E7E9EA]">Show Aircraft</span>
            </label>
            <label className="flex items-center gap-2">
              <Checkbox
                checked={showTrails}
                onCheckedChange={(checked) => {
                  const nextValue = toBoolean(checked);
                  setShowTrails(nextValue);
                  updateLayerVisibility(['aircraft-trails'], nextValue);
                }}
                data-testid="trails-checkbox"
              />
              <span className="text-sm text-[#E7E9EA]">Show Trails</span>
            </label>
          </div>
        </div>
        <Separator className="bg-[#3A3E43]" />
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Airspace</h3>
          <label className="flex items-center gap-2">
            <Checkbox
              checked={showAirspace}
              onCheckedChange={(checked) => {
                const nextValue = toBoolean(checked);
                setShowAirspace(nextValue);
                updateLayerVisibility(
                  ['airspace-fill', 'airspace-outline', 'airspace-labels'],
                  nextValue
                );
              }}
              data-testid="airspace-checkbox"
            />
            <span className="text-sm text-[#E7E9EA]">Show Boundaries</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={showATCFacilities}
              onCheckedChange={(checked) => {
                const nextValue = toBoolean(checked);
                setShowATCFacilities(nextValue);
                updateLayerVisibility(
                  [
                    'atc-coverage-fill',
                    'atc-coverage-outline',
                    'atc-facilities-glow',
                    'atc-facilities-markers',
                    'atc-facilities-labels'
                  ],
                  nextValue
                );
              }}
              data-testid="atc-facilities-checkbox"
            />
            <span className="text-sm text-[#E7E9EA]">Show ATC Facilities</span>
          </label>
        </div>
        <Separator className="bg-[#3A3E43]" />
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Layers</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Weather</Label>
              <Switch
                checked={showWeather}
                onCheckedChange={(checked) => {
                  const nextValue = toBoolean(checked);
                  setShowWeather(nextValue);
                  updateLayerVisibility(['weather-layer'], nextValue);
                }}
                data-testid="weather-switch"
              />
            </div>
          </div>
        </div>
        <Separator className="bg-[#3A3E43]" />
        <div>
          <h3 className="text-xs uppercase tracking-widest text-[#A9ADB1] mb-3">Altitude Legend</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#60A5FA'}} />
              <span className="text-xs text-[#E7E9EA]">0-5k ft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#4DD7E6'}} />
              <span className="text-xs text-[#E7E9EA]">5-10k ft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#6BEA76'}} />
              <span className="text-xs text-[#E7E9EA]">10-18k ft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#FFC857'}} />
              <span className="text-xs text-[#E7E9EA]">18-30k ft</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{backgroundColor: '#E879F9'}} />
              <span className="text-xs text-[#E7E9EA]">30k+ ft</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
};

const InfoPanel = ({
  infoView,
  onInfoViewChange,
  selectedAircraft,
  selectedATCFacility,
  notams,
  notamMeta,
  aircraft,
}) => {
  const renderFlightsView = () => {
    if (selectedATCFacility) {
      const typeLabel = selectedATCFacility.type === 'tower' ? 'Tower' :
                       selectedATCFacility.type === 'tracon' ? 'TRACON' : 'Center';
      const typeColor = selectedATCFacility.type === 'tower' ? '#4DD7E6' :
                       selectedATCFacility.type === 'tracon' ? '#FF6B6B' : '#6BEA76';

      return (
        <ScrollArea className="h-full p-4" data-testid="atc-facility-info">
          <Card className="bg-[#0E0F11] border-[#3A3E43]">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="font-['Azeret_Mono',monospace] text-lg" style={{color: typeColor}} data-testid="facility-id">
                  {selectedATCFacility.id}
                </div>
                <div className="text-xs px-2 py-1 rounded" style={{backgroundColor: typeColor, color: '#0A0B0C'}}>
                  {typeLabel.toUpperCase()}
                </div>
              </div>
              <div className="text-sm text-[#E7E9EA] mt-2">{selectedATCFacility.name}</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">FREQUENCY</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="facility-frequency">
                    {selectedATCFacility.frequency}
                  </div>
                </div>
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">COVERAGE</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="facility-coverage">
                    {selectedATCFacility.coverage_nm} NM
                  </div>
                </div>
              </div>
              <Separator className="bg-[#3A3E43]" />
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">ELEVATION</div>
                <div className="text-sm text-[#E7E9EA]" data-testid="facility-elevation">
                  {selectedATCFacility.elevation_ft} ft MSL
                </div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">TYPE</div>
                <div className="text-sm text-[#E7E9EA]" data-testid="facility-type">
                  {typeLabel} ({selectedATCFacility.type.toUpperCase()})
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Live ATC Audio Feeds */}
          {LIVE_ATC_FEEDS[selectedATCFacility.id] && (
            <Card className="mt-4 bg-[#0E0F11] border-[#3A3E43]">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium text-[#6BEA76]">Live ATC Audio Feeds</div>
                  <div className="text-xs text-[#A9ADB1]">{LIVE_ATC_FEEDS[selectedATCFacility.id].length} channels</div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {LIVE_ATC_FEEDS[selectedATCFacility.id].map((feed, idx) => (
                  <div key={idx} className="space-y-2 p-3 bg-[#0A0B0C] rounded-lg border border-[#3A3E43]">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-[#E7E9EA]">{feed.name}</div>
                          {feed.listeners && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-[#4DD7E6]/10 text-[#4DD7E6]">
                              {feed.listeners} live
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#A9ADB1] mt-1">
                          <span className="font-['Azeret_Mono',monospace]">{feed.frequency}</span>
                          {' • '}
                          <span>{feed.type}</span>
                        </div>
                      </div>
                    </div>
                    <audio
                      id={`${selectedATCFacility.id.toLowerCase()}_${feed.streamId}`}
                      controls
                      autoPlay={false}
                      className="w-full h-8"
                      preload="none"
                      style={{
                        backgroundColor: '#0A0B0C',
                        borderRadius: '4px',
                        height: '32px'
                      }}
                      data-testid={`audio-${feed.streamId}`}
                    >
                      <source src={getLiveATCUrl(feed.streamId)} type="audio/mpeg" />
                      Your browser does not support the audio element.
                    </audio>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          
          <div className="mt-4 p-3 bg-[#0E0F11] border border-[#3A3E43] rounded-lg">
            <p className="text-xs text-[#A9ADB1] italic">
              {selectedATCFacility.type === 'tower' && 'Controls aircraft on the ground and in the immediate vicinity of the airport.'}
              {selectedATCFacility.type === 'tracon' && 'Provides radar services to aircraft arriving and departing within terminal airspace.'}
              {selectedATCFacility.type === 'center' && 'Provides en-route air traffic control services for aircraft at higher altitudes.'}
            </p>
          </div>
        </ScrollArea>
      );
    }

    if (!selectedAircraft) {
      return (
        <div className="h-full flex items-center justify-center text-[#A9ADB1] px-4" data-testid="info-empty">
          <p className="text-center text-sm">Click an aircraft or ATC facility to view details</p>
        </div>
      );
    }

    const callsign = (selectedAircraft.callsign || selectedAircraft.icao24).trim();
    const alt = selectedAircraft.baro_altitude ? Math.round(selectedAircraft.baro_altitude * 3.28084) : '---';
    const spd = selectedAircraft.velocity ? Math.round(selectedAircraft.velocity * 1.94384) : '---';
    const hdg = selectedAircraft.true_track ? Math.round(selectedAircraft.true_track) : '---';
    const vspd = selectedAircraft.vertical_rate ? Math.round(selectedAircraft.vertical_rate * 196.85) : '---';

    return (
      <ScrollArea className="h-full p-4" data-testid="aircraft-info">
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
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-altitude">{alt} ft</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">SPEED</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-speed">{spd} kts</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">HEADING</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-heading">{hdg}°</div>
              </div>
              <div>
                <div className="text-[#A9ADB1] text-xs mb-1">V/S</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]" data-testid="info-vspd">{vspd} fpm</div>
              </div>
            </div>
            <Separator className="bg-[#3A3E43]" />
            <div className="grid grid-cols-2 gap-3 text-sm">
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
            </div>
          </CardContent>
        </Card>

        <div className="mt-4 p-3 bg-[#0E0F11] border border-[#3A3E43] rounded-lg">
          <p className="text-xs text-[#A9ADB1] italic">Shift handoff functionality available in Chat tab</p>
        </div>
      </ScrollArea>
    );
  };

  const renderChatView = () => (
    <SimpleChatView
      infoView={infoView}
      selectedAircraft={selectedAircraft}
      selectedATCFacility={selectedATCFacility}
      aircraftCount={aircraft?.length || 0}
    />
  );

  const renderNotamsView = () => (
    <ScrollArea className="h-full p-4" data-testid="notam-feed">
      <Card className="bg-[#0E0F11] border-[#3A3E43]">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.25em] text-[#A9ADB1] mb-1">NOTAM Feed</div>
              <div className="font-['Azeret_Mono',monospace] text-[#4DD7E6] text-lg">Bay Area Cluster</div>
            </div>
            <div className="text-xs text-right text-[#A9ADB1] font-['Azeret_Mono',monospace]">
              #{String(notamMeta.sequence || 0).padStart(4, '0')}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[#A9ADB1]">
            <span>Last update {formatTimestamp(notamMeta.lastUpdated)}</span>
            <span>Cadence ~{notamMeta.cadenceSeconds ? notamMeta.cadenceSeconds.toFixed(1) : '5.0'}s</span>
            <span>Catalog {notamMeta.totalCatalog || notams.length}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {notams.length === 0 ? (
            <div className="text-sm text-[#A9ADB1] italic">Waiting for NOTAM activity...</div>
          ) : (
            notams.map((item) => (
              <div
                key={`${item.id}-${item.emission}`}
                className="border-l-2 border-[#4DD7E6]/40 pl-3"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-['Azeret_Mono',monospace] text-sm text-[#E7E9EA]">
                    {item.location} · {item.number}
                  </span>
                  <span className="text-xs text-[#A9ADB1] uppercase tracking-wide">{item.classification}</span>
                </div>
                <div className="mt-1 text-xs text-[#A9ADB1] uppercase tracking-wide">
                  {item.category}
                </div>
                <div className="mt-2 text-sm text-[#E7E9EA] leading-5">{item.condition}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[#A9ADB1] font-['Azeret_Mono',monospace]">
                  <div>Start {item.start || '—'}</div>
                  <div>End {item.end || '—'}</div>
                  <div className={item.is_new ? 'text-[#6BEA76]' : ''}>
                    Emission #{String(item.emission || 0).padStart(4, '0')}
                  </div>
                  <div>{formatTimestamp(item.received_at)}</div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </ScrollArea>
  );

  const tabs = [
    { id: 'flights', label: 'Flights' },
    { id: 'chat', label: 'Chat' },
    { id: 'notams', label: 'NOTAMs' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-[#3A3E43] px-4 py-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onInfoViewChange(tab.id)}
            className={`rounded-md px-3 py-1 text-xs font-semibold tracking-wide transition-colors ${
              infoView === tab.id
                ? 'bg-[#1A1C1F] text-[#E7E9EA] border border-[#4DD7E6]/60'
                : 'text-[#A9ADB1] hover:text-[#E7E9EA]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        {infoView === 'flights' && renderFlightsView()}
        {infoView === 'chat' && renderChatView()}
        {infoView === 'notams' && renderNotamsView()}
      </div>
    </div>
  );
};

export default function App() {
  const [aircraft, setAircraft] = useState([]);
  const [selectedAircraft, setSelectedAircraft] = useState(null);
  const [selectedATCFacility, setSelectedATCFacility] = useState(null);
  const [dataStatus, setDataStatus] = useState('ok');
  const [lastUpdate, setLastUpdate] = useState(null);
  // Use refs for clocks to avoid re-renders every second
  const localTimeRef = useRef(null);
  const utcTimeRef = useRef(null);
  
  const [infoView, setInfoView] = useState('flights');
  const [notams, setNotams] = useState([]);
  const [notamMeta, setNotamMeta] = useState({
    sequence: 0,
    lastUpdated: null,
    cadenceSeconds: 0,
    totalCatalog: 0,
    windowSize: 0,
  });

  // Filter states
  const [showRunways, setShowRunways] = useState(false);
  const [showTraffic, setShowTraffic] = useState(true);
  const [showWeather, setShowWeather] = useState(false);
  const [showATCFacilities, setShowATCFacilities] = useState(true);
  const [weatherData, setWeatherData] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  // Phase 1 feature states
  const [showTrails, setShowTrails] = useState(false);
  const [showAirspace, setShowAirspace] = useState(true);
  const [airspaceLoaded, setAirspaceLoaded] = useState(false);
  const [atcFacilitiesLoaded, setAtcFacilitiesLoaded] = useState(false);

  // 3D modal state
  const [show3DModal, setShow3DModal] = useState(false);
  const [aircraft3D, setAircraft3D] = useState(null);

  const mapContainer = useRef(null);
  const map = useRef(null);

  const handleResizePointerDown = useCallback(() => {
    if (!map.current || !map.current.dragPan) {
      return;
    }

    try {
      map.current.dragPan.disable();
    } catch (error) {
      console.error('Failed to disable map drag during resize:', error);
    }

    const restoreDrag = () => {
      if (!map.current || !map.current.dragPan) {
        return;
      }

      try {
        map.current.dragPan.enable();
      } catch (error) {
        console.error('Failed to re-enable map drag after resize:', error);
      }
    };

    window.addEventListener('pointerup', restoreDrag, { once: true });
    window.addEventListener('pointercancel', restoreDrag, { once: true });
  }, []);
  // Clock updates - directly update DOM to avoid re-renders
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      const localStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      const utcStr = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' });
      
      // Update DOM directly via refs - no re-render
      if (localTimeRef.current) localTimeRef.current.textContent = `LCL ${localStr}`;
      if (utcTimeRef.current) utcTimeRef.current.textContent = `UTC ${utcStr}`;
    };
    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Phase 1: Helper functions
  const getAltitudeColor = (altitudeMeters) => {
    if (!altitudeMeters) return '#6B7280'; // Gray for unknown

    const altFeet = altitudeMeters * 3.28084;

    if (altFeet < 5000) return '#60A5FA';      // Light blue - low
    if (altFeet < 10000) return '#4DD7E6';     // Cyan - medium-low
    if (altFeet < 18000) return '#6BEA76';     // Green - medium
    if (altFeet < 30000) return '#FFC857';     // Yellow - medium-high
    return '#E879F9';                          // Purple - high (FL300+)
  };

  const isEmergencySquawk = (squawk) => {
    if (!squawk) return null;
    const code = squawk.toString();
    if (code === '7700') return 'emergency';
    if (code === '7600') return 'radio-failure';
    if (code === '7500') return 'hijack';
    return null;
  };

  // Helper function to add aircraft layers after sprite loads
  const addAircraftLayers = useCallback(() => {
    if (!map.current) return;
    
    // Check if source and layers already exist (Strict Mode protection)
    if (map.current.getSource('aircraft')) {
      console.log('Aircraft layers already added, skipping');
      return;
    }

    try {
      // Add aircraft trails source and layer (FIRST - below everything)
      map.current.addSource('aircraft-trails', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      map.current.addLayer({
        id: 'aircraft-trails',
        type: 'line',
        source: 'aircraft-trails',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
          'visibility': showTrails ? 'visible' : 'none'
        },
        paint: {
          'line-color': [
            'interpolate',
            ['linear'],
            ['get', 'avg_altitude_m'],
            0, '#60A5FA',        // Low altitude - light blue
            5000, '#4DD7E6',     // Mid-low - cyan
            10000, '#6BEA76',    // Mid - green
            15000, '#FFC857'     // High - yellow
          ],
          'line-width': 1,        // Thinner line
          'line-opacity': 0.3,    // More transparent
          'line-dasharray': [2, 3] // Dotted line (2px dash, 3px gap)
        }
      });

      // Add GeoJSON source for aircraft
      map.current.addSource('aircraft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Add emergency pulse layer (animated circles)
      map.current.addLayer({
        id: 'aircraft-emergency-pulse',
        type: 'circle',
        source: 'aircraft',
        filter: ['!=', ['get', 'emergency'], 'none'],
        paint: {
          'circle-radius': [
            'interpolate', ['linear'], ['zoom'],
            7, 12,
            14, 40
          ],
          'circle-color': [
            'match',
            ['get', 'emergency'],
            'emergency', '#FF6B6B',
            'hijack', '#DC2626',
            'radio-failure', '#FFA500',
            '#FF6B6B'
          ],
          'circle-opacity': 0.2,
          'circle-stroke-width': 2,
          'circle-stroke-color': [
            'match',
            ['get', 'emergency'],
            'emergency', '#FF6B6B',
            'hijack', '#DC2626',
            'radio-failure', '#FFA500',
            '#FF6B6B'
          ],
          'circle-stroke-opacity': 0.7
        }
      });

      // Add symbol layer for icons with emergency highlighting
      map.current.addLayer({
        id: 'aircraft-icons',
        type: 'symbol',
        source: 'aircraft',
        layout: {
          'icon-image': 'aircraft',
          'icon-size': [
            'case',
            ['!=', ['get', 'emergency'], 'none'], 1.1,  // Larger for emergencies
            0.8
          ],
          'icon-rotate': ['-', ['get', 'heading'], 90],  // Subtract 90deg to compensate for SVG orientation
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 1,
          'icon-color': ['get', 'altitudeColor']  // Use altitude-based color
        }
      });

      // Add symbol layer for labels
      map.current.addLayer({
        id: 'aircraft-labels',
        type: 'symbol',
        source: 'aircraft',
        layout: {
          'text-field': ['get', 'label'],
          'text-font': ['Open Sans Regular'],
          'text-size': [
            'case',
            ['!=', ['get', 'emergency'], 'none'], 12,  // Larger text for emergencies
            11
          ],
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': [
            'case',
            ['!=', ['get', 'emergency'], 'none'], '#FF6B6B',  // Red text for emergencies
            '#E7E9EA'
          ],
          'text-halo-color': '#0A0B0C',
          'text-halo-width': 2,
          'text-halo-blur': 1
        }
      });

      console.log('🎨 Aircraft layers, trails, and emergency indicators added');
    } catch (error) {
      console.error('Failed to add aircraft layers:', error);
    }
  }, [showTrails]);

  // Initialize MapLibre with inline style to avoid external style fetch
  useEffect(() => {
    if (map.current) {
      console.log('Map already initialized, skipping');
      return;
    }
    
    if (!mapContainer.current) {
      console.error('Map container ref not ready');
      return;
    }

    console.log('Starting map initialization...');

    try {
      if (!maplibregl || !maplibregl.Map) {
        throw new Error('MapLibre GL not loaded properly');
      }

      // Inline style object keeps MapLibre from requesting a separate style JSON
      const styleObject = {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [`https://api.maptiler.com/maps/darkmatter/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`],
            tileSize: 256,
            attribution: '&copy; <a href="https://www.maptiler.com/">MapTiler</a>'
          }
        },
        layers: [{
          id: 'simple-tiles',
          type: 'raster',
          source: 'raster-tiles',
          minzoom: 0,
          maxzoom: 22
        }]
      };

      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: styleObject,
        center: BAY_AREA_CENTER,
        zoom: 8,
        pitch: 0,
        bearing: 0,
        attributionControl: false
      });

      // Allow double-clicks to be used for opening the 3D modal instead of zooming
      if (map.current.doubleClickZoom) {
        map.current.doubleClickZoom.disable();
      }

      console.log('✅ MapLibre map object created');

      // Load aircraft icon and add layers only after sprite is ready
      map.current.on('load', async () => {
        console.log('🗺️ Map loaded');
        setMapReady(true);
        
        try {
          // Load aircraft icon from SVG
          const response = await fetch('/aircraft-icon.svg');
          const svg = await response.text();
          const img = new Image(32, 32);
          
          img.onload = () => {
            if (!map.current) return;
            
            // Check if image already added (Strict Mode protection)
            if (!map.current.hasImage('aircraft')) {
              map.current.addImage('aircraft', img);
              console.log('✈️ Aircraft icon loaded');
            }
            
            // Now add layers after sprite is ready
            addAircraftLayers();
          };
          
          img.onerror = (err) => {
            console.error('❌ Failed to load aircraft icon:', err);
          };
          
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        } catch (error) {
          console.error('Failed to fetch aircraft icon:', error);
        }
      });

      map.current.on('error', (e) => {
        console.error('MapLibre error:', e);
      });

    } catch (error) {
      console.error('Failed to initialize MapLibre:', error);
      toast.error('Map initialization failed: ' + error.message);
    }

    // Clear refs on cleanup to survive React 19 strict-mode re-mounts
    return () => {
      if (map.current) {
        try {
          map.current.remove();
          map.current = null;  // CRITICAL: Clear ref for React 19
        } catch (e) {
          console.error('Error removing map:', e);
        }
      }
      setMapReady(false);
      setAirspaceLoaded(false);  // Reset so layers reload on remount
      setAtcFacilitiesLoaded(false);  // Reset so layers reload on remount
    };
  }, [addAircraftLayers]);

  const applyRainViewerTiles = useCallback((tileUrl) => {
    if (!map.current || !tileUrl) return;

    try {
      if (map.current.getLayer('weather-layer')) {
        map.current.removeLayer('weather-layer');
      }
      if (map.current.getSource('weather-tiles')) {
        map.current.removeSource('weather-tiles');
      }

      map.current.addSource('weather-tiles', {
        type: 'raster',
        tiles: [tileUrl],
        tileSize: 256,
        attribution: 'RainViewer'
      });

      map.current.addLayer({
        id: 'weather-layer',
        type: 'raster',
        source: 'weather-tiles',
        paint: {
          'raster-opacity': 0.6
        },
        layout: {
          'visibility': showWeather ? 'visible' : 'none'
        }
      }, 'aircraft-icons');

      console.log('🌧️ RainViewer tiles applied');
    } catch (error) {
      console.error('Failed to apply RainViewer tiles:', error);
    }
  }, [showWeather]);

  const fetchRainViewerTiles = useCallback(async () => {
    if (!map.current) return;

    try {
      const response = await fetch('https://api.rainviewer.com/public/weather-maps.json');
      const data = await response.json();
      const host = data.host || 'https://tilecache.rainviewer.com';
      const frames = data?.radar?.past || [];
      const latestFrame = frames[frames.length - 1];

      if (!latestFrame) {
        console.warn('No RainViewer frames available');
        return;
      }

      const tileUrl = `${host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;
      applyRainViewerTiles(tileUrl);
    } catch (error) {
      console.error('Failed to fetch RainViewer metadata:', error);
    }
  }, [applyRainViewerTiles]);

  // Update aircraft layer with GeoJSON data (replaces previous canvas overlay)
  const updateAircraftLayer = useCallback(() => {
    if (!map.current || !map.current.getSource('aircraft') || !showTraffic) {
      return;
    }

    try {
      // Convert aircraft to GeoJSON features
      const features = aircraft
        .filter(ac => ac.longitude && ac.latitude)
        .map(ac => {
          const callsign = (ac.callsign || ac.icao24).trim();
          const alt = ac.baro_altitude ? Math.round(ac.baro_altitude * 3.28084) : '---';
          const spd = ac.velocity ? Math.round(ac.velocity * 1.94384) : '---';
          const label = `${callsign} | ${alt} | ${spd}`;

          // Phase 1: Detect emergency and get altitude color
          const emergencyType = isEmergencySquawk(ac.squawk);
          const altitudeColor = getAltitudeColor(ac.baro_altitude);

          return {
            type: 'Feature',
            id: ac.icao24,
            geometry: {
              type: 'Point',
              coordinates: [ac.longitude, ac.latitude]
            },
            properties: {
              icao24: ac.icao24,
              callsign: callsign,
              heading: ac.true_track || 0,
              label: label,
              selected: selectedAircraft && selectedAircraft.icao24 === ac.icao24,
              emergency: emergencyType || 'none',
              altitudeColor: altitudeColor
            }
          };
        });

      // Update source (MapLibre handles rendering)
      map.current.getSource('aircraft').setData({
        type: 'FeatureCollection',
        features: features
      });
    } catch (error) {
      console.error('Failed to update aircraft layer:', error);
    }
  }, [aircraft, showTraffic, selectedAircraft]);

  // Update aircraft layer whenever data changes
  useEffect(() => {
    updateAircraftLayer();
  }, [updateAircraftLayer]);

  // Control aircraft layer visibility when showTraffic changes
  useEffect(() => {
    if (!map.current) return;

    try {
      if (map.current.getLayer('aircraft-icons')) {
        map.current.setLayoutProperty(
          'aircraft-icons',
          'visibility',
          showTraffic ? 'visible' : 'none'
        );
      }
      if (map.current.getLayer('aircraft-labels')) {
        map.current.setLayoutProperty(
          'aircraft-labels',
          'visibility',
          showTraffic ? 'visible' : 'none'
        );
      }
    } catch (error) {
      console.error('Failed to toggle aircraft visibility:', error);
    }
  }, [showTraffic]);

  // Polling helper keeps dependency array empty so intervals stay stable
  const fetchAircraft = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/air/opensky`, { timeout: 8000 });
      const data = response.data;
      
      setAircraft(data.aircraft || []);
      setDataStatus(data.data_status || 'ok');
      setLastUpdate(Date.now());

      if (data.data_status === 'stale') {
        toast.warning('Aircraft data is stale', { id: 'stale-data' });
      } else if (data.data_status === 'ok') {
        toast.dismiss('stale-data');
      }

      console.log(`✈️ Received ${data.aircraft_count} aircraft [${data.data_status}]`);
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
      setDataStatus('unavailable');
      toast.error('Aircraft data unavailable', { id: 'data-error' });
    }
  }, []);  // Empty deps – function is stable so setInterval works correctly

  // Poll for aircraft updates
  useEffect(() => {
    fetchAircraft();
    const interval = setInterval(fetchAircraft, 10000);
    return () => clearInterval(interval);
  }, [fetchAircraft]);

  // Phase 1: Fetch aircraft trails
  const fetchTrails = useCallback(async () => {
    if (!showTrails || !mapReady) return;

    try {
      const response = await axios.get(`${API}/air/trails`, { timeout: 5000 });

      if (map.current && map.current.getSource('aircraft-trails')) {
        map.current.getSource('aircraft-trails').setData(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch trails:', error);
    }
  }, [showTrails, mapReady]);

  // Poll for trails
  useEffect(() => {
    if (!mapReady || !showTrails) return;

    fetchTrails();
    const interval = setInterval(fetchTrails, 10000);
    return () => clearInterval(interval);
  }, [mapReady, showTrails, fetchTrails]);

  // Generate ATC handoff with voice
  const generateHandoff = async () => {
    if (!selectedAircraft) return;
    
    setHandoffLoading(true);
    setHandoffData(null);
    
    try {
      const handoffRequest = {
        icao24: selectedAircraft.icao24,
        callsign: selectedAircraft.callsign,
        aircraft_type: "B737", // Default, can be enhanced
        latitude: selectedAircraft.latitude,
        longitude: selectedAircraft.longitude,
        altitude: selectedAircraft.baro_altitude || selectedAircraft.geo_altitude || 0,
        velocity: selectedAircraft.velocity || 0,
        heading: selectedAircraft.true_track || 0,
        destination: null // Can be enhanced with flight plan data
      };
      
      const response = await axios.post(`${API}/handoff/generate`, handoffRequest, { timeout: 15000 });
      const data = response.data;
      
      setHandoffData(data);
      
      // Auto-play audio if available
      if (data.audio_base64 && audioRef.current) {
        const audioSrc = `data:audio/mpeg;base64,${data.audio_base64}`;
        audioRef.current.src = audioSrc;
        audioRef.current.play().catch(err => {
          console.error('Audio playback failed:', err);
          toast.error('Failed to play handoff audio');
        });
      }
      
      toast.success('Handoff generated successfully');
    } catch (error) {
      console.error('Failed to generate handoff:', error);
      toast.error('Failed to generate handoff');
    } finally {
      setHandoffLoading(false);
    }
  };

  // Phase 1: Load airspace boundaries once
  useEffect(() => {
    if (!mapReady || airspaceLoaded) return;

    const loadAirspace = async () => {
      try {
        const response = await axios.get(`${API}/airspace/boundaries`);
        const airspaceData = response.data;

        if (!map.current) return;

        // Add source
        map.current.addSource('airspace', {
          type: 'geojson',
          data: airspaceData
        });

        // Add fill layer
        map.current.addLayer({
          id: 'airspace-fill',
          type: 'fill',
          source: 'airspace',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.05  // Very subtle
          },
          layout: {
            'visibility': showAirspace ? 'visible' : 'none'
          }
        });

        // Add outline layer
        map.current.addLayer({
          id: 'airspace-outline',
          type: 'line',
          source: 'airspace',
          paint: {
            'line-color': ['get', 'label_color'],
            'line-width': 1,  // Thin
            'line-opacity': 0.5,  // Subtle
            'line-dasharray': [3, 2]
          },
          layout: {
            'visibility': showAirspace ? 'visible' : 'none'
          }
        });

        // Add labels
        map.current.addLayer({
          id: 'airspace-labels',
          type: 'symbol',
          source: 'airspace',
          layout: {
            'text-field': ['concat', ['get', 'name'], '\n', ['get', 'floor_ft'], '-', ['get', 'ceiling_ft'], 'ft'],
            'text-font': ['Open Sans Regular'],
            'text-size': 10,
            'visibility': showAirspace ? 'visible' : 'none'
          },
          paint: {
            'text-color': ['get', 'label_color'],
            'text-halo-color': '#0A0B0C',
            'text-halo-width': 2,
            'text-opacity': 0.8
          }
        }, 'aircraft-trails');

        setAirspaceLoaded(true);
        console.log('🗺️ Airspace boundaries loaded');

      } catch (error) {
        console.error('Failed to load airspace:', error);
      }
    };

    loadAirspace();
  }, [mapReady, airspaceLoaded, showAirspace]);

  // Load ATC facilities (towers, TRACON, center) with coverage circles
  useEffect(() => {
    if (!mapReady || atcFacilitiesLoaded) return;

    const loadATCFacilities = async () => {
      try {
        // Load coverage circles
        const coverageResponse = await axios.get(`${API}/atc/facilities/coverage`);
        const coverageData = coverageResponse.data;

        // Load facility points
        const pointsResponse = await axios.get(`${API}/atc/facilities/points`);
        const pointsData = pointsResponse.data;

        if (!map.current) return;

        // Add coverage circles source
        map.current.addSource('atc-coverage', {
          type: 'geojson',
          data: coverageData
        });

        // Add facility points source
        map.current.addSource('atc-facilities', {
          type: 'geojson',
          data: pointsData
        });

        // Add coverage circle outline layer only (no fill - too cluttered)
        map.current.addLayer({
          id: 'atc-coverage-outline',
          type: 'line',
          source: 'atc-coverage',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': [
              'case',
              ['==', ['get', 'type'], 'tower'], 1,  // Thin for towers
              0.5  // Very thin for TRACON/Center (barely visible)
            ],
            'line-opacity': [
              'case',
              ['==', ['get', 'type'], 'tower'], 0.4,  // Visible for towers
              0.1  // Nearly invisible for TRACON/Center
            ],
            'line-dasharray': [3, 3]
          },
          layout: {
            'visibility': showATCFacilities ? 'visible' : 'none'
          }
        });

        // Add facility markers layer - minimal and clean
        map.current.addLayer({
          id: 'atc-facilities-markers',
          type: 'circle',
          source: 'atc-facilities',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'type'], 'tower'], 6,  // Small towers
              ['==', ['get', 'type'], 'tracon'], 8,  // Medium TRACON
              10  // Medium center
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.8,
            'circle-stroke-width': 2,
            'circle-stroke-color': '#0A0B0C',
            'circle-stroke-opacity': 0.8
          },
          layout: {
            'visibility': showATCFacilities ? 'visible' : 'none'
          }
        });
        
        // Add subtle glow layer
        map.current.addLayer({
          id: 'atc-facilities-glow',
          type: 'circle',
          source: 'atc-facilities',
          paint: {
            'circle-radius': [
              'case',
              ['==', ['get', 'type'], 'tower'], 10,  // Small glow
              ['==', ['get', 'type'], 'tracon'], 12,
              14  // Small center glow
            ],
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.12,  // Subtle glow
            'circle-blur': 1
          },
          layout: {
            'visibility': showATCFacilities ? 'visible' : 'none'
          }
        }, 'atc-facilities-markers');

        // Add facility labels - minimal
        map.current.addLayer({
          id: 'atc-facilities-labels',
          type: 'symbol',
          source: 'atc-facilities',
          layout: {
            'text-field': ['get', 'id'],  // Just ID, no coverage
            'text-font': ['Open Sans Regular'],
            'text-size': 9,  // Small text
            'text-offset': [0, -1.2],
            'text-anchor': 'bottom',
            'visibility': showATCFacilities ? 'visible' : 'none'
          },
          paint: {
            'text-color': ['get', 'color'],
            'text-halo-color': '#0A0B0C',
            'text-halo-width': 1.5,
            'text-opacity': 0.8  // Slightly transparent
          }
        });

        setAtcFacilitiesLoaded(true);
        console.log('🗼 ATC facilities loaded');

      } catch (error) {
        console.error('Failed to load ATC facilities:', error);
      }
    };

    loadATCFacilities();
  }, [mapReady, atcFacilitiesLoaded, showATCFacilities]);

  // Phase 1: Emergency detection and alerts
  const emergencyAircraftRef = useRef(new Set());

  useEffect(() => {
    aircraft.forEach(ac => {
      const emergencyType = isEmergencySquawk(ac.squawk);
      if (emergencyType && !emergencyAircraftRef.current.has(ac.icao24)) {
        emergencyAircraftRef.current.add(ac.icao24);

        const callsign = ac.callsign || ac.icao24;
        const emergencyMessages = {
          'emergency': `🚨 EMERGENCY: ${callsign} squawking 7700`,
          'hijack': `🚨 HIJACK ALERT: ${callsign} squawking 7500`,
          'radio-failure': `📻 RADIO FAILURE: ${callsign} squawking 7600`
        };

        toast.error(emergencyMessages[emergencyType], {
          duration: 15000,
          id: `emergency-${ac.icao24}`
        });

        console.warn(`🚨 ${emergencyMessages[emergencyType]}`);
      }
    });

    // Cleanup - remove aircraft no longer in emergency
    const currentEmergencies = new Set(
      aircraft
        .filter(ac => isEmergencySquawk(ac.squawk))
        .map(ac => ac.icao24)
    );

    emergencyAircraftRef.current = currentEmergencies;
  }, [aircraft]);

  useEffect(() => {
    if (!mapReady) return;

    fetchRainViewerTiles();
    const interval = setInterval(fetchRainViewerTiles, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mapReady, fetchRainViewerTiles]);

  // Fetch weather data every 10 minutes
  const fetchWeather = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/weather/current`, { timeout: 8000 });
      setWeatherData(response.data);
      console.log('🌤️ Weather data updated');
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      setWeatherData(null);
    }
  }, []);

  const fetchNotams = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/notams`, { timeout: 5000 });
      const data = response.data || {};

      setNotams(Array.isArray(data.notams) ? data.notams : []);
      setNotamMeta({
        sequence: data.sequence || 0,
        lastUpdated: data.last_updated || null,
        cadenceSeconds: data.cadence_seconds || 0,
        totalCatalog: data.total_catalog || 0,
        windowSize: data.window_size || 0,
      });
    } catch (error) {
      console.error('Failed to fetch NOTAMs:', error);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // 10 minutes
    return () => clearInterval(interval);
  }, [fetchWeather]);

  useEffect(() => {
    fetchNotams();
  }, [fetchNotams]);

  useEffect(() => {
    if (infoView !== 'notams') {
      return undefined;
    }

    fetchNotams();
  }, [infoView, fetchNotams]);

  useEffect(() => {
    if (infoView !== 'notams') {
      return undefined;
    }

    const intervalMs = Math.max(
      (notamMeta.cadenceSeconds ? notamMeta.cadenceSeconds * 1000 : 5000),
      3500
    );

    const interval = setInterval(fetchNotams, intervalMs);
    return () => clearInterval(interval);
  }, [fetchNotams, notamMeta.cadenceSeconds, infoView]);

  // Handle aircraft selection via MapLibre features
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e) => {
      // Check for ATC facility clicks first
      const facilityFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: ['atc-facilities-markers']
      });

      if (facilityFeatures.length > 0) {
        const facility = facilityFeatures[0].properties;
        setSelectedATCFacility(facility);
        setSelectedAircraft(null);
        setInfoView('flights'); // Switch to flights tab to show facility details
        return;
      }

      // Check for aircraft clicks
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['aircraft-icons']
      });

      if (features.length > 0) {
        const icao24 = features[0].properties.icao24;
        const ac = aircraft.find(a => a.icao24 === icao24);
        if (ac) {
          setSelectedAircraft(ac);
          setSelectedATCFacility(null);
        }
      } else {
        setSelectedAircraft(null);
        setSelectedATCFacility(null);
      }
    };

    const handleDoubleClick = (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['aircraft-icons']
      });

      if (features.length > 0) {
        const icao24 = features[0].properties.icao24;
        const ac = aircraft.find(a => a.icao24 === icao24);
        if (ac) {
          setAircraft3D(ac);
          setShow3DModal(true);
        }
      }
    };

    map.current.on('click', handleClick);
    map.current.on('dblclick', handleDoubleClick);

    // Guard cleanup in case map ref is already cleared
    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
        map.current.off('dblclick', handleDoubleClick);
      }
    };
  }, [aircraft]);

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
      case 'ok': return 'LIVE';
      case 'stale': return 'STALE';
      case 'unavailable': return 'OFFLINE';
      default: return 'INIT';
    }
  };

  return (
    <div className="bg-[#0A0B0C] text-[#E7E9EA] min-h-screen">
      <Toaster theme="dark" richColors position="top-right" />

      {/* 3D Aircraft Modal */}
      <Aircraft3DModal
        aircraft={aircraft3D}
        open={show3DModal}
        onClose={() => setShow3DModal(false)}
      />
      
      {/* AIR Bar */}
      <header className="h-12 border-b border-[#3A3E43] flex items-center justify-between px-4" data-testid="air-bar">
        <div className="flex items-center gap-3">
          <img src="/odin-logo-white-text.png" alt="ODIN" className="h-8" data-testid="odin-logo" />
          <Separator orientation="vertical" className="h-4 bg-[#3A3E43]" />
          <span className="text-sm text-[#A9ADB1]" data-testid="region-label">Bay Area</span>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <span ref={localTimeRef} className="font-['Azeret_Mono',monospace] text-sm" data-testid="clock-local">LCL --:--:--</span>
          <span ref={utcTimeRef} className="font-['Azeret_Mono',monospace] text-sm" data-testid="clock-utc">UTC --:--:--</span>
          <span 
            className="text-xs px-2 py-1 rounded border border-[#3A3E43]" 
            style={{ color: getStatusColor() }}
            data-testid="sim-status"
          >
            {getStatusText()}
          </span>
        </div>
        <div className="hidden md:flex items-center gap-3 text-xs text-[#A9ADB1]">
          <span data-testid="weather-summary">
            {weatherData && weatherData.airports?.KSFO 
              ? `KSFO: ${Math.round(weatherData.airports.KSFO.temp_c)}°C ${weatherData.airports.KSFO.condition}`
              : 'KSFO: —'}
          </span>
        </div>
      </header>

      <div className="relative h-[calc(100vh-48px)]" data-testid="map-canvas-area">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
        {aircraft.length === 0 && showTraffic && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="text-[#A9ADB1] text-sm opacity-60">Loading aircraft data...</p>
          </div>
        )}

        <div className="absolute inset-y-4 inset-x-4 z-20 pointer-events-none">
          <ResizablePanelGroup
            direction="horizontal"
            className="h-full w-full flex items-stretch pointer-events-none"
          >
            <ResizablePanel defaultSize={22} minSize={14} maxSize={40} className="pointer-events-none">
              <div
                className="h-full overflow-hidden rounded-lg border border-[#3A3E43] bg-[#0E0F11] shadow-xl pointer-events-auto"
                data-testid="filters-panel"
              >
                <FiltersPanel
                  mapRef={map}
                  showRunways={showRunways}
                  setShowRunways={setShowRunways}
                  showTraffic={showTraffic}
                  setShowTraffic={setShowTraffic}
                  showTrails={showTrails}
                  setShowTrails={setShowTrails}
                  showAirspace={showAirspace}
                  setShowAirspace={setShowAirspace}
                  showATCFacilities={showATCFacilities}
                  setShowATCFacilities={setShowATCFacilities}
                  showWeather={showWeather}
                  setShowWeather={setShowWeather}
                />
              </div>
            </ResizablePanel>

            <ResizableHandle
              onPointerDown={handleResizePointerDown}
              className="pointer-events-auto w-1 opacity-0"
            />

            <ResizablePanel defaultSize={52} minSize={20} className="pointer-events-none">
              <div className="h-full pointer-events-none" aria-hidden="true" />
            </ResizablePanel>

            <ResizableHandle
              onPointerDown={handleResizePointerDown}
              className="pointer-events-auto w-1 opacity-0"
            />

            <ResizablePanel defaultSize={26} minSize={16} maxSize={45} className="pointer-events-none">
              <div
                className="h-full overflow-hidden rounded-lg border border-[#3A3E43] bg-[#0E0F11] shadow-xl pointer-events-auto"
                data-testid="info-panel"
              >
                <InfoPanel
                  infoView={infoView}
                  onInfoViewChange={setInfoView}
                  selectedAircraft={selectedAircraft}
                  selectedATCFacility={selectedATCFacility}
                  notams={notams}
                  notamMeta={notamMeta}
                  generateHandoff={generateHandoff}
                  handoffLoading={handoffLoading}
                  handoffData={handoffData}
                  audioRef={audioRef}
                />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
      
      {/* Hidden audio element for handoff playback */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}
