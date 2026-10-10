// Vercel entrypoint. This folder has to be named `api/` at the project root
// for Vercel to find it, so the HTTP plumbing lives here and nothing else —
// the actual work is in backend/.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { summarize } from "../backend/src/summarize.js";
import { bearerToken, verifyUser } from "../backend/src/auth.js";
import { aiQuota } from "../backend/src/quota.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Summaries spend SumoPod credits per call, so this endpoint requires a
  // verified Neon Auth session and counts against the user's daily limit
  // (backend/src/quota.ts) — otherwise anyone could exhaust the credits.
  const userId = await verifyUser(req.headers.authorization, process.env);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use AI summary." });
    return;
  }

  const { status, body } = await summarize(req.body, process.env, aiQuota(bearerToken(req.headers.authorization) ?? "", process.env));
  res.status(status).json(body);
}
