import { useNavigate } from "react-router-dom";
import { Maximize2, NotebookPen, X } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../lib/format";
import { CARD } from "../lib/ui";
import { EpisodeArtwork } from "./EpisodeArtwork";
import { PlayerTransport, SeekBar, SpeedButton } from "./PlayerControls";

// Desktop player in the utility panel: artwork as the visual anchor, then
// seek, transport, speed, and a quick note at the current position.
export function PlayerCard() {
  const navigate = useNavigate();
  const { episode, positionSec, setExpanded, clearEpisode } = usePlayer();
  if (!episode) return null;

  return (
    <section aria-label="Currently playing" className={`${CARD} relative p-4`}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">Currently playing</p>
        <button
          type="button"
          onClick={clearEpisode}
          aria-label="Dismiss"
          className="-mr-1.5 flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-surface-alt hover:text-text-primary"
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-label="Open full screen"
        className="group relative mx-auto block w-4/5 overflow-hidden rounded-2xl shadow-raised"
      >
        <EpisodeArtwork episode={episode} className="aspect-square w-full rounded-2xl" />
        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
          <Maximize2 size={15} aria-hidden="true" />
        </span>
      </button>

      <div className="mt-3 text-center">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-text-primary">{episode.title}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
      </div>

      <div className="mt-3">
        <SeekBar />
      </div>

      <div className="mt-2 flex justify-center">
        <PlayerTransport size="md" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <SpeedButton />
        <button
          type="button"
          onClick={() => navigate(`/episode/${episode.id}`, { state: { quickNote: true } })}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
        >
          <NotebookPen size={14} aria-hidden="true" />
          Quick note at {formatTime(positionSec)}
        </button>
      </div>
    </section>
  );
}
