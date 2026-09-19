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

import { YouTubeTranscriptApi } from "@hallelx/youtube-transcript";
import type { ServiceResult } from "./summarize.js";
import { extractVideoId } from "./youtube.js";

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

const api = new YouTubeTranscriptApi();

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
    return { status: 502, body: { error: "Couldn't fetch this video's transcript. YouTube may be blocking the request." } };
  }
}
