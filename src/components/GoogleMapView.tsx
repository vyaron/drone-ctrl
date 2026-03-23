import { useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { type Drone } from '../utils/droneUtils';
import { useDroneMarkers, useSensorMarkers } from './google';

const GMAP_API_KEY = 'AIzaSyCaQVlcIeYewnFSmm3xkL2d3HHy9xhYbz4';

// Map center for Live satellite view (tight cluster)
const SATELLITE_CENTER = { lat: 31.591, lng: 35.393 };
const SATELLITE_ZOOM = 18;

// Extend Window interface for Google Maps callback
declare global {
  interface Window {
    initGoogleMap?: () => void;
    google?: typeof google;
  }
}

interface GoogleMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  drones?: Drone[];  // Optional direct array for triggering re-fit
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  useActualPositions?: boolean;
  paused?: boolean;
}

export function GoogleMapView({ 
  dronesRef, 
  drones,
  selected, 
  onSelect, 
  filterFn,
  useActualPositions = false,
  paused = false
}: GoogleMapViewProps): ReactElement {
  const googleMapRef = useRef<HTMLDivElement>(null);
  const googleMapInstanceRef = useRef<google.maps.Map | null>(null);
  const zoomLevelRef = useRef(SATELLITE_ZOOM);
  const initializedModeRef = useRef<boolean | null>(null);
  const hasFitBoundsRef = useRef(false);

  // Load Google Maps API
  useEffect(() => {
    const initMap = () => {
      if (googleMapRef.current && !googleMapInstanceRef.current && window.google?.maps?.Map) {
        googleMapInstanceRef.current = new window.google.maps.Map(googleMapRef.current, {
          center: SATELLITE_CENTER,
          zoom: SATELLITE_ZOOM,
          mapTypeId: 'hybrid',
        });
        initializedModeRef.current = useActualPositions;
        hasFitBoundsRef.current = false;
        googleMapInstanceRef.current.addListener('zoom_changed', () => {
          const z = googleMapInstanceRef.current?.getZoom();
          if (z !== undefined) {
            zoomLevelRef.current = z;
          }
        });
      } else if (googleMapInstanceRef.current && initializedModeRef.current !== useActualPositions) {
        // Mode changed, reset fit bounds flag
        initializedModeRef.current = useActualPositions;
        hasFitBoundsRef.current = false;
        if (!useActualPositions) {
          // Switch back to satellite mode
          googleMapInstanceRef.current.setCenter(SATELLITE_CENTER);
          googleMapInstanceRef.current.setZoom(SATELLITE_ZOOM);
        }
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
  }, [useActualPositions]);

  // Reset fit bounds flag when drones change (different event selected)
  const prevDronesLenRef = useRef(0);
  useEffect(() => {
    if (!useActualPositions || !drones) return;
    // Reset if drone count changed significantly (different event)
    if (Math.abs(drones.length - prevDronesLenRef.current) > 0) {
      hasFitBoundsRef.current = false;
    }
    prevDronesLenRef.current = drones.length;
  }, [drones, useActualPositions]);

  // Auto-fit bounds to drone positions when using actual positions
  useEffect(() => {
    if (!useActualPositions) return;
    
    const fitBounds = () => {
      const map = googleMapInstanceRef.current;
      if (!map || !window.google?.maps?.LatLngBounds) return;
      if (hasFitBoundsRef.current) return;
      
      const droneList = drones || dronesRef.current;
      if (droneList.length === 0) return;
      
      const bounds = new window.google.maps.LatLngBounds();
      droneList.forEach(d => {
        bounds.extend({ lat: d.lat, lng: d.lon });
      });
      
      // Add padding around bounds
      const ne = bounds.getNorthEast();
      const sw = bounds.getSouthWest();
      const latPadding = (ne.lat() - sw.lat()) * 0.3 || 0.01;
      const lngPadding = (ne.lng() - sw.lng()) * 0.3 || 0.01;
      bounds.extend({ lat: ne.lat() + latPadding, lng: ne.lng() + lngPadding });
      bounds.extend({ lat: sw.lat() - latPadding, lng: sw.lng() - lngPadding });
      
      map.fitBounds(bounds);
      hasFitBoundsRef.current = true;
    };
    
    // Try immediately and then poll briefly since dronesRef might not be populated yet
    fitBounds();
    const interval = setInterval(fitBounds, 100);
    const timeout = setTimeout(() => clearInterval(interval), 2000);
    
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [useActualPositions, dronesRef, drones]);

  // Use drone and sensor marker hooks
  useDroneMarkers(
    googleMapInstanceRef.current,
    dronesRef,
    selected,
    onSelect,
    filterFn,
    true,
    useActualPositions,
    paused
  );

  useSensorMarkers(googleMapInstanceRef.current, true, paused);

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
