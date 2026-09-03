import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { episodes } from "../data/mockData";
import { usePlayer } from "../context/PlayerContext";
import { useNotesStore } from "../store/useNotesStore";
import { TagChip } from "../components/TagChip";
import { AISummaryCard } from "../components/AISummaryCard";
import { TimestampNoteBlock } from "../components/TimestampNoteBlock";
import { HighlightBlock } from "../components/HighlightBlock";
import { formatTime } from "../lib/format";

export function EpisodeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const episode = episodes.find((e) => e.id === id);

  const { episode: playerEpisode, positionSec, openEpisode } = usePlayer();
  const allNotes = useNotesStore((s) => s.notes);
  const notes = useMemo(() => allNotes.filter((n) => n.episodeId === id), [allNotes, id]);
  const addTimestampNote = useNotesStore((s) => s.addTimestampNote);
  const addHighlight = useNotesStore((s) => s.addHighlight);
  const generateSummary = useNotesStore((s) => s.generateSummary);
  const aiSummary = useNotesStore((s) => (id ? s.aiSummaries[id] : undefined));

  const [freeformNotes, setFreeformNotes] = useState(
    "- Key theme this episode revolves around...\n- ",
  );
  const [addingNote, setAddingNote] = useState(false);
  const [addingHighlight, setAddingHighlight] = useState(false);
  const [draftText, setDraftText] = useState("");
  const [draftTag, setDraftTag] = useState(episode?.tags[0] ?? "");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (episode) openEpisode(episode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode?.id]);

  const currentPosition = playerEpisode?.id === episode?.id ? positionSec : episode?.progressSec ?? 0;

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
    addTimestampNote(episode.id, currentPosition, draftText.trim(), draftTag ? [draftTag] : []);
    setDraftText("");
    setAddingNote(false);
  };

  const handleAddHighlight = () => {
    if (!draftText.trim()) return;
    addHighlight(episode.id, currentPosition, draftText.trim(), draftTag ? [draftTag] : []);
    setDraftText("");
    setAddingHighlight(false);
  };

  const handleSummarize = () => {
    setGenerating(true);
    window.setTimeout(() => {
      generateSummary(episode.id, episode.title);
      setGenerating(false);
    }, 900);
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
        <button type="button" className="text-lg text-text-secondary">
          ⋯
        </button>
      </div>

      <div className="px-5 pt-4 md:px-0 md:pt-6">
        <div className="flex items-center gap-3">
          <div
            className="h-10 w-10 shrink-0 rounded-lg"
            style={{ background: episode.artworkGradient }}
          />
          <div className="min-w-0">
            <p className="line-clamp-1 text-[13px] font-medium text-text-primary">{episode.show}</p>
            <p className="text-xs text-text-secondary">
              {episode.publishedAt} · {formatTime(episode.durationSec)}
            </p>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {episode.tags.map((t) => (
            <TagChip key={t} label={t} />
          ))}
        </div>
      </div>

      <div id="notes" className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 no-scrollbar md:px-0 md:flex-wrap md:overflow-visible">
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
          disabled={generating}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3.5 py-2 text-xs font-semibold text-accent disabled:opacity-60"
        >
          {generating ? "✨ Summarizing…" : "✨ AI Summarize Episode"}
        </button>
      </div>

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

      {aiSummary && (
        <div className="mx-5 mt-4 md:mx-0">
          <AISummaryCard
            bullets={aiSummary}
            onRegenerate={handleSummarize}
            onInsert={(bullet) => setFreeformNotes((prev) => `${prev}\n- ${bullet}`)}
          />
        </div>
      )}

      <div className="mx-5 mt-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
          Notes
        </p>
        <textarea
          value={freeformNotes}
          onChange={(e) => setFreeformNotes(e.target.value)}
          rows={5}
          placeholder="Write freeform Markdown notes here — bullets, headers, etc."
          className="w-full resize-none rounded-xl border border-border bg-bg-surface p-3 text-[14px] leading-relaxed text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
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
