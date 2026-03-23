import { project, SITE_CENTER, DRONE_COLORS } from '../../utils/droneUtils';

export interface WedgeHitArea {
  centerX: number;
  centerY: number;
  bearing: number;
  bearingWidth: number;
  maxRange: number;
}

export function drawDirectionWedge(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bearing: number,          // center angle in degrees
  bearingWidth: number,     // total width in degrees
  colorIndex: number,
  maxRange: number = 80     // pixels
): WedgeHitArea {
  const { x: centerX, y: centerY } = project(SITE_CENTER.lat, SITE_CENTER.lon, w, h);
  const color = DRONE_COLORS[colorIndex % DRONE_COLORS.length].color;
  
  // Convert bearing to radians (0° = North, clockwise)
  const startAngle = (bearing - bearingWidth / 2 - 90) * Math.PI / 180;
  const endAngle = (bearing + bearingWidth / 2 - 90) * Math.PI / 180;
  
  // Draw filled wedge with gradient
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, maxRange
  );
  gradient.addColorStop(0, color + '40');   // 25% opacity at center
  gradient.addColorStop(0.7, color + '30'); // fade
  gradient.addColorStop(1, color + '00');   // transparent at edge
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, maxRange, startAngle, endAngle);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Outline edges
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(startAngle) * maxRange,
    centerY + Math.sin(startAngle) * maxRange
  );
  ctx.strokeStyle = color + '50';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(endAngle) * maxRange,
    centerY + Math.sin(endAngle) * maxRange
  );
  ctx.stroke();
  
  return { centerX, centerY, bearing, bearingWidth, maxRange };
}

// Hit test for a point inside a wedge
export function hitTestWedge(
  x: number,
  y: number,
  hitArea: WedgeHitArea
): boolean {
  const dx = x - hitArea.centerX;
  const dy = y - hitArea.centerY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  // Check if within range
  if (dist > hitArea.maxRange) return false;
  
  // Check if within angle range
  const angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  const bearingStart = (hitArea.bearing - hitArea.bearingWidth / 2 + 360) % 360;
  const bearingEnd = (hitArea.bearing + hitArea.bearingWidth / 2 + 360) % 360;
  
  if (bearingStart < bearingEnd) {
    return angle >= bearingStart && angle <= bearingEnd;
  } else {
    // Wraps around 0/360
    return angle >= bearingStart || angle <= bearingEnd;
  }
}
