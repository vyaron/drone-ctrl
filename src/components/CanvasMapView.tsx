import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { project, type Drone } from '../utils/droneUtils';
import { drawGrid, drawProtectedZone, drawSensors, drawDrones, drawTrails, updateTrails, type TrailPoint } from './canvas';
import { DroneTooltip } from './DroneTooltip';
import { TrailToggleButton } from './TrailToggleButton';

interface CanvasMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  dims: { w: number; h: number };
  paused?: boolean;
}

export function CanvasMapView({ 
  dronesRef, 
  selected, 
  onSelect, 
  filterFn, 
  dims,
  paused = false
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
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Clear trails on mount
  useEffect(() => {
    trailsRef.current.clear();
  }, []);

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

      // Calculate dt for sensors and trails (0 when paused)
      const rawDt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 100) : 16;
      const dt = pausedRef.current ? 0 : rawDt;
      lastTsRef.current = ts;

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
