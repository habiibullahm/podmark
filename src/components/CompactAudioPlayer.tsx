import { usePlayer } from "../context/PlayerContext";
import { clampPercent } from "../lib/format";

export function CompactAudioPlayer() {
  const { episode, positionSec, isPlaying, togglePlay, skip, speed, cycleSpeed, setExpanded } =
    usePlayer();

  if (!episode) return null;

  const pct = clampPercent(positionSec, episode.durationSec);

  return (
    <div className="border-t border-border bg-bg-surface">
      <div className="h-1 w-full bg-bg-surface-alt">
        <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
      <div className="mx-auto flex max-w-3xl items-center gap-2.5 px-3 py-2 md:px-8">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
        >
          <div
            className="h-9 w-9 shrink-0 rounded-lg"
            style={{ background: episode.artworkGradient }}
          />
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-medium text-text-primary">
              {episode.title}
            </p>
            <p className="line-clamp-1 text-[11px] text-text-secondary">{episode.show}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={() => skip(-15)}
            className="shrink-0 rounded-full p-2 text-text-secondary hover:text-text-primary"
            aria-label="Back 15 seconds"
          >
            ⏪
          </button>
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? "⏸" : "▶"}
          </button>
          <button
            type="button"
            onClick={() => skip(15)}
            className="shrink-0 rounded-full p-2 text-text-secondary hover:text-text-primary"
            aria-label="Forward 15 seconds"
          >
            ⏩
          </button>
        </div>
        <button
          type="button"
          onClick={cycleSpeed}
          className="shrink-0 rounded-md bg-bg-surface-alt px-1.5 py-1 text-[11px] font-semibold text-text-secondary"
        >
          {speed}x
        </button>
      </div>
    </div>
  );
}
