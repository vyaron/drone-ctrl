import { project, LAT_MIN, LON_MIN, LAT_MAX, LON_MAX } from '../../utils/droneUtils';

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "#070a0f";
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 4) {
    ctx.fillStyle = "rgba(0,212,255,0.012)";
    ctx.fillRect(0, y, w, 1);
  }
}

export function drawGridLines(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = "rgba(0,212,255,0.07)";
  ctx.lineWidth = 0.5;
  
  for (let lat = 31.3; lat <= 31.9; lat += 0.1) {
    const { y: gy } = project(lat, LON_MIN, w, h);
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }
  
  for (let lon = 35.1; lon <= 35.7; lon += 0.1) {
    const { x: gx } = project(LAT_MIN, lon, w, h);
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
}

export function drawGridDots(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "rgba(0,212,255,0.15)";
  for (let lat = 31.3; lat <= 31.9; lat += 0.1) {
    for (let lon = 35.1; lon <= 35.7; lon += 0.1) {
      const { x: gx, y: gy } = project(lat, lon, w, h);
      ctx.beginPath();
      ctx.arc(gx, gy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export function drawAxisLabels(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = "rgba(0,180,255,0.3)";
  ctx.font = "9px 'Share Tech Mono', monospace";
  
  for (let lat = 31.4; lat <= 31.8; lat += 0.1) {
    const { y: gy } = project(lat, LON_MIN, w, h);
    ctx.fillText(`${lat.toFixed(2)}N`, 6, gy - 3);
  }
  
  for (let lon = 35.2; lon <= 35.6; lon += 0.1) {
    const { x: gx } = project(LAT_MIN, lon, w, h);
    ctx.fillText(`${lon.toFixed(2)}E`, gx + 3, h - 6);
  }
}

export function drawScanSweep(ctx: CanvasRenderingContext2D, w: number, h: number, ts: number): void {
  const scanY = (ts * 0.04) % h;
  ctx.fillStyle = "rgba(0,212,255,0.04)";
  ctx.fillRect(0, scanY, w, 3);
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, ts: number): void {
  drawBackground(ctx, w, h);
  drawGridLines(ctx, w, h);
  drawGridDots(ctx, w, h);
  drawAxisLabels(ctx, w, h);
  drawScanSweep(ctx, w, h, ts);
}
