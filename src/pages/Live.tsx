import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import DroneRow from '../components/DroneRow';
import MapView from '../components/MapView';
import DetailPanel from '../components/DetailPanel';
import { 
  SEV, 
  WINDOW_SEC, 
  DRONE_MODELS, 
  spawnDrone, 
  formatTime, 
  pick, 
  randInt,
  type Drone,
  type SeverityLevel
} from '../utils/droneUtils';

function Live(): ReactElement {
  const dronesRef = useRef<Drone[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [filter, setFilter] = useState<'all' | SeverityLevel>("all");
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
    const guaranteed = (["critical", "high", "medium", "low"] as SeverityLevel[]).map(sev => {
      const d = spawnDrone(t - randInt(20000, 80000));
      return { ...d, severity: sev, model: pick(DRONE_MODELS[sev]) };
    });
    const extra = Array.from({ length: 1 }, () => spawnDrone(t - randInt(5000, 60000)));
    dronesRef.current = [...guaranteed, ...extra];
    setDrones([...dronesRef.current]);
  }, []);

  // Spawn new drones periodically
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const active = dronesRef.current.filter(d => d.status === "active").length;
      if (active >= 5) return;
      dronesRef.current = [...dronesRef.current, spawnDrone(Date.now())];
    }, 12000);
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

  const winEnd = now;
  const winStart = now - WINDOW_SEC * 1000;

  const filtered = drones.filter(d => {
    if (filter !== "all" && d.severity !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!d.model.toLowerCase().includes(q) && !String(d.lat).includes(q) && !String(d.lon).includes(q)) return false;
    }
    return d.detectedMs + d.durationMs > winStart;
  }).sort((a, b) => {
    if (a.status === "active" && b.status !== "active") return -1;
    if (b.status === "active" && a.status !== "active") return 1;
    const sevOrder: Record<SeverityLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return sevOrder[a.severity] - sevOrder[b.severity];
  });

  const counts: Record<SeverityLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
  drones.filter(d => d.status === "active").forEach(d => counts[d.severity]++);
  const totalActive = Object.values(counts).reduce((a, b) => a + b, 0);
  
  // Filtered active count for "X ON MAP" display
  const filterFn = (d: Drone): boolean => {
    if (filter !== "all" && d.severity !== filter) return false;
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
            background: running ? "#ff2d55" : "#334", 
            animation: running ? "blink 1.1s ease-in-out infinite" : "none", 
            marginLeft: 6, 
            flexShrink: 0 
          }}/>
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(0,212,255,0.15)", margin: "0 4px" }}/>
        {(["critical", "high", "medium", "low"] as SeverityLevel[]).map(s => (
          <div key={s} style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: 5, 
            opacity: counts[s] > 0 ? 1 : 0.25, 
            transition: "opacity 0.3s" 
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: SEV[s].color, flexShrink: 0 }}/>
            <span style={{ fontSize: 11, color: SEV[s].color, letterSpacing: 1 }}>{SEV[s].label}</span>
            <span style={{ fontSize: 16, color: "#fff", fontWeight: 700 }}>{counts[s]}</span>
          </div>
        ))}
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
        
        {/* Right side - Filters */}
        <span style={{ fontSize: 11, color: "#8899aa", letterSpacing: 1, marginRight: 12 }}>
          {currentPath === "timeline" ? "5 MIN WINDOW" : `${filteredActiveCount} ON MAP`}
        </span>
        <div style={{ display: "flex", gap: 3, marginRight: 10 }}>
          {(["all", "critical", "high", "medium", "low"] as const).map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)} 
              style={{ 
                padding: "4px 9px", 
                borderRadius: 3, 
                fontSize: 11, 
                letterSpacing: 1, 
                fontWeight: 700, 
                background: filter === f ? (f === "all" ? "rgba(0,212,255,0.12)" : SEV[f]?.bg) : "transparent", 
                color: filter === f ? (f === "all" ? "#00d4ff" : SEV[f]?.color) : "#8899aa", 
                border: `1px solid ${filter === f ? (f === "all" ? "rgba(0,212,255,0.3)" : SEV[f]?.color + "55") : "rgba(0,212,255,0.07)"}`, 
                cursor: "pointer", 
                transition: "all 0.12s", 
                fontFamily: "'Share Tech Mono',monospace" 
              }}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ width: 1, height: 18, background: "rgba(0,212,255,0.12)", margin: "0 4px" }}/>
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
                  <span style={{ fontSize: 10, color: "#ff2d55", letterSpacing: 1.5 }}>NOW</span>
                </div>
              </div>

              {/* Drone rows */}
              <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 1, background: "rgba(255,45,85,0.2)", pointerEvents: "none", zIndex: 10 }}/>
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
