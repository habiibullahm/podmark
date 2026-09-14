// Vercel entrypoint. This folder has to be named `api/` at the project root
// for Vercel to find it, so the HTTP plumbing lives here and nothing else —
// the actual work is in backend/.
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { summarize } from "../backend/src/summarize.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  const { status, body } = await summarize(req.body, process.env);
  res.status(status).json(body);
}
