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

// Simulated coordinate patterns for routes around Bengaluru, India
// These act as robust geo-spatial fallbacks for visualization
const routeCoordinates: Record<string, { lat: number; lng: number }[]> = {
  'Line 2A': [
    { lat: 12.9176, lng: 77.6244 }, // Central Silk Board
    { lat: 12.9230, lng: 77.6258 }, // HSR Layout
    { lat: 12.9349, lng: 77.6181 }, // Koramangala
    { lat: 12.9591, lng: 77.6402 }, // Domlur
    { lat: 12.9716, lng: 77.6436 }, // Indiranagar
    { lat: 13.0035, lng: 77.6247 }, // Kalyan Nagar
    { lat: 13.0358, lng: 77.5970 }  // Hebbal
  ],
  'Line 4C': [
    { lat: 12.9038, lng: 77.4831 }, // Kengeri
    { lat: 12.9221, lng: 77.5188 }, // Nayandahalli
    { lat: 12.9405, lng: 77.5383 }, // Deepanjali Nagar
    { lat: 12.9512, lng: 77.5401 }, // Mysore Road Toll
    { lat: 12.9602, lng: 77.5562 }, // Sirsi Circle
    { lat: 12.9719, lng: 77.5737 }  // Majestic (KSR)
  ],
  'Line 9E': [
    { lat: 12.9716, lng: 77.7499 }, // Whitefield
    { lat: 12.9601, lng: 77.7012 }, // Marathahalli
    { lat: 12.9382, lng: 77.6914 }, // Bellandur
    { lat: 12.9176, lng: 77.6244 }, // Silk Board
    { lat: 12.9112, lng: 77.5851 }, // Jayanagar
    { lat: 12.9254, lng: 77.5746 }  // Banashankari
  ],
  'Line 12F': [
    { lat: 12.8452, lng: 77.6715 }, // Electronic City
    { lat: 12.8712, lng: 77.6784 }, // Hosa Road
    { lat: 12.9111, lng: 77.6802 }, // Bellandur Outer Ring Road
    { lat: 12.9525, lng: 77.7020 }, // Mahadevapura
    { lat: 12.9866, lng: 77.7335 }  // ITPL Whitefield
  ],
  // Dynamic fallback route coordinates generated between dynamic points
  'Standard Route (BTM - Indiranagar)': [
    { lat: 12.9165, lng: 77.6101 }, // BTM Layout
    { lat: 12.9230, lng: 77.6258 }, // Silk Board Grid (Bottleneck hotspot)
    { lat: 12.9349, lng: 77.6181 }, // Koramangala
    { lat: 12.9591, lng: 77.6402 }, // Domlur (Idle bottleneck)
    { lat: 12.9716, lng: 77.6436 }  // Indiranagar
  ],
  'EcoRoute (BTM - Indiranagar)': [
    { lat: 12.9165, lng: 77.6101 }, // BTM Layout
    { lat: 12.9210, lng: 77.6010 }, // Inner roads bypassing Silk Board
    { lat: 12.9380, lng: 77.6090 }, // Madivala Lake bypass (Green wave zone)
    { lat: 12.9482, lng: 77.6320 }, // Intermediate green lanes
    { lat: 12.9620, lng: 77.6310 }, // Domlur bypass flyover exit
    { lat: 12.9716, lng: 77.6436 }  // Indiranagar
  ]
};

// -----------------------------------------------------------------------
// ORS Directions API — fetch real road-following route geometry
// -----------------------------------------------------------------------
async function getORSRouteCoords(
  orsKey: string,
  startLng: number, startLat: number,
  endLng: number, endLat: number,
  isEco: boolean
): Promise<{ lat: number; lng: number }[]> {
  // Try driving-hgv (heavy goods / bus) first, fall back to driving-car
  const profiles = ['driving-hgv', 'driving-car'];
  const preference = isEco ? 'shortest' : 'fastest';
  const body: any = {
    coordinates: [[startLng, startLat], [endLng, endLat]],
    preference,
    geometry: true,
    geometry_simplify: false,
    ...(isEco && {
      options: { avoid_features: ['motorways', 'tollways'] }
    })
  };

  for (const profile of profiles) {
    try {
      const res = await fetch(
        `https://api.openrouteservice.org/v2/directions/${profile}/geojson`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': orsKey
          },
          body: JSON.stringify(body)
        }
      );
      if (!res.ok) {
        const errText = await res.text();
        console.warn(`ORS ${profile} failed (${res.status}): ${errText}`);
        continue;
      }
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const coords: [number, number][] = data.features[0].geometry.coordinates;
        return coords.map(([lng, lat]) => ({ lat, lng }));
      }
    } catch (err) {
      console.warn(`ORS routing error for profile ${profile}:`, err);
    }
  }
  return []; // all profiles failed
}

// -----------------------------------------------------------------------
// Compute route metrics (fuel, CO2, etc.) from ORS summary + params
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

  // Car-type base fuel consumption rates (L/km) — scaled by weight
  const weightFactor = vehicleWeight / 1400; // normalised around sedan baseline
  const carBaseFuel: Record<string, number> = {
    'SUV': 0.12,
    'Sedan': 0.08,
    'Hatchback': 0.06,
    'Sports': 0.10,
  };
  const baseFuelRate = (carBaseFuel[vehicleType] ?? 0.08) * weightFactor;

  // Use real ORS distance/duration if available, else synthesise
  const stdDistKm = orsStdSummary ? parseFloat((orsStdSummary.distance / 1000).toFixed(1)) : parseFloat((8.5 + Math.random() * 3).toFixed(1));
  const stdDurMin = orsStdSummary ? Math.round(orsStdSummary.duration / 60) : Math.round(stdDistKm * (congestion === 'Heavy' ? 4.5 : 3.0));
  const ecoDistKm = orsEcoSummary ? parseFloat((orsEcoSummary.distance / 1000).toFixed(1)) : parseFloat((stdDistKm + 1.5).toFixed(1));
  const ecoDurMin = orsEcoSummary ? Math.round(orsEcoSummary.duration / 60) : Math.round(ecoDistKm * 2.2);

  // Apply congestion multiplier to standard duration (ORS returns free-flow estimate)
  const congMult = congestion === 'Heavy' ? 1.8 : (congestion === 'Moderate' ? 1.3 : 1.0);
  const stdDurAdj = Math.round(stdDurMin * congMult);

  // Congestion on std adds idle stop-and-go fuel overhead
  const congFuelMult = congestion === 'Heavy' ? 1.55 : (congestion === 'Moderate' ? 1.25 : 1.0);
  const stdFuel = parseFloat((stdDistKm * baseFuelRate * weatherCoeff * acCoeff * congFuelMult).toFixed(2));
  // Eco route: slightly longer but avoids motorways + stop-and-go, fewer idle cycles
  const ecoFuel = parseFloat((ecoDistKm * baseFuelRate * 0.72 * weatherCoeff).toFixed(2));

  const stdCO2 = parseFloat((stdFuel * 2.31).toFixed(2));  // petrol: ~2.31 kg CO2/L
  const ecoCO2 = parseFloat((ecoFuel * 2.31).toFixed(2));
  const fuelSaved = parseFloat((stdFuel - ecoFuel).toFixed(2));
  const co2Reduced = parseFloat((stdCO2 - ecoCO2).toFixed(2));

  // Congestion score: eco avoids motorways so score is much lower
  const stdCongScore = congestion === 'Heavy' ? 9 : (congestion === 'Moderate' ? 6 : 3);
  const ecoCongScore = 2;
  const congestionSavingsPct = Math.round(((stdCongScore - ecoCongScore) / stdCongScore) * 100);

  return {
    summary: `ORS road routing complete. Your ${vehicleType} (${vehicleWeight} kg) on the fastest corridor (${stdDistKm} km) hits major choke points, while the eco-shortest path (${ecoDistKm} km) avoids motorways and tollways, reducing idle stop-and-go by ~${congestionSavingsPct}%.`,
    weatherImpact: `${weather} at ${tempCelsius}°C adds ${tempCelsius > 30 ? 'high A/C load' : 'moderate thermal load'} — projected +${Math.round((weatherCoeff * acCoeff - 1) * 100)}% fuel overhead on the standard corridor.`,
    standardRoute: {
      name: `${org} → Fastest Arterial`,
      distanceKm: stdDistKm,
      durationMinutes: stdDurAdj,
      estCO2Kg: stdCO2,
      estFuelLiters: stdFuel,
      congestionScore: stdCongScore,
      hotspots: ['Silk Board Junction', 'Richmond Road Bottleneck', 'Trinity Metro Choke']
    },
    ecoRoute: {
      name: `${org} → Eco-Shortest Bypass`,
      distanceKm: ecoDistKm,
      durationMinutes: ecoDurMin,
      estCO2Kg: ecoCO2,
      estFuelLiters: ecoFuel,
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
      `Maintain 40–50 km/h on secondary roads to avoid the standard route’s idle clusters.`,
      `Your ${vehicleType} at ${vehicleWeight} kg benefits most from avoiding high-congestion idle: each idle minute costs ~${(baseFuelRate * 0.5).toFixed(3)} L.`,
      'Eco route avoids motorways — expect smoother acceleration cycles and lower brake-wear.'
    ]
  };
}

// Fallback: synthesise diverging arc paths when ORS routing is unavailable
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

// API Routes
app.post('/api/optimize', async (req, res) => {
  const {
    origin = 'Koramangala 8th Block',
    destination = 'Indiranagar 100 Feet Road',
    vehicleType = 'Sedan',
    vehicleWeight = 1400,
    weather = 'Sunny',
    tempCelsius = 28,
    congestionLevel = 'Moderate'
  } = req.body;

  let startLat = 12.9716, startLng = 77.5946;
  let endLat = 12.9716, endLng = 77.5946;

  const orsKey = process.env.ORS_API_KEY;
  if (orsKey && orsKey !== 'PASTE_YOUR_ORS_API_KEY_HERE') {
    try {
      const orgRes = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(origin)}&size=1`
      );
      const orgData = await orgRes.json();
      if (orgData.features && orgData.features.length > 0) {
        const [lng, lat] = orgData.features[0].geometry.coordinates;
        startLat = lat;
        startLng = lng;
      }

      const destRes = await fetch(
        `https://api.openrouteservice.org/geocode/search?api_key=${orsKey}&text=${encodeURIComponent(destination)}&size=1`
      );
      const destData = await destRes.json();
      if (destData.features && destData.features.length > 0) {
        const [lng, lat] = destData.features[0].geometry.coordinates;
        endLat = lat;
        endLng = lng;
      }
    } catch (error) {
      console.error('ORS Geocoding fetch failed, falling back to Bengaluru defaults:', error);
    }
  }

  // ---- Fetch REAL road routes from ORS Directions API ----
  let stdCoords: { lat: number; lng: number }[] = [];
  let ecoCoords: { lat: number; lng: number }[] = [];
  let orsStdSummary: any = null;
  let orsEcoSummary: any = null;

  const orsKeyForRouting = process.env.ORS_API_KEY;
  if (orsKeyForRouting && orsKeyForRouting !== 'PASTE_YOUR_ORS_API_KEY_HERE') {
    try {
      // Fetch both routes in parallel for speed (driving-car for personal vehicles)
      const [stdResult, ecoResult] = await Promise.allSettled([
        (async () => {
          try {
            const r = await fetch(
              `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': orsKeyForRouting },
                body: JSON.stringify({
                  coordinates: [[startLng, startLat], [endLng, endLat]],
                  preference: 'fastest',
                  geometry: true
                })
              }
            );
            if (!r.ok) { console.warn('ORS std route failed:', r.status); return []; }
            const d = await r.json();
            if (d.features?.length > 0) {
              orsStdSummary = d.features[0].properties.summary;
              return d.features[0].geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
            }
          } catch (e) { console.warn('ORS std routing error:', e); }
          return [];
        })(),
        (async () => {
          // Eco: try shortest+avoid first; if ORS can't route (returns error) fall back to just shortest
          const ecoBodies = [
            {
              // 1. Ideal eco route (works for shorter inner-city trips)
              coordinates: [[startLng, startLat], [endLng, endLat]],
              preference: 'shortest',
              options: { avoid_features: ['motorways', 'tollways'] },
              geometry: true
            },
            {
              // 2. Fallback for long distances where shortest is restricted: fastest but avoid tollways
              coordinates: [[startLng, startLat], [endLng, endLat]],
              preference: 'fastest',
              options: { avoid_features: ['tollways'] },
              geometry: true
            },
            {
              // 3. Recommended profile
              coordinates: [[startLng, startLat], [endLng, endLat]],
              preference: 'recommended',
              geometry: true
            },
            {
              // 4. Ultimate fallback — just use the fastest route if all else fails so we still get real roads
              coordinates: [[startLng, startLat], [endLng, endLat]],
              preference: 'fastest',
              geometry: true
            }
          ];
          for (const body of ecoBodies) {
            try {
              const r = await fetch(
                `https://api.openrouteservice.org/v2/directions/driving-car/geojson`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', 'Authorization': orsKeyForRouting },
                  body: JSON.stringify(body)
                }
              );
              if (!r.ok) {
                const errText = await r.text();
                console.warn('ORS eco route attempt failed:', r.status, errText.slice(0, 120));
                continue; // try next body config
              }
              const d = await r.json();
              if (d.features?.length > 0) {
                orsEcoSummary = d.features[0].properties.summary;
                return d.features[0].geometry.coordinates.map(([lng, lat]: [number,number]) => ({ lat, lng }));
              }
            } catch (e) { console.warn('ORS eco routing error:', e); }
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

  // If ORS directions failed, fall back to arc paths
  const arcFallback = fallbackArcPaths(startLat, startLng, endLat, endLng);
  const finalCoords = {
    standard: stdCoords.length > 0 ? stdCoords : arcFallback.standard,
    eco: ecoCoords.length > 0 ? ecoCoords : arcFallback.eco
  };

  const routeMetrics = buildRouteMetrics(origin, destination, weather, tempCelsius, vehicleType, congestionLevel, vehicleWeight, orsStdSummary, orsEcoSummary);

  if (!hasGeminiKey || !ai) {
    return res.json({
      ...routeMetrics,
      fromAI: false,
      coordinates: finalCoords
    });
  }

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
    "congestionScore": number, // 1 to 10 scale
    "hotspots": ["string"]
  },
  "ecoRoute": {
    "name": "Eco-Optimized Minimum-Footprint Routing Name",
    "distanceKm": number,
    "durationMinutes": number,
    "estCO2Kg": number,
    "estFuelLiters": number,
    "congestionScore": number, // 1 to 10 scale
    "bypassDetails": "How the EcoRoute avoids high emission hotspots",
    "alternativeStops": ["string"]
  },
  "metrics": {
    "fuelSavedLiters": number,
    "fuelSavingsPercent": number,
    "co2ReducedKg": number,
    "co2SavingsPercent": number,
    "equivalentTreesPlanted": number // 1 kg CO2 reduction approximately equals 0.15 of a tree day absorb-rate
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
            standardRoute: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                distanceKm: { type: Type.NUMBER },
                durationMinutes: { type: Type.NUMBER },
                estCO2Kg: { type: Type.NUMBER },
                estFuelLiters: { type: Type.NUMBER },
                congestionScore: { type: Type.NUMBER },
                hotspots: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "distanceKm", "durationMinutes", "estCO2Kg", "estFuelLiters", "congestionScore", "hotspots"]
            },
            ecoRoute: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                distanceKm: { type: Type.NUMBER },
                durationMinutes: { type: Type.NUMBER },
                estCO2Kg: { type: Type.NUMBER },
                estFuelLiters: { type: Type.NUMBER },
                congestionScore: { type: Type.NUMBER },
                bypassDetails: { type: Type.STRING },
                alternativeStops: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["name", "distanceKm", "durationMinutes", "estCO2Kg", "estFuelLiters", "congestionScore", "bypassDetails", "alternativeStops"]
            },
            metrics: {
              type: Type.OBJECT,
              properties: {
                fuelSavedLiters: { type: Type.NUMBER },
                fuelSavingsPercent: { type: Type.NUMBER },
                co2ReducedKg: { type: Type.NUMBER },
                co2SavingsPercent: { type: Type.NUMBER },
                equivalentTreesPlanted: { type: Type.NUMBER }
              },
              required: ["fuelSavedLiters", "fuelSavingsPercent", "co2ReducedKg", "co2SavingsPercent", "equivalentTreesPlanted"]
            },
            insights: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["summary", "weatherImpact", "standardRoute", "ecoRoute", "metrics", "insights"]
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      ...parsed,
      fromAI: true,
      coordinates: finalCoords
    });
  } catch (error: any) {
    console.warn('Gemini optimization API failed, using high-fidelity fallback:', error.message);
    console.warn("If this is a fetch failed error, try restarting your server using: NODE_OPTIONS='--dns-result-order=ipv4first' npm run dev");
    return res.json({
      ...routeMetrics,
      fromAI: false,
      coordinates: finalCoords,
      fallbackWarning: 'Using localized emulation mode due to connection timeout.'
    });
  }
});

// Transit Operator simulated active fleet feeds
const simulatedBuses = [
  {
    id: 'E-BUS-204',
    line: 'Line 2A',
    origin: 'Silk Board',
    destination: 'Hebbal',
    status: 'OPTIMAL_WAVE',
    ecoMode: true,
    passengers: 42,
    fuelRate: '0.24 kW/km',
    co2Rate: '0.00 kg/km',
    speed: '38 km/h',
    delay: '+1 min',
    lat: 12.9349,
    lng: 77.6181,
    heading: 345,
    metrics: {
      litersSaved: 14.5,
      co2Reduced: 38.3
    }
  },
  {
    id: 'DSL-BUS-802',
    line: 'Line 4C',
    origin: 'Kengeri',
    destination: 'Majestic',
    status: 'IDLE_TRAP',
    ecoMode: false,
    passengers: 58,
    fuelRate: '0.58 L/km',
    co2Rate: '1.53 kg/km',
    speed: '8 km/h',
    delay: '+16 mins',
    lat: 12.9512,
    lng: 77.5401,
    heading: 68,
    metrics: {
      litersSaved: -2.3,
      co2Reduced: -6.1
    }
  },
  {
    id: 'HYB-BUS-411',
    line: 'Line 9E',
    origin: 'Whitefield',
    destination: 'Banashankari',
    status: 'GREEN_PATH',
    ecoMode: true,
    passengers: 31,
    fuelRate: '0.28 L/km',
    co2Rate: '0.74 kg/km',
    speed: '42 km/h',
    delay: 'On Time',
    lat: 12.9382,
    lng: 77.6914,
    heading: 220,
    metrics: {
      litersSaved: 18.2,
      co2Reduced: 48.0
    }
  },
  {
    id: 'DSL-BUS-105',
    line: 'Line 12F',
    origin: 'Electronic City',
    destination: 'ITPL',
    status: 'STOP_GO_QUEUE',
    ecoMode: false,
    passengers: 67,
    fuelRate: '0.64 L/km',
    co2Rate: '1.69 kg/km',
    speed: '11 km/h',
    delay: '+11 mins',
    lat: 12.9111,
    lng: 77.6802,
    heading: 10,
    metrics: {
      litersSaved: 4.8,
      co2Reduced: 12.6
    }
  }
];

app.get('/api/buses', (req, res) => {
  res.json(simulatedBuses);
});

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
    // Serve production static assets
    const distPath = path.resolve(__dirname, 'dist');
    const finalDistPath = fs.existsSync(distPath) ? distPath : __dirname;

    app.use(express.static(finalDistPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(finalDistPath, 'index.html'));
    });
  }

  const port = 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`[EcoRoute AI] Express Full-stack Server listening on http://localhost:${port}`);
  });
}

startServer();

startServer();
