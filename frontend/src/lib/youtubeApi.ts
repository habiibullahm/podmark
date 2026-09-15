import type { Episode } from "../data/types";

interface YouTubeMetadata {
  videoId: string;
  title: string;
  channel: string;
  thumbnailUrl?: string;
}

// Decides which action a single input should take. Deliberately lenient — the
// server does the real parsing and returns a precise error, so this only needs
// to tell "a link was pasted" apart from "words were typed".
export function isYouTubeUrl(value: string): boolean {
  return /youtube\.com|youtu\.be/i.test(value.trim());
}

export async function fetchYouTubeEpisode(url: string): Promise<Episode> {
  const res = await fetch("/api/youtube", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Couldn't add that YouTube video.");
  }

  const meta = data as YouTubeMetadata;
  return {
    id: `youtube-${meta.videoId}`,
    title: meta.title,
    show: meta.channel,
    artworkGradient: "linear-gradient(135deg, #EF4444, #7F1D1D)",
    artworkImageUrl: meta.thumbnailUrl,
    // oEmbed doesn't expose duration, and this is load-bearing rather than a
    // gap: a duration of 0 keeps the simulated playback timer from advancing,
    // so a video we can't actually play never accrues fake listening progress.
    durationSec: 0,
    progressSec: 0,
    status: "not-started",
    tags: ["youtube"],
    publishedAt: "",
    sourceUrl: url,
    updatedAt: new Date().toISOString(),
  };
}
