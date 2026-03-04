import { project, LAT_MAX, LAT_MIN } from '../../utils/droneUtils';

export function drawProtectedZone(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cpt = project(31.591, 35.393, w, h);
  const radPx = (0.08 / (LAT_MAX - LAT_MIN)) * h;
  
  // Gradient fill
  const zg = ctx.createRadialGradient(cpt.x, cpt.y, 0, cpt.x, cpt.y, radPx);
  zg.addColorStop(0, "rgba(0,212,255,0.06)");
  zg.addColorStop(1, "transparent");
  ctx.fillStyle = zg;
  ctx.beginPath();
  ctx.arc(cpt.x, cpt.y, radPx, 0, Math.PI * 2);
  ctx.fill();
  
  // Dashed border
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(0,212,255,0.25)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cpt.x, cpt.y, radPx, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  
  // Label
  ctx.fillStyle = "rgba(0,212,255,0.4)";
  ctx.font = "8px 'Share Tech Mono',monospace";
  ctx.fillText("PROTECTED ZONE", cpt.x - 40, cpt.y + 3);
}
