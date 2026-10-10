// Daily per-user limit on paid provider calls, enforced by Postgres
// (consume_ai_quota() in backend/neon/migrations/0002_ai_usage.sql) and
// reached through the Neon Data API with the caller's own JWT — no database
// credentials on the server, and the database keys the count on the JWT's
// sub itself. Fails closed: if the count can't be recorded, no provider call.
import type { ServiceResult } from "./summarize.js";

// Mirrors the constant in consume_ai_quota(); used only in messages.
export const DAILY_AI_LIMIT = 5;

export interface QuotaEnv {
  // The Data API base URL, e.g. https://ep-….apirest.<region>.aws.neon.tech/neondb/rest/v1.
  // Falls back to the frontend's copy of the same public URL, which Vercel
  // also exposes to functions.
  NEON_DATA_API_URL?: string;
  VITE_NEON_DATA_API_URL?: string;
}

// Called by a service right before it spends money: null means go ahead,
// anything else is the response to return instead.
export type QuotaCheck = () => Promise<ServiceResult<never> | null>;

const QUOTA_TIMEOUT_MS = 5_000;
const UNAVAILABLE: ServiceResult<never> = {
  status: 503,
  body: { error: "Usage limit check is unavailable. Try again later." },
};

export function aiQuota(token: string, env: QuotaEnv): QuotaCheck {
  return async () => {
    const dataApiUrl = (env.NEON_DATA_API_URL || env.VITE_NEON_DATA_API_URL)?.replace(/\/$/, "");
    if (!dataApiUrl) {
      console.error("quota: NEON_DATA_API_URL is not set; rejecting");
      return UNAVAILABLE;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), QUOTA_TIMEOUT_MS);
    try {
      const response = await fetch(`${dataApiUrl}/rpc/consume_ai_quota`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: "{}",
        signal: controller.signal,
      });
      if (!response.ok) {
        console.error(`quota: Data API returned ${response.status}`);
        return UNAVAILABLE;
      }
      const remaining: unknown = await response.json();
      if (remaining === null) {
        return {
          status: 429,
          body: { error: `Daily limit reached (${DAILY_AI_LIMIT} AI requests per day). Try again tomorrow.` },
        };
      }
      if (typeof remaining !== "number") {
        console.error("quota: unexpected Data API response");
        return UNAVAILABLE;
      }
      return null;
    } catch (error) {
      console.error(`quota: Data API request failed (${error instanceof Error ? error.name : "error"})`);
      return UNAVAILABLE;
    } finally {
      clearTimeout(timer);
    }
  };
}
