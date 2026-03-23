import type { ReactElement } from 'react';
import { SEV, formatTime, type Drone, type Event } from '../utils/droneUtils';

interface HistoricalTimelineProps {
  event: Event;
  drones: Drone[];
  currentTs: number;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
}

// Format timestamp to readable string
function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function HistoricalTimeline({ 
  event, 
  drones, 
  currentTs, 
  selected, 
  onSelect 
}: HistoricalTimelineProps): ReactElement {
  const LABEL_W = 260;
  const winStart = event.startedAt;
  const winEnd = event.endedAt;
  const windowLen = winEnd - winStart;
  
  // Current time position as percentage
  const nowPos = ((currentTs - winStart) / windowLen) * 100;
  
  // Generate time markers for the event duration
  const markerCount = 6;
  const markers = Array.from({ length: markerCount }, (_, i) => ({
    pct: (i / (markerCount - 1)) * 100,
    label: formatDateTime(winStart + (i / (markerCount - 1)) * windowLen),
  }));

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Timeline header */}
      <div style={{ 
        position: 'relative', 
        height: 26, 
        borderBottom: '1px solid rgba(0,212,255,0.07)', 
        paddingLeft: LABEL_W, 
        flexShrink: 0, 
        background: 'rgba(0,5,12,0.5)' 
      }}>
        {markers.map(m => (
          <div 
            key={m.pct} 
            style={{ 
              position: 'absolute', 
              left: `calc(${LABEL_W}px + ${m.pct}% * (100% - ${LABEL_W}px) / 100)`, 
              top: 0, 
              bottom: 0, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center' 
            }}
          >
            <div style={{ width: 1, height: 5, background: 'rgba(0,212,255,0.2)', marginTop: 3 }}/>
            <span style={{ fontSize: 10, color: '#8899aa', whiteSpace: 'nowrap', transform: 'translateX(-50%)', marginTop: 2 }}>
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* Drone rows */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {/* Current time marker */}
        <div style={{ 
          position: 'absolute',
          left: `calc(${LABEL_W}px + ${nowPos}% * (100% - ${LABEL_W}px) / 100)`,
          top: 0, 
          bottom: 0, 
          width: 2, 
          background: 'rgba(0,212,255,0.6)',
          boxShadow: '0 0 8px rgba(0,212,255,0.4)',
          pointerEvents: 'none', 
          zIndex: 10 
        }}/>
        
        {event.detections.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: '#8899aa', fontSize: 13, letterSpacing: 2 }}>
            NO DETECTIONS
          </div>
        ) : (
          event.detections.map(det => {
            const drone = drones.find(d => d.id === det.droneId);
            const cfg = SEV[det.severity];
            
            const detectPos = Math.max(0, (det.startedAt - winStart) / windowLen) * 100;
            const barEnd = Math.min(100, ((det.endedAt - winStart) / windowLen) * 100);
            const detectWidth = barEnd - detectPos;
            const isActive = currentTs >= det.startedAt && currentTs <= det.endedAt;
            const isSelected = selected?.id === det.droneId;
            
            return (
              <div 
                key={det.id}
                onClick={() => onSelect(drone || null)} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  padding: '7px 0', 
                  borderBottom: '1px solid rgba(0,212,255,0.04)', 
                  cursor: 'pointer', 
                  opacity: isActive ? 1 : 0.35, 
                  background: isSelected ? 'rgba(0,212,255,0.04)' : 'transparent' 
                }}
              >
                {/* Label area */}
                <div style={{ width: LABEL_W, paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <span style={{ 
                    width: 8, 
                    height: 8, 
                    borderRadius: '50%', 
                    background: cfg.color, 
                    boxShadow: isActive ? `0 0 6px ${cfg.glow}` : 'none',
                  }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: '#e8eaf0', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {det.droneType}
                    </div>
                    <div style={{ fontSize: 10, color: '#8899aa' }}>
                      {drone ? `${drone.lat.toFixed(4)}, ${drone.lon.toFixed(4)}` : `${det.lat.toFixed(4)}, ${det.lon.toFixed(4)}`}
                    </div>
                  </div>
                  <div style={{ 
                    padding: '2px 6px', 
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
                <div style={{ flex: 1, height: 18, position: 'relative' }}>
                  <div style={{ 
                    position: 'absolute', 
                    left: `${detectPos}%`, 
                    width: `${detectWidth}%`, 
                    top: 0, 
                    bottom: 0, 
                    borderRadius: 3, 
                    background: `linear-gradient(90deg, ${cfg.color}dd, ${cfg.color}66)`, 
                    boxShadow: isActive ? `0 0 10px ${cfg.glow}` : 'none',
                    minWidth: 3 
                  }}/>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
