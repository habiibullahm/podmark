// Request-body checks shared by the services. Vercel already caps a function
// body at 4.5 MB; these bound what can reach a provider prompt or a fetch.
import type { ServiceResult } from "./summarize.js";

export const MAX_URL_CHARS = 2_048;

export const INVALID_BODY: ServiceResult<never> = {
  status: 400,
  body: { error: "Request body must be a JSON object." },
};

// A JSON object body, or null for anything else (missing, string, array…).
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function tooLong(field: string, max: number): ServiceResult<never> {
  return { status: 400, body: { error: `${field} is too long (max ${max.toLocaleString("en-US")} characters).` } };
}
