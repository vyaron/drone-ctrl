# Drone Footage Split View from Threat Details

**Status:** draft  
**Owner:**  
**Last updated:** 2026-05-19

---

## Goal

Add a button in the Live threat-details sidebar that opens a focused side-by-side view:

- left side: map showing only the selected drone path
- right side: camera footage from `/footage/101.mp4`

This should feel like a tactical analysis mode that is quick to open from the selected drone details.

---

## Demo Outcome

When an operator selects a drone in Live view and opens its details panel:

1. A new action button appears in the sidebar.
2. Clicking it opens a side-by-side map and footage view.
3. The map shows only that drone and its path history.
4. The video panel plays the fixed footage file (`/footage/101.mp4`).
5. Closing the split view returns the operator to the current Live screen state.

---

## Scope

### In scope

- New action button in threat-details sidebar
- Side-by-side split view UI for map and video
- Selected-drone-only path rendering
- Integration with existing Live page selection flow
- Responsive layout behavior for narrow screens

### Out of scope

- Reports page integration
- Multiple video files or dynamic video selection
- Backend/API changes
- Persisting split-view sessions
- Recording/exporting playback

---

## Product Behavior

### Entry and exit

- Button appears in drone details panel when a drone is selected.
- Clicking opens split view as an overlay/panel above Live content.
- Split view can be closed by close button.
- If selected drone is no longer active, split view should close gracefully or show a clear fallback state.

### Map behavior

- Render only the selected drone context.
- Display the path using sampled history points.
- Path should continue updating while view is open.
- No unrelated drones should be visible.

### Video behavior

- Source is fixed to `/footage/101.mp4`.
- Use native HTML5 controls.
- Autoplay and loop are enabled by default.
- Video should be `muted` on load so autoplay works reliably in modern browsers.
- Show fallback text if media load fails.

### Sync behavior (map <-> footage)

- The video timeline is the source of truth for playback timing.
- Map path position should be derived from `video.currentTime` (not wall-clock only).
- On play/pause/seek, map state should update immediately to the matching timeline point.
- On loop restart, map path should reset to the same loop start point.
- Keep drift low enough that map and footage appear visually synchronized during normal playback.

### Layout behavior

- Split view opens as a centered overlay panel.
- Desktop: side-by-side panes.
- Narrow screens: stacked panes with map first and video second.

---

## Proposed Architecture

### 1. Live-page orchestration

Keep view state and selected-drone handoff in `Live.tsx`:

- `isFootageViewOpen`
- `footageDroneId` (or selected drone snapshot)
- tracked drone history map keyed by `drone.id`

`Live.tsx` remains the single place coordinating selected drone, map, and details panel behavior.

### 2. Split view component

Create `DroneFootageSplitView.tsx`:

- map pane (selected drone only)
- footage pane (`/footage/101.mp4`)
- centered overlay shell
- close action
- responsive CSS for desktop and mobile

### 3. Path rendering extension

Extend static map path support so trails can be driven from external path history rather than only internal, transient trail buffers.

Use a fixed 90-second path window for stable performance and consistent visual density.

Pass optional external path points through:

- `StaticMapView.tsx`
- `CanvasMapView.tsx`
- trail drawing helper(s)

---

## Implementation Plan

### Phase 1. Add action entry in detail panel

1. Update detail panel props to accept `onOpenFootageView(drone)` callback.
2. Add a new sidebar button under current drone stats.
3. Guard button behavior when no valid displayed drone is present.

Deliverable:

- Threat-details panel can trigger footage split view for current drone.

### Phase 2. Track selected drone history in Live

1. Add a bounded per-drone history store in `Live.tsx`.
2. Sample positions from existing movement updates.
3. Keep only last 90 seconds of points (windowed for performance and clean visuals).

Deliverable:

- Stable path history available by drone id, independent of map internals.

### Phase 3. Build split-view component

1. Create `DroneFootageSplitView.tsx`.
2. Add two-pane desktop layout and stacked mobile layout.
3. Add close button and panel title context.

Deliverable:

- Reusable split-view shell for map + footage.

### Phase 4. Wire map/video content

1. Render map pane with only selected drone data and external path points.
2. Render `<video>` pane with source `/footage/101.mp4`, autoplay, loop, and muted defaults.
3. Drive map progression from `video.currentTime` and handle play/pause/seek/loop sync events.
4. Add graceful empty/error states.

Deliverable:

- End-to-end side-by-side analysis view.

### Phase 5. Integrate and harden flow

1. Wire open/close state in `Live.tsx`.
2. Auto-close or fallback when drone disappears.
3. Ensure existing DetailPanel close/select behavior remains unchanged.

Deliverable:

- Production-ready interaction flow with no regressions in core Live UX.

---

## Candidate File Changes

| File | Change |
|------|--------|
| `src/components/DetailPanel.tsx` | Add open-footage action button and callback prop |
| `src/pages/Live.tsx` | Manage split-view state and selected drone path history |
| `src/components/DroneFootageSplitView.tsx` | New map + video side-by-side UI component |
| `src/components/StaticMapView.tsx` | Accept and pass optional external path data |
| `src/components/CanvasMapView.tsx` | Render selected-drone-only path from external points |
| `src/components/canvas/drawTrails.ts` | Reuse/extend drawing utility for explicit path arrays |

---

## Verification

1. Select a drone in Live, open detail panel, click new button, verify split view opens.
2. Confirm map shows only selected drone path.
3. Confirm footage loads from `/footage/101.mp4`, autoplays, loops, and controls work.
4. Confirm graceful behavior if selected drone exits while split view is open.
5. Confirm map position responds correctly to video play/pause/seek and loop reset.
6. Confirm no regressions in existing detail panel and Live map selection behavior.

---

## Finalized Decisions

1. Path history window is last 90 seconds to keep it visually clean and performant.
2. Split view uses a centered overlay panel.
3. Video behavior is autoplay + loop (with muted default for browser compatibility).
4. Map and footage must stay synchronized using video time as the playback reference.

---

## Assumptions

- “Threat-details sidebar” refers to `DetailPanel` in the Live page.
- Current map components are the correct rendering path for this feature.
- The footage file is available at `public/footage/101.mp4` and served as `/footage/101.mp4`.

