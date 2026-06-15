import React, { useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bus,
  MapPin,
  Wind,
  Globe,
  Settings,
  CloudRain,
  Sun,
  CloudSun,
  Activity,
  TrendingDown,
  Leaf,
  AlertTriangle,
  TrendingUp,
  Thermometer,
  Users,
  Navigation,
  Sparkles,
  Info
} from 'lucide-react';

// Fix Leaflet's broken default icon paths when bundled with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ORS_API_KEY =
  process.env.ORS_API_KEY ||
  (import.meta as any).env?.VITE_ORS_API_KEY ||
  (globalThis as any).ORS_API_KEY ||
  '';

// Custom colored circle marker icon
function makeCircleIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:18px;height:18px;border-radius:50%;
      background:${color};border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,0.5);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12],
  });
}

// Labeled pin icon (A / B)
function makeLabelIcon(label: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:28px;height:28px;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);
      background:${color};border:2px solid #fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.5);
      display:flex;align-items:center;justify-content:center;
    ">
      <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:10px;">${label}</span>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -30],
  });
}

// Preset Route Configuration
const PRESETS = [
  {
    id: 'pt-1',
    label: 'Koramangala ⇌ Indiranagar Hub',
    origin: 'Koramangala 8th Block',
    destination: 'Indiranagar 100 Feet Road',
  },
  {
    id: 'pt-2',
    label: 'RV College of Engineering ⇌ Majestic',
    origin: 'RV College of Engineering Gate',
    destination: 'Kempegowda Bus Station (Majestic)',
  },
  {
    id: 'pt-3',
    label: 'Silk Board Grid ⇌ Hebbal Flyover',
    origin: 'Silk Board Cross Road',
    destination: 'Hebbal Central Hub',
  },
  {
    id: 'pt-4',
    label: 'Electronic City ⇌ Whitefield Corridor',
    origin: 'Electronic City Phase 1',
    destination: 'ITPL Campus Whitefield',
  }
];

// Component that auto-fits the map view to the route bounds
function MapBoundsFitter({ optimizationData }: { optimizationData: any }) {
  const map = useMap();

  useEffect(() => {
    if (map && optimizationData?.coordinates) {
      const standardPath: [number, number][] = optimizationData.coordinates.standard || [];
      const ecoPath: [number, number][] = optimizationData.coordinates.eco || [];
      const all = [...standardPath, ...ecoPath];
      if (all.length > 0) {
        const bounds = L.latLngBounds(all);
        map.fitBounds(bounds, { padding: [60, 60] });
      }
    }
  }, [map, optimizationData]);

  return null;
}

export default function App() {
  // Configured inputs
  const [selectedPreset, setSelectedPreset] = useState(PRESETS[0]);
  const [originText, setOriginText] = useState(PRESETS[0].origin);
  const [destText, setDestText] = useState(PRESETS[0].destination);
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [vehicleWeight, setVehicleWeight] = useState(1400);
  const [weather, setWeather] = useState('Sunny');
  const [tempCelsius, setTempCelsius] = useState(30);
  const [congestionLevel, setCongestionLevel] = useState('Heavy');

  // Interactive UI triggers
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [fleetBuses, setFleetBuses] = useState<any[]>([]);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'routing' | 'fleet'>('routing');
  const [activeRouteView, setActiveRouteView] = useState<'both' | 'eco' | 'standard'>('both');

  // Trigger preset changes
  const applyPreset = (preset: typeof PRESETS[0]) => {
    setSelectedPreset(preset);
    setOriginText(preset.origin);
    setDestText(preset.destination);
  };

  // Fetch active fleet list
  const fetchFleet = async () => {
    try {
      const res = await fetch('/api/buses');
      const data = await res.json();
      setFleetBuses(data);
    } catch (e) {
      console.error('Failed to load fleet data:', e);
    }
  };

  // Run Optimization Algorithm
  const runOptimization = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: originText,
          destination: destText,
          vehicleType,
          vehicleWeight,
          weather,
          tempCelsius,
          congestionLevel
        })
      });
      const data = await res.json();
      setOptimizationData(data);
    } catch (e) {
      console.error('EcoRoute optimization failure:', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  // Run simulation / fetch data on starting mounting
  useEffect(() => {
    fetchFleet();
    runOptimization();

    // Set interactive poll interval for coordinates / progress update
    const timer = setInterval(() => {
      setFleetBuses(prev => prev.map(bus => {
        const deltaSpeed = Math.floor(Math.random() * 5) - 2;
        const baseSpeed = parseInt(bus.speed);
        const newSpeed = Math.max(0, baseSpeed + deltaSpeed);
        return {
          ...bus,
          speed: `${newSpeed} km/h`
        };
      }));
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  // Draw routes coordinate vectors
  const standardPath: [number, number][] = (optimizationData?.coordinates?.standard || []).map(
    (c: { lat: number; lng: number }) => [c.lat, c.lng] as [number, number]
  );
  const ecoPath: [number, number][] = (optimizationData?.coordinates?.eco || []).map(
    (c: { lat: number; lng: number }) => [c.lat, c.lng] as [number, number]
  );

  return (
    <div id="main-dashboard" className="min-h-screen bg-[#0B0F19] text-indigo-50 font-sans flex flex-col antialiased selection:bg-indigo-500/30">
      {/* Header Panel */}
      <header id="dashboard-header" className="flex-shrink-0 bg-[#0B0F19]/70 backdrop-blur-xl border-b border-indigo-500/20 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-20 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
            <Leaf className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">EcoRoute AI</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/20 font-medium">
                V2.5 OPTIMIZER
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Multi-Objective Optimization Framework for Green Public Transport</p>
          </div>
        </div>

        {/* SDG Target Badges */}
        <div id="sdg-alignment" className="flex items-center space-x-4 text-xs">
          <div className="flex items-center bg-violet-950/30 backdrop-blur border border-violet-500/20 rounded-xl p-2.5 space-x-3 shadow-[0_0_10px_rgba(139,92,246,0.1)] group hover:border-violet-400/50 transition-all">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[10px] shadow-inner group-hover:scale-110 transition-transform">11</div>
            <div>
              <p className="text-[10px] text-violet-300 uppercase font-bold leading-none tracking-wider">SDG 11 Target</p>
              <p className="text-[11px] text-indigo-100/70 font-medium leading-normal mt-1">Sustainable Cities</p>
            </div>
          </div>
          <div className="flex items-center bg-indigo-950/30 backdrop-blur border border-indigo-500/20 rounded-xl p-2.5 space-x-3 shadow-[0_0_10px_rgba(79,70,229,0.1)] group hover:border-indigo-400/50 transition-all">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-[10px] shadow-inner group-hover:scale-110 transition-transform">13</div>
            <div>
              <p className="text-[10px] text-indigo-300 uppercase font-bold leading-none tracking-wider">SDG 13 Target</p>
              <p className="text-[11px] text-indigo-100/70 font-medium leading-normal mt-1">Climate Action</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main id="app-workspace" className="flex-grow flex flex-col lg:flex-row min-h-0 bg-[#0B0F19]">

        {/* Sidebar Controls (Left) */}
        <section id="sidebar-controls" className="w-full lg:w-[400px] bg-[#0B0F19]/60 backdrop-blur-2xl border-r border-indigo-500/10 p-6 overflow-y-auto flex-shrink-0 flex flex-col gap-6 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">

          {/* Main Navigation Tabs */}
          <div id="dashboard-modes" className="grid grid-cols-2 gap-1.5 bg-[#05070A]/50 p-1.5 rounded-2xl border border-white/5 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('routing')}
              className={`flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 ${activeTab === 'routing'
                  ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
            >
              <Navigation className="w-4 h-4" />
              <span>Route Optimizer</span>
            </button>
            <button
              onClick={() => setActiveTab('fleet')}
              className={`flex items-center justify-center space-x-2 py-3 rounded-xl text-xs font-semibold tracking-wide transition-all duration-300 ${activeTab === 'fleet'
                  ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                }`}
            >
              <Bus className="w-4 h-4" />
              <span>Operator Fleet ({fleetBuses.length})</span>
            </button>
          </div>

          {activeTab === 'routing' ? (
            /* Tab Content: Routing & Optimization Config */
            <div id="optimizer-config" className="space-y-4">

              {/* Presets List */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Route Corridor Presets</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={`text-left p-2.5 rounded-xl text-xs transition-all border ${selectedPreset.id === preset.id
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200 font-medium'
                          : 'bg-slate-950/40 border-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                      <div className="font-semibold">{preset.label}</div>
                      <div className="text-[10px] text-slate-400 mt-1 flex items-center truncate">
                        <MapPin className="w-3 h-3 text-emerald-400 mr-1 flex-shrink-0" />
                        <span>{preset.origin} → {preset.destination}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Coordinate Text-Inputs */}
              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                    Origin Point
                  </label>
                  <input
                    type="text"
                    value={originText}
                    onChange={(e) => setOriginText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    placeholder="Enter dispatch origin"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5"></span>
                    Destination Target
                  </label>
                  <input
                    type="text"
                    value={destText}
                    onChange={(e) => setDestText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    placeholder="Enter final station location"
                  />
                </div>
              </div>

              {/* Vehicle Type */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Vehicle Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'SUV', label: 'SUV', icon: '🚙', defaultWeight: 2000 },
                    { id: 'Sedan', label: 'Sedan', icon: '🚗', defaultWeight: 1400 },
                    { id: 'Hatchback', label: 'Hatchback', icon: '🚘', defaultWeight: 1100 },
                    { id: 'Sports', label: 'Sports Car', icon: '🏎️', defaultWeight: 1600 }
                  ].map(v => (
                    <button
                      key={v.id}
                      onClick={() => { setVehicleType(v.id); setVehicleWeight(v.defaultWeight); }}
                      className={`p-2 rounded-xl text-xs flex items-center space-x-2 border transition-all ${vehicleType === v.id
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-white font-medium shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                          : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-800 text-slate-300'
                        }`}
                    >
                      <span className="text-sm">{v.icon}</span>
                      <span className="text-[11px]">{v.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Vehicle Weight */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Vehicle Weight</label>
                  <span className="text-[10px] text-violet-400 font-mono font-semibold">{vehicleWeight.toLocaleString()} kg</span>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-2">
                  <input
                    type="range"
                    min="800"
                    max="3500"
                    step="50"
                    value={vehicleWeight}
                    onChange={(e) => setVehicleWeight(Number(e.target.value))}
                    className="w-full accent-violet-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                  <div className="flex justify-between text-[9px] text-slate-500">
                    <span>800 kg · Micro</span>
                    <span>1500 kg · Mid</span>
                    <span>3500 kg · Heavy</span>
                  </div>
                </div>
              </div>

              {/* Meteorological Factors */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Climate Adjustments</label>
                  <span className="text-[10px] text-teal-400 font-mono font-medium">{tempCelsius}°C</span>
                </div>

                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'Sunny', label: 'Sunny', icon: Sun },
                      { id: 'Overcast', label: 'Cloudy', icon: CloudSun },
                      { id: 'Monsoon Rain', label: 'Monsoon', icon: CloudRain }
                    ].map(w => {
                      const IconComponent = w.icon;
                      return (
                        <button
                          key={w.id}
                          onClick={() => {
                            setWeather(w.id);
                            if (w.id === 'Sunny') setTempCelsius(32);
                            if (w.id === 'Overcast') setTempCelsius(22);
                            if (w.id === 'Monsoon Rain') setTempCelsius(18);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] flex flex-col items-center gap-1 border transition-all ${weather === w.id
                              ? 'bg-teal-950/30 border-teal-500/40 text-teal-300 font-bold'
                              : 'bg-slate-900 border-transparent text-slate-400 hover:text-slate-200'
                            }`}
                        >
                          <IconComponent className="w-3.5 h-3.5" />
                          <span>{w.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className="space-y-1 pt-1">
                    <div className="flex justify-between text-[10px] text-slate-400">
                      <span>Ambient Temperature</span>
                      <span>Aux AC Cargo Threshold</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="45"
                      value={tempCelsius}
                      onChange={(e) => setTempCelsius(Number(e.target.value))}
                      className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Congestion Constants */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Base Congestion Intensity</label>
                <div className="grid grid-cols-3 gap-1">
                  {['Low', 'Moderate', 'Heavy'].map(level => {
                    return (
                      <button
                        key={level}
                        onClick={() => setCongestionLevel(level)}
                        className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all border ${congestionLevel === level
                            ? level === 'Heavy'
                              ? 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                              : level === 'Moderate'
                                ? 'bg-amber-950/30 border-amber-500/50 text-amber-300'
                                : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                            : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-800 text-slate-400'
                          }`}
                      >
                        {level}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Trigger button */}
              <button
                onClick={runOptimization}
                disabled={isOptimizing}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] disabled:opacity-50 flex items-center justify-center space-x-2 mt-6 cursor-pointer border border-white/10"
              >
                {isOptimizing ? (
                  <>
                    <Activity className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Analyzing Route Vectors...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-slate-950" />
                    <span>Run Multi-Objective Optimization</span>
                  </>
                )}
              </button>

            </div>
          ) : (
            /* Tab Content: Fleet & live telematics trackers */
            <div id="fleet-live-panel" className="space-y-4 flex-grow flex flex-col min-h-0">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Active System Dispatches</div>

              <div className="space-y-2 overflow-y-auto flex-grow max-h-[480px] pr-1">
                {fleetBuses.map(bus => (
                  <button
                    key={bus.id}
                    onClick={() => {
                      setSelectedBus(bus);
                      setActiveTab('fleet');
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 flex flex-col justify-between space-y-3 group ${selectedBus?.id === bus.id
                        ? 'bg-indigo-950/40 border-indigo-400 text-white shadow-[0_0_15px_rgba(79,70,229,0.2)]'
                        : 'bg-slate-900/30 border-white/5 hover:border-indigo-500/30 hover:bg-indigo-950/20 text-slate-300'
                      }`}
                  >
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${bus.ecoMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                          }`}>
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white">{bus.id}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">{bus.line}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${bus.status === 'OPTIMAL_WAVE' || bus.status === 'GREEN_PATH'
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20'
                          : bus.status === 'IDLE_TRAP'
                            ? 'bg-rose-950/50 text-rose-400 border-rose-500/20'
                            : 'bg-amber-950/50 text-amber-400 border-amber-500/20'
                        }`}>
                        {bus.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2 rounded-lg">
                      <div className="flex items-center text-slate-400">
                        <Users className="w-3 h-3 text-teal-400 mr-1" />
                        <span>Pax: <strong className="text-slate-200">{bus.passengers}</strong></span>
                      </div>
                      <div className="flex items-center text-slate-400 font-mono">
                        <Activity className="w-3 h-3 text-amber-400 mr-1" />
                        <span>Vel: <strong className="text-slate-200">{bus.speed}</strong></span>
                      </div>
                      <div className="col-span-2 flex justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-0.5">
                        <span>Rate: <strong className="text-emerald-400 font-bold">{bus.fuelRate}</strong></span>
                        <span className={bus.delay.includes('+') ? 'text-amber-400' : 'text-emerald-400'}>{bus.delay}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Environmental Attribution info */}
          <footer className="mt-auto border-t border-slate-800/80 pt-4 text-[10px] text-slate-500 space-y-1">
            <p>Powered by OpenRouteService & OpenStreetMap. AI insights by Gemini.</p>
            <p className="font-mono text-[9px] text-slate-600">Attribution: © OpenStreetMap contributors</p>
          </footer>
        </section>

        {/* Center Dashboard View (Map & Statistics cards) */}
        <section id="analytics-console" className="flex-grow flex flex-col min-h-0 bg-[#05070A] relative">

          {/* Statistics summary overlays */}
          {optimizationData && activeTab === 'routing' && (
            <div id="impact-cards-deck" className="bg-[#0B0F19]/80 backdrop-blur-xl p-5 border-b border-indigo-500/10 grid grid-cols-2 md:grid-cols-4 gap-4 relative z-20 shadow-[0_8px_30px_rgba(0,0,0,0.3)]">

              {/* SDG Fuel Savings card */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-indigo-400/50 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <TrendingDown className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/10">
                    -{optimizationData.metrics?.fuelSavingsPercent}% Fuel
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Net Fuel Savings</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {optimizationData.metrics?.fuelSavedLiters} <span className="text-xs font-normal text-slate-400">Liters</span>
                  </p>
                </div>
              </div>

              {/* CO2 reduction card */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-indigo-400/50 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-teal-500/10 rounded-lg text-teal-400">
                    <Wind className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-teal-400 font-bold bg-teal-950/50 px-1.5 py-0.5 rounded border border-teal-500/10">
                    -{optimizationData.metrics?.co2SavingsPercent}% Emis
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Carbon Avoided</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {optimizationData.metrics?.co2ReducedKg} <span className="text-xs font-normal text-slate-400">kg CO₂</span>
                  </p>
                </div>
              </div>

              {/* Trees planted card */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-indigo-400/50 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-green-500/10 rounded-lg text-green-400">
                    <Leaf className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-green-400 font-bold bg-green-950/50 px-1.5 py-0.5 rounded border border-green-500/10">
                    Equivalent
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Absorb-Rate Equity</p>
                  <p className="text-lg font-bold text-white mt-0.5">
                    {optimizationData.metrics?.equivalentTreesPlanted} <span className="text-xs font-normal text-slate-400">Tree-Days</span>
                  </p>
                </div>
              </div>

              {/* Signal prioritized rating */}
              <div className="bg-slate-900/40 backdrop-blur-md border border-indigo-500/20 rounded-2xl p-4 flex flex-col justify-between shadow-[0_4px_20px_rgba(0,0,0,0.2)] hover:border-indigo-400/50 hover:shadow-[0_0_15px_rgba(79,70,229,0.3)] transition-all duration-300">
                <div className="flex justify-between items-start">
                  <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-400">
                    <Activity className="w-4 h-4" />
                  </div>
                  <span className="text-[10px] text-slate-300 font-semibold bg-indigo-950/20 px-2 py-0.5 rounded-full border border-indigo-500/15">
                    Traffic
                  </span>
                </div>
                <div className="mt-2.5">
                  <p className="text-[10px] text-slate-400 uppercase font-medium">Eco Priority Level</p>
                  <p className="text-sm font-bold text-indigo-300 mt-1 flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 inline-block"></span>
                    92% Optimal
                  </p>
                </div>
              </div>

            </div>
          )}

          {/* Map Viewer Area */}
          <div id="operator-map-container" className="flex-grow relative h-96 lg:h-auto min-h-[350px]">
            <MapContainer
              center={[12.9716, 77.5946]}
              zoom={12}
              style={{ width: '100%', height: '100%' }}
              zoomControl={true}
            >
              {/* OpenStreetMap tiles — free, no API key needed for display */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Auto-fit map to route bounds */}
              <MapBoundsFitter optimizationData={optimizationData} />

              {/* Eco Route (Red) polyline */}
              {activeTab === 'routing' && standardPath.length > 0 && (
                <Polyline
                  positions={standardPath}
                  pathOptions={{ color: '#f43f5e', weight: 7, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }}
                />
              )}

              {/* Origin & Destination Markers */}
              {activeTab === 'routing' && standardPath.length > 0 && (
                <>
                  <Marker
                    position={standardPath[0]}
                    icon={makeLabelIcon('A', '#E11D48')}
                  >
                    <Popup>
                      <div className="font-sans text-xs font-semibold text-slate-800">Origin Dispatch Gate</div>
                    </Popup>
                  </Marker>
                  <Marker
                    position={standardPath[standardPath.length - 1]}
                    icon={makeLabelIcon('B', '#059669')}
                  >
                    <Popup>
                      <div className="font-sans text-xs font-semibold text-slate-800">Destination Station Hub</div>
                    </Popup>
                  </Marker>
                </>
              )}

              {/* Fleet Bus Markers */}
              {fleetBuses.map((bus) => (
                <Marker
                  key={bus.id}
                  position={[bus.lat, bus.lng]}
                  icon={makeCircleIcon(bus.ecoMode ? '#10b981' : '#f43f5e')}
                  eventHandlers={{
                    click: () => {
                      setSelectedBus(bus);
                      setActiveTab('fleet');
                    }
                  }}
                >
                  <Popup>
                    <div className="p-1 text-slate-800 min-w-[180px] text-xs font-sans">
                      <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-2">
                        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1">
                          🚌 {bus.id}
                        </h4>
                        <span className={`text-[9px] px-1.5 rounded font-mono ${bus.ecoMode ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                          {bus.ecoMode ? 'Eco-Active' : 'Unoptimized'}
                        </span>
                      </div>
                      <div className="space-y-1 text-slate-600">
                        <p><strong>Route line:</strong> {bus.line}</p>
                        <p><strong>Speed:</strong> {bus.speed}</p>
                        <p><strong>Schedule Delay:</strong> {bus.delay}</p>
                        <p><strong>Passengers on-board:</strong> {bus.passengers} / 70</p>
                        <p><strong>Local Fuel Rate:</strong> {bus.fuelRate}</p>
                        <p className="border-t border-slate-100 pt-1.5 mt-1 text-[10px]">
                          <strong>Estimated saved so far:</strong>{' '}
                          <span className="text-green-600 font-bold">
                            {bus.metrics.litersSaved} Liters
                          </span>
                        </p>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>

            {/* Map Overlay legend */}
            <div id="map-control-overlay" className="absolute bottom-6 left-6 bg-[#0B0F19]/85 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-[0_8px_32px_rgba(79,70,229,0.2)] z-[1000] text-xs space-y-3 max-w-[220px]">
              <div className="font-semibold text-white text-[11px]">Map Legend</div>
              <div className="space-y-1.5">
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-1.5 rounded-full bg-[#f43f5e]"></div>
                  <span className="text-[10px] text-slate-300">Eco Route</span>
                </div>
              </div>
            </div>

            {/* Route Comparison Card — Eco vs Standard metrics */}
            {optimizationData && activeTab === 'routing' && standardPath.length > 10 && (
              <div id="route-comparison-card" className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0B0F19]/90 backdrop-blur-xl border border-indigo-500/25 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.5)] z-[1000] overflow-hidden" style={{ minWidth: '380px' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-gradient-to-r from-cyan-900/20 to-rose-900/20">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-[11px] font-bold text-white tracking-wide">Eco Route Saves You</span>
                  </div>
                  <span className="text-[9px] text-slate-400 font-mono">vs Fastest Route</span>
                </div>
                {/* Metrics grid */}
                <div className="grid grid-cols-3 divide-x divide-slate-800/60">
                  {/* CO2 */}
                  <div className="px-3 py-2.5 flex flex-col items-center gap-0.5 group hover:bg-emerald-900/10 transition-colors">
                    <Wind className="w-3.5 h-3.5 text-emerald-400 mb-0.5" />
                    <p className="text-[18px] font-black text-emerald-400 leading-none">
                      -{optimizationData.metrics?.co2SavingsPercent ?? 0}%
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Less CO₂</p>
                    <p className="text-[10px] text-emerald-300 font-mono font-semibold">
                      {optimizationData.metrics?.co2ReducedKg ?? 0} kg saved
                    </p>
                  </div>
                  {/* Fuel */}
                  <div className="px-3 py-2.5 flex flex-col items-center gap-0.5 group hover:bg-violet-900/10 transition-colors">
                    <TrendingDown className="w-3.5 h-3.5 text-violet-400 mb-0.5" />
                    <p className="text-[18px] font-black text-violet-400 leading-none">
                      -{optimizationData.metrics?.fuelSavingsPercent ?? 0}%
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Less Fuel</p>
                    <p className="text-[10px] text-violet-300 font-mono font-semibold">
                      {optimizationData.metrics?.fuelSavedLiters ?? 0} L saved
                    </p>
                  </div>
                  {/* Congestion */}
                  <div className="px-3 py-2.5 flex flex-col items-center gap-0.5 group hover:bg-amber-900/10 transition-colors">
                    <Activity className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
                    <p className="text-[18px] font-black text-amber-400 leading-none">
                      -{optimizationData.metrics?.congestionSavingsPercent ?? 78}%
                    </p>
                    <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">Congestion</p>
                    <p className="text-[10px] text-amber-300 font-mono font-semibold">smoother flow</p>
                  </div>
                </div>
              </div>
            )}

            {/* AI Optimizer recommendation popover */}
            {optimizationData && activeTab === 'routing' && (
              <div id="recommendation-popover" className="absolute top-6 right-6 max-w-sm bg-[#0B0F19]/85 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-5 shadow-[0_8px_32px_rgba(79,70,229,0.2)] z-[1000] text-xs space-y-4 max-h-[400px] overflow-y-auto">
                <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs tracking-wide">Multi-Objective Insights</span>
                </div>

                <div className="space-y-1 font-sans">
                  <p className="text-slate-300 leading-relaxed font-semibold text-[11px]">
                    {optimizationData.summary}
                  </p>
                  <p className="text-slate-400 italic text-[10px] mt-1.5 leading-normal">
                    {optimizationData.weatherImpact}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">EcoRoute Recommendations</span>
                  <ul className="space-y-1.5 text-slate-300 text-[11px]">
                    {optimizationData.insights?.map((ins: string, idx: number) => (
                      <li key={idx} className="flex items-start">
                        <span className="text-emerald-400 mr-1.5 inline-block select-none">•</span>
                        <span>{ins}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {optimizationData.ecoRoute?.bypassDetails && (
                  <div className="bg-emerald-950/20 border border-emerald-500/10 rounded-lg p-2 text-[10px] text-emerald-300 font-sans mt-2">
                    <strong className="block text-[9px] uppercase tracking-wider text-emerald-400 mb-0.5">Bypass Directives:</strong>
                    {optimizationData.ecoRoute.bypassDetails}
                  </div>
                )}

                {optimizationData.fallbackWarning && (
                  <div className="bg-amber-950/30 border border-amber-500/15 rounded-lg p-2 text-[10px] text-amber-300 flex items-center space-x-1.5 leading-normal">
                    <Info className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{optimizationData.fallbackWarning}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Route comparison stat table at the bottom */}
          {optimizationData && activeTab === 'routing' && (
            <div id="metrics-tabulator" className="bg-[#0B0F19]/90 backdrop-blur-md border-t border-indigo-500/20 p-5 overflow-x-auto relative z-20 shadow-[0_-8px_30px_rgba(0,0,0,0.2)]">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80 pb-2">
                    <th className="pb-2 font-bold uppercase text-[10px]">Route Segment Profile</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">Distance</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">Est. Duration</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">Fuel Consumed</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">CO₂ Emissions</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">Congestion Score</th>
                    <th className="pb-2 font-bold uppercase text-[10px]">Hotspots / Staging Bays</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  <tr className="hover:bg-slate-800/20">
                    <td className="py-2.5 font-bold text-rose-400 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2"></span>
                      {optimizationData.standardRoute?.name}
                    </td>
                    <td className="py-2.5 font-mono">{optimizationData.standardRoute?.distanceKm} km</td>
                    <td className="py-2.5 font-mono">{optimizationData.standardRoute?.durationMinutes} mins</td>
                    <td className="py-2.5 font-mono text-slate-300">{optimizationData.standardRoute?.estFuelLiters} L</td>
                    <td className="py-2.5 font-mono text-rose-300 font-semibold">{optimizationData.standardRoute?.estCO2Kg} kg</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/10 font-bold text-[10px]">
                        {optimizationData.standardRoute?.congestionScore}/10 Peak
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400 truncate max-w-[200px]" title={optimizationData.standardRoute?.hotspots?.join(', ')}>
                      {optimizationData.standardRoute?.hotspots?.join(', ')}
                    </td>
                  </tr>
                  <tr className="hover:bg-slate-800/20">
                    <td className="py-2.5 font-bold text-emerald-400 flex items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>
                      {optimizationData.ecoRoute?.name}
                    </td>
                    <td className="py-2.5 font-mono">{optimizationData.ecoRoute?.distanceKm} km</td>
                    <td className="py-2.5 font-mono text-emerald-200">{optimizationData.ecoRoute?.durationMinutes} mins</td>
                    <td className="py-2.5 font-mono text-emerald-400 font-bold">{optimizationData.ecoRoute?.estFuelLiters} L</td>
                    <td className="py-2.5 font-mono text-emerald-400 font-bold">{optimizationData.ecoRoute?.estCO2Kg} kg</td>
                    <td className="py-2.5">
                      <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/10 font-bold text-[10px]">
                        {optimizationData.ecoRoute?.congestionScore}/10 Fluid
                      </span>
                    </td>
                    <td className="py-2.5 text-xs text-slate-400 truncate max-w-[200px]" title={optimizationData.ecoRoute?.alternativeStops?.join(', ')}>
                      {optimizationData.ecoRoute?.alternativeStops?.join(', ')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

        </section>

      </main>
    </div>
  );
}
