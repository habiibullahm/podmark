// Vercel entrypoint for YouTube transcript fetching. See api/summarize.ts for
// why the HTTP plumbing lives here and the work lives in backend/.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { fetchYouTubeTranscript } from "../backend/src/youtubeTranscript.js";
import { bearerToken, verifyUser } from "../backend/src/auth.js";
import { aiQuota } from "../backend/src/quota.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Transcripts come from a paid provider (or a paid residential proxy), so
  // like /api/summarize this needs a verified session and counts against the
  // user's daily limit.
  const userId = await verifyUser(req.headers.authorization, process.env);
  if (!userId) {
    res.status(401).json({ error: "Sign in to fetch YouTube transcripts." });
    return;
  }

  const quota = aiQuota(bearerToken(req.headers.authorization) ?? "", process.env);
  const { status, body } = await fetchYouTubeTranscript(req.body, quota);
  res.status(status).json(body);
}
