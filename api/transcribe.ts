// Vercel entrypoint. See api/summarize.ts for why the HTTP plumbing lives
// here and the work lives in backend/.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { transcribeEpisode } from "../backend/src/transcribe.js";
import { bearerToken, verifyUser } from "../backend/src/auth.js";
import { aiQuota } from "../backend/src/quota.js";

// Groq downloads and transcribes the audio itself (we only pass a URL), but
// a long episode can still take a while to come back — give it more room
// than the 10s Hobby-plan default before Vercel gives up on the request.
export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Same reasoning as /api/summarize: this spends Groq credits per call and
  // must not be callable by anyone on the public URL.
  const userId = await verifyUser(req.headers.authorization, process.env);
  if (!userId) {
    res.status(401).json({ error: "Sign in to transcribe this episode." });
    return;
  }

  const { status, body } = await transcribeEpisode(req.body, process.env, aiQuota(bearerToken(req.headers.authorization) ?? "", process.env));
  res.status(status).json(body);
}
