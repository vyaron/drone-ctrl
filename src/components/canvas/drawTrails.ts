import { project, DRONE_COLORS, type Drone } from '../../utils/droneUtils';

export interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

const TRAIL_DURATION = 90000; // 1.5 minutes
const TRAIL_SAMPLE_INTERVAL = 300; // Sample position every 300ms

export function updateTrails(
  trails: Map<string, TrailPoint[]>,
  drones: Drone[],
  ts: number
): void {
  const visibleIds = new Set(drones.map(d => d.id));
  
  // Update trails for visible drones
  drones.forEach(drone => {
    let trail = trails.get(drone.id);
    if (!trail) {
      trail = [];
      trails.set(drone.id, trail);
    }
    
    // Add current position if enough time passed
    const lastPoint = trail[trail.length - 1];
    if (!lastPoint || ts - lastPoint.ts > TRAIL_SAMPLE_INTERVAL) {
      trail.push({ lat: drone.lat, lon: drone.lon, ts });
    }
    
    // Remove old points
    while (trail.length > 0 && ts - trail[0].ts > TRAIL_DURATION) {
      trail.shift();
    }
  });
  
  // Clean up trails for drones that are no longer visible
  trails.forEach((_, id) => {
    if (!visibleIds.has(id)) trails.delete(id);
  });
}

export function drawTrails(
  ctx: CanvasRenderingContext2D,
  trails: Map<string, TrailPoint[]>,
  drones: Drone[],
  w: number,
  h: number,
  ts: number,
  selected: Drone | null
): void {
  drones.forEach(drone => {
    const trail = trails.get(drone.id);
    if (!trail || trail.length === 0) return;
    
    const cfg = DRONE_COLORS[drone.colorIndex % DRONE_COLORS.length];
    const isSel = selected?.id === drone.id;
    const droneAlpha = selected && !isSel ? 0.15 : 1;
    
    trail.forEach((pt, idx) => {
      if (idx === trail.length - 1) return; // Skip current position (drone is there)
      const age = ts - pt.ts;
      const alpha = Math.max(0, 1 - age / TRAIL_DURATION) * 0.6 * droneAlpha;
      
      const { x: px, y: py } = project(pt.lat, pt.lon, w, h);
      ctx.beginPath();
      ctx.arc(px, py, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = cfg.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
      ctx.fill();
    });
  });
}
