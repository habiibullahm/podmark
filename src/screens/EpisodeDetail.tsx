import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { filterNotesByEpisode } from "../lib/episodes";
import { TagChip } from "../components/TagChip";
import { EpisodeArtwork } from "../components/EpisodeArtwork";
import { AISummaryCard } from "../components/AISummaryCard";
import { MarkdownNoteEditor } from "../components/MarkdownNoteEditor";
import { TimestampNoteBlock } from "../components/TimestampNoteBlock";
import { HighlightBlock } from "../components/HighlightBlock";
import { formatTime } from "../lib/format";

const DEFAULT_FREEFORM_NOTES = "- Key theme this episode revolves around...\n- ";

export function EpisodeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const episodes = useEpisodesStore((s) => s.episodes);
  const setEpisodeDescription = useEpisodesStore((s) => s.setEpisodeDescription);
  const episode = episodes.find((e) => e.id === id);

  const { episode: playerEpisode, positionSec, openEpisode, getProgressFor } = usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const notes = useMemo(() => filterNotesByEpisode(allNotes, id ?? ""), [allNotes, id]);
  const addNote = useNotesStore((s) => s.addNote);
  const generateSummary = useNotesStore((s) => s.generateSummary);
  const aiSummary = useNotesStore((s) => (id ? s.aiSummaries[id] : undefined));
  const aiSummaryError = useNotesStore((s) => (id ? s.aiSummaryErrors[id] : undefined));
  const storedFreeformNotes = useNotesStore((s) => (id ? s.freeformNotes[id] : undefined));
  const setFreeformNotesForEpisode = useNotesStore((s) => s.setFreeformNotes);
  const folders = useFoldersStore((s) => s.folders);
  const addEpisodeToFolder = useFoldersStore((s) => s.addEpisodeToFolder);
  const removeEpisodeFromFolder = useFoldersStore((s) => s.removeEpisodeFromFolder);

  const freeformNotes = storedFreeformNotes ?? DEFAULT_FREEFORM_NOTES;
  const setFreeformNotes = (update: string | ((prev: string) => string)) => {
    if (!id) return;
    const next = typeof update === "function" ? (update as (prev: string) => string)(freeformNotes) : update;
    setFreeformNotesForEpisode(id, next);
  };
  const [addingNote, setAddingNote] = useState(false);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftTag, setDraftTag] = useState(episode?.tags[0] ?? "");
  const [generating, setGenerating] = useState(false);
  const [addingTranscript, setAddingTranscript] = useState(false);
  const [transcriptDraft, setTranscriptDraft] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);
  const notesEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!folderMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setFolderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [folderMenuOpen]);

  // Reset per-episode draft/editor UI state whenever the route's :id changes —
  // EpisodeDetail is reused, not remounted, across /episode/:id navigations,
  // so without this a draft started on one episode (and its tag, which may
  // not even exist on the next episode) leaks into whichever episode is
  // opened next. freeformNotes itself doesn't need resetting here — it's
  // now looked up per-episode from the store, not local state.
  useEffect(() => {
    setAddingNote(false);
    setAddingHighlight(false);
    setDraftText("");
    setDraftTag(episode?.tags[0] ?? "");
    setGenerating(false);
    setFolderMenuOpen(false);
    setAddingTranscript(false);
    setTranscriptDraft("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Episodes with an external sourceUrl (YouTube) have no playable audio, so
  // handing them to the player would only spin the simulated timer and accrue
  // listening progress the user never actually had.
  useEffect(() => {
    if (episode && !episode.sourceUrl) openEpisode(episode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id]);

  // Prefer the live context position when this episode is the one actually
  // loaded in the player; otherwise fall back to the last saved progress
  // (not the static mock progressSec, which the player may have long since
  // overtaken).
  const currentPosition =
    playerEpisode?.id === episode?.id ? positionSec : getProgressFor(episode?.id ?? "");

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.timestampSec - b.timestampSec),
    [notes],
  );

  if (!episode) {
    return (
      <div className="p-8 text-center text-text-secondary">
        Episode not found.{" "}
        <button className="text-accent" onClick={() => navigate("/")}>
          Go home
        </button>
      </div>
    );
  }

  const handleAddNote = () => {
    if (!draftText.trim()) return;
    addNote("timestamp-note", episode.id, currentPosition, draftText.trim(), draftTag ? [draftTag] : []);
    setDraftText("");
    setAddingNote(false);
  };

  const handleAddHighlight = () => {
    if (!draftText.trim()) return;
    addNote("highlight", episode.id, currentPosition, draftText.trim(), draftTag ? [draftTag] : []);
    setDraftText("");
    setAddingHighlight(false);
  };

  const handleSummarize = async () => {
    setGenerating(true);
    await generateSummary(episode);
    setGenerating(false);
  };

  // A YouTube episode has no show notes to summarize from — without a pasted
  // transcript the model would only have the title to go on, which produces a
  // confident-sounding summary of content nobody has read.
  const needsTranscript = !!episode.sourceUrl && !episode.description;

  const handleSaveTranscript = () => {
    if (!transcriptDraft.trim()) return;
    setEpisodeDescription(episode.id, transcriptDraft);
    setTranscriptDraft("");
    setAddingTranscript(false);
  };

  return (
    <div className="pb-40 md:pb-16">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-bg-primary/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <button type="button" onClick={() => navigate(-1)} className="text-lg text-text-secondary">
          ←
        </button>
        <p className="line-clamp-1 max-w-[240px] text-[13px] font-medium text-text-primary">
          {episode.title}
        </p>
        <div className="relative" ref={folderMenuRef}>
          <button
            type="button"
            onClick={() => setFolderMenuOpen((v) => !v)}
            className="text-lg text-text-secondary"
          >
            ⋯
          </button>
          {folderMenuOpen && (
            <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl border border-border bg-bg-surface p-1.5 shadow-lg">
              <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                Add to folder
              </p>
              {folders.length === 0 && (
                <p className="px-2.5 py-1.5 text-xs text-text-secondary">
                  No folders yet — create one from Library.
                </p>
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
      </div>

      <div className="px-5 pt-4 md:px-0 md:pt-6">
        <div className="flex items-center gap-3">
          <EpisodeArtwork episode={episode} className="h-10 w-10 shrink-0 rounded-lg" />
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-medium text-text-primary">{episode.show}</p>
            <p className="text-xs text-text-secondary">
              {[episode.publishedAt, episode.durationSec > 0 ? formatTime(episode.durationSec) : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {episode.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      </div>

      <div
        id="notes"
        className="mt-4 flex max-w-full flex-nowrap gap-2 overflow-x-auto px-5 pb-1 no-scrollbar md:flex-wrap md:overflow-visible md:px-0"
      >
        {episode.sourceUrl ? (
          <a
            href={episode.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary hover:border-accent/60"
          >
            ▶ Watch on YouTube ↗
          </a>
        ) : (
          // Timestamp notes anchor to the player's position, which doesn't
          // exist for an episode that plays outside the app — every note would
          // silently claim 0:00.
          <button
            type="button"
            onClick={() => {
              setAddingNote((v) => !v);
              setAddingHighlight(false);
              setDraftText("");
            }}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary hover:border-accent/60"
          >
            🕐 + Add Timestamp Note
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setAddingHighlight((v) => !v);
            setAddingNote(false);
            setDraftText("");
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-bg-surface px-3.5 py-2 text-xs font-semibold text-text-primary hover:border-accent/60"
        >
          ⭐ + Save Key Highlight
        </button>
        <button
          type="button"
          onClick={handleSummarize}
          disabled={generating || needsTranscript}
          title={needsTranscript ? "Add the video's transcript first" : undefined}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent transition-opacity disabled:opacity-70 ${
            generating ? "animate-pulse" : ""
          }`}
        >
          <span className={generating ? "animate-pulse" : ""}>✨</span>
          <span>{generating ? "Summarizing…" : "AI Summarize Episode"}</span>
        </button>
      </div>

      {needsTranscript && (
        <div className="mx-5 mt-3 rounded-xl border border-border bg-bg-surface p-3 md:mx-0">
          {addingTranscript ? (
            <>
              <p className="text-xs font-medium text-text-secondary">
                Open the video on YouTube, expand the description and click “Show transcript”, then
                paste it here.
              </p>
              <textarea
                autoFocus
                value={transcriptDraft}
                onChange={(e) => setTranscriptDraft(e.target.value)}
                placeholder="Paste the video transcript..."
                rows={5}
                className="mt-2 w-full resize-none rounded-lg border border-border bg-bg-surface-alt px-3 py-2 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingTranscript(false);
                    setTranscriptDraft("");
                  }}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveTranscript}
                  disabled={!transcriptDraft.trim()}
                  className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Save transcript
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px] text-text-secondary">
                ✨ Add this video’s transcript to enable AI summary.
              </p>
              <button
                type="button"
                onClick={() => setAddingTranscript(true)}
                className="shrink-0 rounded-lg bg-bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:text-accent"
              >
                Add transcript
              </button>
            </div>
          )}
        </div>
      )}

      {(addingNote || addingHighlight) && (
        <div className="mx-5 mt-3 rounded-xl border border-accent/40 bg-bg-surface p-3 md:mx-0">
          <p className="text-xs font-medium text-text-secondary">
            {addingNote ? "New timestamp note" : "New highlight"} at{" "}
            <span className="font-semibold text-accent">{formatTime(currentPosition)}</span>
          </p>
          <textarea
            autoFocus
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder={addingNote ? "What's worth remembering here?" : "Paste or type the key quote..."}
            rows={2}
            className="mt-2 w-full resize-none rounded-lg border border-border bg-bg-surface-alt px-3 py-2 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <select
              value={draftTag}
              onChange={(e) => setDraftTag(e.target.value)}
              className="rounded-lg border border-border bg-bg-surface-alt px-2 py-1.5 text-xs text-text-secondary focus:outline-none"
            >
              {episode.tags.map((t) => (
                <option key={t} value={t}>
                  #{t}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setAddingNote(false);
                  setAddingHighlight(false);
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addingNote ? handleAddNote : handleAddHighlight}
                className="rounded-lg bg-accent px-3.5 py-1.5 text-xs font-semibold text-white"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {aiSummaryError && !aiSummary && (
        <div className="mx-5 mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface p-3 md:mx-0">
          <p className="text-[13px] text-text-secondary">✨ {aiSummaryError}</p>
          <button
            type="button"
            onClick={handleSummarize}
            disabled={generating}
            className="shrink-0 rounded-lg bg-bg-surface-alt px-3 py-1.5 text-xs font-medium text-text-primary hover:text-accent disabled:opacity-50"
          >
            {generating ? "Retrying…" : "Try again"}
          </button>
        </div>
      )}

      {aiSummary && (
        <div className="mx-5 mt-4 md:mx-0">
          <AISummaryCard
            bullets={aiSummary}
            onRegenerate={handleSummarize}
            onInsert={(bullet) => {
              setFreeformNotes((prev) => `${prev}\n- ${bullet}`);
              // Without this, an inserted bullet lands past the bottom of the
              // (short, fixed-height) notes textarea with no visible change,
              // making the button look like it did nothing.
              requestAnimationFrame(() => {
                notesEditorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                const textarea = notesEditorRef.current?.querySelector("textarea");
                if (textarea) textarea.scrollTop = textarea.scrollHeight;
              });
            }}
          />
        </div>
      )}

      <div ref={notesEditorRef} className="mx-5 mt-4 md:mx-0">
        <MarkdownNoteEditor
          value={freeformNotes}
          onChange={setFreeformNotes}
          placeholder="Write freeform Markdown notes here — bullets, headers, etc."
        />
      </div>

      {sortedNotes.length > 0 && (
        <div className="mx-5 mt-4 space-y-2.5 md:mx-0">
          {sortedNotes.map((note) =>
            note.type === "highlight" ? (
              <HighlightBlock key={note.id} note={note} />
            ) : (
              <TimestampNoteBlock key={note.id} note={note} />
            ),
          )}
        </div>
      )}
    </div>
  );
}
