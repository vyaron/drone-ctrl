import { useEffect, useMemo, useRef, useState } from 'react';
import { type MissionMoment } from '../utils/missionReplay';

interface MissionNarrationState {
  activeMoment: MissionMoment | null;
  recentMoments: MissionMoment[];
}

interface MissionNarrationOptions {
  eventId: string | null;
  moments: MissionMoment[];
  currentTs: number;
  isPlaying: boolean;
  enabled: boolean;
}

const MAX_RECENT_MOMENTS = 4;

function getSpeechSynthesisHandle(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  return window.speechSynthesis;
}

export function useMissionNarration({
  eventId,
  moments,
  currentTs,
  isPlaying,
  enabled,
}: MissionNarrationOptions): MissionNarrationState {
  const [voicesLoaded, setVoicesLoaded] = useState(false);
  const [activeMomentId, setActiveMomentId] = useState<string | null>(null);
  const [recentMomentIds, setRecentMomentIds] = useState<string[]>([]);

  const spokenMomentIdsRef = useRef<Set<string>>(new Set());
  const lastTsRef = useRef(currentTs);
  const lastEventIdRef = useRef<string | null>(eventId);

  useEffect(() => {
    const synth = getSpeechSynthesisHandle();
    if (!synth) {
      return;
    }

    const markVoicesLoaded = () => setVoicesLoaded(true);
    markVoicesLoaded();
    synth.addEventListener('voiceschanged', markVoicesLoaded);

    return () => {
      synth.removeEventListener('voiceschanged', markVoicesLoaded);
    };
  }, []);

  useEffect(() => {
    const synth = getSpeechSynthesisHandle();

    if (lastEventIdRef.current !== eventId) {
      lastEventIdRef.current = eventId;
      spokenMomentIdsRef.current = new Set();
      setRecentMomentIds([]);
      setActiveMomentId(null);
      synth?.cancel();
    }
  }, [eventId]);

  useEffect(() => {
    const synth = getSpeechSynthesisHandle();
    if (!isPlaying) {
      synth?.cancel();
    }
  }, [isPlaying]);

  useEffect(() => {
    const synth = getSpeechSynthesisHandle();
    const lastTs = lastTsRef.current;
    const movedBackward = currentTs + 1000 < lastTs;

    if (movedBackward) {
      synth?.cancel();
      const seededMoments = moments.filter(moment => moment.ts < currentTs);
      spokenMomentIdsRef.current = new Set(seededMoments.map(moment => moment.id));
      setRecentMomentIds(seededMoments.slice(-MAX_RECENT_MOMENTS).map(moment => moment.id));
      setActiveMomentId(seededMoments.at(-1)?.id ?? null);
    }

    const latestVisibleMoment = [...moments].reverse().find(moment => moment.ts <= currentTs) ?? null;
    if (latestVisibleMoment) {
      setActiveMomentId(latestVisibleMoment.id);
    }

    if (!isPlaying) {
      lastTsRef.current = currentTs;
      return;
    }

    const crossedMoments = moments.filter(moment => {
      return moment.ts > lastTs && moment.ts <= currentTs && !spokenMomentIdsRef.current.has(moment.id);
    });

    if (crossedMoments.length > 0) {
      setRecentMomentIds(previous => {
        const next = [...previous, ...crossedMoments.map(moment => moment.id)];
        return next.slice(-MAX_RECENT_MOMENTS);
      });

      for (const moment of crossedMoments) {
        spokenMomentIdsRef.current.add(moment.id);
      }

      const lastCrossedMoment = crossedMoments[crossedMoments.length - 1];
      setActiveMomentId(lastCrossedMoment.id);

      if (enabled && synth && voicesLoaded) {
        for (const moment of crossedMoments) {
          const utterance = new SpeechSynthesisUtterance(moment.narration);
          const preferredVoice = synth.getVoices().find(voice => /en/i.test(voice.lang));
          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          utterance.rate = 1;
          utterance.pitch = 1;
          utterance.volume = 1;
          synth.speak(utterance);
        }
      }
    }

    lastTsRef.current = currentTs;
  }, [currentTs, enabled, isPlaying, moments, voicesLoaded]);

  const activeMoment = useMemo(
    () => moments.find(moment => moment.id === activeMomentId) ?? null,
    [activeMomentId, moments]
  );

  const recentMoments = useMemo(
    () => recentMomentIds
      .map(id => moments.find(moment => moment.id === id) ?? null)
      .filter((moment): moment is MissionMoment => moment !== null),
    [moments, recentMomentIds]
  );

  return {
    activeMoment,
    recentMoments,
  };
}