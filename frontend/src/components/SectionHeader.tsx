import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  // Optional trailing slot for anything richer than a single text action.
  children?: ReactNode;
}

export function SectionHeader({ title, actionLabel, onAction, children }: SectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-lg font-bold tracking-tight text-text-primary">{title}</h2>
      {children}
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex items-center gap-0.5 rounded-lg text-sm font-semibold text-accent hover:text-accent/80"
        >
          {actionLabel}
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
