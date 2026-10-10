import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { CARD_INTERACTIVE } from "../lib/ui";
import { EpisodeArtwork } from "./EpisodeArtwork";

interface PodcastCardProps {
  episode: Episode;
  // When set, the title links here and the whole card is clickable.
  href?: string;
  onCardClick?: () => void;
  progressSec?: number;
  meta?: ReactNode;
  // Footer actions (e.g. Add to Library). Rendered outside the title link.
  actions?: ReactNode;
}

// Artwork-first tile used by Discover results and Continue Listening.
export function PodcastCard({ episode, href, onCardClick, progressSec, meta, actions }: PodcastCardProps) {
  const pct = progressSec !== undefined ? clampPercent(progressSec, episode.durationSec) : 0;
  const showProgress = progressSec !== undefined && episode.durationSec > 0;

  return (
    <article
      onClick={onCardClick}
      className={`${CARD_INTERACTIVE} group flex h-full flex-col p-3 ${onCardClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative overflow-hidden rounded-2xl">
        <EpisodeArtwork
          episode={episode}
          className="aspect-square w-full rounded-2xl transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </div>
      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        {href ? (
          <Link
            to={href}
            onClick={(e) => e.stopPropagation()}
            className="line-clamp-2 rounded text-[14px] font-bold leading-snug text-text-primary hover:text-accent"
          >
            {episode.title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-[14px] font-bold leading-snug text-text-primary">{episode.title}</p>
        )}
        <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
        {meta && <div className="mt-1 text-xs text-text-tertiary">{meta}</div>}
        {showProgress && (
          <div className="mt-2.5">
            <div className="h-1 w-full overflow-hidden rounded-full bg-bg-surface-alt">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-1 text-[11px] font-medium tabular-nums text-text-tertiary">
              {formatTime(Math.max(0, episode.durationSec - (progressSec ?? 0)))} left
            </p>
          </div>
        )}
        {actions && <div className="mt-auto pt-3">{actions}</div>}
      </div>
    </article>
  );
}
