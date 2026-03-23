import React, { useRef, useEffect, useState, type ReactElement } from 'react';
import { type Drone } from '../utils/droneUtils';
import { CanvasMapView } from './CanvasMapView';
import { GoogleMapView } from './GoogleMapView';

interface StaticMapViewProps {
  drones: Drone[];
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  mode?: 'canvas' | 'google';
  paused?: boolean;
}

// Wrapper that converts static drones array to ref for existing map components
export function StaticMapView({ 
  drones,
  selected, 
  onSelect, 
  mode = 'canvas',
  paused = false
}: StaticMapViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const dronesRef = useRef<Drone[]>(drones);
  const [dims, setDims] = useState({ w: 800, h: 500 });
  
  // Keep ref in sync with props - update synchronously before render
  dronesRef.current = drones;
  
  // Track container dimensions
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      // Ensure minimum dimensions
      setDims({ w: Math.max(100, Math.floor(width)), h: Math.max(100, Math.floor(height)) });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);
  
  // No filter needed - we control the drones array
  const filterFn = () => true;
  
  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {mode === 'canvas' ? (
        <CanvasMapView
          dronesRef={dronesRef}
          selected={selected}
          onSelect={onSelect}
          filterFn={filterFn}
          dims={dims}
          paused={paused}
        />
      ) : (
        <GoogleMapView
          dronesRef={dronesRef}
          selected={selected}
          onSelect={onSelect}
          filterFn={filterFn}
          paused={paused}
        />
      )}
    </div>
  );
}
