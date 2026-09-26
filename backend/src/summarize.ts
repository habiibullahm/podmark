export interface SummarizeInput {
  title?: unknown;
  show?: unknown;
  description?: unknown;
  transcript?: unknown;
}

export interface SummarizeEnv {
  SUMOPOD_API_KEY?: string;
  SUMOPOD_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

export interface ServiceResult<T> {
  status: number;
  body: T | { error: string };
}

interface ProviderResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

const SUMOPOD_URL = "https://ai.sumopod.com/v1/chat/completions";
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_SUMOPOD_MODEL = "deepseek-v4-flash";
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";
const MAX_TRANSCRIPT_CHARS = 60_000;
const PROVIDER_TIMEOUT_MS = 25_000;
const SYSTEM_PROMPT = "Summarize the podcast episode into 3-5 concise, insight-dense bullets. Output only one bullet per line, with no preamble.";

function parseBullets(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function callProvider(
  url: string,
  apiKey: string,
  model: string,
  prompt: string,
): Promise<{ bullets?: string[]; message: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as ProviderResponse | null;
    if (!response.ok) {
      return { message: payload?.error?.message ?? `Provider returned ${response.status}.`, status: response.status };
    }
    const bullets = parseBullets(payload?.choices?.[0]?.message?.content ?? "");
    return bullets.length ? { bullets, message: "ok", status: 200 } : { message: "Provider returned an empty response.", status: 502 };
  } catch (error) {
    return {
      message: error instanceof Error && error.name === "AbortError" ? "Provider timed out." : "Provider request failed.",
      status: 504,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function summarize(
  input: SummarizeInput,
  env: SummarizeEnv,
): Promise<ServiceResult<{ bullets: string[] }>> {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  const show = typeof input.show === "string" ? input.show.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  const transcript = typeof input.transcript === "string" ? input.transcript.trim() : "";
  if (!title) return { status: 400, body: { error: "Missing episode title." } };
  if (!env.SUMOPOD_API_KEY && !env.GROQ_API_KEY) return { status: 503, body: { error: "AI summarization isn't configured yet — no provider key set." } };

  const prompt = [
    `Title: ${title}`,
    show ? `Show: ${show}` : "",
    description ? `Description: ${description}` : "",
    transcript ? `Transcript:\n${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}` : "",
  ].filter(Boolean).join("\n\n");
  const failures: string[] = [];
  const providers = [
    env.SUMOPOD_API_KEY ? { key: env.SUMOPOD_API_KEY, model: env.SUMOPOD_MODEL ?? DEFAULT_SUMOPOD_MODEL, name: "SumoPod", url: SUMOPOD_URL } : null,
    env.GROQ_API_KEY ? { key: env.GROQ_API_KEY, model: env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL, name: "Groq", url: GROQ_URL } : null,
  ].filter((provider): provider is NonNullable<typeof provider> => provider !== null);

  for (const provider of providers) {
    const result = await callProvider(provider.url, provider.key, provider.model, prompt);
    if (result.bullets) return { status: 200, body: { bullets: result.bullets } };
    failures.push(`${provider.name}: ${result.message}`);
  }

  console.error("AI summarization providers failed:", failures.join("; "));
  return { status: 503, body: { error: "AI summarization temporarily unavailable. Try again later." } };
}