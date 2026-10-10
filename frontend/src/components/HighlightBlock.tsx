import { useRef, useState } from "react";
import type { NoteBlock } from "../data/types";
import { useNotesStore } from "../store/useNotesStore";
import { useAllKnownTags } from "../lib/useAllTags";
import { TimestampChip } from "./TimestampChip";
import { TagChip } from "./TagChip";
import { TagInput } from "./TagInput";
import { useClickOutside } from "../lib/useClickOutside";
import { formatTime } from "../lib/format";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { BUTTON_DANGER, BUTTON_GHOST, BUTTON_PRIMARY, MENU, MENU_ITEM } from "../lib/ui";

export function HighlightBlock({ note }: { note: NoteBlock }) {
  const updateNote = useNotesStore((s) => s.updateNote);
  const removeNote = useNotesStore((s) => s.removeNote);
  const allKnownTags = useAllKnownTags();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draftText, setDraftText] = useState(note.text);
  const [draftTags, setDraftTags] = useState<string[]>(note.tags);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);

  if (editing) {
    return (
      <div className="rounded-card border border-accent/40 bg-bg-surface p-4 shadow-card">
        <textarea
          autoFocus
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          rows={2}
          className="w-full resize-none rounded-control border border-border bg-bg-surface-alt px-3 py-2.5 text-[14px] italic text-text-primary focus:border-accent focus:outline-none"
        />
        <div className="mt-2">
          <TagInput tags={draftTags} onChange={setDraftTags} suggestions={allKnownTags} />
        </div>
        <div className="mt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className={`${BUTTON_GHOST} px-3 py-1.5 text-xs`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (!draftText.trim()) return;
              updateNote(note.id, { text: draftText.trim(), tags: draftTags });
              setEditing(false);
            }}
            className={`${BUTTON_PRIMARY} px-4 py-1.5 text-xs`}
          >
            Save changes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border border-l-4 border-l-streak bg-bg-surface py-3.5 pl-4 pr-3.5 shadow-card">
      {confirmingDelete ? (
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13px] text-text-primary">Delete this highlight?</p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className={`${BUTTON_GHOST} px-2.5 py-1.5 text-xs`}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => removeNote(note.id)}
              className={BUTTON_DANGER}
            >
              Delete
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-2">
            <p className="text-[14px] italic leading-relaxed text-text-primary">“{note.text}”</p>
            <div className="relative shrink-0" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-label={`Highlight options — ${formatTime(note.timestampSec)}`}
                className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary hover:bg-bg-surface-alt hover:text-text-primary"
              >
                <Ellipsis size={17} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className={`${MENU} mt-1 w-36`}>
                  <button
                    type="button"
                    onClick={() => {
                      setDraftText(note.text);
                      setDraftTags(note.tags);
                      setEditing(true);
                      setMenuOpen(false);
                    }}
                    className={MENU_ITEM}
                  >
                    <Pencil size={15} aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingDelete(true);
                      setMenuOpen(false);
                    }}
                    className={`${MENU_ITEM} text-danger`}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <TimestampChip seconds={note.timestampSec} />
            <div className="flex flex-wrap justify-end gap-1.5">
              {note.tags.map((t) => (
                <TagChip key={t} label={t} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
