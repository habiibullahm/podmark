import { usePlayer } from "../context/PlayerContext";
import { clampPercent, formatTime } from "../lib/format";
import { EpisodeArtwork } from "./EpisodeArtwork";

export function FullScreenPlayerModal() {
  const {
    episode,
    positionSec,
    isPlaying,
    isExpanded,
    speed,
    togglePlay,
    skip,
    seek,
    cycleSpeed,
    setExpanded,
  } = usePlayer();

  if (!episode || !isExpanded) return null;

  const pct = clampPercent(positionSec, episode.durationSec);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 md:p-6">
      <div className="flex h-full w-full max-w-[430px] flex-col bg-bg-primary md:h-auto md:max-h-[90vh] md:overflow-y-auto md:rounded-3xl md:border md:border-border md:shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-[calc(env(safe-area-inset-top)+1rem)] md:pt-6">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-xl text-text-secondary"
            aria-label="Collapse player"
          >
            ⌄
          </button>
          <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Now Playing
          </p>
          <span className="w-5" />
        </div>

        <div className="flex flex-1 flex-col items-center justify-center px-8">
          <EpisodeArtwork episode={episode} className="mb-8 h-64 w-64 rounded-3xl shadow-2xl" />
          <p className="text-center text-[13px] font-medium text-text-secondary">
            {episode.show}
          </p>
          <h2 className="mt-1 line-clamp-2 text-center text-xl font-semibold text-text-primary">
            {episode.title}
          </h2>
        </div>

        <div className="px-6 pb-10">
          <input
            type="range"
            min={0}
            max={episode.durationSec}
            value={positionSec}
            onChange={(e) => seek(Number(e.target.value))}
            className="w-full accent-accent"
            style={{
              background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-bg-surface-alt) ${pct}%)`,
            }}
          />
          <div className="mt-1 flex justify-between text-xs text-text-secondary">
            <span>{formatTime(positionSec)}</span>
            <span>-{formatTime(episode.durationSec - positionSec)}</span>
          </div>

          <div className="mt-8 flex items-center justify-center gap-8">
            <button
              type="button"
              onClick={() => skip(-15)}
              className="text-2xl text-text-primary"
              aria-label="Back 15 seconds"
            >
              ⏪
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-2xl text-white"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>
            <button
              type="button"
              onClick={() => skip(15)}
              className="text-2xl text-text-primary"
              aria-label="Forward 15 seconds"
            >
              ⏩
            </button>
          </div>

          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={cycleSpeed}
              className="rounded-full bg-bg-surface-alt px-4 py-1.5 text-sm font-semibold text-text-secondary"
            >
              {speed}x speed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
