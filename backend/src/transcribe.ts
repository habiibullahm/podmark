// Framework-agnostic, like summarize.ts: no request/response objects, no
// process.env. Groq's `url` parameter means it downloads the audio itself —
// this function never streams the file through our own server, so there's
// no risk of it exceeding a Vercel function's payload/memory limits.

export interface TranscribeInput {
  audioUrl?: unknown;
}

export interface TranscribeEnv {
  GROQ_API_KEY?: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface ServiceResult<T> {
  status: number;
  body: T | { error: string };
}

interface GroqTranscriptionSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface GroqTranscriptionResponse {
  segments?: GroqTranscriptionSegment[];
  text?: string;
}

interface GroqErrorResponse {
  error?: { message?: string; code?: string };
}

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
// Turbo is ~3x cheaper than the standard model with comparable accuracy for
// English podcast speech — matches the PRD's $0.04/hr cost target.
const MODEL = "whisper-large-v3-turbo";

export async function transcribeEpisode(
  input: TranscribeInput,
  env: TranscribeEnv,
): Promise<ServiceResult<{ segments: TranscriptSegment[] }>> {
  if (!env.GROQ_API_KEY) {
    return { status: 503, body: { error: "Transcription isn't configured yet — no API key set." } };
  }

  const audioUrl = typeof input?.audioUrl === "string" ? input.audioUrl.trim() : "";
  if (!audioUrl) {
    return { status: 400, body: { error: "Missing audio URL." } };
  }

  const form = new FormData();
  form.append("model", MODEL);
  form.append("url", audioUrl);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  try {
    const groqRes = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
    });

    if (!groqRes.ok) {
      const errBody = (await groqRes.json().catch(() => null)) as GroqErrorResponse | null;
      const message = errBody?.error?.message || `Groq API request failed (${groqRes.status}).`;
      console.error("Transcription failed:", groqRes.status, message);

      if (groqRes.status === 401) {
        return { status: 503, body: { error: "Transcription isn't configured correctly — invalid API key." } };
      }
      if (groqRes.status === 429) {
        return { status: 429, body: { error: "Transcription is rate-limited right now — try again in a moment." } };
      }
      if (groqRes.status === 400 && /credit|quota|balance/i.test(message)) {
        return {
          status: 402,
          body: { error: "The Groq account is out of credits — check console.groq.com/settings/billing." },
        };
      }
      if (groqRes.status === 413 || /too large|file size/i.test(message)) {
        return {
          status: 413,
          body: { error: "This episode's audio file is too large to transcribe on the current Groq tier." },
        };
      }
      if (/unsupported|format|download|fetch/i.test(message)) {
        return { status: 422, body: { error: "Couldn't fetch or read this episode's audio for transcription." } };
      }
      return { status: 500, body: { error: "Transcription failed — try again later." } };
    }

    const data = (await groqRes.json()) as GroqTranscriptionResponse;
    const segments: TranscriptSegment[] = (data.segments ?? [])
      .map((s) => ({
        start: typeof s.start === "number" ? s.start : 0,
        end: typeof s.end === "number" ? s.end : 0,
        text: (s.text ?? "").trim(),
      }))
      .filter((s) => s.text.length > 0);

    if (segments.length === 0) {
      return { status: 502, body: { error: "Transcription returned no speech — the audio may be silent or unreadable." } };
    }

    return { status: 200, body: { segments } };
  } catch (err) {
    console.error("Transcription failed:", err);
    return { status: 500, body: { error: "Transcription failed — try again later." } };
  }
}

// Flattens segments back into plain text for grounding the summary prompt.
export function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((s) => s.text).join(" ");
}
