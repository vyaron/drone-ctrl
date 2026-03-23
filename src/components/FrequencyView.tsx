import { useRef, useEffect, useState, type MutableRefObject, type ReactElement } from 'react';
import { 
  SEV, 
  FREQ_BANDS, 
  WINDOW_SEC,
  type Drone,
  type SeverityLevel 
} from '../utils/droneUtils';

interface FrequencyViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (d: Drone | null) => void;
  filterFn: (d: Drone) => boolean;
}

type ViewMode = 'dots' | 'lines' | 'heatmap';

const FREQ_MIN = 100;
const FREQ_MAX = 6000;
const PADDING = { top: 30, right: 20, bottom: 40, left: 70 };

export default function FrequencyView({ dronesRef, selected, onSelect, filterFn }: FrequencyViewProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ViewMode>('dots');
  const [showBands, setShowBands] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height });
    });
    
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Main render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    function render() {
      const { width, height } = dimensions;
      const dpr = window.devicePixelRatio || 1;
      
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.scale(dpr, dpr);

      const plotW = width - PADDING.left - PADDING.right;
      const plotH = height - PADDING.top - PADDING.bottom;
      
      const now = Date.now();
      const winStart = now - WINDOW_SEC * 1000;
      const winEnd = now;

      // Clear
      ctx!.fillStyle = 'rgba(0, 5, 12, 1)';
      ctx!.fillRect(0, 0, width, height);

      // Helper: map time to x
      const timeToX = (ts: number) => 
        PADDING.left + ((ts - winStart) / (winEnd - winStart)) * plotW;
      
      // Helper: map freq to y (inverted - higher freq at top)
      const freqToY = (freq: number) => {
        // Use log scale for better band visibility
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
          ctx!.fillStyle = band.color;
          ctx!.fillRect(PADDING.left, y1, plotW, y2 - y1);
          
          // Band label
          ctx!.fillStyle = 'rgba(136, 153, 170, 0.5)';
          ctx!.font = '10px "Share Tech Mono", monospace';
          ctx!.textAlign = 'left';
          ctx!.fillText(band.label, PADDING.left + 5, y1 + 12);
        });
      }

      // Draw grid
      ctx!.strokeStyle = 'rgba(0, 212, 255, 0.08)';
      ctx!.lineWidth = 1;

      // Vertical time grid (every minute)
      for (let t = winStart; t <= winEnd; t += 60000) {
        const x = timeToX(t);
        ctx!.beginPath();
        ctx!.moveTo(x, PADDING.top);
        ctx!.lineTo(x, height - PADDING.bottom);
        ctx!.stroke();
      }

      // Horizontal freq grid
      const freqGridLines = [200, 500, 1000, 2000, 3000, 4000, 5000];
      freqGridLines.forEach(freq => {
        const y = freqToY(freq);
        ctx!.beginPath();
        ctx!.moveTo(PADDING.left, y);
        ctx!.lineTo(width - PADDING.right, y);
        ctx!.stroke();
      });

      // Draw axes
      ctx!.strokeStyle = 'rgba(0, 212, 255, 0.3)';
      ctx!.lineWidth = 1;
      // Y axis
      ctx!.beginPath();
      ctx!.moveTo(PADDING.left, PADDING.top);
      ctx!.lineTo(PADDING.left, height - PADDING.bottom);
      ctx!.stroke();
      // X axis
      ctx!.beginPath();
      ctx!.moveTo(PADDING.left, height - PADDING.bottom);
      ctx!.lineTo(width - PADDING.right, height - PADDING.bottom);
      ctx!.stroke();

      // Y axis labels (frequency)
      ctx!.fillStyle = '#8899aa';
      ctx!.font = '10px "Share Tech Mono", monospace';
      ctx!.textAlign = 'right';
      freqGridLines.forEach(freq => {
        const y = freqToY(freq);
        const label = freq >= 1000 ? `${freq/1000}G` : `${freq}M`;
        ctx!.fillText(label, PADDING.left - 8, y + 3);
      });

      // X axis labels (time)
      ctx!.textAlign = 'center';
      for (let t = winStart; t <= winEnd; t += 60000) {
        const x = timeToX(t);
        const d = new Date(t);
        const label = `${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        ctx!.fillText(label, x, height - PADDING.bottom + 15);
      }

      // NOW marker
      ctx!.strokeStyle = 'rgba(255, 45, 85, 0.5)';
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(width - PADDING.right, PADDING.top);
      ctx!.lineTo(width - PADDING.right, height - PADDING.bottom);
      ctx!.stroke();
      ctx!.fillStyle = '#ff2d55';
      ctx!.font = '10px "Share Tech Mono", monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('NOW', width - PADDING.right, PADDING.top - 8);

      // Get filtered drones
      const drones = dronesRef.current.filter(filterFn);

      if (mode === 'heatmap') {
        // Heatmap mode - aggregate frequency activity
        const cellW = plotW / 100;
        const cellH = plotH / 50;
        const heatmap: number[][] = Array(50).fill(0).map(() => Array(100).fill(0));
        
        drones.forEach(d => {
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

        // Render heatmap cells
        for (let yi = 0; yi < 50; yi++) {
          for (let xi = 0; xi < 100; xi++) {
            const val = Math.min(1, heatmap[yi][xi]);
            if (val > 0.01) {
              const alpha = val * 0.8;
              ctx!.fillStyle = `rgba(0, 212, 255, ${alpha})`;
              ctx!.fillRect(
                PADDING.left + xi * cellW,
                PADDING.top + yi * cellH,
                cellW + 1,
                cellH + 1
              );
            }
          }
        }
      } else {
        // Dots or Lines mode
        drones.forEach(d => {
          const color = SEV[d.severity].color;
          const isSelected = selected?.id === d.id;
          const samples = d.freqHistory.filter(s => s.ts >= winStart && s.ts <= winEnd);
          
          if (samples.length === 0) return;

          if (mode === 'lines' && samples.length > 1) {
            // Draw connecting line
            ctx!.strokeStyle = isSelected ? color : `${color}88`;
            ctx!.lineWidth = isSelected ? 2 : 1;
            ctx!.beginPath();
            samples.forEach((s, i) => {
              const x = timeToX(s.ts);
              const y = freqToY(s.freq);
              if (i === 0) ctx!.moveTo(x, y);
              else ctx!.lineTo(x, y);
            });
            ctx!.stroke();
          }

          // Draw dots
          samples.forEach(s => {
            const x = timeToX(s.ts);
            const y = freqToY(s.freq);
            const radius = isSelected 
              ? 4 + (s.strength / 100) * 3 
              : 2 + (s.strength / 100) * 2;

            if (isSelected) {
              // Glow effect
              ctx!.shadowColor = SEV[d.severity].glow;
              ctx!.shadowBlur = 8;
            }

            ctx!.fillStyle = isSelected ? color : `${color}cc`;
            ctx!.beginPath();
            ctx!.arc(x, y, radius, 0, Math.PI * 2);
            ctx!.fill();

            ctx!.shadowBlur = 0;
          });
        });
      }

      // Axis titles
      ctx!.fillStyle = '#8899aa';
      ctx!.font = '11px "Share Tech Mono", monospace';
      ctx!.textAlign = 'center';
      ctx!.fillText('TIME', PADDING.left + plotW / 2, height - 5);
      
      ctx!.save();
      ctx!.translate(15, PADDING.top + plotH / 2);
      ctx!.rotate(-Math.PI / 2);
      ctx!.fillText('FREQUENCY (MHz)', 0, 0);
      ctx!.restore();

      animationId = requestAnimationFrame(render);
    }

    render();
    return () => cancelAnimationFrame(animationId);
  }, [dronesRef, selected, filterFn, mode, showBands, dimensions]);

  // Handle click to select drone
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const { width, height } = dimensions;
    const plotW = width - PADDING.left - PADDING.right;
    const plotH = height - PADDING.top - PADDING.bottom;
    
    const now = Date.now();
    const winStart = now - WINDOW_SEC * 1000;
    const winEnd = now;

    // Find closest drone point
    let closest: Drone | null = null;
    let closestDist = Infinity;
    const maxDist = 15; // pixels

    const drones = dronesRef.current.filter(filterFn);
    
    drones.forEach(d => {
      d.freqHistory.forEach(sample => {
        if (sample.ts < winStart || sample.ts > winEnd) return;
        
        const px = PADDING.left + ((sample.ts - winStart) / (winEnd - winStart)) * plotW;
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

    onSelect(closest);
  };

  return (
    <div 
      ref={containerRef}
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        overflow: 'hidden',
        background: 'rgba(0, 5, 12, 1)'
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
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
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
    </div>
  );
}
