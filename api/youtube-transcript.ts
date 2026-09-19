// Vercel entrypoint for YouTube transcript fetching.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchYouTubeTranscript } from "../backend/src/youtubeTranscript.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { status, body } = await fetchYouTubeTranscript(req.body);
  res.status(status).json(body);
}
