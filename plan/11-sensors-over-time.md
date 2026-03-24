# Sensor Detections Over Time Tab

Add a new **"SENSORS"** tab to the right-side view panel in `ReportEventsView.tsx` that visualizes when each sensor (unit101-104) detected threats during the selected event.

---

## Questions

1. **Visualization style**: Should this be a timeline/Gantt-style chart (horizontal bars per sensor showing detection periods) or a line chart showing detection counts over time?
Gantt-style chart 

2. **Grouping**: Should detections be grouped by:
   - Sensor only (show when each sensor was active)?
   - Sensor + drone type (show which threat each sensor detected)?
   X Sensor + detection level (distinguish GEO/DIR/DETECT)?

   emphasize - gradual over time: DETECT, DIR, GEO



3. **Interactivity**: 
   - Should clicking a detection segment highlight that detection in the left table?
NO
   - Should hovering show a tooltip with detection details (drone type, frequencies)?
OK   


4. **Time synchronization**: Should the view sync with the playback controls (current timestamp indicator) like the other tabs?
YES

5. **Aggregation**: If the same sensor detects multiple drones simultaneously, should they stack, merge, or use color coding?
STACK

---

## Implementation Plan

### 1. Add ViewTab Type
Update the `ViewTab` type to include `'sensors'`:
```ts
type ViewTab = 'timeline' | 'tactical' | 'map' | 'frequency' | 'sensors';
```

### 2. Add Tab Button
Add to `viewTabs` array:
```ts
{ id: 'sensors', icon: '📡', label: 'SENSORS' }
```

### 3. Create SensorTimelineTab Component
New file: `src/components/SensorTimelineTab.tsx`

**Props:**
- `event: Event` - selected event with all detections
- `currentTs: number` - current playback timestamp
- `onSelectDetection?: (det: Detection) => void` - callback when user clicks a detection

**Features:**
- Horizontal timeline with event start→end range
- Y-axis: one row per sensor (unit101, unit102, unit103, unit104)
- X-axis: time range matching event duration
- Detection bars colored by drone type (using `DRONE_COLORS`)
- Current time indicator (vertical line) synced with playback
- Hover tooltips showing detection details

### 4. Data Transformation
Group detections by `sensorId`:
```ts
const detectionsBySensor = useMemo(() => {
  const map = new Map<string, Detection[]>();
  SENSORS_BASE.forEach(s => map.set(s.id, []));
  event.detections.forEach(det => {
    const list = map.get(det.sensorId) || [];
    list.push(det);
    map.set(det.sensorId, list);
  });
  return map;
}, [event]);
```

### 5. Rendering
Use Canvas or SVG for rendering detection bars:
- Each sensor row: 40px height
- Detection bars positioned based on `startedAt`/`endedAt` relative to event time range
- Overlapping detections: stack vertically within the row or use transparency

---

## File Changes

| File | Change |
|------|--------|
| `ReportEventsView.tsx` | Add 'sensors' to ViewTab type, add tab button, render SensorTimelineTab |
| `SensorTimelineTab.tsx` | New component (create) |
| `droneUtils.ts` | Export SENSORS_BASE if not already exported |

