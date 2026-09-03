import type { NoteBlock } from "../data/types";
import { TimestampChip } from "./TimestampChip";
import { TagChip } from "./TagChip";

export function HighlightBlock({ note }: { note: NoteBlock }) {
  return (
    <div className="rounded-xl border-l-4 border-accent bg-bg-surface py-3 pl-3.5 pr-3">
      <p className="text-[14px] italic leading-relaxed text-text-primary">“{note.text}”</p>
      <div className="mt-2 flex items-center justify-between">
        <TimestampChip seconds={note.timestampSec} />
        <div className="flex gap-1.5">
          {note.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      </div>
    </div>
  );
}
