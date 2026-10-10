import type { TranscriptSegment } from "../data/types";
import { getAccessToken } from "./neon";

interface FetchResult {
  segments: TranscriptSegment[];
}

export async function fetchYoutubeTranscript(url: string): Promise<TranscriptSegment[]> {
  // Paid provider: the endpoint needs a signed-in session (fresh JWT).
  const accessToken = await getAccessToken();
  const res = await fetch("/api/youtube-transcript", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Couldn't fetch transcript.");
  }
  return (data as FetchResult).segments;
}
