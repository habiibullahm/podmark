interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function TagChip({ label, active, onClick, size = "sm" }: TagChipProps) {
  const isInteractive = !!onClick;
  const className = [
    "inline-flex items-center whitespace-nowrap rounded-full border transition-colors",
    size === "sm" ? "px-3 py-1 text-xs font-medium" : "px-3.5 py-1.5 text-sm font-medium",
    active
      ? "bg-accent/15 border-accent text-accent"
      : "bg-bg-surface-alt border-border text-text-secondary",
    isInteractive ? "cursor-pointer hover:border-accent/60" : "cursor-default",
  ].join(" ");

  // Purely decorative usage (no onClick) renders as a <span> — a <button> here would be
  // invalid HTML whenever a TagChip sits inside another clickable card/row.
  if (!isInteractive) {
    return <span className={className}>#{label}</span>;
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      #{label}
    </button>
  );
}
