# Coding Standards & Conventions

> Extracted from the live codebase. All examples are real code.

---

## 1. TypeScript Usage

**Compiler config** (`tsconfig.json`):
- `"strict": true` — full strict mode enabled
- `"noUnusedLocals": false`, `"noUnusedParameters": false` — unused identifiers are tolerated
- `"target": "ES2020"`, `"module": "ESNext"`, `"moduleResolution": "bundler"`

**Type-only imports** use the inline `type` keyword:
```ts
import { useState, useEffect, type MutableRefObject, type ReactElement } from 'react';
import { type Event, type Drone, eventToDrones } from '../utils/droneUtils';
```

**Explicit return types on all components and hooks:**
```ts
function App(): ReactElement { ... }
function DetailPanel({ ... }: DetailPanelProps): ReactElement | null { ... }
export function useReplayController(event: Event | null): ReplayController { ... }
```

**`interface` for object shapes; `type` for unions and aliases:**
```ts
// Interface for data models and props
export interface Drone { id: string; model: string; ... }
interface CanvasMapViewProps { dronesRef: MutableRefObject<Drone[]>; ... }

// Type for union literals
export type DetectionLevel = 'location' | 'direction' | 'detection';
type SortColumn = 'id' | 'startedAt' | 'endedAt' | 'duration' | 'threats';
type ViewTab = 'timeline' | 'tactical' | 'map' | 'frequency' | 'sensors' | 'mission';
export type PlaybackSpeed = 10 | 30 | 60;
```

**Generics used with state, refs, and collections:**
```ts
const [drones, setDrones] = useState<Drone[]>([]);
const [selected, setSelected] = useState<Drone | null>(null);
const canvasRef = useRef<HTMLCanvasElement>(null);
const trailsRef = useRef<Map<string, TrailPoint[]>>(new Map());
const sensorThreatCount = new Map<string, number>();
const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
```

**`as const` for readonly tuples/arrays:**
```ts
const nav = [
  { id: "", label: "HOME", icon: "⌂", iconStyle: { fontSize: 22 } },
  { id: "live", label: "LIVE", icon: "◉", iconStyle: {} },
] as const;
```

**Non-null assertion (`!`)** is used when the caller guarantees presence:
```ts
const nextChange = nextBearingChange.get(d.id)!;
```

**Optional chaining and nullish coalescing** preferred over explicit null checks in expressions:
```ts
const firstDetectionStart = event.detections.length > 0
  ? Math.min(...event.detections.map(d => d.startedAt))
  : event.startedAt;
const clampedTs = Math.max(startTs, Math.min(endTs, ts));
start = filters.customStart?.getTime() ?? now - 24 * 60 * 60 * 1000;
```

---

## 2. React Component Patterns

**All components are function components.** No class components anywhere.

**`React.FC<>` / `FC<>` is never used.** Return type is always an explicit `ReactElement` (or `ReactElement | null`):
```ts
// CORRECT
function Live(): ReactElement { ... }
function DetailPanel({ selected, dronesRef, onClose }: DetailPanelProps): ReactElement | null { ... }

// NEVER
const Live: React.FC<LiveProps> = () => { ... }
```

**Props are always typed via a named `interface`, never inline:**
```ts
interface CanvasMapViewProps {
  dronesRef: MutableRefObject<Drone[]>;
  selected: Drone | null;
  onSelect: (drone: Drone | null) => void;
  filterFn: (drone: Drone) => boolean;
  dims: { w: number; h: number };
  paused?: boolean;
}

export function CanvasMapView({
  dronesRef, selected, onSelect, filterFn, dims, paused = false
}: CanvasMapViewProps): ReactElement { ... }
```

**Props are always destructured in the function signature**, not accessed via a `props` parameter.

**Default prop values** are set via destructuring defaults:
```ts
export function CanvasMapView({
  paused = false,
  showHeadingIndicator = true
}: CanvasMapViewProps): ReactElement { ... }
```

**No prop spreading.** Props are always passed explicitly.

---

## 3. Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Component files | PascalCase `.tsx` | `CanvasMapView.tsx`, `DetailPanel.tsx` |
| Hook files | camelCase `.ts` | `useReplayController.ts`, `useMissionNarration.ts` |
| Utility files | camelCase `.ts` | `droneUtils.ts`, `missionReplay.ts` |
| Canvas draw files | camelCase `.ts` | `drawDrones.ts`, `drawSensors.ts` |
| Page files | PascalCase `.tsx` | `Live.tsx`, `Reports.tsx` |
| Components | PascalCase | `CanvasMapView`, `DetailPanel` |
| Hooks | `use` + PascalCase | `useReplayController`, `useMissionNarration` |
| Interfaces | PascalCase, no `I` prefix | `DroneColorConfig`, `CanvasMapViewProps` |
| Types (union/alias) | PascalCase | `DetectionLevel`, `SortColumn`, `PlaybackSpeed` |
| Constants | `UPPER_SNAKE_CASE` | `WINDOW_SEC`, `DRONE_MODELS`, `SENSORS_BASE`, `ACCESS_TOKEN` |
| Variables / params | camelCase | `dronesRef`, `currentTs`, `selectedDrone` |
| Prop callbacks | `on` prefix | `onSelect`, `onClose` |
| Handler functions | `handle` prefix | `handleSort`, `handleMove` |
| Internal callbacks | descriptive verb | `tick`, `render`, `draw`, `moveDrones`, `animate` |

---

## 4. State Management Patterns

**`useState`** for UI state and values that drive rendering.

**`useRef`** for:
- Values that update at animation/interval frequency without needing renders: `dronesRef`
- DOM element refs: `canvasRef`, `containerRef`
- Animation frame handles: `rafRef`, `lastFrameRef`
- Stale-closure prevention — props/state are synced into refs for use in animation loops:

```ts
const filterFnRef = useRef(filterFn);
filterFnRef.current = filterFn;          // updated every render, used inside rAF

const selectedRef = useRef(selected);
selectedRef.current = selected;
```

**`useMemo`** for derived data; always has explicit dependency array:
```ts
const timeRange = useMemo(() => getTimeRange(filters), [filters]);
const events = useMemo(() => generateMockEvents(timeRange), [timeRange.start, timeRange.end]);
const sortedEvents = useMemo(() => { ... }, [events, sortColumn, sortDir]);
```

**`useCallback`** for stable function references returned from hooks or passed to effects:
```ts
const play = useCallback(() => { ... }, [currentTs, endTs, event]);
const pause = useCallback(() => { setIsPlaying(false); }, []);
const seek = useCallback((progress: number) => { ... }, [startTs, duration]);
```

**Pattern: ref → state sync for high-frequency data with controlled render rate:**
```ts
// High-frequency mutation happens on the ref (in rAF)
dronesRef.current = [...];

// React state is synced at a slower rate via setInterval
useEffect(() => {
  const id = setInterval(() => setDrones([...dronesRef.current]), 300);
  return () => clearInterval(id);
}, []);
```

**Every `useEffect` that sets up a listener, interval, or rAF loop returns a cleanup function.**

---

## 5. Performance Patterns

**`requestAnimationFrame` for all animation loops** (canvas rendering, drone movement):
```ts
useEffect(() => {
  let raf: number;
  let isRunning = true;

  function draw(ts: number) {
    if (!isRunning) return;
    // ... draw ...
    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);
  return () => {
    isRunning = false;
    cancelAnimationFrame(raf);
  };
}, [dims]);
```

**Canvas resize only when dimensions actually change** (avoids expensive resets):
```ts
if (canvas.width !== w || canvas.height !== h) {
  canvas.width = w;
  canvas.height = h;
}
```

**`devicePixelRatio` handled in canvas views** for sharp rendering on retina screens:
```ts
const dpr = window.devicePixelRatio || 1;
canvas.width = width * dpr;
canvas.height = height * dpr;
canvas.style.width = `${width}px`;
canvas.style.height = `${height}px`;
ctx.scale(dpr, dpr);
```

**`ResizeObserver`** for reactive canvas sizing (not window resize events):
```ts
const observer = new ResizeObserver(entries => {
  const { width, height } = entries[0].contentRect;
  setDimensions({ width, height });
});
observer.observe(container);
return () => observer.disconnect();
```

**Timestamp delta capped** to prevent large jumps after tab blur:
```ts
const dt = lastTs ? Math.min(ts - lastTs, 100) : 16;
```

**Images preloaded at module level** (outside components), not inside render:
```ts
const droneImg = new Image();
droneImg.src = 'img/drone.svg';
let droneImgLoaded = false;
droneImg.onload = () => { droneImgLoaded = true; };
```

---

## 6. File Organization

```
src/
  pages/          # Route-level components (Live, Reports, Home, About)
  components/     # Reusable UI components
    canvas/       # Pure canvas drawing functions + barrel index.ts
  hooks/          # Custom React hooks (use*.ts)
  utils/          # Shared types, constants, pure utility functions
```

**Rules:**
- Pages are in `src/pages/`. They own route-level layout, data orchestration, and sub-routing.
- Reusable components are in `src/components/`. No business logic beyond their own presentation.
- Canvas drawing functions live in `src/components/canvas/` as pure TypeScript (not React). They are exposed via a barrel `index.ts`.
- Custom hooks in `src/hooks/` are purely behavioral — no JSX.
- `src/utils/` holds shared types (`Drone`, `Event`, `Detection`), constants (`DRONE_COLORS`, `SENSORS_BASE`), and pure functions (`rand`, `project`, `formatTime`, `spawnDrone`).
- Types and interfaces are defined and exported from the file where they are most closely related (e.g., `Drone` lives in `droneUtils.ts`, `MissionMoment` lives in `missionReplay.ts`).

---

## 7. Import Ordering and Style

Imports are grouped in this order, separated by a blank line:
1. React and framework imports
2. Third-party library imports (react-router-dom)
3. Internal components
4. Internal hooks
5. Internal utils / types
6. CSS

```ts
import { useState, useEffect, useRef, type MutableRefObject, type ReactElement } from 'react';
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import DroneRow from '../components/DroneRow';
import MapView from '../components/MapView';
import { useReplayController, type PlaybackSpeed } from '../hooks/useReplayController';
import { WINDOW_SEC, DRONE_MODELS, type Drone } from '../utils/droneUtils';
import './App.css';
```

**Type-only imports use the inline `type` keyword** (not a separate `import type` statement):
```ts
// CORRECT
import { useState, type ReactElement } from 'react';

// AVOID
import type { ReactElement } from 'react';
```

**No `import React from 'react'`** — the project uses the new JSX transform (`"jsx": "react-jsx"`).

---

## 8. Canvas Rendering Patterns

**Canvas drawing functions are pure TypeScript functions** — no React, no hooks, no state. They live in `src/components/canvas/`.

**Function signature convention:** `(ctx, w, h, ts, ...data)` where `ts` is the animation timestamp for time-based effects:
```ts
export function drawSensors(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  ts: number, dt: number,
  selectedDrone: Drone | null
): void
```

**Single-item and collection variants** are provided separately:
```ts
export function drawDrone(ctx, drone, w, h, ts, selected, hover): void { ... }
export function drawDrones(ctx, drones, w, h, ts, selected, hover): void {
  drones.forEach(drone => drawDrone(ctx, drone, w, h, ts, selected, hover));
}
```

**`ctx.save()` / `ctx.restore()`** wraps any transform or composite operation:
```ts
ctx.save();
ctx.translate(x, y);
ctx.rotate(rad + Math.PI / 2);
ctx.shadowColor = cfg.color;
ctx.shadowBlur = isSel ? 20 : 10;
ctx.drawImage(droneImg, -iconSize / 2, -iconSize / 2, iconSize, iconSize);
ctx.restore();
```

**`ctx.setLineDash([])` always reset** after drawing a dashed line:
```ts
ctx.setLineDash([3, 5]);
ctx.stroke();
ctx.setLineDash([]);
```

**Glow effects** via `ctx.shadowColor` + `ctx.shadowBlur` (reset via `ctx.restore()`).

**`ctx.globalAlpha`** for transparency on non-selected items; always reset to `1` after:
```ts
ctx.globalAlpha = selected && !isSel ? 0.1 : 1;
// ... draw ...
ctx.globalAlpha = 1;
```

**Pulse animation** uses `(ts / period) % 1` or `(ts / period) % 2` for 0→1 or 0→2 sawtooth:
```ts
const phase = (ts / 1000) % 2;
const progress = (phase + i * (2 / rings)) % 2;
const ringR = 10 + progress * 22;
```

**Barrel export** from `src/components/canvas/index.ts`:
```ts
export { drawDrone, drawDrones } from './drawDrones';
export { drawSensors } from './drawSensors';
export { drawTrails, updateTrails, type TrailPoint } from './drawTrails';
```

---

## 9. CSS / Styling Approach

**Inline styles are the primary styling mechanism** for all component-specific UI. No CSS Modules.

**Global CSS** (`App.css`, `index.css`) is used only for:
- CSS resets / base styles
- Layout classes for the app shell (`.app`, `.sidebar`, `.main`, `.nav-link`)
- CSS animations (`@keyframes blink`)

**Class names** follow `kebab-case`:
```tsx
<aside className={`sidebar ${sidebarExpanded ? 'expanded' : ''}`}>
<Link className={`nav-link ${path === n.id ? 'active' : ''}`}>
```

**Color palette** (used consistently throughout):
- Primary accent: `#00d4ff` (cyan)
- Secondary: `#7ecfff` (light blue)
- Muted text: `#8899aa`
- Bright text / values: `#e8eaf0`
- Background: `#000510`, `rgba(0,5,12,0.95)`
- Borders: `rgba(0,212,255,0.12)`, `rgba(0,212,255,0.08)`

**Typography:** `'Share Tech Mono', monospace` everywhere — applied inline per element, not via a CSS class.

**Inline styles use number literals for unitless properties and string literals for values with units:**
```tsx
style={{ fontSize: 11, letterSpacing: 2, padding: '10px 20px', borderRadius: 3 }}
```

---

## 10. Comment and Documentation Style

**No JSDoc.** Comments are plain `//` single-line or `/* */` block.

**Section headers** separate logical blocks within a file:
```ts
// ====== Events Report Types ======
```

**Effect blocks** are preceded by a short comment describing their purpose:
```ts
// Sync ref → state for React-driven UI
useEffect(() => { ... }, []);

// Clock display
useEffect(() => { ... }, []);

// Initialize drones
useEffect(() => { ... }, []);
```

**JSX comments** use `{/* ... */}`:
```tsx
{/* Header */}
{/* About link at bottom */}
{/* Expand/collapse toggle */}
```

**Inline comments** for non-obvious logic:
```ts
// Use log scale for better band visibility
// Keep history bounded (last 5 min at 250ms = 1200 samples max)
// Small delay to trigger CSS transition
```

**TODO/DEBUG comments** are left in place during development (`// DEBUG: ...`).

---

## 11. Error Handling Patterns

**Early returns** via guard clauses at the top of effects and render functions:
```ts
if (!canvas) { raf = requestAnimationFrame(draw); return; }
if (!ctx) { raf = requestAnimationFrame(draw); return; }
if (!displayedDrone) return null;
if (!selected) return;
```

**Initialization assertion** at the app boundary only:
```ts
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');
```

**No `try/catch`** in component or hook code. Errors propagate naturally.

**Graceful fallbacks** over hard failures in rendering:
```ts
// Fallback dot if image not loaded
if (droneImgLoaded) {
  ctx.drawImage(droneImg, ...);
} else {
  ctx.beginPath();
  ctx.arc(0, 0, iconSize / 3, 0, Math.PI * 2);
  ctx.fillStyle = cfg.color;
  ctx.fill();
}
```

---

## 12. Events and Callbacks

**Props callbacks are named with `on` prefix:**
```ts
interface CanvasMapViewProps {
  onSelect: (drone: Drone | null) => void;
}
interface DetailPanelProps {
  onClose: () => void;
}
```

**Internal handler functions use `handle` prefix:**
```ts
const handleSort = (col: SortColumn) => { ... };
const handleMove = (e: MouseEvent) => { ... };
const handleUp = () => setIsDragging(false);
```

**Short internal callbacks** use descriptive verb names without `handle`:
```ts
const tick = () => setClock(...);
function render() { ... }
function draw(ts: number) { ... }
function moveDrones(ts: number) { ... }
const animate = (frameTs: number) => { ... };
```

**Event listener types** use DOM types directly (not React synthetic events):
```ts
window.addEventListener('mousemove', handleMove);   // handleMove: (e: MouseEvent) => void
window.addEventListener('mouseup', handleUp);
```

**Inline event handlers** for simple state toggles — not extracted to named functions:
```tsx
<button onClick={() => setSidebarExpanded(!sidebarExpanded)}>
<button onClick={() => setRunning(r => !r)}>
```

---

## 13. Export Patterns

**Pages:** default export, declared as named function:
```ts
function Live(): ReactElement { ... }
export default Live;

// OR combined:
export default function Reports(): ReactElement { ... }
```

**Components:** mix of named and default — named preferred for components imported alongside others from the same directory; default for larger self-contained views:
```ts
// Named export (CanvasMapView, TrailToggleButton, DroneTooltip, HistoricalTimeline, etc.)
export function CanvasMapView({ ... }: CanvasMapViewProps): ReactElement { ... }

// Default export (FrequencyView, ReportEventsView, ReportSummaryView)
export default function FrequencyView({ ... }: FrequencyViewProps): ReactElement { ... }
```

**Hooks:** always named exports:
```ts
export function useReplayController(event: Event | null): ReplayController { ... }
export function useMissionNarration({ ... }: MissionNarrationOptions): MissionNarrationState { ... }
```

**Utils:** all named exports — types, interfaces, constants, and functions together:
```ts
export interface Drone { ... }
export type DetectionLevel = 'location' | 'direction' | 'detection';
export const DRONE_COLORS: DroneColorConfig[] = [...];
export const SENSORS_BASE: Sensor[] = [...];
export function rand(a: number, b: number): number { ... }
export function spawnDrone(detectAt: number): Drone { ... }
```

**Re-exports** via barrel `index.ts` only in `src/components/canvas/`.

---

## 14. Anti-Patterns Deliberately Avoided

- **No `React.FC<>` or `FC<>`** — return types are always explicit `ReactElement`.
- **No `import React from 'react'`** — new JSX transform is used.
- **No class components.**
- **No prop spreading (`{...props}`).**
- **No `any` type** in authored code.
- **No index barrel files for pages or components** — only for the `canvas/` subdirectory.
- **Refs are intentionally mutated** (`dronesRef.current[i].lat = ...`) — this is the deliberate pattern for high-frequency simulation data that must not trigger React re-renders.
- **No window-level resize listeners** — `ResizeObserver` is used instead.
- **Stale closure bugs avoided** by syncing props/state into refs before animation loops:
  ```ts
  const filterFnRef = useRef(filterFn);
  filterFnRef.current = filterFn;  // Updated every render, read inside rAF
  ```
