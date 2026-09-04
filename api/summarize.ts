import type { VercelRequest, VercelResponse } from "@vercel/node";
import Anthropic from "@anthropic-ai/sdk";

interface SummarizeRequestBody {
  title?: unknown;
  show?: unknown;
  description?: unknown;
}

const SYSTEM_PROMPT =
  'You summarize podcast episodes into concise, insight-dense bullet points for someone deciding what to listen to and take notes on. Output ONLY 3-5 bullet points, one per line, each starting with "- ". No preamble, no headers, no closing remarks.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  // The API key lives only in this server-side function's environment — the
  // browser never sees it. Without it, fail with a clear, specific message
  // rather than letting the Anthropic client throw an opaque auth error.
  if (!process.env.ANTHROPIC_API_KEY) {
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
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Episode: "${title}"\nShow: ${show || "Unknown show"}\n\nShow notes / description:\n${
            description || "(no description available — infer likely content from the title and show name only, and keep the bullets appropriately general)"
          }`,
        },
      ],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    );
    const bullets = (textBlock?.text ?? "")
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
    if (err instanceof Anthropic.AuthenticationError) {
      res.status(503).json({ error: "AI summarization isn't configured correctly — invalid API key." });
    } else if (err instanceof Anthropic.RateLimitError) {
      res.status(429).json({ error: "AI summarization is rate-limited right now — try again in a moment." });
    } else if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
      res
        .status(402)
        .json({ error: "The Anthropic account is out of API credits — add credits at console.anthropic.com/settings/billing." });
    } else {
      res.status(500).json({ error: "AI summarization failed — try again later." });
    }
  }
}
