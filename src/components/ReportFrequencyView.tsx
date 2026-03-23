import { useRef, useEffect, useState, useMemo, type ReactElement } from 'react';
import { 
  SEV, 
  FREQ_BANDS, 
  type SeverityLevel,
  type FreqSample 
} from '../utils/droneUtils';

interface ReportFrequencyViewProps {
  threatTypes: Set<SeverityLevel>;
  timeRange: { start: number; end: number };
}

type ViewMode = 'dots' | 'lines' | 'heatmap';

const FREQ_MIN = 100;
const FREQ_MAX = 6500;
const PADDING = { top: 30, right: 20, bottom: 40, left: 70 };

interface HistoricalDrone {
  id: string;
  model: string;
  severity: SeverityLevel;
  freqHistory: FreqSample[];
  freqBand: keyof typeof FREQ_BANDS;
}

// Generate mock historical frequency data
function generateMockData(
  timeRange: { start: number; end: number },
  threatTypes: Set<SeverityLevel>
): HistoricalDrone[] {
  const drones: HistoricalDrone[] = [];
  const duration = timeRange.end - timeRange.start;
  
  // Generate 8-15 historical drones
  const count = 8 + Math.floor(Math.random() * 8);
  
  const severities: SeverityLevel[] = ['critical', 'high', 'medium', 'low'];
  const bandOptions: (keyof typeof FREQ_BANDS)[] = [
    'ISM_2_4G', 'ISM_2_4G', 'ISM_2_4G',
    'ISM_5_8G', 'ISM_5_8G',
    'BAND_5150',
    'BAND_900',
    'BAND_750',
    'BAND_475',
  ];
  
  for (let i = 0; i < count; i++) {
    const severity = severities[Math.floor(Math.random() * severities.length)];
    if (!threatTypes.has(severity)) continue;
    
    const freqBand = bandOptions[Math.floor(Math.random() * bandOptions.length)];
    const band = FREQ_BANDS[freqBand];
    const bandRange = band.max - band.min;
    
    // Random start and duration within time range
    const droneStart = timeRange.start + Math.random() * duration * 0.7;
    const droneDuration = Math.min(
      duration * (0.2 + Math.random() * 0.5),
      timeRange.end - droneStart
    );
    
    const freqHistory: FreqSample[] = [];
    let currentFreq = band.min + Math.random() * bandRange;
    
    // Generate samples every 250ms with more varied hopping
    for (let t = droneStart; t < droneStart + droneDuration; t += 250) {
      // More aggressive frequency hopping
      const hopChance = Math.random();
      if (hopChance < 0.25) {
        // Big jump - anywhere in band
        currentFreq = band.min + Math.random() * bandRange;
      } else if (hopChance < 0.5) {
        // Medium jump - 20-50% of band range
        const jump = (Math.random() - 0.5) * bandRange * 0.5;
        currentFreq = Math.max(band.min, Math.min(band.max, currentFreq + jump));
      } else {
        // Small drift
        const drift = (Math.random() - 0.5) * bandRange * 0.15;
        currentFreq = Math.max(band.min, Math.min(band.max, currentFreq + drift));
      }
      
      freqHistory.push({
        ts: t,
        freq: currentFreq,
        strength: 40 + Math.random() * 55,
      });
    }
    
    drones.push({
      id: `hist-drone-${i + 1}`,
      model: `Drone ${i + 1}`,
      severity,
      freqHistory,
      freqBand,
    });
  }
  
  return drones;
}

export default function ReportFrequencyView({ threatTypes, timeRange }: ReportFrequencyViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>('dots');
  const [showBands, setShowBands] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });
  const [selected, setSelected] = useState<HistoricalDrone | null>(null);
  const [drillDown, setDrillDown] = useState<HistoricalDrone | null>(null);

  // Generate mock data when filters change
  const drones = useMemo(
    () => generateMockData(timeRange, threatTypes),
    [timeRange.start, timeRange.end, threatTypes]
  );

  // Handle resize - observe the canvas wrapper, not the main container
  useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Render
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

    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    
    // When drilled down, zoom into that drone's time range
    let winStart: number;
    let winEnd: number;
    let displayDrones: HistoricalDrone[];
    
    if (drillDown) {
      const freqHist = drillDown.freqHistory;
      if (freqHist.length > 0) {
        const times = freqHist.map(s => s.ts);
        const minT = Math.min(...times);
        const maxT = Math.max(...times);
        const padding = (maxT - minT) * 0.1 || 30000; // 10% padding or 30s
        winStart = minT - padding;
        winEnd = maxT + padding;
      } else {
        winStart = timeRange.start;
        winEnd = timeRange.end;
      }
      displayDrones = [drillDown];
    } else {
      winStart = timeRange.start;
      winEnd = timeRange.end;
      displayDrones = drones;
    }
    
    const windowDuration = winEnd - winStart;

    // Clear
    ctx.fillStyle = 'rgba(0, 5, 12, 1)';
    ctx.fillRect(0, 0, width, height);

    // Helper: map time to x
    const timeToX = (ts: number) => 
      PADDING.left + ((ts - winStart) / (winEnd - winStart)) * plotW;
    
    // Helper: map freq to y (log scale)
    const freqToY = (freq: number) => {
      const logMin = Math.log10(FREQ_MIN);
      const logMax = Math.log10(FREQ_MAX);
      const logFreq = Math.log10(Math.max(FREQ_MIN, Math.min(FREQ_MAX, freq)));
      const pct = (logFreq - logMin) / (logMax - logMin);
      return PADDING.top + plotH * (1 - pct);
    };

    // Draw frequency band zones
    if (showBands) {
      Object.values(FREQ_BANDS).forEach(band => {
        const y1 = freqToY(band.max);
        const y2 = freqToY(band.min);
        ctx.fillStyle = band.color;
        ctx.fillRect(PADDING.left, y1, plotW, y2 - y1);
        
        ctx.fillStyle = 'rgba(136, 153, 170, 0.5)';
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(band.label, PADDING.left + 5, y1 + 12);
      });
    }

    // Draw grid
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
    ctx.lineWidth = 1;

    // Vertical time grid - adaptive based on duration
    const gridInterval = windowDuration < 3600000 ? 300000 : // < 1h: 5min
                         windowDuration < 28800000 ? 1800000 : // < 8h: 30min
                         3600000; // else: 1h
    
    for (let t = Math.ceil(winStart / gridInterval) * gridInterval; t <= winEnd; t += gridInterval) {
      const x = timeToX(t);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, height - PADDING.bottom);
      ctx.stroke();
    }

    // Horizontal freq grid
    const freqGridLines = [200, 500, 1000, 2000, 3000, 4000, 5000];
    freqGridLines.forEach(freq => {
      const y = freqToY(freq);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(width - PADDING.right, y);
      ctx.stroke();
    });

    // Draw axes
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, height - PADDING.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PADDING.left, height - PADDING.bottom);
    ctx.lineTo(width - PADDING.right, height - PADDING.bottom);
    ctx.stroke();

    // Y axis labels
    ctx.fillStyle = '#8899aa';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textAlign = 'right';
    freqGridLines.forEach(freq => {
      const y = freqToY(freq);
      const label = freq >= 1000 ? `${freq/1000}G` : `${freq}M`;
      ctx.fillText(label, PADDING.left - 8, y + 3);
    });

    // X axis labels
    ctx.textAlign = 'center';
    for (let t = Math.ceil(winStart / gridInterval) * gridInterval; t <= winEnd; t += gridInterval) {
      const x = timeToX(t);
      const d = new Date(t);
      const label = windowDuration < 3600000 
        ? `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
        : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      ctx.fillText(label, x, height - PADDING.bottom + 15);
    }

    if (mode === 'heatmap') {
      const cellW = plotW / 100;
      const cellH = plotH / 50;
      const heatmap: number[][] = Array(50).fill(0).map(() => Array(100).fill(0));
      
      displayDrones.forEach(d => {
        d.freqHistory.forEach(sample => {
          if (sample.ts < winStart || sample.ts > winEnd) return;
          const xi = Math.floor(((sample.ts - winStart) / (winEnd - winStart)) * 100);
          const logMin = Math.log10(FREQ_MIN);
          const logMax = Math.log10(FREQ_MAX);
          const logFreq = Math.log10(sample.freq);
          const yi = Math.floor((1 - (logFreq - logMin) / (logMax - logMin)) * 50);
          if (xi >= 0 && xi < 100 && yi >= 0 && yi < 50) {
            heatmap[yi][xi] += sample.strength / 100;
          }
        });
      });

      for (let yi = 0; yi < 50; yi++) {
        for (let xi = 0; xi < 100; xi++) {
          const val = Math.min(1, heatmap[yi][xi]);
          if (val > 0.01) {
            const alpha = val * 0.8;
            ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
            ctx.fillRect(
              PADDING.left + xi * cellW,
              PADDING.top + yi * cellH,
              cellW + 1,
              cellH + 1
            );
          }
        }
      }
    } else {
      displayDrones.forEach(d => {
        const color = SEV[d.severity].color;
        const isSelected = selected?.id === d.id || drillDown?.id === d.id;
        const samples = d.freqHistory.filter(s => s.ts >= winStart && s.ts <= winEnd);
        
        if (samples.length === 0) return;

        if (mode === 'lines' && samples.length > 1) {
          // Draw connecting lines
          ctx.strokeStyle = isSelected ? color : `${color}aa`;
          ctx.lineWidth = isSelected ? 2.5 : 1.5;
          ctx.beginPath();
          samples.forEach((s, i) => {
            const x = timeToX(s.ts);
            const y = freqToY(s.freq);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });
          ctx.stroke();
          
          // Draw small dots at endpoints only
          if (isSelected) {
            ctx.shadowColor = SEV[d.severity].glow;
            ctx.shadowBlur = 6;
          }
          ctx.fillStyle = color;
          [samples[0], samples[samples.length - 1]].forEach(s => {
            const x = timeToX(s.ts);
            const y = freqToY(s.freq);
            ctx.beginPath();
            ctx.arc(x, y, isSelected ? 4 : 3, 0, Math.PI * 2);
            ctx.fill();
          });
          ctx.shadowBlur = 0;
        }

        if (mode === 'dots') {
          // Draw all dots
          samples.forEach(s => {
            const x = timeToX(s.ts);
            const y = freqToY(s.freq);
            const radius = isSelected 
              ? 4 + (s.strength / 100) * 3 
              : 2 + (s.strength / 100) * 2;

            if (isSelected) {
              ctx.shadowColor = SEV[d.severity].glow;
              ctx.shadowBlur = 8;
            }

            ctx.fillStyle = isSelected ? color : `${color}cc`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;
          });
        }
      });
    }

    // Axis titles
    ctx.fillStyle = '#8899aa';
    ctx.font = '11px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('TIME', PADDING.left + plotW / 2, height - 5);
    
    ctx.save();
    ctx.translate(15, PADDING.top + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('FREQUENCY (MHz)', 0, 0);
    ctx.restore();

  }, [drones, selected, drillDown, mode, showBands, dimensions, timeRange]);

  // Handle click - if already drilled down, clicking doesn't change anything
  // Otherwise, select the drone
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drillDown) return; // Ignore clicks when drilled down
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { width, height } = dimensions;
    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;

    let closest: HistoricalDrone | null = null;
    let closestDist = Infinity;
    const maxDist = 30; // Increased click tolerance

    drones.forEach(d => {
      d.freqHistory.forEach(sample => {
        if (sample.ts < timeRange.start || sample.ts > timeRange.end) return;
        
        const px = PADDING.left + ((sample.ts - timeRange.start) / (timeRange.end - timeRange.start)) * plotW;
        const logMin = Math.log10(FREQ_MIN);
        const logMax = Math.log10(FREQ_MAX);
        const logFreq = Math.log10(sample.freq);
        const py = PADDING.top + plotH * (1 - (logFreq - logMin) / (logMax - logMin));
        
        const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
        if (dist < closestDist && dist < maxDist) {
          closestDist = dist;
          closest = d;
        }
      });
    });

    setSelected(closest);
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(0, 5, 12, 1)',
        height: '100%',
      }}
    >
      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 11, color: '#8899aa', letterSpacing: 1 }}>VIEW:</span>
        {(['dots', 'lines', 'heatmap'] as ViewMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '4px 10px',
              borderRadius: 3,
              fontSize: 11,
              letterSpacing: 1,
              fontWeight: 700,
              background: mode === m ? 'rgba(0, 212, 255, 0.12)' : 'transparent',
              color: mode === m ? '#00d4ff' : '#8899aa',
              border: `1px solid ${mode === m ? 'rgba(0, 212, 255, 0.3)' : 'rgba(0, 212, 255, 0.07)'}`,
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            {m.toUpperCase()}
          </button>
        ))}
        <div style={{ width: 1, height: 18, background: 'rgba(0, 212, 255, 0.12)', margin: '0 4px' }} />
        <label style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 6,
          fontSize: 11,
          color: '#8899aa',
          cursor: 'pointer',
        }}>
          <input
            type="checkbox"
            checked={showBands}
            onChange={e => setShowBands(e.target.checked)}
            style={{ accentColor: '#00d4ff' }}
          />
          SHOW BANDS
        </label>
        <div style={{ flex: 1 }} />
        {drillDown ? (
          <span style={{ fontSize: 11, color: '#00d4ff', fontWeight: 700, letterSpacing: 1 }}>
            🔍 DRILL DOWN: {drillDown.id}
          </span>
        ) : (
          <span style={{ fontSize: 11, color: '#556' }}>
            {drones.length} threats in range
          </span>
        )}
      </div>

      {/* Canvas */}
      <div ref={canvasWrapperRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            cursor: 'crosshair',
          }}
        />
      </div>

      {/* Drill-down detail panel */}
      {drillDown && (
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(0, 212, 255, 0.2)',
          background: 'linear-gradient(180deg, rgba(0,20,40,0.95) 0%, rgba(0,5,12,0.98) 100%)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
            <button 
              onClick={() => setDrillDown(null)}
              style={{
                padding: '6px 12px',
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: 3,
                color: '#00d4ff',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 1,
                cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace",
              }}
            >
              ← BACK
            </button>
            <span style={{ 
              padding: '3px 8px', 
              borderRadius: 3, 
              fontSize: 11, 
              fontWeight: 700,
              background: SEV[drillDown.severity].bg,
              color: SEV[drillDown.severity].color,
              letterSpacing: 1,
            }}>
              {drillDown.severity.toUpperCase()}
            </span>
            <span style={{ color: '#7ecfff', fontSize: 14, fontWeight: 700 }}>{drillDown.id}</span>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            {(() => {
              const freqs = drillDown.freqHistory.map(s => s.freq);
              const times = drillDown.freqHistory.map(s => s.ts);
              const strengths = drillDown.freqHistory.map(s => s.strength);
              const minFreq = Math.min(...freqs);
              const maxFreq = Math.max(...freqs);
              const avgFreq = freqs.reduce((a, b) => a + b, 0) / freqs.length;
              const duration = (Math.max(...times) - Math.min(...times)) / 1000;
              const avgStrength = strengths.reduce((a, b) => a + b, 0) / strengths.length;
              
              return (
                <>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>BAND</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{FREQ_BANDS[drillDown.freqBand].label}</div>
                  </div>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>FREQ RANGE</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{minFreq.toFixed(0)} - {maxFreq.toFixed(0)} MHz</div>
                  </div>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>AVG FREQUENCY</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{avgFreq.toFixed(1)} MHz</div>
                  </div>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>DURATION</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{duration.toFixed(0)}s</div>
                  </div>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>SAMPLES</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{drillDown.freqHistory.length}</div>
                  </div>
                  <div style={{ background: 'rgba(0,212,255,0.05)', padding: '10px 12px', borderRadius: 4, border: '1px solid rgba(0,212,255,0.1)' }}>
                    <div style={{ fontSize: 9, color: '#556', letterSpacing: 1, marginBottom: 4 }}>AVG SIGNAL</div>
                    <div style={{ fontSize: 13, color: '#7ecfff', fontWeight: 700 }}>{avgStrength.toFixed(0)}%</div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Selected drone info (when not drilled down) */}
      {selected && !drillDown && (
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(0, 212, 255, 0.12)',
          background: 'rgba(0, 5, 12, 0.9)',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexShrink: 0,
        }}>
          <span style={{ 
            padding: '2px 6px', 
            borderRadius: 3, 
            fontSize: 10, 
            fontWeight: 700,
            background: SEV[selected.severity].bg,
            color: SEV[selected.severity].color,
            letterSpacing: 1,
          }}>
            {selected.severity.toUpperCase()}
          </span>
          <span style={{ color: '#7ecfff', fontSize: 12 }}>{selected.id}</span>
          <span style={{ color: '#556', fontSize: 11 }}>
            Band: {FREQ_BANDS[selected.freqBand].label}
          </span>
          <span style={{ color: '#556', fontSize: 11 }}>
            Samples: {selected.freqHistory.length}
          </span>
          <div style={{ flex: 1 }} />
          <button 
            onClick={() => {
              setDrillDown(selected);
              setSelected(null);
            }}
            style={{
              padding: '5px 12px',
              background: 'rgba(0,212,255,0.15)',
              border: '1px solid rgba(0,212,255,0.4)',
              borderRadius: 3,
              color: '#00d4ff',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1,
              cursor: 'pointer',
              fontFamily: "'Share Tech Mono', monospace",
            }}
          >
            DRILL DOWN →
          </button>
          <button 
            onClick={() => setSelected(null)}
            style={{
              padding: '4px 8px',
              background: 'none',
              border: '1px solid rgba(0,212,255,0.15)',
              borderRadius: 3,
              color: '#8899aa',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
