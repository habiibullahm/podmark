import { Pause, Play, RotateCcw, RotateCw } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { clampPercent, formatTime } from "../lib/format";

// Shared transport for every player surface (mini player, utility panel,
// episode workspace, full-screen modal). Only one surface renders at a time,
// so these labels stay unique on the page.
export function PlayerTransport({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const { isPlaying, togglePlay, skip } = usePlayer();
  const playSize = size === "lg" ? "h-16 w-16" : size === "md" ? "h-12 w-12" : "h-10 w-10";
  const playIcon = size === "lg" ? 28 : size === "md" ? 22 : 18;
  const skipIcon = size === "lg" ? 24 : 20;
  const skipClass =
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-bg-surface-alt hover:text-text-primary";

  return (
    <div className={`flex items-center ${size === "lg" ? "gap-8" : size === "md" ? "gap-4" : "gap-1"}`}>
      <button type="button" onClick={() => skip(-15)} className={skipClass} aria-label="Back 15 seconds">
        <RotateCcw size={skipIcon} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={togglePlay}
        className={`flex shrink-0 items-center justify-center rounded-full bg-accent text-white shadow-raised transition-transform hover:bg-accent/90 active:scale-95 ${playSize}`}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <Pause size={playIcon} fill="currentColor" aria-hidden="true" />
        ) : (
          <Play size={playIcon} fill="currentColor" className="translate-x-px" aria-hidden="true" />
        )}
      </button>
      <button type="button" onClick={() => skip(15)} className={skipClass} aria-label="Forward 15 seconds">
        <RotateCw size={skipIcon} aria-hidden="true" />
      </button>
    </div>
  );
}

export function SpeedButton({ className = "" }: { className?: string }) {
  const { speed, cycleSpeed } = usePlayer();
  return (
    <button
      type="button"
      onClick={cycleSpeed}
      aria-label={`Speed ${speed}x`}
      className={`shrink-0 rounded-lg bg-bg-surface-alt px-2.5 py-1.5 text-xs font-bold tabular-nums text-text-secondary transition-colors hover:text-text-primary ${className}`}
    >
      {speed}x
    </button>
  );
}

// Seekable progress for the loaded episode. An unknown duration (0) has no
// meaningful bar, so it shows elapsed time only.
export function SeekBar() {
  const { episode, positionSec, seek } = usePlayer();
  if (!episode) return null;
  const duration = episode.durationSec;
  const pct = clampPercent(positionSec, duration);

  return (
    <div>
      {duration > 0 && (
        <input
          type="range"
          min={0}
          max={duration}
          value={Math.min(positionSec, duration)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          aria-valuetext={`${formatTime(positionSec)} of ${formatTime(duration)}`}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-accent"
          style={{
            background: `linear-gradient(to right, var(--color-accent) ${pct}%, var(--color-bg-surface-alt) ${pct}%)`,
          }}
        />
      )}
      <div className="mt-1.5 flex justify-between text-[11px] font-medium tabular-nums text-text-tertiary">
        <span>{formatTime(positionSec)}</span>
        {duration > 0 && <span>-{formatTime(Math.max(0, duration - positionSec))}</span>}
      </div>
    </div>
  );
}
