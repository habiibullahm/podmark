import { useState } from "react";
import ReactMarkdown from "react-markdown";

interface MarkdownNoteEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Scoped, minimal styling for rendered Markdown — deliberately not pulling in
// the Tailwind typography plugin for one small notes preview.
const PREVIEW_CLASS =
  "[&_a]:text-accent [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-accent/40 " +
  "[&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-text-secondary " +
  "[&_code]:rounded [&_code]:bg-bg-surface-alt [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[13px] " +
  "[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-bold [&_h1]:first:mt-0 " +
  "[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-bold [&_h2]:first:mt-0 " +
  "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-bold [&_h3]:first:mt-0 " +
  "[&_li]:mt-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_p]:first:mt-0 " +
  "[&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5";

export function MarkdownNoteEditor({ value, onChange, placeholder }: MarkdownNoteEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <section aria-labelledby="notes-heading" className="rounded-card border border-border bg-bg-surface shadow-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h2 id="notes-heading" className="text-sm font-bold text-text-primary">
          Notes
        </h2>
        <div className="flex gap-0.5 rounded-lg bg-bg-surface-alt p-0.5">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 text-[11px] font-semibold capitalize transition-colors ${
                mode === m ? "bg-bg-surface text-text-primary shadow-card" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {mode === "edit" ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={7}
          placeholder={placeholder}
          aria-labelledby="notes-heading"
          className="block w-full resize-y rounded-b-card bg-transparent px-4 py-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      ) : (
        <div className={`min-h-[180px] w-full px-4 py-3 text-[14px] leading-relaxed text-text-primary ${PREVIEW_CLASS}`}>
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-text-tertiary">Nothing to preview yet — switch to Edit and write something.</p>
          )}
        </div>
      )}
    </section>
  );
}
