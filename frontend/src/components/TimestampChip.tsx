import { Clock3 } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../lib/format";

export function TimestampChip({ seconds }: { seconds: number }) {
  const { seek, seekFlashSec } = usePlayer();
  const isFlashing = seekFlashSec === seconds;

  return (
    <button
      type="button"
      onClick={() => seek(seconds)}
      aria-label={`Seek to ${formatTime(seconds)}`}
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums transition-colors",
        isFlashing ? "bg-accent text-white" : "bg-accent/10 text-accent hover:bg-accent/20",
      ].join(" ")}
    >
      <Clock3 size={12} aria-hidden="true" />
      {formatTime(seconds)}
    </button>
  );
}
