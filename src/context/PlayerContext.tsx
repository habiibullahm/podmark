import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useActivityStore } from "../store/useActivityStore";
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
const PROGRESS_STORAGE_KEY = "podmark-progress";
const PERSIST_EVERY_N_TICKS = 5;

function loadStoredProgress(): Record<string, number> {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isFinite(value)) {
        result[key] = value;
      }
    }
    return result;
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

  const isRealAudio = !!episode?.audioUrl;

  // Real playback engine for episodes that have a real audioUrl (from iTunes
  // search). Episodes without one (the original mock catalog) keep using the
  // simulated timer below — both feed the same positionSec/isPlaying state,
  // so every other component is unaware of which engine is driving them.
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  if (audioElRef.current === null && typeof Audio !== "undefined") {
    audioElRef.current = new Audio();
  }
  const pendingSeek = useRef<number | null>(null);

  // Lazy-init without re-reading localStorage on every render (useRef has no
  // lazy-initializer form, so a plain useRef(loadStoredProgress()) would
  // re-invoke loadStoredProgress() on every render even though only the
  // first result is ever kept).
  const overrideProgress = useRef<Record<string, number>>({});
  const progressLoaded = useRef(false);
  if (!progressLoaded.current) {
    overrideProgress.current = loadStoredProgress();
    progressLoaded.current = true;
  }

  const seekFlashTimeout = useRef<number | null>(null);
  const tickCount = useRef(0);

  // Single owner of "write progress, and decide whether to flush it to
  // localStorage now" — every code path that changes position (ticking,
  // seeking) goes through this instead of duplicating the write.
  const persistProgress = useCallback((episodeId: string, position: number, immediate: boolean) => {
    overrideProgress.current[episodeId] = position;
    if (immediate) {
      saveStoredProgress(overrideProgress.current);
    }
  }, []);

  // Load the real <audio> element's source whenever the active episode
  // (with a real audioUrl) changes, and apply any pending seek/autoplay once
  // its metadata is ready (setting currentTime/play before that is unreliable
  // across browsers).
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    if (!episode?.audioUrl) {
      audio.pause();
      audio.removeAttribute("src");
      return;
    }

    audio.src = episode.audioUrl;
    audio.load();
    const onLoaded = () => {
      if (pendingSeek.current !== null) {
        audio.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
      if (isPlaying) {
        audio.play().catch(() => setIsPlaying(false));
      }
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    return () => audio.removeEventListener("loadedmetadata", onLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id, episode?.audioUrl]);

  // Real audio drives positionSec from its own timeupdate event instead of a
  // simulated tick.
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio || !isRealAudio) return;
    const onTimeUpdate = () => {
      tickCount.current += 1;
      setPositionSec(audio.currentTime);
    };
    const onEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [isRealAudio]);

  // Keep the real element's play/pause state and speed in sync with our state.
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio || !isRealAudio) return;
    audio.playbackRate = SPEEDS[speedIndex];
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, isRealAudio, speedIndex]);

  // Simulated tick for mock episodes only — pure updater, no side effects
  // inside it, so this stays safe under React StrictMode's dev-mode
  // double-invocation of updaters.
  useEffect(() => {
    if (!isPlaying || !episode || isRealAudio) return;
    const interval = setInterval(() => {
      tickCount.current += 1;
      setPositionSec((prev) => Math.min(prev + SPEEDS[speedIndex], episode.durationSec));
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, episode, speedIndex, isRealAudio]);

  // Side effects (ref mutation, throttled persistence, end-of-episode stop
  // for simulated playback) live here, reacting to positionSec instead of
  // running inside a setState updater.
  useEffect(() => {
    if (!episode) return;
    const shouldPersistNow = !isPlaying || tickCount.current % PERSIST_EVERY_N_TICKS === 0;
    persistProgress(episode.id, positionSec, shouldPersistNow);
    if (isPlaying) {
      useActivityStore.getState().logToday();
    }
    if (!isRealAudio && positionSec >= episode.durationSec) {
      setIsPlaying(false);
    }
  }, [positionSec, episode, isPlaying, isRealAudio, persistProgress]);

  // Safety net for the throttled persistence above: flush the moment the tab
  // is hidden or closed, so at most one throttle window's progress is ever
  // at risk instead of it being lost until the next multiple-of-N tick.
  useEffect(() => {
    const flush = () => saveStoredProgress(overrideProgress.current);
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", flush);
    };
  }, []);

  const playEpisode = useCallback(
    (ep: Episode) => {
      if (episode?.id !== ep.id) {
        const startAt = overrideProgress.current[ep.id] ?? ep.progressSec;
        pendingSeek.current = startAt;
        setPositionSec(startAt);
      }
      setEpisode(ep);
      setIsPlaying(true);
    },
    [episode],
  );

  const openEpisode = useCallback(
    (ep: Episode) => {
      if (episode?.id === ep.id) return;
      setEpisode(ep);
      const startAt = overrideProgress.current[ep.id] ?? ep.progressSec;
      pendingSeek.current = startAt;
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
      const max = episode.durationSec || Number.POSITIVE_INFINITY;
      const clamped = Math.max(0, Math.min(sec, max));
      if (isRealAudio && audioElRef.current) {
        audioElRef.current.currentTime = clamped;
      }
      pendingSeek.current = clamped;
      setPositionSec(clamped);
      persistProgress(episode.id, clamped, true);
      setSeekFlashSec(clamped);
      if (seekFlashTimeout.current !== null) {
        window.clearTimeout(seekFlashTimeout.current);
      }
      seekFlashTimeout.current = window.setTimeout(() => setSeekFlashSec(null), 900);
    },
    [episode, isRealAudio, persistProgress],
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

  // For the episode currently loaded in the player, read the live state
  // directly instead of the ref — the ref is only updated in the effect
  // above, which runs one commit behind the positionSec change, so reading
  // it here for the active episode would show a value ~1 tick stale
  // relative to what CompactAudioPlayer/FullScreenPlayerModal display.
  const getProgressFor = useCallback(
    (episodeId: string) => {
      if (episode?.id === episodeId) return positionSec;
      const ep = useEpisodesStore.getState().episodes.find((e) => e.id === episodeId);
      return overrideProgress.current[episodeId] ?? ep?.progressSec ?? 0;
    },
    [episode, positionSec],
  );

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
