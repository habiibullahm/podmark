import { useMemo } from "react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";

// Every tag in use anywhere — episode genre tags plus every note/highlight's
// own tags — for tag-input autocomplete. Cross-show by design: a tag typed
// on one episode should suggest itself on any other.
export function useAllKnownTags(): string[] {
  const episodes = useEpisodesStore((s) => s.episodes);
  const notes = useNotesStore((s) => s.notes);
  return useMemo(
    () => Array.from(new Set([...episodes.flatMap((e) => e.tags), ...notes.flatMap((n) => n.tags)])).sort(),
    [episodes, notes],
  );
}

export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}
