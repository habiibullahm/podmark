import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { episodes as initialEpisodes } from "../data/mockData";
import type { Episode } from "../data/types";

interface PlayerContextValue {
  episode: Episode | null;
  positionSec: number;
  isPlaying: boolean;
  isExpanded: boolean;
  speed: number;
  seekFlashSec: number | null;
  playEpisode: (episode: Episode) => void;
  openEpisode: (episode: Episode) => void;
  togglePlay: () => void;
  seek: (sec: number) => void;
  skip: (deltaSec: number) => void;
  setExpanded: (expanded: boolean) => void;
  cycleSpeed: () => void;
  getProgressFor: (episodeId: string) => number;
}

const SPEEDS = [1, 1.2, 1.5, 2];
const PROGRESS_STORAGE_KEY = "podbrain-progress";

function loadStoredProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredProgress(progress: Record<string, number>) {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // ignore write failures (e.g. private browsing storage limits)
  }
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [positionSec, setPositionSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [seekFlashSec, setSeekFlashSec] = useState<number | null>(null);
  const overrideProgress = useRef<Record<string, number>>(loadStoredProgress());

  useEffect(() => {
    if (!isPlaying || !episode) return;
    const interval = setInterval(() => {
      setPositionSec((prev) => {
        const next = Math.min(prev + SPEEDS[speedIndex], episode.durationSec);
        overrideProgress.current[episode.id] = next;
        saveStoredProgress(overrideProgress.current);
        if (next >= episode.durationSec) setIsPlaying(false);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, episode, speedIndex]);

  const playEpisode = useCallback((ep: Episode) => {
    setEpisode(ep);
    const startAt = overrideProgress.current[ep.id] ?? ep.progressSec;
    setPositionSec(startAt);
    setIsPlaying(true);
  }, []);

  const openEpisode = useCallback(
    (ep: Episode) => {
      if (episode?.id === ep.id) return;
      setEpisode(ep);
      const startAt = overrideProgress.current[ep.id] ?? ep.progressSec;
      setPositionSec(startAt);
      setIsPlaying(false);
    },
    [episode],
  );

  const togglePlay = useCallback(() => {
    if (!episode) return;
    setIsPlaying((p) => !p);
  }, [episode]);

  const seek = useCallback(
    (sec: number) => {
      if (!episode) return;
      const clamped = Math.max(0, Math.min(sec, episode.durationSec));
      setPositionSec(clamped);
      overrideProgress.current[episode.id] = clamped;
      saveStoredProgress(overrideProgress.current);
      setSeekFlashSec(clamped);
      window.setTimeout(() => setSeekFlashSec(null), 900);
    },
    [episode],
  );

  const skip = useCallback(
    (deltaSec: number) => {
      if (!episode) return;
      seek(positionSec + deltaSec);
    },
    [episode, positionSec, seek],
  );

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((i) => (i + 1) % SPEEDS.length);
  }, []);

  const getProgressFor = useCallback((episodeId: string) => {
    const ep = initialEpisodes.find((e) => e.id === episodeId);
    return overrideProgress.current[episodeId] ?? ep?.progressSec ?? 0;
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        episode,
        positionSec,
        isPlaying,
        isExpanded,
        speed: SPEEDS[speedIndex],
        seekFlashSec,
        playEpisode,
        openEpisode,
        togglePlay,
        seek,
        skip,
        setExpanded: setIsExpanded,
        cycleSpeed,
        getProgressFor,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}
