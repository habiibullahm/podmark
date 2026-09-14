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
  "[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h1]:first:mt-0 " +
  "[&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:first:mt-0 " +
  "[&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:first:mt-0 " +
  "[&_li]:mt-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mt-2 [&_p]:first:mt-0 " +
  "[&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5";

export function MarkdownNoteEditor({ value, onChange, placeholder }: MarkdownNoteEditorProps) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">Notes</p>
        <div className="flex gap-1 rounded-lg bg-bg-surface-alt p-0.5">
          {(["edit", "preview"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
                mode === m ? "bg-accent text-white" : "text-text-secondary hover:text-text-primary"
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
          rows={5}
          placeholder={placeholder}
          className="w-full resize-none rounded-xl border border-border bg-bg-surface p-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
        />
      ) : (
        <div
          className={`min-h-[132px] w-full rounded-xl border border-border bg-bg-surface p-3 text-[14px] leading-relaxed text-text-primary ${PREVIEW_CLASS}`}
        >
          {value.trim() ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-text-tertiary">Nothing to preview yet — switch to Edit and write something.</p>
          )}
        </div>
      )}
    </div>
  );
}
