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
const hasGeminiKey = Boolean(apiKey) && apiKey !== 'MY_GEMINI_API_KEY';

const ai = hasGeminiKey 
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
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

// Simulated base coordinates for custom user optimizations
function createSimulatedDivergentPaths(org: string, dest: string, weather: string, tempCelsius: number, vehicleType: string, congestion: string) {
  // Extract simple center coordinates
  const lat1 = 12.9716;
  const lng1 = 77.5946; // Bengaluru center
  
  const standard: { lat: number; lng: number }[] = [];
  const eco: { lat: number; lng: number }[] = [];
  const stepsCount = 6;
  
  // Create a slight arc for the standard route (congested)
  // and a wider, bypass arc for the ecoRoute
  for (let i = 0; i < stepsCount; i++) {
    const t = i / (stepsCount - 1);
    
    // Base straight line
    const baseLat = lat1 - 0.05 + t * 0.1;
    const baseLng = lng1 - 0.05 + t * 0.1;
    
    // Add jitter/bottleneck deviation to standard
    const stdDeviationLat = Math.sin(t * Math.PI) * 0.015;
    const stdDeviationLng = Math.cos(t * Math.PI) * 0.005;
    standard.push({ lat: baseLat + stdDeviationLat, lng: baseLng + stdDeviationLng });
    
    // Add wider smooth bypass deviation to eco
    const ecoDeviationLat = Math.sin(t * Math.PI) * 0.035 + (i === 3 ? -0.01 : 0);
    const ecoDeviationLng = -Math.sin(t * Math.PI) * 0.02 + (i === 2 ? 0.012 : 0);
    eco.push({ lat: baseLat + ecoDeviationLat, lng: baseLng + ecoDeviationLng });
  }

  const weatherCoefficient = weather.toLowerCase().includes('rain') || weather.toLowerCase().includes('monsoon') ? 1.25 : 1.0;
  const acPayloadCoeff = tempCelsius > 32 ? 1.15 : (tempCelsius < 15 ? 1.05 : 1.0);
  const vehicleBaseCO2 = vehicleType.toLowerCase().includes('heavy') ? 1.1 : (vehicleType.toLowerCase().includes('standard') ? 0.8 : 0.55);

  const stdDist = parseFloat((8.5 + Math.random() * 3).toFixed(1));
  const ecoDist = parseFloat((stdDist + (1.2 + Math.random() * 1.5)).toFixed(1)); // Slightly longer distance but much lower idle stop-and-go
  
  const stdDuration = Math.round(stdDist * (congestion === 'Heavy' ? 4.5 : (congestion === 'Moderate' ? 3.0 : 2.0)));
  const ecoDuration = Math.round(ecoDist * 2.2); // Smoother, green lanes have better average speed

  const stdFuel = parseFloat((stdDist * 0.44 * weatherCoefficient * acPayloadCoeff * (congestion === 'Heavy' ? 1.6 : 1.1)).toFixed(1));
  const ecoFuel = parseFloat((ecoDist * 0.28 * weatherCoefficient * (tempCelsius > 32 ? 1.1 : 1.0)).toFixed(1));

  const stdCO2 = parseFloat((stdFuel * 2.64).toFixed(1));
  const ecoCO2 = parseFloat((ecoFuel * 2.64).toFixed(1));

  const fuelSaved = parseFloat((stdFuel - ecoFuel).toFixed(1));
  const fuelSavingsPct = Math.round((fuelSaved / stdFuel) * 100);
  const co2Reduced = parseFloat((stdCO2 - ecoCO2).toFixed(1));
  const co2SavingsPct = Math.round((co2Reduced / stdCO2) * 100);

  return {
    coordinates: {
      standard,
      eco
    },
    simulatedResponse: {
      summary: `The optimization engine recommended bypassing major congestion zones along the shortest path. For a ${vehicleType}, routing through arterial Ring Road bypasses avoided 4 major idle points, delivering significant environmental reductions.`,
      weatherImpact: `The current ambient state of ${weather} at ${tempCelsius}°C imposes ${tempCelsius > 30 ? 'high A/C auxiliary cargo loads' : 'moderate thermodynamic loads'}, causing a projected average of +12% fuel load on standard idling segments.`,
      standardRoute: {
        name: `${org} via Central Express Corridor`,
        distanceKm: stdDist,
        durationMinutes: stdDuration,
        estCO2Kg: stdCO2,
        estFuelLiters: stdFuel,
        congestionScore: congestion === 'Heavy' ? 9 : (congestion === 'Moderate' ? 6 : 3),
        hotspots: ['Silk Board Grid Junction', 'Richmond Road Overhead Bottle-neck', 'Trinity Metro Choke Point']
      },
      ecoRoute: {
        name: `${org} via Green-Wave Arterial Bypass`,
        distanceKm: ecoDist,
        durationMinutes: ecoDuration,
        estCO2Kg: ecoCO2,
        estFuelLiters: ecoFuel,
        congestionScore: 2,
        bypassDetails: 'Bypasses the gridlock using green signal transit-priority corridors and peripheral lake roads.',
        alternativeStops: ['Agara Bus Hub Shelter', 'Bellandur Eco Transit-Bay']
      },
      metrics: {
        fuelSavedLiters: fuelSaved > 0 ? fuelSaved : 1.8,
        fuelSavingsPercent: fuelSavingsPct > 0 ? fuelSavingsPct : 22,
        co2ReducedKg: co2Reduced > 0 ? co2Reduced : 4.8,
        co2SavingsPercent: co2SavingsPct > 0 ? co2SavingsPct : 22,
        equivalentTreesPlanted: Math.round((co2Reduced > 0 ? co2Reduced : 4.8) * 0.15 * 10) / 10 || 0.8
      },
      insights: [
        'Maintain secondary green-lane speeds at 40 km/h to capture the signal priority wave.',
        'Anticipate mild dynamic queuing at Outer Ring Road, eco-stop priority is active.',
        'Regenerative braking optimization: Driver should coast 100m prior to eco-stop bays.'
      ]
    }
  };
}

// API Routes
app.post('/api/optimize', async (req, res) => {
  const { 
    origin = 'Central Silk Board', 
    destination = 'Indiranagar Metro Station', 
    vehicleType = 'Standard Electric Bus', 
    weather = 'Sunny', 
    tempCelsius = 25,
    congestionLevel = 'Heavy' 
  } = req.body;

  // Let's retrieve realistic coordinates for this scenario
  const defaults = createSimulatedDivergentPaths(origin, destination, weather, tempCelsius, vehicleType, congestionLevel);

  if (!hasGeminiKey || !ai) {
    // Elegant fallback simulated data in case the key is missing from AI secrets during staging
    return res.json({
      ...defaults.simulatedResponse,
      fromAI: false,
      coordinates: defaults.coordinates
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
      model: 'gemini-3.5-flash',
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
      coordinates: defaults.coordinates
    });
  } catch (error: any) {
    console.warn('Gemini optimization API failed, using high-fidelity fallback:', error.message);
    return res.json({
      ...defaults.simulatedResponse,
      fromAI: false,
      coordinates: defaults.coordinates,
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
