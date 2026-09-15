interface EmptyStateProps {
  icon: string;
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, text, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="mx-5 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-10 text-center md:col-span-full md:mx-0">
      <span className="text-2xl">{icon}</span>
      <p className="max-w-[240px] text-sm text-text-secondary">{text}</p>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
