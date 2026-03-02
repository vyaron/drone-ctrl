import { useState, useEffect } from 'react';
import { SEV, formatTime, secLabel, SENSORS_BASE } from '../utils/droneUtils';

function DetailPanel({ selected, dronesRef, onClose }) {
  const [, setTick] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (selected) {
      // Small delay to trigger animation
      requestAnimationFrame(() => setIsVisible(true));
    } else {
      setIsVisible(false);
    }
  }, [selected]);

  if (!selected) return null;
  
  const live = dronesRef.current.find(d => d.id === selected.id) || selected;
  const cfg = SEV[live.severity];
  const active = live.status === "active";

  const details = [
    ["GPS", `${live.lat.toFixed(4)}, ${live.lon.toFixed(4)}`],
    ["ALTITUDE", `${live.altitude} m`],
    ["SPEED", `${live.speed} km/h`],
    ["HEADING", `${Math.round(live.heading)}°`],
    ["DETECTED", formatTime(live.detectedMs)],
    ["IN AREA", secLabel(live.durationMs)],
    ...(live.status === "left" ? [["LEFT AT", formatTime(live.detectedMs + live.durationMs)]] : []),
  ];

  return (
    <div style={{ 
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      width: 280, 
      borderLeft: "1px solid rgba(0,212,255,0.2)", 
      background: "rgba(7,10,15,0.95)", 
      backdropFilter: "blur(8px)",
      padding: 16, 
      overflowY: "auto", 
      fontFamily: "'Share Tech Mono',monospace",
      transform: isVisible ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.3s ease-out",
      boxShadow: "-4px 0 20px rgba(0,0,0,0.5)",
      zIndex: 100
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontSize: 11, letterSpacing: 2.5, color: "#00d4ff88" }}>DRONE DETAIL</span>
        <button 
          onClick={onClose} 
          style={{ 
            color: "#00d4ff66", 
            fontSize: 15, 
            background: "none", 
            border: "none", 
            cursor: "pointer" 
          }}
        >
          ✕
        </button>
      </div>

      {/* Drone info card */}
      <div style={{ 
        marginBottom: 16, 
        padding: "12px 14px", 
        background: cfg.bg, 
        borderRadius: 5, 
        border: `1px solid ${cfg.color}33` 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
          <span style={{ 
            width: 9, 
            height: 9, 
            borderRadius: "50%", 
            background: cfg.color, 
            boxShadow: `0 0 8px ${cfg.glow}`, 
            display: "inline-block", 
            flexShrink: 0, 
            animation: active ? "pulse 1.6s ease-in-out infinite" : "none" 
          }}/>
          <span style={{ fontSize: 15, color: "#fff", fontWeight: 700 }}>{live.model}</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <span style={{ 
            fontSize: 11, 
            color: cfg.color, 
            letterSpacing: 1, 
            background: `${cfg.color}22`, 
            borderRadius: 3, 
            padding: "2px 6px", 
            fontWeight: 700 
          }}>
            {cfg.label}
          </span>
          <span style={{ 
            fontSize: 11, 
            color: active ? "#30d158" : "#667", 
            background: active ? "rgba(48,209,88,0.1)" : "rgba(255,255,255,0.05)", 
            borderRadius: 3, 
            padding: "2px 6px" 
          }}>
            {active ? "● AIRBORNE" : "✓ LEFT AREA"}
          </span>
        </div>
      </div>

      {/* Threat score */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
          <span style={{ fontSize: 11, color: "#00d4ff88", letterSpacing: 1.5 }}>THREAT SCORE</span>
          <span style={{ fontSize: 13, color: cfg.color, fontWeight: 700 }}>{live.threatScore}%</span>
        </div>
        <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ 
            height: "100%", 
            width: `${live.threatScore}%`, 
            background: `linear-gradient(90deg,${cfg.color}88,${cfg.color})`, 
            borderRadius: 2 
          }}/>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
          <span style={{ fontSize: 11, color: "#00d4ff88", letterSpacing: 1.5 }}>CONFIDENCE</span>
          <span style={{ fontSize: 12, color: "#7ecfff" }}>{live.confidence}%</span>
        </div>
      </div>

      {/* Details list */}
      {details.map(([k, v]) => (
        <div 
          key={k} 
          style={{ 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "baseline", 
            padding: "7px 0", 
            borderBottom: "1px solid rgba(0,212,255,0.06)" 
          }}
        >
          <span style={{ fontSize: 11, color: "#00d4ff88", letterSpacing: 1.2 }}>{k}</span>
          <span style={{ fontSize: 12, color: "#7ecfff", textAlign: "right", maxWidth: 140, wordBreak: "break-all" }}>{v}</span>
        </div>
      ))}

      {/* Detected by sensors */}
      {live.detectedBy && live.detectedBy.length > 0 && (
        <div style={{ 
          marginTop: 14, 
          padding: "10px 12px", 
          background: "rgba(0,212,255,0.04)", 
          borderRadius: 5, 
          border: "1px solid rgba(0,212,255,0.1)" 
        }}>
          <div style={{ fontSize: 11, color: "#00d4ff88", letterSpacing: 2, marginBottom: 8 }}>DETECTED BY</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {live.detectedBy.map(sid => {
              const sBase = SENSORS_BASE.find(s => s.id === sid);
              const isPatrol = sBase?.patrol;
              const sColor = "#8a9ab0";
              const signal = live.signalStrength?.[sid];
              const signalColor = signal >= 70 ? "#30d158" : signal >= 50 ? "#ffd60a" : "#ff8c00";
              return (
                <div key={sid} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={{ 
                    width: 7, 
                    height: 7, 
                    border: `1.5px solid ${sColor}`, 
                    transform: "rotate(45deg)", 
                    flexShrink: 0 
                  }}/>
                  <span style={{ fontSize: 12, color: sColor, fontWeight: 700 }}>{sid}</span>
                  {signal != null && (
                    <span style={{ 
                      fontSize: 10, 
                      color: signalColor, 
                      marginLeft: "auto",
                      background: `${signalColor}18`,
                      padding: "1px 5px",
                      borderRadius: 3
                    }}>
                      📶 {signal}%
                    </span>
                  )}
                  {isPatrol && !signal && <span style={{ fontSize: 10, color: "#8a9ab066", marginLeft: "auto" }}>PATROL</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dismiss button */}
      <button 
        onClick={onClose} 
        style={{ 
          marginTop: 14, 
          width: "100%", 
          padding: "8px 12px", 
          borderRadius: 4, 
          fontSize: 11, 
          letterSpacing: 1.5, 
          color: "#00d4ff66", 
          border: "1px solid rgba(0,212,255,0.12)", 
          background: "none", 
          cursor: "pointer", 
          fontFamily: "'Share Tech Mono',monospace" 
        }}
      >
        DISMISS
      </button>
    </div>
  );
}

export default DetailPanel;
