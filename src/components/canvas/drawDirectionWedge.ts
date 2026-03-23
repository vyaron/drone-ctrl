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
  // DEBUG
  if (!('_wedgeDrawn' in window)) {
    (window as any)._wedgeDrawn = true;
    console.log('%c[drawDirectionWedge] CALLED!', 'background: red; color: white; font-size: 20px;', { bearing, bearingWidth, colorIndex, maxRange, centerX: 'will calc', centerY: 'will calc' });
  }
  
  const { x: centerX, y: centerY } = project(SITE_CENTER.lat, SITE_CENTER.lon, w, h);
  const color = DRONE_COLORS[colorIndex % DRONE_COLORS.length].color;
  
  // Use larger range for replay visibility
  const actualRange = Math.max(maxRange, Math.min(w, h) * 0.4);  // At least 40% of canvas
  
  // Convert bearing to radians (0° = North, clockwise)
  const startAngle = (bearing - bearingWidth / 2 - 90) * Math.PI / 180;
  const endAngle = (bearing + bearingWidth / 2 - 90) * Math.PI / 180;
  
  // Draw filled wedge with gradient - MORE VISIBLE
  const gradient = ctx.createRadialGradient(
    centerX, centerY, 0,
    centerX, centerY, actualRange
  );
  gradient.addColorStop(0, color + '80');   // 50% opacity at center
  gradient.addColorStop(0.5, color + '60'); // 37% mid
  gradient.addColorStop(0.8, color + '40'); // fade
  gradient.addColorStop(1, color + '20');   // slight fade at edge
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, actualRange, startAngle, endAngle);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Outline edges - BRIGHTER
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(startAngle) * actualRange,
    centerY + Math.sin(startAngle) * actualRange
  );
  ctx.strokeStyle = color + 'aa';  // More visible edge
  ctx.lineWidth = 2;
  ctx.stroke();
  
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(
    centerX + Math.cos(endAngle) * actualRange,
    centerY + Math.sin(endAngle) * actualRange
  );
  ctx.stroke();
  
  // Arc at edge
  ctx.beginPath();
  ctx.arc(centerX, centerY, actualRange, startAngle, endAngle);
  ctx.strokeStyle = color + '80';
  ctx.lineWidth = 2;
  ctx.stroke();
  
  return { centerX, centerY, bearing, bearingWidth, maxRange: actualRange };
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
