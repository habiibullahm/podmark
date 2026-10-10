import { useMemo, useState } from "react";
import { FileText, Search } from "lucide-react";
import type { TranscriptSegment } from "../data/types";
import { usePlayer } from "../context/PlayerContext";
import { formatTime } from "../lib/format";
import { CARD } from "../lib/ui";

export function TranscriptView({ segments, onClear }: { segments: TranscriptSegment[]; onClear: () => void }) {
  const [query, setQuery] = useState("");
  const { seek, seekFlashSec } = usePlayer();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => s.text.toLowerCase().includes(q));
  }, [segments, query]);

  return (
    <section aria-label="Transcript" className={`${CARD} p-4`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-text-primary">
          <FileText size={16} className="text-text-tertiary" aria-hidden="true" />
          Transcript
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-surface-alt hover:text-danger"
        >
          Clear
        </button>
      </div>
      <label className="mt-3 flex items-center gap-2 rounded-control border border-border bg-bg-surface-alt px-3 py-2 focus-within:border-accent">
        <Search size={15} className="shrink-0 text-text-tertiary" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the transcript..."
          aria-label="Search the transcript"
          className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </label>
      <div className="thin-scrollbar mt-2 max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-text-tertiary">No matches for "{query}".</p>
        ) : (
          filtered.map((seg) => (
            <button
              key={`${seg.start}-${seg.end}`}
              type="button"
              onClick={() => seek(seg.start)}
              className={`flex w-full items-start gap-3 rounded-lg px-2 py-1.5 text-left hover:bg-bg-surface-alt ${
                seekFlashSec === seg.start ? "bg-accent/15" : ""
              }`}
            >
              <span className="mt-0.5 shrink-0 text-[11px] font-bold tabular-nums text-accent">{formatTime(seg.start)}</span>
              <span className="text-[13px] leading-relaxed text-text-primary">{seg.text}</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
