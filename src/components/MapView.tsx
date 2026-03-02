import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { 
  SEV, 
  LAT_MIN, 
  LAT_MAX, 
  LON_MIN, 
  LON_MAX, 
  project, 
  tickSensors, 
  rand, 
  SENSORS_BASE,
  type Drone,
  type SeverityLevel
} from '../utils/droneUtils';

const GMAP_API_KEY = 'AIzaSyCaQVlcIeYewnFSmm3xkL2d3HHy9xhYbz4';

// Extend Window interface for Google Maps callback
declare global {
  interface Window {
    initGoogleMap?: () => void;
    google?: typeof google;
  }
}

interface TrailPoint {
  lat: number;
  lon: number;
  ts: number;
}

// Factory to create DroneOverlay class (needs Google Maps API loaded first)
let DroneOverlayClass: (new (
  position: google.maps.LatLng,
  color: string,
  severity: SeverityLevel,
  isSelected: boolean,
  onClick: () => void
) => google.maps.OverlayView & {
  update: (position: google.maps.LatLng, color: string, severity: SeverityLevel, isSelected: boolean) => void;
}) | null = null;

function getDroneOverlayClass() {
  if (DroneOverlayClass) return DroneOverlayClass;
  if (!window.google?.maps?.OverlayView) return null;
  
  DroneOverlayClass = class extends window.google.maps.OverlayView {
    position: google.maps.LatLng;
    color: string;
    severity: SeverityLevel;
    isSelected: boolean;
    onClick: () => void;
    div: HTMLDivElement | null = null;

    constructor(
      position: google.maps.LatLng, 
      color: string, 
      severity: SeverityLevel, 
      isSelected: boolean, 
      onClick: () => void
    ) {
      super();
      this.position = position;
      this.color = color;
      this.severity = severity;
      this.isSelected = isSelected;
      this.onClick = onClick;
    }
    
    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.cursor = 'pointer';
      this.div.addEventListener('click', () => this.onClick?.());
      this.updateContent();
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(this.div);
    }
    
    updateContent() {
      if (!this.div) return;
      const rings = this.severity === 'critical' ? 3 : this.severity === 'high' ? 2 : 1;
      const size = 60;
      const center = size / 2;
      
      this.div.innerHTML = `
        <svg width="${size}" height="${size}" style="overflow:visible;position:absolute;left:-${center}px;top:-${center}px;">
          <style>
            @keyframes pulse-ring {
              0% { r: 8; opacity: 0.6; }
              100% { r: 22; opacity: 0; }
            }
            .pulse-ring { animation: pulse-ring 2s ease-out infinite; }
            .pulse-ring-1 { animation-delay: 0s; }
            .pulse-ring-2 { animation-delay: 0.66s; }
            .pulse-ring-3 { animation-delay: 1.33s; }
          </style>
          ${Array.from({length: rings}, (_, i) => `
            <circle class="pulse-ring pulse-ring-${i+1}" cx="${center}" cy="${center}" r="8" 
              fill="none" stroke="${this.color}" stroke-width="1.5"/>
          `).join('')}
          <circle cx="${center}" cy="${center}" r="${this.isSelected ? 8 : 6}" 
            fill="${this.color}" 
            stroke="${this.isSelected ? '#ffffff' : this.color}" 
            stroke-width="${this.isSelected ? 2 : 1}"
            style="filter: drop-shadow(0 0 ${this.isSelected ? 8 : 4}px ${this.color});"/>
          ${this.isSelected ? `<circle cx="${center}" cy="${center}" r="13" fill="none" stroke="#ffffff" stroke-width="1.5"/>` : ''}
        </svg>
      `;
    }
    
    update(position: google.maps.LatLng, color: string, severity: SeverityLevel, isSelected: boolean) {
      this.position = position;
      const needsRedraw = this.color !== color || this.severity !== severity || this.isSelected !== isSelected;
      this.color = color;
      this.severity = severity;
      this.isSelected = isSelected;
      if (needsRedraw) this.updateContent();
      this.draw();
    }
    
    draw() {
      if (!this.div) return;
      const overlayProjection = this.getProjection();
      if (!overlayProjection) return;
      const pos = overlayProjection.fromLatLngToDivPixel(this.position);
      if (pos) {
        this.div.style.left = pos.x + 'px';
        this.div.style.top = pos.y + 'px';
      }
    }
    
    onRemove() {
      if (this.div) {
        this.div.parentNode?.removeChild(this.div);
        this.div = null;
      }
    }
  };
  
  return DroneOverlayClass;
}

interface MapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  mode?: 'canvas' | 'google';
}

function MapView({ dronesRef, selected, onSelect, filterFn, mode = 'canvas' }: MapViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<Drone | null>(null);
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const [hover, setHover] = useState<Drone | null>(null);
  const dimsRef = useRef({ w: 800, h: 500 });
  const [, forceUpdate] = useState(0);
  const lastTsRef = useRef<number | null>(null);
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const zoomLevelRef = useRef(18);
  const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
  const showTrailsRef = useRef(false);
  const [showTrails, setShowTrails] = useState(false);
  showTrailsRef.current = showTrails;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      dimsRef.current = { w: Math.floor(width), h: Math.floor(height) };
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset drone positions when switching modes
  useEffect(() => {
    const drones = dronesRef.current;
    // Clear trails when switching modes
    trailsRef.current.clear();
    
    if (mode === 'canvas') {
      // Spread drones for tactical view
      drones.forEach(d => {
        if (d.status === 'active') {
          d.lat = rand(31.35, 31.85);
          d.lon = rand(35.15, 35.65);
          d.targetLat = rand(31.35, 31.85);
          d.targetLon = rand(35.15, 35.65);
        }
      });
    } else {
      // Cluster drones for satellite view
      drones.forEach(d => {
        if (d.status === 'active') {
          d.lat = rand(31.589, 31.593);
          d.lon = rand(35.391, 35.395);
          d.targetLat = rand(31.589, 31.593);
          d.targetLon = rand(35.391, 35.395);
          d.vLat = 0;
          d.vLon = 0;
        }
      });
    }
  }, [mode, dronesRef]);

  useEffect(() => {
    let raf: number;
    let isRunning = true;
    
    function draw(ts: number) {
      if (!isRunning) return;
      if (modeRef.current !== 'canvas') {
        raf = requestAnimationFrame(draw);
        return;
      }
      
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
      const { w, h } = dimsRef.current;
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

      // Tactical mode bounds (spread drones across the map)
      const BOUNDS = { latMin: 31.35, latMax: 31.85, lonMin: 35.15, lonMax: 35.65, threshold: 0.03 };

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
        if (curSpd > maxSpd) { d.vLat = d.vLat / curSpd * maxSpd; d.vLon = d.vLon / curSpd * maxSpd; }
        d.lat += d.vLat * dt;
        d.lon += d.vLon * dt;
        // Clamp to bounds
        if (d.lat < BOUNDS.latMin || d.lat > BOUNDS.latMax) { d.vLat *= -1; d.lat = Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, d.lat)); }
        if (d.lon < BOUNDS.lonMin || d.lon > BOUNDS.lonMax) { d.vLon *= -1; d.lon = Math.max(BOUNDS.lonMin, Math.min(BOUNDS.lonMax, d.lon)); }
        d.heading = (Math.atan2(d.vLon, d.vLat) * 180 / Math.PI + 360) % 360;
      });

      // Draw background
      ctx.fillStyle = "#070a0f";
      ctx.fillRect(0, 0, w, h);
      for (let y2 = 0; y2 < h; y2 += 4) {
        ctx.fillStyle = "rgba(0,212,255,0.012)";
        ctx.fillRect(0, y2, w, 1);
      }

      // Grid lines
      ctx.strokeStyle = "rgba(0,212,255,0.07)";
      ctx.lineWidth = 0.5;
      for (let lat = 31.3; lat <= 31.9; lat += 0.1) {
        const { y: gy } = project(lat, LON_MIN, w, h);
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
      }
      for (let lon = 35.1; lon <= 35.7; lon += 0.1) {
        const { x: gx } = project(LAT_MIN, lon, w, h);
        ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
      }

      // Grid dots
      ctx.fillStyle = "rgba(0,212,255,0.15)";
      for (let lat = 31.3; lat <= 31.9; lat += 0.1) {
        for (let lon = 35.1; lon <= 35.7; lon += 0.1) {
          const { x: gx, y: gy } = project(lat, lon, w, h);
          ctx.beginPath(); ctx.arc(gx, gy, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }

      // Axis labels
      ctx.fillStyle = "rgba(0,180,255,0.3)";
      ctx.font = "9px 'Share Tech Mono', monospace";
      for (let lat = 31.4; lat <= 31.8; lat += 0.1) {
        const { y: gy } = project(lat, LON_MIN, w, h);
        ctx.fillText(`${lat.toFixed(2)}N`, 6, gy - 3);
      }
      for (let lon = 35.2; lon <= 35.6; lon += 0.1) {
        const { x: gx } = project(LAT_MIN, lon, w, h);
        ctx.fillText(`${lon.toFixed(2)}E`, gx + 3, h - 6);
      }

      // Protected zone - Metsokei Dragot
      const cpt = project(31.591, 35.393, w, h);
      const radPx = (0.08 / (LAT_MAX - LAT_MIN)) * h;
      const zg = ctx.createRadialGradient(cpt.x, cpt.y, 0, cpt.x, cpt.y, radPx);
      zg.addColorStop(0, "rgba(0,212,255,0.06)");
      zg.addColorStop(1, "transparent");
      ctx.fillStyle = zg;
      ctx.beginPath(); ctx.arc(cpt.x, cpt.y, radPx, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(0,212,255,0.25)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cpt.x, cpt.y, radPx, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(0,212,255,0.4)"; ctx.font = "8px 'Share Tech Mono',monospace";
      ctx.fillText("PROTECTED ZONE", cpt.x - 40, cpt.y + 3);

      // Scan sweep
      const scanY = (ts * 0.04) % h;
      ctx.fillStyle = "rgba(0,212,255,0.04)";
      ctx.fillRect(0, scanY, w, 3);

      // Draw sensors
      const sensors = tickSensors(dt);
      const selectedDrone = selected ? drones.find(d => d.id === selected.id) : null;
      const highlightSensors = selectedDrone ? new Set(selectedDrone.detectedBy || []) : null;

      sensors.forEach(s => {
        const { x: sx, y: sy } = project(s.lat, s.lon, w, h);
        const isPatrol = s.patrol;
        const isLit = highlightSensors && highlightSensors.has(s.id);
        const sColor = isLit ? "#ffd60a" : "#8a9ab0";
        const sGlow = isLit ? "rgba(255,214,10,0.6)" : "rgba(138,154,176,0.4)";

        // Line from sensor to the selected drone
        if (isLit && selectedDrone) {
          const { x: dx, y: dy } = project(selectedDrone.lat, selectedDrone.lon, w, h);
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(dx, dy);
          ctx.strokeStyle = "rgba(255,214,10,0.18)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Range ring
        ctx.beginPath();
        ctx.arc(sx, sy, 28, 0, Math.PI * 2);
        ctx.strokeStyle = isLit ? "rgba(255,214,10,0.2)" : sColor + "22";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Pulsing outer ring
        const sPhase = (ts / 2000) % 1;
        const pulseR = isLit ? 14 + sPhase * 24 : 14 + sPhase * 18;
        const pulseA = isLit ? Math.max(0, 0.55 - sPhase * 0.55) : Math.max(0, 0.35 - sPhase * 0.35);
        ctx.beginPath();
        ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
        ctx.strokeStyle = sColor + Math.round(pulseA * 255).toString(16).padStart(2, "0");
        ctx.lineWidth = isLit ? 1.5 : 1;
        ctx.stroke();

        // Diamond body
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.PI / 4);
        ctx.shadowColor = sGlow; ctx.shadowBlur = isLit ? 18 : 10;
        ctx.strokeStyle = sColor; ctx.lineWidth = isLit ? 2 : 1.5;
        ctx.strokeRect(-6, -6, 12, 12);
        ctx.shadowBlur = 0;
        ctx.fillStyle = sColor;
        ctx.fillRect(-2, -2, 4, 4);
        ctx.restore();

        // Label
        ctx.font = `${isLit ? "bold " : ""}9px 'Share Tech Mono',monospace`;
        const lw = ctx.measureText(s.id).width;
        ctx.fillStyle = "rgba(7,10,15,0.85)";
        ctx.fillRect(sx + 10, sy - 12, lw + 5, 13);
        ctx.fillStyle = sColor;
        ctx.fillText(s.id, sx + 12, sy - 2);

        // Patrol indicator arrow
        if (isPatrol) {
          const dir = s.vLat > 0 ? -1 : 1;
          ctx.beginPath();
          ctx.moveTo(sx - 10, sy + dir * 14);
          ctx.lineTo(sx - 10, sy + dir * 22);
          ctx.lineTo(sx - 14, sy + dir * 18);
          ctx.moveTo(sx - 10, sy + dir * 22);
          ctx.lineTo(sx - 6, sy + dir * 18);
          ctx.strokeStyle = sColor + "cc"; ctx.lineWidth = 1.2; ctx.stroke();
        }
      });

      // Get visible drones for trails and rendering
      const hov = hoverRef.current;
      const fn = filterFnRef.current;
      const visibleDrones = fn ? drones.filter(d => d.status === "active" && fn(d)) : drones.filter(d => d.status === "active");

      // Update and draw drone trails (tactical mode only)
      if (mode === 'canvas' && showTrails) {
        const TRAIL_DURATION = 90000; // 1.5 minutes
        const TRAIL_SAMPLE_INTERVAL = 300; // Sample position every 300ms for more dotted look
        
        visibleDrones.forEach(drone => {
          const cfg = SEV[drone.severity];
          let trail = trailsRef.current.get(drone.id);
          if (!trail) {
            trail = [];
            trailsRef.current.set(drone.id, trail);
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
          
          // Draw trail as fading dots
          if (trail.length > 0) {
            const isSel = selected?.id === drone.id;
            const droneAlpha = selected && !isSel ? 0.15 : 1;
            
            trail.forEach((pt, idx) => {
              if (idx === trail!.length - 1) return; // Skip current position (drone is there)
              const age = ts - pt.ts;
              const alpha = Math.max(0, 1 - age / TRAIL_DURATION) * 0.6 * droneAlpha;
              
              const { x: px, y: py } = project(pt.lat, pt.lon, w, h);
              ctx.beginPath();
              ctx.arc(px, py, 0.8, 0, Math.PI * 2);
              ctx.fillStyle = cfg.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
              ctx.fill();
            });
          }
        });
        
        // Clean up trails for drones that are no longer visible
        const visibleIds = new Set(visibleDrones.map(d => d.id));
        trailsRef.current.forEach((_, id) => {
          if (!visibleIds.has(id)) trailsRef.current.delete(id);
        });
      }

      // Draw drones
      visibleDrones.forEach(drone => {
        const cfg = SEV[drone.severity];
        const { x, y } = project(drone.lat, drone.lon, w, h);
        const isSel = selected?.id === drone.id;
        const isHov = hov?.id === drone.id;
        const phase = (ts / 1000) % 2;
        
        // Apply transparency to non-selected drones when one is selected
        const droneAlpha = selected && !isSel ? 0.1 : 1;
        ctx.globalAlpha = droneAlpha;

        // Pulse rings
        const rings = drone.severity === "critical" ? 3 : drone.severity === "high" ? 2 : 1;
        for (let i = 0; i < rings; i++) {
          const progress = (phase + i * (2 / rings)) % 2;
          const ringR = 10 + progress * 22;
          const alpha = Math.max(0, 0.5 - progress * 0.25);
          ctx.beginPath(); ctx.arc(x, y, ringR, 0, Math.PI * 2);
          ctx.strokeStyle = cfg.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
          ctx.lineWidth = 1.5; ctx.stroke();
        }

        // Direction arrow
        const rad = (drone.heading - 90) * Math.PI / 180;
        const alen = 26;
        const ax = x + Math.cos(rad) * alen, ay = y + Math.sin(rad) * alen;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ax, ay);
        ctx.strokeStyle = cfg.color + "cc"; ctx.lineWidth = isSel ? 2 : 1.5; ctx.stroke();
        const ang = Math.atan2(ay - y, ax - x);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax - 7 * Math.cos(ang - 0.4), ay - 7 * Math.sin(ang - 0.4));
        ctx.lineTo(ax - 7 * Math.cos(ang + 0.4), ay - 7 * Math.sin(ang + 0.4));
        ctx.closePath(); ctx.fillStyle = cfg.color + "cc"; ctx.fill();

        // Dot
        const dotR = isSel || isHov ? 9 : 7;
        ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.shadowColor = cfg.color; ctx.shadowBlur = isSel ? 20 : 10;
        ctx.fillStyle = cfg.color; ctx.fill(); ctx.shadowBlur = 0;
        if (isSel) {
          ctx.beginPath(); ctx.arc(x, y, dotR + 5, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
        }

        // Label
        const label = drone.model.length > 13 ? drone.model.slice(0, 12) + "…" : drone.model;
        ctx.font = `${isSel ? "bold " : ""}10px 'Share Tech Mono',monospace`;
        const tw = ctx.measureText(label).width;
        ctx.fillStyle = "rgba(7,10,15,0.85)";
        ctx.fillRect(x + 12, y - 14, tw + 6, 15);
        ctx.fillStyle = isSel ? "#fff" : cfg.color;
        ctx.fillText(label, x + 15, y - 3);
        
        // Reset alpha
        ctx.globalAlpha = 1;
      });

      raf = requestAnimationFrame(draw);
    }
    raf = requestAnimationFrame(draw);
    return () => {
      isRunning = false;
      cancelAnimationFrame(raf);
    };
  }, [dronesRef]);

  // Load Google Maps API
  useEffect(() => {
    if (mode !== 'google') return;
    
    const initMap = () => {
      if (googleMapRef.current && !googleMapInstanceRef.current && window.google?.maps?.Map) {
        googleMapInstanceRef.current = new window.google.maps.Map(googleMapRef.current, {
          center: { lat: 31.591, lng: 35.393 },
          zoom: 18,
          mapTypeId: 'hybrid',
        });
        googleMapInstanceRef.current.addListener('zoom_changed', () => {
          const z = googleMapInstanceRef.current?.getZoom();
          if (z !== undefined) {
            zoomLevelRef.current = z;
          }
        });
      }
    };
    
    // If Google Maps is already loaded, initialize immediately
    if (window.google?.maps?.Map) {
      initMap();
      return;
    }
    
    // Check if script is already in the page
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      // Wait for it to load
      const checkLoaded = setInterval(() => {
        if (window.google?.maps?.Map) {
          clearInterval(checkLoaded);
          initMap();
        }
      }, 100);
      return () => clearInterval(checkLoaded);
    }
    
    // Load the script
    window.initGoogleMap = initMap;
    
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAP_API_KEY}&callback=initGoogleMap`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    
    return () => {};
  }, [mode]);

  // Update markers on Google Map - use custom HTML overlay for pulse animation
  const droneMarkersRef = useRef<Map<string, { 
    overlay: google.maps.OverlayView & { update: (position: google.maps.LatLng, color: string, severity: SeverityLevel, isSelected: boolean) => void };
    line: google.maps.Polyline;
  }>>(new Map());
  
  useEffect(() => {
    if (mode !== 'google') return;
    
    let animFrame: number;
    let lastUpdate = 0;
    let lastTs = 0;
    const UPDATE_INTERVAL = 50; // Update every 50ms for smoother movement
    
    // Satellite view bounds (tight cluster)
    const BOUNDS = { latMin: 31.589, latMax: 31.593, lonMin: 35.391, lonMax: 35.395, threshold: 0.0003 };
    
    const updateMarkers = (timestamp: number) => {
      const map = googleMapInstanceRef.current;
      const DroneOverlay = getDroneOverlayClass();
      
      if (!map || !DroneOverlay) {
        animFrame = requestAnimationFrame(updateMarkers);
        return;
      }
      
      // Throttle updates
      if (timestamp - lastUpdate < UPDATE_INTERVAL) {
        animFrame = requestAnimationFrame(updateMarkers);
        return;
      }
      
      // Move drones
      const dt = lastTs ? Math.min(timestamp - lastTs, 100) : 16;
      lastTs = timestamp;
      lastUpdate = timestamp;
      
      const drones = dronesRef.current;
      drones.forEach(d => {
        if (d.status !== "active") return;
        
        // Reposition drones outside satellite view bounds
        if (d.lat < BOUNDS.latMin || d.lat > BOUNDS.latMax || d.lon < BOUNDS.lonMin || d.lon > BOUNDS.lonMax) {
          d.lat = rand(BOUNDS.latMin, BOUNDS.latMax);
          d.lon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
          d.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
          d.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
          d.vLat = 0;
          d.vLon = 0;
        }
        
        const dLat = d.targetLat - d.lat;
        const dLon = d.targetLon - d.lon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < BOUNDS.threshold) {
          d.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
          d.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
        }
        // Movement for satellite view - very slow for realistic effect
        const accel = 0.00000005;
        d.vLat += (dLat / (dist || 1)) * d.spd * accel;
        d.vLon += (dLon / (dist || 1)) * d.spd * accel;
        d.vLat *= 0.99;
        d.vLon *= 0.99;
        const curSpd = Math.sqrt(d.vLat * d.vLat + d.vLon * d.vLon);
        const maxSpd = d.spd * 0.0000002;
        if (curSpd > maxSpd) { d.vLat = d.vLat / curSpd * maxSpd; d.vLon = d.vLon / curSpd * maxSpd; }
        d.lat += d.vLat * dt;
        d.lon += d.vLon * dt;
        if (d.lat < BOUNDS.latMin || d.lat > BOUNDS.latMax) { d.vLat *= -1; d.lat = Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, d.lat)); }
        if (d.lon < BOUNDS.lonMin || d.lon > BOUNDS.lonMax) { d.vLon *= -1; d.lon = Math.max(BOUNDS.lonMin, Math.min(BOUNDS.lonMax, d.lon)); }
        d.heading = (Math.atan2(d.vLon, d.vLat) * 180 / Math.PI + 360) % 360;
      });
      
      const fn = filterFnRef.current;
      const visibleDrones = dronesRef.current.filter(d => d.status === "active" && (fn ? fn(d) : true));
      const visibleIds = new Set(visibleDrones.map(d => d.id));
      
      // Remove markers for drones that are no longer visible
      droneMarkersRef.current.forEach((markers, id) => {
        if (!visibleIds.has(id)) {
          markers.overlay.setMap(null);
          markers.line.setMap(null);
          droneMarkersRef.current.delete(id);
        }
      });
      
      visibleDrones.forEach(drone => {
        const cfg = SEV[drone.severity];
        const isSel = selected?.id === drone.id;
        
        const lineLength = 0.00015; // ~15m direction indicator
        const endLat = drone.lat + Math.cos(drone.heading * Math.PI / 180) * lineLength;
        const endLon = drone.lon + Math.sin(drone.heading * Math.PI / 180) * lineLength;
        
        let markers = droneMarkersRef.current.get(drone.id);
        
        if (!markers) {
          // Create new markers for this drone
          const overlay = new DroneOverlay(
            new window.google!.maps.LatLng(drone.lat, drone.lon),
            cfg.color,
            drone.severity,
            isSel,
            () => onSelect(drone)
          );
          overlay.setMap(map);
          
          const line = new window.google!.maps.Polyline({
            path: [
              { lat: drone.lat, lng: drone.lon },
              { lat: endLat, lng: endLon }
            ],
            map: map,
            strokeColor: cfg.color,
            strokeOpacity: 0.8,
            strokeWeight: 2,
            zIndex: isSel ? 99 : 49,
          });
          
          markers = { overlay, line };
          droneMarkersRef.current.set(drone.id, markers);
        } else {
          // Update existing markers smoothly
          markers.overlay.update(
            new window.google!.maps.LatLng(drone.lat, drone.lon),
            cfg.color,
            drone.severity,
            isSel
          );
          
          markers.line.setPath([
            { lat: drone.lat, lng: drone.lon },
            { lat: endLat, lng: endLon }
          ]);
          markers.line.setOptions({
            strokeColor: cfg.color,
            zIndex: isSel ? 99 : 49,
          });
        }
      });
      
      animFrame = requestAnimationFrame(updateMarkers);
    };
    
    animFrame = requestAnimationFrame(updateMarkers);
    
    // Capture ref value for cleanup
    const currentMarkers = droneMarkersRef.current;
    
    return () => {
      cancelAnimationFrame(animFrame);
      // Clean up all drone markers when switching away from google mode
      currentMarkers.forEach(markers => {
        markers.overlay.setMap(null);
        markers.line.setMap(null);
      });
      currentMarkers.clear();
    };
  }, [mode, selected, dronesRef, onSelect]);

  // Separate effect for sensor markers (static, don't need frequent updates)
  useEffect(() => {
    if (mode !== 'google') return;
    
    const sensorMarkersLocal: google.maps.Circle[] = [];
    
    const addSensors = () => {
      const map = googleMapInstanceRef.current;
      if (!map || !window.google?.maps?.Circle) {
        setTimeout(addSensors, 100);
        return;
      }
      
      // Use tight sensor positions for satellite view (visible at zoom 18)
      const satelliteSensors = [
        { id: "sens101", lat: 31.5895, lon: 35.3920 },
        { id: "sens102", lat: 31.5920, lon: 35.3945 },
        { id: "sens103", lat: 31.5905, lon: 35.3935 },
        { id: "sens104", lat: 31.5915, lon: 35.3910 },
      ];
      
      satelliteSensors.forEach(sensor => {
        const sensorCircle = new window.google!.maps.Circle({
          center: { lat: sensor.lat, lng: sensor.lon },
          radius: 4,
          map: map,
          fillColor: '#8a9ab0',
          fillOpacity: 0.7,
          strokeColor: '#00d4ff',
          strokeWeight: 1,
          zIndex: 10,
        });
        sensorMarkersLocal.push(sensorCircle);
      });
    };
    
    addSensors();
    
    return () => {
      sensorMarkersLocal.forEach(m => m.setMap(null));
    };
  }, [mode]);

  function hitTest(e: React.MouseEvent<HTMLCanvasElement>): Drone | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const { w, h } = dimsRef.current;
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

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {/* Trail Toggle Button (canvas mode only) */}
      {mode === 'canvas' && (
        <button
          onClick={() => {
            setShowTrails(t => {
              if (t) trailsRef.current.clear(); // Clear trails when turning off
              return !t;
            });
          }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 100,
            padding: '6px 10px',
            background: showTrails ? 'rgba(0,212,255,0.15)' : 'rgba(7,10,15,0.9)',
            color: showTrails ? '#00d4ff' : '#667',
            border: `1px solid ${showTrails ? 'rgba(0,212,255,0.4)' : 'rgba(100,100,100,0.3)'}`,
            borderRadius: 4,
            fontSize: 10,
            fontFamily: "'Share Tech Mono', monospace",
            cursor: 'pointer',
            letterSpacing: '0.5px',
            transition: 'all 0.2s ease',
          }}
        >
          {showTrails ? '◉ TRAILS' : '○ TRAILS'}
        </button>
      )}

      {/* Canvas Map */}
      <canvas 
        ref={canvasRef}
        onClick={e => { const d = hitTest(e); onSelect(d || null); }}
        onMouseMove={e => { const d = hitTest(e); hoverRef.current = d || null; setHover(d || null); }}
        style={{ 
          display: mode === 'canvas' ? "block" : "none", 
          width: "100%", 
          height: "100%", 
          cursor: hover ? "pointer" : "crosshair" 
        }}
      />

      {/* Google Map */}
      <div 
        ref={googleMapRef}
        style={{ 
          display: mode === 'google' ? "block" : "none",
          width: "100%", 
          height: "100%" 
        }}
      />

      {/* Hover tooltip (canvas mode only) */}
      {mode === 'canvas' && hover && (() => {
        const cfg = SEV[hover.severity];
        const { w, h } = dimsRef.current;
        const { x, y } = project(hover.lat, hover.lon, w, h);
        const rect = containerRef.current?.getBoundingClientRect();
        const sx = rect ? rect.width / w : 1;
        const sy = rect ? rect.height / h : 1;
        return (
          <div style={{ 
            position: "absolute", 
            left: x * sx + 16, 
            top: Math.max(10, y * sy - 54), 
            background: "rgba(7,10,15,0.96)", 
            border: `1px solid ${cfg.color}44`, 
            borderRadius: 5, 
            padding: "7px 11px", 
            pointerEvents: "none", 
            fontFamily: "'Share Tech Mono',monospace", 
            boxShadow: "0 4px 20px rgba(0,0,0,0.7)", 
            zIndex: 10 
          }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>{hover.model}</div>
            <div style={{ color: cfg.color, fontSize: 11 }}>{cfg.label} · {hover.threatScore}% threat</div>
            <div style={{ color: "#8899aa", fontSize: 11, marginTop: 2 }}>{hover.altitude}m · {hover.speed}km/h · {Math.round(hover.heading)}°</div>
            <div style={{ color: "#8899aa", fontSize: 11, marginTop: 1 }}>{hover.lat.toFixed(4)}, {hover.lon.toFixed(4)}</div>
          </div>
        );
      })()}
    </div>
  );
}

export default MapView;
