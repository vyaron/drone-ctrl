import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { DRONE_COLORS, type Drone } from '../utils/droneUtils';
import { StaticMapView } from './StaticMapView';
import { type TrailPoint } from './canvas';

interface DroneFootageSplitViewProps {
  drone: Drone;
  pathPoints: TrailPoint[];
  onClose: () => void;
  videoSrc?: string;
}

const OVERLAY_Z_INDEX = 200;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function interpolateDroneAtProgress(drone: Drone, points: TrailPoint[], progress: number): Drone {
  if (points.length === 0) {
    return drone;
  }

  if (points.length === 1) {
    return { ...drone, lat: points[0].lat, lon: points[0].lon };
  }

  const startTs = points[0].ts;
  const endTs = points[points.length - 1].ts;
  if (endTs <= startTs) {
    return { ...drone, lat: points[points.length - 1].lat, lon: points[points.length - 1].lon };
  }

  const targetTs = startTs + (endTs - startTs) * clamp01(progress);

  let nextIdx = points.findIndex(p => p.ts >= targetTs);
  if (nextIdx <= 0) {
    return { ...drone, lat: points[0].lat, lon: points[0].lon };
  }
  if (nextIdx === -1) {
    const last = points[points.length - 1];
    return { ...drone, lat: last.lat, lon: last.lon };
  }

  const prev = points[nextIdx - 1];
  const next = points[nextIdx];
  const segment = Math.max(1, next.ts - prev.ts);
  const t = clamp01((targetTs - prev.ts) / segment);

  return {
    ...drone,
    lat: prev.lat + (next.lat - prev.lat) * t,
    lon: prev.lon + (next.lon - prev.lon) * t,
  };
}

export function DroneFootageSplitView({
  drone,
  pathPoints,
  onClose,
  videoSrc = 'footage/101.mp4',
}: DroneFootageSplitViewProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoDurationSec, setVideoDurationSec] = useState(0);
  const [videoTimeSec, setVideoTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const syncFromVideo = () => {
      setVideoTimeSec(video.currentTime || 0);
    };

    const handleLoadedMeta = () => {
      setVideoDurationSec(Number.isFinite(video.duration) ? video.duration : 0);
      syncFromVideo();
    };

    const handleTimeUpdate = () => syncFromVideo();
    const handleSeeked = () => syncFromVideo();
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadedmetadata', handleLoadedMeta);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    if (video.readyState >= 1) {
      handleLoadedMeta();
    }

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMeta);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    let raf = 0;
    const tick = () => {
      const video = videoRef.current;
      if (video) {
        setVideoTimeSec(video.currentTime || 0);
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const progress = useMemo(() => {
    if (videoDurationSec <= 0) return 0;
    return clamp01(videoTimeSec / videoDurationSec);
  }, [videoTimeSec, videoDurationSec]);

  const syncedPathPoints = useMemo(() => {
    if (pathPoints.length <= 1 || videoDurationSec <= 0) {
      return pathPoints;
    }

    const lastTs = pathPoints[pathPoints.length - 1].ts;
    const minTs = lastTs - videoDurationSec * 1000;
    const tail = pathPoints.filter(p => p.ts >= minTs);
    return tail.length >= 2 ? tail : pathPoints;
  }, [pathPoints, videoDurationSec]);

  const syncedDrone = useMemo(
    () => interpolateDroneAtProgress(drone, syncedPathPoints, progress),
    [drone, syncedPathPoints, progress]
  );

  const visiblePath = useMemo(() => {
    if (syncedPathPoints.length === 0) return [];
    if (progress <= 0) return [syncedPathPoints[0]];
    const limitIdx = Math.max(1, Math.floor((syncedPathPoints.length - 1) * progress));
    return syncedPathPoints.slice(0, limitIdx + 1);
  }, [syncedPathPoints, progress]);

  const cfg = DRONE_COLORS[drone.colorIndex % DRONE_COLORS.length];

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: OVERLAY_Z_INDEX,
        background: 'rgba(3, 8, 14, 0.72)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1320px, 100%)',
          height: 'min(760px, 100%)',
          background: 'linear-gradient(145deg, rgba(8,14,20,0.98), rgba(4,9,15,0.98))',
          border: '1px solid rgba(0,212,255,0.22)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '12px 16px',
            borderBottom: '1px solid rgba(0,212,255,0.12)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontFamily: "'Share Tech Mono', monospace",
          }}
        >
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: cfg.color,
              boxShadow: `0 0 10px ${cfg.glow}`,
            }}
          />
          <span style={{ color: '#e8eaf0', fontWeight: 700, fontSize: 13 }}>{drone.model}</span>
          <span style={{ color: '#7ecfff', fontSize: 11, letterSpacing: 1.2 }}>SYNCED FOOTAGE VIEW</span>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            aria-label="Close synced footage view"
            style={{
              border: '1px solid rgba(0,212,255,0.28)',
              background: 'rgba(6, 14, 22, 0.9)',
              color: '#aebdca',
              borderRadius: 8,
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
              padding: 0,
              cursor: 'pointer',
              fontSize: 18,
              fontWeight: 500,
              boxSizing: 'border-box',
            }}
          >
            ✕
          </button>
        </div>

        <div
          className="drone-footage-grid"
          style={{
            flex: 1,
            minHeight: 0,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
          }}
        >
          <div style={{ borderRight: '1px solid rgba(0,212,255,0.1)', minHeight: 280 }}>
            <StaticMapView
              drones={[syncedDrone]}
              selected={syncedDrone}
              onSelect={() => {}}
              mode="canvas"
              paused={!isPlaying}
              externalTrailPoints={visiblePath}
              forceShowTrails={true}
              hideTrailToggle={true}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 280, background: 'rgba(0,0,0,0.28)' }}>
            <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
              <video
                ref={videoRef}
                autoPlay
                muted
                loop
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              >
                <source src={videoSrc} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
            <div style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(0,212,255,0.12)',
              fontFamily: "'Share Tech Mono', monospace",
              fontSize: 11,
              color: '#7ecfff',
              letterSpacing: 1,
              display: 'flex',
              justifyContent: 'space-between',
            }}>
              <span>SYNC: VIDEO TIME SOURCE</span>
              <span>{Math.round(progress * 100)}% PATH</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 980px) {
          .drone-footage-grid {
            grid-template-columns: 1fr;
            grid-template-rows: 1fr 1fr;
          }
        }
      `}</style>
    </div>
  );
}

export default DroneFootageSplitView;
