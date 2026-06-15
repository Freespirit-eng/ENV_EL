// -----------------------------------------------------------------------
// Multi-City Configuration — profiles, presets, and fleet compositions
// -----------------------------------------------------------------------

export interface CityPreset {
  id: string;
  label: string;
  origin: string;
  destination: string;
}

export interface CityFleetProfile {
  totalFleetSize: number;
  electricPercent: number;
  cngPercent: number;
  dieselPercent: number;
  hybridPercent: number;
  avgDailyKmPerBus: number;
}

export interface CityConfig {
  id: string;
  name: string;
  country: string;
  center: [number, number]; // [lat, lng]
  defaultZoom: number;
  presets: CityPreset[];
  fleet: CityFleetProfile;
  congestionProfile: 'Low' | 'Moderate' | 'Heavy';
  simulatedBuses: SimulatedBus[];
}

export interface SimulatedBus {
  id: string;
  line: string;
  origin: string;
  destination: string;
  status: string;
  ecoMode: boolean;
  passengers: number;
  fuelRate: string;
  co2Rate: string;
  speed: string;
  delay: string;
  lat: number;
  lng: number;
  heading: number;
  metrics: { litersSaved: number; co2Reduced: number };
}

// ---------------------------------------------------------------------------
// City Definitions
// ---------------------------------------------------------------------------

const bengaluru: CityConfig = {
  id: 'bengaluru',
  name: 'Bengaluru',
  country: 'India',
  center: [12.9716, 77.5946],
  defaultZoom: 12,
  congestionProfile: 'Heavy',
  fleet: {
    totalFleetSize: 6200,
    electricPercent: 12,
    cngPercent: 18,
    dieselPercent: 55,
    hybridPercent: 15,
    avgDailyKmPerBus: 220,
  },
  presets: [
    { id: 'blr-1', label: 'Koramangala ⇌ Indiranagar Hub', origin: 'Koramangala 8th Block', destination: 'Indiranagar 100 Feet Road' },
    { id: 'blr-2', label: 'RV College ⇌ Majestic', origin: 'RV College of Engineering Gate', destination: 'Kempegowda Bus Station (Majestic)' },
    { id: 'blr-3', label: 'Silk Board ⇌ Hebbal Flyover', origin: 'Silk Board Cross Road', destination: 'Hebbal Central Hub' },
    { id: 'blr-4', label: 'Electronic City ⇌ Whitefield', origin: 'Electronic City Phase 1', destination: 'ITPL Campus Whitefield' },
  ],
  simulatedBuses: [
    { id: 'E-BUS-204', line: 'Line 2A', origin: 'Silk Board', destination: 'Hebbal', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 42, fuelRate: '0.24 kW/km', co2Rate: '0.00 kg/km', speed: '38 km/h', delay: '+1 min', lat: 12.9349, lng: 77.6181, heading: 345, metrics: { litersSaved: 14.5, co2Reduced: 38.3 } },
    { id: 'DSL-BUS-802', line: 'Line 4C', origin: 'Kengeri', destination: 'Majestic', status: 'IDLE_TRAP', ecoMode: false, passengers: 58, fuelRate: '0.58 L/km', co2Rate: '1.53 kg/km', speed: '8 km/h', delay: '+16 mins', lat: 12.9512, lng: 77.5401, heading: 68, metrics: { litersSaved: -2.3, co2Reduced: -6.1 } },
    { id: 'HYB-BUS-411', line: 'Line 9E', origin: 'Whitefield', destination: 'Banashankari', status: 'GREEN_PATH', ecoMode: true, passengers: 31, fuelRate: '0.28 L/km', co2Rate: '0.74 kg/km', speed: '42 km/h', delay: 'On Time', lat: 12.9382, lng: 77.6914, heading: 220, metrics: { litersSaved: 18.2, co2Reduced: 48.0 } },
    { id: 'DSL-BUS-105', line: 'Line 12F', origin: 'Electronic City', destination: 'ITPL', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 67, fuelRate: '0.64 L/km', co2Rate: '1.69 kg/km', speed: '11 km/h', delay: '+11 mins', lat: 12.9111, lng: 77.6802, heading: 10, metrics: { litersSaved: 4.8, co2Reduced: 12.6 } },
  ],
};

const delhi: CityConfig = {
  id: 'delhi',
  name: 'Delhi',
  country: 'India',
  center: [28.6139, 77.209],
  defaultZoom: 11,
  congestionProfile: 'Heavy',
  fleet: {
    totalFleetSize: 7200,
    electricPercent: 18,
    cngPercent: 40,
    dieselPercent: 30,
    hybridPercent: 12,
    avgDailyKmPerBus: 200,
  },
  presets: [
    { id: 'del-1', label: 'Connaught Place ⇌ Nehru Place', origin: 'Connaught Place', destination: 'Nehru Place' },
    { id: 'del-2', label: 'ISBT Kashmere Gate ⇌ Saket', origin: 'ISBT Kashmere Gate', destination: 'Saket District Centre' },
    { id: 'del-3', label: 'Dwarka Sec-21 ⇌ Rajiv Chowk', origin: 'Dwarka Sector 21 Metro', destination: 'Rajiv Chowk Metro Station' },
    { id: 'del-4', label: 'Noida City Centre ⇌ Lajpat Nagar', origin: 'Noida City Centre Metro', destination: 'Lajpat Nagar Central Market' },
  ],
  simulatedBuses: [
    { id: 'E-BUS-DTC-01', line: 'Route 534', origin: 'Connaught Place', destination: 'Nehru Place', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 55, fuelRate: '0.22 kW/km', co2Rate: '0.00 kg/km', speed: '32 km/h', delay: '+2 mins', lat: 28.6315, lng: 77.2167, heading: 180, metrics: { litersSaved: 16.2, co2Reduced: 42.8 } },
    { id: 'CNG-BUS-DTC-14', line: 'Route 764', origin: 'ISBT Kashmere Gate', destination: 'Mehrauli', status: 'GREEN_PATH', ecoMode: true, passengers: 48, fuelRate: '0.35 kg/km', co2Rate: '0.96 kg/km', speed: '28 km/h', delay: 'On Time', lat: 28.6553, lng: 77.2271, heading: 210, metrics: { litersSaved: 12.1, co2Reduced: 31.9 } },
    { id: 'DSL-BUS-DTC-72', line: 'Route 181', origin: 'Dwarka', destination: 'Old Delhi', status: 'IDLE_TRAP', ecoMode: false, passengers: 72, fuelRate: '0.62 L/km', co2Rate: '1.63 kg/km', speed: '6 km/h', delay: '+22 mins', lat: 28.5635, lng: 77.0583, heading: 45, metrics: { litersSaved: -4.1, co2Reduced: -10.8 } },
    { id: 'HYB-BUS-DTC-33', line: 'Route 423', origin: 'Noida', destination: 'Lajpat Nagar', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 63, fuelRate: '0.44 L/km', co2Rate: '1.16 kg/km', speed: '14 km/h', delay: '+9 mins', lat: 28.5706, lng: 77.3211, heading: 300, metrics: { litersSaved: 5.5, co2Reduced: 14.5 } },
  ],
};

const mumbai: CityConfig = {
  id: 'mumbai',
  name: 'Mumbai',
  country: 'India',
  center: [19.076, 72.8777],
  defaultZoom: 12,
  congestionProfile: 'Heavy',
  fleet: {
    totalFleetSize: 5800,
    electricPercent: 10,
    cngPercent: 35,
    dieselPercent: 40,
    hybridPercent: 15,
    avgDailyKmPerBus: 180,
  },
  presets: [
    { id: 'mum-1', label: 'Dadar ⇌ Andheri Station', origin: 'Dadar TT', destination: 'Andheri Railway Station' },
    { id: 'mum-2', label: 'BKC ⇌ Worli Sea Link', origin: 'Bandra Kurla Complex', destination: 'Worli' },
    { id: 'mum-3', label: 'Thane ⇌ Mulund', origin: 'Thane Railway Station', destination: 'Mulund West' },
    { id: 'mum-4', label: 'Borivali ⇌ Churchgate', origin: 'Borivali Station', destination: 'Churchgate Station' },
  ],
  simulatedBuses: [
    { id: 'E-BUS-BEST-01', line: 'A-31', origin: 'Dadar', destination: 'Andheri', status: 'GREEN_PATH', ecoMode: true, passengers: 45, fuelRate: '0.26 kW/km', co2Rate: '0.00 kg/km', speed: '22 km/h', delay: '+3 mins', lat: 19.0178, lng: 72.8478, heading: 0, metrics: { litersSaved: 11.2, co2Reduced: 29.6 } },
    { id: 'CNG-BUS-BEST-19', line: 'C-49', origin: 'BKC', destination: 'Worli', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 38, fuelRate: '0.32 kg/km', co2Rate: '0.88 kg/km', speed: '35 km/h', delay: 'On Time', lat: 19.0596, lng: 72.8656, heading: 250, metrics: { litersSaved: 13.4, co2Reduced: 35.4 } },
    { id: 'DSL-BUS-BEST-55', line: 'D-12', origin: 'Thane', destination: 'Mulund', status: 'IDLE_TRAP', ecoMode: false, passengers: 65, fuelRate: '0.59 L/km', co2Rate: '1.56 kg/km', speed: '7 km/h', delay: '+18 mins', lat: 19.1863, lng: 72.9756, heading: 180, metrics: { litersSaved: -3.5, co2Reduced: -9.2 } },
    { id: 'HYB-BUS-BEST-40', line: 'H-8', origin: 'Borivali', destination: 'Churchgate', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 70, fuelRate: '0.48 L/km', co2Rate: '1.27 kg/km', speed: '12 km/h', delay: '+14 mins', lat: 19.2307, lng: 72.8567, heading: 180, metrics: { litersSaved: 6.3, co2Reduced: 16.6 } },
  ],
};

const chennai: CityConfig = {
  id: 'chennai',
  name: 'Chennai',
  country: 'India',
  center: [13.0827, 80.2707],
  defaultZoom: 12,
  congestionProfile: 'Moderate',
  fleet: {
    totalFleetSize: 4200,
    electricPercent: 8,
    cngPercent: 10,
    dieselPercent: 65,
    hybridPercent: 17,
    avgDailyKmPerBus: 210,
  },
  presets: [
    { id: 'che-1', label: 'T. Nagar ⇌ Anna Nagar', origin: 'T. Nagar Bus Stand', destination: 'Anna Nagar Tower' },
    { id: 'che-2', label: 'Central Station ⇌ Tambaram', origin: 'Chennai Central Railway Station', destination: 'Tambaram Railway Station' },
    { id: 'che-3', label: 'OMR Tidel Park ⇌ Adyar Signal', origin: 'Tidel Park OMR', destination: 'Adyar Signal Junction' },
    { id: 'che-4', label: 'Guindy ⇌ Porur Junction', origin: 'Guindy Bus Terminus', destination: 'Porur Junction' },
  ],
  simulatedBuses: [
    { id: 'E-BUS-MTC-01', line: 'Route 21G', origin: 'T. Nagar', destination: 'Anna Nagar', status: 'OPTIMAL_WAVE', ecoMode: true, passengers: 40, fuelRate: '0.25 kW/km', co2Rate: '0.00 kg/km', speed: '30 km/h', delay: '+2 mins', lat: 13.0418, lng: 80.2341, heading: 0, metrics: { litersSaved: 10.8, co2Reduced: 28.5 } },
    { id: 'DSL-BUS-MTC-38', line: 'Route 15B', origin: 'Central', destination: 'Tambaram', status: 'STOP_GO_QUEUE', ecoMode: false, passengers: 60, fuelRate: '0.56 L/km', co2Rate: '1.48 kg/km', speed: '15 km/h', delay: '+8 mins', lat: 13.0836, lng: 80.2752, heading: 180, metrics: { litersSaved: 3.2, co2Reduced: 8.4 } },
    { id: 'HYB-BUS-MTC-22', line: 'Route 119', origin: 'OMR', destination: 'Adyar', status: 'GREEN_PATH', ecoMode: true, passengers: 28, fuelRate: '0.30 L/km', co2Rate: '0.79 kg/km', speed: '38 km/h', delay: 'On Time', lat: 12.9889, lng: 80.2463, heading: 315, metrics: { litersSaved: 15.1, co2Reduced: 39.9 } },
    { id: 'DSL-BUS-MTC-55', line: 'Route 70', origin: 'Guindy', destination: 'Porur', status: 'IDLE_TRAP', ecoMode: false, passengers: 52, fuelRate: '0.61 L/km', co2Rate: '1.61 kg/km', speed: '9 km/h', delay: '+12 mins', lat: 13.0067, lng: 80.2206, heading: 270, metrics: { litersSaved: -1.8, co2Reduced: -4.8 } },
  ],
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const CITIES: CityConfig[] = [bengaluru, delhi, mumbai, chennai];

export function getCityById(id: string): CityConfig {
  return CITIES.find(c => c.id === id) || bengaluru;
}

export const DEFAULT_CITY = bengaluru;
