import { SEV } from '../utils/droneUtils';

function DroneRow({ drone, winStart, winEnd, onClick, selected }) {
  const cfg = SEV[drone.severity];
  const span = winEnd - winStart;
  const detectLeft = Math.max(0, (drone.detectedMs - winStart) / span * 100);
  const endMs = drone.detectedMs + drone.durationMs;
  const detectRight = Math.min(100, ((Math.min(endMs, winEnd) - winStart) / span * 100));
  const detectWidth = Math.max(0.3, detectRight - detectLeft);
  const overflows = endMs > winEnd && drone.status === "active";
  const active = drone.status === "active";

  return (
    <div 
      onClick={() => onClick(drone)} 
      style={{ 
        position: "relative", 
        height: 48, 
        borderBottom: "1px solid rgba(255,255,255,0.04)", 
        cursor: "pointer", 
        background: selected ? cfg.bg : "transparent", 
        transition: "background 0.15s" 
      }}
    >
      {/* Label section */}
      <div style={{ 
        position: "absolute", 
        left: 0, 
        top: 0, 
        width: 260, 
        height: "100%", 
        display: "flex", 
        alignItems: "center", 
        gap: 8, 
        paddingLeft: 14, 
        zIndex: 2, 
        background: "linear-gradient(to right, #0b0d12 200px, transparent)" 
      }}>
        <span style={{ 
          width: 9, 
          height: 9, 
          borderRadius: "50%", 
          flexShrink: 0, 
          background: cfg.color, 
          boxShadow: `0 0 7px ${cfg.glow}`, 
          animation: active ? "pulse 1.6s ease-in-out infinite" : "none" 
        }}/>
        <div style={{ overflow: "hidden" }}>
          <div style={{ 
            fontSize: 13, 
            color: "#e8eaf0", 
            whiteSpace: "nowrap", 
            overflow: "hidden", 
            textOverflow: "ellipsis", 
            maxWidth: 150 
          }}>
            {drone.model}
          </div>
          <div style={{ fontSize: 11, color: "#8899aa", marginTop: 1 }}>
            {drone.altitude}m · {drone.speed}km/h
          </div>
        </div>
        <div style={{ marginLeft: "auto", paddingRight: 8, textAlign: "right", flexShrink: 0 }}>
          <div style={{ 
            fontSize: 11, 
            color: cfg.color, 
            fontWeight: 700, 
            background: cfg.bg, 
            borderRadius: 3, 
            padding: "2px 5px" 
          }}>
            {drone.threatScore}%
          </div>
          <div style={{ fontSize: 10, color: "#8899aa", marginTop: 1 }}>{cfg.label}</div>
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ position: "absolute", left: 260, right: 0, top: 12, bottom: 12 }}>
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
