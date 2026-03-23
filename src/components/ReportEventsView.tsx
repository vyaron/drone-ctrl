import React, { useState, useEffect, useRef, useMemo, type ReactElement } from 'react';
import {
  SEV,
  generateMockEvents,
  type SeverityLevel,
  type Event,
  type Detection,
  type Drone,
} from '../utils/droneUtils';
import { useReplayController, type PlaybackSpeed } from '../hooks/useReplayController';
import { StaticMapView } from './StaticMapView';
import { HistoricalTimeline } from './HistoricalTimeline';
import { FrequencyTab } from './FrequencyTab';

interface ReportEventsViewProps {
  threatTypes: Set<SeverityLevel>;
  timeRange: { start: number; end: number };
}

type SortColumn = 'id' | 'startedAt' | 'endedAt' | 'duration' | 'threats';
type SortDir = 'asc' | 'desc';
type ViewTab = 'timeline' | 'tactical' | 'map' | 'frequency';

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
function getEventThreats(event: Event): string[] {
  return [...new Set(event.detections.map(d => d.droneType))];
}

export default function ReportEventsView({ threatTypes, timeRange }: ReportEventsViewProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  const [selectedDrone, setSelectedDrone] = useState<Drone | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('startedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [viewTab, setViewTab] = useState<ViewTab>('tactical');

  // Generate mock events
  const events = useMemo(
    () => generateMockEvents(timeRange, threatTypes),
    [timeRange.start, timeRange.end, threatTypes]
  );

  // Auto-select first event when events change (Q13)
  useEffect(() => {
    if (events.length > 0 && !selectedEvent) {
      setSelectedEvent(events[0]);
    }
  }, [events, selectedEvent]);

  // Replay controller
  const replay = useReplayController(selectedEvent);

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
        case 'threats': cmp = getEventThreats(a).join(',').localeCompare(getEventThreats(b).join(',')); break;
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

  // Switch to frequency tab
  const goToFrequency = () => {
    setViewTab('frequency');
  };

  // Table header style
  const thStyle = (col: SortColumn): React.CSSProperties => ({
    padding: '6px 8px',
    textAlign: 'left',
    color: sortColumn === col ? '#00d4ff' : '#00d4ff88',
    letterSpacing: 1.5,
    fontWeight: 700,
    fontSize: 10,
    cursor: 'pointer',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  });

  // Render threat badges with "and X more"
  const renderThreats = (event: Event) => {
    const types = getEventThreats(event);
    const shown = types.slice(0, 2);
    const hidden = types.slice(2);
    return (
      <>
        {shown.join(', ')}
        {hidden.length > 0 && (
          <span 
            title={hidden.join(', ')}
            style={{ 
              marginLeft: 6, 
              padding: '1px 5px', 
              borderRadius: 3, 
              fontSize: 9, 
              background: 'rgba(0,212,255,0.12)', 
              color: '#7ecfff',
              whiteSpace: 'nowrap',
              cursor: 'help',
            }}
          >
            +{hidden.length} more
          </span>
        )}
      </>
    );
  };

  const sortIcon = (col: SortColumn) => {
    if (sortColumn !== col) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const viewTabs: { id: ViewTab; icon: string; label: string }[] = [
    { id: 'timeline', icon: '▤', label: 'TIMELINE' },
    { id: 'tactical', icon: '◈', label: 'TACTICAL' },
    { id: 'map', icon: '🛰️', label: 'MAP' },
    { id: 'frequency', icon: '∿', label: 'FREQUENCY' },
  ];

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
                <th style={{ ...thStyle('id'), width: 40 }} onClick={() => handleSort('id')}>ID{sortIcon('id')}</th>
                <th style={thStyle('startedAt')} onClick={() => handleSort('startedAt')}>STARTED{sortIcon('startedAt')}</th>
                <th style={thStyle('endedAt')} onClick={() => handleSort('endedAt')}>ENDED{sortIcon('endedAt')}</th>
                <th style={{ ...thStyle('duration'), width: 60 }} onClick={() => handleSort('duration')}>DUR{sortIcon('duration')}</th>
                <th style={thStyle('threats')} onClick={() => handleSort('threats')}>THREATS{sortIcon('threats')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedEvents.map(event => (
                <React.Fragment key={event.id}>
                  {/* Main event row */}
                  <tr
                    onClick={() => setSelectedEvent(event)}
                    style={{
                      borderBottom: '1px solid rgba(0, 212, 255, 0.06)',
                      background: selectedEvent?.id === event.id ? 'rgba(0,212,255,0.08)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <td style={{ padding: '6px 8px', color: '#7ecfff', fontFamily: "'Share Tech Mono', monospace", width: 40 }}>
                      {event.id.replace('event-', '')}
                    </td>
                    <td style={{ padding: '6px 8px', color: '#e8eaf0', fontSize: 11 }}>{formatDateTime(event.startedAt)}</td>
                    <td style={{ padding: '6px 8px', color: '#e8eaf0', fontSize: 11 }}>{formatDateTime(event.endedAt)}</td>
                    <td style={{ padding: '6px 8px', color: '#7ecfff', fontWeight: 600, width: 60 }}>{formatDuration(event.endedAt - event.startedAt)}</td>
                    <td style={{ padding: '6px 8px', color: '#aab' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {renderThreats(event)}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleExpand(event.id); }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: 10,
                            padding: '2px 6px',
                            marginLeft: 8,
                            color: expandedEvents.has(event.id) ? '#00d4ff' : '#8899aa',
                            transform: expandedEvents.has(event.id) ? 'rotate(180deg)' : 'none',
                            transition: 'transform 0.2s',
                            flexShrink: 0,
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
                      <td colSpan={5} style={{ padding: 0, background: 'rgba(0,212,255,0.02)' }}>
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
                                  onClick={() => setSelectedEvent(event)}
                                  style={{
                                    borderBottom: '1px solid rgba(0, 212, 255, 0.04)',
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
                                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                      {det.frequencies.map((freq, i) => (
                                        <span
                                          key={i}
                                          onClick={(e) => { e.stopPropagation(); goToFrequency(); }}
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
                </React.Fragment>
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

      {/* View Pane */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'rgba(0,5,12,0.95)',
        }}
      >
        {/* View Tabs */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          borderBottom: '1px solid rgba(0,212,255,0.08)', 
          background: 'rgba(0,5,12,0.7)',
          flexShrink: 0,
        }}>
          {viewTabs.map(t => (
            <button
              key={t.id}
              onClick={() => setViewTab(t.id)}
              style={{
                padding: '10px 16px',
                fontSize: 12,
                letterSpacing: 2,
                fontWeight: 700,
                color: viewTab === t.id ? '#00d4ff' : '#8899aa',
                background: 'none',
                border: 'none',
                borderBottom: viewTab === t.id ? '2px solid #00d4ff' : '2px solid transparent',
                marginBottom: -1,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>{t.label}
            </button>
          ))}
          
          <div style={{ flex: 1 }} />
          
          {/* Drone count */}
          <span style={{ fontSize: 11, color: '#8899aa', marginRight: 16 }}>
            {replay.drones.length} ACTIVE
          </span>
        </div>

        {/* View Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {selectedEvent ? (
            viewTab === 'timeline' ? (
              <HistoricalTimeline
                event={selectedEvent}
                drones={replay.drones}
                currentTs={replay.currentTs}
                selected={selectedDrone}
                onSelect={setSelectedDrone}
              />
            ) : viewTab === 'frequency' ? (
              <FrequencyTab
                event={selectedEvent}
                currentTs={replay.currentTs}
              />
            ) : (
              <StaticMapView
                drones={replay.drones}
                selected={selectedDrone}
                onSelect={setSelectedDrone}
                mode={viewTab === 'tactical' ? 'canvas' : 'google'}
                paused={!replay.isPlaying}
              />
            )
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#8899aa' }}>
              Select an event to view
            </div>
          )}
        </div>

        {/* Playback Controls */}
        {selectedEvent && (
          <div
            style={{
              padding: '8px 16px',
              borderTop: '1px solid rgba(0,212,255,0.1)',
              background: 'rgba(0,5,12,0.9)',
              flexShrink: 0,
            }}
          >
            {/* Controls row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              {/* Play/Pause */}
              <button
                onClick={replay.togglePlay}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 4,
                  background: replay.isPlaying ? 'rgba(255,45,85,0.15)' : 'rgba(0,212,255,0.15)',
                  border: `1px solid ${replay.isPlaying ? 'rgba(255,45,85,0.3)' : 'rgba(0,212,255,0.3)'}`,
                  color: replay.isPlaying ? '#ff2d55' : '#00d4ff',
                  cursor: 'pointer',
                  fontSize: 14,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {replay.isPlaying ? '⏸' : '▶'}
              </button>
              
              {/* Speed control */}
              <div style={{ display: 'flex', gap: 4 }}>
                {([10, 30, 60] as PlaybackSpeed[]).map(s => (
                  <button
                    key={s}
                    onClick={() => replay.setSpeed(s)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      background: replay.speed === s ? 'rgba(0,212,255,0.15)' : 'transparent',
                      color: replay.speed === s ? '#00d4ff' : '#8899aa',
                      border: `1px solid ${replay.speed === s ? 'rgba(0,212,255,0.3)' : 'rgba(0,212,255,0.1)'}`,
                      cursor: 'pointer',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  >
                    {s}x
                  </button>
                ))}
              </div>
              
              <div style={{ width: 1, height: 20, background: 'rgba(0,212,255,0.15)' }} />
              
              {/* Current time */}
              <span style={{ fontSize: 11, color: '#7ecfff', fontFamily: "'Share Tech Mono', monospace" }}>
                {formatDateTime(replay.currentTs)}
              </span>
              
              <div style={{ flex: 1 }} />
              
              {/* Duration */}
              <span style={{ fontSize: 10, color: '#8899aa' }}>
                {formatDuration(selectedEvent.endedAt - selectedEvent.startedAt)}
              </span>
            </div>
            
            {/* Scrubber */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, color: '#556', minWidth: 55 }}>
                {formatDateTime(selectedEvent.startedAt).split(' ')[1]}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={replay.progress}
                onChange={(e) => replay.seek(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#00d4ff',
                  height: 4,
                }}
              />
              <span style={{ fontSize: 9, color: '#556', minWidth: 55, textAlign: 'right' }}>
                {formatDateTime(selectedEvent.endedAt).split(' ')[1]}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
