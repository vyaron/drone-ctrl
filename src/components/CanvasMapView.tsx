import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { project, rand, type Drone } from '../utils/droneUtils';
import { drawGrid, drawProtectedZone, drawSensors, drawDrones, drawTrails, updateTrails, type TrailPoint } from './canvas';
import { DroneTooltip } from './DroneTooltip';
import { TrailToggleButton } from './TrailToggleButton';

// Tactical mode bounds (spread drones across the map)
const BOUNDS = { 
  latMin: 31.35, 
  latMax: 31.85, 
  lonMin: 35.15, 
  lonMax: 35.65, 
  threshold: 0.03 
};

interface CanvasMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  dims: { w: number; h: number };
}

export function CanvasMapView({ 
  dronesRef, 
  selected, 
  onSelect, 
  filterFn, 
  dims 
}: CanvasMapViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<Drone | null>(null);
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [hover, setHover] = useState<Drone | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const [showTrails, setShowTrails] = useState(false);
  const showTrailsRef = useRef(showTrails);
  showTrailsRef.current = showTrails;

  // Initialize drone positions for tactical view
  useEffect(() => {
    const drones = dronesRef.current;
    trailsRef.current.clear();
    
    drones.forEach(d => {
      if (d.status === 'active') {
        d.lat = rand(BOUNDS.latMin, BOUNDS.latMax);
        d.lon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
        d.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
        d.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
      }
    });
  }, [dronesRef]);

  // Animation loop
  useEffect(() => {
    let raf: number;
    let isRunning = true;
    
    function draw(ts: number) {
      if (!isRunning) return;
      
      const canvas = canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(draw);
        return;
      }
      
      const { w, h } = dims;
      // Only resize canvas if dimensions changed
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      
      const drones = dronesRef.current;
      const selected = selectedRef.current;
      const showTrails = showTrailsRef.current;

      // Move drones each frame
      const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 100) : 16;
      lastTsRef.current = ts;

      drones.forEach(d => {
        if (d.status !== "active") return;
        const dLat = d.targetLat - d.lat;
        const dLon = d.targetLon - d.lon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < BOUNDS.threshold) {
          d.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
          d.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
        }
        // Speed calculation for tactical view - smooth movement
        const spdMult = 0.00002;
        const accel = 0.0001;
        d.vLat += (dLat / (dist || 1)) * d.spd * accel;
        d.vLon += (dLon / (dist || 1)) * d.spd * accel;
        // Apply friction to prevent runaway velocity
        d.vLat *= 0.98;
        d.vLon *= 0.98;
        const curSpd = Math.sqrt(d.vLat * d.vLat + d.vLon * d.vLon);
        const maxSpd = d.spd * spdMult;
        if (curSpd > maxSpd) { 
          d.vLat = d.vLat / curSpd * maxSpd; 
          d.vLon = d.vLon / curSpd * maxSpd; 
        }
        d.lat += d.vLat * dt;
        d.lon += d.vLon * dt;
        // Clamp to bounds
        if (d.lat < BOUNDS.latMin || d.lat > BOUNDS.latMax) { 
          d.vLat *= -1; 
          d.lat = Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, d.lat)); 
        }
        if (d.lon < BOUNDS.lonMin || d.lon > BOUNDS.lonMax) { 
          d.vLon *= -1; 
          d.lon = Math.max(BOUNDS.lonMin, Math.min(BOUNDS.lonMax, d.lon)); 
        }
        d.heading = (Math.atan2(d.vLon, d.vLat) * 180 / Math.PI + 360) % 360;
      });

      // Draw background, grid, etc.
      drawGrid(ctx, w, h, ts);
      drawProtectedZone(ctx, w, h);

      // Draw sensors
      const selectedDrone = selected ? drones.find(d => d.id === selected.id) : null;
      drawSensors(ctx, w, h, ts, dt, selectedDrone || null);

      // Get visible drones
      const hov = hoverRef.current;
      const fn = filterFnRef.current;
      const visibleDrones = fn 
        ? drones.filter(d => d.status === "active" && fn(d)) 
        : drones.filter(d => d.status === "active");

      // Update and draw trails
      if (showTrails) {
        updateTrails(trailsRef.current, visibleDrones, ts);
        drawTrails(ctx, trailsRef.current, visibleDrones, w, h, ts, selected);
      }

      // Draw drones
      drawDrones(ctx, visibleDrones, w, h, ts, selected, hov);

      raf = requestAnimationFrame(draw);
    }
    
    raf = requestAnimationFrame(draw);
    return () => {
      isRunning = false;
      cancelAnimationFrame(raf);
    };
  }, [dronesRef, dims]);

  function hitTest(e: React.MouseEvent<HTMLCanvasElement>): Drone | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = dims;
    const mx = (e.clientX - rect.left) * (w / rect.width);
    const my = (e.clientY - rect.top) * (h / rect.height);
    const fn = filterFnRef.current;
    const testable = dronesRef.current.filter(d => d.status === "active" && (fn ? fn(d) : true));
    for (const drone of testable) {
      const { x, y } = project(drone.lat, drone.lon, w, h);
      if (Math.hypot(mx - x, my - y) < 16) return drone;
    }
    return null;
  }

  const handleToggleTrails = () => {
    setShowTrails(t => {
      if (t) trailsRef.current.clear();
      return !t;
    });
  };

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <TrailToggleButton showTrails={showTrails} onToggle={handleToggleTrails} />

      <canvas 
        ref={canvasRef}
        onClick={e => { const d = hitTest(e); onSelect(d || null); }}
        onMouseMove={e => { const d = hitTest(e); hoverRef.current = d || null; setHover(d || null); }}
        style={{ 
          display: "block", 
          width: "100%", 
          height: "100%", 
          cursor: hover ? "pointer" : "crosshair" 
        }}
      />

      {hover && (
        <DroneTooltip 
          drone={hover} 
          w={dims.w} 
          h={dims.h} 
          containerRect={containerRef.current?.getBoundingClientRect() || null} 
        />
      )}
    </div>
  );
}
