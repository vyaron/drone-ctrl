# Plan: Events Report

Add a report: Events

**Location**: Reports → Events (route: `/reports/events`)

(Same filters applied to all reports: ThreatTypes + DateRange)

---

## Layout

- Resizable split view: **Table** | **Map**

> ❓ **Q1**: What's the default split ratio? (50/50, 60/40 table-heavy, 70/30?)
50/50

> ❓ **Q2**: Should the map show ALL events from the filtered list, or only the selected event?
SELECTED

> ❓ **Q3**: Should map show drone trails for the event duration, or just snapshot positions?
SNAPSHOT

---

## Events Table (Main)

| Column | Description |
|--------|-------------|
| ID | Event ID |
| Started At | Event start timestamp |
| Ended At | Event end timestamp |
| Duration | Calculated duration (e.g., "23m") |
| Threats | Comma-separated drone types (e.g., "Autel EVO Nano+, DJI Phantom 4 Pro") |
| Actions | Icons: 🗺️ open map, ▼ expand row |

**Sample row:**
| 7 | 2026-03-19 18:38:07 | 2026-03-19 19:01:46 | 23m | Autel EVO Nano+, DJI Phantom 4 Pro | 🗺️ ▼ |

> ❓ **Q4**: Should rows be sortable by clicking column headers?
YES

> ❓ **Q5**: Should there be a "severity" column showing the highest severity among threats?
NO

> ❓ **Q6**: Pagination or infinite scroll for many events?
NO, its just a demo
---

## Table Expandable Row (Detections)

When clicking ▼, show nested table of individual detections within that event:

| Column | Description |
|--------|-------------|
| ID | Detection ID |
| Started At | Detection start timestamp |
| Ended At | Detection end timestamp |
| Duration | Detection duration |
| Threat Type | Single drone type |
| Frequencies | List of detected frequencies |

> ❓ **Q7**: Should clicking a detection row highlight that specific drone on the map?
OK

> ❓ **Q8**: Should frequencies link to the Frequency View filtered to that time range?
OK

> ❓ **Q9**: Show frequency as single value, range (e.g., "2.4GHz - 5.8GHz"), or list all bands?
LIST

---

## Data Model

```ts
interface Detection {
  id: string;
  droneId: string;
  droneType: string;       // e.g., "DJI Phantom 4 Pro"
  severity: SeverityLevel;
  startedAt: number;       // timestamp ms
  endedAt: number;         // timestamp ms  
  frequencies: number[];   // MHz values detected
}

interface Event {
  id: string;
  startedAt: number;
  endedAt: number;
  detections: Detection[];
}
```

> ❓ **Q10**: How is an "Event" defined? 
>   X Time-based grouping (detections within X minutes)?
>   - Geographic proximity (drones within Y meters)?
>   - Manual operator-defined?

> ❓ **Q11**: Should events have a status? (e.g., "active", "resolved", "investigating")
NO

> ❓ **Q12**: Are events persisted to backend, or derived from detection data on-the-fly?
FRONTEND ONLY

---

## Map Integration

When an event row is selected/expanded:

> ❓ **Q13**: Should map auto-zoom to fit all detections in the event?
OK

> ❓ **Q14**: Show sensor coverage areas on the map?
YES

> ❓ **Q15**: Timeline scrubber to replay the event? Or static view only?
YES

---

## Implementation Tasks

1. [ ] Define Event and Detection interfaces in droneUtils.ts
2. [ ] Create mock/simulated event data generator
3. [ ] Create `ReportEventsView.tsx` component
4. [ ] Implement resizable split pane (table | map)
5. [ ] Build events table with sortable columns
6. [ ] Implement expandable row with nested detections table
7. [ ] Wire up map to show selected event positions
8. [ ] Add route `/reports/events` to Reports.tsx navigation

---

## Files

- [Reports.tsx](../src/pages/Reports.tsx) - Main reports page with navigation
- `ReportEventsView.tsx` (new) - Events table + map split view
- [droneUtils.ts](../src/utils/droneUtils.ts) - Event/Detection types


