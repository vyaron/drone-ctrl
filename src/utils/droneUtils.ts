// Types
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export interface SeverityConfig {
  label: string;
  color: string;
  glow: string;
  bg: string;
}

export interface FreqSample {
  ts: number;        // timestamp in ms
  freq: number;      // frequency in MHz (100-6000)
  strength: number;  // signal strength 0-100
}

// Common drone frequency bands (MHz)
export const FREQ_BANDS = {
  BAND_475: { min: 475, max: 495, label: '475 MHz', color: 'rgba(138,43,226,0.15)' },
  BAND_750: { min: 750, max: 850, label: '750-850', color: 'rgba(255,45,85,0.15)' },
  BAND_900: { min: 902, max: 928, label: '902-928', color: 'rgba(255,140,0,0.15)' },
  ISM_2_4G: { min: 2390, max: 2500, label: 'ISM 2.4G', color: 'rgba(255,214,10,0.15)' },
  BAND_5150: { min: 5150, max: 5200, label: '5.1G', color: 'rgba(0,212,255,0.15)' },
  ISM_5_8G: { min: 5700, max: 5900, label: 'ISM 5.8G', color: 'rgba(48,209,88,0.15)' },
} as const;

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
  freqHistory: FreqSample[];
  currentFreq: number;       // current frequency in MHz
  freqBand: keyof typeof FREQ_BANDS; // which band this drone operates in
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

// Generate a random frequency within a band with slight jitter
export function getFreqInBand(band: keyof typeof FREQ_BANDS): number {
  const { min, max } = FREQ_BANDS[band];
  return rand(min, max);
}

// Add a freq sample to drone's history
export function addFreqSample(drone: Drone, ts: number): void {
  const band = FREQ_BANDS[drone.freqBand];
  const bandRange = band.max - band.min;
  
  // More aggressive frequency hopping
  const hopChance = Math.random();
  if (hopChance < 0.25) {
    // Big jump - anywhere in band
    drone.currentFreq = getFreqInBand(drone.freqBand);
  } else if (hopChance < 0.5) {
    // Medium jump - 20-50% of band range
    const jump = rand(-0.25, 0.25) * bandRange;
    drone.currentFreq = Math.max(band.min, Math.min(band.max, drone.currentFreq + jump));
  } else {
    // Small drift
    const drift = rand(-0.1, 0.1) * bandRange;
    drone.currentFreq = Math.max(band.min, Math.min(band.max, drone.currentFreq + drift));
  }
  
  drone.freqHistory.push({
    ts,
    freq: drone.currentFreq,
    strength: randInt(40, 95),
  });
  
  // Keep history bounded (last 5 min at 250ms = 1200 samples max)
  if (drone.freqHistory.length > 1200) {
    drone.freqHistory.shift();
  }
}

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

  // Assign random frequency band - weighted towards common bands
  const bandOptions: (keyof typeof FREQ_BANDS)[] = [
    'ISM_2_4G', 'ISM_2_4G', 'ISM_2_4G', // Most common
    'ISM_5_8G', 'ISM_5_8G',
    'BAND_5150',
    'BAND_900',
    'BAND_750',
    'BAND_475',
  ];
  const freqBand = pick(bandOptions);
  const currentFreq = getFreqInBand(freqBand);
  
  // Generate initial freq history going back from detection time
  const freqHistory: FreqSample[] = [];
  const historyDuration = Math.min(detectAt - (Date.now() - WINDOW_SEC * 1000), 60000); // up to 1 min of history
  if (historyDuration > 0) {
    let tempFreq = currentFreq;
    const band = FREQ_BANDS[freqBand];
    const bandRange = band.max - band.min;
    for (let t = detectAt - historyDuration; t <= detectAt; t += 250) {
      // More varied hopping simulation
      const hopChance = Math.random();
      if (hopChance < 0.25) {
        tempFreq = getFreqInBand(freqBand);
      } else if (hopChance < 0.5) {
        const jump = rand(-0.25, 0.25) * bandRange;
        tempFreq = Math.max(band.min, Math.min(band.max, tempFreq + jump));
      } else {
        const drift = rand(-0.1, 0.1) * bandRange;
        tempFreq = Math.max(band.min, Math.min(band.max, tempFreq + drift));
      }
      freqHistory.push({
        ts: t,
        freq: tempFreq,
        strength: randInt(40, 95),
      });
    }
  }

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
    freqHistory,
    currentFreq,
    freqBand,
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

// ====== Events Report Types ======

export interface PositionSample {
  ts: number;
  lat: number;
  lon: number;
  heading: number;
}

export interface Detection {
  id: string;
  droneId: string;
  droneType: string;          // e.g., "DJI Phantom 4 Pro"
  severity: SeverityLevel;
  startedAt: number;          // timestamp ms
  endedAt: number;            // timestamp ms
  frequencies: number[];      // MHz values detected
  lat: number;
  lon: number;
  positionHistory: PositionSample[];  // Full trajectory for replay
  freqHistory: FreqSample[];          // Frequency samples
  freqBand: keyof typeof FREQ_BANDS;
}

export interface Event {
  id: string;
  startedAt: number;
  endedAt: number;
  detections: Detection[];
}

// Generate mock events for the Events Report
export function generateMockEvents(
  timeRange: { start: number; end: number },
  threatTypes: Set<SeverityLevel>
): Event[] {
  const events: Event[] = [];
  const duration = timeRange.end - timeRange.start;
  
  // Generate 5-12 events spread across time range
  const eventCount = 5 + Math.floor(Math.random() * 8);
  const severities: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
  
  for (let i = 0; i < eventCount; i++) {
    const eventStart = timeRange.start + (i / eventCount) * duration * 0.8 + Math.random() * duration * 0.1;
    const eventDuration = randInt(5, 45) * 60 * 1000; // 5-45 minutes
    const eventEnd = Math.min(eventStart + eventDuration, timeRange.end);
    
    // Generate 1-5 detections per event
    const detectionCount = randInt(1, 5);
    const detections: Detection[] = [];
    
    for (let j = 0; j < detectionCount; j++) {
      const severity = pick(severities);
      if (!threatTypes.has(severity)) continue;
      
      const detStart = eventStart + Math.random() * (eventEnd - eventStart) * 0.3;
      const detDuration = randInt(2, 20) * 60 * 1000; // 2-20 minutes
      const detEnd = Math.min(detStart + detDuration, eventEnd);
      
      // Generate random frequencies detected
      const freqBand = pick(['ISM_2_4G', 'ISM_5_8G', 'BAND_5150', 'BAND_900'] as (keyof typeof FREQ_BANDS)[]);
      const band = FREQ_BANDS[freqBand];
      const frequencies: number[] = [];
      const freqCount = randInt(1, 4);
      for (let f = 0; f < freqCount; f++) {
        frequencies.push(Math.round(rand(band.min, band.max)));
      }
      
      // Generate position history (one sample per second)
      const startLat = rand(LAT_MIN, LAT_MAX);
      const startLon = rand(LON_MIN, LON_MAX);
      const positionHistory: PositionSample[] = [];
      const freqHistory: FreqSample[] = [];
      
      let curLat = startLat;
      let curLon = startLon;
      let targetLat = rand(LAT_MIN, LAT_MAX);
      let targetLon = rand(LON_MIN, LON_MAX);
      let vLat = 0;
      let vLon = 0;
      const spd = rand(0.4, 1.2);
      let currentFreq = rand(band.min, band.max);
      
      for (let ts = detStart; ts <= detEnd; ts += 1000) {
        // Movement simulation
        const dLat = targetLat - curLat;
        const dLon = targetLon - curLon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        
        if (dist < 0.03) {
          targetLat = rand(LAT_MIN, LAT_MAX);
          targetLon = rand(LON_MIN, LON_MAX);
        }
        
        const spdMult = 0.000008;
        const accel = 0.00005;
        vLat += (dLat / (dist || 1)) * spd * accel;
        vLon += (dLon / (dist || 1)) * spd * accel;
        vLat *= 0.98;
        vLon *= 0.98;
        
        const curSpd = Math.sqrt(vLat * vLat + vLon * vLon);
        const maxSpd = spd * spdMult;
        if (curSpd > maxSpd) {
          vLat = vLat / curSpd * maxSpd;
          vLon = vLon / curSpd * maxSpd;
        }
        
        curLat += vLat * 1000;
        curLon += vLon * 1000;
        curLat = Math.max(LAT_MIN, Math.min(LAT_MAX, curLat));
        curLon = Math.max(LON_MIN, Math.min(LON_MAX, curLon));
        
        const heading = (Math.atan2(vLon, vLat) * 180 / Math.PI + 360) % 360;
        
        positionHistory.push({ ts, lat: curLat, lon: curLon, heading });
        
        // Freq sample every 250ms intervals
        if ((ts - detStart) % 250 === 0) {
          const hopChance = Math.random();
          const bandRange = band.max - band.min;
          if (hopChance < 0.25) {
            currentFreq = rand(band.min, band.max);
          } else if (hopChance < 0.5) {
            const jump = rand(-0.25, 0.25) * bandRange;
            currentFreq = Math.max(band.min, Math.min(band.max, currentFreq + jump));
          } else {
            const drift = rand(-0.1, 0.1) * bandRange;
            currentFreq = Math.max(band.min, Math.min(band.max, currentFreq + drift));
          }
          freqHistory.push({ ts, freq: currentFreq, strength: randInt(40, 95) });
        }
      }
      
      detections.push({
        id: `det-${i + 1}-${j + 1}`,
        droneId: `drone-evt-${i + 1}-${j + 1}`,
        droneType: pick(DRONE_MODELS[severity]),
        severity,
        startedAt: detStart,
        endedAt: detEnd,
        frequencies: frequencies.sort((a, b) => a - b),
        lat: startLat,
        lon: startLon,
        positionHistory,
        freqHistory,
        freqBand,
      });
    }
    
    if (detections.length === 0) continue;
    
    // Sort detections by start time
    detections.sort((a, b) => a.startedAt - b.startedAt);
    
    events.push({
      id: `event-${i + 1}`,
      startedAt: Math.min(...detections.map(d => d.startedAt)),
      endedAt: Math.max(...detections.map(d => d.endedAt)),
      detections,
    });
  }
  
  // Sort events by start time descending (newest first)
  return events.sort((a, b) => b.startedAt - a.startedAt);
}

// ====== Replay Utilities ======

// Convert Detection to Drone at a specific timestamp for replay
export function detectionToDrone(detection: Detection, currentTs: number): Drone | null {
  // Check if detection is active at this timestamp
  if (currentTs < detection.startedAt || currentTs > detection.endedAt) {
    return null;
  }
  
  // Find position at current timestamp (interpolate between samples)
  const history = detection.positionHistory;
  if (history.length === 0) {
    return null;
  }
  
  // Find the two samples to interpolate between
  let pos = history[0];
  for (let i = 0; i < history.length - 1; i++) {
    if (history[i].ts <= currentTs && history[i + 1].ts >= currentTs) {
      const t = (currentTs - history[i].ts) / (history[i + 1].ts - history[i].ts);
      pos = {
        ts: currentTs,
        lat: history[i].lat + t * (history[i + 1].lat - history[i].lat),
        lon: history[i].lon + t * (history[i + 1].lon - history[i].lon),
        heading: history[i].heading, // Use start heading (could interpolate but edge cases)
      };
      break;
    }
    if (history[i].ts > currentTs) break;
    pos = history[i];
  }
  
  // Find current frequency
  let currentFreq = detection.frequencies[0] || 2400;
  let freqBand = detection.freqBand;
  for (const sample of detection.freqHistory) {
    if (sample.ts <= currentTs) {
      currentFreq = sample.freq;
    } else break;
  }
  
  // Filter freq history up to current time
  const freqHistory = detection.freqHistory.filter(s => s.ts <= currentTs);
  
  return {
    id: detection.droneId,
    model: detection.droneType,
    severity: detection.severity,
    status: 'active',
    detectedMs: detection.startedAt,
    durationMs: detection.endedAt - detection.startedAt,
    lat: pos.lat,
    lon: pos.lon,
    targetLat: pos.lat,
    targetLon: pos.lon,
    vLat: 0,
    vLon: 0,
    heading: pos.heading,
    altitude: randInt(20, 400),
    speed: randInt(5, 80),
    spd: 1,
    threatScore: randInt(30, 99),
    rfSig: randInt(-90, -30),
    detectedBy: [SENSORS_BASE[0].id],
    freqHistory,
    currentFreq,
    freqBand,
  };
}

// Convert all detections in an event to drones at a specific timestamp
export function eventToDrones(event: Event, currentTs: number): Drone[] {
  const drones: Drone[] = [];
  for (const detection of event.detections) {
    const drone = detectionToDrone(detection, currentTs);
    if (drone) {
      drones.push(drone);
    }
  }
  return drones;
}
