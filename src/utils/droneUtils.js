// ── Drone Configuration ───────────────────────────────────────────────────────
export const DRONE_MODELS = {
  critical: ["Shahed-136", "Lancet-3", "KUB-BLA", "Harpy NG"],
  high:     ["Orlan-10", "Mohajer-6", "Bayraktar TB2", "WJ-700"],
  medium:   ["DJI Matrice 300", "Autel EVO II", "Parrot Anafi", "Skydio X2"],
  low:      ["DJI Mini 3", "Ryze Tello", "Holy Stone HS720", "Potensic D85"],
};

export const SEV = {
  critical: { color: "#ff2d55", glow: "rgba(255,45,85,0.45)",   bg: "rgba(255,45,85,0.08)",  label: "CRITICAL" },
  high:     { color: "#ff8c00", glow: "rgba(255,140,0,0.4)",    bg: "rgba(255,140,0,0.08)",  label: "HIGH"     },
  medium:   { color: "#ffd60a", glow: "rgba(255,214,10,0.35)",  bg: "rgba(255,214,10,0.07)", label: "MEDIUM"   },
  low:      { color: "#30d158", glow: "rgba(48,209,88,0.35)",   bg: "rgba(48,209,88,0.07)",  label: "LOW"      },
};

export const WINDOW_SEC = 300;

// Map projection constants - Metsokei Dragot area
export const LAT_MIN = 31.3, LAT_MAX = 31.9, LON_MIN = 35.1, LON_MAX = 35.7;

// Sensors configuration - spread for tactical, will appear clustered on satellite
export const SENSORS_BASE = [
  { id: "sens101", baseLat: 31.45, baseLon: 35.30, patrol: false },
  { id: "sens102", baseLat: 31.70, baseLon: 35.50, patrol: false },
  { id: "sens103", baseLat: 31.55, baseLon: 35.55, patrol: false },
  { id: "sens104", baseLat: 31.60, baseLon: 35.40, patrol: true  },
];

export const PATROL_LAT_MIN = 31.45;
export const PATROL_LAT_MAX = 31.75;
export const PATROL_SPEED = 0.000001;

export const ALL_SENSOR_IDS = SENSORS_BASE.map(s => s.id);

// ── Helper Functions ──────────────────────────────────────────────────────────
let uid = 1;

export function rand(min, max) { 
  return min + Math.random() * (max - min); 
}

export function randInt(min, max) { 
  return Math.floor(rand(min, max)); 
}

export function pick(arr) { 
  return arr[randInt(0, arr.length)]; 
}

export function assignDetectors() {
  const shuffled = [...ALL_SENSOR_IDS].sort(() => Math.random() - 0.5);
  const detectors = shuffled.slice(0, 1 + Math.floor(Math.random() * ALL_SENSOR_IDS.length));
  const signalStrength = {};
  detectors.forEach(sid => {
    signalStrength[sid] = randInt(35, 99);
  });
  return { detectors, signalStrength };
}

export function spawnDrone(nowMs) {
  const sevKeys = ["critical", "high", "medium", "low"];
  const weights = [1, 3, 6, 9];
  let r = Math.random() * 19, sev = "low";
  for (let i = 0, acc = 0; i < sevKeys.length; i++) { 
    acc += weights[i]; 
    if (r < acc) { sev = sevKeys[i]; break; } 
  }
  // Initial spawn spread wide (tactical view), movement code handles per-mode bounds
  const lat = rand(31.35, 31.85);
  const lon = rand(35.15, 35.65);
  const spd = 0.000002 + Math.random() * 0.000001;
  const angle = Math.random() * Math.PI * 2;
  return {
    id: uid++,
    model: pick(DRONE_MODELS[sev]),
    severity: sev,
    threatScore: sev === "critical" ? randInt(88, 100) : sev === "high" ? randInt(65, 87) : sev === "medium" ? randInt(35, 64) : randInt(10, 34),
    confidence: randInt(70, 99),
    lat, lon,
    vLat: Math.sin(angle) * spd,
    vLon: Math.cos(angle) * spd,
    targetLat: rand(31.35, 31.85),
    targetLon: rand(35.15, 35.65),
    spd,
    altitude: randInt(50, 800),
    speed: randInt(20, 180),
    heading: (Math.atan2(Math.cos(angle), Math.sin(angle)) * 180 / Math.PI + 360) % 360,
    detectedMs: nowMs,
    durationMs: rand(120, 300) * 1000,
    status: "active",
    ...(() => {
      const { detectors, signalStrength } = assignDetectors();
      return { detectedBy: detectors, signalStrength };
    })(),
  };
}

export function formatTime(ms) {
  return new Date(ms).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function secLabel(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

export function project(lat, lon, w, h) {
  return {
    x: ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * w,
    y: h - ((lat - LAT_MIN) / (LAT_MAX - LAT_MIN)) * h
  };
}

// Sensor state management
const _sensorState = SENSORS_BASE.map(s => ({ ...s, lat: s.baseLat, lon: s.baseLon, vLat: s.patrol ? PATROL_SPEED : 0 }));

export function tickSensors(dt) {
  _sensorState.forEach(s => {
    if (!s.patrol) return;
    s.lat += s.vLat * dt;
    if (s.lat > PATROL_LAT_MAX) { s.lat = PATROL_LAT_MAX; s.vLat *= -1; }
    if (s.lat < PATROL_LAT_MIN) { s.lat = PATROL_LAT_MIN; s.vLat *= -1; }
  });
  return _sensorState;
}
