import type { Episode, EpisodeStatus, NoteBlock } from "../data/types";

/**
 * Live playback progress can outrun the static mock `status` field (e.g. an
 * "in-progress" episode gets played to the end). Derive the status a user
 * should actually see from real progress instead of trusting the static field.
 */
export function getEffectiveStatus(episode: Episode, progressSec: number): EpisodeStatus {
  // A duration of 0 means "unknown", not "zero-length" — YouTube exposes none,
  // and iTunes results can omit one too. It can't tell us whether the episode
  // is finished (0 >= 0 would say yes), but real progress still means started.
  if (episode.durationSec <= 0) return progressSec > 0 ? "in-progress" : episode.status;
  if (progressSec >= episode.durationSec) return "finished";
  if (progressSec > 0) return "in-progress";
  return episode.status;
}

export function filterNotesByEpisode(notes: NoteBlock[], episodeId: string): NoteBlock[] {
  return notes.filter((n) => n.episodeId === episodeId);
}
