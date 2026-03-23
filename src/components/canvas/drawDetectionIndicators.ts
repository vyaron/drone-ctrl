import { project, tickSensors, DRONE_COLORS, type Detection } from '../../utils/droneUtils';

/**
 * Draw detection-level indicators around sensors.
 * Shows small colored dots around sensors that have active detection-level threats.
 */
export function drawDetectionIndicators(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ts: number,
  detections: Detection[],
  onIndicatorClick?: (detection: Detection) => void
): { hitTest: (x: number, y: number) => Detection | null } {
  const sensors = tickSensors(0); // Get current sensor positions
  const hitAreas: { x: number; y: number; r: number; detection: Detection }[] = [];
  
  // Group detection-level detections by sensor (already filtered by caller)
  const detectionBySensor = new Map<string, Detection[]>();
  detections.forEach(d => {
    const list = detectionBySensor.get(d.sensorId) || [];
    list.push(d);
    detectionBySensor.set(d.sensorId, list);
  });
  
  sensors.forEach(s => {
    const sensorDetections = detectionBySensor.get(s.id);
    if (!sensorDetections || sensorDetections.length === 0) return;
    
    const { x: sx, y: sy } = project(s.lat, s.lon, w, h);
    const radius = 20; // Distance from sensor center
    const angleStep = (Math.PI * 2) / Math.max(sensorDetections.length, 1);
    
    sensorDetections.forEach((det, i) => {
      const angle = i * angleStep - Math.PI / 2; // Start from top
      const indicatorX = sx + Math.cos(angle) * radius;
      const indicatorY = sy + Math.sin(angle) * radius;
      const color = DRONE_COLORS[det.colorIndex % DRONE_COLORS.length].color;
      const indicatorR = 6;
      
      // Pulsing effect
      const phase = (ts / 1000 + i * 0.3) % 1;
      const pulseR = indicatorR + phase * 4;
      const pulseAlpha = Math.max(0, 0.5 - phase * 0.5);
      
      // Pulse ring
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = color + Math.round(pulseAlpha * 255).toString(16).padStart(2, '0');
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Main indicator dot
      ctx.beginPath();
      ctx.arc(indicatorX, indicatorY, indicatorR, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff40';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Store hit area for click detection
      hitAreas.push({ x: indicatorX, y: indicatorY, r: indicatorR + 4, detection: det });
    });
  });
  
  // Return hit test function
  return {
    hitTest: (x: number, y: number): Detection | null => {
      for (const area of hitAreas) {
        const dx = x - area.x;
        const dy = y - area.y;
        if (dx * dx + dy * dy <= area.r * area.r) {
          return area.detection;
        }
      }
      return null;
    }
  };
}
