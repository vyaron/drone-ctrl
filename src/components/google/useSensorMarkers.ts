import { useEffect, useRef } from 'react';

// Sensor positions for satellite view (visible at zoom 18)
const SATELLITE_SENSORS = [
  { id: "sens101", lat: 31.5895, lon: 35.3920 },
  { id: "sens102", lat: 31.5920, lon: 35.3945 },
  { id: "sens103", lat: 31.5905, lon: 35.3935 },
  { id: "sens104", lat: 31.5915, lon: 35.3910 },
];

export function useSensorMarkers(
  mapInstance: google.maps.Map | null,
  enabled: boolean
): void {
  const sensorMarkersRef = useRef<google.maps.Circle[]>([]);

  useEffect(() => {
    if (!enabled) return;
    
    const addSensors = () => {
      const map = mapInstance;
      if (!map || !window.google?.maps?.Circle) {
        setTimeout(addSensors, 100);
        return;
      }
      
      SATELLITE_SENSORS.forEach(sensor => {
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
        sensorMarkersRef.current.push(sensorCircle);
      });
    };
    
    addSensors();
    
    const currentMarkers = sensorMarkersRef.current;
    
    return () => {
      currentMarkers.forEach(m => m.setMap(null));
      sensorMarkersRef.current = [];
    };
  }, [enabled, mapInstance]);
}
