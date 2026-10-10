import { X } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { clampPercent } from "../lib/format";
import { EpisodeArtwork } from "./EpisodeArtwork";
import { PlayerTransport, SpeedButton } from "./PlayerControls";

// Persistent mini player for phones and tablets. On desktop the utility
// panel's PlayerCard takes this role instead (AppShell renders one or the
// other, never both).
export function CompactAudioPlayer() {
  const { episode, positionSec, setExpanded, clearEpisode } = usePlayer();

  if (!episode) return null;

  const pct = clampPercent(positionSec, episode.durationSec);

  return (
    <div className="border-t border-border bg-bg-surface/95 backdrop-blur">
      <div className="h-0.5 w-full bg-bg-surface-alt">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center gap-2 px-3 py-2 sm:px-4">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          aria-label="Open full screen"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
        >
          <EpisodeArtwork episode={episode} className="h-11 w-11 shrink-0 rounded-xl" />
          <span className="min-w-0">
            <span className="line-clamp-1 text-[13px] font-semibold text-text-primary">{episode.title}</span>
            <span className="line-clamp-1 text-[11px] text-text-secondary">{episode.show}</span>
          </span>
        </button>

        <PlayerTransport size="sm" />
        <SpeedButton className="hidden sm:inline-flex" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            clearEpisode();
          }}
          aria-label="Dismiss"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-surface-alt hover:text-text-primary"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
