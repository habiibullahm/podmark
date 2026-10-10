import { Link } from "react-router-dom";
import { Clock3, Quote } from "lucide-react";
import type { NoteBlock } from "../data/types";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { formatTime } from "../lib/format";
import { CARD_INTERACTIVE } from "../lib/ui";
import { EpisodeArtwork } from "./EpisodeArtwork";
import { TagChip } from "./TagChip";

export function TakeawayCard({ note }: { note: NoteBlock }) {
  const episode = useEpisodesStore((s) => s.episodes.find((e) => e.id === note.episodeId));
  const isHighlight = note.type === "highlight";

  return (
    <article className={`${CARD_INTERACTIVE} flex h-full flex-col p-4`}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
            isHighlight ? "bg-streak/15 text-streak" : "bg-accent/10 text-accent"
          }`}
        >
          {isHighlight ? <Quote size={12} aria-hidden="true" /> : <Clock3 size={12} aria-hidden="true" />}
          {isHighlight ? "Highlight" : "Note"}
        </span>
        <span className="rounded-md bg-bg-surface-alt px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-text-secondary">
          {formatTime(note.timestampSec)}
        </span>
      </div>

      <p
        className={`mt-3 line-clamp-4 flex-1 text-[14px] leading-relaxed text-text-primary ${isHighlight ? "italic" : ""}`}
      >
        {note.text}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-3">
        <Link
          to={`/episode/${note.episodeId}`}
          className="flex min-w-0 items-center gap-2 rounded-lg text-xs font-medium text-text-secondary hover:text-accent"
        >
          {episode && <EpisodeArtwork episode={episode} className="h-6 w-6 shrink-0 rounded-md" />}
          <span className="line-clamp-1">{episode?.title ?? "Open episode"}</span>
        </Link>
        {note.tags[0] && <TagChip label={note.tags[0]} />}
      </div>
    </article>
  );
}
