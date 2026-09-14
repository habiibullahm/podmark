import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../lib/format";

export function TimestampChip({ seconds }: { seconds: number }) {
  const { seek, seekFlashSec } = usePlayer();
  const isFlashing = seekFlashSec === seconds;

  return (
    <button
      type="button"
      onClick={() => seek(seconds)}
      className={[
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition-colors",
        isFlashing ? "bg-accent text-white" : "bg-accent/15 text-accent hover:bg-accent/25",
      ].join(" ")}
    >
      🕐 {formatTime(seconds)}
    </button>
  );
}
