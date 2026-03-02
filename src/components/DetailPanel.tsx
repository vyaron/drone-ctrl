import { useState, useEffect, type MutableRefObject, type ReactElement } from 'react';
import { SEV, type Drone } from '../utils/droneUtils';

interface DetailPanelProps {
  selected: Drone | null;
  dronesRef: MutableRefObject<Drone[]>;
  onClose: () => void;
}

function DetailPanel({ selected, dronesRef, onClose }: DetailPanelProps): ReactElement | null {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedDrone, setDisplayedDrone] = useState<Drone | null>(null);
  
  // Handle visibility animation
  useEffect(() => {
    if (selected) {
      setDisplayedDrone(selected);
      // Small delay to trigger CSS transition
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsVisible(true);
        });
      });
    } else {
      setIsVisible(false);
      // Keep displayedDrone while animating out
      const timeout = setTimeout(() => setDisplayedDrone(null), 300);
      return () => clearTimeout(timeout);
    }
  }, [selected]);

  // Update displayed drone from ref while panel is open
  useEffect(() => {
    if (!selected) return;
    const interval = setInterval(() => {
      const updated = dronesRef.current.find(d => d.id === selected.id);
      if (updated) setDisplayedDrone(updated);
    }, 100);
    return () => clearInterval(interval);
  }, [selected, dronesRef]);

  if (!displayedDrone) return null;
  
  const drone = displayedDrone;
  const cfg = SEV[drone.severity];
  const elapsed = Math.floor((Date.now() - drone.detectedMs) / 1000);

  return (
    <div style={{
      position: "absolute",
      right: isVisible ? 0 : -400,
      top: 0,
      bottom: 0,
      width: 360,
      background: "linear-gradient(135deg, rgba(10,14,18,0.98), rgba(5,10,15,0.99))",
      borderLeft: "1px solid rgba(0,212,255,0.15)",
      boxShadow: "-8px 0 40px rgba(0,0,0,0.7)",
      display: "flex",
      flexDirection: "column",
      transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      fontFamily: "'Share Tech Mono', monospace",
      zIndex: 50
    }}>
      {/* Header */}
      <div style={{ 
        padding: "16px 20px", 
        borderBottom: "1px solid rgba(0,212,255,0.1)",
        display: "flex",
        alignItems: "center",
        gap: 12
      }}>
        <span style={{
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: cfg.color,
          boxShadow: `0 0 12px ${cfg.glow}`,
          animation: drone.status === "active" && drone.severity === "critical" ? "blink 1.1s ease-in-out infinite" : "none"
        }}/>
        <div style={{ flex: 1 }}>
          <div style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>{drone.model}</div>
          <div style={{ color: cfg.color, fontSize: 11, marginTop: 2 }}>{cfg.label} THREAT</div>
        </div>
        <button 
          onClick={onClose}
          style={{
            background: "none",
            border: "1px solid rgba(0,212,255,0.2)",
            borderRadius: 4,
            color: "#8899aa",
            width: 28,
            height: 28,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            transition: "all 0.15s"
          }}
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Threat Score */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 6 }}>THREAT SCORE</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 40, color: cfg.color, fontWeight: 700, lineHeight: 1 }}>{drone.threatScore}</span>
            <span style={{ color: "#8899aa", fontSize: 20 }}>/ 100</span>
          </div>
          <div style={{ 
            height: 4, 
            background: "rgba(0,212,255,0.1)", 
            borderRadius: 2, 
            marginTop: 8,
            overflow: "hidden"
          }}>
            <div style={{ 
              width: `${drone.threatScore}%`, 
              height: "100%", 
              background: `linear-gradient(90deg, ${cfg.color}, ${cfg.color}88)`,
              borderRadius: 2
            }}/>
          </div>
        </div>

        {/* Status */}
        <div style={{ 
          background: "rgba(0,212,255,0.04)", 
          borderRadius: 6, 
          padding: 14, 
          marginBottom: 16,
          border: "1px solid rgba(0,212,255,0.08)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ color: "#8899aa", fontSize: 11 }}>STATUS</span>
            <span style={{ 
              color: drone.status === "active" ? "#30d158" : "#ff2d55",
              fontSize: 11,
              fontWeight: 700
            }}>
              {drone.status.toUpperCase()}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#8899aa", fontSize: 11 }}>TRACK TIME</span>
            <span style={{ color: "#7ecfff", fontSize: 11 }}>{elapsed}s</span>
          </div>
        </div>

        {/* Flight Data */}
        <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 10 }}>FLIGHT DATA</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "ALTITUDE", value: `${drone.altitude}m`, unit: "" },
            { label: "SPEED", value: `${drone.speed}`, unit: "km/h" },
            { label: "HEADING", value: `${Math.round(drone.heading)}°`, unit: "" },
            { label: "RF SIGNAL", value: `${drone.rfSig}`, unit: "dBm" },
          ].map(item => (
            <div key={item.label} style={{
              background: "rgba(0,212,255,0.03)",
              borderRadius: 4,
              padding: "10px 12px",
              border: "1px solid rgba(0,212,255,0.06)"
            }}>
              <div style={{ color: "#8899aa", fontSize: 9, letterSpacing: 1, marginBottom: 4 }}>{item.label}</div>
              <div style={{ color: "#e8eaf0", fontSize: 16, fontWeight: 700 }}>
                {item.value}
                {item.unit && <span style={{ color: "#8899aa", fontSize: 11, marginLeft: 2 }}>{item.unit}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Location */}
        <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 10 }}>LOCATION</div>
        <div style={{
          background: "rgba(0,212,255,0.03)",
          borderRadius: 6,
          padding: 14,
          border: "1px solid rgba(0,212,255,0.06)",
          marginBottom: 20
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ color: "#8899aa", fontSize: 10 }}>LATITUDE</span>
            <span style={{ color: "#7ecfff", fontSize: 12 }}>{drone.lat.toFixed(6)}°N</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#8899aa", fontSize: 10 }}>LONGITUDE</span>
            <span style={{ color: "#7ecfff", fontSize: 12 }}>{drone.lon.toFixed(6)}°E</span>
          </div>
        </div>

        {/* Detected By */}
        <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 10 }}>DETECTED BY</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {drone.detectedBy.map(sensor => (
            <span key={sensor} style={{
              padding: "5px 10px",
              background: "rgba(255,214,10,0.08)",
              border: "1px solid rgba(255,214,10,0.2)",
              borderRadius: 4,
              color: "#ffd60a",
              fontSize: 10,
              letterSpacing: 1
            }}>
              {sensor}
            </span>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ 
        padding: "12px 20px", 
        borderTop: "1px solid rgba(0,212,255,0.1)",
        display: "flex",
        gap: 10
      }}>
        <button style={{
          flex: 1,
          padding: "10px",
          background: "rgba(255,45,85,0.1)",
          border: "1px solid rgba(255,45,85,0.3)",
          borderRadius: 4,
          color: "#ff2d55",
          fontSize: 11,
          letterSpacing: 1,
          cursor: "pointer",
          fontFamily: "'Share Tech Mono', monospace"
        }}>
          NEUTRALIZE
        </button>
        <button style={{
          flex: 1,
          padding: "10px",
          background: "rgba(0,212,255,0.06)",
          border: "1px solid rgba(0,212,255,0.2)",
          borderRadius: 4,
          color: "#00d4ff",
          fontSize: 11,
          letterSpacing: 1,
          cursor: "pointer",
          fontFamily: "'Share Tech Mono', monospace"
        }}>
          TRACK
        </button>
      </div>
    </div>
  );
}

export default DetailPanel;
