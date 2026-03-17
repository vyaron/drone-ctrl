import { project, tickSensors, type Drone } from '../../utils/droneUtils';

// Preload sensor icons
const staticSensorIcon = new Image();
staticSensorIcon.src = '/img/sensor1.svg';
const movingSensorIcon = new Image();
movingSensorIcon.src = '/img/sensor.svg';

export function drawSensors(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  ts: number,
  dt: number,
  selectedDrone: Drone | null
): void {
  const sensors = tickSensors(dt);
  const highlightSensors = selectedDrone ? new Set(selectedDrone.detectedBy || []) : null;

  sensors.forEach(s => {
    const { x: sx, y: sy } = project(s.lat, s.lon, w, h);
    const isPatrol = s.patrol;
    const isLit = highlightSensors && highlightSensors.has(s.id);
    const sColor = isLit ? "#ffd60a" : "#8a9ab0";
    const sGlow = isLit ? "rgba(255,214,10,0.6)" : "rgba(138,154,176,0.4)";

    // Line from sensor to the selected drone
    if (isLit && selectedDrone) {
      const { x: dx, y: dy } = project(selectedDrone.lat, selectedDrone.lon, w, h);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(dx, dy);
      ctx.strokeStyle = "rgba(255,214,10,0.18)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Range ring
    ctx.beginPath();
    ctx.arc(sx, sy, 28, 0, Math.PI * 2);
    ctx.strokeStyle = isLit ? "rgba(255,214,10,0.2)" : sColor + "22";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pulsing outer ring
    const sPhase = (ts / 2000) % 1;
    const pulseR = isLit ? 14 + sPhase * 24 : 14 + sPhase * 18;
    const pulseA = isLit ? Math.max(0, 0.55 - sPhase * 0.55) : Math.max(0, 0.35 - sPhase * 0.35);
    ctx.beginPath();
    ctx.arc(sx, sy, pulseR, 0, Math.PI * 2);
    ctx.strokeStyle = sColor + Math.round(pulseA * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = isLit ? 1.5 : 1;
    ctx.stroke();

    // Sensor icon
    const icon = isPatrol ? movingSensorIcon : staticSensorIcon;
    const iconSize = isLit ? 28 : 24;
    ctx.save();
    ctx.shadowColor = sGlow;
    ctx.shadowBlur = isLit ? 18 : 10;
    if (icon.complete && icon.naturalWidth > 0) {
      ctx.drawImage(icon, sx - iconSize / 2, sy - iconSize / 2, iconSize, iconSize);
    }
    ctx.restore();

    // Label
    ctx.font = `${isLit ? "bold " : ""}9px 'Share Tech Mono',monospace`;
    const lw = ctx.measureText(s.id).width;
    ctx.fillStyle = "rgba(7,10,15,0.85)";
    ctx.fillRect(sx + 10, sy - 12, lw + 5, 13);
    ctx.fillStyle = sColor;
    ctx.fillText(s.id, sx + 12, sy - 2);

    // Patrol indicator arrow
    if (isPatrol) {
      const dir = s.vLat > 0 ? -1 : 1;
      ctx.beginPath();
      ctx.moveTo(sx - 10, sy + dir * 14);
      ctx.lineTo(sx - 10, sy + dir * 22);
      ctx.lineTo(sx - 14, sy + dir * 18);
      ctx.moveTo(sx - 10, sy + dir * 22);
      ctx.lineTo(sx - 6, sy + dir * 18);
      ctx.strokeStyle = sColor + "cc";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  });
}
