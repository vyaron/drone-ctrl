import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { rand, type Drone } from '../utils/droneUtils';
import { useDroneMarkers, useSensorMarkers } from './google';

const GMAP_API_KEY = 'AIzaSyCaQVlcIeYewnFSmm3xkL2d3HHy9xhYbz4';

// Extend Window interface for Google Maps callback
declare global {
  interface Window {
    initGoogleMap?: () => void;
    google?: typeof google;
  }
}

interface GoogleMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
}

export function GoogleMapView({ 
  dronesRef, 
  selected, 
  onSelect, 
  filterFn 
}: GoogleMapViewProps): ReactElement {
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const zoomLevelRef = useRef(18);

  // Initialize drone positions for satellite view
  useEffect(() => {
    const drones = dronesRef.current;
    
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
  }, [dronesRef]);

  // Load Google Maps API
  useEffect(() => {
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
  }, []);

  // Use drone and sensor marker hooks
  useDroneMarkers(
    googleMapInstanceRef.current,
    dronesRef,
    selected,
    onSelect,
    filterFn,
    true
  );

  useSensorMarkers(googleMapInstanceRef.current, true);

  return (
    <div 
      ref={googleMapRef}
      style={{ 
        width: "100%", 
        height: "100%" 
      }}
    />
  );
}
