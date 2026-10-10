interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  size?: "sm" | "md";
}

export function TagChip({ label, active, onClick, size = "sm" }: TagChipProps) {
  const isInteractive = !!onClick;
  const className = [
    "inline-flex items-center whitespace-nowrap rounded-full border font-medium transition-colors",
    size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3.5 py-1.5 text-sm",
    active
      ? "border-accent bg-accent/10 text-accent"
      : "border-border bg-bg-surface-alt text-text-secondary",
    isInteractive ? "cursor-pointer hover:border-accent/50 hover:text-accent" : "cursor-default",
  ].join(" ");

  // Purely decorative usage (no onClick) renders as a <span> — a <button> here would be
  // invalid HTML whenever a TagChip sits inside another clickable card/row.
  if (!isInteractive) {
    return <span className={className}>#{label}</span>;
  }

  return (
    <button type="button" onClick={onClick} aria-pressed={!!active} className={className}>
      #{label}
    </button>
  );
}
