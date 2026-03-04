import { project, SEV, type Drone } from '../../utils/droneUtils';

export function drawDrone(
  ctx: CanvasRenderingContext2D,
  drone: Drone,
  w: number,
  h: number,
  ts: number,
  selected: Drone | null,
  hover: Drone | null
): void {
  const cfg = SEV[drone.severity];
  const { x, y } = project(drone.lat, drone.lon, w, h);
  const isSel = selected?.id === drone.id;
  const isHov = hover?.id === drone.id;
  const phase = (ts / 1000) % 2;
  
  // Apply transparency to non-selected drones when one is selected
  const droneAlpha = selected && !isSel ? 0.1 : 1;
  ctx.globalAlpha = droneAlpha;

  // Pulse rings
  const rings = drone.severity === "critical" ? 3 : drone.severity === "high" ? 2 : 1;
  for (let i = 0; i < rings; i++) {
    const progress = (phase + i * (2 / rings)) % 2;
    const ringR = 10 + progress * 22;
    const alpha = Math.max(0, 0.5 - progress * 0.25);
    ctx.beginPath();
    ctx.arc(x, y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = cfg.color + Math.round(alpha * 255).toString(16).padStart(2, "0");
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Direction arrow
  const rad = (drone.heading - 90) * Math.PI / 180;
  const alen = 26;
  const ax = x + Math.cos(rad) * alen;
  const ay = y + Math.sin(rad) * alen;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(ax, ay);
  ctx.strokeStyle = cfg.color + "cc";
  ctx.lineWidth = isSel ? 2 : 1.5;
  ctx.stroke();
  
  const ang = Math.atan2(ay - y, ax - x);
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(ax - 7 * Math.cos(ang - 0.4), ay - 7 * Math.sin(ang - 0.4));
  ctx.lineTo(ax - 7 * Math.cos(ang + 0.4), ay - 7 * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fillStyle = cfg.color + "cc";
  ctx.fill();

  // Dot
  const dotR = isSel || isHov ? 9 : 7;
  ctx.beginPath();
  ctx.arc(x, y, dotR, 0, Math.PI * 2);
  ctx.shadowColor = cfg.color;
  ctx.shadowBlur = isSel ? 20 : 10;
  ctx.fillStyle = cfg.color;
  ctx.fill();
  ctx.shadowBlur = 0;
  
  if (isSel) {
    ctx.beginPath();
    ctx.arc(x, y, dotR + 5, 0, Math.PI * 2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // Label
  const label = drone.model.length > 13 ? drone.model.slice(0, 12) + "…" : drone.model;
  ctx.font = `${isSel ? "bold " : ""}10px 'Share Tech Mono',monospace`;
  const tw = ctx.measureText(label).width;
  ctx.fillStyle = "rgba(7,10,15,0.85)";
  ctx.fillRect(x + 12, y - 14, tw + 6, 15);
  ctx.fillStyle = isSel ? "#fff" : cfg.color;
  ctx.fillText(label, x + 15, y - 3);
  
  // Reset alpha
  ctx.globalAlpha = 1;
}

export function drawDrones(
  ctx: CanvasRenderingContext2D,
  drones: Drone[],
  w: number,
  h: number,
  ts: number,
  selected: Drone | null,
  hover: Drone | null
): void {
  drones.forEach(drone => {
    drawDrone(ctx, drone, w, h, ts, selected, hover);
  });
}
