interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function SectionHeader({ title, actionLabel, onAction }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 mb-3 md:px-0">
      <h2 className="text-[17px] font-semibold text-text-primary">{title}</h2>
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="text-sm font-medium text-accent hover:text-accent/80"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
