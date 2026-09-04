import type { VercelRequest, VercelResponse } from "@vercel/node";

interface SummarizeRequestBody {
  title?: unknown;
  show?: unknown;
  description?: unknown;
}

interface GroqChatResponse {
  choices?: { message?: { content?: string } }[];
}

interface GroqErrorResponse {
  error?: { message?: string; code?: string };
}

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
// Model availability varies per Groq account/tier — override with the
// GROQ_MODEL env var if the default isn't enabled on your key.
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const SYSTEM_PROMPT =
  'You summarize podcast episodes into concise, insight-dense bullet points for someone deciding what to listen to and take notes on. Output ONLY 3-5 bullet points, one per line, each starting with "- ". No preamble, no headers, no closing remarks.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // The API key lives only in this server-side function's environment — the
  // browser never sees it. Without it, fail with a clear, specific message
  // rather than letting the request fail with an opaque auth error.
  if (!process.env.GROQ_API_KEY) {
    res.status(503).json({ error: "AI summarization isn't configured yet — no API key set." });
    return;
  }

  const body = req.body as SummarizeRequestBody;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const show = typeof body?.show === "string" ? body.show.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (!title) {
    res.status(400).json({ error: "Missing episode title." });
    return;
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Episode: "${title}"\nShow: ${show || "Unknown show"}\n\nShow notes / description:\n${
              description || "(no description available — infer likely content from the title and show name only, and keep the bullets appropriately general)"
            }`,
          },
        ],
      }),
    });

    if (!groqRes.ok) {
      const errBody = (await groqRes.json().catch(() => null)) as GroqErrorResponse | null;
      const message = errBody?.error?.message || `Groq API request failed (${groqRes.status}).`;
      console.error("AI summarization failed:", groqRes.status, message);

      if (groqRes.status === 401) {
        res.status(503).json({ error: "AI summarization isn't configured correctly — invalid API key." });
      } else if (groqRes.status === 429) {
        res.status(429).json({ error: "AI summarization is rate-limited right now — try again in a moment." });
      } else if (groqRes.status === 400 && /credit|quota|balance/i.test(message)) {
        res
          .status(402)
          .json({ error: "The Groq account is out of credits — check console.groq.com/settings/billing." });
      } else if (groqRes.status === 404 && /model/i.test(message)) {
        res.status(500).json({
          error: `AI summarization is misconfigured — the model isn't available on this account. Set GROQ_MODEL to one this key can access.`,
        });
      } else {
        res.status(500).json({ error: "AI summarization failed — try again later." });
      }
      return;
    }

    const data = (await groqRes.json()) as GroqChatResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    const bullets = text
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    if (bullets.length === 0) {
      res.status(502).json({ error: "AI summarization returned an empty response." });
      return;
    }

    res.status(200).json({ bullets });
  } catch (err) {
    console.error("AI summarization failed:", err);
    res.status(500).json({ error: "AI summarization failed — try again later." });
  }
}
