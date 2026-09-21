// Framework-agnostic: no request/response objects. The Vercel adapter in
// api/youtube-transcript.ts supplies the HTTP layer.
//
// Uses @hallelx/youtube-transcript — a TypeScript port of the Python
// youtube-transcript-api — to fetch YouTube video captions via the same
// internal youtubei/v1/player endpoint.
//
// ⚠ Cloud IP limitation
// YouTube's timedtext endpoint penalises datacenter IPs, so this works
// reliably from home/Render/Railway/Fly but **will fail on Vercel serverless**
// unless a proxy is configured (see @hallelx/youtube-transcript proxy docs).

import { WebshareProxyConfig, YouTubeTranscriptApi } from "@hallelx/youtube-transcript";
import type { ServiceResult } from "./summarize.js";
import { extractVideoId } from "./youtube.js";

const EXTERNAL_TRANSCRIPT_URL = "https://getyoutubetranscript.com/api/v1/transcript";

export interface YouTubeTranscriptInput {
  url?: unknown;
}

export interface YouTubeTranscriptSegment {
  start: number;   // seconds
  end: number;     // seconds
  text: string;
}

export interface YouTubeTranscriptOutput {
  videoId: string;
  segments: YouTubeTranscriptSegment[];
}

const api = new YouTubeTranscriptApi(
  process.env.WEBSHARE_PROXY_USERNAME && process.env.WEBSHARE_PROXY_PASSWORD
    ? {
        proxyConfig: new WebshareProxyConfig({
          proxyUsername: process.env.WEBSHARE_PROXY_USERNAME,
          proxyPassword: process.env.WEBSHARE_PROXY_PASSWORD,
        }),
      }
    : undefined,
);

async function fetchExternalTranscript(videoId: string, apiKey: string): Promise<string> {
  const response = await fetch(
    `${EXTERNAL_TRANSCRIPT_URL}?v=${encodeURIComponent(videoId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );

  if (!response.ok) {
    throw new Error(`External transcript provider returned ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const transcript =
    typeof payload === "object" && payload !== null && "data" in payload
      ? (payload.data as { transcript?: unknown } | null)?.transcript
      : undefined;

  if (typeof transcript !== "string" || !transcript.trim()) {
    throw new Error("External transcript provider returned no transcript.");
  }

  return transcript.trim();
}
export async function fetchYouTubeTranscript(
  input: YouTubeTranscriptInput,
): Promise<ServiceResult<YouTubeTranscriptOutput>> {
  const url = typeof input?.url === "string" ? input.url.trim() : "";

  if (!url) {
    return { status: 400, body: { error: "Missing YouTube URL." } };
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    return { status: 400, body: { error: "That doesn't look like a YouTube video URL." } };
  }

  try {
    const externalApiKey = process.env.GETYOUTUBETRANSCRIPT_API_KEY;
    if (externalApiKey) {
      const text = await fetchExternalTranscript(videoId, externalApiKey);
      return {
        status: 200,
        body: { videoId, segments: [{ start: 0, end: 0, text }] },
      };
    }

    const transcript = await api.fetch(videoId, { languages: ["en"] });

    const segments: YouTubeTranscriptSegment[] = transcript.snippets.map((s) => ({
      start: s.start,
      end: s.start + s.duration,
      text: s.text,
    }));

    if (segments.length === 0) {
      return { status: 404, body: { error: "No captions available for this video." } };
    }

    return {
      status: 200,
      body: { videoId, segments },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    if (message.includes("TranscriptsDisabled") || message.includes("disabled")) {
      return { status: 404, body: { error: "Captions are disabled for this video." } };
    }
    if (message.includes("not available") || message.includes("not found")) {
      return { status: 404, body: { error: "No transcript available for this video." } };
    }

    console.error("YouTube transcript fetch failed:", videoId, message);
    return {
      status: 503,
      body: {
        error: process.env.WEBSHARE_PROXY_USERNAME
          ? "YouTube transcript service is temporarily unavailable. Try again later."
          : "YouTube blocks transcript requests from this server. Configure a residential proxy, then try again.",
      },
    };
  }
}
