# Database Structure and API Analysis: Geolocations & Detections Reports

**Status:** draft  
**Owner:**  
**Last updated:** 2026-03-25  
**Related repos:** r2-wireless

---

## Goal

Document the database structure and API calls for the geolocation and detection reports, with focus on:
- How detecting sensors are stored
- How frequencies are stored (including time-varying data)

---

## Database Overview

The system uses **three PostgreSQL databases**:

| Database | Purpose | Schema Location |
|----------|---------|----------------|
| **App** | Device/site/user configuration | [app/schema/prisma/app/schema.prisma](../app/schema/prisma/app/schema.prisma) |
| **History** | Threat/detection events & localizations (used by reports) | [app/schema/prisma/history/schema.prisma](../app/schema/prisma/history/schema.prisma) |
| **Analytics** | Detailed processing logs & intermediate results | [app/schema/prisma/analytics/schema.prisma](../app/schema/prisma/analytics/schema.prisma) |

---

## History Database (Primary Report Data Source)

### `threat` - Main Detection Record

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `created_at` | DateTime | Detection start time |
| `missed_at` | DateTime? | Detection end time (null if still active) |
| `type_id` | Int | Threat classification ID |
| `site_id` | Int | Which site detected it |
| `color` | String? | UI display color |
| `site_distance_from_center` | Float | Site config at detection time |
| `site_beam_length` | Float | Site config at detection time |
| `site_beam_angle_spread` | Float | Site config at detection time |

**Index:** `(site_id, created_at)` for efficient report queries.

---

### `threat_localization_event` - Geolocation Points

Stores individual localization/geolocation results for a threat (one-to-many with threat).

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int | Auto-increment PK |
| `threat_id` | UUID | FK to threat |
| `created_at` | DateTime | Timestamp of this localization |
| `geo_latitude` | Float? | Computed latitude (null for direction-only) |
| `geo_longitude` | Float? | Computed longitude (null for direction-only) |
| `angle` | Float? | Direction angle (for AOA mode) |
| `site_center_latitude` | Float? | Reference point latitude |
| `site_center_longitude` | Float? | Reference point longitude |
| `participated_device_ids` | String | **Comma-separated sensor IDs** that contributed to this fix |

**Index:** `(threat_id, created_at)` for timeline queries.

**⚠️ Note:** `participated_device_ids` is stored as a comma-separated string, e.g. `"1,2,3"`.

---

### `threat_devices_details` - Sensor Participation Details

Stores which sensors detected a threat with their properties **at the time of detection**.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int | Auto-increment PK |
| `threat_id` | UUID | FK to threat |
| `device_id` | Int | Sensor ID |
| `created_at` | DateTime | Timestamp of this record |
| `device_latitude` | Float | Sensor position at detection time |
| `device_longitude` | Float | Sensor position at detection time |
| `device_generation` | Enum | V1_0, V1_1, V1_2, V1_5, V2_0 |
| `device_antenna_type` | Enum | OMNI, DIRECTIONAL |
| `device_antenna_radius` | Float? | Antenna radius (if directional) |
| `device_is_show` | Boolean | Was sensor visible at detection time |
| `device_is_sync` | Boolean | Was sensor syncing at detection time |

**Unique:** `(threat_id, device_id)` - one record per sensor per threat.

---

### `device_location` - Historical Device Positions

Tracks device position changes over time.

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int | Auto-increment PK |
| `device_id` | Int | Sensor ID |
| `site_id` | Int | Site context |
| `latitude` | Float | Position |
| `longitude` | Float | Position |
| `created_at` | DateTime | When position was recorded |

---

## App Database (Configuration)

### `device` - Sensor Configuration

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int | Primary key |
| `generation` | Enum | V1_0-V2_0 |
| `antenna_type` | Enum | OMNI, DIRECTIONAL |
| `radius` | Float? | Antenna radius |
| `latitude` | Float | Current position |
| `longitude` | Float | Current position |
| `altitude` | Float | Current position |
| `is_show` | Boolean | Is visible |
| `is_sync` | Boolean | Is syncing |
| `gain_type` | Enum | SLOW_ATTACK, CONSTANT_MANUAL, CONTROLLED_MANUAL |
| `gain_constant_manual_default_gain_value` | Float? | Default gain |

### `device_gain_constant_manual_frequency` - Frequency-Specific Gain

| Column | Type | Description |
|--------|------|-------------|
| `id` | Int | Auto-increment PK |
| `device_id` | Int | FK to device |
| `f_start_khz` | Int | Frequency range start (kHz) |
| `f_end_khz` | Int | Frequency range end (kHz) |
| `gain` | Float | Gain value for this range |

---

## Analytics Database (Processing Details)

### `detection` - Detection Operation

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `site_id` | Int | Site context |
| `receive_interval_ms` | Int | Receive interval |
| `threat_data` | JSON | **Contains ThreatData with active_frequencies** |

**ThreatData JSON Structure:**
```typescript
interface ThreatData {
  id: string;
  is_multi_drone: boolean;
  active_frequencies: ActiveFrequencies[];
  detection_threshold?: number;
  threshold_corr?: number;
  multi_device_detection?: {
    num_devices_for_detection: number;
    time_between_detections_ms: number;
  };
}

interface ActiveFrequencies {
  start_mhz: number;
  end_mhz: number;
}
```

### `detection_result_device` - Per-Sensor Detection Results

| Column | Type | Description |
|--------|------|-------------|
| `detection_device_id` | UUID | FK to detection_device |
| `threat_type_id` | Int? | Detected threat type |
| `iteration_num` | Int | Iteration number |
| `record_range_f_start_mhz` | Int | **Frequency range scanned - start** |
| `record_range_f_end_mhz` | Int | **Frequency range scanned - end** |
| `processing_time` | Float | Processing time |
| `data` | JSON | Additional data |

### `localization_result_device` - Per-Sensor Localization Results

| Column | Type | Description |
|--------|------|-------------|
| `device_lat` | Float | Device position |
| `device_lng` | Float | Device position |
| `record_range_start_freq_mhz` | Int | **Frequency range - start** |
| `record_range_end_freq_mhz` | Int | **Frequency range - end** |
| `threat_type_id` | Int? | Threat type |
| `sync_delay_samples` | Int? | Sync info |
| `threats` | JSON | Detected threats |

---

## GraphQL API Endpoints

### Report Queries ([app/be_graphql/src/query/](../app/be_graphql/src/query/))

| Query | File | Purpose | Returns |
|-------|------|---------|---------|
| `report_events` | [report-events.ts](../app/be_graphql/src/query/report-events.ts) | Grouped geolocation events | `ReportEvents[]` |
| `report_threats` | [report-threats.ts](../app/be_graphql/src/query/report-threats.ts) | Individual detections | `ReportThreats[]` |
| `report_heat_map` | [report-heat-map.ts](../app/be_graphql/src/query/report-heat-map.ts) | Geo points for heat map | `ReportHeatMap[]` |
| `report_event_row` | [report-event-row.ts](../app/be_graphql/src/query/report-event-row.ts) | Detailed timeline for threats | `ReportEventRow` |

---

### `report_events(site_id: ID!)` - Geolocations List

Groups related threats by time window (`REPORT_EVENT_THRESHOLD_TIME`).

**Returns:**
```graphql
type ReportEvents {
  id: ID!
  started_at: Timestamp!
  ended_at: Timestamp!
  duration_seconds: Float!
  threat_ids: [String!]!
  threat_types: [ReportThreatType!]!
}
```

**SQL Logic:**
1. Finds threats with `missed_at IS NOT NULL` that have localization events
2. Groups threats where gap between consecutive events < threshold time
3. Returns aggregated periods with all threat IDs in each period

---

### `report_threats(id: ID!)` - Detections List

Returns individual detection records for a site.

**Returns:**
```graphql
type ReportThreats {
  id: Int!
  threat_id: ID!
  threat_type: ReportThreatType!
  started_at: Timestamp!
  ended_at: Timestamp!
  duration_seconds: Float!
}
```

---

### `report_event_row(threat_ids: [ID!]!, site_id: ID!)` - Detailed Timeline

Returns time-slotted data for specific threats with participating devices.

**Returns:**
```graphql
type ReportEventRow {
  slotDuration: Int!
  participatedDevices: [ReportEventRowParticipatedDevice!]!
  threats: [ReportEventRowThreat!]!
  timeSlots: [ReportEventRowLocationSlot!]!
}

type ReportEventRowParticipatedDevice {
  deviceId: ID!
  deviceLatitude: Float!
  deviceLongitude: Float!
  deviceAntennaType: PrAntennaType!
  deviceAntennaRadius: Float
  deviceGeneration: PrGeneration!
  deviceIsSync: Boolean!
  deviceIsShow: Boolean!
}

type ReportEventRowLocationSlot {
  slotIndex: Int!
  threatsEvent: [ReportEventRowEvent!]!  # LocalizationEvent or StatusEvent
  devices: [ReportEventRowDevice!]!
}

type ReportEventRowLocalizationInfo {
  geoLatitude: Float
  geoLongitude: Float
  angle: Float
  siteCenterLatitude: Float!
  siteCenterLongitude: Float!
  participatedDeviceIds: [ID!]!
}
```

---

### `report_heat_map(id: ID!)` - Heat Map Points

Returns geo points for visualization.

**Returns:**
```graphql
type ReportHeatMap {
  threat_type: ReportThreatType!
  latitude: Float!
  longitude: Float!
  created_at: Timestamp!
}
```

---

## Current State: Sensors & Frequencies in Reports

### ✅ How Sensors Are Currently Stored

1. **Per-Threat (flat):** `threat_devices_details` stores all sensors that participated in detecting a threat, with their properties **at detection time**

2. **Per-Localization Event:** `threat_localization_event.participated_device_ids` stores comma-separated sensor IDs for each geo fix

3. **Historical Positions:** `device_location` tracks position changes over time

**API Exposure:**
- `report_event_row` query returns `participatedDevices[]` with full sensor details
- Each `timeSlot` includes `devices[]` with positions at that time
- `localizationInfo.participatedDeviceIds[]` shows which sensors contributed to each localization

### ⚠️ How Frequencies Are Currently Stored

1. **Site Configuration (current state only):**
   - `site.data.detection.threats[].active_frequencies[]` - current threat frequency ranges
   - Not stored per-detection in history DB

2. **Analytics DB (detailed logs):**
   - `detection.threat_data` JSON contains `active_frequencies[]`
   - `detection_result_device.record_range_f_start_mhz/f_end_mhz` - actual scanned ranges
   - `localization_result_device.record_range_start_freq_mhz/end_freq_mhz`

3. **History DB (reports):**
   - **❌ No frequency data stored per threat/localization**
   - Reports cannot show what frequencies were active at detection time

---

## Gap Analysis: Storing Time-Varying Data

### Gap 1: No Frequency History in Reports

**Current:** Frequencies are only in analytics DB (JSON) or current site config.

**Problem:** Report queries use history DB which has no frequency data.

**Potential Solutions:**
1. Add `active_frequencies` JSON column to `threat` table
2. Create `threat_frequencies` junction table:
   ```sql
   CREATE TABLE threat_frequencies (
     id SERIAL PRIMARY KEY,
     threat_id UUID REFERENCES threat(id),
     threat_type_id INT,
     f_start_mhz INT,
     f_end_mhz INT
   );
   ```

### Gap 2: Sensors Per-Localization vs Per-Threat

**Current:** `threat_devices_details` stores sensors per-threat (flat), but sensor participation can vary between localization events.

**Existing Solution:** `threat_localization_event.participated_device_ids` stores comma-separated sensor IDs per localization event.

**Consideration:** Convert to proper junction table if querying by sensor becomes important:
```sql
CREATE TABLE threat_localization_device (
  localization_event_id INT REFERENCES threat_localization_event(id),
  device_id INT,
  PRIMARY KEY (localization_event_id, device_id)
);
```

### Gap 3: No Frequency Per-Localization Event

**Problem:** Even within a single threat, the detected frequency might vary over time.

**Potential Solution:**
```sql
ALTER TABLE threat_localization_event
  ADD COLUMN detected_f_start_mhz INT,
  ADD COLUMN detected_f_end_mhz INT;
```

---

## Entity Relationships Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HISTORY DATABASE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐        ┌───────────────────────────┐                  │
│  │      threat      │        │  threat_localization_event│                  │
│  ├──────────────────┤        ├───────────────────────────┤                  │
│  │ id (UUID)        │◄───────│ threat_id                 │                  │
│  │ created_at       │   1:N  │ created_at                │                  │
│  │ missed_at        │        │ geo_latitude              │                  │
│  │ type_id          │        │ geo_longitude             │                  │
│  │ site_id          │        │ angle                     │                  │
│  │ color            │        │ participated_device_ids * │                  │
│  │ site_beam_*      │        └───────────────────────────┘                  │
│  └────────┬─────────┘                                                       │
│           │                                                                 │
│           │ 1:N                                                             │
│           ▼                                                                 │
│  ┌──────────────────────────┐                                               │
│  │  threat_devices_details  │      * = comma-separated string              │
│  ├──────────────────────────┤                                               │
│  │ threat_id                │      ⚠️ NO FREQUENCY DATA IN HISTORY DB      │
│  │ device_id                │                                               │
│  │ device_latitude          │                                               │
│  │ device_longitude         │                                               │
│  │ device_generation        │                                               │
│  │ device_antenna_type      │                                               │
│  │ device_is_sync           │                                               │
│  └──────────────────────────┘                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                             ANALYTICS DATABASE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐        ┌───────────────────────────┐                  │
│  │    detection     │        │  detection_result_device  │                  │
│  ├──────────────────┤        ├───────────────────────────┤                  │
│  │ id (UUID)        │◄───────│ detection_device_id       │                  │
│  │ threat_data (JSON)        │ record_range_f_start_mhz ✓│                  │
│  │  └─> active_frequencies ✓ │ record_range_f_end_mhz   ✓│                  │
│  │ site_id          │        │ threat_type_id            │                  │
│  └──────────────────┘        └───────────────────────────┘                  │
│                                                                             │
│  ┌──────────────────┐        ┌───────────────────────────┐                  │
│  │   localization   │        │ localization_result_device│                  │
│  ├──────────────────┤        ├───────────────────────────┤                  │
│  │ id (UUID)        │◄───────│ device_lat/lng            │                  │
│  │ threat_data (JSON)        │ record_range_*_freq_mhz  ✓│                  │
│  │  └─> active_frequencies ✓ │ threats (JSON)            │                  │
│  └──────────────────┘        └───────────────────────────┘                  │
│                                                                             │
│  ✓ = Has frequency data                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Recommendations

### To store detecting sensors over time (per-localization):
- **Already available:** `threat_localization_event.participated_device_ids` tracks which sensors contributed to each geo fix
- **Enhancement:** Consider converting to junction table for better queryability

### To store frequencies over time:
1. **Option A (Minimal):** Add `active_frequencies` JSON to `threat` table - captures frequencies at detection start
2. **Option B (Per-event):** Add `detected_frequencies` to `threat_localization_event` - tracks frequency changes during detection
3. **Option C (Join):** Link history to analytics tables when detailed frequency data is needed

---

## Open Questions

1. Should frequencies be stored per-threat or per-localization event?
2. Is the analytics DB frequency data sufficient, or must it be in history DB for reports?
3. Should `participated_device_ids` be converted from comma-separated string to a proper relation table?


