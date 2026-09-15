import { create } from "zustand";
import { persist } from "zustand/middleware";
import { noteBlocks as initialNoteBlocks } from "../data/mockData";
import type { Episode, NoteBlock, NoteBlockType } from "../data/types";
import { useAuthStore } from "./useAuthStore";

interface NotesState {
  notes: NoteBlock[];
  aiSummaries: Record<string, string[]>; // episodeId -> bullet points
  aiSummaryErrors: Record<string, string>; // episodeId -> last error message
  freeformNotes: Record<string, string>; // episodeId -> freeform Markdown notes
  addNote: (
    type: NoteBlockType,
    episodeId: string,
    timestampSec: number,
    text: string,
    tags?: string[],
  ) => void;
  updateNote: (id: string, update: { text: string; tags: string[] }) => void;
  removeNote: (id: string) => void;
  generateSummary: (episode: Episode) => Promise<void>;
  clearSummary: (episodeId: string) => void;
  removeForEpisode: (episodeId: string) => void;
  setFreeformNotes: (episodeId: string, text: string) => void;
}

function generateNoteId(): string {
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const NOTES_VERSION = 2;
const SEED_NOTE_IDS = new Set(initialNoteBlocks.map((n) => n.id));

export const useNotesStore = create<NotesState>()(
  persist(
    (set) => ({
      notes: import.meta.env.DEV ? initialNoteBlocks : [],
      aiSummaries: {},
      aiSummaryErrors: {},
      freeformNotes: {},
      addNote: (type, episodeId, timestampSec, text, tags = []) =>
        set((state) => {
          const now = new Date().toISOString();
          return {
            notes: [
              ...state.notes,
              {
                id: generateNoteId(),
                episodeId,
                type,
                timestampSec,
                text,
                tags,
                createdAt: now,
                updatedAt: now,
              },
            ],
          };
        }),
      updateNote: (id, { text, tags }) =>
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, text, tags, updatedAt: new Date().toISOString() } : n,
          ),
        })),
      removeNote: (id) =>
        set((state) => ({ notes: state.notes.filter((n) => n.id !== id) })),
      generateSummary: async (episode) => {
        set((state) => {
          const aiSummaryErrors = { ...state.aiSummaryErrors };
          delete aiSummaryErrors[episode.id];
          return { aiSummaryErrors };
        });

        try {
          const accessToken = useAuthStore.getState().session?.access_token;
          const res = await fetch("/api/summarize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
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
      clearSummary: (episodeId) =>
        set((state) => {
          const aiSummaries = { ...state.aiSummaries };
          const aiSummaryErrors = { ...state.aiSummaryErrors };
          delete aiSummaries[episodeId];
          delete aiSummaryErrors[episodeId];
          return { aiSummaries, aiSummaryErrors };
        }),
      removeForEpisode: (episodeId) =>
        set((state) => {
          const aiSummaries = { ...state.aiSummaries };
          const aiSummaryErrors = { ...state.aiSummaryErrors };
          const freeformNotes = { ...state.freeformNotes };
          delete aiSummaries[episodeId];
          delete aiSummaryErrors[episodeId];
          delete freeformNotes[episodeId];
          return {
            notes: state.notes.filter((n) => n.episodeId !== episodeId),
            aiSummaries,
            aiSummaryErrors,
            freeformNotes,
          };
        }),
      setFreeformNotes: (episodeId, text) =>
        set((state) => ({ freeformNotes: { ...state.freeformNotes, [episodeId]: text } })),
    }),
    {
      name: "podmark-notes",
      version: NOTES_VERSION,
      migrate: (persistedState, version) => {
        const state = persistedState as NotesState;
        if (version < 1 && Array.isArray(state?.notes)) {
          state.notes = state.notes.map((n) => ({
            ...n,
            updatedAt: n.updatedAt ?? n.createdAt ?? new Date(0).toISOString(),
          }));
        }
        if (version < 2 && !import.meta.env.DEV && Array.isArray(state?.notes)) {
          state.notes = state.notes.filter((n) => !SEED_NOTE_IDS.has(n.id));
        }
        return state;
      },
    },
  ),
);
