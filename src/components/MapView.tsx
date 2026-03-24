import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { type Drone } from '../utils/droneUtils';
import { CanvasMapView } from './CanvasMapView';
import { GoogleMapView } from './GoogleMapView';

interface MapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  mode?: 'canvas' | 'google';
  showHeadingIndicator?: boolean;
}

function MapView({ dronesRef, selected, onSelect, filterFn, mode = 'canvas', showHeadingIndicator = false }: MapViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 800, h: 500 });

  // Track container dimensions
  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={containerRef} style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      {mode === 'canvas' ? (
        <CanvasMapView
          dronesRef={dronesRef}
          selected={selected}
          onSelect={onSelect}
          filterFn={filterFn}
          dims={dims}
          showHeadingIndicator={showHeadingIndicator}
        />
      ) : (
        <GoogleMapView
          dronesRef={dronesRef}
          selected={selected}
          onSelect={onSelect}
          filterFn={filterFn}
          showHeadingIndicator={showHeadingIndicator}
        />
      )}
    </div>
  );
}

export default MapView;
