import { create } from "zustand";
import { persist } from "zustand/middleware";
import { episodes as seedEpisodes } from "../data/mockData";
import type { Episode } from "../data/types";
import { useNotesStore } from "./useNotesStore";
import { useFoldersStore } from "./useFoldersStore";
import { useProgressStore } from "./useProgressStore";

interface EpisodesState {
  episodes: Episode[];
  addEpisode: (episode: Episode) => void;
  removeEpisode: (episodeId: string) => void;
}

const EPISODES_VERSION = 2;
const SEED_EPISODE_IDS = new Set(seedEpisodes.map((e) => e.id));

export const useEpisodesStore = create<EpisodesState>()(
  persist(
    (set, get) => ({
      // The seed catalog is a demo for local development only — a real user
      // starts with an empty library and finds their own episodes via
      // Discover, rather than inheriting five fake ones with no way to
      // clear them.
      episodes: import.meta.env.DEV ? seedEpisodes : [],
      addEpisode: (episode) => {
        if (get().episodes.some((e) => e.id === episode.id)) return;
        set((state) => ({
          episodes: [{ ...episode, updatedAt: new Date().toISOString() }, ...state.episodes],
        }));
      },
      // The cascade lives here, in the store, rather than in a screen — every
      // caller gets the same guarantee that removing an episode also removes
      // everything that pointed at it.
      removeEpisode: (episodeId) => {
        set((state) => ({ episodes: state.episodes.filter((e) => e.id !== episodeId) }));
        useNotesStore.getState().removeForEpisode(episodeId);
        useFoldersStore.getState().removeEpisodeEverywhere(episodeId);
        useProgressStore.getState().clear(episodeId);
      },
    }),
    {
      name: "podmark-episodes",
      version: EPISODES_VERSION,
      migrate: (persistedState, version) => {
        const state = persistedState as EpisodesState;
        if (version < 1 && Array.isArray(state?.episodes)) {
          state.episodes = state.episodes.map((e) => ({
            ...e,
            updatedAt: e.updatedAt ?? new Date(0).toISOString(),
          }));
        }
        // Strips the demo catalog out of any already-persisted production
        // state — a production user who loaded the app before this version
        // shipped already has the seed saved locally, and would otherwise
        // keep it (and could even sync it up as if it were their own data).
        if (version < 2 && !import.meta.env.DEV && Array.isArray(state?.episodes)) {
          state.episodes = state.episodes.filter((e) => !SEED_EPISODE_IDS.has(e.id));
        }
        return state;
      },
    },
  ),
);
