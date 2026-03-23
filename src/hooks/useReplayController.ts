import { useState, useRef, useCallback, useEffect } from 'react';
import { type Event, type Drone, eventToDrones } from '../utils/droneUtils';

export type PlaybackSpeed = 10 | 30 | 60;

export interface ReplayController {
  // State
  isPlaying: boolean;
  speed: PlaybackSpeed;
  currentTs: number;
  progress: number;  // 0-1
  
  // Current data
  drones: Drone[];
  
  // Controls
  play: () => void;
  pause: () => void;
  togglePlay: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  seek: (progress: number) => void;  // 0-1
  seekToTime: (ts: number) => void;
}

export function useReplayController(event: Event | null): ReplayController {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<PlaybackSpeed>(10);
  const [currentTs, setCurrentTs] = useState(0);
  const [drones, setDrones] = useState<Drone[]>([]);
  
  const rafRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number>(0);
  
  // Event duration
  const startTs = event?.startedAt ?? 0;
  const endTs = event?.endedAt ?? 0;
  const duration = endTs - startTs;
  
  // Calculate progress
  const progress = duration > 0 ? (currentTs - startTs) / duration : 0;
  
  // Initialize when event changes
  useEffect(() => {
    if (event) {
      // Start at the earliest detection's start time so drones are visible immediately
      const firstDetectionStart = event.detections.length > 0
        ? Math.min(...event.detections.map(d => d.startedAt))
        : event.startedAt;
      setCurrentTs(firstDetectionStart);
      setDrones(eventToDrones(event, firstDetectionStart));
      setIsPlaying(false);
    } else {
      setDrones([]);
      setCurrentTs(0);
    }
  }, [event]);
  
  // Update drones when timestamp changes
  useEffect(() => {
    if (event && currentTs >= startTs && currentTs <= endTs) {
      setDrones(eventToDrones(event, currentTs));
    }
  }, [event, currentTs, startTs, endTs]);
  
  // Playback loop
  useEffect(() => {
    if (!isPlaying || !event) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }
    
    const animate = (frameTs: number) => {
      if (!lastFrameRef.current) {
        lastFrameRef.current = frameTs;
      }
      
      const delta = frameTs - lastFrameRef.current;
      lastFrameRef.current = frameTs;
      
      // Advance time by delta * speed (delta is in real ms)
      setCurrentTs(prev => {
        const next = prev + delta * speed;
        if (next >= endTs) {
          setIsPlaying(false);
          return endTs;
        }
        return next;
      });
      
      rafRef.current = requestAnimationFrame(animate);
    };
    
    lastFrameRef.current = 0;
    rafRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isPlaying, event, speed, endTs]);
  
  // Controls
  const play = useCallback(() => {
    if (currentTs >= endTs && event) {
      setCurrentTs(event.startedAt);
    }
    setIsPlaying(true);
  }, [currentTs, endTs, event]);
  
  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);
  
  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);
  
  const seek = useCallback((progress: number) => {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const newTs = startTs + duration * clampedProgress;
    setCurrentTs(newTs);
  }, [startTs, duration]);
  
  const seekToTime = useCallback((ts: number) => {
    const clampedTs = Math.max(startTs, Math.min(endTs, ts));
    setCurrentTs(clampedTs);
  }, [startTs, endTs]);
  
  return {
    isPlaying,
    speed,
    currentTs,
    progress,
    drones,
    play,
    pause,
    togglePlay,
    setSpeed,
    seek,
    seekToTime,
  };
}
