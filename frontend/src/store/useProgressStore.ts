import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";

interface ProgressState {
  progressByEpisode: Record<string, number>;
  setProgress: (episodeId: string, seconds: number) => void;
  clear: (episodeId: string) => void;
}

const PROGRESS_STORAGE_KEY = "podmark-progress";

// Pre-dates this store: PlayerContext used to write a raw
// `{ [episodeId]: seconds }` map straight to this key. This storage adapter
// upgrades that legacy shape into zustand persist's {state, version} envelope
// the first time it's read, so existing users don't lose saved playback
// position when this store takes over the key.
const progressStorage: StateStorage = {
  getItem: (name) => {
    let raw: string | null;
    try {
      raw = localStorage.getItem(name);
    } catch {
      return null;
    }
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && "state" in (parsed as Record<string, unknown>)) {
        return raw;
      }
      const progressByEpisode: Record<string, number> = {};
      if (parsed && typeof parsed === "object") {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value === "number" && Number.isFinite(value)) {
            progressByEpisode[key] = value;
          }
        }
      }
      return JSON.stringify({ state: { progressByEpisode }, version: 0 });
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      // ignore write failures (e.g. private browsing storage limits)
    }
  },
  removeItem: (name) => localStorage.removeItem(name),
};

export const useProgressStore = create<ProgressState>()(
  persist(
    (set) => ({
      progressByEpisode: {},
      setProgress: (episodeId, seconds) =>
        set((state) => ({
          progressByEpisode: { ...state.progressByEpisode, [episodeId]: seconds },
        })),
      clear: (episodeId) =>
        set((state) => {
          if (!(episodeId in state.progressByEpisode)) return state;
          const progressByEpisode = { ...state.progressByEpisode };
          delete progressByEpisode[episodeId];
          return { progressByEpisode };
        }),
    }),
    { name: PROGRESS_STORAGE_KEY, storage: createJSONStorage(() => progressStorage) },
  ),
);
