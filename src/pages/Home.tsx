import { useState, useEffect, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { SENSORS_BASE } from '../utils/droneUtils';

interface SensorHealth {
  id: string;
  status: 'online' | 'degraded' | 'offline';
  latency: number;
  lastPing: number;
}

function Home(): ReactElement {
  const [activeThreats, setActiveThreats] = useState(0);
  const [todayDetections, setTodayDetections] = useState(0);
  const [lastDetection, setLastDetection] = useState<number | null>(null);
  const [sensorHealth, setSensorHealth] = useState<SensorHealth[]>([]);
  const [systemCheck, setSystemCheck] = useState(Date.now());
  const [avgLatency, setAvgLatency] = useState(0);
  
  // Initialize and simulate live updates
  useEffect(() => {
    // Initialize sensor health
    const initHealth = SENSORS_BASE.map(s => ({
      id: s.id,
      status: 'online' as const,
      latency: 10 + Math.random() * 30,
      lastPing: Date.now(),
    }));
    setSensorHealth(initHealth);
    
    // Initial values
    setTodayDetections(Math.floor(15 + Math.random() * 30));
    setLastDetection(Date.now() - Math.floor(Math.random() * 600000)); // within last 10 min
    
    // Update every 2 seconds
    const interval = setInterval(() => {
      // Randomly update active threats (0-3)
      setActiveThreats(Math.floor(Math.random() * 4));
      
      // Occasionally add a detection
      if (Math.random() < 0.1) {
        setTodayDetections(d => d + 1);
        setLastDetection(Date.now());
      }
      
      // Update sensor health
      setSensorHealth(prev => prev.map(s => ({
        ...s,
        latency: Math.max(5, s.latency + (Math.random() - 0.5) * 10),
        lastPing: Date.now(),
        status: Math.random() < 0.02 ? 'degraded' : 'online',
      })));
      
      setSystemCheck(Date.now());
    }, 2000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Calculate average latency
  useEffect(() => {
    if (sensorHealth.length > 0) {
      const avg = sensorHealth.reduce((sum, s) => sum + s.latency, 0) / sensorHealth.length;
      setAvgLatency(avg);
    }
  }, [sensorHealth]);
  
  const formatTimeAgo = (ts: number | null): string => {
    if (!ts) return '—';
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    return `${Math.floor(min / 60)}h ago`;
  };
  
  const onlineSensors = sensorHealth.filter(s => s.status === 'online').length;
  const degradedSensors = sensorHealth.filter(s => s.status === 'degraded').length;
  
  return (
    <div className="page" style={{ position: 'relative', overflow: 'auto' }}>
      <img 
        src="./sphere.svg" 
        alt="" 
        style={{ 
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          width: 600, 
          height: 600, 
          opacity: 0.15, 
          pointerEvents: 'none',
          zIndex: 0
        }} 
      />
      <div style={{ position: 'relative', zIndex: 1, padding: 20 }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#e8eaf0', letterSpacing: 2, margin: 0 }}>DASHBOARD</h1>
          <p style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginTop: 4 }}>SYSTEM OVERVIEW</p>
        </div>
      
        {/* Live System Stats */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>LIVE STATS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div style={{
              background: activeThreats > 0 ? 'rgba(255,149,0,0.1)' : 'rgba(0,212,255,0.05)',
              border: `1px solid ${activeThreats > 0 ? 'rgba(255,149,0,0.3)' : 'rgba(0,212,255,0.1)'}`,
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ color: '#8899aa', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>ACTIVE THREATS</div>
              <div style={{ 
                color: activeThreats > 0 ? '#ff9500' : '#00d4ff', 
                fontSize: 32, 
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                {activeThreats}
                {activeThreats > 0 && (
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: '#ff9500',
                    animation: 'pulse 1s infinite',
                  }} />
                )}
              </div>
            </div>
            
            <div style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ color: '#8899aa', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>TODAY'S DETECTIONS</div>
              <div style={{ color: '#e8eaf0', fontSize: 32, fontWeight: 700 }}>{todayDetections}</div>
            </div>
            
            <div style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ color: '#8899aa', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>LAST DETECTION</div>
              <div style={{ color: '#7ecfff', fontSize: 20, fontWeight: 700 }}>{formatTimeAgo(lastDetection)}</div>
            </div>
            
            <div style={{
              background: 'rgba(0,212,255,0.05)',
              border: '1px solid rgba(0,212,255,0.1)',
              borderRadius: 8,
              padding: '16px 20px',
            }}>
              <div style={{ color: '#8899aa', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>ACTIVE SENSORS</div>
              <div style={{ color: '#e8eaf0', fontSize: 32, fontWeight: 700 }}>
                {onlineSensors}<span style={{ fontSize: 16, color: '#8899aa' }}>/{SENSORS_BASE.length}</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* System Health Indicators */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>SYSTEM HEALTH</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
            {/* Sensor Status */}
            <div style={{
              background: 'rgba(0,20,40,0.4)',
              border: '1px solid rgba(0,212,255,0.08)',
              borderRadius: 8,
              padding: 16,
            }}>
              <div style={{ fontSize: 10, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>SENSOR STATUS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {sensorHealth.map(sensor => (
                  <div key={sensor.id} style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    background: 'rgba(0,10,20,0.5)',
                    borderRadius: 6,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ 
                        width: 8, 
                        height: 8, 
                        borderRadius: '50%', 
                        background: sensor.status === 'online' ? '#00d4ff' : sensor.status === 'degraded' ? '#ff9500' : '#ff453a',
                        boxShadow: `0 0 8px ${sensor.status === 'online' ? 'rgba(0,212,255,0.5)' : sensor.status === 'degraded' ? 'rgba(255,149,0,0.5)' : 'rgba(255,69,58,0.5)'}`,
                      }} />
                      <span style={{ color: '#e8eaf0', fontSize: 12, fontWeight: 600 }}>{sensor.id}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ 
                        fontSize: 9, 
                        padding: '2px 6px', 
                        borderRadius: 3,
                        background: sensor.status === 'online' ? 'rgba(0,212,255,0.15)' : 'rgba(255,149,0,0.15)',
                        color: sensor.status === 'online' ? '#00d4ff' : '#ff9500',
                        fontWeight: 700,
                        letterSpacing: 0.5,
                      }}>
                        {sensor.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 11, color: '#8899aa', width: 50, textAlign: 'right' }}>
                        {sensor.latency.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Network & System */}
            <div style={{
              background: 'rgba(0,20,40,0.4)',
              border: '1px solid rgba(0,212,255,0.08)',
              borderRadius: 8,
              padding: 16,
            }}>
              <div style={{ fontSize: 10, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>NETWORK & SYSTEM</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(0,10,20,0.5)',
                  borderRadius: 6,
                }}>
                  <span style={{ color: '#8899aa', fontSize: 11 }}>Avg Latency</span>
                  <span style={{ 
                    color: avgLatency < 30 ? '#00d4ff' : avgLatency < 60 ? '#ff9500' : '#ff453a', 
                    fontSize: 14, 
                    fontWeight: 700 
                  }}>
                    {avgLatency.toFixed(1)} ms
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(0,10,20,0.5)',
                  borderRadius: 6,
                }}>
                  <span style={{ color: '#8899aa', fontSize: 11 }}>Sensors Online</span>
                  <span style={{ color: degradedSensors > 0 ? '#ff9500' : '#00d4ff', fontSize: 14, fontWeight: 700 }}>
                    {onlineSensors}/{SENSORS_BASE.length}
                    {degradedSensors > 0 && <span style={{ color: '#ff9500', marginLeft: 6 }}>({degradedSensors} degraded)</span>}
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(0,10,20,0.5)',
                  borderRadius: 6,
                }}>
                  <span style={{ color: '#8899aa', fontSize: 11 }}>Last System Check</span>
                  <span style={{ color: '#7ecfff', fontSize: 12 }}>
                    {new Date(systemCheck).toLocaleTimeString()}
                  </span>
                </div>
                
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '10px 12px',
                  background: 'rgba(0,10,20,0.5)',
                  borderRadius: 6,
                }}>
                  <span style={{ color: '#8899aa', fontSize: 11 }}>System Status</span>
                  <span style={{ 
                    fontSize: 10, 
                    padding: '3px 8px',
                    borderRadius: 3,
                    background: 'rgba(0,212,255,0.15)',
                    color: '#00d4ff',
                    fontWeight: 700,
                    letterSpacing: 1,
                  }}>
                    OPERATIONAL
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>QUICK NAVIGATION</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/live" style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 8,
              padding: '16px 24px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20, color: '#00d4ff' }}>◉</span>
              <div>
                <div style={{ color: '#00d4ff', fontSize: 14, fontWeight: 700 }}>Live View</div>
                <div style={{ color: '#8899aa', fontSize: 11 }}>Real-time monitoring</div>
              </div>
              <span style={{ color: '#00d4ff', marginLeft: 8 }}>→</span>
            </Link>
            
            <Link to="/reports" style={{
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.2)',
              borderRadius: 8,
              padding: '16px 24px',
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              transition: 'all 0.2s',
            }}>
              <span style={{ fontSize: 20, color: '#00d4ff' }}>⊞</span>
              <div>
                <div style={{ color: '#00d4ff', fontSize: 14, fontWeight: 700 }}>Reports</div>
                <div style={{ color: '#8899aa', fontSize: 11 }}>Investigation tools</div>
              </div>
              <span style={{ color: '#00d4ff', marginLeft: 8 }}>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
