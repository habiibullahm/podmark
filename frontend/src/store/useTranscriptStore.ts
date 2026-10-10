import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Episode, TranscriptSegment } from "../data/types";
import { getAccessToken } from "../lib/neon";
import { accountEpoch } from "../lib/accountScope";

interface TranscriptState {
  transcripts: Record<string, TranscriptSegment[]>; // episodeId -> segments
  transcribing: Record<string, boolean>;
  transcribeErrors: Record<string, string>;
  generateTranscript: (episode: Episode) => Promise<void>;
  clearTranscript: (episodeId: string) => void;
}

export const useTranscriptStore = create<TranscriptState>()(
  persist(
    (set) => ({
      transcripts: {},
      transcribing: {},
      transcribeErrors: {},
      generateTranscript: async (episode) => {
        if (!episode.audioUrl) return;
        set((state) => {
          const transcribeErrors = { ...state.transcribeErrors };
          delete transcribeErrors[episode.id];
          return { transcribing: { ...state.transcribing, [episode.id]: true }, transcribeErrors };
        });

        const epoch = accountEpoch();
        try {
          // Fresh JWT each call — the one in auth state may have expired.
          const accessToken = await getAccessToken();
          const res = await fetch("/api/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            },
            body: JSON.stringify({ audioUrl: episode.audioUrl }),
          });
          const data = await res.json();
          if (epoch !== accountEpoch()) return; // account changed while waiting
          if (!res.ok) {
            throw new Error(data.error || "Transcription failed.");
          }
          set((state) => ({
            transcripts: { ...state.transcripts, [episode.id]: data.segments },
            transcribing: { ...state.transcribing, [episode.id]: false },
          }));
        } catch (err) {
          if (epoch !== accountEpoch()) return;
          const message = err instanceof Error ? err.message : "Transcription failed.";
          set((state) => ({
            transcribing: { ...state.transcribing, [episode.id]: false },
            transcribeErrors: { ...state.transcribeErrors, [episode.id]: message },
          }));
        }
      },
      clearTranscript: (episodeId) =>
        set((state) => {
          const transcripts = { ...state.transcripts };
          const transcribeErrors = { ...state.transcribeErrors };
          delete transcripts[episodeId];
          delete transcribeErrors[episodeId];
          return { transcripts, transcribeErrors };
        }),
    }),
    { name: "podmark-transcripts" },
  ),
);
