import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LandingPage = () => {
  const navigate = useNavigate();
  const [systemStatus, setSystemStatus] = useState('INIT');
  const [aircraftCount, setAircraftCount] = useState('--');
  const [timestamp, setTimestamp] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimestamp(now.toISOString().replace('T', ' ').substring(0, 19) + 'Z');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/status`);
        if (response.ok) {
          setSystemStatus('ONLINE');
          const aircraftResponse = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/air/opensky`);
          if (aircraftResponse.ok) {
            const data = await aircraftResponse.json();
            setAircraftCount(data.length || 0);
          }
        } else {
          setSystemStatus('OFFLINE');
        }
      } catch (error) {
        setSystemStatus('OFFLINE');
      }
    };
    checkStatus();
  }, []);

  const handleLaunch = () => {
    navigate('/console');
  };

  const getStatusColor = () => {
    switch (systemStatus) {
      case 'ONLINE': return '#6BEA76';
      case 'OFFLINE': return '#FF6B6B';
      default: return '#FFC857';
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0B0C] text-white flex items-center justify-center p-4 font-['Azeret_Mono',monospace]">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="border border-[#3A3E43] mb-[1px]">
          <div className="flex items-center justify-between px-4 py-2 border-b border-[#3A3E43]">
            <div className="flex items-center gap-3">
              <img src="/odin-logo-white-text.png" alt="ODIN" className="h-6 opacity-90" />
              <div className="w-[1px] h-4 bg-[#3A3E43]"></div>
              <span className="text-[10px] text-[#A9ADB1] tracking-widest">ATC SYSTEM</span>
            </div>
            <div className="text-[10px] text-[#A9ADB1]">{timestamp}</div>
          </div>

          <div className="px-4 py-6">
            <h1 className="text-[11px] text-[#4DD7E6] tracking-[0.2em] mb-1">SYSTEM ACCESS</h1>
            <p className="text-[10px] text-[#A9ADB1] leading-relaxed">
              Air traffic control console / Real-time surveillance
            </p>
          </div>
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-[1px] mb-[1px]">
          <div className="border border-[#3A3E43] bg-[#0E0F11] px-3 py-2">
            <div className="text-[9px] text-[#A9ADB1] mb-1 tracking-wider">STATUS</div>
            <div className="text-[11px] font-medium tracking-wide" style={{ color: getStatusColor() }}>
              {systemStatus}
            </div>
          </div>

          <div className="border border-[#3A3E43] bg-[#0E0F11] px-3 py-2">
            <div className="text-[9px] text-[#A9ADB1] mb-1 tracking-wider">AIRCRAFT</div>
            <div className="text-[11px] text-[#4DD7E6] font-medium tracking-wide">
              {aircraftCount}
            </div>
          </div>

          <div className="border border-[#3A3E43] bg-[#0E0F11] px-3 py-2">
            <div className="text-[9px] text-[#A9ADB1] mb-1 tracking-wider">REGION</div>
            <div className="text-[11px] text-white font-medium tracking-wide">
              BAY AREA
            </div>
          </div>
        </div>

        {/* Launch Button */}
        <button
          onClick={handleLaunch}
          className="w-full border border-[#4DD7E6] bg-[#4DD7E6] hover:bg-[#3BC5D3] text-black py-3 transition-colors duration-150 mb-[1px]"
        >
          <span className="text-[11px] tracking-[0.2em] font-medium">LAUNCH CONSOLE</span>
        </button>

        {/* Capabilities */}
        <div className="border border-[#3A3E43] bg-[#0E0F11]">
          <div className="px-4 py-2 border-b border-[#3A3E43]">
            <h2 className="text-[9px] text-[#4DD7E6] tracking-[0.2em]">CAPABILITIES</h2>
          </div>

          <div className="divide-y divide-[#3A3E43]">
            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">OpenSky Network ADS-B Integration</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">METAR / Weather Data Sync</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">Airspace Boundary Visualization</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">ATC Facility Mapping</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">AI Copilot (Claude 3.5 Sonnet)</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>

            <div className="px-4 py-2 flex items-center justify-between hover:bg-[#121417] transition-colors">
              <span className="text-[10px] text-[#E7E9EA]">3D Aircraft Visualization</span>
              <span className="text-[9px] text-[#6BEA76]">ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-[1px] border border-[#3A3E43] bg-[#0E0F11] px-4 py-2">
          <div className="flex items-center justify-between text-[9px] text-[#5A6067]">
            <span>ODIN v1.0</span>
            <span>SFO / OAK / SJC</span>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LandingPage;
