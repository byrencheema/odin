import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import Aircraft3DViewer from './Aircraft3DViewer';

export default function Aircraft3DModal({ aircraft, open, onClose }) {
  if (!aircraft) return null;

  const callsign = (aircraft.callsign || aircraft.icao24).trim();
  const alt = aircraft.baro_altitude ? Math.round(aircraft.baro_altitude * 3.28084) : '---';
  const spd = aircraft.velocity ? Math.round(aircraft.velocity * 1.94384) : '---';
  const hdg = aircraft.true_track ? Math.round(aircraft.true_track) : '---';
  const vspd = aircraft.vertical_rate ? Math.round(aircraft.vertical_rate * 196.85) : '---';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] bg-[#0E0F11] border-[#3A3E43] text-[#E7E9EA]">
        <DialogHeader>
          <DialogTitle className="font-['Azeret_Mono',monospace] text-xl text-[#4DD7E6]">
            {callsign} - 3D View
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-4 h-full">
          {/* 3D Viewer - Takes up 2/3 of the width */}
          <div className="col-span-2 bg-[#0A0B0C] rounded-lg overflow-hidden">
            <Aircraft3DViewer aircraft={aircraft} />
          </div>

          {/* Info Panel - Takes up 1/3 of the width */}
          <div className="space-y-4 overflow-auto">
            <div className="p-4 bg-[#0A0B0C] rounded-lg border border-[#3A3E43] text-center">
              <div className="text-xs text-[#A9ADB1] mb-1">ICAO24</div>
              <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">
                {aircraft.icao24.toUpperCase()}
              </div>
            </div>

            <div className="p-4 bg-[#0A0B0C] rounded-lg border border-[#3A3E43]">
              <div className="grid grid-cols-2 gap-3 text-sm text-center">
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">ALTITUDE</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">{alt} ft</div>
                </div>
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">SPEED</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">{spd} kts</div>
                </div>
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">HEADING</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">{hdg}°</div>
                </div>
                <div>
                  <div className="text-[#A9ADB1] text-xs mb-1">V/S</div>
                  <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">{vspd} fpm</div>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#0A0B0C] rounded-lg border border-[#3A3E43]">
              <div className="text-[#A9ADB1] text-xs mb-1">ORIGIN</div>
              <div className="text-sm text-[#E7E9EA]">{aircraft.origin_country}</div>
            </div>

            <div className="p-4 bg-[#0A0B0C] rounded-lg border border-[#3A3E43]">
              <div className="text-[#A9ADB1] text-xs mb-1">ON GROUND</div>
              <div className="text-sm text-[#E7E9EA]">{aircraft.on_ground ? 'Yes' : 'No'}</div>
            </div>

            {aircraft.squawk && (
              <div className="p-4 bg-[#0A0B0C] rounded-lg border border-[#3A3E43]">
                <div className="text-[#A9ADB1] text-xs mb-1">SQUAWK</div>
                <div className="font-['Azeret_Mono',monospace] text-[#E7E9EA]">{aircraft.squawk}</div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
