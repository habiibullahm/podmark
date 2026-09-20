import { useRef, useState } from "react";
import { TagChip } from "./TagChip";
import { normalizeTag } from "../lib/useAllTags";
import { useClickOutside } from "../lib/useClickOutside";

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions: string[];
  placeholder?: string;
}

export function TagInput({ tags, onChange, suggestions, placeholder = "Add a tag..." }: TagInputProps) {
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false), open);

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw);
    setDraft("");
    setOpen(false);
    if (!tag || tags.includes(tag)) return;
    onChange([...tags, tag]);
  };

  const removeTag = (tag: string) => onChange(tags.filter((t) => t !== tag));

  const matches = suggestions.filter(
    (t) => !tags.includes(t) && (draft.trim() === "" || t.includes(draft.trim().toLowerCase())),
  );

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg-surface-alt px-2 py-1.5 focus-within:border-accent">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              aria-label={`Remove tag ${tag}`}
              className="text-accent/70 hover:text-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          value={draft}
          aria-label="Add a tag"
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft.replace(/,$/, ""));
            } else if (e.key === "Backspace" && draft === "" && tags.length > 0) {
              removeTag(tags[tags.length - 1]);
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-bg-surface p-1 shadow-lg">
          {matches.slice(0, 8).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => addTag(tag)}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs text-text-primary hover:bg-bg-surface-alt"
            >
              <TagChip label={tag} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
