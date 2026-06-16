import express from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || '';
const hasGeminiKey = Boolean(apiKey) && apiKey !== 'MY_GEMINI_API_KEY' && apiKey !== 'your_gemini_api_key_here' && apiKey !== 'YOUR_GEMINI_API_KEY_HERE';

const ai = hasGeminiKey
  ? new GoogleGenAI({
    apiKey,
    httpOptions: {
      timeout: 120000,
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  })
  : null;

// -----------------------------------------------------------------------
// In-memory stores
// -----------------------------------------------------------------------
const optimizationHistory: any[] = [];
const congestionReports: any[] = [];
const geocodeCache = new Map<string, { lat: number; lng: number; ts: number }>();
const weatherCache = new Map<string, { data: any; ts: number }>();
const GEOCODE_CACHE_TTL = 3600000; // 1 hour
const WEATHER_CACHE_TTL = 600000; // 10 minutes

// -----------------------------------------------------------------------
// Multi-City fleet configurations (server-side)
// -----------------------------------------------------------------------
const cityBusData: Record<string, any[]> = {
  bengaluru: [
    { id: 'E-BUS-204', line: 'Line 2A', origin: 'Silk Board', destination: 'Hebbal', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 42, fuelRate: '0.24 kW/km', co2Rate: '0.00 kg/km', speed: '38 km/h', delay: '+1 min', lat: 12.9349, lng: 77.6181, heading: 345, metrics: { litersSaved: 14.5, co2Reduced: 38.3 } },
    { id: 'DSL-BUS-802', line: 'Line 4C', origin: 'Kengeri', destination: 'Majestic', status: 'IDLE_TRAP', ecoMode: false, passengers: 58, fuelRate: '0.58 L/km', co2Rate: '1.53 kg/km', speed: '8 km/h', delay: '+16 mins', lat: 12.9512, lng: 77.5401, heading: 68, metrics: { litersSaved: -2.3, co2Reduced: -6.1 } },
    { id: 'HYB-BUS-411', line: 'Line 9E', origin: 'Whitefield', destination: 'Banashankari', status: 'GREEN_PATH', ecoMode: true, passengers: 31, fuelRate: '0.28 L/km', co2Rate: '0.74 kg/km', speed: '42 km/h', delay: 'On Time', lat: 12.9382, lng: 77.6914, heading: 220, metrics: { litersSaved: 18.2, co2Reduced: 48.0 } },
    { id: 'DSL-BUS-105', line: 'Line 12F', origin: 'Electronic City', destination: 'ITPL', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 67, fuelRate: '0.64 L/km', co2Rate: '1.69 kg/km', speed: '11 km/h', delay: '+11 mins', lat: 12.9111, lng: 77.6802, heading: 10, metrics: { litersSaved: 4.8, co2Reduced: 12.6 } },
  ],
  delhi: [
    { id: 'E-BUS-DTC-01', line: 'Route 534', origin: 'Connaught Place', destination: 'Nehru Place', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 55, fuelRate: '0.22 kW/km', co2Rate: '0.00 kg/km', speed: '32 km/h', delay: '+2 mins', lat: 28.6315, lng: 77.2167, heading: 180, metrics: { litersSaved: 16.2, co2Reduced: 42.8 } },
    { id: 'CNG-BUS-DTC-14', line: 'Route 764', origin: 'ISBT Kashmere Gate', destination: 'Mehrauli', status: 'GREEN_PATH', ecoMode: true, passengers: 48, fuelRate: '0.35 kg/km', co2Rate: '0.96 kg/km', speed: '28 km/h', delay: 'On Time', lat: 28.6553, lng: 77.2271, heading: 210, metrics: { litersSaved: 12.1, co2Reduced: 31.9 } },
    { id: 'DSL-BUS-DTC-72', line: 'Route 181', origin: 'Dwarka', destination: 'Old Delhi', status: 'IDLE_TRAP', ecoMode: false, passengers: 72, fuelRate: '0.62 L/km', co2Rate: '1.63 kg/km', speed: '6 km/h', delay: '+22 mins', lat: 28.5635, lng: 77.0583, heading: 45, metrics: { litersSaved: -4.1, co2Reduced: -10.8 } },
    { id: 'HYB-BUS-DTC-33', line: 'Route 423', origin: 'Noida', destination: 'Lajpat Nagar', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 63, fuelRate: '0.44 L/km', co2Rate: '1.16 kg/km', speed: '14 km/h', delay: '+9 mins', lat: 28.5706, lng: 77.3211, heading: 300, metrics: { litersSaved: 5.5, co2Reduced: 14.5 } },
  ],
  mumbai: [
    { id: 'E-BUS-BEST-01', line: 'A-31', origin: 'Dadar', destination: 'Andheri', status: 'GREEN_PATH', ecoMode: true, passengers: 45, fuelRate: '0.26 kW/km', co2Rate: '0.00 kg/km', speed: '22 km/h', delay: '+3 mins', lat: 19.0178, lng: 72.8478, heading: 0, metrics: { litersSaved: 11.2, co2Reduced: 29.6 } },
    { id: 'CNG-BUS-BEST-19', line: 'C-49', origin: 'BKC', destination: 'Worli', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 38, fuelRate: '0.32 kg/km', co2Rate: '0.88 kg/km', speed: '35 km/h', delay: 'On Time', lat: 19.0596, lng: 72.8656, heading: 250, metrics: { litersSaved: 13.4, co2Reduced: 35.4 } },
    { id: 'DSL-BUS-BEST-55', line: 'D-12', origin: 'Thane', destination: 'Mulund', status: 'IDLE_TRAP', ecoMode: false, passengers: 65, fuelRate: '0.59 L/km', co2Rate: '1.56 kg/km', speed: '7 km/h', delay: '+18 mins', lat: 19.1863, lng: 72.9756, heading: 180, metrics: { litersSaved: -3.5, co2Reduced: -9.2 } },
    { id: 'HYB-BUS-BEST-40', line: 'H-8', origin: 'Borivali', destination: 'Churchgate', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 70, fuelRate: '0.48 L/km', co2Rate: '1.27 kg/km', speed: '12 km/h', delay: '+14 mins', lat: 19.2307, lng: 72.8567, heading: 180, metrics: { litersSaved: 6.3, co2Reduced: 16.6 } },
  ],
  chennai: [
    { id: 'E-BUS-MTC-01', line: 'Route 21G', origin: 'T. Nagar', destination: 'Anna Nagar', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 40, fuelRate: '0.25 kW/km', co2Rate: '0.00 kg/km', speed: '30 km/h', delay: '+2 mins', lat: 13.0418, lng: 80.2341, heading: 0, metrics: { litersSaved: 10.8, co2Reduced: 28.5 } },
    { id: 'DSL-BUS-MTC-38', line: 'Route 15B', origin: 'Central', destination: 'Tambaram', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 60, fuelRate: '0.56 L/km', co2Rate: '1.48 kg/km', speed: '15 km/h', delay: '+8 mins', lat: 13.0836, lng: 80.2752, heading: 180, metrics: { litersSaved: 3.2, co2Reduced: 8.4 } },
    { id: 'HYB-BUS-MTC-22', line: 'Route 119', origin: 'OMR', destination: 'Adyar', status: 'GREEN_PATH', ecoMode: true, passengers: 28, fuelRate: '0.30 L/km', co2Rate: '0.79 kg/km', speed: '38 km/h', delay: 'On Time', lat: 12.9889, lng: 80.2463, heading: 315, metrics: { litersSaved: 15.1, co2Reduced: 39.9 } },
    { id: 'DSL-BUS-MTC-55', line: 'Route 70', origin: 'Guindy', destination: 'Porur', status: 'IDLE_TRAP', ecoMode: false, passengers: 52, fuelRate: '0.61 L/km', co2Rate: '1.61 kg/km', speed: '9 km/h', delay: '+12 mins', lat: 13.0067, lng: 80.2206, heading: 270, metrics: { litersSaved: -1.8, co2Reduced: -4.8 } },
  ],
};

// Simulated coordinate patterns for routes (kept as fallback reference)
const routeCoordinates: Record<string, { lat: number; lng: number }[]> = {
  'Line 2A': [
    { lat: 12.9176, lng: 77.6244 }, { lat: 12.9230, lng: 77.6258 }, { lat: 12.9349, lng: 77.6181 },
    { lat: 12.9591, lng: 77.6402 }, { lat: 12.9716, lng: 77.6436 }, { lat: 13.0035, lng: 77.6247 },
    { lat: 13.0358, lng: 77.5970 },
  ],
};

// -----------------------------------------------------------------------
// ORS Geocoding with cache
// -----------------------------------------------------------------------
async function geocodeWithCache(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.toLowerCase().trim();
  const cached = geocodeCache.get(key);
  if (cached && Date.now() - cached.ts < GEOCODE_CACHE_TTL) {
    return { lat: cached.lat, lng: cached.lng };
  }

  const orsKey = process.env.ORS_API_KEY;
  if (!orsKey || orsKey === 'PASTE_YOUR_ORS_API_KEY_HERE') return null;

  try {
    const res = await fetch(
      `https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(query)}&size=1`
    );
    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      geocodeCache.set(key, { lat, lng, ts: Date.now() });
      return { lat, lng };
    }
  } catch (error) {
    console.error('ORS Geocoding failed:', error);
  }
  return null;
}

// -----------------------------------------------------------------------
// Compute route metrics
// -----------------------------------------------------------------------
function buildRouteMetrics(
  org: string, dest: string,
  weather: string, tempCelsius: number,
  vehicleType: string, congestion: string,
  vehicleWeight: number,
  orsStdSummary: any, orsEcoSummary: any
) {
  const weatherCoeff = weather.toLowerCase().includes('rain') || weather.toLowerCase().includes('monsoon') ? 1.25 : 1.0;
  const acCoeff = tempCelsius > 32 ? 1.15 : (tempCelsius < 15 ? 1.05 : 1.0);

  const weightFactor = vehicleWeight / 1400;
  const carBaseFuel: Record<string, number> = { 'SUV': 0.12, 'Sedan': 0.08, 'Hatchback': 0.06, 'Sports': 0.10 };
  const baseFuelRate = (carBaseFuel[vehicleType] ?? 0.08) * weightFactor;

  const stdDistKm = orsStdSummary ? parseFloat((orsStdSummary.distance / 1000).toFixed(1)) : parseFloat((8.5 + Math.random() * 3).toFixed(1));
  const stdDurMin = orsStdSummary ? Math.round(orsStdSummary.duration / 60) : Math.round(stdDistKm * (congestion === 'Heavy' ? 4.5 : 3.0));
  const ecoDistKm = orsEcoSummary ? parseFloat((orsEcoSummary.distance / 1000).toFixed(1)) : parseFloat((stdDistKm + 1.5).toFixed(1));
  const ecoDurMin = orsEcoSummary ? Math.round(orsEcoSummary.duration / 60) : Math.round(ecoDistKm * 2.2);

  const congMult = congestion === 'Heavy' ? 1.8 : (congestion === 'Moderate' ? 1.3 : 1.0);
  const stdDurAdj = Math.round(stdDurMin * congMult);

  const congFuelMult = congestion === 'Heavy' ? 1.55 : (congestion === 'Moderate' ? 1.25 : 1.0);
  const stdFuel = parseFloat((stdDistKm * baseFuelRate * weatherCoeff * acCoeff * congFuelMult).toFixed(2));
  const ecoFuel = parseFloat((ecoDistKm * baseFuelRate * 0.72 * weatherCoeff).toFixed(2));

  const stdCO2 = parseFloat((stdFuel * 2.31).toFixed(2));
  const ecoCO2 = parseFloat((ecoFuel * 2.31).toFixed(2));
  const fuelSaved = parseFloat((stdFuel - ecoFuel).toFixed(2));
  const co2Reduced = parseFloat((stdCO2 - ecoCO2).toFixed(2));

  const stdCongScore = congestion === 'Heavy' ? 9 : (congestion === 'Moderate' ? 6 : 3);
  const ecoCongScore = 2;
  const congestionSavingsPct = Math.round(((stdCongScore - ecoCongScore) / stdCongScore) * 100);

  return {
    summary: `ORS road routing complete. Your ${vehicleType} (${vehicleWeight} kg) on the fastest corridor (${stdDistKm} km) hits major choke points, while the eco-shortest path (${ecoDistKm} km) avoids motorways and tollways, reducing idle stop-and-go by ~${congestionSavingsPct}%.`,
    weatherImpact: `${weather} at ${tempCelsius}°C adds ${tempCelsius > 30 ? 'high A/C load' : 'moderate thermal load'} — projected +${Math.round((weatherCoeff * acCoeff - 1) * 100)}% fuel overhead on the standard corridor.`,
    standardRoute: {
      name: `${org} → Fastest Arterial`,
      distanceKm: stdDistKm, durationMinutes: stdDurAdj,
      estCO2Kg: stdCO2, estFuelLiters: stdFuel,
      congestionScore: stdCongScore,
      hotspots: ['Silk Board Junction', 'Richmond Road Bottleneck', 'Trinity Metro Choke']
    },
    ecoRoute: {
      name: `${org} → Eco-Shortest Bypass`,
      distanceKm: ecoDistKm, durationMinutes: ecoDurMin,
      estCO2Kg: ecoCO2, estFuelLiters: ecoFuel,
      congestionScore: ecoCongScore,
      bypassDetails: 'Avoids motorways & tollways via ORS shortest-path preference, using lake-road corridors with lower idle-stop frequency.',
      alternativeStops: ['Agara Lake Road', 'Bellandur Ring Road']
    },
    metrics: {
      fuelSavedLiters: fuelSaved > 0 ? fuelSaved : 0.8,
      fuelSavingsPercent: fuelSaved > 0 ? Math.round((fuelSaved / stdFuel) * 100) : 18,
      co2ReducedKg: co2Reduced > 0 ? co2Reduced : 1.8,
      co2SavingsPercent: co2Reduced > 0 ? Math.round((co2Reduced / stdCO2) * 100) : 18,
      congestionSavingsPercent: congestionSavingsPct,
      equivalentTreesPlanted: Math.round((co2Reduced > 0 ? co2Reduced : 1.8) * 0.15 * 10) / 10 || 0.3
    },
    insights: [
      `Maintain 40–50 km/h on secondary roads to avoid the standard route's idle clusters.`,
      `Your ${vehicleType} at ${vehicleWeight} kg benefits most from avoiding high-congestion idle: each idle minute costs ~${(baseFuelRate * 0.5).toFixed(3)} L.`,
      'Eco route avoids motorways — expect smoother acceleration cycles and lower brake-wear.'
    ]
  };
}

// Fallback arc paths
function fallbackArcPaths(startLat: number, startLng: number, endLat: number, endLng: number) {
  const standard: { lat: number; lng: number }[] = [];
  const eco: { lat: number; lng: number }[] = [];
  const steps = 8;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const bLat = startLat + t * (endLat - startLat);
    const bLng = startLng + t * (endLng - startLng);
    standard.push({ lat: bLat + Math.sin(t * Math.PI) * 0.015, lng: bLng + Math.cos(t * Math.PI) * 0.005 });
    eco.push({ lat: bLat + Math.sin(t * Math.PI) * 0.035, lng: bLng - Math.sin(t * Math.PI) * 0.02 });
  }
  return { standard, eco };
}

// =======================================================================
// API Routes
// =======================================================================

// ---- Route Optimization (enhanced with history + ORS flag) ----
app.post('/api/optimize', async (req, res) => {
  const {
    origin = 'Koramangala 8th Block',
    destination = 'Indiranagar 100 Feet Road',
    vehicleType = 'Sedan',
    vehicleWeight = 1400,
    weather = 'Sunny',
    tempCelsius = 28,
    congestionLevel = 'Moderate',
    city = 'bengaluru'
  } = req.body;

  let startLat = 12.9716, startLng = 77.5946;
  let endLat = 12.9716, endLng = 77.5946;
  let orsRoutingUsed = false;

  // Geocode using cached ORS
  const orgGeo = await geocodeWithCache(origin);
  if (orgGeo) { startLat = orgGeo.lat; startLng = orgGeo.lng; }

  const destGeo = await geocodeWithCache(destination);
  if (destGeo) { endLat = destGeo.lat; endLng = destGeo.lng; }

  // Fetch real road routes from ORS Directions API
  let stdCoords: { lat: number; lng: number }[] = [];
  let ecoCoords: { lat: number; lng: number }[] = [];
  let orsStdSummary: any = null;
  let orsEcoSummary: any = null;

  const orsKey = process.env.ORS_API_KEY;
  if (orsKey && orsKey !== 'PASTE_YOUR_ORS_API_KEY_HERE') {
    try {
      const [stdResult, ecoResult] = await Promise.allSettled([
        (async () => {
          const r = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': orsKey },
            body: JSON.stringify({ coordinates: [[startLng, startLat], [endLng, endLat]], preference: 'fastest', geometry: true })
          });
          if (!r.ok) return [];
          const d = await r.json();
          if (d.features?.length > 0) {
            orsStdSummary = d.features[0].properties.summary;
            orsRoutingUsed = true;
            return d.features[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
          }
          return [];
        })(),
        (async () => {
          const ecoBodies = [
            { coordinates: [[startLng, startLat], [endLng, endLat]], preference: 'shortest', options: { avoid_features: ['motorways', 'tollways'] }, geometry: true },
            { coordinates: [[startLng, startLat], [endLng, endLat]], preference: 'fastest', options: { avoid_features: ['tollways'] }, geometry: true },
            { coordinates: [[startLng, startLat], [endLng, endLat]], preference: 'recommended', geometry: true },
            { coordinates: [[startLng, startLat], [endLng, endLat]], preference: 'fastest', geometry: true },
          ];
          for (const body of ecoBodies) {
            try {
              const r = await fetch(`https://api.openrouteservice.org/v2/directions/driving-car/geojson`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': orsKey },
                body: JSON.stringify(body)
              });
              if (!r.ok) continue;
              const d = await r.json();
              if (d.features?.length > 0) {
                orsEcoSummary = d.features[0].properties.summary;
                orsRoutingUsed = true;
                return d.features[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
              }
            } catch (e) { continue; }
          }
          return [];
        })()
      ]);

      if (stdResult.status === 'fulfilled') stdCoords = stdResult.value;
      if (ecoResult.status === 'fulfilled') ecoCoords = ecoResult.value;
    } catch (error) {
      console.error('ORS Directions fetch failed:', error);
    }
  }

  const arcFallback = fallbackArcPaths(startLat, startLng, endLat, endLng);
  const finalCoords = {
    standard: stdCoords.length > 0 ? stdCoords : arcFallback.standard,
    eco: ecoCoords.length > 0 ? ecoCoords : arcFallback.eco
  };

  const routeMetrics = buildRouteMetrics(origin, destination, weather, tempCelsius, vehicleType, congestionLevel, vehicleWeight, orsStdSummary, orsEcoSummary);

  let resultPayload: any;

  if (!hasGeminiKey || !ai) {
    resultPayload = { ...routeMetrics, fromAI: false, orsRouting: orsRoutingUsed, coordinates: finalCoords };
  } else {
    try {
      const prompt = `You are EcoRoute AI, an intelligent emissions optimization engine for public transit.
Produce transit path recommendations and environmental calculations for a "${vehicleType}" transit vehicle.
Routes to analyze:
- Origin: "${origin}"
- Destination: "${destination}"
- Atmosphere: "${weather}" weather at ${tempCelsius}°C
- Congestion Level: "${congestionLevel}"

We expect a multi-objective optimization that weighs speed, distance, congestion, and tailpipe footprint. Frequently, an EcoRoute is slightly longer in distance but avoids heavy stop-and-go idling, resulting in a lower net fuel consumption and carbon footprint.

Format your expert recommendation strictly as a valid JSON object matching the following structure. Do not wrap in markdown other than json. Ensure numerical values are actual numbers (not strings):
{
  "summary": "High-level summary of the optimization findings",
  "weatherImpact": "Explanation of how weather/temp affects consumption (e.g. AC payload or traction loss)",
  "standardRoute": {
    "name": "Standard Shortest Routing Name",
    "distanceKm": number,
    "durationMinutes": number,
    "estCO2Kg": number,
    "estFuelLiters": number,
    "congestionScore": number,
    "hotspots": ["string"]
  },
  "ecoRoute": {
    "name": "Eco-Optimized Minimum-Footprint Routing Name",
    "distanceKm": number,
    "durationMinutes": number,
    "estCO2Kg": number,
    "estFuelLiters": number,
    "congestionScore": number,
    "bypassDetails": "How the EcoRoute avoids high emission hotspots",
    "alternativeStops": ["string"]
  },
  "metrics": {
    "fuelSavedLiters": number,
    "fuelSavingsPercent": number,
    "co2ReducedKg": number,
    "co2SavingsPercent": number,
    "equivalentTreesPlanted": number
  },
  "insights": [
    "Operator recommendations 1",
    "Operator recommendations 2"
  ]
}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              weatherImpact: { type: Type.STRING },
              standardRoute: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, distanceKm: { type: Type.NUMBER }, durationMinutes: { type: Type.NUMBER }, estCO2Kg: { type: Type.NUMBER }, estFuelLiters: { type: Type.NUMBER }, congestionScore: { type: Type.NUMBER }, hotspots: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "distanceKm", "durationMinutes", "estCO2Kg", "estFuelLiters", "congestionScore", "hotspots"] },
              ecoRoute: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, distanceKm: { type: Type.NUMBER }, durationMinutes: { type: Type.NUMBER }, estCO2Kg: { type: Type.NUMBER }, estFuelLiters: { type: Type.NUMBER }, congestionScore: { type: Type.NUMBER }, bypassDetails: { type: Type.STRING }, alternativeStops: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "distanceKm", "durationMinutes", "estCO2Kg", "estFuelLiters", "congestionScore", "bypassDetails", "alternativeStops"] },
              metrics: { type: Type.OBJECT, properties: { fuelSavedLiters: { type: Type.NUMBER }, fuelSavingsPercent: { type: Type.NUMBER }, co2ReducedKg: { type: Type.NUMBER }, co2SavingsPercent: { type: Type.NUMBER }, equivalentTreesPlanted: { type: Type.NUMBER } }, required: ["fuelSavedLiters", "fuelSavingsPercent", "co2ReducedKg", "co2SavingsPercent", "equivalentTreesPlanted"] },
              insights: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["summary", "weatherImpact", "standardRoute", "ecoRoute", "metrics", "insights"]
          }
        }
      });

      const parsed = JSON.parse(response.text || '{}');
      resultPayload = { ...parsed, fromAI: true, orsRouting: orsRoutingUsed, coordinates: finalCoords };
    } catch (error: any) {
      console.warn('Gemini optimization API failed, using fallback:', error.message);
      resultPayload = { ...routeMetrics, fromAI: false, orsRouting: orsRoutingUsed, coordinates: finalCoords, fallbackWarning: 'Using localized emulation mode due to API limit.' };
    }
  }

  // Store in history
  optimizationHistory.push({
    timestamp: new Date().toISOString(),
    origin, destination, city,
    vehicleType, weather, tempCelsius, congestionLevel,
    metrics: resultPayload.metrics,
    standardRoute: resultPayload.standardRoute,
    ecoRoute: resultPayload.ecoRoute,
  });

  return res.json(resultPayload);
});

// ---- Fleet Buses (multi-city) ----
app.get('/api/buses', (req, res) => {
  const city = (req.query.city as string) || 'bengaluru';
  res.json(cityBusData[city] || cityBusData.bengaluru);
});

// ---- Optimization History ----
app.get('/api/history', (req, res) => {
  res.json(optimizationHistory);
});

app.delete('/api/history', (req, res) => {
  optimizationHistory.length = 0;
  res.json({ cleared: true });
});

// ---- Geocode endpoint (for congestion reporter) ----
app.get('/api/geocode', async (req, res) => {
  const query = (req.query.query as string) || '';
  if (!query) return res.json({ error: 'No query provided' });

  const result = await geocodeWithCache(query);
  if (result) {
    return res.json(result);
  }
  return res.json({ error: 'Geocoding failed', lat: null, lng: null });
});

// ---- Weather API (with cache) ----
app.get('/api/weather', async (req, res) => {
  const city = (req.query.city as string) || 'Bengaluru';
  const cacheKey = city.toLowerCase();
  const cached = weatherCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < WEATHER_CACHE_TTL) {
    return res.json(cached.data);
  }

  const owmKey = process.env.OPENWEATHER_API_KEY;
  if (owmKey && owmKey !== 'YOUR_OPENWEATHER_API_KEY_HERE') {
    try {
      const r = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)},IN&appid=${owmKey}&units=metric`
      );
      if (r.ok) {
        const d = await r.json();
        const result = {
          temp: Math.round(d.main.temp),
          description: d.weather?.[0]?.description || 'Clear',
          humidity: d.main.humidity,
          windSpeed: d.wind?.speed || 0,
          icon: d.weather?.[0]?.icon || '01d',
          city: d.name,
          live: true,
        };
        weatherCache.set(cacheKey, { data: result, ts: Date.now() });
        return res.json(result);
      }
    } catch (e) {
      console.warn('OpenWeatherMap fetch failed:', e);
    }
  }

  // Simulated fallback weather
  const simWeather: Record<string, any> = {
    bengaluru: { temp: 28, description: 'Partly cloudy', humidity: 65, windSpeed: 3.2, icon: '02d', city: 'Bengaluru', live: false },
    delhi: { temp: 38, description: 'Haze', humidity: 45, windSpeed: 2.8, icon: '50d', city: 'Delhi', live: false },
    mumbai: { temp: 32, description: 'Humid and cloudy', humidity: 82, windSpeed: 4.5, icon: '04d', city: 'Mumbai', live: false },
    chennai: { temp: 34, description: 'Sunny', humidity: 70, windSpeed: 5.1, icon: '01d', city: 'Chennai', live: false },
  };

  const result = simWeather[cacheKey] || simWeather.bengaluru;
  weatherCache.set(cacheKey, { data: result, ts: Date.now() });
  return res.json(result);
});

// ---- Voice Query (Gemini NLP) ----
app.post('/api/voice-query', async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) return res.json({ error: 'No transcript provided' });

  // Try Gemini first
  if (hasGeminiKey && ai) {
    try {
      const prompt = `You are a route query parser. Extract travel route parameters from the following natural language query. 
Return a JSON object with these fields (all optional — omit if not mentioned):
- origin: string (starting location)
- destination: string (ending location)
- vehicleType: one of "SUV", "Sedan", "Hatchback", "Sports" (infer from context)
- weather: one of "Sunny", "Overcast", "Monsoon Rain" (infer from weather mentions)
- congestionLevel: one of "Low", "Moderate", "Heavy" (infer from traffic mentions)

User query: "${transcript}"`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text || '{}');
      return res.json(parsed);
    } catch (e: any) {
      console.warn('Gemini voice query failed:', e.message);
    }
  }

  // Fallback: simple keyword parsing
  const lower = transcript.toLowerCase();
  const result: any = {};

  // Extract "from X to Y" pattern
  const fromToMatch = lower.match(/(?:from|starting at|departing)\s+(.+?)\s+(?:to|towards|heading to|going to)\s+(.+?)(?:\s+(?:during|in|with|via)|$)/i);
  if (fromToMatch) {
    result.origin = fromToMatch[1].trim().replace(/^the\s+/, '');
    result.destination = fromToMatch[2].trim().replace(/^the\s+/, '');
  } else {
    // Try simpler "X to Y" pattern
    const simpleMatch = lower.match(/(.+?)\s+to\s+(.+?)(?:\s+(?:during|in|with)|$)/i);
    if (simpleMatch) {
      result.origin = simpleMatch[1].trim().replace(/^(?:find|get|show|eco|green|route|the)\s+/gi, '').trim();
      result.destination = simpleMatch[2].trim();
    }
  }

  // Weather detection
  if (lower.includes('rain') || lower.includes('monsoon')) result.weather = 'Monsoon Rain';
  else if (lower.includes('cloud') || lower.includes('overcast')) result.weather = 'Overcast';
  else if (lower.includes('sun') || lower.includes('clear')) result.weather = 'Sunny';

  // Congestion detection
  if (lower.includes('heavy') || lower.includes('traffic') || lower.includes('rush')) result.congestionLevel = 'Heavy';
  else if (lower.includes('moderate') || lower.includes('normal')) result.congestionLevel = 'Moderate';
  else if (lower.includes('light') || lower.includes('free') || lower.includes('clear road')) result.congestionLevel = 'Low';

  return res.json(result);
});

// ---- Congestion Reports ----
app.post('/api/congestion', (req, res) => {
  const { lat, lng, severity, type, note } = req.body;
  if (!lat || !lng) return res.json({ error: 'lat/lng required' });

  const report = {
    id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    lat, lng,
    severity: severity || 3,
    type: type || 'traffic_jam',
    note: note || '',
    timestamp: new Date().toISOString(),
  };

  congestionReports.push(report);
  res.json(report);
});

app.get('/api/congestion', (req, res) => {
  const now = Date.now();
  const active = congestionReports.filter(r => now - new Date(r.timestamp).getTime() < 30 * 60 * 1000);
  res.json(active);
});

// -----------------------------------------------------------------------
// Server startup
// -----------------------------------------------------------------------
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom'
    });
    app.use(vite.middlewares);

    app.use('*', async (req, res, next) => {
      const url = req.originalUrl;
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const finalDistPath = fs.existsSync(distPath) ? distPath : __dirname;
    app.use(express.static(finalDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(finalDistPath, 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port as number, '0.0.0.0', () => {
    console.log(`[EcoRoute AI] Express Full-stack Server listening on port ${port}`);
  });
}

startServer();
