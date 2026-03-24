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
  indicatorX: number;  // Actual screen position of indicator
  indicatorY: number;
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
  showHeadingIndicator?: boolean;
}

export function CanvasMapView({ 
  dronesRef, 
  selected, 
  onSelect, 
  filterFn, 
  dims,
  paused = false,
  detectionsRef,
  currentTs,
  showHeadingIndicator = true
}: CanvasMapViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<Drone | null>(null);
  const hoverPosRef = useRef<{ x: number; y: number } | null>(null);
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [hover, setHover] = useState<Drone | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const [showTrails, setShowTrails] = useState(false);
  const showTrailsRef = useRef(showTrails);
  showTrailsRef.current = showTrails;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  
  // Keep currentTs in ref so animation loop can access latest value
  const currentTsRef = useRef(currentTs);
  currentTsRef.current = currentTs;
  
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
      const replayTs = currentTsRef.current ?? ts;
      
      // DEBUG: very visible logging - log on every significant change
      if (detections.length > 0) {
        const now = Date.now();
        const dirDets = detections.filter(d => d.level === 'direction');
        const detDets = detections.filter(d => d.level === 'detection');
        const activeDir = dirDets.filter(d => replayTs >= d.startedAt && replayTs <= d.endedAt);
        const activeDet = detDets.filter(d => replayTs >= d.startedAt && replayTs <= d.endedAt);
        
      }
      
      // Clear hit areas each frame
      const newWedgeHitAreas: WedgeHitInfo[] = [];
      const newDetectionHitAreas: DetectionHitInfo[] = [];
      
      if (detections.length > 0) {
        // Draw direction wedges first (behind drones) - NOT detection level ones
        // And collect hit areas for click handling
        const activeDirectionDets = detections
          .filter(d => d.level === 'direction')
          .filter(d => replayTs >= d.startedAt && replayTs <= d.endedAt);
        
        activeDirectionDets.forEach(det => {
            if (det.bearing !== undefined && det.bearingWidth !== undefined) {
              const hitArea = drawDirectionWedge(ctx, w, h, det.bearing, det.bearingWidth, det.colorIndex);
              // Create virtual drone for hover/click - direction level detections don't have real drones
              const virtualDrone: Drone = {
                id: det.droneId,
                lat: 0,
                lon: 0,
                heading: det.bearing ?? 0,
                status: 'active',
                model: det.droneType,
                colorIndex: det.colorIndex,
                detectedMs: det.startedAt,
                durationMs: det.endedAt - det.startedAt,
                detectedBy: [det.sensorId],
                frequency: det.frequencies[0] || 0,
                freqHistory: det.freqHistory,
                freqBand: det.freqBand,
                level: det.level,
                bearing: det.bearing,
                bearingWidth: det.bearingWidth,
                sensorId: det.sensorId,
              };
              newWedgeHitAreas.push({ hitArea, drone: virtualDrone });
            }
          });
        
        // Draw detection indicators on sensors (pass replayTs for animation timing)
        const activeDetectionLevelEvents = detections.filter(d => 
          d.level === 'detection' && replayTs >= d.startedAt && replayTs <= d.endedAt
        );
        if (activeDetectionLevelEvents.length > 0) {
          drawDetectionIndicators(ctx, w, h, ts, activeDetectionLevelEvents);
          
          // Calculate actual indicator positions for replay mode (replicate logic from drawDetectionIndicators)
          const detectionBySensor = new Map<string, Detection[]>();
          activeDetectionLevelEvents.forEach(d => {
            const list = detectionBySensor.get(d.sensorId) || [];
            list.push(d);
            detectionBySensor.set(d.sensorId, list);
          });
          
          SENSORS_BASE.forEach(s => {
            const sensorDetections = detectionBySensor.get(s.id);
            if (!sensorDetections || sensorDetections.length === 0) return;
            
            const { x: sx, y: sy } = project(s.lat, s.lon, w, h);
            const radius = 25;
            const angleStep = (Math.PI * 2) / Math.max(sensorDetections.length, 1);
            
            sensorDetections.forEach((det, i) => {
              const angle = i * angleStep - Math.PI / 2;
              const indicatorX = sx + Math.cos(angle) * radius;
              const indicatorY = sy + Math.sin(angle) * radius;
              
              // Create virtual drone for hover/click
              const virtualDrone: Drone = {
                id: det.droneId,
                lat: s.lat,
                lon: s.lon,
                heading: 0,
                status: 'active',
                model: det.droneType,
                colorIndex: det.colorIndex,
                detectedMs: det.startedAt,
                durationMs: det.endedAt - det.startedAt,
                detectedBy: [det.sensorId],
                frequency: det.frequencies[0] || 0,
                freqHistory: det.freqHistory,
                freqBand: det.freqBand,
                level: det.level,
                sensorId: det.sensorId,
              };
              newDetectionHitAreas.push({ x: indicatorX, y: indicatorY, r: 14, drone: virtualDrone, indicatorX, indicatorY });
            });
          });
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
        drawDetectionIndicators(ctx, w, h, ts, detectionData);
        
        // Calculate actual indicator positions (replicate logic from drawDetectionIndicators)
        const detectionBySensor = new Map<string, typeof detectionData>();
        detectionData.forEach(d => {
          const list = detectionBySensor.get(d.sensorId) || [];
          list.push(d);
          detectionBySensor.set(d.sensorId, list);
        });
        
        SENSORS_BASE.forEach(s => {
          const sensorDetections = detectionBySensor.get(s.id);
          if (!sensorDetections || sensorDetections.length === 0) return;
          
          const { x: sx, y: sy } = project(s.lat, s.lon, w, h);
          const radius = 25;
          const angleStep = (Math.PI * 2) / Math.max(sensorDetections.length, 1);
          
          sensorDetections.forEach((det, i) => {
            const angle = i * angleStep - Math.PI / 2;
            const indicatorX = sx + Math.cos(angle) * radius;
            const indicatorY = sy + Math.sin(angle) * radius;
            const drone = liveDetectionDrones.find(d => d.id === det.id);
            if (drone) {
              newDetectionHitAreas.push({ x: indicatorX, y: indicatorY, r: 14, drone, indicatorX, indicatorY });
            }
          });
        });
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
        // Store indicator position for tooltip
        hoverPosRef.current = { x: hit.indicatorX, y: hit.indicatorY };
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
        onMouseMove={e => { 
          hoverPosRef.current = null; // Reset before hitTest
          const d = hitTest(e); 
          hoverRef.current = d || null; 
          setHover(d || null); 
          setHoverPos(hoverPosRef.current);
        }}
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
          screenPos={hoverPos}
        />
      )}
    </div>
  );
}
