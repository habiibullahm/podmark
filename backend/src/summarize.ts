// Framework-agnostic: no request/response objects, no process.env. The
// Vercel adapter in api/summarize.ts supplies both, so this can be reused
// by any future runtime and tested without HTTP.

export interface SummarizeInput {
  title?: unknown;
  show?: unknown;
  description?: unknown;
  transcript?: unknown;
}

export interface SummarizeEnv {
  SUMOPOD_API_KEY?: string;
  SUMOPOD_MODEL?: string;
}

export interface ServiceResult<T> {
  status: number;
  body: T | { error: string };
}

interface ChatCompletionResponse {
  choices?: { message?: { content?: string } }[];
}

interface ChatCompletionErrorResponse {
  error?: { message?: string; code?: string };
}

// SumoPod is an OpenAI-compatible gateway — same request/response shape as
// the OpenAI chat completions API, just a different base URL and key.
const SUMOPOD_URL = "https://ai.sumopod.com/v1/chat/completions";
// Model access is restricted per API key — override with SUMOPOD_MODEL if
// this one isn't enabled on yours. deepseek-v4-flash is a reasoning model:
// it spends completion tokens on internal thinking before the final answer,
// so max_tokens below needs real headroom or the response truncates empty.
const DEFAULT_SUMOPOD_MODEL = "deepseek-v4-flash";

const SYSTEM_PROMPT =
  'You summarize podcast episodes into concise, insight-dense bullet points for someone deciding what to listen to and take notes on. When given a transcript, summarize what was actually said, not what you assume a show with this title covers. When given only a title and show name (no transcript or description), you MUST still produce your best general-knowledge guess at the episode\'s likely content — never refuse and never ask for more information; if you are genuinely unsure, hedge in the bullets themselves (e.g. "Likely covers...") rather than declining to answer. Output ONLY 3-5 bullet points, one per line, each starting with "- ". No preamble, no headers, no closing remarks.';

// Bounds cost/latency on an unusually long episode. ~60k characters covers a
// full hour of typical podcast speech; beyond that the opening portion is
// still enough to ground a useful summary.
const MAX_TRANSCRIPT_CHARS = 60_000;

export async function summarize(
  input: SummarizeInput,
  env: SummarizeEnv,
): Promise<ServiceResult<{ bullets: string[] }>> {
  // The API key lives only in the server-side environment — the browser never
  // sees it. Without it, fail with a clear, specific message rather than
  // letting the request fail with an opaque auth error.
  if (!env.SUMOPOD_API_KEY) {
    return { status: 503, body: { error: "AI summarization isn't configured yet — no API key set." } };
  }

  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const show = typeof input?.show === "string" ? input.show.trim() : "";
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  const transcript = typeof input?.transcript === "string" ? input.transcript.trim() : "";

  if (!title) {
    return { status: 400, body: { error: "Missing episode title." } };
  }

  // A transcript of what was actually said outranks show notes, which are
  // written by the publisher and often don't reflect the episode itself.
  const groundingContent = transcript
    ? `Transcript of what was actually said:\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}`
    : `Show notes / description:\n${
        description ||
        "(no description available — infer likely content from the title and show name only, and keep the bullets appropriately general)"
      }`;

  try {
    const sumopodRes = await fetch(SUMOPOD_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.SUMOPOD_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.SUMOPOD_MODEL || DEFAULT_SUMOPOD_MODEL,
        max_tokens: 1024,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Episode: "${title}"\nShow: ${show || "Unknown show"}\n\n${groundingContent}`,
          },
        ],
      }),
    });

    if (!sumopodRes.ok) {
      const errBody = (await sumopodRes.json().catch(() => null)) as ChatCompletionErrorResponse | null;
      const message = errBody?.error?.message || `SumoPod API request failed (${sumopodRes.status}).`;
      console.error("AI summarization failed:", sumopodRes.status, message);

      if (sumopodRes.status === 401) {
        return { status: 503, body: { error: "AI summarization isn't configured correctly — invalid API key." } };
      }
      if (sumopodRes.status === 429) {
        return { status: 429, body: { error: "AI summarization is rate-limited right now — try again in a moment." } };
      }
      if (sumopodRes.status === 400 && /credit|quota|balance/i.test(message)) {
        return {
          status: 402,
          body: { error: "The SumoPod account is out of credits — check your SumoPod billing dashboard." },
        };
      }
      if (sumopodRes.status === 404 && /model/i.test(message)) {
        return {
          status: 500,
          body: {
            error: `AI summarization is misconfigured — the model isn't available on this account. Set SUMOPOD_MODEL to one this key can access.`,
          },
        };
      }
      return { status: 500, body: { error: "AI summarization failed — try again later." } };
    }

    const data = (await sumopodRes.json()) as ChatCompletionResponse;
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
