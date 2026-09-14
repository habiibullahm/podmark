import { create } from "zustand";
import { persist } from "zustand/middleware";
import { episodes as seedEpisodes } from "../data/mockData";
import type { Episode } from "../data/types";

// A pasted transcript is bounded before it's stored: ~5k tokens is plenty of
// grounding for a summary, and it keeps a handful of long videos from filling
// localStorage. Cut on a sentence boundary so the model never sees a word
// sliced in half.
const MAX_DESCRIPTION_CHARS = 20_000;

function truncateAtSentence(text: string): string {
  if (text.length <= MAX_DESCRIPTION_CHARS) return text;
  const clipped = text.slice(0, MAX_DESCRIPTION_CHARS);
  const lastSentenceEnd = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("! "),
    clipped.lastIndexOf("? "),
  );
  return lastSentenceEnd > 0 ? clipped.slice(0, lastSentenceEnd + 1) : clipped;
}

interface EpisodesState {
  episodes: Episode[];
  addEpisode: (episode: Episode) => void;
  setEpisodeDescription: (episodeId: string, description: string) => void;
}

export const useEpisodesStore = create<EpisodesState>()(
  persist(
    (set, get) => ({
      episodes: seedEpisodes,
      addEpisode: (episode) => {
        if (get().episodes.some((e) => e.id === episode.id)) return;
        set((state) => ({ episodes: [episode, ...state.episodes] }));
      },
      setEpisodeDescription: (episodeId, description) =>
        set((state) => ({
          episodes: state.episodes.map((e) =>
            e.id === episodeId ? { ...e, description: truncateAtSentence(description.trim()) } : e,
          ),
        })),
    }),
    { name: "podmark-episodes" },
  ),
);
