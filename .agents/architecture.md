# Architecture: R2 Drone Detection Dashboard

## Purpose / Domain

A **counter-drone situational awareness platform** — a military/security-grade React/TypeScript SPA that tracks UAVs detected by a network of RF sensors in real time. The geographic area is centered around lat 31.35–31.85 / lon 35.15–35.65 (Israel/West Bank region). Three modes: live dashboard, historical reports browser, and mission replay with narrated playback.

**Stack:** React 19, TypeScript, Vite 8, React Router 7. No external state management library. All data is procedurally generated client-side (no backend API).

---

## Routing

Uses React Router v6 (`BrowserRouter`). `App.tsx` enforces a simple **token-gate**: checks `localStorage` for key `R2-D2` (or `?access=R2-D2` URL param).

```
/                    → Home
/live                → Live (redirects to /live/timeline)
/live/timeline       → Drone list + HistoricalTimeline
/live/map            → MapView (canvas or Google Maps)
/live/frequency      → FrequencyView (RF spectrum waterfall)
/reports             → Reports (redirects to /reports/events)
/reports/events      → ReportEventsView
/reports/summary     → ReportSummaryView
/about               → About (static)
```

---

## Pages (`src/pages/`)

| Page | Route | Role |
|------|-------|------|
| `Home.tsx` | `/` | Dashboard overview: live KPI tiles, animated sensor health grid with per-unit latency. All simulated via `setInterval`. |
| `Live.tsx` | `/live/*` | Master drone simulation loop: spawns drones, animates with physics (velocity/acceleration toward random target), mutates `dronesRef` at 60fps via `requestAnimationFrame`, syncs to React state every 300ms. |
| `Reports.tsx` | `/reports/*` | Historical event browser. Owns date range filter state (`1d`, `7d`, `14d`, `custom`), computes `{ start, end }` timestamps passed to child views. |
| `About.tsx` | `/about` | Static informational page. |

---

## Components (`src/components/`)

### Map / Canvas

**`MapView.tsx`** — Thin responsive wrapper. Uses `ResizeObserver` to measure container and passes `{ w, h }` dims to `CanvasMapView` or `GoogleMapView` based on `mode` prop (`'canvas'` default).

**`CanvasMapView.tsx`** — Primary map renderer. Props:
```ts
{ dronesRef, selected, onSelect, filterFn, dims, paused?, detectionsRef?, currentTs?, showHeadingIndicator? }
```
Runs a `requestAnimationFrame` draw loop calling all canvas modules in order. Maintains `trailsRef` (Map of drone ID → `TrailPoint[]`), `wedgeHitAreasRef`, and `detectionHitAreasRef` for pointer hit-testing. Renders `DroneTooltip` as a React overlay on hover.

**`GoogleMapView.tsx`** — Alternative renderer using Google Maps JS API. Loads the API script dynamically. Uses custom `OverlayView` subclasses (`DroneOverlay`, `SensorOverlay`) for drone/sensor markers managed by `useDroneMarkers` and `useSensorMarkers` hooks.

**`StaticMapView.tsx`** — Non-animated canvas map for reports replay (renders a single frame from a `Detection[]` snapshot).

### Live Data

**`DetailPanel.tsx`** — Slide-in right panel (CSS transition). Shows flight data, RF signal, frequency band, detection level badge (`GEO`/`DIR`/`DETECT`), altitude, speed, heading for a selected `Drone`. Polls `dronesRef` every 100ms for live updates.

**`DroneRow.tsx`** — Single row in the live drone list. Shows color swatch, model, detection level badge, elapsed time, sensor count, frequency.

**`FrequencyView.tsx`** — Full-canvas RF spectrum waterfall. Renders `100–6000 MHz` log-scale Y axis vs. 5-minute scrolling time window on X. Three render modes: `dots`, `lines`, `heatmap`. Draws `FREQ_BANDS` as colored background zones.

### Reports / Replay

**`ReportEventsView.tsx`** — Main reports panel (left: event table, right: multi-tab detail). Generates events via `generateMockEvents(timeRange)` (memoized). Integrates `useReplayController` and `useMissionNarration`. Right panel tabs: `timeline`, `tactical`, `map`, `frequency`, `sensors`, `mission`. Supports drag-resize split pane.

**`ReportSummaryView.tsx`** — Aggregated statistics: total events/detections, detection level distribution, manufacturer breakdown, frequency band distribution, per-sensor activity, 24h hourly histogram. Rendered as bar charts and SVG sparkline.

**`HistoricalTimeline.tsx`** — Horizontal Gantt-style timeline. One row per `Detection`, colored duration bars, scrubbing cursor at `currentTs`, `MissionMoment` tick marks. Props: `{ event, drones, currentTs, selected, onSelect, missionMoments?, activeMomentId? }`.

**`SensorTimelineTab.tsx`** — Canvas chart of each sensor's detections as stacked horizontal bars, color-coded by `DetectionLevel` (`DETECT`=gray, `DIR`=yellow, `GEO`=cyan).

**`FrequencyTab.tsx`** — Wrapper tab around `FrequencyView` for the reports detail panel.

**`MissionNarrationPanel.tsx`** — Displays active `MissionMoment` (large card) and queue of `recentMoments`. Includes TTS toggle.

### Misc

**`DroneTooltip.tsx`** — Absolute-positioned tooltip showing drone model + detection level on canvas hover.

**`TrailToggleButton.tsx`** — Simple toggle button for the canvas trail overlay.

---

## Hooks (`src/hooks/`)

**`useReplayController.ts`** — Controls scrubbing/playback of a historical `Event`.
```ts
// State exposed:
{ isPlaying, speed: 10|30|60, currentTs, progress: 0–1, drones: Drone[] }
// Methods:
play(), pause(), togglePlay(), seek(0–1), seekToTime(ts)
```
Uses `requestAnimationFrame`. Each frame advances `currentTs` by `delta * speed` (real ms × playback multiplier). Calls `eventToDrones(event, currentTs)` to derive the `Drone[]` snapshot.

**`useMissionNarration.ts`** — Consumes `MissionMoment[]` and `currentTs`. Tracks spoken moments via `spokenMomentIdsRef: Set<string>`. Fires `SpeechSynthesisUtterance` for newly crossed moments. Resets on backward seek.
```ts
// Returns:
{ activeMoment: MissionMoment | null, recentMoments: MissionMoment[] }
```

---

## Utils (`src/utils/`)

### `droneUtils.ts` — Core data model and simulation engine

**Constants:**
- `DRONE_COLORS` — 10 palette entries with `{ bg, border, text }`
- `FREQ_BANDS` — 6 RF bands (e.g. `ISM-2.4`, `5.8GHz`, `LTE`, etc.)
- `DRONE_MODELS` — 16 model names
- `SENSORS_BASE` — 4 fixed sensor units (unit101 patrols, others static)
- `WINDOW_SEC = 300`

**Simulation functions:**
- `spawnDrone(detectAt)` — creates a `Drone` with random model, geo position, frequency, detection level (50% location / 30% direction / 20% detection), velocity
- `addFreqSample(drone, ts)` — appends a `FreqSample` with frequency hopping simulation
- `tickSensors(dt)` — moves the patrolling sensor (unit101)

**Geo utilities:**
- `project(lat, lon, w, h)` — linear projection to canvas pixels
- `rand`, `randInt`, `pick`, `formatTime`

**Report data generators:**
- `generateMockEvents(timeRange)` — one deterministic demo event (detection→direction→location progression) plus random events
- `eventToDrones(event, ts)` — derives current `Drone[]` from `Detection[]` at a given replay timestamp

### `missionReplay.ts` — Derives `MissionMoment[]` from an `Event`

Rule-based analysis:
- First detection → `sensor-detect` moment
- Strongest RF sample → `frequency-spike` moment
- Multi-sensor confirmation → `multi-sensor-confirmation` moment
- First direction/location upgrade detection
- Heading changes ≥35° delta → course-change moment
- Closest approach to `SITE_CENTER` → approach moment
- Bookend `replay-start` and `replay-summary` moments

---

## Canvas Drawing Modules (`src/components/canvas/`)

All modules accept `(ctx, w, h, ...)` and use `project()` for coordinate mapping.

| Module | Draws |
|--------|-------|
| `drawGrid.ts` | Dark background, cyan dot grid, axis labels, animated scan sweep line |
| `drawProtectedZone.ts` | Red-orange dashed ellipse at `SITE_CENTER` (guarded area) |
| `drawSensors.ts` | Sensor icons, pulsing rings, range circles, patrol arrows; highlights sensors detecting selected drone with gold + dashed lines to drone |
| `drawDrones.ts` | Animated pulse rings (count = sensor detections), rotated icon, text label; dims non-selected drones to 10% alpha |
| `drawTrails.ts` | Per-drone `TrailPoint[]` history; fading gradient polylines |
| `drawDirectionWedge.ts` | Bearing cone from `SITE_CENTER` for `direction`-level detections; returns `WedgeHitArea` for click detection |
| `drawDetectionIndicators.ts` | Sensor-proximity circles for `detection`-level tracks |

---

## Google Maps Integration (`src/components/google/`)

| Module | Role |
|--------|------|
| `DroneOverlay.ts` | Factory (`getDroneOverlayClass()`) returning a `google.maps.OverlayView` subclass. Renders inline SVG with animated CSS pulse rings. Has `update()` for live changes. |
| `SensorOverlay.ts` | Same pattern for sensor markers at fixed GPS coords. |
| `useDroneMarkers.ts` | Reconciles live `Drone[]` against `Map<id, DroneOverlayInstance>`, creating/updating/removing overlays. |
| `useSensorMarkers.ts` | Same for sensor overlays (static set, only updates highlight state). |

---

## State Management

No global store (no Redux, Zustand, or Context). All state is local with props/refs.

### Live page — performance-critical pattern
```ts
dronesRef: MutableRefObject<Drone[]>  // mutated directly in rAF at 60fps
setDrones([...dronesRef.current])     // syncs to React state every 300ms
```

### Reports page
```ts
events = useMemo(() => generateMockEvents(timeRange), [timeRange])
selectedEvent   // component-level state in ReportEventsView
replay          // = useReplayController(selectedEvent)
missionMoments  // = useMemo(() => deriveMissionMoments(selectedEvent), [selectedEvent])
```

### Home page
Pure `useState` + `setInterval` for simulated metrics.

---

## Key Types

```ts
interface Drone {
  id: string; model: string; colorIndex: number;
  status: 'active' | 'left';
  detectedMs: number; durationMs: number;
  lat: number; lon: number;
  targetLat: number; targetLon: number;
  vLat: number; vLon: number;          // physics velocity
  heading: number; altitude: number; speed: number; spd: number;
  rfSig: number;                        // dBm signal strength
  detectedBy: string[];                // sensor IDs
  freqHistory: FreqSample[];
  currentFreq: number; freqBand: keyof typeof FREQ_BANDS;
  level?: 'location' | 'direction' | 'detection';
  bearing?: number; bearingWidth?: number;  // direction-level only
  sensorId?: string;                        // detection-level only
}

interface FreqSample { ts: number; freq: number; strength: number; }

interface Sensor { id: string; lat: number; lon: number; patrol: boolean; vLat: number; vLon: number; patrolLat: number; }

// Historical detection record
interface Detection {
  id: string; droneId: string; droneType: string; colorIndex: number;
  startedAt: number; endedAt: number;
  frequencies: number[]; freqHistory: FreqSample[]; freqBand: ...;
  level: DetectionLevel; sensorId: string;
  lat?: number; lon?: number; positionHistory?: PositionSample[];  // location-level
  bearing?: number; bearingWidth?: number;                          // direction-level
}

// A security incident grouping multiple detections
interface Event { id: string; startedAt: number; endedAt: number; detections: Detection[]; }

// Replay narration beat
interface MissionMoment {
  id: string; ts: number; type: MissionMomentType;
  title: string; narration: string; priority: 'low' | 'medium' | 'high';
  relatedDroneId?: string; relatedSensorIds?: string[];
}

type DetectionLevel = 'location' | 'direction' | 'detection';
```

---

## Plan Files (`plan/`)

Feature planning documents for completed and in-progress work:
- `05-freq-view.md` — FrequencyView waterfall
- `06-report-events.md` — ReportEventsView
- `07-refactor-live-and-reports.md` — Live/Reports refactor
- `08-changes.md` — Misc changes
- `09-detection-level.md` — Detection level system
- `10-remove-width-from-ui.md` — UI width cleanup
- `11-sensors-over-time.md` — SensorTimelineTab
- `12-adding-data.md` — Data enrichment
- `13-mission-replay.md` — Mission replay + narration
