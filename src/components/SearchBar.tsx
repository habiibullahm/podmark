interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: string; // override when the field isn't a search (e.g. pasting a link)
}

export function SearchBar({ value, onChange, placeholder, icon = "🔍" }: SearchBarProps) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-bg-surface-alt px-3 py-2.5">
      <span className="text-text-tertiary">{icon}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search notes, episodes, tags..."}
        className="w-full bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
    </div>
  );
}
