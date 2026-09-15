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
import { useProgressStore } from "../store/useProgressStore";
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
  clearEpisode: () => void;
  audioError: boolean;
}

const SPEEDS = [1, 1.2, 1.5, 2];
const PERSIST_EVERY_N_TICKS = 5;
// Caps a single tick's contribution to listened-minutes tracking, so a long
// gap between ticks (e.g. the tab was backgrounded or the laptop slept while
// still "playing") can't be misread as that much real listening time.
const MAX_TICK_GAP_MS = 5_000;

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [episode, setEpisode] = useState<Episode | null>(null);
  const [positionSec, setPositionSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [seekFlashSec, setSeekFlashSec] = useState<number | null>(null);
  const [audioError, setAudioError] = useState(false);

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

  const seekFlashTimeout = useRef<number | null>(null);
  const tickCount = useRef(0);
  // Wall-clock timestamp of the last tick while playing, so activity logging
  // is driven by real elapsed time rather than tick count (real audio and
  // the simulated timer fire at different cadences). Reset to null whenever
  // playback stops so the paused gap is never counted as listened time.
  const lastPlayingTickAt = useRef<number | null>(null);

  // Tracks the latest episode/position outside of throttling, so the
  // visibilitychange/pagehide flush below can always persist whatever's
  // actually on screen even between throttled writes.
  const latestPosition = useRef<{ episodeId: string | null; position: number }>({
    episodeId: null,
    position: 0,
  });

  // Single owner of "write progress, and decide whether to flush it to the
  // progress store now" — every code path that changes position (ticking,
  // seeking) goes through this instead of duplicating the write. The store
  // itself persists to localStorage on every write, so throttling here is
  // purely to avoid writing on every tick while playing.
  const persistProgress = useCallback((episodeId: string, position: number, immediate: boolean) => {
    latestPosition.current = { episodeId, position };
    if (immediate) {
      useProgressStore.getState().setProgress(episodeId, position);
    }
  }, []);

  // Load the real <audio> element's source whenever the active episode
  // (with a real audioUrl) changes, and apply any pending seek/autoplay once
  // its metadata is ready (setting currentTime/play before that is unreliable
  // across browsers).
  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;

    setAudioError(false);

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
        audio.play().catch(() => {
          setIsPlaying(false);
          setAudioError(true);
        });
      }
    };
    const onError = () => {
      setIsPlaying(false);
      setAudioError(true);
    };
    audio.addEventListener("loadedmetadata", onLoaded, { once: true });
    audio.addEventListener("error", onError);
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("error", onError);
    };
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
      audio.play().catch(() => {
        setIsPlaying(false);
        setAudioError(true);
      });
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
      const now = Date.now();
      if (lastPlayingTickAt.current !== null) {
        const elapsed = Math.min(now - lastPlayingTickAt.current, MAX_TICK_GAP_MS);
        useActivityStore.getState().addListenedMs(elapsed);
      }
      lastPlayingTickAt.current = now;
    } else {
      lastPlayingTickAt.current = null;
    }
    if (!isRealAudio && positionSec >= episode.durationSec) {
      setIsPlaying(false);
    }
  }, [positionSec, episode, isPlaying, isRealAudio, persistProgress]);

  // Safety net for the throttled persistence above: flush the moment the tab
  // is hidden or closed, so at most one throttle window's progress is ever
  // at risk instead of it being lost until the next multiple-of-N tick.
  useEffect(() => {
    const flush = () => {
      const { episodeId, position } = latestPosition.current;
      if (episodeId) useProgressStore.getState().setProgress(episodeId, position);
    };
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
        const startAt = useProgressStore.getState().progressByEpisode[ep.id] ?? ep.progressSec;
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
      const startAt = useProgressStore.getState().progressByEpisode[ep.id] ?? ep.progressSec;
      pendingSeek.current = startAt;
      setPositionSec(startAt);
      setIsPlaying(false);
    },
    [episode],
  );

  // Clears whatever's loaded in the player — used when the mini player is
  // dismissed, and when the loaded episode is removed from the library.
  const clearEpisode = useCallback(() => {
    setEpisode(null);
    setIsPlaying(false);
    setPositionSec(0);
    pendingSeek.current = null;
  }, []);

  const togglePlay = useCallback(() => {
    if (!episode) return;
    setIsPlaying((p) => {
      if (!p) setAudioError(false);
      return !p;
    });
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
      return useProgressStore.getState().progressByEpisode[episodeId] ?? ep?.progressSec ?? 0;
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
        clearEpisode,
        audioError,
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
