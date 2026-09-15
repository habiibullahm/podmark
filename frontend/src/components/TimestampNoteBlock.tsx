import { useRef, useState } from "react";
import type { NoteBlock } from "../data/types";
import { useNotesStore } from "../store/useNotesStore";
import { TimestampChip } from "./TimestampChip";
import { TagChip } from "./TagChip";
import { useClickOutside } from "../lib/useClickOutside";
import { formatTime } from "../lib/format";

export function TimestampNoteBlock({ note, episodeTags }: { note: NoteBlock; episodeTags: string[] }) {
  const updateNote = useNotesStore((s) => s.updateNote);
  const removeNote = useNotesStore((s) => s.removeNote);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draftText, setDraftText] = useState(note.text);
  const [draftTag, setDraftTag] = useState(note.tags[0] ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  const tagOptions = Array.from(new Set([...episodeTags, ...note.tags]));

  if (editing) {
    return (
      <div className="rounded-xl border border-accent/40 bg-bg-surface p-3">
        <TimestampChip seconds={note.timestampSec} />
        <textarea
          autoFocus
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={2}
          className="mt-2 w-full resize-none rounded-lg border border-border bg-bg-surface-alt px-3 py-2 text-[14px] text-text-primary focus:border-accent focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <select
            value={draftTag}
            onChange={(e) => setDraftTag(e.target.value)}
            className="rounded-lg border border-border bg-bg-surface-alt px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
          >
            <option value="">No tag</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>
                #{t}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!draftText.trim()) return;
                updateNote(note.id, { text: draftText.trim(), tags: draftTag ? [draftTag] : [] });
                setEditing(false);
              }}
              className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white"
            >
              Save changes
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3">
      {confirmingDelete ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-text-primary">Delete this note?</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => removeNote(note.id)}
              className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <TimestampChip seconds={note.timestampSec} />
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`Note options — ${formatTime(note.timestampSec)}`}
                className="text-text-tertiary hover:text-text-secondary"
              >
                ⋯
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-20 mt-1 w-32 rounded-xl border border-border bg-bg-surface p-1.5 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftText(note.text);
                      setDraftTag(note.tags[0] ?? "");
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-text-primary hover:bg-bg-surface-alt"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(true);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-red-400 hover:bg-bg-surface-alt"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-text-primary">{note.text}</p>
          {note.tags.length > 0 && (
            <div className="mt-2 flex gap-1.5">
              {note.tags.map((t) => (
                <TagChip key={t} label={t} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
