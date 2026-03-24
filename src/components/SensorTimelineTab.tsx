import { useRef, useEffect, useState, useMemo, type ReactElement } from 'react';
import { 
  DRONE_COLORS, 
  SENSORS_BASE, 
  type Event, 
  type Detection,
  type DetectionLevel 
} from '../utils/droneUtils';

interface SensorTimelineTabProps {
  event: Event;
  currentTs: number;
}

const PADDING = { top: 40, right: 30, bottom: 50, left: 90 };
const ROW_HEIGHT = 60;
const BAR_HEIGHT = 14;
const BAR_GAP = 2;

// Detection levels in order of precision (gradual improvement over time)
const LEVEL_ORDER: DetectionLevel[] = ['detection', 'direction', 'location'];
const LEVEL_CONFIG: Record<DetectionLevel, { label: string; color: string; bg: string }> = {
  detection: { label: 'DETECT', color: '#8899aa', bg: 'rgba(136,153,170,0.3)' },
  direction: { label: 'DIR', color: '#ffd60a', bg: 'rgba(255,214,10,0.3)' },
  location: { label: 'GEO', color: '#00d4ff', bg: 'rgba(0,212,255,0.4)' },
};

interface TooltipData {
  x: number;
  y: number;
  detection: Detection;
}

export function SensorTimelineTab({ event, currentTs }: SensorTimelineTabProps): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Group detections by sensor
  const detectionsBySensor = useMemo(() => {
    const map = new Map<string, Detection[]>();
    SENSORS_BASE.forEach(s => map.set(s.id, []));
    event.detections.forEach(det => {
      const list = map.get(det.sensorId);
      if (list) {
        list.push(det);
      }
    });
    // Sort each sensor's detections by level (DETECT → DIR → GEO) then by start time
    map.forEach((dets, sensorId) => {
      dets.sort((a, b) => {
        const levelA = LEVEL_ORDER.indexOf(a.level);
        const levelB = LEVEL_ORDER.indexOf(b.level);
        if (levelA !== levelB) return levelA - levelB;
        return a.startedAt - b.startedAt;
      });
      map.set(sensorId, dets);
    });
    return map;
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

  // Calculate bar positions for hit testing
  const barPositions = useMemo(() => {
    const { width } = dimensions;
    const plotW = width - PADDING.left - PADDING.right;
    const winStart = event.startedAt;
    const winEnd = event.endedAt;
    const windowDuration = winEnd - winStart;

    const timeToX = (ts: number) => 
      PADDING.left + ((ts - winStart) / windowDuration) * plotW;

    const bars: Array<{ 
      x: number; 
      y: number; 
      w: number; 
      h: number; 
      detection: Detection;
    }> = [];

    const sensorIds = SENSORS_BASE.map(s => s.id);
    sensorIds.forEach((sensorId, sensorIndex) => {
      const dets = detectionsBySensor.get(sensorId) || [];
      const rowTop = PADDING.top + sensorIndex * ROW_HEIGHT;
      
      // Stack bars within each sensor row
      const stacks: Array<{ endTs: number; level: DetectionLevel }> = [];
      
      dets.forEach(det => {
        // Find the first available stack position
        let stackIndex = stacks.findIndex(s => s.endTs <= det.startedAt);
        if (stackIndex === -1) {
          stackIndex = stacks.length;
          stacks.push({ endTs: det.endedAt, level: det.level });
        } else {
          stacks[stackIndex].endTs = det.endedAt;
        }
        
        const x = timeToX(det.startedAt);
        const barW = Math.max(4, timeToX(det.endedAt) - x);
        const y = rowTop + 8 + stackIndex * (BAR_HEIGHT + BAR_GAP);
        
        bars.push({ x, y, w: barW, h: BAR_HEIGHT, detection: det });
      });
    });

    return bars;
  }, [dimensions, event, detectionsBySensor]);

  // Handle mouse move for tooltip
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find bar under cursor
    const hit = barPositions.find(bar => 
      x >= bar.x && x <= bar.x + bar.w &&
      y >= bar.y && y <= bar.y + bar.h
    );

    if (hit) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, detection: hit.detection });
    } else {
      setTooltip(null);
    }
  };

  const handleMouseLeave = () => setTooltip(null);

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
    const winStart = event.startedAt;
    const winEnd = event.endedAt;
    const windowDuration = winEnd - winStart;

    // Helper: map time to x
    const timeToX = (ts: number) => 
      PADDING.left + ((ts - winStart) / windowDuration) * plotW;

    // Clear
    ctx.fillStyle = 'rgba(0, 5, 12, 1)';
    ctx.fillRect(0, 0, width, height);

    // Draw header
    ctx.fillStyle = '#00d4ff';
    ctx.font = 'bold 11px "Share Tech Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SENSOR DETECTIONS OVER TIME', PADDING.left, 20);

    // Draw legend
    ctx.font = '9px "Share Tech Mono", monospace';
    let legendX = width - PADDING.right - 180;
    LEVEL_ORDER.forEach(level => {
      const cfg = LEVEL_CONFIG[level];
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(legendX, 10, 12, 12);
      ctx.strokeStyle = cfg.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX, 10, 12, 12);
      ctx.fillStyle = cfg.color;
      ctx.fillText(cfg.label, legendX + 16, 19);
      legendX += 55;
    });

    const sensorIds = SENSORS_BASE.map(s => s.id);

    // Draw sensor rows
    sensorIds.forEach((sensorId, index) => {
      const rowTop = PADDING.top + index * ROW_HEIGHT;
      
      // Row background (alternating)
      if (index % 2 === 0) {
        ctx.fillStyle = 'rgba(0, 212, 255, 0.02)';
        ctx.fillRect(PADDING.left, rowTop, plotW, ROW_HEIGHT);
      }
      
      // Row separator
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PADDING.left, rowTop + ROW_HEIGHT);
      ctx.lineTo(width - PADDING.right, rowTop + ROW_HEIGHT);
      ctx.stroke();

      // Sensor label
      ctx.fillStyle = '#7ecfff';
      ctx.font = 'bold 11px "Share Tech Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText(sensorId.toUpperCase(), PADDING.left - 10, rowTop + ROW_HEIGHT / 2 + 4);
    });

    // Draw time grid
    const gridInterval = windowDuration < 300000 ? 30000 :
                         windowDuration < 900000 ? 60000 :
                         windowDuration < 3600000 ? 300000 :
                         600000;
    
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.06)';
    ctx.lineWidth = 1;
    for (let t = Math.ceil(winStart / gridInterval) * gridInterval; t <= winEnd; t += gridInterval) {
      const x = timeToX(t);
      ctx.beginPath();
      ctx.moveTo(x, PADDING.top);
      ctx.lineTo(x, PADDING.top + sensorIds.length * ROW_HEIGHT);
      ctx.stroke();
    }

    // Draw X axis labels
    ctx.fillStyle = '#8899aa';
    ctx.font = '10px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    const labelY = PADDING.top + sensorIds.length * ROW_HEIGHT + 20;
    for (let t = Math.ceil(winStart / gridInterval) * gridInterval; t <= winEnd; t += gridInterval) {
      const x = timeToX(t);
      const d = new Date(t);
      const label = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
      ctx.fillText(label, x, labelY);
    }

    // Draw detection bars
    barPositions.forEach(bar => {
      const det = bar.detection;
      const levelCfg = LEVEL_CONFIG[det.level];
      const droneCfg = DRONE_COLORS[det.colorIndex % DRONE_COLORS.length];
      
      // Bar fill with level-based background
      ctx.fillStyle = levelCfg.bg;
      ctx.fillRect(bar.x, bar.y, bar.w, bar.h);
      
      // Left edge accent with drone color
      ctx.fillStyle = droneCfg.color;
      ctx.fillRect(bar.x, bar.y, 3, bar.h);
      
      // Border
      ctx.strokeStyle = levelCfg.color;
      ctx.lineWidth = 1;
      ctx.strokeRect(bar.x, bar.y, bar.w, bar.h);

      // Label inside bar if wide enough
      if (bar.w > 50) {
        ctx.fillStyle = levelCfg.color;
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(levelCfg.label, bar.x + 6, bar.y + 10);
      }
    });

    // Draw current time marker
    const nowX = timeToX(currentTs);
    if (nowX >= PADDING.left && nowX <= width - PADDING.right) {
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(nowX, PADDING.top);
      ctx.lineTo(nowX, PADDING.top + sensorIds.length * ROW_HEIGHT);
      ctx.stroke();

      // Time marker head
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.moveTo(nowX, PADDING.top - 6);
      ctx.lineTo(nowX - 5, PADDING.top);
      ctx.lineTo(nowX + 5, PADDING.top);
      ctx.closePath();
      ctx.fill();
    }

    // Draw axes
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top);
    ctx.lineTo(PADDING.left, PADDING.top + sensorIds.length * ROW_HEIGHT);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top + sensorIds.length * ROW_HEIGHT);
    ctx.lineTo(width - PADDING.right, PADDING.top + sensorIds.length * ROW_HEIGHT);
    ctx.stroke();

  }, [dimensions, event, currentTs, detectionsBySensor, barPositions]);

  // Format time helper
  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };

  const formatDuration = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div 
      ref={containerRef} 
      style={{ 
        width: '100%', 
        height: '100%', 
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <canvas 
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: tooltip ? 'pointer' : 'default' }}
      />
      
      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 10,
            background: 'rgba(0, 10, 20, 0.95)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 4,
            padding: '8px 12px',
            fontSize: 11,
            color: '#e8eaf0',
            pointerEvents: 'none',
            zIndex: 100,
            minWidth: 180,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
          }}
        >
          <div style={{ fontWeight: 700, color: '#00d4ff', marginBottom: 4, letterSpacing: 1 }}>
            {tooltip.detection.droneType}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontSize: 10 }}>
            <span style={{ color: '#8899aa' }}>Level:</span>
            <span style={{ color: LEVEL_CONFIG[tooltip.detection.level].color }}>
              {LEVEL_CONFIG[tooltip.detection.level].label}
            </span>
            <span style={{ color: '#8899aa' }}>Sensor:</span>
            <span>{tooltip.detection.sensorId}</span>
            <span style={{ color: '#8899aa' }}>Duration:</span>
            <span>{formatDuration(tooltip.detection.endedAt - tooltip.detection.startedAt)}</span>
            <span style={{ color: '#8899aa' }}>Time:</span>
            <span>{formatTime(tooltip.detection.startedAt)} - {formatTime(tooltip.detection.endedAt)}</span>
            <span style={{ color: '#8899aa' }}>Frequencies:</span>
            <span>
              {tooltip.detection.frequencies.map(f => 
                f >= 1000 ? `${(f / 1000).toFixed(1)}GHz` : `${f}MHz`
              ).join(', ')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
