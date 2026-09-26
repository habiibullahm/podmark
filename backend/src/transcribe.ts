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
}

interface GroqErrorResponse {
  error?: { message?: string };
}

const GROQ_TRANSCRIBE_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL = "whisper-large-v3-turbo";
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 25_000;

function isPublicHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return false;
  if (/^127\.|^10\.|^0\.|^169\.254\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(normalized)) return false;
  if (normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:" )) return false;
  return true;
}

function parsePublicHttpUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && isPublicHostname(url.hostname) ? url : null;
  } catch {
    return null;
  }
}

function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [first, second, third] = octets;
    return first !== undefined && second !== undefined && third !== undefined
      && first !== 0 && first !== 10 && first !== 127 && first < 224
      && !(first === 100 && second >= 64 && second <= 127)
      && !(first === 169 && second === 254)
      && !(first === 172 && second >= 16 && second <= 31)
      && !(first === 192 && (second === 168 || second === 0 || (second === 88 && third === 99)))
      && !(first === 198 && (second === 18 || second === 19 || second === 51))
      && !(first === 203 && second === 0 && third === 113);
  }
  if (isIP(address) === 6) {
    const firstHextet = Number.parseInt(address.split(":")[0] ?? "", 16);
    return firstHextet >= 0x2000 && firstHextet <= 0x3fff && !address.toLowerCase().startsWith("2001:db8:");
  }
  return false;
}

async function resolveAudioUrl(value: string): Promise<ServiceResult<{ audioUrl: string }>> {
  let url = parsePublicHttpUrl(value);
  if (!url) {
    return { status: 400, body: { error: "Audio URL must be a public HTTP(S) URL." } };
  }

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (isIP(url.hostname) ? !isPublicAddress(url.hostname) : false) {
      return { status: 400, body: { error: "Audio URL must use a public network address." } };
    }
    if (!isIP(url.hostname)) {
      try {
        const addresses = await lookup(url.hostname, { all: true, verbatim: true });
        if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
          return { status: 400, body: { error: "Audio URL must resolve only to public network addresses." } };
        }
      } catch {
        return { status: 422, body: { error: "Audio host could not be resolved." } };
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "manual",
        signal: controller.signal,
      });
      if (response.status < 300 || response.status >= 400) {
        return { status: 200, body: { audioUrl: url.toString() } };
      }

      const location = response.headers.get("location");
      if (!location) {
        return { status: 422, body: { error: "Podcast host returned an invalid redirect." } };
      }
      if (redirectCount === MAX_REDIRECTS) {
        return { status: 422, body: { error: "Podcast audio redirect limit exceeded." } };
      }

      url = parsePublicHttpUrl(new URL(location, url).toString());
      if (!url) {
        return { status: 400, body: { error: "Podcast audio redirected to a non-public URL." } };
      }
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "Podcast host timed out while resolving the audio URL."
        : "Couldn't resolve the podcast audio URL.";
      return { status: 422, body: { error: message } };
    } finally {
      clearTimeout(timer);
    }
  }

  return { status: 422, body: { error: "Podcast audio redirect limit exceeded." } };
}

export async function transcribeEpisode(
  input: TranscribeInput,
  env: TranscribeEnv,
): Promise<ServiceResult<{ segments: TranscriptSegment[] }>> {
  if (!env.GROQ_API_KEY) {
    return { status: 503, body: { error: "Transcription isn't configured yet — no API key set." } };
  }

  const sourceUrl = typeof input.audioUrl === "string" ? input.audioUrl.trim() : "";
  if (!sourceUrl) return { status: 400, body: { error: "Missing audio URL." } };

  const resolved = await resolveAudioUrl(sourceUrl);
  if (resolved.status !== 200 || !("audioUrl" in resolved.body)) {
    return { status: resolved.status, body: resolved.body as { error: string } };
  }

  const form = new FormData();
  form.append("model", MODEL);
  form.append("url", resolved.body.audioUrl);
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GROQ_TRANSCRIBE_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GROQ_API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as GroqTranscriptionResponse & GroqErrorResponse | null;
    if (!response.ok) {
      const message = payload?.error?.message ?? `Groq API request failed (${response.status}).`;
      console.error("Transcription provider failed:", response.status, message);
      if (response.status === 401) return { status: 503, body: { error: "Transcription API key is invalid." } };
      if (response.status === 429) return { status: 429, body: { error: "Transcription is rate-limited. Try again shortly." } };
      if (response.status === 413 || /too large|file size/i.test(message)) return { status: 413, body: { error: "Podcast audio is too large for transcription." } };
      if (/credit|quota|balance/i.test(message)) return { status: 402, body: { error: "Transcription provider has no available credits." } };
      if (/unsupported|format|download|fetch/i.test(message)) return { status: 422, body: { error: "Couldn't download a supported podcast audio file." } };
      return { status: 502, body: { error: "Transcription provider failed. Try again later." } };
    }

    const segments = (payload?.segments ?? [])
      .map((segment) => ({
        start: typeof segment.start === "number" ? segment.start : 0,
        end: typeof segment.end === "number" ? segment.end : 0,
        text: segment.text?.trim() ?? "",
      }))
      .filter((segment) => segment.text.length > 0);
    if (segments.length === 0) return { status: 502, body: { error: "Transcription returned no speech." } };
    return { status: 200, body: { segments } };
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? "Transcription timed out. Try again later."
      : "Transcription request failed. Try again later.";
    console.error("Transcription failed:", error);
    return { status: 502, body: { error: message } };
  } finally {
    clearTimeout(timer);
  }
}

export function transcriptToText(segments: TranscriptSegment[]): string {
  return segments.map((segment) => segment.text).join(" ");
}
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
