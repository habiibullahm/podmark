import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { getEffectiveStatus, filterNotesByEpisode } from "../lib/episodes";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { useClickOutside } from "../lib/useClickOutside";
import { TagChip } from "./TagChip";
import { EpisodeArtwork } from "./EpisodeArtwork";

interface EpisodeCardProps {
  episode: Episode;
  variant?: "row-compact" | "list";
}

function AddToFolderMenu({ episode }: { episode: Episode }) {
  const folders = useFoldersStore((s) => s.folders);
  const addEpisodeToFolder = useFoldersStore((s) => s.addEpisodeToFolder);
  const removeEpisodeFromFolder = useFoldersStore((s) => s.removeEpisodeFromFolder);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="absolute right-2.5 top-2.5 z-10" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Add "${episode.title}" to folder`}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-bg-primary/80 text-text-secondary backdrop-blur hover:text-text-primary"
      >
        ⋯
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-bg-surface p-1.5 shadow-lg"
        >
          <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
            Add to folder
          </p>
          {folders.length === 0 && (
            <p className="px-2.5 py-1.5 text-xs text-text-secondary">No folders yet — create one from Library.</p>
          )}
          {folders.map((f) => {
            const inFolder = f.episodeIds.includes(episode.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  inFolder ? removeEpisodeFromFolder(f.id, episode.id) : addEpisodeToFolder(f.id, episode.id)
                }
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm text-text-primary hover:bg-bg-surface-alt"
              >
                <span className="truncate">📁 {f.name}</span>
                {inFolder && <span className="shrink-0 text-accent">✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function EpisodeCard({ episode, variant = "list" }: EpisodeCardProps) {
  const navigate = useNavigate();
  const { getProgressFor } = usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const progressSec = getProgressFor(episode.id);
  const pct = clampPercent(progressSec, episode.durationSec);
  const status = getEffectiveStatus(episode, progressSec);
  const noteCount = filterNotesByEpisode(allNotes, episode.id).length;

  if (variant === "row-compact") {
    return (
      <button
        type="button"
        onClick={() => navigate(`/episode/${episode.id}`)}
        className="flex w-full items-center gap-3 rounded-xl px-5 py-2.5 text-left md:items-start md:border md:border-border md:px-3"
      >
        <EpisodeArtwork episode={episode} className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-[14px] font-medium leading-snug text-text-primary md:line-clamp-2">
            {episode.title}
          </p>
          <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-bg-surface-alt">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {episode.durationSec > 0 && (
          <span className="shrink-0 text-xs text-text-tertiary">
            {formatTime(episode.durationSec - progressSec)} left
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="relative">
      <AddToFolderMenu episode={episode} />
      <button
        type="button"
        onClick={() => navigate(`/episode/${episode.id}`)}
        className="flex w-full items-start gap-3 rounded-2xl border border-border bg-bg-surface p-3 pb-4 pr-11 text-left"
      >
      <EpisodeArtwork episode={episode} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-text-primary">
          {episode.title}
        </p>
        <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>

        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {status === "finished" ? (
            <span className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-success">
              ✓ Completed
            </span>
          ) : (
            // With an unknown duration there's no meaningful bar to fill or
            // time to count down — showing either would invent progress.
            episode.durationSec > 0 && (
              <>
                <div className="h-1 w-20 shrink-0 overflow-hidden rounded-full bg-bg-surface-alt">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
                <span className="shrink-0 text-[11px] text-text-tertiary">
                  {formatTime(episode.durationSec - progressSec)} left
                </span>
              </>
            )
          )}
          <div className="flex flex-wrap gap-1">
            {episode.tags.slice(0, 2).map((t) => (
              <TagChip key={t} label={t} />
            ))}
          </div>
        </div>
      </div>
      {noteCount > 0 && (
        <span className="shrink-0 text-xs text-text-tertiary">
          {noteCount} note{noteCount === 1 ? "" : "s"}
        </span>
      )}
      </button>
    </div>
  );
}
