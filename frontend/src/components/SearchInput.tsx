import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  // Override when the field isn't a search (e.g. pasting a link).
  icon?: LucideIcon;
  size?: "md" | "lg";
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search notes, episodes, tags...",
  icon: Icon = Search,
  size = "md",
}: SearchInputProps) {
  return (
    <label
      className={`flex items-center gap-2.5 rounded-control border border-border bg-bg-surface px-3.5 shadow-card transition-colors focus-within:border-accent ${
        size === "lg" ? "py-3.5" : "py-2.5"
      }`}
    >
      <Icon size={size === "lg" ? 20 : 18} className="shrink-0 text-text-tertiary" aria-hidden="true" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`w-full min-w-0 bg-transparent text-text-primary placeholder:text-text-tertiary focus:outline-none ${
          size === "lg" ? "text-[15px]" : "text-sm"
        }`}
      />
    </label>
  );
}
