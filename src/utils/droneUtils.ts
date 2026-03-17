// Types
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityConfig {
  label: string;
  color: string;
  glow: string;
  bg: string;
}

export interface Drone {
  id: string;
  model: string;
  severity: SeverityLevel;
  status: 'active' | 'left';
  detectedMs: number;
  durationMs: number;
  lat: number;
  lon: number;
  targetLat: number;
  targetLon: number;
  vLat: number;
  vLon: number;
  heading: number;
  altitude: number;
  speed: number;
  spd: number;
  threatScore: number;
  rfSig: number;
  detectedBy: string[];
}

export interface Sensor {
  id: string;
  lat: number;
  lon: number;
  patrol: boolean;
  vLat: number;
  vLon: number;
  patrolLat: number;
}

// Constants
export const SEV: Record<SeverityLevel, SeverityConfig> = {
  critical: { label: "CRITICAL", color: "#ff2d55", glow: "rgba(255,45,85,0.6)", bg: "rgba(255,45,85,0.12)" },
  high:     { label: "HIGH",     color: "#ff8c00", glow: "rgba(255,140,0,0.5)", bg: "rgba(255,140,0,0.10)" },
  medium:   { label: "MEDIUM",   color: "#ffd60a", glow: "rgba(255,214,10,0.5)", bg: "rgba(255,214,10,0.08)" },
  low:      { label: "LOW",      color: "#30d158", glow: "rgba(48,209,88,0.5)", bg: "rgba(48,209,88,0.08)" },
};

export const WINDOW_SEC = 300; // 5 min scroll window

export const DRONE_MODELS: Record<SeverityLevel, string[]> = {
  critical: ["DJI Matrice 300 RTK", "Autel EVO II Pro", "Freefly Alta X", "Yuneec H520E"],
  high: ["DJI Phantom 4 Pro", "Parrot Anafi AI", "DJI Mini 3 Pro", "Autel EVO Nano+"],
  medium: ["DJI Air 2S", "Parrot Anafi USA", "Skydio 2+", "DJI Mavic 3"],
  low: ["Holy Stone HS720", "Ryze Tello", "Syma X5C", "Potensic ATOM SE"],
};

export const LAT_MIN = 31.35;
export const LAT_MAX = 31.85;
export const LON_MIN = 35.15;
export const LON_MAX = 35.65;

export const SENSORS_BASE: Sensor[] = [
  { id: "unit101", lat: 31.42, lon: 35.25, patrol: true, vLat: 0.00001, vLon: 0, patrolLat: 31.42 },
  { id: "unit102", lat: 31.56, lon: 35.52, patrol: false, vLat: 0, vLon: 0, patrolLat: 0 },
  { id: "unit103", lat: 31.72, lon: 35.35, patrol: false, vLat: 0, vLon: 0, patrolLat: 0 },
  { id: "unit104", lat: 31.65, lon: 35.58, patrol: false, vLat: 0, vLon: 0, patrolLat: 0 },
];

let sensorState = SENSORS_BASE.map(s => ({ ...s }));

// Utility functions
export function rand(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

export function randInt(a: number, b: number): number {
  return Math.floor(rand(a, b + 1));
}

export function pick<T>(arr: T[]): T {
  return arr[randInt(0, arr.length - 1)];
}

export function formatTime(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function project(lat: number, lon: number, w: number, h: number): { x: number; y: number } {
  const x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * w;
  const y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * h;
  return { x, y };
}

let droneId = 1;

export function spawnDrone(detectAt: number): Drone {
  const sev = pick<SeverityLevel>(["critical", "high", "medium", "low"]);
  const model = pick(DRONE_MODELS[sev]);
  const lat = rand(LAT_MIN, LAT_MAX);
  const lon = rand(LON_MIN, LON_MAX);
  const dur = randInt(120000, 360000);

  // pick 1-3 sensors that "detected" this drone
  const sensorsCount = randInt(1, 3);
  const shuffled = [...SENSORS_BASE].sort(() => Math.random() - 0.5);
  const detectedBy = shuffled.slice(0, sensorsCount).map(s => s.id);

  return {
    id: `drone-${droneId++}`,
    model,
    severity: sev,
    status: "active",
    detectedMs: detectAt,
    durationMs: dur,
    lat,
    lon,
    targetLat: rand(LAT_MIN, LAT_MAX),
    targetLon: rand(LON_MIN, LON_MAX),
    vLat: 0,
    vLon: 0,
    heading: rand(0, 360),
    altitude: randInt(20, 400),
    speed: randInt(5, 80),
    spd: rand(0.4, 1.2),
    threatScore: randInt(30, 99),
    rfSig: randInt(-90, -30),
    detectedBy,
  };
}

export function tickSensors(dt: number): Sensor[] {
  sensorState.forEach(s => {
    if (!s.patrol) return;
    s.lat += s.vLat * dt;
    const off = s.lat - s.patrolLat;
    const range = 0.10;
    if (off > range) s.vLat = -Math.abs(s.vLat);
    if (off < -range) s.vLat = Math.abs(s.vLat);
  });
  return sensorState;
}
