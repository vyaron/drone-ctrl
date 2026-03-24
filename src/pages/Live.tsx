import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import DroneRow from '../components/DroneRow';
import MapView from '../components/MapView';
import DetailPanel from '../components/DetailPanel';
import { 
  WINDOW_SEC, 
  DRONE_MODELS, 
  SENSORS_BASE,
  spawnDrone, 
  formatTime, 
  pick, 
  randInt,
  rand,
  addFreqSample,
  type Drone,
} from '../utils/droneUtils';

// Move bounds here for global drone movement
const BOUNDS = { 
  latMin: 31.35, 
  latMax: 31.85, 
  lonMin: 35.15, 
  lonMax: 35.65, 
  threshold: 0.03 
};

function Live(): ReactElement {
  const dronesRef = useRef<Drone[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Drone | null>(null);
  const [now, setNow] = useState(Date.now());
  const [running, setRunning] = useState(true);
  const [clock, setClock] = useState("");
  const location = useLocation();
  
  // Determine current view from route
  const currentPath = location.pathname.replace('/live', '').replace('/', '') || 'timeline';

  // Sync ref → state for React-driven UI
  useEffect(() => {
    const id = setInterval(() => setDrones([...dronesRef.current]), 300);
    return () => clearInterval(id);
  }, []);

  // Clock display
  useEffect(() => {
    const tick = () => setClock(new Date().toTimeString().split(" ")[0] + " UTC");
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // Timeline now ticker
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Initialize drones
  useEffect(() => {
    const t = Date.now();
    // Helper to give initial velocity toward target
    const addInitVelocity = (d: Drone): Drone => {
      const dLat = d.targetLat - d.lat;
      const dLon = d.targetLon - d.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      const initSpd = d.spd * 0.000004;
      return {
        ...d,
        vLat: (dLat / (dist || 1)) * initSpd,
        vLon: (dLon / (dist || 1)) * initSpd,
      };
    };
    // Spawn initial drones with a mix of detection levels for demo purposes
    // 2 location, 2 direction, 3 detection-level drones (1-3 concurrent per sensor)
    const initial: Drone[] = [];
    
    // Spawn 2 location-level drones
    for (let i = 0; i < 2; i++) {
      const d = spawnDrone(t - randInt(5000, 80000));
      d.level = 'location';
      initial.push(addInitVelocity(d));
    }
    
    // Spawn 2 direction-level drones with different bearings
    for (let i = 0; i < 2; i++) {
      const d = spawnDrone(t - randInt(5000, 80000));
      d.level = 'direction';
      d.bearing = randInt(0, 360);
      d.bearingWidth = randInt(15, 45);
      initial.push(addInitVelocity(d));
    }
    
    // Spawn 3 detection-level drones - distribute across sensors for demo
    // This ensures some sensors have 1-3 concurrent threats
    const sensorIds = SENSORS_BASE.map(s => s.id);
    const detSensorAssignments = [sensorIds[0], sensorIds[0], sensorIds[1]]; // 2 on first sensor, 1 on second
    for (let i = 0; i < 3; i++) {
      const d = spawnDrone(t - randInt(5000, 80000));
      d.level = 'detection';
      d.sensorId = detSensorAssignments[i];
      initial.push(addInitVelocity(d));
    }
    
    dronesRef.current = initial;
    setDrones([...dronesRef.current]);
  }, []);

  // Spawn new drones periodically - maintain mix of detection levels
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const activeDrones = dronesRef.current.filter(d => d.status === "active");
      if (activeDrones.length >= 8) return;
      
      // Count current distribution of detection levels
      const levelCounts = {
        location: activeDrones.filter(d => d.level === 'location').length,
        direction: activeDrones.filter(d => d.level === 'direction').length,
        detection: activeDrones.filter(d => d.level === 'detection').length,
      };
      
      const d = spawnDrone(Date.now());
      
      // Prioritize spawning levels with fewer drones (min 2 direction, 2 detection for demo)
      if (levelCounts.direction < 2) {
        d.level = 'direction';
        d.bearing = randInt(0, 360);
        d.bearingWidth = randInt(15, 45);
      } else if (levelCounts.detection < 2) {
        d.level = 'detection';
        // Find sensor with fewest threats
        const sensorThreatCount = new Map<string, number>();
        activeDrones.filter(dr => dr.level === 'detection').forEach(dr => {
          if (dr.sensorId) {
            sensorThreatCount.set(dr.sensorId, (sensorThreatCount.get(dr.sensorId) || 0) + 1);
          }
        });
        // Pick sensor with least threats (but not more than 3)
        const validSensors = SENSORS_BASE.filter(s => (sensorThreatCount.get(s.id) || 0) < 3);
        if (validSensors.length > 0) {
          d.sensorId = pick(validSensors).id;
        }
      }
      // Otherwise let spawnDrone's random level assignment stand
      
      // Give initial velocity toward target so drones don't start stationary
      const dLat = d.targetLat - d.lat;
      const dLon = d.targetLon - d.lon;
      const dist = Math.sqrt(dLat * dLat + dLon * dLon);
      const initSpd = d.spd * 0.000004;
      d.vLat = (dLat / (dist || 1)) * initSpd;
      d.vLon = (dLon / (dist || 1)) * initSpd;
      dronesRef.current = [...dronesRef.current, d];
    }, 8000);
    return () => clearInterval(id);
  }, [running]);

  // Update drone statuses and cleanup old ones
  useEffect(() => {
    const id = setInterval(() => {
      const cutoff = Date.now() - WINDOW_SEC * 1000 * 2.5;
      dronesRef.current = dronesRef.current
        .map(d => d.status === "active" && Date.now() > d.detectedMs + d.durationMs ? { ...d, status: "left" as const } : d)
        .filter(d => d.detectedMs > cutoff);
    }, 600);
    return () => clearInterval(id);
  }, []);

  // Global drone movement animation (always runs - map view uses its own separate positions)
  useEffect(() => {
    if (!running) return;
    let raf: number;
    let lastTs: number | null = null;
    
    function moveDrones(ts: number) {
      const dt = lastTs ? Math.min(ts - lastTs, 100) : 16;
      lastTs = ts;
      
      dronesRef.current.forEach(d => {
        if (d.status !== "active") return;
        const dLat = d.targetLat - d.lat;
        const dLon = d.targetLon - d.lon;
        const dist = Math.sqrt(dLat * dLat + dLon * dLon);
        if (dist < BOUNDS.threshold) {
          d.targetLat = rand(BOUNDS.latMin, BOUNDS.latMax);
          d.targetLon = rand(BOUNDS.lonMin, BOUNDS.lonMax);
        }
        const spdMult = 0.000008;
        const accel = 0.00005;
        d.vLat += (dLat / (dist || 1)) * d.spd * accel;
        d.vLon += (dLon / (dist || 1)) * d.spd * accel;
        d.vLat *= 0.98;
        d.vLon *= 0.98;
        const curSpd = Math.sqrt(d.vLat * d.vLat + d.vLon * d.vLon);
        const maxSpd = d.spd * spdMult;
        if (curSpd > maxSpd) { 
          d.vLat = d.vLat / curSpd * maxSpd; 
          d.vLon = d.vLon / curSpd * maxSpd; 
        }
        d.lat += d.vLat * dt;
        d.lon += d.vLon * dt;
        if (d.lat < BOUNDS.latMin || d.lat > BOUNDS.latMax) { 
          d.vLat *= -1; 
          d.lat = Math.max(BOUNDS.latMin, Math.min(BOUNDS.latMax, d.lat)); 
        }
        if (d.lon < BOUNDS.lonMin || d.lon > BOUNDS.lonMax) { 
          d.vLon *= -1; 
          d.lon = Math.max(BOUNDS.lonMin, Math.min(BOUNDS.lonMax, d.lon)); 
        }
        d.heading = (Math.atan2(d.vLon, d.vLat) * 180 / Math.PI + 360) % 360;
      });
      
      raf = requestAnimationFrame(moveDrones);
    }
    
    raf = requestAnimationFrame(moveDrones);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  // Frequency sampling - add new freq samples every 250ms
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      dronesRef.current.forEach(d => {
        if (d.status === "active") {
          addFreqSample(d, now);
        }
      });
    }, 250);
    return () => clearInterval(id);
  }, [running]);

  // Dynamic bearing changes for direction-level drones (every 8-15 seconds)
  useEffect(() => {
    if (!running) return;
    
    // Track next change time per drone
    const nextBearingChange = new Map<string, number>();
    
    const id = setInterval(() => {
      const now = Date.now();
      dronesRef.current.forEach(d => {
        if (d.status !== "active" || d.level !== 'direction') return;
        
        // Initialize next change time if not set
        if (!nextBearingChange.has(d.id)) {
          nextBearingChange.set(d.id, now + randInt(8000, 15000));
        }
        
        // Check if it's time to change bearing
        const nextChange = nextBearingChange.get(d.id)!;
        if (now >= nextChange) {
          // Change bearing smoothly - rotate by 20-60 degrees
          const rotation = randInt(20, 60) * (Math.random() > 0.5 ? 1 : -1);
          d.bearing = ((d.bearing || 0) + rotation + 360) % 360;
          // Slightly vary bearing width
          d.bearingWidth = randInt(15, 45);
          // Set next change time (8-15 seconds)
          nextBearingChange.set(d.id, now + randInt(8000, 15000));
        }
      });
    }, 500);
    
    return () => clearInterval(id);
  }, [running]);

  // Dynamic sensor changes for detection-level drones (every 8-15 seconds)
  // Also ensures 1-3 concurrent threats per sensor for demo purposes
  useEffect(() => {
    if (!running) return;
    
    // Track next change time per drone
    const nextSensorChange = new Map<string, number>();
    
    const id = setInterval(() => {
      const now = Date.now();
      const activeDrones = dronesRef.current.filter(d => d.status === "active" && d.level === 'detection');
      
      // Get current sensor distribution
      const sensorThreatCount = new Map<string, number>();
      activeDrones.forEach(d => {
        if (d.sensorId) {
          sensorThreatCount.set(d.sensorId, (sensorThreatCount.get(d.sensorId) || 0) + 1);
        }
      });
      
      activeDrones.forEach(d => {
        // Initialize next change time if not set
        if (!nextSensorChange.has(d.id)) {
          nextSensorChange.set(d.id, now + randInt(8000, 15000));
        }
        
        // Check if it's time to change sensor
        const nextChange = nextSensorChange.get(d.id)!;
        if (now >= nextChange) {
          // Find sensors with less than 3 threats (to ensure 1-3 concurrent threats)
          const availableSensors = SENSORS_BASE.filter(s => {
            const count = sensorThreatCount.get(s.id) || 0;
            // Prefer sensors with 0-2 threats, but still allow current sensor to be excluded
            return s.id !== d.sensorId && count < 3;
          });
          
          if (availableSensors.length > 0) {
            // Update threat count for old sensor
            if (d.sensorId) {
              const oldCount = sensorThreatCount.get(d.sensorId) || 1;
              sensorThreatCount.set(d.sensorId, oldCount - 1);
            }
            
            // Pick new sensor
            const newSensor = pick(availableSensors);
            d.sensorId = newSensor.id;
            
            // Update threat count for new sensor
            sensorThreatCount.set(newSensor.id, (sensorThreatCount.get(newSensor.id) || 0) + 1);
          }
          
          // Set next change time (8-15 seconds)
          nextSensorChange.set(d.id, now + randInt(8000, 15000));
        }
      });
    }, 500);
    
    return () => clearInterval(id);
  }, [running]);

  const winEnd = now;
  const winStart = now - WINDOW_SEC * 1000;

  const filtered = drones.filter(d => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.model.toLowerCase().includes(q) && !String(d.lat).includes(q) && !String(d.lon).includes(q)) return false;
    }
    return d.detectedMs + d.durationMs > winStart;
  }).sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    return b.detectedMs - a.detectedMs; // Sort by detection time, newest first
  });

  const totalActive = drones.filter(d => d.status === "active").length;
  // Filtered active count for "X ON MAP" display
  const filterFn = (d: Drone): boolean => {
    if (search) {
      const q = search.toLowerCase();
      if (!d.model.toLowerCase().includes(q) && !String(d.lat).includes(q) && !String(d.lon).includes(q)) return false;
    }
    return true;
  };
  const filteredActiveCount = drones.filter(d => d.status === "active" && filterFn(d)).length;
  const markers = Array.from({ length: 6 }, (_, i) => ({ 
    pct: i * 20, 
    label: formatTime(winStart + i / 5 * (winEnd - winStart)) 
  }));
  const LABEL_W = 260;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ 
        padding: "10px 20px", 
        display: "flex", 
        alignItems: "center", 
        gap: 16, 
        borderBottom: "1px solid rgba(0,212,255,0.12)", 
        background: "rgba(0,5,12,0.95)", 
        flexShrink: 0 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#8899aa", letterSpacing: 2 }}>LIVE TRACKING</span>
          <span style={{ 
            width: 7, 
            height: 7, 
            borderRadius: "50%", 
            background: running ? "#00d4ff" : "#334", 
            animation: running ? "blink 1.1s ease-in-out infinite" : "none", 
            marginLeft: 6, 
            flexShrink: 0 
          }}/>
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(0,212,255,0.15)", margin: "0 4px" }}/>
        <div style={{ fontSize: 12, color: "#8899aa" }}>ACTIVE <span style={{ color: "#e8eaf0", fontSize: 16, fontWeight: 700 }}>{totalActive}</span></div>
        <div style={{ fontSize: 12, color: "#8899aa" }}>AREA <strong style={{ color: "#7ecfff" }}>47.3 km²</strong></div>
        <div style={{ flex: 1 }}/>
        <button 
          onClick={() => setRunning(r => !r)} 
          style={{ 
            padding: "5px 12px", 
            borderRadius: 3, 
            fontSize: 11, 
            letterSpacing: 1.5, 
            background: running ? "rgba(0,212,255,0.06)" : "rgba(0,255,157,0.1)", 
            color: running ? "#00d4ff88" : "#00ff9d", 
            border: `1px solid ${running ? "rgba(0,212,255,0.15)" : "rgba(0,255,157,0.3)"}`, 
            cursor: "pointer", 
            fontFamily: "'Share Tech Mono',monospace" 
          }}
        >
          {running ? "⏸ PAUSE" : "▶ RESUME"}
        </button>
        <div style={{ fontSize: 14, color: "#00d4ff", letterSpacing: 1 }}>{clock}</div>
      </div>

      {/* Navigation + Filters */}
      <div style={{ 
        padding: "0 20px", 
        display: "flex", 
        alignItems: "center", 
        borderBottom: "1px solid rgba(0,212,255,0.08)", 
        flexShrink: 0, 
        background: "rgba(0,5,12,0.7)" 
      }}>
        {/* Left side - Navigation */}
        {[{ id: "timeline", icon: "▤", label: "TIMELINE" }, { id: "tactical", icon: "◈", label: "TACTICAL" }, { id: "map", icon: "🛰️", label: "MAP" }].map(t => (
          <Link 
            key={t.id} 
            to={`/live/${t.id}`}
            style={{ 
              padding: "10px 16px", 
              fontSize: 12, 
              letterSpacing: 2, 
              fontWeight: 700, 
              color: currentPath === t.id ? "#00d4ff" : "#8899aa", 
              background: "none", 
              textDecoration: "none",
              borderBottom: currentPath === t.id ? "2px solid #00d4ff" : "2px solid transparent", 
              marginBottom: "-1px", 
              transition: "color 0.15s", 
              display: "flex", 
              alignItems: "center", 
              gap: 5, 
              fontFamily: "'Share Tech Mono',monospace" 
            }}
          >
            <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
          </Link>
        ))}
        
        <div style={{ flex: 1 }}/>
        
        {/* Right side - Search */}
        <span style={{ fontSize: 11, color: "#8899aa", letterSpacing: 1, marginRight: 12 }}>
          {currentPath === "timeline" ? "5 MIN WINDOW" : `${filteredActiveCount} ON MAP`}
        </span>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 7, 
          background: "rgba(0,212,255,0.04)", 
          borderRadius: 4, 
          padding: "5px 10px", 
          border: "1px solid rgba(0,212,255,0.1)", 
          width: 180 
        }}>
          <span style={{ color: "#00d4ff44", fontSize: 14 }}>⌕</span>
          <input 
            placeholder="Search…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            style={{ 
              fontSize: 12, 
              width: "100%", 
              color: "#7ecfff", 
              background: "none", 
              border: "none", 
              outline: "none", 
              fontFamily: "'Share Tech Mono',monospace" 
            }}
          />
          {search && (
            <button 
              onClick={() => setSearch("")} 
              style={{ color: "#00d4ff44", fontSize: 13, background: "none", border: "none", cursor: "pointer" }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        <div style={{ 
          flex: 1, 
          display: "flex",
          overflow: "hidden", 
          transition: "margin-right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
          marginRight: selected ? 360 : 0 
        }}>
        <Routes>
          <Route path="/" element={<Navigate to="/live/timeline" replace />} />
          <Route path="timeline" element={
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Timeline header */}
              <div style={{ 
                position: "relative", 
                height: 26, 
                borderBottom: "1px solid rgba(0,212,255,0.07)", 
                paddingLeft: LABEL_W, 
                flexShrink: 0, 
                background: "rgba(0,5,12,0.5)" 
              }}>
                {markers.map(m => (
                  <div 
                    key={m.pct} 
                    style={{ 
                      position: "absolute", 
                      left: `calc(${LABEL_W}px + ${m.pct}% * (100% - ${LABEL_W}px) / 100)`, 
                      top: 0, 
                      bottom: 0, 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center" 
                    }}
                  >
                    <div style={{ width: 1, height: 5, background: "rgba(0,212,255,0.2)", marginTop: 3 }}/>
                    <span style={{ fontSize: 10, color: "#8899aa", whiteSpace: "nowrap", transform: "translateX(-50%)", marginTop: 2 }}>
                      {m.label}
                    </span>
                  </div>
                ))}
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, display: "flex", alignItems: "center", paddingRight: 5 }}>
                  <span style={{ fontSize: 10, color: "#00d4ff", letterSpacing: 1.5 }}>NOW</span>
                </div>
              </div>

              {/* Drone rows */}
              <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: "rgba(0,212,255,0.2)", pointerEvents: "none", zIndex: 10 }}/>
                {filtered.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: "#8899aa", fontSize: 13, letterSpacing: 2 }}>
                    NO DRONES IN WINDOW
                  </div>
                ) : (
                  filtered.map(d => (
                    <DroneRow 
                      key={d.id} 
                      drone={d} 
                      winStart={winStart} 
                      winEnd={winEnd} 
                      onClick={setSelected} 
                      selected={selected?.id === d.id}
                    />
                  ))
                )}
              </div>
            </div>
          } />
          <Route path="tactical" element={
            <MapView
              dronesRef={dronesRef}
              selected={selected}
              onSelect={setSelected}
              filterFn={filterFn}
              mode="canvas"
            />
          } />
          <Route path="map" element={
            <MapView
              dronesRef={dronesRef}
              selected={selected}
              onSelect={setSelected}
              filterFn={filterFn}
              mode="google"
            />
          } />
        </Routes>
        </div>

        <DetailPanel selected={selected} dronesRef={dronesRef} onClose={() => setSelected(null)}/>
      </div>
    </div>
  );
}

export default Live;
