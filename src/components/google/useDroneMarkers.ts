import { useEffect, useRef, type MutableRefObject } from 'react';
import { SEV, rand, type Drone } from '../../utils/droneUtils';
import { getDroneOverlayClass, type DroneOverlayInstance } from './DroneOverlay';

interface DroneMarkers {
  overlay: DroneOverlayInstance;
  line: google.maps.Polyline;
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
  enabled: boolean
): void {
  const droneMarkersRef = useRef<Map<string, DroneMarkers>>(new Map());
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;

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
        if (curSpd > maxSpd) { 
          d.vLat = d.vLat / curSpd * maxSpd; 
          d.vLon = d.vLon / curSpd * maxSpd; 
        }
        d.lat += d.vLat * dt;
        d.lon += d.vLon * dt;
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
  }, [enabled, mapInstance, selected, dronesRef, onSelect]);
}
