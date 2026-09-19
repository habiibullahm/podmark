import type { Episode, NoteBlock } from "../data/types";
import type { ExportFormat } from "../store/useSettingsStore";
import { formatTime } from "./format";
import { DEFAULT_FREEFORM_NOTES } from "./episodes";

function frontmatter(episode: Episode, format: ExportFormat): string {
  // Notion's Markdown importer renders YAML frontmatter as visible text rather
  // than parsing it, so only emit it for the Obsidian format.
  if (format !== "obsidian") return "";
  const tags = episode.tags.map((t) => `  - ${t}`).join("\n");
  return `---\ntitle: "${episode.title.replace(/"/g, '\\"')}"\nshow: "${episode.show}"\npublished: ${episode.publishedAt}\ntags:\n${tags}\n---\n\n`;
}

function noteToMarkdown(note: NoteBlock): string {
  const prefix = note.type === "highlight" ? "> " : "- ";
  const tagSuffix = note.tags.length ? ` _(${note.tags.map((t) => `#${t}`).join(" ")})_` : "";
  return `${prefix}**[${formatTime(note.timestampSec)}]** ${note.text}${tagSuffix}`;
}

// An episode's freeform editor starts pre-filled with placeholder prompt
// text — that's not something the user wrote, so it shouldn't count as
// "has content" for either the empty-check or the export itself.
export function hasMeaningfulFreeformNotes(text: string | undefined): boolean {
  return !!text && text.trim() !== "" && text !== DEFAULT_FREEFORM_NOTES;
}

export interface EpisodeExportExtras {
  freeformNotes?: string;
  summaryBullets?: string[];
}

export function buildEpisodeMarkdown(
  episode: Episode,
  notes: NoteBlock[],
  format: ExportFormat,
  extras: EpisodeExportExtras = {},
): string {
  const notesBody = [...notes].sort((a, b) => a.timestampSec - b.timestampSec).map(noteToMarkdown).join("\n\n");
  const summaryBody =
    extras.summaryBullets && extras.summaryBullets.length > 0
      ? `\n\n## AI Summary\n\n${extras.summaryBullets.map((b) => `- ${b}`).join("\n")}`
      : "";
  const freeformBody = hasMeaningfulFreeformNotes(extras.freeformNotes)
    ? `\n\n## Notes\n\n${extras.freeformNotes!.trim()}`
    : "";
  const body = notesBody || "_No timestamped notes yet._";
  return `${frontmatter(episode, format)}# ${episode.title}\n\n*${episode.show} · ${episode.publishedAt}*\n\n${body}${summaryBody}${freeformBody}\n`;
}

export function buildLibraryMarkdown(
  episodes: Episode[],
  notes: NoteBlock[],
  format: ExportFormat,
  freeformNotesByEpisode: Record<string, string> = {},
  summariesByEpisode: Record<string, string[]> = {},
): string {
  const episodesWithContent = episodes.filter(
    (e) =>
      notes.some((n) => n.episodeId === e.id) ||
      hasMeaningfulFreeformNotes(freeformNotesByEpisode[e.id]) ||
      (summariesByEpisode[e.id]?.length ?? 0) > 0,
  );
  return episodesWithContent
    .map((e) =>
      buildEpisodeMarkdown(e, notes.filter((n) => n.episodeId === e.id), format, {
        freeformNotes: freeformNotesByEpisode[e.id],
        summaryBullets: summariesByEpisode[e.id],
      }),
    )
    .join("\n\n---\n\n");
}

export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
