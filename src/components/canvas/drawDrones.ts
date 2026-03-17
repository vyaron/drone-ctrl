import { project, SEV, type Drone } from '../../utils/droneUtils';

// Load drone SVG image
const droneImg = new Image();
droneImg.src = '/img/drone.svg';
let droneImgLoaded = false;
droneImg.onload = () => { droneImgLoaded = true; };

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

  // Calculate heading angle for icon rotation
  const rad = (drone.heading - 90) * Math.PI / 180;

  // Drone icon
  const iconSize = isSel || isHov ? 28 : 22;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad + Math.PI / 2); // Rotate to match heading
  
  if (droneImgLoaded) {
    // Apply color tint using composite operations
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = isSel ? 20 : 10;
    ctx.drawImage(droneImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
    ctx.shadowBlur = 0;
  } else {
    // Fallback dot if image not loaded
    ctx.beginPath();
    ctx.arc(0, 0, iconSize / 3, 0, Math.PI * 2);
    ctx.fillStyle = cfg.color;
    ctx.fill();
  }
  
  ctx.restore();
  
  if (isSel) {
    ctx.beginPath();
    ctx.arc(x, y, iconSize / 2 + 5, 0, Math.PI * 2);
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
