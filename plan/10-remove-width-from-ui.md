# Remove Wedge Width from UI

> The user does not need to see the bearing width number.

## Background
For **direction-level** drones, we display a wedge/cone on the map showing the bearing direction. The wedge has a `bearingWidth` property (in degrees) that determines how wide the cone is. Currently this width is shown in two places:

1. **DroneTooltip.tsx** - Shows: `Bearing: 45° ± 15°` (the ±15° is half the width)
2. **DetailPanel.tsx** - Has a dedicated "WIDTH" row showing `±15°`

## Proposed Changes

### 1. Update DroneTooltip.tsx
- Remove the `± {width}°` suffix from the bearing display
- Change `Bearing: {bearing}° ± {width/2}°` → `Bearing: {bearing}°`
- File: [DroneTooltip.tsx](../src/components/DroneTooltip.tsx#L75-L77)

### 2. Update DetailPanel.tsx  
- Remove the entire "WIDTH" row from the direction-level section
- Keep only the "BEARING" row
- File: [DetailPanel.tsx](../src/components/DetailPanel.tsx#L204-L207)

## Questions

- [ ] **Q1: Should we keep the visual wedge on the map unchanged?**  
  The wedge visualization itself still uses `bearingWidth` for rendering - only removing from text display, correct?
  YES

- [ ] **Q2: Should we also remove the width from the DroneRow secondary text?**  
  Currently DroneRow shows `DIR 45°` for direction-level drones - it doesn't include width. Confirm this is the desired state?
  KEEP AS IS

- [ ] **Q3: Any other locations where bearingWidth is displayed to the user?**  
  I found it in DroneTooltip and DetailPanel - are there others I might have missed (e.g., ReportEventsView, FrequencyView)?
PLEASE CHECK AGAIN


## Files to Modify
- `src/components/DroneTooltip.tsx`
- `src/components/DetailPanel.tsx`