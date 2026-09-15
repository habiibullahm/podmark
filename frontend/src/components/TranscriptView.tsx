import { useMemo, useState } from "react";
import type { TranscriptSegment } from "../data/types";
import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../lib/format";

export function TranscriptView({ segments, onClear }: { segments: TranscriptSegment[]; onClear: () => void }) {
  const [query, setQuery] = useState("");
  const { seek, seekFlashSec } = usePlayer();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-text-primary">📝 Transcript</p>
        <button
          type="button"
          onClick={onClear}
          className="text-xs font-medium text-text-secondary hover:text-red-400"
        >
          Clear
        </button>
      </div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the transcript..."
        className="mt-2 w-full rounded-lg border border-border bg-bg-surface-alt px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
      />
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-tertiary">No matches for "{query}".</p>
        ) : (
          filtered.map((seg) => (
            <button
              key={`${seg.start}-${seg.end}`}
              type="button"
              onClick={() => seek(seg.start)}
              className={`flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-bg-surface-alt ${
                seekFlashSec === seg.start ? "bg-accent/15" : ""
              }`}
            >
              <span className="mt-0.5 shrink-0 text-[11px] font-semibold text-accent">{formatTime(seg.start)}</span>
              <span className="text-[13px] leading-relaxed text-text-primary">{seg.text}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
