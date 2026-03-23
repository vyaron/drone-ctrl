import { useState, useEffect, type MutableRefObject, type ReactElement } from 'react';
import { DRONE_COLORS, type Drone } from '../utils/droneUtils';

interface DetailPanelProps {
  selected: Drone | null;
  dronesRef: MutableRefObject<Drone[]>;
  onClose: () => void;
}

function DetailPanel({ selected, dronesRef, onClose }: DetailPanelProps): ReactElement | null {
  const [isVisible, setIsVisible] = useState(false);
  const [displayedDrone, setDisplayedDrone] = useState<Drone | null>(null);
  const [, setTick] = useState(0);
  
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
      setTick(t => t + 1); // Force re-render for elapsed time
    }, 100);
    return () => clearInterval(interval);
  }, [selected, dronesRef]);

  if (!displayedDrone) return null;
  
  const drone = displayedDrone;
  const cfg = DRONE_COLORS[drone.colorIndex % DRONE_COLORS.length];
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
        }}/>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: "#fff", fontSize: 15, fontWeight: 700, letterSpacing: 0.5 }}>{drone.model}</span>
            {drone.level && (
              <span style={{ 
                fontSize: 9,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 3,
                letterSpacing: 0.5,
                color: '#7ecfff',
                background: 'rgba(126,207,255,0.15)',
              }}>
                {drone.level === 'location' ? 'GEO' : drone.level === 'direction' ? 'DIR' : 'DETECT'}
              </span>
            )}
          </div>
          <div style={{ color: cfg.color, fontSize: 11, marginTop: 2 }}>DRONE</div>
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
              color: "#7ecfff",
              opacity: drone.status === "active" ? 1 : 0.4,
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
            { label: "HEADING", value: `${Math.round(drone.heading)}°`, unit: "" },
            { label: "FREQ", value: `${drone.currentFreq.toFixed(1)}`, unit: "MHz" },
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

        {/* Location / Direction / Detection Info */}
        <div style={{ fontSize: 10, color: "#8899aa", letterSpacing: 2, marginBottom: 10 }}>
          {!drone.level || drone.level === 'location' ? 'LOCATION' : drone.level === 'direction' ? 'DIRECTION' : 'DETECTION'}
        </div>
        <div style={{
          background: "rgba(0,212,255,0.03)",
          borderRadius: 6,
          padding: 14,
          border: "1px solid rgba(0,212,255,0.06)",
          marginBottom: 20
        }}>
          {(!drone.level || drone.level === 'location') ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#8899aa", fontSize: 10 }}>LATITUDE</span>
                <span style={{ color: "#7ecfff", fontSize: 12 }}>{drone.lat.toFixed(6)}°N</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8899aa", fontSize: 10 }}>LONGITUDE</span>
                <span style={{ color: "#7ecfff", fontSize: 12 }}>{drone.lon.toFixed(6)}°E</span>
              </div>
            </>
          ) : drone.level === 'direction' ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ color: "#8899aa", fontSize: 10 }}>BEARING</span>
                <span style={{ color: "#f59e0b", fontSize: 12 }}>{drone.bearing ?? 0}°</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "#8899aa", fontSize: 10 }}>WIDTH</span>
                <span style={{ color: "#f59e0b", fontSize: 12 }}>±{(drone.bearingWidth ?? 30) / 2}°</span>
              </div>
            </>
          ) : (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#8899aa", fontSize: 10 }}>SENSOR</span>
              <span style={{ color: "#8b5cf6", fontSize: 12 }}>{drone.sensorId || drone.detectedBy[0]}</span>
            </div>
          )}
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
    </div>
  );
}

export default DetailPanel;
