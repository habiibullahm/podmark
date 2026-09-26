// Vercel entrypoint. This folder has to be named `api/` at the project root
// for Vercel to find it, so the HTTP plumbing lives here and nothing else —
// the actual work is in backend/.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { summarize } from "../backend/src/summarize.js";
import { verifyUser } from "../backend/src/auth.js";

export const config = { maxDuration: 60 };

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // Summaries spend SumoPod credits per call, so this endpoint requires a
  // verified Supabase session — anyone on the public URL could otherwise
  // exhaust the account's credits with no rate limit.
  const userId = await verifyUser(req.headers.authorization, process.env);
  if (!userId) {
    res.status(401).json({ error: "Sign in to use AI summary." });
    return;
  }

  const { status, body } = await summarize(req.body, process.env);
  res.status(status).json(body);
}
