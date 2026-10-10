// Fixed-window, in-memory rate limiter. The Coolify deployment runs a single
// container, so process memory is the whole picture; if it ever scales out,
// this needs a shared store (e.g. Redis) or limits multiply per replica.

export function createRateLimiter({ limit, windowMs, now = Date.now }) {
  const buckets = new Map();

  function sweep(time) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= time) buckets.delete(key);
    }
  }

  return {
    // Returns { allowed, retryAfterSec }. Counts the attempt only when allowed,
    // so a client hammering a full bucket doesn't extend its own lockout.
    take(key) {
      const time = now();
      if (buckets.size > 10_000) sweep(time);
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= time) {
        bucket = { count: 0, resetAt: time + windowMs };
        buckets.set(key, bucket);
      }
      if (bucket.count >= limit) {
        return { allowed: false, retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - time) / 1000)) };
      }
      bucket.count += 1;
      return { allowed: true, retryAfterSec: 0 };
    },
  };
}

function readLimit(env, name, fallback) {
  const value = Number(env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

// Defaults are deliberately conservative for a personal deployment; each is
// overridable from the Coolify environment without a rebuild.
export function createLimits(env = process.env) {
  return {
    // Every /api request, keyed by client IP — also bounds unauthenticated
    // hammering of the paid endpoints, which reject before their own limits.
    api: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_API_PER_MIN", 120), windowMs: MINUTE }),
    // Free endpoints, keyed by client IP.
    youtube: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_YOUTUBE_PER_MIN", 60), windowMs: MINUTE }),
    // Can spend GETYOUTUBETRANSCRIPT_API_KEY / proxy bandwidth and is open to
    // signed-out users (same as the Vercel deployment), so cap it per IP.
    youtubeTranscript: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_YT_TRANSCRIPT_PER_HOUR", 30), windowMs: HOUR }),
    // Paid AI endpoints: per verified user, per IP (sign-up is open, so one
    // IP can mint many users), and a global ceiling as the final cost cap.
    summarizeUser: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_SUMMARIZE_PER_USER_HOUR", 20), windowMs: HOUR }),
    transcribeUser: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_TRANSCRIBE_PER_USER_HOUR", 6), windowMs: HOUR }),
    paidIp: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_PAID_PER_IP_HOUR", 40), windowMs: HOUR }),
    paidGlobal: createRateLimiter({ limit: readLimit(env, "RATE_LIMIT_PAID_GLOBAL_HOUR", 150), windowMs: HOUR }),
  };
}
