// Framework-agnostic: no request/response objects, no process.env. The
// Vercel adapter in api/summarize.ts supplies both, so this can be reused
// by any future runtime and tested without HTTP.

export interface SummarizeInput {
  title?: unknown;
  show?: unknown;
  description?: unknown;
}

export interface SummarizeEnv {
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

export interface ServiceResult<T> {
  status: number;
  body: T | { error: string };
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

export async function summarize(
  input: SummarizeInput,
  env: SummarizeEnv,
): Promise<ServiceResult<{ bullets: string[] }>> {
  // The API key lives only in the server-side environment — the browser never
  // sees it. Without it, fail with a clear, specific message rather than
  // letting the request fail with an opaque auth error.
  if (!env.GROQ_API_KEY) {
    return { status: 503, body: { error: "AI summarization isn't configured yet — no API key set." } };
  }

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const show = typeof input?.show === "string" ? input.show.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";

  if (!title) {
    return { status: 400, body: { error: "Missing episode title." } };
  }

  try {
    const groqRes = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.GROQ_MODEL || DEFAULT_GROQ_MODEL,
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
        return { status: 503, body: { error: "AI summarization isn't configured correctly — invalid API key." } };
      }
      if (groqRes.status === 429) {
        return { status: 429, body: { error: "AI summarization is rate-limited right now — try again in a moment." } };
      }
      if (groqRes.status === 400 && /credit|quota|balance/i.test(message)) {
        return {
          status: 402,
          body: { error: "The Groq account is out of credits — check console.groq.com/settings/billing." },
        };
      }
      if (groqRes.status === 404 && /model/i.test(message)) {
        return {
          status: 500,
          body: {
            error: `AI summarization is misconfigured — the model isn't available on this account. Set GROQ_MODEL to one this key can access.`,
          },
        };
      }
      return { status: 500, body: { error: "AI summarization failed — try again later." } };
    }

    const data = (await groqRes.json()) as GroqChatResponse;
    const text = data.choices?.[0]?.message?.content ?? "";
    const bullets = text
      .split("\n")
      .map((line) => line.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);

    if (bullets.length === 0) {
      return { status: 502, body: { error: "AI summarization returned an empty response." } };
    }

    return { status: 200, body: { bullets } };
  } catch (err) {
    console.error("AI summarization failed:", err);
    return { status: 500, body: { error: "AI summarization failed — try again later." } };
  }
}
