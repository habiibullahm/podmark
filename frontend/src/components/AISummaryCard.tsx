import { Plus, RefreshCw, Sparkles } from "lucide-react";

interface AISummaryCardProps {
  bullets: string[];
  onRegenerate: () => void;
  onInsert: (bullet: string) => void;
  onClear: () => void;
}

export function AISummaryCard({ bullets, onRegenerate, onInsert, onClear }: AISummaryCardProps) {
  return (
    <section
      aria-label="AI summary"
      className="animate-fade-slide-up rounded-card border border-accent/25 bg-accent/[.05] p-4 shadow-card"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-accent">
          <Sparkles size={16} aria-hidden="true" />
          AI Summary
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRegenerate}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-surface hover:text-text-primary"
          >
            <RefreshCw size={12} aria-hidden="true" />
            Regenerate
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-text-secondary hover:bg-bg-surface hover:text-danger"
          >
            Clear
          </button>
        </div>
      </div>
      <ul className="mt-3 space-y-2">
        {bullets.map((bullet, i) => (
          <li
            key={i}
            className="animate-fade-in flex items-start justify-between gap-3 rounded-xl bg-bg-surface px-3 py-2.5"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="text-[13px] leading-relaxed text-text-primary">{bullet}</span>
            <button
              type="button"
              onClick={() => onInsert(bullet)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-bg-surface-alt px-2 py-1 text-[11px] font-semibold text-text-secondary hover:text-accent"
            >
              <Plus size={12} aria-hidden="true" />
              Add to notes
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
