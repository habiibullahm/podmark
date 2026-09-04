import { create } from "zustand";
import { persist } from "zustand/middleware";
import { noteBlocks as initialNoteBlocks } from "../data/mockData";
import type { NoteBlock, NoteBlockType } from "../data/types";

interface NotesState {
  notes: NoteBlock[];
  aiSummaries: Record<string, string[]>; // episodeId -> bullet points
  addNote: (
    type: NoteBlockType,
    episodeId: string,
    timestampSec: number,
    text: string,
    tags?: string[],
  ) => void;
  generateSummary: (episodeId: string, episodeTitle: string) => void;
}

function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: initialNoteBlocks,
      aiSummaries: {},
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
      generateSummary: (episodeId, episodeTitle) =>
        set((state) => ({
          aiSummaries: {
            ...state.aiSummaries,
            [episodeId]: [
              `Core thesis of "${episodeTitle}" laid out in the first 10 minutes, with two supporting case studies.`,
              "A practical framework is introduced around minute 15 — three repeatable steps listeners can apply immediately.",
              "Host pushes back on a common misconception, reframing it with a clearer mental model.",
              "Closing segment ties the topic back to a broader long-term habit or system worth adopting.",
            ],
          },
        })),
    }),
    { name: "podmark-notes" },
  ),
);
