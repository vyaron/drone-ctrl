import type { ReactElement } from 'react';
import { SEV, type Drone } from '../utils/droneUtils';

interface DroneRowProps {
  drone: Drone;
  winStart: number;
  winEnd: number;
  onClick: (drone: Drone) => void;
  selected: boolean;
}

function DroneRow({ drone, winStart, winEnd, onClick, selected }: DroneRowProps): ReactElement {
  const cfg = SEV[drone.severity];
  const LABEL_W = 260;
  const windowLen = winEnd - winStart;
  const detectPos = Math.max(0, (drone.detectedMs - winStart) / windowLen) * 100;
  const endTime = drone.detectedMs + drone.durationMs;
  const barEnd = Math.min(100, ((endTime - winStart) / windowLen) * 100);
  const detectLeft = detectPos;
  const detectWidth = barEnd - detectPos;
  const overflows = endTime > winEnd;
  const active = drone.status === "active";

  return (
    <div 
      onClick={() => onClick(drone)} 
      style={{ 
        display: "flex", 
        alignItems: "center", 
        padding: "7px 0", 
        borderBottom: "1px solid rgba(0,212,255,0.04)", 
        cursor: "pointer", 
        opacity: drone.status === "left" ? 0.35 : 1, 
        background: selected ? "rgba(0,212,255,0.04)" : "transparent" 
      }}
    >
      {/* Label area */}
      <div style={{ width: LABEL_W, paddingLeft: 12, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <span style={{ 
          width: 8, 
          height: 8, 
          borderRadius: "50%", 
          background: cfg.color, 
          boxShadow: active ? `0 0 6px ${cfg.glow}` : "none", 
          animation: active && drone.severity === "critical" ? "blink 1.1s ease-in-out infinite" : "none" 
        }}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: "#e8eaf0", fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{drone.model}</div>
          <div style={{ fontSize: 10, color: "#8899aa" }}>{drone.lat.toFixed(4)}, {drone.lon.toFixed(4)}</div>
        </div>
        <div style={{ 
          padding: "2px 6px", 
          borderRadius: 4, 
          background: cfg.bg, 
          color: cfg.color, 
          fontSize: 9, 
          fontWeight: 700, 
          letterSpacing: 1, 
          marginRight: 10 
        }}>
          {cfg.label}
        </div>
      </div>
      {/* Bar */}
      <div style={{ flex: 1, height: 18, position: "relative" }}>
        <div style={{ 
          position: "absolute", 
          left: `${detectLeft}%`, 
          width: `${detectWidth}%`, 
          top: 0, 
          bottom: 0, 
          borderRadius: overflows ? "3px 0 0 3px" : 3, 
          background: `linear-gradient(90deg, ${cfg.color}dd, ${cfg.color}66)`, 
          boxShadow: active ? `0 0 10px ${cfg.glow}` : "none", 
          borderRight: overflows ? `2px dashed ${cfg.color}88` : "none", 
          minWidth: 3 
        }}/>
      </div>
    </div>
  );
}

export default DroneRow;
