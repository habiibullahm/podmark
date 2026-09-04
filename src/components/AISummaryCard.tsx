interface AISummaryCardProps {
  bullets: string[];
  onRegenerate: () => void;
  onInsert: (bullet: string) => void;
}

export function AISummaryCard({ bullets, onRegenerate, onInsert }: AISummaryCardProps) {
  return (
    <div className="animate-fade-slide-up rounded-xl border border-accent/30 bg-accent/[.06] p-3.5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-accent">
          ✨ AI Summary
        </p>
        <button
          type="button"
          onClick={onRegenerate}
          className="text-xs font-medium text-text-secondary hover:text-text-primary"
        >
          ↻ Regenerate
        </button>
      </div>
      <ul className="mt-2.5 space-y-2.5">
        {bullets.map((bullet, i) => (
          <li
            key={i}
            className="animate-fade-in flex items-start justify-between gap-2"
            style={{ animationDelay: `${i * 70}ms` }}
          >
            <span className="text-[13px] leading-relaxed text-text-primary">• {bullet}</span>
            <button
              type="button"
              onClick={() => onInsert(bullet)}
              className="shrink-0 whitespace-nowrap rounded-md bg-bg-surface-alt px-2 py-1 text-[11px] font-medium text-text-secondary hover:text-accent"
            >
              + Add to notes
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
