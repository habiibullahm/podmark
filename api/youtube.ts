import type { VercelRequest, VercelResponse } from "@vercel/node";

interface YouTubeRequestBody {
  url?: unknown;
}

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

// oEmbed is YouTube's public, key-less metadata endpoint. It deliberately does
// NOT expose captions or duration — fetching those would mean scraping the
// watch page, which YouTube gates behind a PO Token and blocks from datacenter
// IPs, so it would fail only in production. Transcripts are pasted by the user
// instead; see the "Add transcript" flow on the episode detail screen.
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

function extractVideoId(url: string): string | null {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const body = req.body as YouTubeRequestBody;
  const url = typeof body?.url === "string" ? body.url.trim() : "";

  if (!url) {
    res.status(400).json({ error: "Missing YouTube URL." });
    return;
  }

  const videoId = extractVideoId(url);
  if (!videoId) {
    // Reachable by pasting a channel or playlist link, so name what's missing.
    res.status(400).json({ error: "That doesn't look like a YouTube video URL." });
    return;
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
        res.status(404).json({
          error: "That video isn't available — it may be private, deleted, or age-restricted.",
        });
      } else {
        res.status(502).json({ error: "Couldn't reach YouTube — try again in a moment." });
      }
      return;
    }

    const data = (await oembedRes.json()) as OEmbedResponse;
    if (!data.title) {
      res.status(502).json({ error: "YouTube didn't return details for that video." });
      return;
    }

    res.status(200).json({
      videoId,
      title: data.title,
      channel: data.author_name ?? "Unknown channel",
      thumbnailUrl: data.thumbnail_url,
    });
  } catch (err) {
    console.error("YouTube metadata lookup failed:", err);
    res.status(500).json({ error: "Couldn't reach YouTube — try again in a moment." });
  }
}
