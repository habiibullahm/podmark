import type { Episode, NoteBlock } from "../data/types";
import type { ExportFormat } from "../store/useSettingsStore";
import { formatTime } from "./format";

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

export function buildEpisodeMarkdown(episode: Episode, notes: NoteBlock[], format: ExportFormat): string {
  const body = [...notes].sort((a, b) => a.timestampSec - b.timestampSec).map(noteToMarkdown).join("\n\n");
  return `${frontmatter(episode, format)}# ${episode.title}\n\n*${episode.show} · ${episode.publishedAt}*\n\n${
    body || "_No notes yet._"
  }\n`;
}

export function buildLibraryMarkdown(episodes: Episode[], notes: NoteBlock[], format: ExportFormat): string {
  const episodesWithNotes = episodes.filter((e) => notes.some((n) => n.episodeId === e.id));
  return episodesWithNotes
    .map((e) => buildEpisodeMarkdown(e, notes.filter((n) => n.episodeId === e.id), format))
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
