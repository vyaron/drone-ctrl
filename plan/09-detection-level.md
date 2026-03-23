# Detection Level

## Overview
Each detection can have one of three confidence levels, determining how it's visualized:

| Level | What we know | Map Visualization |
|-------|-------------|-------------------|
| **Location** | Full lat/lon coordinates | Drone icon on map (current behavior) |
| **Direction** | Bearing/angle from sensor | Narrow trapezoid wedge from sensor |
| **Detection** | Only which sensor detected it | Colored indicator on the sensor |


DIRECTION: should be from the site center (can be hardcoded for now)
---

## Data Model Changes

### Update `Detection` interface in `droneUtils.ts`:

```ts
export type DetectionLevel = 'location' | 'direction' | 'detection';

export interface Detection {
  id: string;
  droneId: string;
  droneType: string;
  colorIndex: number;
  startedAt: number;
  endedAt: number;
  frequencies: number[];
  freqBand: keyof typeof FREQ_BANDS;
  freqHistory: FreqSample[];
  
  // Detection level determines visualization
  level: DetectionLevel;
  
  // For 'location' level - full position data
  lat?: number;
  lon?: number;
  positionHistory?: PositionSample[];
  
  // For 'direction' level - bearing from sensor
  bearing?: number;         // degrees (0-360)
  bearingWidth?: number;    // cone width in degrees (e.g., 15-30°)
  sensorId: string;         // which sensor detected it
  
  // For 'detection' level - only sensor info
  // (sensorId is sufficient)
}
```

---

## Visualization Implementation

### 1. Location Level (existing behavior)
- Draw drone icon at lat/lon
- Show pulse rings, heading, trail
- No changes needed to `drawDrones.ts`

### 2. Direction Level - New canvas function

Create `src/components/canvas/drawDirectionWedge.ts`:

```ts
export function drawDirectionWedge(
  ctx: CanvasRenderingContext2D,
  sensorX: number,
  sensorY: number,
  bearing: number,          // center angle in degrees
  bearingWidth: number,     // ±degrees from center
  color: string,
  maxRange: number = 150    // pixels
): void {
  const startAngle = (bearing - bearingWidth / 2 - 90) * Math.PI / 180;
  const endAngle = (bearing + bearingWidth / 2 - 90) * Math.PI / 180;
  
  // Draw filled wedge with gradient
  const gradient = ctx.createRadialGradient(
    sensorX, sensorY, 0,
    sensorX, sensorY, maxRange
  );
  gradient.addColorStop(0, color + '40');   // 25% opacity at center
  gradient.addColorStop(1, color + '00');   // transparent at edge
  
  ctx.beginPath();
  ctx.moveTo(sensorX, sensorY);
  ctx.arc(sensorX, sensorY, maxRange, startAngle, endAngle);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();
  
  // Outline
  ctx.strokeStyle = color + '60';
  ctx.lineWidth = 1;
  ctx.stroke();
}
```

### 3. Detection Level - Sensor indicator rings

Modify `drawSensors.ts` to show colored dots around sensors with active detections:

```ts
// After drawing the sensor icon, add detection indicators
if (activeDetections.length > 0) {
  const angleStep = (Math.PI * 2) / activeDetections.length;
  activeDetections.forEach((det, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const indicatorX = sx + Math.cos(angle) * 20;
    const indicatorY = sy + Math.sin(angle) * 20;
    const color = DRONE_COLORS[det.colorIndex].color;
    
    // Pulsing colored dot
    ctx.beginPath();
    ctx.arc(indicatorX, indicatorY, 5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff40';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}
```

---

## Timeline/Replay View Updates

### In `HistoricalTimeline.tsx` and replay logic:

```ts
// When rendering detections at a timestamp:
detections.forEach(det => {
  switch (det.level) {
    case 'location':
      // Render as drone (existing logic)
      renderDrone(detectionToDrone(det, currentTs));
      break;
      
    case 'direction':
      // Render wedge from sensor
      const sensor = sensors.find(s => s.id === det.sensorId);
      if (sensor) {
        drawDirectionWedge(ctx, sensor.x, sensor.y, det.bearing!, det.bearingWidth!, color);
      }
      break;
      
    case 'detection':
      // Just highlight the sensor (handled in drawSensors)
      break;
  }
});
```

---

## Mock Data Generation

Update `generateMockEvents()` to randomly assign detection levels:

```ts
// Assign detection level with weighted probability
const levelRoll = Math.random();
const level: DetectionLevel = 
  levelRoll < 0.5 ? 'location' :    // 50% full location
  levelRoll < 0.8 ? 'direction' :   // 30% direction only
  'detection';                       // 20% detection only

// Generate appropriate data based on level
if (level === 'location') {
  // Generate full positionHistory (existing logic)
} else if (level === 'direction') {
  bearing = randInt(0, 360);
  bearingWidth = randInt(15, 45);  // wider = less certain
} 
// detection level needs no extra data
```

---

## UI Indicators in Event Tables

In `ReportEventsView.tsx`, add an icon/badge showing detection level:

| Icon | Level | Meaning |
|------|-------|---------|
| 📍 | Location | "Precise location tracked" |
| ➤ | Direction | "Direction detected" |
| 📡 | Detection | "Signal detected" |


Instaed of icons use Badges: "GEO", "DIR", "DETECT"

---

## ❓ Open Questions

1. **Site center** - Use existing `SITE_CENTER` from `droneUtils.ts`? Or different coordinates?
EXISTING

2. **Detection-level click behavior** - When clicking a detection indicator on a sensor, what should happen?
   YES -  Open DetailPanel?
   - Show tooltip/popover?
   - Something else?

3. **Direction wedge length** - How far should the wedge extend?
   - Fixed pixels - about 80px
   - To edge of canvas?
   - Proportional to canvas size?

4. **Badge placement in Events table** - Where to show "GEO"/"DIR"/"DETECT"?
   - New column?
   - Next to drone type?
   - Colored badge combo?

IN the expanded row, new column, just after the ID
- Also, in that table remove Started and Ended columns and show it in the duration tooltip.



---

## Implementation Order

1. [ ] Update `Detection` interface with `level` field
2. [ ] Update mock data generator to produce all three levels
3. [ ] Create `drawDirectionWedge.ts` canvas function
4. [ ] Modify `drawSensors.ts` to show detection indicators
5. [ ] Update replay controller to handle different levels
6. [ ] Add level badges to event list UI
7. [ ] Test timeline view with mixed detection levels







