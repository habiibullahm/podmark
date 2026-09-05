import type { Episode, EpisodeStatus, NoteBlock } from "../data/types";

/**
 * Live playback progress can outrun the static mock `status` field (e.g. an
 * "in-progress" episode gets played to the end). Derive the status a user
 * should actually see from real progress instead of trusting the static field.
 */
export function getEffectiveStatus(episode: Episode, progressSec: number): EpisodeStatus {
  // A duration of 0 means "unknown", not "zero-length" — YouTube's metadata
  // endpoint doesn't expose one. There's nothing to compare progress against,
  // so trust the stored status instead of reading 0 >= 0 as finished.
  if (episode.durationSec <= 0) return episode.status;
  if (progressSec >= episode.durationSec) return "finished";
  if (progressSec > 0) return "in-progress";
  return episode.status;
}

export function filterNotesByEpisode(notes: NoteBlock[], episodeId: string): NoteBlock[] {
  return notes.filter((n) => n.episodeId === episodeId);
}
