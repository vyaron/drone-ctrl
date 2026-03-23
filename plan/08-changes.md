# Change Request: Remove Severity Concept and Enemy/Ally Colors

## 1. Remove Severity Concept

The concept of severity (critical, high, medium, low) should be removed from the entire system.

### Questions to Clarify:
- **What should replace severity?** Options:
  - A) Remove classification entirely - all drones shown the same
  - B) Use neutral categories like "Type A, B, C, D" or "Class 1, 2, 3, 4"
  - C) Classify by drone model/manufacturer only
  - D) Classify by frequency band only

A
  
- **How should drone visual intensity vary?** Currently severity controls:
  - Number of animated rings (critical=3, high=2, medium/low=1)
  - Color intensity/glow
  - Should these distinctions remain but based on something else?

Based on how many sensors detect it


### Files Affected:
- [droneUtils.ts](../src/utils/droneUtils.ts) - `SeverityLevel` type, `SEV` config, `DRONE_MODELS` mapping
- [Drone interface](../src/utils/droneUtils.ts) - `severity` property on Drone type
- [drawDrones.ts](../src/components/canvas/drawDrones.ts) - visual rendering based on severity
- [drawTrails.ts](../src/components/canvas/drawTrails.ts) - trail colors based on severity
- [FrequencyView.tsx](../src/components/FrequencyView.tsx) - severity coloring
- [HistoricalTimeline.tsx](../src/components/HistoricalTimeline.tsx) - severity badges
- [ReportEventsView.tsx](../src/components/ReportEventsView.tsx) - severity filtering & display
- [Reports.tsx](../src/pages/Reports.tsx) - severity columns in statistics table

---

## 2. Remove Green and Red Colors

Green (#30d158) and red (#ff2d55) should not be used as they imply enemy/ally which doesn't apply.

### Questions to Clarify:
- **What colors should replace them?** Suggested neutral palette:
  - Replace red (#ff2d55) with: cyan (#00d4ff), purple (#af52de), or orange (#ff9500)?
  - Replace green (#30d158) with: blue (#007aff), teal (#32ade6), or yellow (#ffd60a)?

YES
  
- **Status colors:** Currently used for active/inactive status:
  - Active = green, Inactive = red
  - Should status use different indicators instead? (e.g., icons, brightness, opacity)

BRIGHTNESS, OPACITY


### Files Affected:
- [droneUtils.ts](../src/utils/droneUtils.ts#L64-L67) - SEV config colors (critical=red, low=green)
- [DetailPanel.tsx](../src/components/DetailPanel.tsx#L143) - active/inactive status colors
- [Live.tsx](../src/pages/Live.tsx#L238) - button states
- [Reports.tsx](../src/pages/Reports.tsx#L310-L324) - table column colors
- [FrequencyTab.tsx](../src/components/FrequencyTab.tsx#L197) - threshold line
- [FrequencyView.tsx](../src/components/FrequencyView.tsx#L168) - markers
- [App.css](../src/App.css#L137-L139) - .stat-value success/danger classes

---

## Implementation Plan

Once questions are answered:

1. **Update type definitions** - Replace `SeverityLevel` with new classification
2. **Update color palette** - Define new neutral colors in droneUtils.ts
3. **Update drone generation** - Modify `spawnDrone()` to use new classification
4. **Update all visual components** - Replace severity references with new system
5. **Update UI filters** - Modify filter dropdowns to use new categories
6. **Test all views** - Live, Reports, FrequencyView, ReportEventsView


---

## 3. Additional UI Changes

### 3.1 Reports Page
- Remove severity filter from Reports filter panel
- Move Summary tab to the end (Events becomes default)
- Remove severity-related stats from Summary (graphs will be added later)

### 3.2 Live View  
- Remove severity filter

### 3.3 Detail Panel (Threat Details)
- Remove THREAT SCORE display
- Remove bottom action buttons

### Questions to Clarify:

- **Drone color when no severity:** Since all drones will look the same (answer A), what single color should all drones use?
  - A) Neutral cyan (#00d4ff)
  - B) Neutral amber (#ff9500)  
  - C) Neutral purple (#af52de)
  - D) Keep varied colors but assign randomly or by frequency band
  Use 10 neutral colors such as the ones you suggested

- **Visual intensity based on sensor count:** You said intensity varies by how many sensors detect the drone. 
  - 1 sensor = 1 ring, 2 sensors = 2 rings, 3+ sensors = 3 rings?
  - What colors for the rings/glow? (since we're removing red/green)
Yes, The drone color



- **Reports Summary page:** When we "clean severity-related stats", these will be removed:
  - The bar chart showing detections by severity
  - The table with critical/high/medium/low columns
  - Is this correct? Or keep the structure but rename columns?

- **Detail Panel bottom buttons:** These are "TRACK", "DISABLE", "ALERT" buttons - remove all of them?

YES

---

## Implementation Plan (Updated)

### Phase 1: Remove Severity System
1. Remove `SeverityLevel` type from droneUtils.ts
2. Remove `severity` property from `Drone` interface
3. Remove `SEV` config object (replace with single drone color config)
4. Update `spawnDrone()` - remove severity assignment
5. Update visual rendering based on `detectedBy.length` for intensity

### Phase 2: Update Color Palette  
1. Define new neutral drone color (single or by frequency band)
2. Replace all #ff2d55 (red) references
3. Replace all #30d158 (green) references
4. Update status indicators to use brightness/opacity

### Phase 3: UI Component Updates
1. **Live.tsx** - Remove severity filter dropdown
2. **Reports.tsx** - Remove severity filter, reorder tabs, clean Summary stats
3. **ReportEventsView.tsx** - Remove severity filtering/display
4. **DetailPanel.tsx** - Remove threat score, remove action buttons
5. **HistoricalTimeline.tsx** - Update event badges
6. **FrequencyView.tsx** - Update drone markers
7. **drawDrones.ts** - Use sensor count for rings
8. **drawTrails.ts** - Use uniform or frequency-based colors

### Phase 4: Cleanup
1. Remove unused CSS classes (.stat-value.success, .stat-value.danger)
2. Test all views



