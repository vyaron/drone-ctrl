import { useState, useEffect, useRef, useMemo, type ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  SEV,
  SENSORS_BASE,
  LAT_MIN, LAT_MAX, LON_MIN, LON_MAX,
  project,
  generateMockEvents,
  type SeverityLevel,
  type Event,
  type Detection,
} from '../utils/droneUtils';

interface ReportEventsViewProps {
  threatTypes: Set<SeverityLevel>;
  timeRange: { start: number; end: number };
}

type SortColumn = 'id' | 'startedAt' | 'endedAt' | 'duration' | 'threats';
type SortDir = 'asc' | 'desc';

// Format timestamp to readable string
function formatDateTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

// Format duration from ms to readable string
function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Get unique threat types from event detections
function getEventThreats(event: Event): string {
  const types = [...new Set(event.detections.map(d => d.droneType))];
  return types.join(', ');
}

export default function ReportEventsView({ threatTypes, timeRange }: ReportEventsViewProps): ReactElement {
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // State
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedDetection, setSelectedDetection] = useState<Detection | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [timelinePos, setTimelinePos] = useState(1); // 0-1, position in event timeline
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });

  // Generate mock events
  const events = useMemo(
    () => generateMockEvents(timeRange, threatTypes),
    [timeRange.start, timeRange.end, threatTypes]
  );

  // Sort events
  const sortedEvents = useMemo(() => {
    const sorted = [...events];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case 'id': cmp = a.id.localeCompare(b.id); break;
        case 'startedAt': cmp = a.startedAt - b.startedAt; break;
        case 'endedAt': cmp = a.endedAt - b.endedAt; break;
        case 'duration': cmp = (a.endedAt - a.startedAt) - (b.endedAt - b.startedAt); break;
        case 'threats': cmp = getEventThreats(a).localeCompare(getEventThreats(b)); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [events, sortColumn, sortDir]);

  // Handle column sort
  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(col);
      setSortDir('desc');
    }
  };

  // Toggle row expansion
  const toggleExpand = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // Handle split resize
  useEffect(() => {
    if (!isDragging) return;
    
    const handleMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const ratio = (e.clientX - rect.left) / rect.width;
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)));
    };
    
    const handleUp = () => setIsDragging(false);
    
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging]);

  // Handle resize observer for map canvas
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const observer = new ResizeObserver(() => {
      const mapPane = container.querySelector('.map-pane') as HTMLElement;
      if (mapPane) {
        setDimensions({
          width: mapPane.clientWidth,
          height: mapPane.clientHeight - 60, // Subtract timeline height
        });
      }
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw map
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);
    
    // Background
    ctx.fillStyle = 'rgba(0, 5, 12, 1)';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.05)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw sensor coverage areas (Q14: YES)
    SENSORS_BASE.forEach(sensor => {
      const { x, y } = project(sensor.lat, sensor.lon, width, height);
      const radius = 50;
      
      // Coverage circle
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, 'rgba(0, 212, 255, 0.08)');
      grad.addColorStop(1, 'rgba(0, 212, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Sensor dot
      ctx.fillStyle = 'rgba(0, 212, 255, 0.6)';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Label
      ctx.fillStyle = 'rgba(0, 212, 255, 0.5)';
      ctx.font = '9px "Share Tech Mono", monospace';
      ctx.fillText(sensor.id, x + 8, y + 3);
    });
    
    // Draw selected event detections (Q2: SELECTED only, Q3: SNAPSHOT)
    if (selectedEvent) {
      // Calculate positions at current timeline position
      const eventDuration = selectedEvent.endedAt - selectedEvent.startedAt;
      const currentTime = selectedEvent.startedAt + eventDuration * timelinePos;
      
      // Auto-zoom: calculate bounds (Q13: YES)
      const lats = selectedEvent.detections.map(d => d.lat);
      const lons = selectedEvent.detections.map(d => d.lon);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      
      // Add padding
      const padLat = Math.max(0.05, (maxLat - minLat) * 0.3);
      const padLon = Math.max(0.05, (maxLon - minLon) * 0.3);
      
      const viewMinLat = Math.max(LAT_MIN, minLat - padLat);
      const viewMaxLat = Math.min(LAT_MAX, maxLat + padLat);
      const viewMinLon = Math.max(LON_MIN, minLon - padLon);
      const viewMaxLon = Math.min(LON_MAX, maxLon + padLon);
      
      // Project with zoom
      const projectZoomed = (lat: number, lon: number) => ({
        x: ((lon - viewMinLon) / (viewMaxLon - viewMinLon)) * width,
        y: ((viewMaxLat - lat) / (viewMaxLat - viewMinLat)) * height,
      });
      
      // Draw each detection
      selectedEvent.detections.forEach(det => {
        // Only show if detection was active at current timeline position
        if (currentTime < det.startedAt || currentTime > det.endedAt) return;
        
        const { x, y } = projectZoomed(det.lat, det.lon);
        const color = SEV[det.severity].color;
        const isSelected = selectedDetection?.id === det.id;
        
        // Glow
        ctx.shadowColor = color;
        ctx.shadowBlur = isSelected ? 20 : 10;
        
        // Drone marker
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, isSelected ? 10 : 7, 0, Math.PI * 2);
        ctx.fill();
        
        // Inner dot
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.shadowBlur = 0;
        
        // Label
        ctx.fillStyle = color;
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.fillText(det.droneType.split(' ').slice(-2).join(' '), x + 12, y + 4);
      });
    } else {
      // No event selected - show message
      ctx.fillStyle = 'rgba(0, 212, 255, 0.3)';
      ctx.font = '14px "Share Tech Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Select an event to view on map', width / 2, height / 2);
      ctx.textAlign = 'left';
    }
  }, [dimensions, selectedEvent, selectedDetection, timelinePos]);

  // Link to frequency view (Q8)
  const goToFrequency = (det: Detection) => {
    // Navigate to frequency view with time range
    const start = new Date(det.startedAt - 60000).toISOString().slice(0, 16);
    const end = new Date(det.endedAt + 60000).toISOString().slice(0, 16);
    navigate(`/reports/frequency?start=${start}&end=${end}`);
  };

  // Table header style
  const thStyle = (col: SortColumn): React.CSSProperties => ({
    padding: '10px 12px',
    textAlign: col === 'id' ? 'left' : 'left',
    color: sortColumn === col ? '#00d4ff' : '#00d4ff88',
    letterSpacing: 1.5,
    fontWeight: 700,
    fontSize: 10,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  const sortIcon = (col: SortColumn) => {
    if (sortColumn !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        height: '100%',
        overflow: 'hidden',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Table Pane */}
      <div
        style={{
          width: `${splitRatio * 100}%`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid rgba(0,212,255,0.1)',
        }}
      >
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'rgba(0,5,12,0.98)', zIndex: 1 }}>
              <tr style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.15)' }}>
                <th style={thStyle('id')} onClick={() => handleSort('id')}>ID{sortIcon('id')}</th>
                <th style={thStyle('startedAt')} onClick={() => handleSort('startedAt')}>STARTED AT{sortIcon('startedAt')}</th>
                <th style={thStyle('endedAt')} onClick={() => handleSort('endedAt')}>ENDED AT{sortIcon('endedAt')}</th>
                <th style={thStyle('duration')} onClick={() => handleSort('duration')}>DURATION{sortIcon('duration')}</th>
                <th style={thStyle('threats')} onClick={() => handleSort('threats')}>THREATS{sortIcon('threats')}</th>
                <th style={{ padding: '10px 12px', color: '#00d4ff88', letterSpacing: 1.5, fontWeight: 700, fontSize: 10, width: 60 }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map(event => (
                <>
                  {/* Main event row */}
                  <tr
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    style={{
                      borderBottom: '1px solid rgba(0, 212, 255, 0.06)',
                      background: selectedEvent?.id === event.id ? 'rgba(0,212,255,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '10px 12px', color: '#7ecfff', fontFamily: "'Share Tech Mono', monospace" }}>
                      {event.id.replace('event-', '')}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#e8eaf0' }}>{formatDateTime(event.startedAt)}</td>
                    <td style={{ padding: '10px 12px', color: '#e8eaf0' }}>{formatDateTime(event.endedAt)}</td>
                    <td style={{ padding: '10px 12px', color: '#7ecfff', fontWeight: 600 }}>{formatDuration(event.endedAt - event.startedAt)}</td>
                    <td style={{ padding: '10px 12px', color: '#aab', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {getEventThreats(event)}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 14,
                            padding: 4,
                            opacity: 0.7,
                          }}
                          title="Show on map"
                        >
                          🗺️
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(event.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 11,
                            padding: 4,
                            color: expandedEvents.has(event.id) ? '#00d4ff' : '#8899aa',
                            transform: expandedEvents.has(event.id) ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                          }}
                          title="Expand detections"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Expanded detections (nested table) */}
                  {expandedEvents.has(event.id) && (
                    <tr>
                      <td colSpan={6} style={{ padding: 0, background: 'rgba(0,212,255,0.02)' }}>
                        <div style={{ padding: '8px 16px 16px 32px' }}>
                          <div style={{ fontSize: 10, color: '#8899aa', letterSpacing: 2, marginBottom: 8 }}>
                            DETECTIONS ({event.detections.length})
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid rgba(0, 212, 255, 0.1)' }}>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>ID</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>STARTED</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>ENDED</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>DURATION</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>THREAT TYPE</th>
                                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#00d4ff66', fontSize: 9, letterSpacing: 1 }}>FREQUENCIES</th>
                              </tr>
                            </thead>
                            <tbody>
                              {event.detections.map(det => (
                                <tr
                                  key={det.id}
                                  onClick={() => {
                                    setSelectedEvent(event);
                                    setSelectedDetection(det); // Q7: Highlight drone on map
                                  }}
                                  style={{
                                    borderBottom: '1px solid rgba(0, 212, 255, 0.04)',
                                    background: selectedDetection?.id === det.id ? 'rgba(0,212,255,0.1)' : 'transparent',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <td style={{ padding: '6px 8px', color: '#7ecfff' }}>{det.id.split('-').pop()}</td>
                                  <td style={{ padding: '6px 8px', color: '#ccd' }}>{formatDateTime(det.startedAt)}</td>
                                  <td style={{ padding: '6px 8px', color: '#ccd' }}>{formatDateTime(det.endedAt)}</td>
                                  <td style={{ padding: '6px 8px', color: '#7ecfff' }}>{formatDuration(det.endedAt - det.startedAt)}</td>
                                  <td style={{ padding: '6px 8px' }}>
                                    <span style={{ 
                                      color: SEV[det.severity].color,
                                      background: SEV[det.severity].bg,
                                      padding: '2px 6px',
                                      borderRadius: 3,
                                      fontSize: 10,
                                    }}>
                                      {det.droneType}
                                    </span>
                                  </td>
                                  <td style={{ padding: '6px 8px' }}>
                                    {/* Q9: LIST all bands */}
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {det.frequencies.map((freq, i) => (
                                        <span
                                          key={i}
                                          onClick={(e) => { e.stopPropagation(); goToFrequency(det); }}
                                          style={{
                                            color: '#00d4ff',
                                            background: 'rgba(0,212,255,0.1)',
                                            padding: '1px 5px',
                                            borderRadius: 2,
                                            fontSize: 9,
                                            cursor: 'pointer',
                                            border: '1px solid rgba(0,212,255,0.2)',
                                          }}
                                          title="View in Frequency chart"
                                        >
                                          {freq >= 1000 ? `${(freq / 1000).toFixed(1)}GHz` : `${freq}MHz`}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={() => setIsDragging(true)}
        style={{
          width: 6,
          cursor: 'col-resize',
          background: isDragging ? 'rgba(0,212,255,0.3)' : 'transparent',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,212,255,0.15)')}
        onMouseLeave={(e) => {
          if (!isDragging) e.currentTarget.style.background = 'transparent';
        }}
      />

      {/* Map Pane */}
      <div
        className="map-pane"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(0,5,12,0.95)',
        }}
      >
        {/* Map canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
            }}
          />
        </div>

        {/* Timeline scrubber (Q15: YES) */}
        {selectedEvent && (
          <div
            style={{
              height: 60,
              padding: '8px 16px',
              borderTop: '1px solid rgba(0,212,255,0.1)',
              background: 'rgba(0,5,12,0.9)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 10, color: '#8899aa', letterSpacing: 1 }}>TIMELINE</span>
              <span style={{ fontSize: 11, color: '#7ecfff', fontFamily: "'Share Tech Mono', monospace" }}>
                {formatDateTime(selectedEvent.startedAt + (selectedEvent.endedAt - selectedEvent.startedAt) * timelinePos)}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: '#556' }}>
                {formatDateTime(selectedEvent.startedAt).split(' ')[1]}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={timelinePos}
                onChange={(e) => setTimelinePos(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#00d4ff',
                  height: 4,
                }}
              />
              <span style={{ fontSize: 9, color: '#556' }}>
                {formatDateTime(selectedEvent.endedAt).split(' ')[1]}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
