# Mission Replay with Speech Narration

**Status:** draft  
**Owner:**  
**Last updated:** 2026-05-11

---

## Goal

Add a demo-grade **Mission Replay** mode that reconstructs an incident over time across the map, timeline, frequency activity, and event stream, while using the browser **Speech Synthesis** API to narrate the story out loud.

The feature should feel like an intelligent mission briefing rather than a simple playback control.

---

## Demo Outcome

When a user opens a report event and clicks **Replay Mission**:

1. Playback starts from the beginning of the selected event.
2. Drones, trails, sensor detections, and frequency activity animate in sync.
3. A narration panel displays short incident updates.
4. The browser speaks those updates using `window.speechSynthesis`.
5. Key moments are highlighted automatically, such as:
	 - first detection
	 - heading change toward protected zone
	 - multi-sensor confirmation
	 - closest approach
	 - event end summary

---

## Scope

### In scope

- Replay controls for a selected report event
- Central replay clock that drives all replay-aware views
- Derived incident moments built from existing event data
- On-screen narration feed
- Spoken narration using the Web Speech API
- Key moment markers on the timeline
- Simple summary at the end of replay

### Out of scope

- Backend AI or LLM integration
- Server-side voice generation
- Persisting narration scripts to the database
- Multi-language support
- Export to video or audio file

---

## Product Behavior

### Replay controls

Add a replay control bar with:

- play / pause
- restart
- skip to previous / next key moment
- speed selector (`1x`, `2x`, `4x`)
- scrubber tied to event duration
- mute narration toggle

### Narration behavior

Narration should be built from structured event moments, not freeform text generation.

Example lines:

- "Mission replay started. Tracking incident activity from first detection."
- "Sensor unit 101 detected activity at 2.4 gigahertz."
- "Drone Bravo changed course toward the protected zone."
- "Detection confidence increased after confirmation from three sensors."
- "Closest approach recorded near the protected boundary."
- "Replay complete. One high priority drone was tracked across the incident window."

### Speech synthesis behavior

Use the browser speech synthesizer:

- `window.speechSynthesis`
- `SpeechSynthesisUtterance`

Requirements:

- Speech must stay synchronized with replay time, not wall-clock time.
- Only speak key moments, not every frame update.
- If the user scrubs, cancel queued speech and resume from the new timestamp.
- If autoplay is blocked, allow narration after the first user interaction.
- If no preferred voice is available, fall back to the default system voice.
- Speech can be muted independently of visual narration.

---

## Proposed Architecture

### 1. Replay state

Create a replay controller that owns:

- selected event id
- replay status (`idle`, `playing`, `paused`, `ended`)
- current timestamp
- playback speed
- derived duration
- highlighted key moment id
- narration enabled / muted state

This should extend the current playback approach instead of introducing a second timing system.

### 2. Derived mission moments

Build a pure transformation layer that converts report event data into normalized replay moments.

Suggested shape:

```ts
type MissionMoment = {
	id: string;
	ts: number;
	type:
		| 'replay-start'
		| 'sensor-detect'
		| 'frequency-spike'
		| 'heading-change'
		| 'zone-risk'
		| 'multi-sensor-confirmation'
		| 'closest-approach'
		| 'replay-summary';
	title: string;
	narration: string;
	priority: 'low' | 'medium' | 'high';
	relatedDroneId?: string;
	relatedSensorIds?: string[];
};
```

These moments drive:

- spoken narration
- timeline markers
- event feed cards
- automatic focus state

### 3. Narration engine

Create a small narration coordinator that:

- watches replay time
- emits each moment once per run
- queues a `SpeechSynthesisUtterance` for eligible moments
- cancels speech on pause, restart, scrub, or replay end

This should remain deterministic and fully client-side.

### 4. UI surfaces

The replay should update these surfaces from the same clock:

- map view
- drone trails
- sensor timeline / tactical indicators
- frequency panel
- narration panel
- event summary strip

---

## Implementation Plan

### Phase 1. Build replay data model

1. Identify the selected event data structure used by the reports flow.
2. Define `MissionMoment` and helper functions to derive moments from existing detections, sensor participation, and frequency changes.
3. Add key-moment classification rules with simple thresholds and deterministic text templates.

Deliverable:

- A reusable `deriveMissionMoments(event)` utility with stable output.

### Phase 2. Extend the replay controller

1. Reuse or extend the existing replay timing hook so the replay can drive reports mode.
2. Add navigation helpers for jumping between mission moments.
3. Keep the current timestamp as the single source of truth for all replay-aware components.

Deliverable:

- Shared replay state for map, timeline, and narration.

### Phase 3. Add speech narration

1. Create a hook such as `useMissionNarration`.
2. Initialize and manage speech synthesis voices.
3. Speak only mission moments that cross the current replay timestamp.
4. Cancel and re-seed narration when the user scrubs or restarts.
5. Add a mute toggle and basic voice/rate configuration if needed for demo polish.

Deliverable:

- Reliable spoken narration synchronized to replay state.

### Phase 4. Add the replay UI

1. Add a replay header or control bar to the report event experience.
2. Add a narration panel showing the active and recent moments.
3. Add mission markers to the timeline.
4. Highlight the active drone or sensor when a high-priority moment is spoken.

Deliverable:

- A visible mission-replay mode that feels coordinated and intentional.

### Phase 5. Add end-state summary

1. When replay ends, show a short summary card.
2. Summarize the main drone, sensor count, highest-risk moment, and duration.
3. Allow replay restart from the summary state.

Deliverable:

- A polished end to the story, suitable for demo narration.

---

## Candidate File Changes

| File | Change |
|------|--------|
| `src/components/ReportEventsView.tsx` | Add Mission Replay entry point, replay controls, narration panel integration |
| `src/hooks/useReplayController.ts` | Extend or adapt replay state for reports event playback |
| `src/components/HistoricalTimeline.tsx` | Add key-moment markers and active mission indicator |
| `src/components/FrequencyView.tsx` | Sync display with replay timestamp if not already synchronized |
| `src/components/DetailPanel.tsx` | Surface active mission moment summary if this is the best local container |
| `src/utils/missionReplay.ts` | New utility for deriving normalized mission moments |
| `src/hooks/useMissionNarration.ts` | New hook for speech synthesis orchestration |
| `src/components/MissionNarrationPanel.tsx` | New UI component for visible story feed |

---

## Key Rules for Story Generation

Use deterministic rules so the demo is stable.

Examples:

- `sensor-detect`: first time a sensor participates in a detection for the event
- `frequency-spike`: first time a frequency band becomes active or changes sharply
- `heading-change`: drone heading delta exceeds a threshold within a short window
- `zone-risk`: drone enters a configured proximity band around the protected zone
- `multi-sensor-confirmation`: number of participating sensors crosses a confidence threshold
- `closest-approach`: minimum distance to protected zone across the replay
- `replay-summary`: synthesized from the final event statistics

---

## Speech Synthesis Notes

### Browser API

Use:

```ts
const utterance = new SpeechSynthesisUtterance(text);
utterance.rate = 1;
utterance.pitch = 1;
utterance.volume = 1;
window.speechSynthesis.speak(utterance);
```

### Operational constraints

- Voice availability varies by browser and OS.
- Voice lists may load asynchronously.
- Browsers may require a user gesture before speech starts.
- Speech queue state must be cleared with `speechSynthesis.cancel()` during timeline jumps.

### Demo strategy

Prefer short, high-signal lines under roughly 2 to 3 seconds each.

That keeps narration crisp and reduces drift between spoken output and visual playback.

---

## UX Notes

- Default narration should be `on` for the demo, but easily muted.
- The narration panel should always mirror what is spoken.
- Keep the visual style closer to an operations briefing than a chat UI.
- When a high-priority moment fires, briefly emphasize the related map entity.
- If the user scrubs to a later point, the narration panel should rebuild context from recent moments rather than replay every skipped line.

---

## Acceptance Criteria

1. A user can open a report event and start mission replay.
2. Replay time drives the visible map/timeline state from a single clock.
3. At least five meaningful mission moments are derived from existing event data.
4. Those moments appear both visually and through browser speech synthesis.
5. Scrubbing, pause, restart, and speed changes keep narration coherent.
6. Replay ends with a short summary card.
7. The experience is stable enough for a live demo without manual timing.

---

## Risks

- Existing report data may not expose enough information for some moment types.
- Speech synthesis behavior can differ across Chrome, Edge, and Safari.
- Overly frequent narration will feel noisy instead of smart.
- If replay state is duplicated across components, the demo will drift.

Mitigation:

- Start with deterministic, high-confidence moments only.
- Use one replay clock.
- Treat spoken narration as a thin layer over the visible mission-moment feed.

---

## Recommended MVP Cut

For the first demo pass, implement only:

1. Replay controls tied to selected report event
2. Mission moments for start, first detection, multi-sensor confirmation, closest approach, and summary
3. Narration panel with browser speech synthesis
4. Timeline markers and one map highlight state

This is enough to feel advanced without depending on a large data-model rewrite.
