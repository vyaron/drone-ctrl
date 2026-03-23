# Plan: Frequency View Page

Add a frequency page that shows the threats through a frequencies glasses.
It's a graph: X-axis = Time, Y-axis = MHz (100 → 6000)

**Location**: Reports → Frequency (route: `/reports/frequency`)

---

## Common Report Filters

All reports share these filters:
- **ThreatTypes**: Critical, High, Medium, Low (multi-select)
- **Date Range**: Last 1H, Last 8H, Last 24H, Custom DateTime range

---

## Data Model Changes

Each threat (Drone) should have a `freqHistory` array tracking frequency detections over time:

```ts
interface FreqSample {
  ts: number;        // timestamp in ms
  freq: number;      // frequency in MHz (100-6000)
  strength: number;  // signal strength 0-100
}

// Add to Drone interface:
freqHistory: FreqSample[];
currentFreq: number;
freqBand: keyof typeof FREQ_BANDS;
```

> ✅ **Q1**: Should `strength` be included? **Yes** - used for dot size

> ✅ **Q2**: How often should freq samples be recorded? **250ms**

---

## Visualization

### Graph Layout
- **Y-axis**: 100 MHz → 6000 MHz (logarithmic scale)
- **X-axis**: Time window (based on selected date range filter)
- Each drone = a colored trail/scatter of dots based on its severity color

### Display Options
| Option | Description |
|--------|-------------|
| Dots | Each sample = a dot at (time, freq) |
| Lines | Connect samples per drone to show freq-hopping pattern |
| Heatmap | Aggregate view showing frequency band activity density |

> ✅ **Q3**: Which visualization style? **Toggle** between all three

> ✅ **Q4**: Should clicking a freq point select the drone? **Yes**

---

## Frequency Bands Reference

| Band | Range | Common Use |
|------|-------|------------|
| ISM 433 | 433 MHz | Cheap drones, RC toys |
| ISM 868/915 | 868-915 MHz | LoRa, telemetry |
| ISM 2.4G | 2400-2483 MHz | WiFi, most consumer drones |
| ISM 5.8G | 5725-5875 MHz | FPV video, DJI drones |

> ✅ **Q5**: Should we show band regions? **Yes** - colored horizontal zones with toggle

---

## Implementation Tasks

1. [x] Extend `Drone` interface with `freqHistory: FreqSample[]`
2. [x] Update `spawnDrone()` to initialize with random freq samples
3. [x] Add freq simulation in the drone update loop (freq hopping behavior)
4. [x] Create `ReportFrequencyView.tsx` component (historical data)
5. [x] Add route `/reports/frequency` 
6. [x] Add common filter bar to Reports (ThreatTypes + DateRange)
7. [x] Implement canvas graph renderer with dots/lines/heatmap toggle
8. [x] Wire up drone selection from graph clicks

---

## Files

- [Reports.tsx](../src/pages/Reports.tsx) - Main reports page with common filters
- [ReportFrequencyView.tsx](../src/components/ReportFrequencyView.tsx) - Historical frequency graph
- [droneUtils.ts](../src/utils/droneUtils.ts) - FreqSample, FREQ_BANDS, addFreqSample()
YES
2. Sampling rate for freq history?
YES
3. Visualization style (dots/lines/heatmap)?
DOTS
4. Click-to-select integration?
YES
5. Show frequency band zones?
YES
6. Should "left" drones fade out or disappear from freq view?
YES
7. Any specific chart library preference (raw canvas, D3, Recharts)?
Dont know