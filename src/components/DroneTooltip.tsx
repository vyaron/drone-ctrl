import type { ReactElement } from 'react';
import { SEV, project, type Drone } from '../utils/droneUtils';

interface DroneTooltipProps {
  drone: Drone;
  w: number;
  h: number;
  containerRect: DOMRect | null;
}

export function DroneTooltip({ drone, w, h, containerRect }: DroneTooltipProps): ReactElement {
  const cfg = SEV[drone.severity];
  const { x, y } = project(drone.lat, drone.lon, w, h);
  const sx = containerRect ? containerRect.width / w : 1;
  const sy = containerRect ? containerRect.height / h : 1;
  
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
      <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 3 }}>
        {drone.model}
      </div>
      <div style={{ color: cfg.color, fontSize: 11 }}>
        {cfg.label} · {drone.threatScore}% threat
      </div>
      <div style={{ color: "#8899aa", fontSize: 11, marginTop: 2 }}>
        {drone.altitude}m · {drone.speed}km/h · {Math.round(drone.heading)}°
      </div>
      <div style={{ color: "#8899aa", fontSize: 11, marginTop: 1 }}>
        {drone.lat.toFixed(4)}, {drone.lon.toFixed(4)}
      </div>
    </div>
  );
}
