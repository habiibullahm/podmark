import { create } from "zustand";
import { persist } from "zustand/middleware";
import { noteBlocks as initialNoteBlocks } from "../data/mockData";
import type { Episode, NoteBlock, NoteBlockType } from "../data/types";

interface NotesState {
  notes: NoteBlock[];
  aiSummaries: Record<string, string[]>; // episodeId -> bullet points
  aiSummaryErrors: Record<string, string>; // episodeId -> last error message
  addNote: (
    type: NoteBlockType,
    episodeId: string,
    timestampSec: number,
    text: string,
    tags?: string[],
  ) => void;
  generateSummary: (episode: Episode) => Promise<void>;
}

function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: initialNoteBlocks,
      aiSummaries: {},
      aiSummaryErrors: {},
      addNote: (type, episodeId, timestampSec, text, tags = []) =>
        set((state) => ({
          notes: [
            ...state.notes,
            {
              id: generateNoteId(),
              episodeId,
              type,
              timestampSec,
              text,
              tags,
              createdAt: new Date().toISOString(),
            },
          ],
        })),
      generateSummary: async (episode) => {
        set((state) => {
          const aiSummaryErrors = { ...state.aiSummaryErrors };
          delete aiSummaryErrors[episode.id];
          return { aiSummaryErrors };
        });

        try {
          const res = await fetch("/api/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: episode.title,
              show: episode.show,
              description: episode.description,
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "AI summarization failed.");
          }
          set((state) => ({
            aiSummaries: { ...state.aiSummaries, [episode.id]: data.bullets },
          }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "AI summarization failed.";
          set((state) => ({
            aiSummaryErrors: { ...state.aiSummaryErrors, [episode.id]: message },
          }));
        }
      },
    }),
    { name: "podmark-notes" },
  ),
);
