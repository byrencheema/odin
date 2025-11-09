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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './components/ui/resizable';
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
  const [showRunways, setShowRunways] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);
  
  // Chat states
  const [chatSessionId, setChatSessionId] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [predictedFollowUp, setPredictedFollowUp] = useState(null);
  const [includeContext, setIncludeContext] = useState(true);
  
  const mapContainer = useRef(null);
  const map = useRef(null);
  const chatEndRef = useRef(null);

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

  // Helper function to add aircraft layers after sprite loads
  const addAircraftLayers = useCallback(() => {
    if (!map.current) return;
    
    // Check if source and layers already exist (Strict Mode protection)
    if (map.current.getSource('aircraft')) {
      console.log('Aircraft layers already added, skipping');
      return;
    }

    try {
      // Add GeoJSON source
      map.current.addSource('aircraft', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Add symbol layer for icons
      map.current.addLayer({
        id: 'aircraft-icons',
        type: 'symbol',
        source: 'aircraft',
        layout: {
          'icon-image': 'aircraft',
          'icon-size': 0.8,
          'icon-rotate': ['get', 'heading'],
          'icon-rotation-alignment': 'map',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true
        },
        paint: {
          'icon-opacity': 1
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
          'text-size': 11,
          'text-offset': [0, 1.8],
          'text-anchor': 'top',
          'text-allow-overlap': false
        },
        paint: {
          'text-color': '#E7E9EA',
          'text-halo-color': '#0A0B0C',
          'text-halo-width': 2,
          'text-halo-blur': 1
        }
      });

      console.log('🎨 Aircraft layers added');
    } catch (error) {
      console.error('Failed to add aircraft layers:', error);
    }
  }, []);

  // Initialize map with FIX #1: Inline style object instead of external URL
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

      // FIX #1: Use inline style object with darkmatter theme
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

      console.log('✅ MapLibre map object created');

      // FIX #6: Load aircraft icon and add layers AFTER sprite loads
      map.current.on('load', async () => {
        console.log('🗺️ Map loaded');
        
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

    // FIX #2: Clear all refs to null in cleanup for React 19 Strict Mode
    return () => {
      if (map.current) {
        try {
          map.current.remove();
          map.current = null;  // CRITICAL: Clear ref for React 19
        } catch (e) {
          console.error('Error removing map:', e);
        }
      }
    };
  }, [addAircraftLayers]);

  // FIX #6: Update aircraft layer with GeoJSON data (replaces canvas overlay)
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
              selected: selectedAircraft && selectedAircraft.icao24 === ac.icao24
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

  // FIX #5: Remove lastUpdate from dependency array to fix polling cycle
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
  }, []);  // FIX #5: Empty deps - function is stable, interval works correctly

  // Poll for aircraft updates
  useEffect(() => {
    fetchAircraft();
    const interval = setInterval(fetchAircraft, 2000);
    return () => clearInterval(interval);
  }, [fetchAircraft]);

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
    fetchNotams();
  }, [fetchNotams]);

  useEffect(() => {
    const intervalMs = Math.max(
      (notamMeta.cadenceSeconds ? notamMeta.cadenceSeconds * 1000 : 5000),
      3500
    );
    const interval = setInterval(fetchNotams, intervalMs);
    return () => clearInterval(interval);
  }, [fetchNotams, notamMeta.cadenceSeconds]);

  // FIX #3 & #6: Handle aircraft selection with MapLibre queryRenderedFeatures
  useEffect(() => {
    if (!map.current) return;

    const handleClick = (e) => {
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ['aircraft-icons']
      });

      if (features.length > 0) {
        const icao24 = features[0].properties.icao24;
        const ac = aircraft.find(a => a.icao24 === icao24);
        if (ac) {
          setSelectedAircraft(ac);
        }
      } else {
        setSelectedAircraft(null);
      }
    };

    map.current.on('click', handleClick);
    
    // FIX #3: Add null check in cleanup
    return () => {
      if (map.current) {
        map.current.off('click', handleClick);
      }
    };
  }, [aircraft]);

  const FiltersPanel = () => (
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
    const renderFlightsView = () => {
      if (!selectedAircraft) {
        return (
          <div className="h-full flex items-center justify-center text-[#A9ADB1] px-4" data-testid="info-empty">
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

    // Initialize chat session
    useEffect(() => {
      if (infoView !== 'chat' || chatSessionId) return;
      
      const initSession = async () => {
        // Check localStorage for existing session
        const savedSessionId = localStorage.getItem('odin_chat_session_id');
        if (savedSessionId) {
          // Try to fetch existing session
          try {
            const response = await axios.get(`${API}/chat/session/${savedSessionId}`);
            setChatSessionId(savedSessionId);
            setChatMessages(response.data.messages || []);
            return;
          } catch (error) {
            console.log('Saved session not found, creating new session');
          }
        }
        
        // Create new session
        try {
          const response = await axios.post(`${API}/chat/session`, {
            title: 'ODIN Console Chat'
          });
          const sessionId = response.data.session_id;
          setChatSessionId(sessionId);
          localStorage.setItem('odin_chat_session_id', sessionId);
          
          // Add welcome message
          setChatMessages([{
            role: 'assistant',
            content: 'Hello! I\'m ODIN Copilot. I can help you understand aircraft movements, NOTAMs, and console status. What would you like to know?',
            timestamp: new Date().toISOString()
          }]);
        } catch (error) {
          console.error('Failed to create chat session:', error);
          toast.error('Failed to initialize chat');
        }
      };
      
      initSession();
    }, [infoView, chatSessionId]);
  
  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);
  
  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || isSending || !chatSessionId) return;
    
    const userMessage = chatInput.trim();
    setChatInput('');
    setIsSending(true);
    
    // Add optimistic user message
    const optimisticMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    };
    setChatMessages(prev => [...prev, optimisticMsg]);
    
    // Prepare context
    const consoleContext = includeContext ? {
      selected_aircraft_icao: selectedAircraft?.icao24,
      include_notams: true
    } : null;
    
    try {
      // Non-streaming for now (streaming can be added later)
      const response = await axios.post(`${API}/chat/message`, {
        session_id: chatSessionId,
        user_message: userMessage,
        console_context: consoleContext,
        stream: false
      });
      
      // Add assistant message
      setChatMessages(prev => [...prev, response.data.message]);
      
      // Update predicted follow-up
      if (response.data.predicted_follow_up) {
        setPredictedFollowUp(response.data.predicted_follow_up);
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      
      // Add error message
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'I\'m temporarily unable to process your request. Please try again in a moment.',
        timestamp: new Date().toISOString(),
        metadata: { error: true }
      }]);
    } finally {
      setIsSending(false);
    }
  };
  
  const handleChatKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChatMessage();
    }
  };
  
  const formatChatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const renderChatView = () => (
    <div className="h-full flex flex-col">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4" data-testid="chat-messages">
        <div className="space-y-4">
          {chatMessages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.role === 'user'
                    ? 'bg-[#1A1C1F] border border-[#4DD7E6]/40 text-[#E7E9EA]'
                    : 'bg-[#0E0F11] border border-[#3A3E43] text-[#E7E9EA]'
                }`}
              >
                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                <div className="text-xs text-[#A9ADB1] mt-1 font-['Azeret_Mono',monospace]">
                  {formatChatTimestamp(msg.timestamp)}
                </div>
              </div>
            </div>
          ))}
          
          {/* Streaming indicator */}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-[#0E0F11] border border-[#3A3E43] rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 text-[#A9ADB1]">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-2 h-2 bg-[#4DD7E6] rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                  </div>
                  <span className="text-xs">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>
      </ScrollArea>
      
      {/* Quick Actions */}
      {predictedFollowUp && (
        <div className="px-4 py-2 border-t border-[#3A3E43]">
          <button
            onClick={() => {
              setChatInput(predictedFollowUp);
              setPredictedFollowUp(null);
            }}
            className="text-xs px-3 py-1.5 rounded-md bg-[#1A1C1F] border border-[#4DD7E6]/40 text-[#4DD7E6] hover:bg-[#1E2024] transition-colors"
          >
            💡 {predictedFollowUp}
          </button>
        </div>
      )}
      
      {/* Composer */}
      <div className="border-t border-[#3A3E43] p-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="flex items-center gap-2 text-xs text-[#A9ADB1]">
            <Checkbox
              checked={includeContext}
              onCheckedChange={setIncludeContext}
            />
            <span>Include current selection</span>
          </label>
        </div>
        <div className="flex gap-2">
          <textarea
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={handleChatKeyDown}
            placeholder="Ask about aircraft, NOTAMs, or console status..."
            disabled={isSending}
            rows={2}
            className="flex-1 bg-[#0E0F11] border border-[#3A3E43] rounded-md px-3 py-2 text-sm text-[#E7E9EA] placeholder-[#A9ADB1] focus:outline-none focus:border-[#4DD7E6] resize-none"
            data-testid="chat-input"
          />
          <button
            onClick={handleSendChatMessage}
            disabled={isSending || !chatInput.trim()}
            className="px-4 py-2 rounded-md bg-[#1A1C1F] border border-[#4DD7E6] text-[#4DD7E6] hover:bg-[#1E2024] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            data-testid="chat-send-button"
          >
            Send
          </button>
        </div>
        <div className="text-xs text-[#A9ADB1] mt-2">
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
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
              onClick={() => setInfoView(tab.id)}
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
        <div className="flex-1">
          {infoView === 'flights' && renderFlightsView()}
          {infoView === 'chat' && renderChatView()}
          {infoView === 'notams' && renderNotamsView()}
        </div>
      </div>
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
                <FiltersPanel />
              </div>
            </ResizablePanel>

            <ResizableHandle
              withHandle
              onPointerDown={handleResizePointerDown}
              className="pointer-events-auto w-1 bg-[#3A3E43] hover:bg-[#4DD7E6]/70 transition-colors"
            />

            <ResizablePanel defaultSize={52} minSize={20} className="pointer-events-none">
              <div className="h-full pointer-events-none" aria-hidden="true" />
            </ResizablePanel>

            <ResizableHandle
              withHandle
              onPointerDown={handleResizePointerDown}
              className="pointer-events-auto w-1 bg-[#3A3E43] hover:bg-[#4DD7E6]/70 transition-colors"
            />

            <ResizablePanel defaultSize={26} minSize={16} maxSize={45} className="pointer-events-none">
              <div
                className="h-full overflow-hidden rounded-lg border border-[#3A3E43] bg-[#0E0F11] shadow-xl pointer-events-auto"
                data-testid="info-panel"
              >
                <InfoPanel />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </div>
  );
}
