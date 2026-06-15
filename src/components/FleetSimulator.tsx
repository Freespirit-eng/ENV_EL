import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { Leaf, TrendingDown, Wind, Zap, Users, Gauge } from 'lucide-react';
import type { CityFleetProfile } from '../cityConfig';

interface Props {
  cityName: string;
  fleet: CityFleetProfile;
}

// Emission factors
const DIESEL_CO2_PER_KM = 1.35;    // kg CO2/km for diesel bus
const CNG_CO2_PER_KM = 0.95;       // kg CO2/km for CNG bus
const HYBRID_CO2_PER_KM = 0.65;    // kg CO2/km for hybrid bus
const ELECTRIC_CO2_PER_KM = 0.05;  // kg CO2/km for electric (grid factor)

const DIESEL_FUEL_PER_KM = 0.45;   // L/km
const CNG_FUEL_PER_KM = 0.35;      // kg/km (CNG equivalent)
const HYBRID_FUEL_PER_KM = 0.22;   // L/km
const ELECTRIC_FUEL_PER_KM = 0.0;  // No liquid fuel

const FUEL_COST_PER_LITER = 100;   // ₹ per liter diesel
const CNG_COST_PER_KG = 75;        // ₹ per kg CNG
const ELECTRIC_COST_PER_KWH = 8;   // ₹ per kWh
const ELECTRIC_KWH_PER_KM = 1.2;   // kWh/km for e-bus

const ECO_ROUTE_FUEL_REDUCTION = 0.28; // 28% fuel saving on eco routes

export default function FleetSimulator({ cityName, fleet }: Props) {
  const [electricPct, setElectricPct] = useState(fleet.electricPercent);
  const [ecoRoutePct, setEcoRoutePct] = useState(30);
  const [totalFleet, setTotalFleet] = useState(fleet.totalFleetSize);
  const [avgDailyKm, setAvgDailyKm] = useState(fleet.avgDailyKmPerBus);

  // Calculate current scenario (baseline)
  const currentDieselBuses = Math.round(totalFleet * fleet.dieselPercent / 100);
  const currentCNGBuses = Math.round(totalFleet * fleet.cngPercent / 100);
  const currentHybridBuses = Math.round(totalFleet * fleet.hybridPercent / 100);
  const currentElectricBuses = Math.round(totalFleet * fleet.electricPercent / 100);

  const currentDailyCO2 =
    currentDieselBuses * avgDailyKm * DIESEL_CO2_PER_KM +
    currentCNGBuses * avgDailyKm * CNG_CO2_PER_KM +
    currentHybridBuses * avgDailyKm * HYBRID_CO2_PER_KM +
    currentElectricBuses * avgDailyKm * ELECTRIC_CO2_PER_KM;

  const currentDailyFuelCost =
    currentDieselBuses * avgDailyKm * DIESEL_FUEL_PER_KM * FUEL_COST_PER_LITER +
    currentCNGBuses * avgDailyKm * CNG_FUEL_PER_KM * CNG_COST_PER_KG +
    currentHybridBuses * avgDailyKm * HYBRID_FUEL_PER_KM * FUEL_COST_PER_LITER +
    currentElectricBuses * avgDailyKm * ELECTRIC_KWH_PER_KM * ELECTRIC_COST_PER_KWH;

  // Calculate projected scenario
  const remainingPctAfterElectric = 100 - electricPct;
  const scale = remainingPctAfterElectric / (100 - fleet.electricPercent || 1);

  const projDieselBuses = Math.round(totalFleet * fleet.dieselPercent / 100 * scale);
  const projCNGBuses = Math.round(totalFleet * fleet.cngPercent / 100 * scale);
  const projHybridBuses = Math.round(totalFleet * fleet.hybridPercent / 100 * scale);
  const projElectricBuses = Math.round(totalFleet * electricPct / 100);

  const ecoFactor = 1 - (ecoRoutePct / 100) * ECO_ROUTE_FUEL_REDUCTION;

  const projDailyCO2 = (
    projDieselBuses * avgDailyKm * DIESEL_CO2_PER_KM +
    projCNGBuses * avgDailyKm * CNG_CO2_PER_KM +
    projHybridBuses * avgDailyKm * HYBRID_CO2_PER_KM +
    projElectricBuses * avgDailyKm * ELECTRIC_CO2_PER_KM
  ) * ecoFactor;

  const projDailyFuelCost = (
    projDieselBuses * avgDailyKm * DIESEL_FUEL_PER_KM * FUEL_COST_PER_LITER +
    projCNGBuses * avgDailyKm * CNG_FUEL_PER_KM * CNG_COST_PER_KG +
    projHybridBuses * avgDailyKm * HYBRID_FUEL_PER_KM * FUEL_COST_PER_LITER +
    projElectricBuses * avgDailyKm * ELECTRIC_KWH_PER_KM * ELECTRIC_COST_PER_KWH
  ) * ecoFactor;

  const annualCO2Saved = (currentDailyCO2 - projDailyCO2) * 365 / 1000; // tons
  const annualFuelCostSaved = (currentDailyFuelCost - projDailyFuelCost) * 365;
  const annualTreesEquiv = annualCO2Saved * 1000 * 0.15; // trees
  const co2ReductionPct = currentDailyCO2 > 0 ? Math.round(((currentDailyCO2 - projDailyCO2) / currentDailyCO2) * 100) : 0;

  // SDG Impact Score (0-100 composite)
  const sdgScore = Math.min(100, Math.round(
    (electricPct * 0.4) + (ecoRoutePct * 0.3) + (co2ReductionPct * 0.3)
  ));

  const comparisonData = [
    { name: 'CO₂ (tons/yr)', current: Math.round(currentDailyCO2 * 365 / 1000), projected: Math.round(projDailyCO2 * 365 / 1000) },
    { name: 'Fuel Cost (₹L/yr)', current: Math.round(currentDailyFuelCost * 365 / 100000), projected: Math.round(projDailyFuelCost * 365 / 100000) },
  ];

  const tooltipStyle = {
    backgroundColor: '#0f172a',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: '12px',
    padding: '8px 12px',
    fontSize: '11px',
    color: '#e2e8f0',
  };

  return (
    <div className="flex-grow overflow-y-auto p-6 space-y-6 bg-[#05070A]">
      {/* Title */}
      <div className="flex items-center gap-3">
        <div className="bg-violet-500/10 p-2 rounded-xl border border-violet-500/20">
          <Zap className="w-5 h-5 text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-white">Fleet Scenario Simulator</h2>
          <p className="text-[10px] text-slate-500">What-if analysis for {cityName} fleet electrification impact</p>
        </div>
      </div>

      {/* Sliders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Fleet Electrification</label>
            <span className="text-sm font-bold text-emerald-400">{electricPct}%</span>
          </div>
          <input type="range" min="0" max="100" value={electricPct} onChange={e => setElectricPct(Number(e.target.value))}
            className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0% — All fossil</span>
            <span>Current: {fleet.electricPercent}%</span>
            <span>100% — Full EV</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Eco-Route Adoption</label>
            <span className="text-sm font-bold text-violet-400">{ecoRoutePct}%</span>
          </div>
          <input type="range" min="0" max="100" value={ecoRoutePct} onChange={e => setEcoRoutePct(Number(e.target.value))}
            className="w-full accent-violet-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
          <div className="flex justify-between text-[9px] text-slate-500">
            <span>0% — No eco routes</span>
            <span>50% — Mixed</span>
            <span>100% — All eco</span>
          </div>
        </div>

        <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Fleet Size</label>
            <span className="text-sm font-bold text-teal-400">{totalFleet.toLocaleString()}</span>
          </div>
          <input type="range" min="500" max="15000" step="100" value={totalFleet} onChange={e => setTotalFleet(Number(e.target.value))}
            className="w-full accent-teal-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
        </div>

        <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Daily km/Bus</label>
            <span className="text-sm font-bold text-amber-400">{avgDailyKm} km</span>
          </div>
          <input type="range" min="50" max="400" step="10" value={avgDailyKm} onChange={e => setAvgDailyKm(Number(e.target.value))}
            className="w-full accent-amber-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer" />
        </div>
      </div>

      {/* Impact Projection Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-emerald-950/40 to-emerald-900/10 border border-emerald-500/25 rounded-2xl p-4">
          <Wind className="w-5 h-5 text-emerald-400 mb-2" />
          <p className="text-[10px] text-emerald-300 uppercase font-bold tracking-wider">Annual CO₂ Reduction</p>
          <p className="text-xl font-black text-white mt-1">
            {annualCO2Saved > 0 ? annualCO2Saved.toFixed(0) : '0'} <span className="text-xs font-normal text-emerald-400">tons</span>
          </p>
          <p className="text-[10px] text-emerald-400 mt-0.5">-{co2ReductionPct}% vs current</p>
        </div>

        <div className="bg-gradient-to-br from-violet-950/40 to-violet-900/10 border border-violet-500/25 rounded-2xl p-4">
          <TrendingDown className="w-5 h-5 text-violet-400 mb-2" />
          <p className="text-[10px] text-violet-300 uppercase font-bold tracking-wider">Annual Cost Saved</p>
          <p className="text-xl font-black text-white mt-1">
            ₹{(annualFuelCostSaved / 10000000).toFixed(1)} <span className="text-xs font-normal text-violet-400">Cr</span>
          </p>
        </div>

        <div className="bg-gradient-to-br from-green-950/40 to-green-900/10 border border-green-500/25 rounded-2xl p-4">
          <Leaf className="w-5 h-5 text-green-400 mb-2" />
          <p className="text-[10px] text-green-300 uppercase font-bold tracking-wider">Equiv. Trees/Year</p>
          <p className="text-xl font-black text-white mt-1">
            {annualTreesEquiv > 1000 ? `${(annualTreesEquiv / 1000).toFixed(1)}K` : annualTreesEquiv.toFixed(0)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-indigo-950/40 to-indigo-900/10 border border-indigo-500/25 rounded-2xl p-4">
          <Gauge className="w-5 h-5 text-indigo-400 mb-2" />
          <p className="text-[10px] text-indigo-300 uppercase font-bold tracking-wider">SDG Impact Score</p>
          <p className="text-xl font-black text-white mt-1">
            {sdgScore}<span className="text-xs font-normal text-indigo-400">/100</span>
          </p>
          <div className="w-full bg-slate-800 rounded-full h-1.5 mt-2">
            <div className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500"
              style={{ width: `${sdgScore}%` }} />
          </div>
        </div>
      </div>

      {/* Comparison Chart */}
      <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-1">Current vs Projected Annual Impact</h3>
        <p className="text-[10px] text-slate-500 mb-4">Side-by-side comparison of environmental footprint</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={comparisonData} barGap={8}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={{ stroke: '#334155' }} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="current" name="Current" radius={[4, 4, 0, 0]}>
              {comparisonData.map((_, i) => <Cell key={i} fill="#f43f5e" />)}
            </Bar>
            <Bar dataKey="projected" name="Projected" radius={[4, 4, 0, 0]}>
              {comparisonData.map((_, i) => <Cell key={i} fill="#10b981" />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="flex justify-center gap-6 mt-2 text-[10px]">
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#f43f5e]" /> <span className="text-slate-400">Current Fleet</span></div>
          <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded bg-[#10b981]" /> <span className="text-slate-400">Projected Scenario</span></div>
        </div>
      </div>

      {/* Fleet Breakdown Table */}
      <div className="bg-slate-900/40 border border-indigo-500/15 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-3">Fleet Composition Breakdown</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-800">
              <th className="pb-2 text-left text-[10px] uppercase font-bold">Type</th>
              <th className="pb-2 text-right text-[10px] uppercase font-bold">Current</th>
              <th className="pb-2 text-right text-[10px] uppercase font-bold">Projected</th>
              <th className="pb-2 text-right text-[10px] uppercase font-bold">Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {[
              { type: '⚡ Electric', current: currentElectricBuses, projected: projElectricBuses, color: 'text-emerald-400' },
              { type: '💨 CNG', current: currentCNGBuses, projected: projCNGBuses, color: 'text-teal-400' },
              { type: '🔋 Hybrid', current: currentHybridBuses, projected: projHybridBuses, color: 'text-violet-400' },
              { type: '⛽ Diesel', current: currentDieselBuses, projected: projDieselBuses, color: 'text-rose-400' },
            ].map(row => (
              <tr key={row.type} className="hover:bg-slate-800/20">
                <td className="py-2 font-medium text-slate-200">{row.type}</td>
                <td className="py-2 text-right font-mono text-slate-400">{row.current.toLocaleString()}</td>
                <td className={`py-2 text-right font-mono font-semibold ${row.color}`}>{row.projected.toLocaleString()}</td>
                <td className={`py-2 text-right font-mono text-[10px] ${row.projected - row.current >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {row.projected - row.current >= 0 ? '+' : ''}{(row.projected - row.current).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
