import { useEffect, useRef, type MutableRefObject } from 'react';
import { DRONE_COLORS, rand, type Drone } from '../../utils/droneUtils';
import { getDroneOverlayClass, type DroneOverlayInstance } from './DroneOverlay';

interface DroneMarkers {
  overlay: DroneOverlayInstance;
  line: google.maps.Polyline;
}

// Local display position for map view (doesn't affect tactical positions)
interface MapDronePos {
  lat: number;
  lon: number;
  targetLat: number;
  targetLon: number;
  vLat: number;
  vLon: number;
  heading: number;
}

// Satellite view bounds (tight cluster)
const BOUNDS = { 
  latMin: 31.589, 
  latMax: 31.593, 
  lonMin: 35.391, 
  lonMax: 35.395, 
  threshold: 0.0003 
};

export function useDroneMarkers(
  mapInstance: google.maps.Map | null,
  dronesRef: MutableRefObject<Drone[]>,
  selected: Drone | null,
  onSelect: (drone: Drone | null) => void,
  filterFn: (drone: Drone) => boolean,
  enabled: boolean,
  useActualPositions: boolean = false,
  paused: boolean = false,
  showHeadingIndicator: boolean = true
): void {
  const droneMarkersRef = useRef<Map<string, DroneMarkers>>(new Map());
  const mapPositionsRef = useRef<Map<string, MapDronePos>>(new Map());
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const showHeadingIndicatorRef = useRef(showHeadingIndicator);
  showHeadingIndicatorRef.current = showHeadingIndicator;

  useEffect(() => {
    if (!enabled) return;
    
    let animFrame: number;
    let lastUpdate = 0;
    let lastTs = 0;
    const UPDATE_INTERVAL = 50; // Update every 50ms for smoother movement
    
    const updateMarkers = (timestamp: number) => {
      const map = mapInstance;
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
      
      // Move drones using local positions
      const rawDt = lastTs ? Math.min(timestamp - lastTs, 100) : 16;
      const dt = pausedRef.current ? 0 : rawDt;
      lastTs = timestamp;
      lastUpdate = timestamp;
      
      const drones = dronesRef.current;
      drones.forEach(d => {
        if (d.status !== "active") return;
        
        // Get or create local map position
        let pos = mapPositionsRef.current.get(d.id);
        if (!pos) {
          pos = {
            lat: rand(BOUNDS.latMin, BOUNDS.latMax),
            lon: rand(BOUNDS.lonMin, BOUNDS.lonMax),
            targetLat: rand(BOUNDS.latMin, BOUNDS.latMax),
            targetLon: rand(BOUNDS.lonMin, BOUNDS.lonMax),
            vLat: 0,
            vLon: 0,
            heading: d.heading
          };
          mapPositionsRef.current.set(d.id, pos);
        }
        
        const dLat = pos.targetLat - pos.lat;
        const dLon = pos.targetLon - pos.lon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < BOUNDS.threshold) {
          pos.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
          pos.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
        }
        // Movement for satellite view - very slow for realistic effect
        const accel = 0.0000000216;
        pos.vLat += (dLat / (dist || 1)) * d.spd * accel;
        pos.vLon += (dLon / (dist || 1)) * d.spd * accel;
        pos.vLat *= 0.99;
        pos.vLon *= 0.99;
        const curSpd = Math.sqrt(pos.vLat * pos.vLat + pos.vLon * pos.vLon);
        const maxSpd = d.spd * 0.00000009;
        if (curSpd > maxSpd) { 
          pos.vLat = pos.vLat / curSpd * maxSpd; 
          pos.vLon = pos.vLon / curSpd * maxSpd; 
        }
        pos.lat += pos.vLat * dt;
        pos.lon += pos.vLon * dt;
        if (pos.lat < BOUNDS.latMin || pos.lat > BOUNDS.latMax) { 
          pos.vLat *= -1; 
          pos.lat = Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, pos.lat)); 
        }
        if (pos.lon < BOUNDS.lonMin || pos.lon > BOUNDS.lonMax) { 
          pos.vLon *= -1; 
          pos.lon = Math.max(BOUNDS.lonMin, Math.min(BOUNDS.lonMax, pos.lon)); 
        }
        pos.heading = (Math.atan2(pos.vLon, pos.vLat) * 180 / Math.PI + 360) % 360;
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
          mapPositionsRef.current.delete(id);
        }
      });
      
      visibleDrones.forEach(drone => {
        const cfg = DRONE_COLORS[drone.colorIndex % DRONE_COLORS.length];
        const isSel = selected?.id === drone.id;
        const sensorCount = drone.detectedBy?.length || 1;
        
        // Use actual positions or local animated positions
        let lat: number, lon: number, heading: number;
        if (useActualPositions) {
          lat = drone.lat;
          lon = drone.lon;
          heading = drone.heading;
        } else {
          const pos = mapPositionsRef.current.get(drone.id);
          if (!pos) return;
          lat = pos.lat;
          lon = pos.lon;
          heading = pos.heading;
        }
        
        const lineLength = 0.00015; // ~15m direction indicator
        const endLat = lat + Math.cos(heading * Math.PI / 180) * lineLength;
        const endLon = lon + Math.sin(heading * Math.PI / 180) * lineLength;
        
        let markers = droneMarkersRef.current.get(drone.id);
        
        if (!markers) {
          // Create new markers for this drone
          const overlay = new DroneOverlay(
            new window.google!.maps.LatLng(lat, lon),
            cfg.color,
            sensorCount,
            isSel,
            () => onSelect(drone)
          );
          overlay.setMap(map);
          
          const line = new window.google!.maps.Polyline({
            path: [
              { lat: lat, lng: lon },
              { lat: endLat, lng: endLon }
            ],
            map: showHeadingIndicatorRef.current ? map : null,
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
            new window.google!.maps.LatLng(lat, lon),
            cfg.color,
            sensorCount,
            isSel
          );
          
          // Show/hide direction indicator based on flag
          const lineMap = showHeadingIndicatorRef.current ? map : null;
          if (markers.line.getMap() !== lineMap) {
            markers.line.setMap(lineMap);
          }
          
          if (showHeadingIndicatorRef.current) {
            markers.line.setPath([
              { lat: lat, lng: lon },
              { lat: endLat, lng: endLon }
            ]);
            markers.line.setOptions({
              strokeColor: cfg.color,
              zIndex: isSel ? 99 : 49,
            });
          }
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
  }, [enabled, mapInstance, selected, dronesRef, onSelect, useActualPositions]);
}
