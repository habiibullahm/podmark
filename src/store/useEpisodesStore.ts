import { create } from "zustand";
import { persist } from "zustand/middleware";
import { episodes as seedEpisodes } from "../data/mockData";
import type { Episode } from "../data/types";

interface EpisodesState {
  episodes: Episode[];
  addEpisode: (episode: Episode) => void;
}

export const useEpisodesStore = create<EpisodesState>()(
  persist(
    (set, get) => ({
      episodes: seedEpisodes,
      addEpisode: (episode) => {
        if (get().episodes.some((e) => e.id === episode.id)) return;
        set((state) => ({ episodes: [episode, ...state.episodes] }));
      },
    }),
    { name: "podbrain-episodes" },
  ),
);
