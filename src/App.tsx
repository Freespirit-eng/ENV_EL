import React, { useState, useEffect, useCallback } from 'react';
import {
  MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Bus, MapPin, Wind, CloudRain, Sun, CloudSun, Activity, TrendingDown,
  Leaf, AlertTriangle, Users, Navigation, Sparkles, Info,
  BarChart3, Zap, Globe, Cloud,
} from 'lucide-react';

// Components
import AnalyticsDashboard from './components/AnalyticsDashboard';
import FleetSimulator from './components/FleetSimulator';
import VoiceQuery from './components/VoiceQuery';
import CongestionReporter from './components/CongestionReporter';
import { CITIES, getCityById, DEFAULT_CITY, type CityConfig } from './cityConfig';

// Fix Leaflet's broken default icon paths when bundled with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom marker icons
function makeCircleIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
    iconSize: [18, 18], iconAnchor: [9, 9], popupAnchor: [0, -12],
  });
}

function makeLabelIcon(label: string, color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;">
      <span style="transform:rotate(45deg);color:#fff;font-weight:700;font-size:10px;">${label}</span>
    </div>`,
    iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -30],
  });
}

function makeCongestionIcon(severity: number) {
  const colors = ['#22c55e', '#84cc16', '#eab308', '#f97316', '#ef4444'];
  const color = colors[Math.min(severity - 1, 4)];
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.6);box-shadow:0 0 12px ${color}80;opacity:0.85;"></div>`,
    iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -14],
  });
}

// Map bounds fitter
function MapBoundsFitter({ optimizationData, cityCenter }: { optimizationData: any; cityCenter: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    if (map && optimizationData?.coordinates) {
      const stdPath: [number, number][] = optimizationData.coordinates.standard || [];
      const ecoPath: [number, number][] = optimizationData.coordinates.eco || [];
      const all = [...stdPath, ...ecoPath];
      if (all.length > 0) {
        const bounds = L.latLngBounds(all);
        map.fitBounds(bounds, { padding: [60, 60] });
        return;
      }
    }
    if (map && cityCenter) {
      map.setView(cityCenter, 12);
    }
  }, [map, optimizationData, cityCenter]);
  return null;
}

// Tab type
type TabType = 'routing' | 'fleet' | 'analytics' | 'simulator';

export default function App() {
  // City selection
  const [selectedCityId, setSelectedCityId] = useState(DEFAULT_CITY.id);
  const cityConfig: CityConfig = getCityById(selectedCityId);

  // Route inputs
  const [selectedPresetId, setSelectedPresetId] = useState(cityConfig.presets[0]?.id || '');
  const [originText, setOriginText] = useState(cityConfig.presets[0]?.origin || '');
  const [destText, setDestText] = useState(cityConfig.presets[0]?.destination || '');
  const [vehicleType, setVehicleType] = useState('Sedan');
  const [vehicleWeight, setVehicleWeight] = useState(1400);
  const [weather, setWeather] = useState('Sunny');
  const [tempCelsius, setTempCelsius] = useState(30);
  const [congestionLevel, setCongestionLevel] = useState('Heavy');

  // UI state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationData, setOptimizationData] = useState<any>(null);
  const [fleetBuses, setFleetBuses] = useState<any[]>([]);
  const [selectedBus, setSelectedBus] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('routing');

  // New feature state
  const [history, setHistory] = useState<any[]>([]);
  const [congestionReports, setCongestionReports] = useState<any[]>([]);
  const [liveWeather, setLiveWeather] = useState<any>(null);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);

  // Apply preset
  const applyPreset = (preset: typeof cityConfig.presets[0], overrideCityId?: string) => {
    setSelectedPresetId(preset.id);
    setOriginText(preset.origin);
    setDestText(preset.destination);
    runOptimization({ origin: preset.origin, destination: preset.destination, city: overrideCityId });
  };

  // City change handler
  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId);
    const city = getCityById(cityId);
    if (city.presets.length > 0) {
      applyPreset(city.presets[0], cityId);
    } else {
      setOptimizationData(null);
    }
    setSelectedBus(null);
    setLiveWeather(null);
    fetchFleet(cityId);
    fetchWeather(city.name);
    fetchCongestion();
  };

  // Fetch fleet
  const fetchFleet = async (cityId?: string) => {
    try {
      const res = await fetch(`/api/buses?city=${cityId || selectedCityId}`);
      setFleetBuses(await res.json());
    } catch (e) { console.error('Fleet fetch failed:', e); }
  };

  // Fetch weather
  const fetchWeather = async (cityName?: string) => {
    setIsWeatherLoading(true);
    try {
      const res = await fetch(`/api/weather?city=${encodeURIComponent(cityName || cityConfig.name)}`);
      const data = await res.json();
      setLiveWeather(data);
      // Auto-apply weather to optimization params
      if (data.temp) setTempCelsius(data.temp);
      if (data.description) {
        const desc = data.description.toLowerCase();
        if (desc.includes('rain') || desc.includes('drizzle') || desc.includes('thunder')) setWeather('Monsoon Rain');
        else if (desc.includes('cloud') || desc.includes('overcast') || desc.includes('haze') || desc.includes('mist')) setWeather('Overcast');
        else setWeather('Sunny');
      }
    } catch (e) { console.error('Weather fetch failed:', e); }
    setIsWeatherLoading(false);
  };

  // Fetch congestion reports
  const fetchCongestion = async () => {
    try {
      const res = await fetch('/api/congestion');
      setCongestionReports(await res.json());
    } catch (e) { console.error('Congestion fetch failed:', e); }
  };

  // Fetch history
  const fetchHistory = async () => {
    try {
      const res = await fetch('/api/history');
      setHistory(await res.json());
    } catch (e) { console.error('History fetch failed:', e); }
  };

  // Clear history
  const clearHistory = async () => {
    try {
      await fetch('/api/history', { method: 'DELETE' });
      setHistory([]);
    } catch (e) { console.error('Clear history failed:', e); }
  };

  // Submit congestion report
  const submitCongestion = async (report: { lat: number; lng: number; severity: number; type: string; note: string }) => {
    try {
      await fetch('/api/congestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      });
      fetchCongestion();
    } catch (e) { console.error('Congestion report failed:', e); }
  };

  // Run optimization
  const runOptimization = useCallback(async (overrides?: { origin?: string, destination?: string, city?: string }) => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/api/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: overrides?.origin !== undefined ? overrides.origin : originText,
          destination: overrides?.destination !== undefined ? overrides.destination : destText,
          vehicleType, vehicleWeight, weather, tempCelsius, congestionLevel,
          city: overrides?.city !== undefined ? overrides.city : selectedCityId
        }),
      });
      const data = await res.json();
      setOptimizationData(data);
      fetchHistory(); // Refresh history after each optimization
    } catch (e) { console.error('Optimization failed:', e); }
    finally { setIsOptimizing(false); }
  }, [originText, destText, vehicleType, vehicleWeight, weather, tempCelsius, congestionLevel, selectedCityId]);

  // Voice query result handler
  const handleVoiceResult = (params: any) => {
    if (params.origin) setOriginText(params.origin);
    if (params.destination) setDestText(params.destination);
    if (params.vehicleType) setVehicleType(params.vehicleType);
    if (params.weather) setWeather(params.weather);
    if (params.congestionLevel) setCongestionLevel(params.congestionLevel);
    // Auto-run optimization after voice query fills params
    setTimeout(() => runOptimization(), 300);
  };

  // Initial data load
  useEffect(() => {
    fetchFleet();
    fetchWeather();
    fetchCongestion();
    fetchHistory();
    runOptimization();

    // Poll fleet telemetry
    const timer = setInterval(() => {
      setFleetBuses(prev => prev.map(bus => {
        const delta = Math.floor(Math.random() * 5) - 2;
        const base = parseInt(bus.speed);
        return { ...bus, speed: `${Math.max(0, base + delta)} km/h` };
      }));
    }, 60000);

    // Poll congestion reports
    const congTimer = setInterval(fetchCongestion, 120000);

    return () => { clearInterval(timer); clearInterval(congTimer); };
  }, []);

  // Route path data
  const standardPath: [number, number][] = (optimizationData?.coordinates?.standard || []).map(
    (c: { lat: number; lng: number }) => [c.lat, c.lng] as [number, number]
  );
  const ecoPath: [number, number][] = (optimizationData?.coordinates?.eco || []).map(
    (c: { lat: number; lng: number }) => [c.lat, c.lng] as [number, number]
  );

  const showMap = activeTab === 'routing' || activeTab === 'fleet';

  return (
    <div id="main-dashboard" className="min-h-screen bg-[#0B0F19] text-indigo-50 font-sans flex flex-col antialiased selection:bg-indigo-500/30">
      {/* ==================== HEADER ==================== */}
      <header id="dashboard-header" className="flex-shrink-0 bg-[#0B0F19]/70 backdrop-blur-xl border-b border-indigo-500/20 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 relative z-20 shadow-[0_4px_30px_rgba(0,0,0,0.3)]">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
            <Leaf className="w-6 h-6 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight text-white">EcoRoute AI</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-400/20 font-medium">
                V3.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Multi-City Green Transit Optimization Framework</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* City Selector */}
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2">
            <Globe className="w-3.5 h-3.5 text-teal-400" />
            <select
              value={selectedCityId}
              onChange={e => handleCityChange(e.target.value)}
              className="bg-transparent text-xs text-white font-semibold border-none focus:outline-none cursor-pointer"
            >
              {CITIES.map(c => (
                <option key={c.id} value={c.id} className="bg-slate-900 text-white">{c.name}</option>
              ))}
            </select>
          </div>

          {/* Live Weather Chip */}
          {liveWeather && (
            <div className="flex items-center gap-1.5 bg-slate-900/50 border border-slate-700/50 rounded-xl px-3 py-2 text-xs">
              <Cloud className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-white font-semibold">{liveWeather.temp}°C</span>
              <span className="text-slate-400">{liveWeather.description}</span>
              {!liveWeather.live && <span className="text-[9px] text-amber-400">(sim)</span>}
            </div>
          )}

          {/* SDG Badges */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-violet-950/30 border border-violet-500/20 rounded-xl p-2 space-x-2 group hover:border-violet-400/50 transition-all">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center font-bold text-[9px]">11</div>
              <span className="text-[10px] text-violet-300 font-bold">SDG 11</span>
            </div>
            <div className="flex items-center bg-indigo-950/30 border border-indigo-500/20 rounded-xl p-2 space-x-2 group hover:border-indigo-400/50 transition-all">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-blue-600 text-white flex items-center justify-center font-bold text-[9px]">13</div>
              <span className="text-[10px] text-indigo-300 font-bold">SDG 13</span>
            </div>
          </div>
        </div>
      </header>

      {/* ==================== MAIN ==================== */}
      <main id="app-workspace" className="flex-grow flex flex-col lg:flex-row min-h-0 bg-[#0B0F19]">

        {/* ==================== SIDEBAR ==================== */}
        <section id="sidebar-controls" className="w-full lg:w-[400px] bg-[#0B0F19]/60 backdrop-blur-2xl border-r border-indigo-500/10 p-5 overflow-y-auto flex-shrink-0 flex flex-col gap-5 relative z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]">

          {/* Navigation Tabs */}
          <div id="dashboard-modes" className="grid grid-cols-4 gap-1 bg-[#05070A]/50 p-1 rounded-2xl border border-white/5">
            {[
              { id: 'routing' as TabType, icon: Navigation, label: 'Routes' },
              { id: 'fleet' as TabType, icon: Bus, label: 'Fleet' },
              { id: 'analytics' as TabType, icon: BarChart3, label: 'Analytics' },
              { id: 'simulator' as TabType, icon: Zap, label: 'Simulator' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-[10px] font-semibold tracking-wide transition-all duration-300 ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-violet-600/20 to-indigo-600/20 text-indigo-300 border border-indigo-500/30 shadow-[0_0_15px_rgba(79,70,229,0.15)]'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent'
                }`}
              >
                <tab.icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* ---- ROUTING TAB ---- */}
          {activeTab === 'routing' && (
            <div id="optimizer-config" className="space-y-4">
              {/* Voice Query */}
              <VoiceQuery onQueryResult={handleVoiceResult} isProcessing={isOptimizing} />

              {/* Presets */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Route Presets — {cityConfig.name}</label>
                <div className="grid grid-cols-1 gap-1.5">
                  {cityConfig.presets.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset)}
                      className={`text-left p-2.5 rounded-xl text-xs transition-all border ${
                        selectedPresetId === preset.id
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

              {/* Origin/Destination */}
              <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-800 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                    Origin Point
                  </label>
                  <input type="text" value={originText} onChange={e => setOriginText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    placeholder="Enter origin" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400 mr-1.5"></span>
                    Destination
                  </label>
                  <input type="text" value={destText} onChange={e => setDestText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:border-emerald-500 text-slate-200"
                    placeholder="Enter destination" />
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
                    { id: 'Sports', label: 'Sports Car', icon: '🏎️', defaultWeight: 1600 },
                  ].map(v => (
                    <button key={v.id}
                      onClick={() => { setVehicleType(v.id); setVehicleWeight(v.defaultWeight); }}
                      className={`p-2 rounded-xl text-xs flex items-center space-x-2 border transition-all ${
                        vehicleType === v.id
                          ? 'bg-emerald-950/30 border-emerald-500/50 text-white font-medium'
                          : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-800 text-slate-300'
                      }`}>
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
                <input type="range" min="800" max="3500" step="50" value={vehicleWeight}
                  onChange={e => setVehicleWeight(Number(e.target.value))}
                  className="w-full accent-violet-500 h-1 bg-slate-800 rounded-lg cursor-pointer" />
              </div>

              {/* Weather */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Climate</label>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-teal-400 font-mono">{tempCelsius}°C</span>
                    <button
                      onClick={() => fetchWeather()}
                      disabled={isWeatherLoading}
                      className="text-[9px] px-2 py-0.5 bg-sky-950/30 border border-sky-500/20 rounded text-sky-400 hover:bg-sky-950/50 transition-all disabled:opacity-40"
                    >
                      {isWeatherLoading ? '...' : '🌤️ Auto'}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-3 space-y-3">
                  <div className="grid grid-cols-3 gap-1">
                    {[
                      { id: 'Sunny', label: 'Sunny', icon: Sun },
                      { id: 'Overcast', label: 'Cloudy', icon: CloudSun },
                      { id: 'Monsoon Rain', label: 'Monsoon', icon: CloudRain },
                    ].map(w => {
                      const IconComp = w.icon;
                      return (
                        <button key={w.id}
                          onClick={() => { setWeather(w.id); if (w.id === 'Sunny') setTempCelsius(32); if (w.id === 'Overcast') setTempCelsius(22); if (w.id === 'Monsoon Rain') setTempCelsius(18); }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] flex flex-col items-center gap-1 border transition-all ${
                            weather === w.id
                              ? 'bg-teal-950/30 border-teal-500/40 text-teal-300 font-bold'
                              : 'bg-slate-900 border-transparent text-slate-400 hover:text-slate-200'
                          }`}>
                          <IconComp className="w-3.5 h-3.5" />
                          <span>{w.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <input type="range" min="10" max="45" value={tempCelsius}
                    onChange={e => setTempCelsius(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer h-1 bg-slate-800 rounded-lg" />
                </div>
              </div>

              {/* Congestion */}
              <div className="space-y-2">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Congestion Level</label>
                <div className="grid grid-cols-3 gap-1">
                  {['Low', 'Moderate', 'Heavy'].map(level => (
                    <button key={level} onClick={() => setCongestionLevel(level)}
                      className={`py-2 px-1.5 rounded-lg text-xs font-semibold transition-all border ${
                        congestionLevel === level
                          ? level === 'Heavy' ? 'bg-rose-950/30 border-rose-500/50 text-rose-300'
                            : level === 'Moderate' ? 'bg-amber-950/30 border-amber-500/50 text-amber-300'
                              : 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
                          : 'bg-slate-950/30 border-slate-800/80 hover:bg-slate-800 text-slate-400'
                      }`}>
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optimize Button */}
              <button onClick={runOptimization} disabled={isOptimizing}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white py-3.5 rounded-xl font-bold text-xs tracking-widest uppercase transition-all duration-300 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(139,92,246,0.5)] disabled:opacity-50 flex items-center justify-center space-x-2 cursor-pointer border border-white/10">
                {isOptimizing ? (
                  <><Activity className="w-4 h-4 animate-spin" /><span>Analyzing...</span></>
                ) : (
                  <><Sparkles className="w-4 h-4" /><span>Run Optimization</span></>
                )}
              </button>
            </div>
          )}

          {/* ---- FLEET TAB ---- */}
          {activeTab === 'fleet' && (
            <div id="fleet-live-panel" className="space-y-4 flex-grow flex flex-col min-h-0">
              <div className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                Active Fleet — {cityConfig.name}
              </div>
              <div className="space-y-2 overflow-y-auto flex-grow max-h-[480px] pr-1">
                {fleetBuses.map(bus => (
                  <button key={bus.id}
                    onClick={() => { setSelectedBus(bus); }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-300 flex flex-col space-y-3 group ${
                      selectedBus?.id === bus.id
                        ? 'bg-indigo-950/40 border-indigo-400 text-white shadow-[0_0_15px_rgba(79,70,229,0.2)]'
                        : 'bg-slate-900/30 border-white/5 hover:border-indigo-500/30 hover:bg-indigo-950/20 text-slate-300'
                    }`}>
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${bus.ecoMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                          <Bus className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-white">{bus.id}</span>
                          <span className="text-[10px] text-slate-400 ml-2 font-mono">{bus.line}</span>
                        </div>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold border ${
                        bus.status === 'OPTIMAL_WAVE' || bus.status === 'GREEN_PATH'
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-500/20'
                          : bus.status === 'IDLE_TRAP'
                            ? 'bg-rose-950/50 text-rose-400 border-rose-500/20'
                            : 'bg-amber-950/50 text-amber-400 border-amber-500/20'
                      }`}>{bus.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/40 p-2 rounded-lg">
                      <div className="flex items-center text-slate-400">
                        <Users className="w-3 h-3 text-teal-400 mr-1" />
                        Pax: <strong className="text-slate-200 ml-0.5">{bus.passengers}</strong>
                      </div>
                      <div className="flex items-center text-slate-400 font-mono">
                        <Activity className="w-3 h-3 text-amber-400 mr-1" />
                        Vel: <strong className="text-slate-200 ml-0.5">{bus.speed}</strong>
                      </div>
                      <div className="col-span-2 flex justify-between text-[10px] text-slate-400 border-t border-slate-800/80 pt-1.5 mt-0.5">
                        <span>Rate: <strong className="text-emerald-400">{bus.fuelRate}</strong></span>
                        <span className={bus.delay.includes('+') ? 'text-amber-400' : 'text-emerald-400'}>{bus.delay}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ---- ANALYTICS TAB sidebar placeholder ---- */}
          {activeTab === 'analytics' && (
            <div className="text-center py-8 text-slate-500 text-xs">
              <BarChart3 className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
              <p className="font-semibold text-slate-300">Analytics Dashboard</p>
              <p className="mt-1">View cumulative environmental impact data in the main panel →</p>
            </div>
          )}

          {/* ---- SIMULATOR TAB sidebar placeholder ---- */}
          {activeTab === 'simulator' && (
            <div className="text-center py-8 text-slate-500 text-xs">
              <Zap className="w-8 h-8 mx-auto mb-2 text-violet-500" />
              <p className="font-semibold text-slate-300">Fleet Scenario Simulator</p>
              <p className="mt-1">Configure what-if scenarios in the main panel →</p>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-auto border-t border-slate-800/80 pt-4 text-[10px] text-slate-500 space-y-1">
            <p>Powered by OpenRouteService & OpenStreetMap. AI by Gemini.</p>
            <p className="font-mono text-[9px] text-slate-600">© OpenStreetMap contributors</p>
          </footer>
        </section>

        {/* ==================== MAIN CONTENT ==================== */}
        <section id="analytics-console" className="flex-grow flex flex-col min-h-0 bg-[#05070A] relative">

          {/* Impact Cards (routing tab only) */}
          {optimizationData && activeTab === 'routing' && (
            <div id="impact-cards-deck" className="bg-[#0B0F19]/80 backdrop-blur-xl p-4 border-b border-indigo-500/10 grid grid-cols-2 md:grid-cols-5 gap-3 relative z-20">
              {[
                { icon: TrendingDown, color: 'emerald', label: 'Fuel Saved', value: `${optimizationData.metrics?.fuelSavedLiters} L`, badge: `-${optimizationData.metrics?.fuelSavingsPercent}%` },
                { icon: Wind, color: 'teal', label: 'CO₂ Avoided', value: `${optimizationData.metrics?.co2ReducedKg} kg`, badge: `-${optimizationData.metrics?.co2SavingsPercent}%` },
                { icon: Leaf, color: 'green', label: 'Trees Equiv.', value: `${optimizationData.metrics?.equivalentTreesPlanted}`, badge: 'Equiv.' },
                { icon: Activity, color: 'indigo', label: 'Eco Priority', value: '92% Optimal', badge: 'Traffic' },
                { icon: Navigation, color: 'violet', label: 'Routing', value: optimizationData.orsRouting ? 'Real Roads' : 'Simulated', badge: optimizationData.orsRouting ? '🛣️ ORS' : '📐 Arc' },
              ].map((card, i) => (
                <div key={i} className={`bg-slate-900/40 border border-${card.color}-500/20 rounded-2xl p-3 hover:border-${card.color}-400/40 transition-all`}>
                  <div className="flex justify-between items-start">
                    <card.icon className={`w-4 h-4 text-${card.color}-400`} />
                    <span className={`text-[9px] text-${card.color}-400 font-bold bg-${card.color}-950/50 px-1.5 py-0.5 rounded border border-${card.color}-500/10`}>{card.badge}</span>
                  </div>
                  <p className="text-[9px] text-slate-400 uppercase font-medium mt-2">{card.label}</p>
                  <p className="text-sm font-bold text-white mt-0.5">{card.value}</p>
                </div>
              ))}
            </div>
          )}

          {/* Analytics Dashboard (full panel) */}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard history={history} onClearHistory={clearHistory} />
          )}

          {/* Fleet Simulator (full panel) */}
          {activeTab === 'simulator' && (
            <FleetSimulator cityName={cityConfig.name} fleet={cityConfig.fleet} />
          )}

          {/* Map (routing + fleet tabs) */}
          {showMap && (
            <div id="operator-map-container" className="flex-grow relative h-96 lg:h-auto min-h-[350px]">
              <MapContainer center={cityConfig.center} zoom={cityConfig.defaultZoom}
                style={{ width: '100%', height: '100%' }} zoomControl={true} key={selectedCityId}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapBoundsFitter optimizationData={optimizationData} cityCenter={cityConfig.center} />

                {/* Standard Route Polyline (red) */}
                {activeTab === 'routing' && standardPath.length > 0 && (
                  <Polyline positions={standardPath}
                    pathOptions={{ color: '#f43f5e', weight: 6, opacity: 0.7, lineCap: 'round', lineJoin: 'round', dashArray: '10 6' }} />
                )}

                {/* Eco Route Polyline (green) */}
                {activeTab === 'routing' && ecoPath.length > 0 && (
                  <Polyline positions={ecoPath}
                    pathOptions={{ color: '#10b981', weight: 7, opacity: 0.9, lineCap: 'round', lineJoin: 'round' }} />
                )}

                {/* Origin & Destination Markers */}
                {activeTab === 'routing' && standardPath.length > 0 && (
                  <>
                    <Marker position={standardPath[0]} icon={makeLabelIcon('A', '#E11D48')}>
                      <Popup><div className="font-sans text-xs font-semibold text-slate-800">Origin: {originText}</div></Popup>
                    </Marker>
                    <Marker position={standardPath[standardPath.length - 1]} icon={makeLabelIcon('B', '#059669')}>
                      <Popup><div className="font-sans text-xs font-semibold text-slate-800">Destination: {destText}</div></Popup>
                    </Marker>
                  </>
                )}

                {/* Fleet Bus Markers */}
                {fleetBuses.map(bus => (
                  <Marker key={bus.id} position={[bus.lat, bus.lng]}
                    icon={makeCircleIcon(bus.ecoMode ? '#10b981' : '#f43f5e')}
                    eventHandlers={{ click: () => { setSelectedBus(bus); setActiveTab('fleet'); } }}>
                    <Popup>
                      <div className="p-1 text-slate-800 min-w-[180px] text-xs font-sans">
                        <div className="flex justify-between items-center border-b border-slate-200 pb-1.5 mb-2">
                          <h4 className="font-bold text-sm">🚌 {bus.id}</h4>
                          <span className={`text-[9px] px-1.5 rounded font-mono ${bus.ecoMode ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {bus.ecoMode ? 'Eco' : 'Standard'}
                          </span>
                        </div>
                        <div className="space-y-1 text-slate-600">
                          <p><strong>Line:</strong> {bus.line}</p>
                          <p><strong>Speed:</strong> {bus.speed}</p>
                          <p><strong>Delay:</strong> {bus.delay}</p>
                          <p><strong>Passengers:</strong> {bus.passengers}/70</p>
                          <p className="border-t pt-1 mt-1 text-[10px]">
                            <strong>Saved:</strong> <span className="text-green-600 font-bold">{bus.metrics.litersSaved} L</span>
                          </p>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Congestion Report Markers */}
                {congestionReports.map(report => (
                  <Marker key={report.id} position={[report.lat, report.lng]}
                    icon={makeCongestionIcon(report.severity)}>
                    <Popup>
                      <div className="p-1 text-slate-800 text-xs font-sans min-w-[140px]">
                        <p className="font-bold text-sm">⚠️ {report.type.replace(/_/g, ' ').toUpperCase()}</p>
                        <p className="text-slate-500">Severity: {report.severity}/5</p>
                        {report.note && <p className="text-slate-600 mt-1 italic">{report.note}</p>}
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(report.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              {/* Map Legend */}
              <div id="map-control-overlay" className="absolute bottom-6 left-6 bg-[#0B0F19]/85 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-3 shadow-lg z-[1000] text-xs space-y-1.5 max-w-[200px]">
                <div className="font-semibold text-white text-[11px] mb-1">Legend</div>
                <div className="flex items-center space-x-2"><div className="w-5 h-1.5 rounded-full bg-[#10b981]"></div><span className="text-[10px] text-slate-300">Eco Route</span></div>
                <div className="flex items-center space-x-2"><div className="w-5 h-1.5 rounded-full bg-[#f43f5e]" style={{ borderBottom: '1px dashed white' }}></div><span className="text-[10px] text-slate-300">Standard Route</span></div>
                <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span className="text-[10px] text-slate-300">Eco Bus</span></div>
                <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span className="text-[10px] text-slate-300">Standard Bus</span></div>
                <div className="flex items-center space-x-2"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span className="text-[10px] text-slate-300">Congestion Report</span></div>
              </div>

              {/* Route Comparison Card */}
              {optimizationData && activeTab === 'routing' && standardPath.length > 2 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#0B0F19]/90 backdrop-blur-xl border border-indigo-500/25 rounded-2xl shadow-xl z-[1000] overflow-hidden" style={{ minWidth: '380px' }}>
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/80 bg-gradient-to-r from-cyan-900/20 to-rose-900/20">
                    <div className="flex items-center gap-2">
                      <Leaf className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-[11px] font-bold text-white">Eco Route Saves You</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">vs Fastest</span>
                  </div>
                  <div className="grid grid-cols-3 divide-x divide-slate-800/60">
                    {[
                      { icon: Wind, color: 'emerald', value: `-${optimizationData.metrics?.co2SavingsPercent ?? 0}%`, label: 'Less CO₂', sub: `${optimizationData.metrics?.co2ReducedKg ?? 0} kg` },
                      { icon: TrendingDown, color: 'violet', value: `-${optimizationData.metrics?.fuelSavingsPercent ?? 0}%`, label: 'Less Fuel', sub: `${optimizationData.metrics?.fuelSavedLiters ?? 0} L` },
                      { icon: Activity, color: 'amber', value: `-${optimizationData.metrics?.congestionSavingsPercent ?? 78}%`, label: 'Congestion', sub: 'smoother flow' },
                    ].map((m, i) => (
                      <div key={i} className={`px-3 py-2.5 flex flex-col items-center gap-0.5 hover:bg-${m.color}-900/10 transition-colors`}>
                        <m.icon className={`w-3.5 h-3.5 text-${m.color}-400 mb-0.5`} />
                        <p className={`text-[18px] font-black text-${m.color}-400 leading-none`}>{m.value}</p>
                        <p className="text-[9px] text-slate-400 font-medium uppercase tracking-wider">{m.label}</p>
                        <p className={`text-[10px] text-${m.color}-300 font-mono font-semibold`}>{m.sub}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights Popover */}
              {optimizationData && activeTab === 'routing' && (
                <div className="absolute top-4 right-4 max-w-xs bg-[#0B0F19]/85 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-4 shadow-lg z-[1000] text-xs space-y-3 max-h-[360px] overflow-y-auto">
                  <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    <span className="font-bold text-white text-xs">AI Insights</span>
                  </div>
                  <p className="text-slate-300 leading-relaxed font-semibold text-[11px]">{optimizationData.summary}</p>
                  <p className="text-slate-400 italic text-[10px]">{optimizationData.weatherImpact}</p>
                  <div className="space-y-1.5 pt-2 border-t border-slate-800">
                    {optimizationData.insights?.map((ins: string, idx: number) => (
                      <div key={idx} className="flex items-start text-[11px] text-slate-300">
                        <span className="text-emerald-400 mr-1.5">•</span>
                        <span>{ins}</span>
                      </div>
                    ))}
                  </div>
                  {optimizationData.fallbackWarning && (
                    <div className="bg-amber-950/30 border border-amber-500/15 rounded-lg p-2 text-[10px] text-amber-300 flex items-center space-x-1.5">
                      <Info className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>{optimizationData.fallbackWarning}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Congestion Reporter FAB */}
              <CongestionReporter
                reports={congestionReports}
                onSubmitReport={submitCongestion}
                mapCenter={cityConfig.center}
              />
            </div>
          )}

          {/* Route Comparison Table */}
          {optimizationData && activeTab === 'routing' && (
            <div className="bg-[#0B0F19]/90 backdrop-blur-md border-t border-indigo-500/20 p-4 overflow-x-auto relative z-20">
              <table className="w-full text-left text-xs min-w-[600px]">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80">
                    <th className="pb-2 text-[10px] uppercase font-bold">Route</th>
                    <th className="pb-2 text-[10px] uppercase font-bold">Distance</th>
                    <th className="pb-2 text-[10px] uppercase font-bold">Duration</th>
                    <th className="pb-2 text-[10px] uppercase font-bold">Fuel</th>
                    <th className="pb-2 text-[10px] uppercase font-bold">CO₂</th>
                    <th className="pb-2 text-[10px] uppercase font-bold">Congestion</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  <tr className="hover:bg-slate-800/20">
                    <td className="py-2 font-bold text-rose-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-2"></span>{optimizationData.standardRoute?.name}</td>
                    <td className="py-2 font-mono">{optimizationData.standardRoute?.distanceKm} km</td>
                    <td className="py-2 font-mono">{optimizationData.standardRoute?.durationMinutes} min</td>
                    <td className="py-2 font-mono">{optimizationData.standardRoute?.estFuelLiters} L</td>
                    <td className="py-2 font-mono text-rose-300">{optimizationData.standardRoute?.estCO2Kg} kg</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded bg-rose-950/40 text-rose-300 border border-rose-500/10 font-bold text-[10px]">{optimizationData.standardRoute?.congestionScore}/10</span></td>
                  </tr>
                  <tr className="hover:bg-slate-800/20">
                    <td className="py-2 font-bold text-emerald-400 flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2"></span>{optimizationData.ecoRoute?.name}</td>
                    <td className="py-2 font-mono">{optimizationData.ecoRoute?.distanceKm} km</td>
                    <td className="py-2 font-mono text-emerald-200">{optimizationData.ecoRoute?.durationMinutes} min</td>
                    <td className="py-2 font-mono text-emerald-400 font-bold">{optimizationData.ecoRoute?.estFuelLiters} L</td>
                    <td className="py-2 font-mono text-emerald-400 font-bold">{optimizationData.ecoRoute?.estCO2Kg} kg</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-500/10 font-bold text-[10px]">{optimizationData.ecoRoute?.congestionScore}/10</span></td>
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
