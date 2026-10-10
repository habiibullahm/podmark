import type { LucideIcon } from "lucide-react";
import { BUTTON_PRIMARY } from "../lib/ui";

interface EmptyStateProps {
  icon: LucideIcon;
  text: string;
  title?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon: Icon, title, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="col-span-full flex flex-col items-center gap-2 rounded-card border border-dashed border-border bg-bg-surface/60 px-6 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Icon size={22} aria-hidden="true" />
      </span>
      {title && <p className="mt-1 text-[15px] font-bold text-text-primary">{title}</p>}
      <p className="max-w-[300px] text-sm text-text-secondary">{text}</p>
      {actionLabel && (
        <button type="button" onClick={onAction} className={`mt-2 ${BUTTON_PRIMARY}`}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
