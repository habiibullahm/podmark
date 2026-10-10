import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Clock3,
  Download,
  Ellipsis,
  ExternalLink,
  FileText,
  Folder,
  Lock,
  Mic,
  Quote,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { filterNotesByEpisode, DEFAULT_FREEFORM_NOTES } from "../lib/episodes";
import { TagChip } from "../components/TagChip";
import { TagInput } from "../components/TagInput";
import { useAllKnownTags } from "../lib/useAllTags";
import { EpisodeArtwork } from "../components/EpisodeArtwork";
import { AISummaryCard } from "../components/AISummaryCard";
import { MarkdownNoteEditor } from "../components/MarkdownNoteEditor";
import { TimestampNoteBlock } from "../components/TimestampNoteBlock";
import { HighlightBlock } from "../components/HighlightBlock";
import { TranscriptView } from "../components/TranscriptView";
import { PlayerTransport, SeekBar, SpeedButton } from "../components/PlayerControls";
import { clampPercent, formatTime } from "../lib/format";
import { useAuthStore } from "../store/useAuthStore";
import { useTranscriptStore } from "../store/useTranscriptStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { isAccountsConfigured } from "../lib/neon";
import { fetchYoutubeTranscript } from "../lib/youtubeTranscriptApi";
import { accountEpoch } from "../lib/accountScope";
import { buildEpisodeMarkdown, downloadMarkdownFile } from "../lib/export";
import { useIsDesktop } from "../lib/useMediaQuery";
import {
  BUTTON_DANGER,
  BUTTON_GHOST,
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  CARD,
  ICON_BUTTON,
  MENU,
  MENU_ITEM,
  PILL_BUTTON,
} from "../lib/ui";

// Inline error with a retry, used for AI summary and transcription failures.
function RetryNotice({ icon: Icon, message, busy, onRetry }: {
  icon: typeof Sparkles;
  message: string;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg-surface p-3 shadow-card">
      <p className="flex items-start gap-2 text-[13px] text-text-secondary">
        <Icon size={16} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden="true" />
        <span>{message}</span>
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="shrink-0 rounded-lg bg-bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-primary hover:text-accent disabled:opacity-50"
      >
        {busy ? "Retrying…" : "Try again"}
      </button>
    </div>
  );
}

export function EpisodeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useIsDesktop();
  const episodes = useEpisodesStore((s) => s.episodes);
  const episode = episodes.find((e) => e.id === id);

  const { episode: playerEpisode, positionSec, openEpisode, getProgressFor, clearEpisode, togglePlay, audioError } =
    usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const notes = useMemo(() => filterNotesByEpisode(allNotes, id ?? ""), [allNotes, id]);
  const addNote = useNotesStore((s) => s.addNote);
  const generateSummary = useNotesStore((s) => s.generateSummary);
  const clearSummary = useNotesStore((s) => s.clearSummary);
  const aiSummary = useNotesStore((s) => (id ? s.aiSummaries[id] : undefined));
  const aiSummaryError = useNotesStore((s) => (id ? s.aiSummaryErrors[id] : undefined));
  const storedFreeformNotes = useNotesStore((s) => (id ? s.freeformNotes[id] : undefined));
  const setFreeformNotesForEpisode = useNotesStore((s) => s.setFreeformNotes);
  const folders = useFoldersStore((s) => s.folders);
  const addEpisodeToFolder = useFoldersStore((s) => s.addEpisodeToFolder);
  const removeEpisodeFromFolder = useFoldersStore((s) => s.removeEpisodeFromFolder);
  const removeEpisode = useEpisodesStore((s) => s.removeEpisode);
  const authStatus = useAuthStore((s) => s.status);
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const allKnownTags = useAllKnownTags();
  const transcript = useTranscriptStore((s) => (id ? s.transcripts[id] : undefined));
  const transcribing = useTranscriptStore((s) => (id ? s.transcribing[id] : false));
  const transcribeError = useTranscriptStore((s) => (id ? s.transcribeErrors[id] : undefined));
  const generateTranscript = useTranscriptStore((s) => s.generateTranscript);
  const clearTranscript = useTranscriptStore((s) => s.clearTranscript);

  const freeformNotes = storedFreeformNotes ?? DEFAULT_FREEFORM_NOTES;
  const setFreeformNotes = (update: string | ((prev: string) => string)) => {
    if (!id) return;
    const next = typeof update === "function" ? (update as (prev: string) => string)(freeformNotes) : update;
    setFreeformNotesForEpisode(id, next);
  };
  const [addingNote, setAddingNote] = useState(false);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftTags, setDraftTags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [youtubeTranscriptLoading, setYoutubeTranscriptLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const notesEditorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

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
    setDraftTags([]);
    setGenerating(false);
    setMenuOpen(false);
    setConfirmingRemove(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // The utility panel's "Quick note" lands here with the timestamp draft open.
  useEffect(() => {
    if (!(location.state as { quickNote?: boolean } | null)?.quickNote) return;
    setAddingNote(true);
    setAddingHighlight(false);
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, location.state]);

  // Episodes with an external sourceUrl (YouTube) have no playable audio, so
  // handing them to the player would only spin the simulated timer and accrue
  // listening progress the user never actually had.
  useEffect(() => {
    if (episode && !episode.sourceUrl) openEpisode(episode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id]);

  // "Jump to Notes" (Home's Continue Learning card) links here with a #notes
  // hash — scroll it into view once the screen has rendered.
  useEffect(() => {
    if (location.hash !== "#notes") return;
    document.getElementById("notes")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [location.hash, id]);

  // Prefer the live context position when this episode is the one actually
  // loaded in the player; otherwise fall back to the last saved progress
  // (not the static mock progressSec, which the player may have long since
  // overtaken).
  const currentPosition = playerEpisode?.id === episode?.id ? positionSec : getProgressFor(episode?.id ?? "");

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => a.timestampSec - b.timestampSec), [notes]);

  if (!episode) {
    return (
      <div className="py-16 text-center text-text-secondary">
        Episode not found.{" "}
        <button className="font-semibold text-accent" onClick={() => navigate("/")}>
          Go home
        </button>
      </div>
    );
  }

  const handleAddNote = () => {
    if (!draftText.trim()) return;
    addNote("timestamp-note", episode.id, currentPosition, draftText.trim(), draftTags);
    setDraftText("");
    setAddingNote(false);
  };

  const handleAddHighlight = () => {
    if (!draftText.trim()) return;
    addNote("highlight", episode.id, currentPosition, draftText.trim(), draftTags);
    setDraftText("");
    setAddingHighlight(false);
  };

  // A transcript of what was actually said outranks the publisher's show
  // notes — if one exists, ground the summary in it instead.
  const handleSummarize = async () => {
    setGenerating(true);
    const transcriptText = transcript?.map((seg) => seg.text).join(" ");
    await generateSummary(episode, transcriptText);
    setGenerating(false);
  };

  const handleTranscribe = () => generateTranscript(episode);

  const handleFetchYoutubeTranscript = async () => {
    if (!episode?.sourceUrl || youtubeTranscriptLoading || summarizeRequiresSignIn) return;
    setYoutubeTranscriptLoading(true);
    const epoch = accountEpoch();
    try {
      const segments = await fetchYoutubeTranscript(episode.sourceUrl);
      if (epoch !== accountEpoch()) return; // account changed while waiting
      const store = useTranscriptStore.getState();
      store.transcripts[episode.id] = segments;
      useTranscriptStore.setState({ transcripts: { ...store.transcripts } });
    } catch (err) {
      if (epoch !== accountEpoch()) return;
      const message = err instanceof Error ? err.message : "Failed to fetch transcript.";
      const store = useTranscriptStore.getState();
      store.transcribeErrors[episode.id] = message;
      useTranscriptStore.setState({ transcribeErrors: { ...store.transcribeErrors } });
    } finally {
      setYoutubeTranscriptLoading(false);
    }
  };

  const handleExportEpisode = () => {
    const markdown = buildEpisodeMarkdown(episode, notes, exportFormat, {
      freeformNotes: storedFreeformNotes,
      summaryBullets: aiSummary,
    });
    const slug = episode.id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    downloadMarkdownFile(`podmark-${slug}.md`, markdown);
  };

  const handleRemoveEpisode = () => {
    if (playerEpisode?.id === episode.id) clearEpisode();
    removeEpisode(episode.id);
    navigate("/library");
  };

  // iTunes episodes can always be summarised (via show notes or transcript).
  // YouTube episodes become summarisable once a transcript has been fetched.
  const canSummarize = !episode.sourceUrl || !!transcript;
  // Audio transcription needs a real audio URL — only applies to iTunes.
  const canTranscribe = !episode.sourceUrl && !!episode.audioUrl;
  // All three (summary, transcription, YouTube transcript) spend paid
  // credits, so once accounts exist they're gated behind sign-in — the API
  // rejects them without a session anyway. Deployments without Neon Auth configured (isAccountsConfigured
  // false — no env vars set) predate accounts entirely, so both stay open
  // there rather than showing a sign-in prompt for a feature that isn't
  // wired up yet.
  const summarizeRequiresSignIn = isAccountsConfigured && authStatus !== "signedIn";
  const isLoadedInPlayer = playerEpisode?.id === episode.id;
  const progressPct = clampPercent(currentPosition, episode.durationSec);
  const meta = [episode.publishedAt, episode.durationSec > 0 ? formatTime(episode.durationSec) : ""]
    .filter(Boolean)
    .join(" · ");

  const openDraft = (kind: "note" | "highlight") => {
    setAddingNote(kind === "note" ? (v) => !v : false);
    setAddingHighlight(kind === "highlight" ? (v) => !v : false);
    setDraftText("");
  };

  return (
    <div>
      {/* Top bar: back, export, and the options menu. */}
      <div className="mb-5 flex items-center justify-between gap-2">
        <button type="button" onClick={() => navigate(-1)} className={`${BUTTON_GHOST} -ml-3`} aria-label="Back">
          <ArrowLeft size={18} aria-hidden="true" />
          <span className="hidden sm:inline">Back</span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleExportEpisode}
            aria-label="Export episode as Markdown"
            title={`Export as Markdown (${exportFormat} format)`}
            className={`${BUTTON_GHOST}`}
          >
            <Download size={17} aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="More options"
              aria-expanded={menuOpen}
              className={ICON_BUTTON}
            >
              <Ellipsis size={20} aria-hidden="true" />
            </button>
            {menuOpen && (
              <div className={`${MENU} w-60`}>
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
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingRemove(true);
                    setMenuOpen(false);
                  }}
                  className={`${MENU_ITEM} text-danger`}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  Remove from Library
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmingRemove && (
        <div className="mb-5 flex items-center justify-between gap-3 rounded-control border border-danger/40 bg-danger/5 p-3">
          <p className="text-[13px] text-text-primary">
            Remove "{episode.title}" and its {notes.length} note{notes.length === 1 ? "" : "s"}? This can't be undone.
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setConfirmingRemove(false)} className={`${BUTTON_GHOST} px-2.5 py-1.5 text-xs`}>
              Cancel
            </button>
            <button type="button" onClick={handleRemoveEpisode} className={BUTTON_DANGER}>
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* LEFT — the episode, its player, and the learning tools. */}
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <section className={`${CARD} p-4 sm:p-5`}>
            <div className="flex gap-4">
              <EpisodeArtwork
                episode={episode}
                className="h-28 w-28 shrink-0 rounded-2xl shadow-raised sm:h-32 sm:w-32"
              />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-xs font-bold uppercase tracking-[0.12em] text-accent">{episode.show}</p>
                <h1 className="mt-1 line-clamp-3 text-lg font-extrabold leading-snug tracking-tight text-text-primary sm:text-xl">
                  {episode.title}
                </h1>
                {meta && <p className="mt-1 text-xs font-medium text-text-tertiary">{meta}</p>}
                {episode.tags.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {episode.tags.map((t) => (
                      <TagChip key={t} label={t} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {episode.sourceUrl ? (
              <a
                href={episode.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${BUTTON_PRIMARY} mt-4 w-full`}
              >
                <ExternalLink size={16} aria-hidden="true" />
                Watch on YouTube
              </a>
            ) : isDesktop && isLoadedInPlayer ? (
              // Desktop plays right here; on smaller screens the docked mini
              // player below is the one set of controls.
              <div className="mt-5 space-y-3">
                <SeekBar />
                <div className="flex items-center justify-between">
                  <span className="w-12" />
                  <PlayerTransport size="md" />
                  <SpeedButton />
                </div>
              </div>
            ) : (
              episode.durationSec > 0 && (
                <div className="mt-4">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-surface-alt">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs font-medium tabular-nums text-text-tertiary">
                    {formatTime(currentPosition)} of {formatTime(episode.durationSec)} listened
                  </p>
                </div>
              )
            )}
          </section>

          {audioError && isLoadedInPlayer && episode.audioUrl && (
            <div className="flex items-center justify-between gap-3 rounded-control border border-border bg-bg-surface p-3 shadow-card">
              <p className="flex items-center gap-2 text-[13px] text-text-secondary">
                <CircleAlert size={16} className="shrink-0 text-danger" aria-hidden="true" />
                This episode's audio couldn't be loaded.
              </p>
              <div className="flex shrink-0 items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="rounded-lg bg-bg-surface-alt px-3 py-1.5 text-xs font-semibold text-text-primary hover:text-accent"
                >
                  Try again
                </button>
                <a
                  href={episode.audioUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-accent hover:text-accent/80"
                >
                  Open source
                </a>
              </div>
            </div>
          )}

          {/* AI and transcription tools. */}
          {(canSummarize || canTranscribe || episode.sourceUrl) && (
            <section aria-label="Learning tools" className={`${CARD} space-y-2.5 p-4`}>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">Learning tools</p>
              {canSummarize && summarizeRequiresSignIn && (
                <button type="button" onClick={() => navigate("/profile")} className={`${BUTTON_SECONDARY} w-full justify-start`}>
                  <Lock size={16} aria-hidden="true" />
                  Sign in to use AI summary
                </button>
              )}
              {canSummarize && !summarizeRequiresSignIn && (
                <button
                  type="button"
                  onClick={handleSummarize}
                  disabled={generating}
                  className={`${BUTTON_PRIMARY} w-full justify-start ${generating ? "animate-pulse" : ""}`}
                >
                  <Sparkles size={16} aria-hidden="true" />
                  {generating ? "Summarizing…" : "AI Summarize Episode"}
                </button>
              )}
              {canTranscribe && !summarizeRequiresSignIn && !transcript && (
                <button
                  type="button"
                  onClick={handleTranscribe}
                  disabled={transcribing}
                  className={`${BUTTON_SECONDARY} w-full justify-start ${transcribing ? "animate-pulse" : ""}`}
                >
                  <Mic size={16} aria-hidden="true" />
                  {transcribing ? "Transcribing…" : "Transcribe Episode"}
                </button>
              )}
              {episode.sourceUrl && !transcript && summarizeRequiresSignIn && (
                <button type="button" onClick={() => navigate("/profile")} className={`${BUTTON_SECONDARY} w-full justify-start`}>
                  <Lock size={16} aria-hidden="true" />
                  Sign in to get transcript
                </button>
              )}
              {episode.sourceUrl && !transcript && !summarizeRequiresSignIn && (
                <button
                  type="button"
                  onClick={handleFetchYoutubeTranscript}
                  disabled={youtubeTranscriptLoading}
                  className={`${BUTTON_SECONDARY} w-full justify-start ${youtubeTranscriptLoading ? "animate-pulse" : ""}`}
                >
                  <FileText size={16} aria-hidden="true" />
                  {youtubeTranscriptLoading ? "Fetching transcript…" : "Get Transcript"}
                </button>
              )}
              {transcript && (
                <p className="flex items-center gap-2 text-xs text-text-secondary">
                  <Check size={14} className="text-success" aria-hidden="true" />
                  Transcript ready — {canSummarize ? "summaries use it" : "search it below"}.
                </p>
              )}
            </section>
          )}
        </div>

        {/* RIGHT — what you capture and learn. */}
        <div id="notes" className="min-w-0 scroll-mt-6 space-y-5">
          <div className="flex flex-wrap gap-2">
            {/* Timestamp notes anchor to the player's position, which doesn't
                exist for an episode that plays outside the app — every note
                would silently claim 0:00. */}
            {!episode.sourceUrl && (
              <button type="button" onClick={() => openDraft("note")} aria-pressed={addingNote} className={PILL_BUTTON}>
                <Clock3 size={14} aria-hidden="true" />
                Add Timestamp Note
              </button>
            )}
            <button type="button" onClick={() => openDraft("highlight")} aria-pressed={addingHighlight} className={PILL_BUTTON}>
              <Quote size={14} aria-hidden="true" />
              Save Key Highlight
            </button>
          </div>

          {(addingNote || addingHighlight) && (
            <div className={`${CARD} border-accent/40 p-4`}>
              <p className="text-xs font-semibold text-text-secondary">
                {addingNote ? "New timestamp note" : "New highlight"} at{" "}
                <span className="font-bold tabular-nums text-accent">{formatTime(currentPosition)}</span>
              </p>
              <textarea
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                placeholder={addingNote ? "What's worth remembering here?" : "Paste or type the key quote..."}
                rows={3}
                className="mt-2 w-full resize-none rounded-control border border-border bg-bg-surface-alt px-3 py-2.5 text-[14px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
              <div className="mt-2">
                <TagInput tags={draftTags} onChange={setDraftTags} suggestions={allKnownTags} />
              </div>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAddingNote(false);
                    setAddingHighlight(false);
                  }}
                  className={`${BUTTON_GHOST} px-3 py-1.5 text-xs`}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={addingNote ? handleAddNote : handleAddHighlight}
                  className={`${BUTTON_PRIMARY} px-4 py-1.5 text-xs`}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {canSummarize && aiSummaryError && (
            <RetryNotice
              icon={Sparkles}
              message={`${aiSummaryError}${aiSummary ? " The summary below is from before this attempt." : ""}`}
              busy={generating}
              onRetry={handleSummarize}
            />
          )}

          {canSummarize && aiSummary && (
            <AISummaryCard
              bullets={aiSummary}
              onRegenerate={handleSummarize}
              onClear={() => clearSummary(episode.id)}
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
          )}

          <div ref={notesEditorRef}>
            <MarkdownNoteEditor
              value={freeformNotes}
              onChange={setFreeformNotes}
              placeholder="Write freeform Markdown notes here — bullets, headers, etc."
            />
          </div>

          {sortedNotes.length > 0 && (
            <section aria-label="Timestamped notes and highlights">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-text-primary">
                Timeline
                <span className="rounded-full bg-bg-surface-alt px-2 py-0.5 text-[11px] font-bold text-text-secondary">
                  {sortedNotes.length}
                </span>
              </h2>
              <div className="space-y-3">
                {sortedNotes.map((note) =>
                  note.type === "highlight" ? (
                    <HighlightBlock key={note.id} note={note} />
                  ) : (
                    <TimestampNoteBlock key={note.id} note={note} />
                  ),
                )}
              </div>
            </section>
          )}

          {canTranscribe && transcribeError && (
            <RetryNotice icon={Mic} message={transcribeError} busy={transcribing} onRetry={handleTranscribe} />
          )}

          {episode.sourceUrl && transcribeError && !canTranscribe && !summarizeRequiresSignIn && (
            <RetryNotice
              icon={FileText}
              message={transcribeError}
              busy={youtubeTranscriptLoading}
              onRetry={handleFetchYoutubeTranscript}
            />
          )}

          {(canTranscribe || episode.sourceUrl) && transcript && (
            <TranscriptView segments={transcript} onClear={() => clearTranscript(episode.id)} />
          )}
        </div>
      </div>
    </div>
  );
}
