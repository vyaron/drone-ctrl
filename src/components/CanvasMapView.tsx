import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { project, SENSORS_BASE, type Drone, type Detection } from '../utils/droneUtils';
import { drawGrid, drawProtectedZone, drawSensors, drawDrones, drawTrails, updateTrails, drawDirectionWedge, drawDetectionIndicators, hitTestWedge, type TrailPoint, type WedgeHitArea } from './canvas';
import { DroneTooltip } from './DroneTooltip';
import { TrailToggleButton } from './TrailToggleButton';

interface WedgeHitInfo {
  hitArea: WedgeHitArea;
  drone: Drone;
}

interface DetectionHitInfo {
  x: number;
  y: number;
  r: number;
  drone: Drone;
}

interface CanvasMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  dims: { w: number; h: number };
  paused?: boolean;
  detectionsRef?: MutableRefObject<Detection[]>;
  currentTs?: number;
}

export function CanvasMapView({ 
  dronesRef, 
  selected, 
  onSelect, 
  filterFn, 
  dims,
  paused = false,
  detectionsRef,
  currentTs
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
  
  // Hit areas for direction wedges and detection indicators
  const wedgeHitAreasRef = useRef<WedgeHitInfo[]>([]);
  const detectionHitAreasRef = useRef<DetectionHitInfo[]>([]);

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

      // Draw direction wedges and detection indicators (if detections provided)
      const detections = detectionsRef?.current || [];
      const replayTs = currentTs ?? ts;
      
      // Clear hit areas each frame
      const newWedgeHitAreas: WedgeHitInfo[] = [];
      const newDetectionHitAreas: DetectionHitInfo[] = [];
      
      if (detections.length > 0) {
        // Draw direction wedges first (behind drones) - NOT detection level ones
        // And collect hit areas for click handling
        detections
          .filter(d => d.level === 'direction')
          .filter(d => replayTs >= d.startedAt && replayTs <= d.endedAt)
          .forEach(det => {
            if (det.bearing !== undefined && det.bearingWidth !== undefined) {
              const hitArea = drawDirectionWedge(ctx, w, h, det.bearing, det.bearingWidth, det.colorIndex);
              // Find associated drone for click handling
              const associatedDrone = drones.find(d => d.id === det.droneId);
              if (associatedDrone) {
                newWedgeHitAreas.push({ hitArea, drone: associatedDrone });
              }
            }
          });
        
        // Draw detection indicators on sensors (pass replayTs for animation timing)
        const activeDetectionLevelEvents = detections.filter(d => 
          d.level === 'detection' && replayTs >= d.startedAt && replayTs <= d.endedAt
        );
        if (activeDetectionLevelEvents.length > 0) {
          drawDetectionIndicators(ctx, w, h, ts, activeDetectionLevelEvents);
          // Collect hit areas for detection indicators in replay mode  
          for (const det of activeDetectionLevelEvents) {
            const sensor = SENSORS_BASE.find(s => s.id === det.sensorId);
            const associatedDrone = drones.find(d => d.id === det.droneId);
            if (sensor && associatedDrone) {
              const { x: sx, y: sy } = project(sensor.lat, sensor.lon, w, h);
              newDetectionHitAreas.push({ x: sx, y: sy, r: 25, drone: associatedDrone });
            }
          }
        }
      }
      
      // Draw direction wedges for live drones with level='direction' AND collect hit areas
      drones
        .filter(d => d.status === 'active' && d.level === 'direction')
        .forEach(drone => {
          if (drone.bearing !== undefined && drone.bearingWidth !== undefined) {
            const hitArea = drawDirectionWedge(ctx, w, h, drone.bearing, drone.bearingWidth, drone.colorIndex);
            newWedgeHitAreas.push({ hitArea, drone });
          }
        });
      
      // Draw detection indicators for live drones with level='detection'
      const liveDetectionDrones = drones.filter(d => d.status === 'active' && d.level === 'detection');
      const detectionDronesMap = new Map(liveDetectionDrones.map(d => [d.id, d]));
      
      const detectionData = liveDetectionDrones.map(d => ({
        id: d.id,
        droneId: d.id,
        droneType: d.model,
        colorIndex: d.colorIndex,
        startedAt: d.detectedMs,
        endedAt: d.detectedMs + d.durationMs,
        frequencies: [],
        freqHistory: d.freqHistory,
        freqBand: d.freqBand,
        level: 'detection' as const,
        sensorId: d.sensorId || d.detectedBy[0] || 'unit101',
      }));
      
      if (detectionData.length > 0) {
        const result = drawDetectionIndicators(ctx, w, h, ts, detectionData);
        // Store hit areas with drone references
        for (const drone of liveDetectionDrones) {
          const det = detectionData.find(d => d.id === drone.id);
          if (det) {
            // Get the hit areas from the result
            // We need to check each detection indicator position
            const { x: sx, y: sy } = project(
              SENSORS_BASE.find(s => s.id === det.sensorId)?.lat ?? 0,
              SENSORS_BASE.find(s => s.id === det.sensorId)?.lon ?? 0,
              w, h
            );
            newDetectionHitAreas.push({ x: sx, y: sy, r: 25, drone });
          }
        }
      }
      
      // Store hit areas in refs for click handling
      wedgeHitAreasRef.current = newWedgeHitAreas;
      detectionHitAreasRef.current = newDetectionHitAreas;

      // Get visible drones - only show location-level drones as icons
      const hov = hoverRef.current;
      const fn = filterFnRef.current;
      const visibleDrones = (fn 
        ? drones.filter(d => d.status === "active" && fn(d)) 
        : drones.filter(d => d.status === "active")
      ).filter(d => !d.level || d.level === 'location'); // Only location-level or unset

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
    
    // 1. Check drone icons first (highest priority)
    const testable = dronesRef.current.filter(d => d.status === "active" && (fn ? fn(d) : true));
    for (const drone of testable) {
      const { x, y } = project(drone.lat, drone.lon, w, h);
      if (Math.hypot(mx - x, my - y) < 16) return drone;
    }
    
    // 2. Check detection indicator circles
    for (const hit of detectionHitAreasRef.current) {
      if (Math.hypot(mx - hit.x, my - hit.y) < hit.r) {
        return hit.drone;
      }
    }
    
    // 3. Check direction wedges
    for (const hit of wedgeHitAreasRef.current) {
      if (hitTestWedge(mx, my, hit.hitArea)) {
        return hit.drone;
      }
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
