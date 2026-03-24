import type { ReactElement } from 'react';
import { DRONE_COLORS, project, SITE_CENTER, type Drone } from '../utils/droneUtils';

interface DroneTooltipProps {
  drone: Drone;
  w: number;
  h: number;
  containerRect: DOMRect | null;
  screenPos?: { x: number; y: number } | null;  // For detection-level, actual indicator position
}

export function DroneTooltip({ drone, w, h, containerRect, screenPos }: DroneTooltipProps): ReactElement {
  const cfg = DRONE_COLORS[drone.colorIndex % DRONE_COLORS.length];
  
  // Position tooltip based on detection level
  let tooltipX: number;
  let tooltipY: number;
  
  if (drone.level === 'detection' && screenPos) {
    // Detection level: use actual indicator screen position
    tooltipX = screenPos.x;
    tooltipY = screenPos.y;
  } else if (drone.level === 'direction') {
    // Direction level: position near site center (where wedge originates)
    const { x, y } = project(SITE_CENTER.lat, SITE_CENTER.lon, w, h);
    tooltipX = x;
    tooltipY = y;
  } else if (drone.level === 'detection') {
    // Detection level fallback: position near sensor
    const { x, y } = project(drone.lat, drone.lon, w, h);
    tooltipX = x;
    tooltipY = y;
  } else {
    // Location level: position at drone
    const { x, y } = project(drone.lat, drone.lon, w, h);
    tooltipX = x;
    tooltipY = y;
  }
  
  const sx = containerRect ? containerRect.width / w : 1;
  const sy = containerRect ? containerRect.height / h : 1;
  
  // Format level badge
  const levelLabel = drone.level === 'location' ? 'GEO' : 
                     drone.level === 'direction' ? 'DIR' : 
                     drone.level === 'detection' ? 'DETECT' : 'GEO';
  
  return (
    <div style={{ 
      position: "absolute", 
      left: tooltipX * sx + 16, 
      top: Math.max(10, tooltipY * sy - 54), 
      background: "rgba(7,10,15,0.96)", 
      border: `1px solid ${cfg.color}44`, 
      borderRadius: 5, 
      padding: "7px 11px", 
      pointerEvents: "none", 
      fontFamily: "'Share Tech Mono',monospace", 
      boxShadow: "0 4px 20px rgba(0,0,0,0.7)", 
      zIndex: 10 
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
        <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>
          {drone.model}
        </span>
        <span style={{
          fontSize: 9,
          padding: '1px 4px',
          borderRadius: 3,
          background: '#7ecfff22',
          color: '#7ecfff',
          fontWeight: 600,
        }}>
          {levelLabel}
        </span>
      </div>
      <div style={{ color: cfg.color, fontSize: 11 }}>
        Sensors: {drone.detectedBy?.length || 1}
      </div>
      
      {/* Show different info based on level */}
      {drone.level === 'direction' && drone.bearing !== undefined && (
        <div style={{ color: "#8899aa", fontSize: 11, marginTop: 2 }}>
          Bearing: {Math.round(drone.bearing)}°
        </div>
      )}
      
      {drone.level === 'detection' && (
        <div style={{ color: "#8899aa", fontSize: 11, marginTop: 2 }}>
          Sensor: {drone.sensorId || drone.detectedBy?.[0] || 'Unknown'}
        </div>
      )}
      
      {(!drone.level || drone.level === 'location') && (
        <>
          <div style={{ color: "#8899aa", fontSize: 11, marginTop: 2 }}>
            {drone.altitude !== undefined ? `${drone.altitude}m · ` : ''}{drone.speed !== undefined ? `${drone.speed}km/h · ` : ''}{Math.round(drone.heading)}°
          </div>
          <div style={{ color: "#8899aa", fontSize: 11, marginTop: 1 }}>
            {drone.lat.toFixed(4)}, {drone.lon.toFixed(4)}
          </div>
        </>
      )}
      
      {/* Show frequency if available */}
      {drone.frequency > 0 && (
        <div style={{ color: "#8899aa", fontSize: 11, marginTop: 1 }}>
          Freq: {drone.frequency} MHz
        </div>
      )}
    </div>
  );
}
