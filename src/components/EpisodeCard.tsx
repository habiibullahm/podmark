import { useNavigate } from "react-router-dom";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { getEffectiveStatus, filterNotesByEpisode } from "../lib/episodes";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { TagChip } from "./TagChip";
import { EpisodeArtwork } from "./EpisodeArtwork";

interface EpisodeCardProps {
  episode: Episode;
  variant?: "row-compact" | "list";
}

export function EpisodeCard({ episode, variant = "list" }: EpisodeCardProps) {
  const navigate = useNavigate();
  const { getProgressFor } = usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const progressSec = getProgressFor(episode.id);
  const pct = clampPercent(progressSec, episode.durationSec);
  const status = getEffectiveStatus(episode, progressSec);
  const noteCount = filterNotesByEpisode(allNotes, episode.id).length;

  if (variant === "row-compact") {
    return (
      <button
        type="button"
        onClick={() => navigate(`/episode/${episode.id}`)}
        className="flex w-full items-center gap-3 rounded-xl px-5 py-2.5 text-left md:items-start md:border md:border-border md:px-3"
      >
        <EpisodeArtwork episode={episode} className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[14px] font-medium leading-snug text-text-primary md:line-clamp-2">
            {episode.title}
          </p>
          <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-surface-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="shrink-0 text-xs text-text-tertiary">
          {formatTime(episode.durationSec - progressSec)} left
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => navigate(`/episode/${episode.id}`)}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-bg-surface p-3 pb-4 text-left"
    >
      <EpisodeArtwork episode={episode} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-text-primary">
          {episode.title}
        </p>
        <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {status === "finished" ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-success">
              ✓ Completed
            </span>
          ) : (
            <div className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-bg-surface-alt">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex flex-wrap gap-1">
            {episode.tags.slice(0, 2).map((t) => (
              <TagChip key={t} label={t} />
            ))}
          </div>
        </div>
      </div>
      {noteCount > 0 && (
        <span className="shrink-0 text-xs text-text-tertiary">
          {noteCount} note{noteCount === 1 ? "" : "s"}
        </span>
      )}
    </button>
  );
}
