import { useRef, useEffect, useState, useMemo, type ReactElement } from 'react';
import { SEV, FREQ_BANDS, type Event, type Detection } from '../utils/droneUtils';

interface FrequencyTabProps {
  event: Event;
  currentTs: number;
}

const FREQ_MIN = 100;
const FREQ_MAX = 6500;
const PADDING = { top: 30, right: 20, bottom: 40, left: 70 };

export function FrequencyTab({ event, currentTs }: FrequencyTabProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [showBands, setShowBands] = useState(true);
  const [selected, setSelected] = useState<Detection | null>(null);

  // Use event's detections directly, downsample freqHistory for performance
  const detections = useMemo(() => {
    return event.detections.map(d => ({
      ...d,
      // Downsample: keep every 4th sample (1 per second instead of 4 per second)
      freqHistory: d.freqHistory.filter((_, i) => i % 4 === 0),
    }));
  }, [event]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width: Math.max(100, width), height: Math.max(100, height) });
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Render canvas
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
    
    const winStart = event.startedAt;
    const winEnd = event.endedAt;
    const windowDuration = winEnd - winStart;

    // Clear
    ctx.fillStyle = 'rgba(0, 5, 12, 1)';
    ctx.fillRect(0, 0, width, height);

    // Helper: map time to x
    const timeToX = (ts: number) => 
      PADDING.left + ((ts - winStart) / windowDuration) * plotW;
    
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

    // Vertical time grid - adaptive
    const gridInterval = windowDuration < 300000 ? 30000 :   // < 5min: 30s
                         windowDuration < 900000 ? 60000 :   // < 15min: 1min
                         windowDuration < 3600000 ? 300000 : // < 1h: 5min
                         600000;                             // else: 10min
    
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
      const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      ctx.fillText(label, x, height - PADDING.bottom + 15);
    }

    // Draw detection frequency lines
    detections.forEach(det => {
      const color = SEV[det.severity].color;
      const isSelected = selected?.id === det.id;
      const samples = det.freqHistory.filter(s => s.ts >= winStart && s.ts <= winEnd);
      
      if (samples.length < 2) return;

      // Draw connecting lines
      ctx.strokeStyle = isSelected ? color : `${color}99`;
      ctx.lineWidth = isSelected ? 2.5 : 1.5;
      ctx.beginPath();
      samples.forEach((s, i) => {
        const x = timeToX(s.ts);
        const y = freqToY(s.freq);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      
      // Draw small dots at endpoints
      if (isSelected) {
        ctx.shadowColor = SEV[det.severity].glow;
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
    });

    // Draw current time marker
    const nowX = timeToX(currentTs);
    if (nowX >= PADDING.left && nowX <= width - PADDING.right) {
      ctx.strokeStyle = '#ff2d5588';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(nowX, PADDING.top);
      ctx.lineTo(nowX, height - PADDING.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
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

  }, [detections, selected, showBands, dimensions, event, currentTs]);

  // Handle click to select detection
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { width, height } = dimensions;
    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    const winStart = event.startedAt;
    const winEnd = event.endedAt;

    let closest: Detection | null = null;
    let closestDist = Infinity;
    const maxDist = 30;

    detections.forEach(det => {
      det.freqHistory.forEach(sample => {
        if (sample.ts < winStart || sample.ts > winEnd) return;
        
        const px = PADDING.left + ((sample.ts - winStart) / (winEnd - winStart)) * plotW;
        const logMin = Math.log10(FREQ_MIN);
        const logMax = Math.log10(FREQ_MAX);
        const logFreq = Math.log10(sample.freq);
        const py = PADDING.top + plotH * (1 - (logFreq - logMin) / (logMax - logMin));
        
        const dist = Math.sqrt((px - x) ** 2 + (py - y) ** 2);
        if (dist < closestDist && dist < maxDist) {
          closestDist = dist;
          closest = event.detections.find(d => d.id === det.id) || null;
        }
      });
    });

    setSelected(closest);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Controls */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '8px 16px',
        borderBottom: '1px solid rgba(0, 212, 255, 0.08)',
        flexShrink: 0,
      }}>
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
        <span style={{ fontSize: 11, color: '#556' }}>
          {detections.length} detections
        </span>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={{ flex: 1, position: 'relative', minHeight: 0 }}>
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

      {/* Selected detection info */}
      {selected && (
        <div style={{
          padding: '10px 16px',
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
          <span style={{ color: '#7ecfff', fontSize: 12 }}>{selected.droneType}</span>
          <span style={{ color: '#556', fontSize: 11 }}>
            Band: {FREQ_BANDS[selected.freqBand].label}
          </span>
          <span style={{ color: '#556', fontSize: 11 }}>
            {selected.frequencies.map(f => f >= 1000 ? `${(f/1000).toFixed(1)}GHz` : `${f}MHz`).join(', ')}
          </span>
          <div style={{ flex: 1 }} />
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
