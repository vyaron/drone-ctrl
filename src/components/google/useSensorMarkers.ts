import { useEffect, useRef } from 'react';
import { getSensorOverlayClass, type SensorOverlayInstance } from './SensorOverlay';

// Separate sensor positions for satellite view (visible at zoom 18)
const MAP_SENSORS = [
  { id: "sens101", lat: 31.5895, lon: 35.3920, patrol: true, vLat: 0.0000001 },
  { id: "sens102", lat: 31.5920, lon: 35.3945, patrol: false },
  { id: "sens103", lat: 31.5905, lon: 35.3935, patrol: false },
  { id: "sens104", lat: 31.5915, lon: 35.3910, patrol: false },
];

// Local state for map sensors
const mapSensorState = MAP_SENSORS.map(s => ({ ...s, currentLat: s.lat }));

export function useSensorMarkers(
  mapInstance: google.maps.Map | null,
  enabled: boolean
): void {
  const sensorOverlaysRef = useRef<Map<string, SensorOverlayInstance>>(new Map());
  const animationRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    
    const addSensors = () => {
      const map = mapInstance;
      const SensorOverlay = getSensorOverlayClass();
      if (!map || !SensorOverlay) {
        setTimeout(addSensors, 100);
        return;
      }
      
      // Create overlays for each sensor
      mapSensorState.forEach(sensor => {
        const position = new window.google!.maps.LatLng(sensor.currentLat, sensor.lon);
        const overlay = new SensorOverlay(position, sensor.id, sensor.patrol, '#00d4ff');
        overlay.setMap(map);
        sensorOverlaysRef.current.set(sensor.id, overlay);
      });
      
      // Animation loop with own state
      const animate = (time: number) => {
        const dt = lastTimeRef.current ? (time - lastTimeRef.current) : 16;
        lastTimeRef.current = time;
        
        mapSensorState.forEach(sensor => {
          if (!sensor.patrol || !sensor.vLat) return;
          sensor.currentLat += sensor.vLat * dt;
          const off = sensor.currentLat - sensor.lat;
          const range = 0.0015; // Smaller range for zoomed map
          if (off > range) sensor.vLat = -Math.abs(sensor.vLat);
          if (off < -range) sensor.vLat = Math.abs(sensor.vLat);
          
          const overlay = sensorOverlaysRef.current.get(sensor.id);
          if (overlay) {
            const newPos = new window.google!.maps.LatLng(sensor.currentLat, sensor.lon);
            overlay.update(newPos);
          }
        });
        
        animationRef.current = requestAnimationFrame(animate);
      };
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    addSensors();
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      sensorOverlaysRef.current.forEach(o => o.setMap(null));
      sensorOverlaysRef.current.clear();
    };
  }, [enabled, mapInstance]);
}
