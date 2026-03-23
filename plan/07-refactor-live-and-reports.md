
# Plan: Refactor Live Views for Reports Reuse

**This is a Major refactor**

## Goal

Reuse the Live views (Timeline, Tactical Canvas, Google Map) in the Reports section to simulate/replay selected events from the Events table.

---

## Current Architecture

**Live Page** (`/live`) has 3 views:
- **Timeline** - DroneRow components showing horizontal timeline bars
- **Tactical** - CanvasMapView (canvas-based tactical map)
- **Map** - GoogleMapView (satellite imagery)

All views currently consume `dronesRef: MutableRefObject<Drone[]>` with live-updating data.

**Reports Events** (`/reports/events`) currently has:
- Basic split view with table + simple canvas map
- Its own mock event data generator
- Timeline scrubber for event replay

---

## Proposed Architecture

### Approach Options

> ❓ **Q1**: Which abstraction approach?
>   - A) Create a `DroneDataSource` interface (live vs historical provider)
>   - B) Make components accept both `dronesRef` OR `drones[]` array prop
>   - C) Create wrapper components that adapt data format
>   - D) Other?
A

> ❓ **Q2**: How to handle time in replay mode?
>   - A) Timeline scrubber controls a "virtual now" timestamp
>   - B) Pre-compute drone positions for each frame
>   - C) Interpolate positions between detection samples
>   - D) Other?
A
---

## Timeline View Reuse

The Timeline view currently shows:
- DroneRow components with time-based bars
- 5-minute sliding window
- NOW marker at the right edge

For event replay:
> ❓ **Q3**: How should Timeline behave in replay mode?
>   - A) Show event's full duration (no sliding window)
>   - B) Keep 5-min window, scrubbed by timeline position
>   - C) Make window configurable?
A

> ❓ **Q4**: Should expanded row (DetectionPanel/FrequencyView) be available?
>   - YES/NO
YES

---

## Map Views Reuse (Tactical + Google)

Current MapView props:
```ts
interface MapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  mode: 'canvas' | 'google';
}
```

> ❓ **Q5**: Should both Tactical and Google Map be available in Reports?
>   - YES (both)
>   - TACTICAL only
>   - GOOGLE only
YES

> ❓ **Q6**: Should trails be available in replay mode?
>   - YES
>   - NO (snapshot positions only)
YES

> ❓ **Q7**: Should sensor coverage visualization be shown?
>   - YES
>   - NO
YES

---

## Integration into Events Report

> ❓ **Q8**: Should the Event detail view be a modal, slide-out panel, or full-page takeover?
>   - MODAL
>   - SLIDE-OUT (current DetailPanel style)
>   - FULL-PAGE (replace table with event viewer)
ITS SHOULD GO IN THE SPLIT VIEW

> ❓ **Q9**: Should there be view tabs (Timeline/Tactical/Map) in the event detail?
>   - YES (like Live page)
>   - NO (just one view)
YES, IN THE SPLIT VIEW, SHOW TABS

> ❓ **Q10**: Keep existing ReportEventsView simple map, or replace entirely?
>   - KEEP (as quick preview)
>   - REPLACE (use full reusable views)
REPLACE

---

## Data Mapping

Event/Detection → Drone conversion needed:

```ts
// Current Event structure
interface Detection {
  id: string;
  droneId: string;
  droneType: string;
  severity: SeverityLevel;
  startedAt: number;
  endedAt: number;
  frequencies: number[];
  lat: number;
  lon: number;
}

// Need to create compatible Drone objects
// with position history for replay
```

> ❓ **Q11**: Should Detection store position history for smooth replay?
>   - YES (add `positionHistory: {ts, lat, lon}[]`)
>   - NO (just start/end positions, interpolate)
YES


> ❓ **Q12**: How much historical data should be simulated per detection?
>   - Full trajectory (one position per second)
>   - Sparse samples (every 5-10 seconds)
>   - Just start/end snap

---

## Follow-up Questions

> ❓ **Q13**: When no event is selected, what shows in the right split pane?
>   - A) Empty state with "Select an event" message
>   - B) Summary statistics/chart
>   - C) Last selected event
Select the first event


> ❓ **Q14**: Playback controls - what's needed beyond the scrubber?
>   - A) Just scrubber (drag to seek)
>   - B) Play/Pause + scrubber
>   - C) Play/Pause + speed control (1x, 2x, 4x) + scrubber
Option C

> ❓ **Q15**: Should selecting a drone in the map/timeline sync with table row highlighting?
>   - YES
>   - NO
NO



---
Full trajectory

## Implementation Phases

### Phase 1: Abstract Data Source ✅
1. [x] Create shared data interface (detectionToDrone, eventToDrones in droneUtils.ts)
2. [x] Refactor MapView to accept both live and static data (StaticMapView.tsx wrapper)
3. [x] Refactor DroneRow/Timeline for both modes (HistoricalTimeline.tsx)

### Phase 2: Event Replay Engine ✅
4. [x] Add position history to Detection model (positionHistory: PositionSample[])
5. [x] Create replay controller (play/pause/seek) (useReplayController.ts hook)
6. [x] Generate smooth drone positions from history (interpolation in detectionToDrone)

### Phase 3: Integration ✅
7. [x] Add view tabs to Events detail (Timeline/Tactical/Map tabs)
8. [x] Wire up Timeline, Tactical, Map views (via StaticMapView + HistoricalTimeline)
9. [x] Connect scrubber to replay engine (Play/Pause + 1x/2x/4x speed control)

### Phase 4: Polish
10. [ ] Smooth transitions between events
11. [ ] Sync selections across views
12. [ ] Performance optimization

---

## Files to Modify

- [Live.tsx](../src/pages/Live.tsx) - Extract view logic
- [MapView.tsx](../src/components/MapView.tsx) - Accept static data
- [CanvasMapView.tsx](../src/components/CanvasMapView.tsx) - Support replay mode
- [GoogleMapView.tsx](../src/components/GoogleMapView.tsx) - Support replay mode  
- [DroneRow.tsx](../src/components/DroneRow.tsx) - Support historical mode
- [ReportEventsView.tsx](../src/components/ReportEventsView.tsx) - Add tabbed views
- [droneUtils.ts](../src/utils/droneUtils.ts) - Detection position history


