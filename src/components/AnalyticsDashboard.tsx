import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import { TrendingDown, Wind, Leaf, Activity, Trash2, BarChart3 } from 'lucide-react';

interface HistoryEntry {
  timestamp: string;
  origin: string;
  destination: string;
  city: string;
  metrics: {
    fuelSavedLiters: number;
    co2ReducedKg: number;
    equivalentTreesPlanted: number;
    fuelSavingsPercent: number;
    co2SavingsPercent: number;
  };
  standardRoute?: { distanceKm: number; durationMinutes: number };
  ecoRoute?: { distanceKm: number; durationMinutes: number };
}

interface Props {
  history: HistoryEntry[];
  onClearHistory: () => void;
}

export default function AnalyticsDashboard({ history, onClearHistory }: Props) {
  // Compute cumulative metrics
  const totalRuns = history.length;
  const totalCO2 = history.reduce((s, h) => s + (h.metrics?.co2ReducedKg || 0), 0);
  const totalFuel = history.reduce((s, h) => s + (h.metrics?.fuelSavedLiters || 0), 0);
  const totalTrees = history.reduce((s, h) => s + (h.metrics?.equivalentTreesPlanted || 0), 0);
  const avgSavingsPct = totalRuns > 0
    ? Math.round(history.reduce((s, h) => s + (h.metrics?.co2SavingsPercent || 0), 0) / totalRuns)
    : 0;

  // Chart data — cumulative CO2 over time
  const cumulativeData = history.map((h, i) => {
    const cumCO2 = history.slice(0, i + 1).reduce((s, x) => s + (x.metrics?.co2ReducedKg || 0), 0);
    const cumFuel = history.slice(0, i + 1).reduce((s, x) => s + (x.metrics?.fuelSavedLiters || 0), 0);
    const time = new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return { name: time, co2: parseFloat(cumCO2.toFixed(2)), fuel: parseFloat(cumFuel.toFixed(2)), run: i + 1 };
  });

  // Bar chart data — per-run savings
  const perRunData = history.slice(-10).map((h, i) => ({
    name: `Run ${history.length - 9 + i > 0 ? history.length - 9 + i : i + 1}`,
    co2: h.metrics?.co2ReducedKg || 0,
    fuel: h.metrics?.fuelSavedLiters || 0,
    route: `${h.origin?.slice(0, 12)}→${h.destination?.slice(0, 12)}`,
  }));

  const customTooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '12px',
    padding: '8px 12px',
    fontSize: '11px',
    color: '#e2e8f0',
  };

  if (totalRuns === 0) {
    return (
      <div className="flex-grow flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <BarChart3 className="w-16 h-16 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-300">No Optimization Data Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm">
            Run your first route optimization to start building analytics. Each run adds to your
            cumulative environmental impact tracking.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-[#05070A]">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-slate-900/50 border border-indigo-500/20 rounded-2xl p-4 hover:border-indigo-400/40 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Runs</span>
          </div>
          <p className="text-2xl font-black text-white">{totalRuns}</p>
        </div>
        <div className="bg-slate-900/50 border border-emerald-500/20 rounded-2xl p-4 hover:border-emerald-400/40 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Wind className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">CO₂ Avoided</span>
          </div>
          <p className="text-2xl font-black text-emerald-400">{totalCO2.toFixed(1)} <span className="text-xs font-normal text-slate-500">kg</span></p>
        </div>
        <div className="bg-slate-900/50 border border-violet-500/20 rounded-2xl p-4 hover:border-violet-400/40 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-violet-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Fuel Saved</span>
          </div>
          <p className="text-2xl font-black text-violet-400">{totalFuel.toFixed(1)} <span className="text-xs font-normal text-slate-500">L</span></p>
        </div>
        <div className="bg-slate-900/50 border border-green-500/20 rounded-2xl p-4 hover:border-green-400/40 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <Leaf className="w-4 h-4 text-green-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Trees Equiv.</span>
          </div>
          <p className="text-2xl font-black text-green-400">{totalTrees.toFixed(1)}</p>
        </div>
        <div className="bg-slate-900/50 border border-amber-500/20 rounded-2xl p-4 hover:border-amber-400/40 transition-all">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-amber-400" />
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Avg Savings</span>
          </div>
          <p className="text-2xl font-black text-amber-400">{avgSavingsPct}%</p>
        </div>
      </div>

      {/* Cumulative CO2 + Fuel Area Chart */}
      <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Cumulative Environmental Impact</h3>
            <p className="text-[10px] text-slate-500 mt-0.5">CO₂ and fuel savings accumulate across optimization runs</p>
          </div>
          <button
            onClick={onClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-rose-400 bg-rose-950/30 border border-rose-500/20 rounded-lg hover:bg-rose-950/50 transition-all"
          >
            <Trash2 className="w-3 h-3" />
            Clear History
          </button>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={cumulativeData}>
            <defs>
              <linearGradient id="gradCO2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradFuel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <Tooltip contentStyle={customTooltipStyle} />
            <Area type="monotone" dataKey="co2" name="CO₂ Saved (kg)" stroke="#10b981" fill="url(#gradCO2)" strokeWidth={2} />
            <Area type="monotone" dataKey="fuel" name="Fuel Saved (L)" stroke="#8b5cf6" fill="url(#gradFuel)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Run Bar Chart */}
      <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-1">Per-Run Savings (Last 10)</h3>
        <p className="text-[10px] text-slate-500 mb-4">CO₂ and fuel reduction for each optimization run</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={perRunData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <Tooltip contentStyle={customTooltipStyle} />
            <Bar dataKey="co2" name="CO₂ (kg)" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="fuel" name="Fuel (L)" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Recent Runs Table */}
      <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Optimization Log</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[500px]">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="pb-2 text-left font-bold uppercase text-[10px]">Time</th>
                <th className="pb-2 text-left font-bold uppercase text-[10px]">Route</th>
                <th className="pb-2 text-left font-bold uppercase text-[10px]">City</th>
                <th className="pb-2 text-right font-bold uppercase text-[10px]">CO₂ Saved</th>
                <th className="pb-2 text-right font-bold uppercase text-[10px]">Fuel Saved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {[...history].reverse().slice(0, 15).map((h, i) => (
                <tr key={i} className="hover:bg-slate-800/20">
                  <td className="py-2 text-slate-400 font-mono">
                    {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-2 text-slate-200 truncate max-w-[180px]">
                    {h.origin?.slice(0, 15)} → {h.destination?.slice(0, 15)}
                  </td>
                  <td className="py-2 text-slate-400">{h.city || 'Bengaluru'}</td>
                  <td className="py-2 text-right text-emerald-400 font-mono font-semibold">
                    {h.metrics?.co2ReducedKg?.toFixed(1)} kg
                  </td>
                  <td className="py-2 text-right text-violet-400 font-mono font-semibold">
                    {h.metrics?.fuelSavedLiters?.toFixed(1)} L
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
