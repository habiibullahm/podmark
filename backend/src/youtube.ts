// Framework-agnostic: no request/response objects. The Vercel adapter in
// api/youtube.ts supplies the HTTP layer.

import type { ServiceResult } from "./summarize.js";

export interface YouTubeInput {
  url?: unknown;
}

export interface YouTubeMetadata {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
}

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

// oEmbed is YouTube's public, key-less metadata endpoint. It deliberately does
// NOT expose captions or duration — fetching those would mean scraping the
// watch page, which YouTube gates behind a PO Token and blocks from datacenter
// IPs, so it would fail only in production. With no legitimate way to get a
// video's content, YouTube episodes are notes-only: no AI summary is offered.
const OEMBED_URL = "https://www.youtube.com/oembed";

// Covers watch?v=, youtu.be/, /shorts/, /live/ and /embed/ forms. A YouTube
// video id is always 11 chars of [A-Za-z0-9_-].
const VIDEO_ID_PATTERNS = [
  /[?&]v=([A-Za-z0-9_-]{11})/,
  /youtu\.be\/([A-Za-z0-9_-]{11})/,
  /\/shorts\/([A-Za-z0-9_-]{11})/,
  /\/live\/([A-Za-z0-9_-]{11})/,
  /\/embed\/([A-Za-z0-9_-]{11})/,
];

export function extractVideoId(url: string): string | null {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function lookupYouTubeVideo(input: YouTubeInput): Promise<ServiceResult<YouTubeMetadata>> {
  const url = typeof input?.url === "string" ? input.url.trim() : "";

  if (!url) {
    return { status: 400, body: { error: "Missing YouTube URL." } };
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    // Reachable by pasting a channel or playlist link, so name what's missing.
    return { status: 400, body: { error: "That doesn't look like a YouTube video URL." } };
  }

  try {
    // Rebuild a canonical watch URL rather than passing the user's string
    // through — shortened, embed and share-tracking forms aren't all accepted
    // by oEmbed, but the canonical form always is.
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const oembedRes = await fetch(
      `${OEMBED_URL}?${new URLSearchParams({ url: watchUrl, format: "json" })}`,
    );

    if (!oembedRes.ok) {
      console.error("YouTube metadata lookup failed:", oembedRes.status, videoId);
      // oEmbed answers 400 (not 404) for a well-formed id that has no visible
      // video behind it — deleted, private, or age-restricted all land here.
      if ([400, 401, 403, 404].includes(oembedRes.status)) {
        return {
          status: 404,
          body: { error: "That video isn't available — it may be private, deleted, or age-restricted." },
        };
      }
      return { status: 502, body: { error: "Couldn't reach YouTube — try again in a moment." } };
    }

    const data = (await oembedRes.json()) as OEmbedResponse;
    if (!data.title) {
      return { status: 502, body: { error: "YouTube didn't return details for that video." } };
    }

    return {
      status: 200,
      body: {
        videoId,
        title: data.title,
        channel: data.author_name ?? "Unknown channel",
        thumbnailUrl: data.thumbnail_url,
      },
    };
  } catch (err) {
    console.error("YouTube metadata lookup failed:", err);
    return { status: 500, body: { error: "Couldn't reach YouTube — try again in a moment." } };
  }
}
