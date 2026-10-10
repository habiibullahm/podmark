import { useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { EpisodeArtwork } from "./EpisodeArtwork";
import { PlayerTransport, SeekBar, SpeedButton } from "./PlayerControls";

export function FullScreenPlayerModal() {
  const { episode, isExpanded, setExpanded } = usePlayer();

  useEffect(() => {
    if (!isExpanded) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isExpanded, setExpanded]);

  if (!episode || !isExpanded) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm md:p-6"
      onClick={() => setExpanded(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Now Playing"
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-[440px] flex-col bg-bg-surface md:h-auto md:max-h-[90vh] md:overflow-y-auto md:rounded-[28px] md:border md:border-border md:shadow-raised"
      >
        <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-5">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-alt"
            aria-label="Collapse player"
          >
            <ChevronDown size={22} aria-hidden="true" />
          </button>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">Now Playing</p>
          <span className="w-9" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8 py-6">
          <EpisodeArtwork episode={episode} className="mb-8 aspect-square w-full max-w-[280px] rounded-[28px] shadow-raised" />
          <p className="text-center text-[13px] font-semibold text-text-secondary">{episode.show}</p>
          <h2 className="mt-1 line-clamp-2 text-center text-xl font-bold tracking-tight text-text-primary">
            {episode.title}
          </h2>
        </div>

        <div className="px-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] md:pb-8">
          <SeekBar />
          <div className="mt-6 flex justify-center">
            <PlayerTransport size="lg" />
          </div>
          <div className="mt-6 flex justify-center">
            <SpeedButton />
          </div>
        </div>
      </div>
    </div>
  );
}
