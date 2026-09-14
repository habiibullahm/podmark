import { useNavigate } from "react-router-dom";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { usePlayer } from "../context/PlayerContext";
import { EpisodeArtwork } from "./EpisodeArtwork";

export function CurrentlyLearningWidget({
  episode,
  hasStarted = true,
}: {
  episode: Episode;
  hasStarted?: boolean;
}) {
  const navigate = useNavigate();
  const { playEpisode, getProgressFor } = usePlayer();
  const progressSec = getProgressFor(episode.id);
  const pct = clampPercent(progressSec, episode.durationSec);

  return (
    <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0 md:h-full">
      <div className="flex items-center gap-3">
        <EpisodeArtwork episode={episode} className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            {episode.show}
          </p>
          <p className="line-clamp-2 text-[15px] font-semibold leading-tight text-text-primary">
            {episode.title}
          </p>
        </div>
      </div>

      {episode.durationSec > 0 && (
        <div className="mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-text-secondary">
            {formatTime(progressSec)} / {formatTime(episode.durationSec)}
          </p>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {episode.sourceUrl ? (
          // This episode plays outside the app, so it must never reach
          // playEpisode — that would start the simulated timer on audio the
          // user can't actually hear.
          <a
            href={episode.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            <span className="inline-flex items-center leading-none">▶</span>
            Watch on YouTube ↗
          </a>
        ) : (
          <button
            type="button"
            onClick={() => {
              playEpisode(episode);
              navigate(`/episode/${episode.id}`);
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90"
          >
            <span className="inline-flex items-center leading-none">▶</span>
            {hasStarted ? "Resume Listening" : "Start Listening"}
          </button>
        )}
        <button
          type="button"
          onClick={() => navigate(`/episode/${episode.id}#notes`)}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-accent/60"
        >
          <span className="inline-flex items-center leading-none">📝</span>
          Jump to Notes
        </button>
      </div>
    </div>
  );
}
