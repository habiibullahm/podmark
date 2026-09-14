import type { NoteBlock } from "../data/types";
import { TimestampChip } from "./TimestampChip";
import { TagChip } from "./TagChip";

export function TimestampNoteBlock({ note }: { note: NoteBlock }) {
  return (
    <div className="rounded-xl border border-border bg-bg-surface p-3">
      <TimestampChip seconds={note.timestampSec} />
      <p className="mt-2 text-[14px] leading-relaxed text-text-primary">{note.text}</p>
      {note.tags.length > 0 && (
        <div className="mt-2 flex gap-1.5">
          {note.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      )}
    </div>
  );
}
