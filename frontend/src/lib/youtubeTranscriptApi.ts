import type { TranscriptSegment } from "../data/types";

interface FetchResult {
  segments: TranscriptSegment[];
}

export async function fetchYoutubeTranscript(url: string): Promise<TranscriptSegment[]> {
  const res = await fetch("/api/youtube-transcript", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Couldn't fetch transcript.");
  }
  return (data as FetchResult).segments;
}
