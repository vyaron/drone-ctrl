import { useMemo, type ReactElement } from 'react';
import { generateMockEvents, FREQ_BANDS, SENSORS_BASE, DRONE_MODELS, type Event, type Detection, type DetectionLevel } from '../utils/droneUtils';

interface ReportSummaryViewProps {
  timeRange: { start: number; end: number };
}

interface Stats {
  totalEvents: number;
  totalDetections: number;
  avgEventDuration: number;
  uniqueDroneTypes: number;
  levelCounts: Record<DetectionLevel, number>;
  levelPercentages: Record<DetectionLevel, number>;
  locationRate: number;
  droneTypeCounts: Record<string, number>;
  freqBandCounts: Record<string, number>;
  sensorCounts: Record<string, number>;
  hourlyActivity: number[];
  recentEvents: Event[];
}

function computeStats(events: Event[]): Stats {
  const allDetections = events.flatMap(e => e.detections);
  const totalDetections = allDetections.length;
  
  // Average event duration
  const durations = events.map(e => e.endedAt - e.startedAt);
  const avgEventDuration = durations.length > 0 
    ? durations.reduce((a, b) => a + b, 0) / durations.length 
    : 0;
  
  // Unique drone types
  const droneTypes = new Set(allDetections.map(d => d.droneType));
  
  // Detection level counts
  const levelCounts: Record<DetectionLevel, number> = {
    location: 0,
    direction: 0,
    detection: 0,
  };
  allDetections.forEach(d => {
    levelCounts[d.level]++;
  });
  
  const levelPercentages: Record<DetectionLevel, number> = {
    location: totalDetections > 0 ? (levelCounts.location / totalDetections) * 100 : 0,
    direction: totalDetections > 0 ? (levelCounts.direction / totalDetections) * 100 : 0,
    detection: totalDetections > 0 ? (levelCounts.detection / totalDetections) * 100 : 0,
  };
  
  // Drone type distribution
  const droneTypeCounts: Record<string, number> = {};
  allDetections.forEach(d => {
    const manufacturer = d.droneType.split(' ')[0]; // Get first word (manufacturer)
    droneTypeCounts[manufacturer] = (droneTypeCounts[manufacturer] || 0) + 1;
  });
  
  // Frequency band distribution
  const freqBandCounts: Record<string, number> = {};
  allDetections.forEach(d => {
    const bandLabel = FREQ_BANDS[d.freqBand]?.label || d.freqBand;
    freqBandCounts[bandLabel] = (freqBandCounts[bandLabel] || 0) + 1;
  });
  
  // Sensor activity
  const sensorCounts: Record<string, number> = {};
  allDetections.forEach(d => {
    sensorCounts[d.sensorId] = (sensorCounts[d.sensorId] || 0) + 1;
  });
  
  // Hourly activity (24 hours)
  const hourlyActivity = new Array(24).fill(0);
  allDetections.forEach(d => {
    const hour = new Date(d.startedAt).getHours();
    hourlyActivity[hour]++;
  });
  
  // Recent events (last 10)
  const recentEvents = [...events]
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10);
  
  return {
    totalEvents: events.length,
    totalDetections,
    avgEventDuration,
    uniqueDroneTypes: droneTypes.size,
    levelCounts,
    levelPercentages,
    locationRate: levelPercentages.location,
    droneTypeCounts,
    freqBandCounts,
    sensorCounts,
    hourlyActivity,
    recentEvents,
  };
}

// Simple bar chart component
function BarChart({ data, maxValue, color = '#00d4ff' }: { 
  data: { label: string; value: number }[]; 
  maxValue: number; 
  color?: string;
}): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(item => (
        <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 80, fontSize: 11, color: '#8899aa', textAlign: 'right', flexShrink: 0 }}>
            {item.label}
          </div>
          <div style={{ flex: 1, height: 20, background: 'rgba(0,20,40,0.5)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ 
              width: `${maxValue > 0 ? (item.value / maxValue) * 100 : 0}%`, 
              height: '100%', 
              background: `linear-gradient(90deg, ${color}40, ${color}80)`,
              borderRadius: 3,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ width: 40, fontSize: 12, color: '#e8eaf0', fontWeight: 700, textAlign: 'right' }}>
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// Sparkline component for 24h detection frequency
function Sparkline({ data, color = '#00d4ff' }: { data: number[]; color?: string }): ReactElement {
  const maxVal = Math.max(...data, 1);
  const width = 300;
  const height = 60;
  const padding = 4;
  
  // Generate SVG path
  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (val / maxVal) * (height - padding * 2);
    return { x, y, val };
  });
  
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;
  
  const total = data.reduce((a, b) => a + b, 0);
  const avg = total / data.length;
  const trend = data.slice(-6).reduce((a, b) => a + b, 0) / 6 > avg ? 'up' : 'down';
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <svg width={width} height={height} style={{ background: 'rgba(0,20,40,0.4)', borderRadius: 6 }}>
        {/* Area fill */}
        <path d={areaPath} fill={`${color}15`} />
        {/* Line */}
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Data points */}
        {points.map((p, i) => (
          <circle 
            key={i} 
            cx={p.x} 
            cy={p.y} 
            r={p.val > 0 ? 3 : 0} 
            fill={color}
            opacity={0.8}
          >
            <title>{`${i}:00 - ${p.val} detections`}</title>
          </circle>
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: '#e8eaf0' }}>{total}</div>
        <div style={{ fontSize: 10, color: '#8899aa' }}>detections</div>
        <div style={{ fontSize: 11, color: trend === 'up' ? '#ff9500' : '#7ecfff', display: 'flex', alignItems: 'center', gap: 4 }}>
          {trend === 'up' ? '↑' : '↓'} {trend === 'up' ? 'increasing' : 'decreasing'}
        </div>
      </div>
    </div>
  );
}

// Hourly heatmap component
function HourlyHeatmap({ data }: { data: number[] }): ReactElement {
  const maxVal = Math.max(...data, 1);
  
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      {data.map((count, hour) => {
        const intensity = count / maxVal;
        return (
          <div 
            key={hour}
            title={`${hour}:00 - ${count} detections`}
            style={{
              width: 28,
              height: 28,
              borderRadius: 4,
              background: count > 0 
                ? `rgba(0,212,255,${0.15 + intensity * 0.7})` 
                : 'rgba(0,20,40,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9,
              color: intensity > 0.5 ? '#fff' : '#8899aa',
              fontWeight: 600,
              cursor: 'default',
            }}
          >
            {hour}
          </div>
        );
      })}
    </div>
  );
}

// Donut chart component for distribution
function DonutChart({ data, colors }: { 
  data: { label: string; value: number }[]; 
  colors: string[];
}): ReactElement {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  let cumulative = 0;
  
  // Create SVG arc segments
  const segments = data.map((item, i) => {
    const percentage = total > 0 ? item.value / total : 0;
    const startAngle = cumulative * 360;
    cumulative += percentage;
    const endAngle = cumulative * 360;
    
    // Convert to radians and calculate arc
    const startRad = (startAngle - 90) * Math.PI / 180;
    const endRad = (endAngle - 90) * Math.PI / 180;
    const largeArc = percentage > 0.5 ? 1 : 0;
    
    const x1 = 50 + 40 * Math.cos(startRad);
    const y1 = 50 + 40 * Math.sin(startRad);
    const x2 = 50 + 40 * Math.cos(endRad);
    const y2 = 50 + 40 * Math.sin(endRad);
    
    return {
      ...item,
      color: colors[i % colors.length],
      path: percentage > 0 
        ? `M 50 50 L ${x1} ${y1} A 40 40 0 ${largeArc} 1 ${x2} ${y2} Z`
        : '',
      percentage: (percentage * 100).toFixed(1),
    };
  });
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <svg width="100" height="100" viewBox="0 0 100 100">
        {segments.map((seg, i) => seg.path && (
          <path 
            key={i} 
            d={seg.path} 
            fill={seg.color} 
            stroke="rgba(0,10,20,0.8)" 
            strokeWidth="1"
          />
        ))}
        {/* Center hole */}
        <circle cx="50" cy="50" r="25" fill="rgba(0,10,20,0.95)" />
        <text x="50" y="54" textAnchor="middle" fill="#e8eaf0" fontSize="14" fontWeight="700">
          {total}
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color }} />
            <span style={{ color: '#8899aa' }}>{seg.label}</span>
            <span style={{ color: '#e8eaf0', fontWeight: 600 }}>{seg.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ label, value, unit, accent = false }: { 
  label: string; 
  value: string | number; 
  unit?: string;
  accent?: boolean;
}): ReactElement {
  return (
    <div style={{
      background: accent ? 'rgba(0,212,255,0.08)' : 'rgba(0,20,40,0.4)',
      border: `1px solid ${accent ? 'rgba(0,212,255,0.25)' : 'rgba(0,212,255,0.08)'}`,
      borderRadius: 8,
      padding: '16px 20px',
    }}>
      <div style={{ color: '#8899aa', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>{label}</div>
      <div style={{ color: accent ? '#00d4ff' : '#e8eaf0', fontSize: 28, fontWeight: 700 }}>
        {value}
        {unit && <span style={{ fontSize: 14, color: '#8899aa', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  );
}

// Level badge component
function LevelBadge({ level, count, percentage }: { 
  level: DetectionLevel; 
  count: number; 
  percentage: number;
}): ReactElement {
  const config: Record<DetectionLevel, { label: string; color: string; bg: string }> = {
    location: { label: 'GEO', color: '#7ecfff', bg: 'rgba(126,207,255,0.15)' },
    direction: { label: 'DIR', color: '#7ecfff', bg: 'rgba(126,207,255,0.15)' },
    detection: { label: 'DET', color: '#7ecfff', bg: 'rgba(126,207,255,0.15)' },
  };
  const { label, color, bg } = config[level];
  
  return (
    <div style={{
      background: bg,
      border: `1px solid ${color}40`,
      borderRadius: 8,
      padding: '12px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
    }}>
      <div style={{
        background: color,
        color: '#000',
        padding: '4px 8px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1,
      }}>
        {label}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#e8eaf0', fontSize: 20, fontWeight: 700 }}>{count}</div>
        <div style={{ color: '#8899aa', fontSize: 11 }}>{percentage.toFixed(1)}% of total</div>
      </div>
    </div>
  );
}

export function ReportSummaryView({ timeRange }: ReportSummaryViewProps): ReactElement {
  const events = useMemo(() => generateMockEvents(timeRange), [timeRange]);
  const stats = useMemo(() => computeStats(events), [events]);
  
  // Prepare chart data
  const droneTypeData = Object.entries(stats.droneTypeCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const maxDroneType = Math.max(...droneTypeData.map(d => d.value), 1);
  
  const freqBandData = Object.entries(stats.freqBandCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const maxFreqBand = Math.max(...freqBandData.map(d => d.value), 1);
  
  const sensorData = Object.entries(stats.sensorCounts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
  const maxSensor = Math.max(...sensorData.map(d => d.value), 1);
  
  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  };
  
  const formatEventTime = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };
  
  return (
    <div style={{ 
      padding: '20px 20px 40px 20px', 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 24,
      background: 'rgba(0,5,12,0.5)',
    }}>
      {/* Key Metrics */}
      <div>
        <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>KEY METRICS</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <StatCard label="TOTAL EVENTS" value={stats.totalEvents} accent />
          <StatCard label="TOTAL DETECTIONS" value={stats.totalDetections} />
          <StatCard label="AVG DURATION" value={formatDuration(stats.avgEventDuration)} />
          <StatCard label="DRONE TYPES" value={stats.uniqueDroneTypes} />
        </div>
      </div>
      
      {/* 24h Detection Trend */}
      <div style={{ 
        background: 'rgba(0,20,40,0.4)', 
        border: '1px solid rgba(0,212,255,0.08)', 
        borderRadius: 8, 
        padding: 16,
      }}>
        <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>24H DETECTION TREND</div>
        <Sparkline data={stats.hourlyActivity} />
      </div>
      
      {/* Detection Level Breakdown */}
      <div>
        <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 12 }}>DETECTION CONFIDENCE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <LevelBadge level="location" count={stats.levelCounts.location} percentage={stats.levelPercentages.location} />
          <LevelBadge level="direction" count={stats.levelCounts.direction} percentage={stats.levelPercentages.direction} />
          <LevelBadge level="detection" count={stats.levelCounts.detection} percentage={stats.levelPercentages.detection} />
        </div>
      </div>
      
      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Drone Type Distribution */}
        <div style={{ 
          background: 'rgba(0,20,40,0.4)', 
          border: '1px solid rgba(0,212,255,0.08)', 
          borderRadius: 8, 
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 16 }}>DRONE MANUFACTURERS</div>
          <DonutChart 
            data={droneTypeData}
            colors={['#00d4ff', '#ff9500', '#af52de', '#007aff', '#ffd60a', '#32ade6']}
          />
        </div>
        
        {/* Frequency Band Usage */}
        <div style={{ 
          background: 'rgba(0,20,40,0.4)', 
          border: '1px solid rgba(0,212,255,0.08)', 
          borderRadius: 8, 
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 16 }}>FREQUENCY BANDS</div>
          <BarChart data={freqBandData} maxValue={maxFreqBand} color="#ff9500" />
        </div>
      </div>
      
      {/* Sensor Performance & Activity */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Sensor Activity */}
        <div style={{ 
          background: 'rgba(0,20,40,0.4)', 
          border: '1px solid rgba(0,212,255,0.08)', 
          borderRadius: 8, 
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 16 }}>SENSOR DETECTIONS</div>
          <BarChart data={sensorData} maxValue={maxSensor} color="#00d4ff" />
        </div>
        
        {/* Peak Hours Heatmap */}
        <div style={{ 
          background: 'rgba(0,20,40,0.4)', 
          border: '1px solid rgba(0,212,255,0.08)', 
          borderRadius: 8, 
          padding: 16,
        }}>
          <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 16 }}>ACTIVITY BY HOUR</div>
          <HourlyHeatmap data={stats.hourlyActivity} />
        </div>
      </div>
      
      {/* Recent Events Table */}
      <div style={{ 
        background: 'rgba(0,20,40,0.4)', 
        border: '1px solid rgba(0,212,255,0.08)', 
        borderRadius: 8, 
        padding: 16,
        overflow: 'hidden',
      }}>
        <div style={{ fontSize: 11, color: '#8899aa', letterSpacing: 2, marginBottom: 16 }}>RECENT EVENTS</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(0,212,255,0.15)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>TIME</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>DURATION</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>DRONES</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>PRIMARY TYPE</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>LEVELS</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#00d4ff88', letterSpacing: 1, fontWeight: 600 }}>SENSORS</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentEvents.map(event => {
                const levels = new Set(event.detections.map(d => d.level));
                const sensors = new Set(event.detections.map(d => d.sensorId));
                const primaryType = event.detections[0]?.droneType.split(' ')[0] || '-';
                
                return (
                  <tr key={event.id} style={{ borderBottom: '1px solid rgba(0,212,255,0.06)' }}>
                    <td style={{ padding: '10px 12px', color: '#7ecfff' }}>
                      {formatEventTime(event.startedAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#e8eaf0' }}>
                      {formatDuration(event.endedAt - event.startedAt)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: '#e8eaf0', fontWeight: 700 }}>
                      {event.detections.length}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#e8eaf0' }}>
                      {primaryType}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        {Array.from(levels).map(level => {
                          const labels = { location: 'G', direction: 'D', detection: 'X' };
                          return (
                            <span 
                              key={level}
                              style={{
                                background: 'rgba(126,207,255,0.15)',
                                color: '#7ecfff',
                                padding: '2px 5px',
                                borderRadius: 3,
                                fontSize: 9,
                                fontWeight: 700,
                              }}
                            >
                              {labels[level]}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#8899aa', fontSize: 11 }}>
                      {Array.from(sensors).join(', ')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ReportSummaryView;
