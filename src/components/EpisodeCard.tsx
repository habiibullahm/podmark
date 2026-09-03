import { useNavigate } from "react-router-dom";
import type { Episode } from "../data/types";
import { formatTime } from "../lib/format";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { TagChip } from "./TagChip";

interface EpisodeCardProps {
  episode: Episode;
  variant?: "row-compact" | "list";
}

export function EpisodeCard({ episode, variant = "list" }: EpisodeCardProps) {
  const navigate = useNavigate();
  const { getProgressFor } = usePlayer();
  const notesForEpisode = useNotesStore((s) => s.notesForEpisode);
  const progressSec = getProgressFor(episode.id);
  const pct = Math.min(100, Math.round((progressSec / episode.durationSec) * 100));
  const noteCount = notesForEpisode(episode.id).length;

  if (variant === "row-compact") {
    return (
      <button
        type="button"
        onClick={() => navigate(`/episode/${episode.id}`)}
        className="flex w-full items-center gap-3 rounded-xl px-5 py-2.5 text-left md:border md:border-border md:px-3"
      >
        <div
          className="h-11 w-11 shrink-0 rounded-lg"
          style={{ background: episode.artworkGradient }}
        />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[14px] font-medium text-text-primary">
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
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-surface p-3 text-left"
    >
      <div
        className="h-12 w-12 shrink-0 rounded-xl"
        style={{ background: episode.artworkGradient }}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[15px] font-medium text-text-primary">
          {episode.title}
        </p>
        <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>

        <div className="mt-1.5 flex items-center gap-2">
          {episode.status === "finished" ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-success">
              ✓ Completed
            </span>
          ) : (
            <div className="h-1 w-20 overflow-hidden rounded-full bg-bg-surface-alt">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          )}
          <div className="flex gap-1">
            {episode.tags.slice(0, 2).map((t) => (
              <TagChip key={t} label={t} />
            ))}
          </div>
        </div>
      </div>
      {noteCount > 0 && (
        <span className="shrink-0 text-xs text-text-tertiary">{noteCount} notes</span>
      )}
    </button>
  );
}
