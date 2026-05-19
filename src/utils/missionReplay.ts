import { SITE_CENTER, type Event, type PositionSample } from './droneUtils';

export type MissionMomentType =
  | 'replay-start'
  | 'sensor-detect'
  | 'frequency-spike'
  | 'multi-sensor-confirmation'
  | 'direction-fix'
  | 'location-fix'
  | 'heading-change'
  | 'closest-approach'
  | 'replay-summary';

export interface MissionMoment {
  id: string;
  ts: number;
  type: MissionMomentType;
  title: string;
  narration: string;
  priority: 'low' | 'medium' | 'high';
  relatedDroneId?: string;
  relatedSensorIds?: string[];
}

function estimateDistanceMeters(latA: number, lonA: number, latB: number, lonB: number): number {
  const metersPerDegLat = 111_320;
  const metersPerDegLon = 111_320 * Math.cos(((latA + latB) / 2) * (Math.PI / 180));
  const dLat = (latB - latA) * metersPerDegLat;
  const dLon = (lonB - lonA) * metersPerDegLon;
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

function findHeadingChange(positionHistory: PositionSample[]): PositionSample | null {
  for (let index = 1; index < positionHistory.length; index += 1) {
    const previous = positionHistory[index - 1];
    const current = positionHistory[index];
    const rawDelta = Math.abs(current.heading - previous.heading);
    const delta = Math.min(rawDelta, 360 - rawDelta);
    if (delta >= 35) {
      return current;
    }
  }

  return null;
}

export function deriveMissionMoments(event: Event | null): MissionMoment[] {
  if (!event || event.detections.length === 0) {
    return [];
  }

  const moments: MissionMoment[] = [];
  const sortedDetections = [...event.detections].sort((left, right) => left.startedAt - right.startedAt);
  const firstDetection = sortedDetections[0];
  const distinctSensors = Array.from(new Set(sortedDetections.map(detection => detection.sensorId)));
  const primaryDroneId = firstDetection.droneId;

  moments.push({
    id: `${event.id}-replay-start`,
    ts: event.startedAt,
    type: 'replay-start',
    title: 'Replay started',
    narration: 'Mission replay started. Tracking incident activity from first detection.',
    priority: 'low',
    relatedDroneId: primaryDroneId,
  });

  moments.push({
    id: `${firstDetection.id}-sensor-detect`,
    ts: firstDetection.startedAt,
    type: 'sensor-detect',
    title: 'First detection',
    narration: 'Initial sensor contact confirmed.',
    priority: 'high',
    relatedDroneId: firstDetection.droneId,
    relatedSensorIds: [firstDetection.sensorId],
  });

  const strongestSample = sortedDetections
    .flatMap(detection => detection.freqHistory.map(sample => ({ sample, detection })))
    .sort((left, right) => right.sample.strength - left.sample.strength)[0];

  if (strongestSample) {
    moments.push({
      id: `${strongestSample.detection.id}-frequency-spike`,
      ts: strongestSample.sample.ts,
      type: 'frequency-spike',
      title: 'Frequency spike',
      narration: 'Radio activity spiked in an active drone band.',
      priority: 'medium',
      relatedDroneId: strongestSample.detection.droneId,
      relatedSensorIds: [strongestSample.detection.sensorId],
    });
  }

  if (distinctSensors.length >= 2) {
    const confirmationCount = Math.min(distinctSensors.length, 3);
    const confirmationSensors = distinctSensors.slice(0, confirmationCount);
    const confirmationTs = Math.max(
      ...confirmationSensors.map(sensorId => sortedDetections.find(detection => detection.sensorId === sensorId)?.startedAt ?? event.startedAt)
    );

    moments.push({
      id: `${event.id}-multi-sensor-confirmation`,
      ts: confirmationTs,
      type: 'multi-sensor-confirmation',
      title: 'Multi-sensor confirmation',
      narration: 'Confidence increased after additional sensor confirmation.',
      priority: 'high',
      relatedDroneId: primaryDroneId,
      relatedSensorIds: confirmationSensors,
    });
  }

  const firstDirection = sortedDetections.find(detection => detection.level === 'direction');
  if (firstDirection) {
    moments.push({
      id: `${firstDirection.id}-direction-fix`,
      ts: firstDirection.startedAt,
      type: 'direction-fix',
      title: 'Direction established',
      narration: 'Directional track established.',
      priority: 'medium',
      relatedDroneId: firstDirection.droneId,
      relatedSensorIds: [firstDirection.sensorId],
    });
  }

  const firstLocation = sortedDetections.find(detection => detection.level === 'location' && detection.positionHistory?.length);
  if (firstLocation) {
    moments.push({
      id: `${firstLocation.id}-location-fix`,
      ts: firstLocation.startedAt,
      type: 'location-fix',
      title: 'Location fix established',
      narration: 'Track upgraded to a precise location fix.',
      priority: 'high',
      relatedDroneId: firstLocation.droneId,
      relatedSensorIds: [firstLocation.sensorId],
    });

    const headingChange = findHeadingChange(firstLocation.positionHistory ?? []);
    if (headingChange) {
      moments.push({
        id: `${firstLocation.id}-heading-change`,
        ts: headingChange.ts,
        type: 'heading-change',
        title: 'Heading change',
        narration: 'Target changed course during tracking.',
        priority: 'medium',
        relatedDroneId: firstLocation.droneId,
        relatedSensorIds: [firstLocation.sensorId],
      });
    }

    const closestSample = (firstLocation.positionHistory ?? []).reduce<PositionSample | null>((closest, sample) => {
      if (!closest) {
        return sample;
      }

      const currentDistance = estimateDistanceMeters(sample.lat, sample.lon, SITE_CENTER.lat, SITE_CENTER.lon);
      const bestDistance = estimateDistanceMeters(closest.lat, closest.lon, SITE_CENTER.lat, SITE_CENTER.lon);
      return currentDistance < bestDistance ? sample : closest;
    }, null);

    if (closestSample) {
      const distanceMeters = estimateDistanceMeters(
        closestSample.lat,
        closestSample.lon,
        SITE_CENTER.lat,
        SITE_CENTER.lon
      );

      const approachNarration = distanceMeters < 700
        ? 'Target made a close approach to the protected area.'
        : 'Target approached the protected area.';

      moments.push({
        id: `${firstLocation.id}-closest-approach`,
        ts: closestSample.ts,
        type: 'closest-approach',
        title: 'Closest approach',
        narration: approachNarration,
        priority: 'high',
        relatedDroneId: firstLocation.droneId,
        relatedSensorIds: [firstLocation.sensorId],
      });
    }
  }

  moments.push({
    id: `${event.id}-summary`,
    ts: event.endedAt,
    type: 'replay-summary',
    title: 'Replay complete',
    narration: 'Replay complete. The incident was tracked and confirmed across multiple sensors.',
    priority: 'low',
    relatedDroneId: primaryDroneId,
    relatedSensorIds: distinctSensors,
  });

  return moments.sort((left, right) => left.ts - right.ts);
}