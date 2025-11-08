{
  "meta": {
    "product": "ODIN — A second brain for ATC",
    "app_type": "Operational ATC console (NATO-style)",
    "audience": ["Air Traffic Controllers", "Trainees", "Operations observers", "Engineering/Tech users"],
    "success_actions": [
      "Controller can scan map and read labels without visual fatigue",
      "Filters reliably reveal/hide layers and traffic without lag",
      "Selected aircraft details are one-tap/one-click away",
      "Top AIR bar remains readable at a glance (clocks, SIM status, weather, runways)",
      "60fps map panning/zooming with crisp geometry and labels"
    ],
    "design_personality": ["Signal over ornament", "Monochrome canvas, color only for state/selection", "NATO operational calm", "High-contrast, low-chrome", "Smoothness-first"]
  },

  "palette": {
    "explanation": "Matte-black canvas with white/gray geometry; cyan/green for status/selection; amber/red reserved for alerts only.",
    "tokens_hex": {
      "bg.canvas": "#0A0B0C",
      "bg.panel": "#0E0F11",
      "bg.panel-alt": "#121417",
      "fg.base": "#E7E9EA",
      "fg.muted": "#A9ADB1",
      "line.dim": "#3A3E43",
      "line.light": "#5A6067",
      "accent.cyan": "#4DD7E6",
      "accent.green": "#6BEA76",
      "state.info": "#4DD7E6",
      "state.ok": "#6BEA76",
      "state.warn": "#FFC857",
      "state.alert": "#FF6B6B",
      "focus.ring": "#4DD7E6"
    },
    "tokens_tailwind_hsl": {
      "--background": "210 10% 4%",
      "--foreground": "210 10% 92%",
      "--card": "215 10% 6%",
      "--card-foreground": "210 10% 92%",
      "--muted": "210 8% 12%",
      "--muted-foreground": "210 8% 65%",
      "--border": "210 8% 22%",
      "--input": "210 8% 22%",
      "--ring": "186 70% 62%",
      "--accent": "186 70% 62%",
      "--accent-2": "138 70% 66%",
      "--destructive": "0 86% 64%",
      "--warning": "42 100% 67%",
      "--radius": "0.5rem"
    },
    "usage": {
      "canvas": "bg-[#0A0B0C] text-[#E7E9EA]",
      "panels": "bg-[#0E0F11] border border-[#3A3E43]",
      "geometry": "stroke-[#5A6067] hover:stroke-[#E7E9EA]",
      "selection": "stroke-[#4DD7E6] fill-transparent",
      "labels": "text-[#E7E9EA] tracking-tight",
      "non_critical": "text-[#A9ADB1]",
      "alerts": "text-[#FF6B6B] border-[#FF6B6B]",
      "warnings": "text-[#FFC857]"
    },
    "gradient_policy": "Use almost entirely solid colors. If a gradient is used, keep it ultra-subtle (e.g., vertical 0A0B0C -> 0B0C0D at <=10% contrast) and never exceed 20% of viewport, never under reading areas."
  },

  "typography": {
    "brand_attributes": ["precise", "trustworthy", "technical"],
    "pairing": {
      "ui": "IBM Plex Sans",
      "data_mono": "Azeret Mono"
    },
    "imports": {
      "google_fonts": "<link href=\"https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@400;500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\">"
    },
    "tailwind_classes": {
      "h1": "text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight",
      "h2": "text-base md:text-lg font-medium tracking-tight text-[#E7E9EA]",
      "body": "text-sm md:text-base text-[#E7E9EA]",
      "mono": "font-[\'Azeret Mono\',monospace] text-[13px] md:text-[14px] tracking-[-0.01em]"
    },
    "rules": [
      "All numeric and code-like labels (ALT, SPD, HDG, CALLSIGN, UTC) use Azeret Mono",
      "Keep line-height compact on data rows (1.2 – 1.3)",
      "Use letter-spacing -0.01em for dense labels"
    ]
  },

  "spacing_and_grid": {
    "scale": [2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64],
    "panels_padding": "px-3 py-3 md:px-4 md:py-4",
    "grid_shell": {
      "mobile": "grid grid-rows-[48px_minmax(0,1fr)_auto] grid-cols-1 min-h-svh",
      "desktop": "grid grid-rows-[48px_minmax(0,1fr)] grid-cols-[18rem_minmax(0,1fr)_22rem] min-h-svh"
    },
    "areas": ["AIR bar at row 1 full width", "Filters left column", "Map center flexible", "Info right column"],
    "resizing": "Right/left panels may be resizable using ui/resizable.jsx."
  },

  "layout_skeleton": {
    "AppShell.js": "import React from 'react';\nimport { Separator } from './components/ui/separator.jsx';\nimport { Sheet, SheetContent, SheetTrigger } from './components/ui/sheet.jsx';\nimport { Button } from './components/ui/button.jsx';\nimport { PanelLeft, Info } from 'lucide-react';\n\nexport default function AppShell() {\n  return (\n    <div className=\"bg-[#0A0B0C] text-[#E7E9EA] min-h-svh\">\n      {/* AIR bar */}\n      <header className=\"h-12 border-b border-[#3A3E43] flex items-center justify-between px-3 md:px-4\" data-testid=\"air-bar\">\n        <div className=\"flex items-center gap-3\">\n          <div className=\"text-[#E7E9EA] font-semibold tracking-tight\" data-testid=\"odin-logo\">ODIN</div>\n          <Separator orientation=\"vertical\" className=\"h-4 bg-[#3A3E43]\" />\n          <span className=\"text-xs md:text-sm text-[#A9ADB1]\" data-testid=\"region-label\">Bay Area</span>\n        </div>\n        <div className=\"flex items-center gap-4\">\n          <span className=\"font-['Azeret Mono',monospace] text-xs md:text-sm\" data-testid=\"clock-local\">LCL 10:24:12</span>\n          <span className=\"font-['Azeret Mono',monospace] text-xs md:text-sm\" data-testid=\"clock-utc\">UTC 17:24:12</span>\n          <span className=\"text-[10px] md:text-xs px-2 py-1 rounded border border-[#3A3E43] text-[#4DD7E6]\" data-testid=\"sim-status\">SIM: OFF</span>\n        </div>\n        <div className=\"hidden md:flex items-center gap-3\">\n          <span className=\"text-xs text-[#A9ADB1]\" data-testid=\"weather-summary\">METAR: —</span>\n          <span className=\"text-xs text-[#A9ADB1]\" data-testid=\"active-runways\">RWY: —</span>\n        </div>\n        {/* Mobile toggles */}\n        <div className=\"md:hidden flex items-center gap-2\">\n          <Sheet>\n            <SheetTrigger asChild>\n              <Button size=\"sm\" variant=\"ghost\" data-testid=\"open-filters-button\"><PanelLeft size={16} /></Button>\n            </SheetTrigger>\n            <SheetContent side=\"left\" className=\"w-80 bg-[#0E0F11] text-[#E7E9EA]\">{/* Inject FiltersPanel here */}</SheetContent>\n          </Sheet>\n          <Sheet>\n            <SheetTrigger asChild>\n              <Button size=\"sm\" variant=\"ghost\" data-testid=\"open-info-button\"><Info size={16} /></Button>\n            </SheetTrigger>\n            <SheetContent side=\"right\" className=\"w-96 bg-[#0E0F11] text-[#E7E9EA]\">{/* Inject InfoPanel here */}</SheetContent>\n          </Sheet>\n        </div>\n      </header>\n\n      {/* Desktop grid */}\n      <div className=\"hidden md:grid grid-rows-[minmax(0,1fr)] grid-cols-[18rem_minmax(0,1fr)_22rem] min-h-[calc(100svh-48px)]\">\n        <aside className=\"border-r border-[#3A3E43] bg-[#0E0F11]\" data-testid=\"filters-panel\">{/* FiltersPanel */}</aside>\n        <main className=\"relative\" data-testid=\"map-canvas-area\">{/* MapCanvas */}</main>\n        <aside className=\"border-l border-[#3A3E43] bg-[#0E0F11]\" data-testid=\"info-panel\">{/* InfoPanel */}</aside>\n      </div>\n\n      {/* Mobile map (panels in Sheets) */}\n      <div className=\"md:hidden min-h-[calc(100svh-48px)]\" data-testid=\"map-canvas-area-mobile\">{/* MapCanvas */}</div>\n    </div>\n  );\n}\n"
  },

  "components": {
    "TopAirBar": {
      "purpose": "Status/identity strip with clocks, sim status, weather, runways.",
      "states": ["sim:on", "sim:off", "data:stale", "weather:unavailable"],
      "accessibility": "Tab order: logo -> region -> local clock -> UTC -> SIM -> weather -> runways.",
      "micro": [
        "Clock ticks update opacity via transition-opacity 100ms",
        "SIM badge color shifts using text-[cyan/green/amber/red] classes; no transform transitions"
      ]
    },
    "FiltersPanel": {
      "use": ["./components/ui/checkbox.jsx", "./components/ui/switch.jsx", "./components/ui/label.jsx", "./components/ui/separator.jsx", "./components/ui/scroll-area.jsx"],
      "sections": [
        "Airports & Runways (checkbox group)",
        "Traffic (checkbox group)",
        "Layers toggles (Switch for coastlines, SIDs/STARs, weather overlay)"
      ],
      "example": "import React from 'react';\nimport { Checkbox } from './components/ui/checkbox.jsx';\nimport { Switch } from './components/ui/switch.jsx';\nimport { Label } from './components/ui/label.jsx';\nimport { Separator } from './components/ui/separator.jsx';\nimport { ScrollArea } from './components/ui/scroll-area.jsx';\n\nexport const FiltersPanel = ({ state, onChange }) => {\n  return (\n    <ScrollArea className=\"h-[calc(100svh-48px)] p-3 md:p-4\" data-testid=\"filters-panel-scroll\">\n      <div className=\"space-y-4\">\n        <div>\n          <h3 className=\"text-xs uppercase tracking-widest text-[#A9ADB1]\">Airports / Runways</h3>\n          <div className=\"mt-2 space-y-2\">\n            {state.airports.map((apt) => (\n              <label key={apt.id} className=\"flex items-center gap-2\">\n                <Checkbox checked={apt.visible} onCheckedChange={(v)=>onChange(['airport', apt.id, v])} data-testid=\"airport-checkbox\" />\n                <span className=\"font-['Azeret Mono',monospace] text-xs\">{apt.code}</span>\n              </label>\n            ))}\n          </div>\n        </div>\n        <Separator className=\"bg-[#3A3E43]\" />\n        <div>\n          <h3 className=\"text-xs uppercase tracking-widest text-[#A9ADB1]\">Traffic</h3>\n          <div className=\"mt-2 space-y-2\">\n            {state.trafficTypes.map((t) => (\n              <label key={t.id} className=\"flex items-center gap-2\">\n                <Checkbox checked={t.visible} onCheckedChange={(v)=>onChange(['traffic', t.id, v])} data-testid=\"traffic-checkbox\" />\n                <span className=\"text-xs\">{t.label}</span>\n              </label>\n            ))}\n          </div>\n        </div>\n        <Separator className=\"bg-[#3A3E43]\" />\n        <div>\n          <h3 className=\"text-xs uppercase tracking-widest text-[#A9ADB1]\">Layers</h3>\n          <div className=\"mt-2 space-y-3\">\n            {state.layers.map((l) => (\n              <div key={l.id} className=\"flex items-center justify-between\">\n                <Label className=\"text-sm\">{l.label}</Label>\n                <Switch checked={l.visible} onCheckedChange={(v)=>onChange(['layer', l.id, v])} data-testid=\"layer-switch\" />\n              </div>\n            ))}\n          </div>\n        </div>\n      </div>\n    </ScrollArea>\n  );\n};\n"
    },
    "MapCanvas": {
      "renderer": "Canvas2D with D3-geo + requestAnimationFrame for aircraft layer",
      "notes": [
        "Black background; white/gray lines; cyan highlight when selected",
        "Oriented triangle for aircraft with CALLSIGN | ALT | SPD to the right in mono"
      ],
      "example": "import React, { useEffect, useRef } from 'react';\nimport * as d3 from 'd3';\nimport { feature } from 'topojson-client';\n\nexport const MapCanvas = ({ topojson, runways = [], aircraft = [], onSelect }) => {\n  const ref = useRef(null);\n  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;\n\n  useEffect(() => {\n    const canvas = ref.current;\n    if (!canvas) return;\n    const ctx = canvas.getContext('2d');\n\n    // Resize for DPR\n    const resize = () => {\n      const { width, height } = canvas.getBoundingClientRect();\n      canvas.width = Math.floor(width * dpr);\n      canvas.height = Math.floor(height * dpr);\n      ctx.scale(dpr, dpr);\n      drawStatic();\n    };\n    const obs = new ResizeObserver(resize);\n    obs.observe(canvas);\n\n    const coastline = topojson ? feature(topojson, topojson.objects.coastline) : null;\n    const projection = d3.geoMercator().fitSize([canvas.clientWidth, canvas.clientHeight], coastline || { type: 'Sphere' });\n    const geoPath = d3.geoPath(projection, ctx);\n\n    function drawStatic() {\n      ctx.save();\n      ctx.setTransform(1,0,0,1,0,0);\n      ctx.clearRect(0,0,canvas.width,canvas.height);\n      ctx.restore();\n      // black background\n      ctx.fillStyle = '#0A0B0C';\n      ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);\n      // coastlines\n      if (coastline) {\n        ctx.strokeStyle = '#5A6067';\n        ctx.lineWidth = 1;\n        ctx.beginPath();\n        geoPath(coastline);\n        ctx.stroke();\n      }\n      // runways\n      ctx.strokeStyle = '#E7E9EA';\n      ctx.lineWidth = 1;\n      runways.forEach(r => {\n        ctx.beginPath();\n        const [x1,y1] = projection(r.start);\n        const [x2,y2] = projection(r.end);\n        ctx.moveTo(x1,y1);\n        ctx.lineTo(x2,y2);\n        ctx.stroke();\n      });\n    }\n\n    function drawAircraft() {\n      ctx.save();\n      ctx.font = \"12px 'Azeret Mono', monospace\";\n      ctx.textBaseline = 'middle';\n      aircraft.forEach(a => {\n        const [x, y] = projection([a.lon, a.lat]);\n        const angle = (a.hdg || 0) * Math.PI / 180;\n        // triangle\n        ctx.strokeStyle = a.selected ? '#4DD7E6' : '#E7E9EA';\n        ctx.fillStyle = 'transparent';\n        ctx.beginPath();\n        const size = 8;\n        ctx.moveTo(x + Math.cos(angle)*size, y + Math.sin(angle)*size);\n        ctx.lineTo(x + Math.cos(angle+2.6)*size, y + Math.sin(angle+2.6)*size);\n        ctx.lineTo(x + Math.cos(angle-2.6)*size, y + Math.sin(angle-2.6)*size);\n        ctx.closePath();\n        ctx.stroke();\n        // label\n        const label = `${a.cs} | ${a.alt} | ${a.spd}`;\n        ctx.fillStyle = '#E7E9EA';\n        ctx.fillText(label, x + 10, y);\n      });\n      ctx.restore();\n    }\n\n    let raf;\n    const loop = () => {\n      drawStatic();\n      drawAircraft();\n      raf = requestAnimationFrame(loop);\n    };\n    loop();\n\n    return () => { cancelAnimationFrame(raf); obs.disconnect(); };\n  }, [topojson, runways, aircraft, dpr]);\n\n  return <canvas ref={ref} className=\"w-full h-full cursor-crosshair\" data-testid=\"map-canvas\" />;\n};\n"
    },
    "InfoPanel": {
      "use": ["./components/ui/card.jsx", "./components/ui/separator.jsx", "./components/ui/tabs.jsx", "./components/ui/badge.jsx", "./components/ui/scroll-area.jsx"],
      "example": "import React from 'react';\nimport { Card, CardHeader, CardContent } from './components/ui/card.jsx';\nimport { Separator } from './components/ui/separator.jsx';\nimport { ScrollArea } from './components/ui/scroll-area.jsx';\n\nexport const InfoPanel = ({ aircraft }) => {\n  if (!aircraft) {\n    return <div className=\"h-[calc(100svh-48px)] flex items-center justify-center text-[#A9ADB1]\" data-testid=\"info-empty\">Select an aircraft</div>;\n  }\n  return (\n    <ScrollArea className=\"h-[calc(100svh-48px)] p-3 md:p-4\" data-testid=\"aircraft-info\">\n      <Card className=\"bg-[#0E0F11] border-[#3A3E43]\">\n        <CardHeader>\n          <div className=\"flex items-center justify-between\">\n            <div className=\"font-['Azeret Mono',monospace]\" data-testid=\"info-callsign\">{aircraft.cs}</div>\n            <div className=\"text-xs text-[#A9ADB1]\" data-testid=\"info-type\">{aircraft.type}</div>\n          </div>\n        </CardHeader>\n        <CardContent className=\"space-y-2\">\n          <div className=\"grid grid-cols-2 gap-2 text-sm\">\n            <div className=\"text-[#A9ADB1]\">ALT</div><div className=\"font-['Azeret Mono',monospace]\" data-testid=\"info-alt\">{aircraft.alt}</div>\n            <div className=\"text-[#A9ADB1]\">SPD</div><div className=\"font-['Azeret Mono',monospace]\" data-testid=\"info-spd\">{aircraft.spd}</div>\n            <div className=\"text-[#A9ADB1]\">HDG</div><div className=\"font-['Azeret Mono',monospace]\" data-testid=\"info-hdg\">{aircraft.hdg}</div>\n          </div>\n          <Separator className=\"my-2 bg-[#3A3E43]\" />\n          <div className=\"text-xs text-[#A9ADB1]\" data-testid=\"info-route\">{aircraft.route}</div>\n        </CardContent>\n      </Card>\n    </ScrollArea>\n  );\n};\n"
    }
  },

  "shadcn_component_paths": {
    "button": "./components/ui/button.jsx",
    "checkbox": "./components/ui/checkbox.jsx",
    "switch": "./components/ui/switch.jsx",
    "label": "./components/ui/label.jsx",
    "separator": "./components/ui/separator.jsx",
    "scroll_area": "./components/ui/scroll-area.jsx",
    "sheet": "./components/ui/sheet.jsx",
    "card": "./components/ui/card.jsx",
    "tabs": "./components/ui/tabs.jsx",
    "badge": "./components/ui/badge.jsx",
    "tooltip": "./components/ui/tooltip.jsx",
    "resizable": "./components/ui/resizable.jsx",
    "sonner": "./components/ui/sonner.jsx"
  },

  "buttons": {
    "style_family": "Minimalist / Functional",
    "tokens": {
      "--btn-radius": "8px",
      "--btn-shadow": "0 0 0 0 rgba(0,0,0,0)",
      "--btn-motion": "150ms ease-out"
    },
    "variants": {
      "primary": "bg-[#111317] text-[#E7E9EA] border border-[#3A3E43] hover:bg-[#15181C] focus-visible:outline-2 focus-visible:outline-[#4DD7E6]",
      "secondary": "bg-transparent text-[#E7E9EA] border border-[#3A3E43] hover:border-[#5A6067]",
      "ghost": "bg-transparent text-[#A9ADB1] hover:text-[#E7E9EA]"
    },
    "sizes": {
      "sm": "h-8 px-3 text-xs",
      "md": "h-9 px-4 text-sm",
      "lg": "h-10 px-5 text-sm"
    },
    "motion": "Use transition-colors and transition-opacity only. Avoid transform transitions. Active state uses opacity-80 for 100ms."
  },

  "micro_interactions": {
    "hover": [
      "Buttons: transition-colors 150ms",
      "Checkbox/Switch: color change only; no scale"
    ],
    "map": [
      "Panning/zooming uses requestAnimationFrame and will-change: transform on the wrapper when applicable",
      "Selected aircraft label increases brightness (no size change)"
    ],
    "panels": [
      "On open/close (Sheet), animate opacity 0->100 and translate-x minimal (8px) using Framer Motion"
    ]
  },

  "performance": {
    "frame_budget": "< 16ms per frame",
    "techniques": [
      "DPR-aware canvas sizing",
      "Batch redraw static vs dynamic layers",
      "Use web workers for heavy parsing (e.g., flight updates)",
      "Throttle mouse events to animation frame"
    ]
  },

  "map_symbology": {
    "geometry": {
      "coastline": { "stroke": "#5A6067", "width": 1 },
      "runway": { "stroke": "#E7E9EA", "width": 1 }
    },
    "aircraft": {
      "shape": "oriented triangle",
      "size_px": 8,
      "stroke": "#E7E9EA",
      "selected_stroke": "#4DD7E6",
      "label": "CALLSIGN | ALT | SPD",
      "label_typography": "12px 'Azeret Mono', monospace",
      "label_offset_px": 10
    },
    "color_policy": "No purple. Cyan for selection/info, green for stable OK statuses, amber/red strictly for warnings/alerts."
  },

  "states_and_status": {
    "sim": { "on": "text-[#6BEA76]", "off": "text-[#4DD7E6]" },
    "data": { "stale": "text-[#FFC857]", "down": "text-[#FF6B6B]", "ok": "text-[#6BEA76]" },
    "runway": { "active": "border-[#4DD7E6] text-[#E7E9EA]", "inactive": "border-[#3A3E43] text-[#A9ADB1]" }
  },

  
  "accessibility": {
    "contrast": "WCAG AA or better; all text over #0A0B0C uses >= #A9ADB1, key info uses #E7E9EA",
    "focus": "Visible focus ring using outline-2 outline-[#4DD7E6] for keyboard users",
    "reduced_motion": "Respect prefers-reduced-motion; disable panel translate, keep opacity only",
    "screen_reader": "Label checkboxes and switches with <Label htmlFor> and aria-checked"
  },

  "testing_attributes": {
    "rule": "All interactive and key informational elements MUST include data-testid. Use kebab-case describing role, not appearance.",
    "examples": [
      "data-testid=\"open-filters-button\"",
      "data-testid=\"map-canvas\"",
      "data-testid=\"airport-checkbox\"",
      "data-testid=\"sim-status\"",
      "data-testid=\"info-alt\""
    ]
  },

  "libraries": {
    "install": [
      "npm i d3 topojson-client",
      "npm i framer-motion",
      "npm i lucide-react"
    ],
    "usage_notes": [
      "D3-geo for coastlines/mercator projection; Canvas for performance",
      "Framer Motion for panel sheet subtle entrance/exit (opacity/8px translate only)",
      "Lucide for simple line icons; avoid emoji"
    ]
  },

  "sonner_toasts": {
    "path": "./components/ui/sonner.jsx",
    "guidance": "Use for non-blocking notifications (data stale, connection restored). Place <Toaster/> near root once.",
    "example": "import { Toaster, toast } from './components/ui/sonner.jsx';\n// in root: <Toaster richColors theme=\"dark\" />\n// usage: toast.warning('Data link is degraded', { id: 'link-degraded' });\n"
  },

  "images_urls": [
    {
      "url": "https://images.unsplash.com/photo-1737502483541-92e91801cfaf?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "login/empty-state background",
      "description": "Night-time control console aesthetic"
    },
    {
      "url": "https://images.unsplash.com/photo-1610094273627-f97d5bc5084e?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "documentation/onboarding slide",
      "description": "Cockpit-style instrumentation reference"
    },
    {
      "url": "https://images.unsplash.com/photo-1597071796008-86d173f6318a?crop=entropy&cs=srgb&fm=jpg&q=85",
      "category": "about/product page visual",
      "description": "ATC tower night silhouette"
    }
  ],

  "inspirations_and_refs": {
    "sources": [
      {
        "title": "FAA — Toward an ATC Display Standard (symbology, density)",
        "url": "https://hf.tc.faa.gov/publications/2010-moving-toward-an-air-traffic-control-display-standard/full_text.pdf"
      },
      {
        "title": "EUROCONTROL — HMI Reference System for En-route ATC",
        "url": "https://www.eurocontrol.int/sites/default/files/library/032_HMI_Reference_System_for_En-route_ATC.pdf"
      },
      {
        "title": "FAA ERAM overview",
        "url": "https://www.faa.gov/air_traffic/technology/eram"
      }
    ],
    "fusion": "Layout clarity from EUROCONTROL HMI + symbology discipline from FAA docs + minimal NATO console color roles (cyan/green/amber/red)."
  },

  "instructions_to_main_agent": [
    "Inject Google Fonts link into index.html head; set body class to font-['IBM Plex Sans'] with Tailwind.",
    "Define color tokens in tailwind/theme via :root override (index.css); prefer provided tokens over defaults.",
    "Build AppShell.js as given; wire FiltersPanel, MapCanvas, InfoPanel.",
    "Ensure all interactive elements include data-testid per examples.",
    "Keep gradients off content. If any are used (decorative only), enforce policy.",
    "No 'transition: all'. Use transition-colors/opacity/background-color only.",
    "Use shadcn/ui components from ./components/ui/*.jsx exclusively for primitives.",
    "For map data, load TopoJSON coastlines and pass to MapCanvas; runways passed as [{start:[lon,lat],end:[lon,lat]}].",
    "Add <Toaster/> from sonner.jsx at app root for notifications (dark theme).",
    "Mobile: expose Filters and Info via Sheet; Desktop: 3-column grid as defined.",
    "Reserve amber/red strictly for alerts; default selection/active states use cyan."
  ],

  "css_custom_properties_to_add": {
    "snippet": ":root{ --bg-canvas:#0A0B0C; --bg-panel:#0E0F11; --bg-panel-alt:#121417; --fg-base:#E7E9EA; --fg-muted:#A9ADB1; --line-dim:#3A3E43; --line-light:#5A6067; --accent-cyan:#4DD7E6; --accent-green:#6BEA76; --state-warn:#FFC857; --state-alert:#FF6B6B; --focus-ring:#4DD7E6; }\nbody{ background-color:var(--bg-canvas); color:var(--fg-base);}"
  },

  "motion": {
    "principles": [
      "Subtle, utilitarian. No bounce/elastic.",
      "Animate opacity and color only for most controls",
      "Panel sheets may translate 8px with opacity, disabled if prefers-reduced-motion"
    ],
    "framer_motion_example": "import { m } from 'framer-motion';\nexport const Panel = ({children}) => (<m.div initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:8}} transition={{duration:0.16,ease:'easeOut'}}>{children}</m.div>);"
  },

  "empty_states": {
    "map": "When no aircraft, show unobtrusive mono hint at center: 'No traffic in sector' with opacity-60; remove on first data tick.",
    "weather": "When unavailable, show '—' rather than 'N/A' to reduce clutter."
  },

  "iconography": {
    "library": "lucide-react",
    "rule": "Stroke icons only; 1.25px weight default; colors follow text color"
  },

  "gradients_restriction_acknowledgement": {
    "rule": "No dark/saturated gradients (purple/pink/blue mixes). Never >20% viewport, never in text areas, never on small UI elements."
  },

  "component_path": {
    "TopAirBar": "AppShell.js <header>",
    "FiltersPanel": "./FiltersPanel.js (uses ./components/ui/* .jsx)",
    "MapCanvas": "./MapCanvas.js",
    "InfoPanel": "./InfoPanel.js"
  },

  "future_extensions": {
    "copilot_chat": "Right panel tab using ./components/ui/tabs.jsx; AI chat must not use purple; prefer light ocean blue/cyan accents.",
    "timeline_strip": "Optional bottom mini timeline for playback; labels in Azeret Mono"
  },

  "security_and_ops": {
    "data_classification": "Never leak sensitive data in labels; truncate CALLSIGNs as needed",
    "failsafe": "If data stream errors, freeze last good frame and display toast.warning('Data link degraded')"
  },

  "general_ui_ux_guidelines": "- You must **not** apply universal transition. Eg: `transition: all`. This results in breaking transforms. Always add transitions for specific interactive elements like button, input excluding transforms\n- You must **not** center align the app container, ie do not add `.App { text-align: center; }` in the css file. This disrupts the human natural reading flow of text\n   - NEVER: use AI assistant Emoji characters like`🤖🧠💭💡🔮🎯📚🎭🎬🎪🎉🎊🎁🎀🎂🍰🎈🎨🎰💰💵💳🏦💎🪙💸🤑📊📈📉💹🔢🏆🥇 etc for icons. Always use **FontAwesome cdn** or **lucid-react** library already installed in the package.json\n\n **GRADIENT RESTRICTION RULE**\nNEVER use dark/saturated gradient combos (e.g., purple/pink) on any UI element.  Prohibited gradients: blue-500 to purple 600, purple 500 to pink-500, green-500 to blue-500, red to pink etc\nNEVER use dark gradients for logo, testimonial, footer etc\nNEVER let gradients cover more than 20% of the viewport.\nNEVER apply gradients to text-heavy content or reading areas.\nNEVER use gradients on small UI elements (<100px width).\nNEVER stack multiple gradient layers in the same viewport.\n\n**ENFORCEMENT RULE:**\n    • Id gradient area exceeds 20% of viewport OR affects readability, **THEN** use solid colors\n\n**How and where to use:**\n   • Section backgrounds (not content backgrounds)\n   • Hero section header content. Eg: dark to light to dark color\n   • Decorative overlays and accent elements only\n   • Hero section with 2-3 mild color\n   • Gradients creation can be done for any angle say horizontal, vertical or diagonal\n\n- For AI chat, voice application, **do not use purple color. Use color like light green, ocean blue, peach orange etc**\n\n</Font Guidelines>\n\n- Every interaction needs micro-animations - hover states, transitions, parallax effects, and entrance animations. Static = dead. \n   \n- Use 2-3x more spacing than feels comfortable. Cramped designs look cheap.\n\n- Subtle grain textures, noise overlays, custom cursors, selection states, and loading animations: separates good from extraordinary.\n   \n- Before generating UI, infer the visual style from the problem statement (palette, contrast, mood, motion) and immediately instantiate it by setting global design tokens (primary, secondary/accent, background, foreground, ring, state colors), rather than relying on any library defaults. Don't make the background dark as a default step, always understand problem first and define colors accordingly\n    Eg: - if it implies playful/energetic, choose a colorful scheme\n           - if it implies monochrome/minimal, choose a black–white/neutral scheme\n\n**Component Reuse:**\n	- Prioritize using pre-existing components from src/components/ui when applicable\n	- Create new components that match the style and conventions of existing components when needed\n	- Examine existing components to understand the project's component patterns before creating new ones\n\n**IMPORTANT**: Do not use HTML based component like dropdown, calendar, toast etc. You **MUST** always use `/app/frontend/src/components/ui/ ` only as a primary components as these are modern and stylish component\n\n**Best Practices:**\n	- Use Shadcn/UI as the primary component library for consistency and accessibility\n	- Import path: ./components/[component-name]\n\n**Export Conventions:**\n	- Components MUST use named exports (export const ComponentName = ...)\n	- Pages MUST use default exports (export default function PageName() {...})\n\n**Toasts:**\n  - Use `sonner` for toasts\"\n  - Sonner component are located in `/app/src/components/ui/sonner.tsx`\n\nUse 2–4 color gradients, subtle textures/noise overlays, or CSS-based noise to avoid flat visuals."
}