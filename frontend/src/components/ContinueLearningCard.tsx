import { useNavigate } from "react-router-dom";
import { ExternalLink, NotebookPen, Play } from "lucide-react";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { usePlayer } from "../context/PlayerContext";
import { EpisodeArtwork } from "./EpisodeArtwork";

// The Home dashboard's featured card: the episode you're most likely to want
// next, on a dark hero surface with its artwork as the anchor.
export function ContinueLearningCard({ episode, hasStarted = true }: { episode: Episode; hasStarted?: boolean }) {
  const navigate = useNavigate();
  const { playEpisode, getProgressFor } = usePlayer();
  const progressSec = getProgressFor(episode.id);
  const pct = clampPercent(progressSec, episode.durationSec);

  const primaryClass =
    "inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90";
  const secondaryClass =
    "inline-flex items-center justify-center gap-2 rounded-control border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10";

  return (
    <section
      aria-label="Continue learning"
      className="relative overflow-hidden rounded-[24px] bg-hero p-5 text-white shadow-raised sm:p-6"
    >
      {/* Soft wash of the episode's own artwork color behind the content. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-35">
        <EpisodeArtwork episode={episode} className="h-full w-full scale-125 blur-3xl" />
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-r from-hero via-hero/90 to-hero/40" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
        <EpisodeArtwork
          episode={episode}
          className="h-24 w-24 shrink-0 rounded-2xl shadow-raised ring-1 ring-white/10 sm:h-36 sm:w-36"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
            {hasStarted ? "Continue learning" : "Up next"} · {episode.show}
          </p>
          <h2 className="mt-1.5 line-clamp-2 text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
            {episode.title}
          </h2>

          {episode.durationSec > 0 && (
            <div className="mt-3 max-w-md">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1.5 text-xs font-medium tabular-nums text-white/70">
                {formatTime(progressSec)} of {formatTime(episode.durationSec)} · {pct}% listened
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {episode.sourceUrl ? (
              // This episode plays outside the app, so it must never reach
              // playEpisode — that would start the simulated timer on audio the
              // user can't actually hear.
              <a href={episode.sourceUrl} target="_blank" rel="noopener noreferrer" className={primaryClass}>
                <ExternalLink size={16} aria-hidden="true" />
                Watch on YouTube
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playEpisode(episode);
                  navigate(`/episode/${episode.id}`);
                }}
                className={primaryClass}
              >
                <Play size={16} fill="currentColor" aria-hidden="true" />
                {hasStarted ? "Resume Listening" : "Start Listening"}
              </button>
            )}
            <button type="button" onClick={() => navigate(`/episode/${episode.id}#notes`)} className={secondaryClass}>
              <NotebookPen size={16} aria-hidden="true" />
              Jump to Notes
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
