import { useNavigate } from "react-router-dom";
import type { NoteBlock } from "../data/types";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { formatTime } from "../lib/format";
import { TagChip } from "./TagChip";

export function TakeawayCard({ note }: { note: NoteBlock }) {
  const navigate = useNavigate();
  const episodes = useEpisodesStore((s) => s.episodes);
  const episode = episodes.find((e) => e.id === note.episodeId);

  return (
    <div className="w-full rounded-2xl border border-border bg-bg-surface p-3 pb-4">
      <span className="text-sm text-text-tertiary">
        {note.type === "highlight" ? "⭐" : "🕐"}
      </span>

      <p
        className={`mt-2 line-clamp-3 text-[14px] leading-snug text-text-primary ${
          note.type === "highlight" ? "italic" : ""
        }`}
      >
        {note.text}
      </p>

      <p className="mt-2 line-clamp-1 text-xs text-text-secondary">{episode?.title}</p>

      <button
        type="button"
        onClick={() => navigate(`/episode/${note.episodeId}`)}
        className="mt-2 flex w-full items-center justify-between gap-2 text-left"
      >
        {note.tags[0] ? <TagChip label={note.tags[0]} /> : <span />}
        <span className="shrink-0 rounded-md bg-bg-surface-alt px-1.5 py-0.5 text-[11px] font-medium text-text-secondary">
          {formatTime(note.timestampSec)}
        </span>
      </button>
    </div>
  );
}
