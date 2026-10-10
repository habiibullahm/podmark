import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, CircleCheck, Ellipsis, Folder, NotebookPen } from "lucide-react";
import type { Episode } from "../data/types";
import { clampPercent, formatTime } from "../lib/format";
import { getEffectiveStatus, filterNotesByEpisode } from "../lib/episodes";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { useClickOutside } from "../lib/useClickOutside";
import { CARD_INTERACTIVE, MENU, MENU_ITEM } from "../lib/ui";
import { TagChip } from "./TagChip";
import { EpisodeArtwork } from "./EpisodeArtwork";

function AddToFolderMenu({ episode }: { episode: Episode }) {
  const folders = useFoldersStore((s) => s.folders);
  const addEpisodeToFolder = useFoldersStore((s) => s.addEpisodeToFolder);
  const removeEpisodeFromFolder = useFoldersStore((s) => s.removeEpisodeFromFolder);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false), open);

  return (
    <div className="absolute right-3 top-3 z-10" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-label={`Add "${episode.title}" to folder`}
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-bg-surface-alt hover:text-text-primary"
      >
        <Ellipsis size={18} aria-hidden="true" />
      </button>
      {open && (
        <div onClick={(e) => e.stopPropagation()} className={`${MENU} mt-1 w-56`}>
          <p className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-text-tertiary">
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
                className={`${MENU_ITEM} justify-between`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Folder size={15} className="shrink-0" style={{ color: f.color }} aria-hidden="true" />
                  <span className="truncate">{f.name}</span>
                </span>
                {inFolder && <Check size={15} className="shrink-0 text-accent" aria-label="In folder" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Library row: artwork, title, progress or completion, tags, note count.
export function EpisodeCard({ episode }: { episode: Episode }) {
  const navigate = useNavigate();
  const { getProgressFor } = usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const progressSec = getProgressFor(episode.id);
  const pct = clampPercent(progressSec, episode.durationSec);
  const status = getEffectiveStatus(episode, progressSec);
  const noteCount = filterNotesByEpisode(allNotes, episode.id).length;

  return (
    <div className="relative h-full">
      <AddToFolderMenu episode={episode} />
      <button
        type="button"
        onClick={() => navigate(`/episode/${episode.id}`)}
        className={`${CARD_INTERACTIVE} flex h-full w-full items-start gap-4 p-3.5 pr-12 text-left`}
      >
        <EpisodeArtwork episode={episode} className="h-[72px] w-[72px] shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px] font-bold leading-snug text-text-primary">{episode.title}</p>
          <p className="mt-0.5 line-clamp-1 text-xs text-text-secondary">{episode.show}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {status === "finished" ? (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-bold text-success">
                <CircleCheck size={13} aria-hidden="true" />
                Completed
              </span>
            ) : (
              // With an unknown duration there's no meaningful bar to fill or
              // time to count down — showing either would invent progress.
              episode.durationSec > 0 && (
                <span className="inline-flex shrink-0 items-center gap-2">
                  <span className="h-1 w-20 overflow-hidden rounded-full bg-bg-surface-alt">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-[11px] font-medium tabular-nums text-text-tertiary">
                    {formatTime(episode.durationSec - progressSec)} left
                  </span>
                </span>
              )
            )}
            {noteCount > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-text-tertiary">
                <NotebookPen size={12} aria-hidden="true" />
                {noteCount} note{noteCount === 1 ? "" : "s"}
              </span>
            )}
          </div>
          {episode.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {episode.tags.slice(0, 2).map((t) => (
                <TagChip key={t} label={t} />
              ))}
            </div>
          )}
        </div>
      </button>
    </div>
  );
}
