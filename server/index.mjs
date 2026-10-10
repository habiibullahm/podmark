import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { summarize } from "../build/summarize.js";
import { transcribeEpisode } from "../build/transcribe.js";
import { lookupYouTubeVideo } from "../build/youtube.js";
import { fetchYouTubeTranscript } from "../build/youtubeTranscript.js";
import { verifyUser } from "../build/auth.js";
import { createLimits } from "./rateLimit.mjs";

const PORT = Number(process.env.PORT || 3000);
const WEB_ROOT = resolve(process.cwd(), "frontend/dist");
// The summarize payload carries the full episode transcript (the backend
// trims it to 60k chars); long episodes can exceed a few hundred KB.
const MAX_BODY_BYTES = 1024 * 1024;
const limits = createLimits();

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".map": "application/json; charset=utf-8",
};

function respondJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function parseJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body too large.");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  let parsed;
  try {
    parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("Request body must contain valid JSON.");
    error.status = 400;
    throw error;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    const error = new Error("Request body must be a JSON object.");
    error.status = 400;
    throw error;
  }
  return parsed;
}

// The container is only reachable through Coolify's proxy, which appends the
// real client address to X-Forwarded-For. With TRUST_PROXY=1 take the
// right-most entry (the one our proxy wrote) — never the left-most, which the
// client controls. Without it, use the socket address.
function clientIp(req) {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = req.headers["x-forwarded-for"];
    const hops = (Array.isArray(forwarded) ? forwarded.join(",") : forwarded ?? "")
      .split(",").map((hop) => hop.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return req.socket.remoteAddress ?? "unknown";
}

function rateLimited(res, result) {
  res.setHeader("Retry-After", String(result.retryAfterSec));
  return respondJson(res, 429, { error: "Too many requests. Please try again later." });
}

// Mirrors api/*.ts one-to-one. `paid` routes spend provider credits per call
// and, as on Vercel, require a verified session before any provider is hit.
const ROUTES = {
  "/api/youtube": { limit: "youtube", run: (input) => lookupYouTubeVideo(input) },
  "/api/youtube-transcript": { limit: "youtubeTranscript", run: (input) => fetchYouTubeTranscript(input) },
  "/api/summarize": {
    paid: true,
    limit: "summarizeUser",
    unauthorized: "Sign in to use AI summary.",
    run: (input) => summarize(input, process.env),
  },
  "/api/transcribe": {
    paid: true,
    limit: "transcribeUser",
    unauthorized: "Sign in to transcribe this episode.",
    run: (input) => transcribeEpisode(input, process.env),
  },
};

async function handleApi(req, res, pathname) {
  const route = ROUTES[pathname];
  if (!route) {
    return respondJson(res, 404, { error: "API endpoint not found." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondJson(res, 405, { error: "Method not allowed." });
  }
  const ip = clientIp(req);
  const apiLimit = limits.api.take(ip);
  if (!apiLimit.allowed) return rateLimited(res, apiLimit);
  if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
    return respondJson(res, 415, { error: "Content-Type must be application/json." });
  }

  if (route.paid) {
    // Verify before reading the body or touching paid-route budgets, so
    // anonymous traffic can't drain other users' quota.
    const userId = await verifyUser(req.headers.authorization, process.env);
    if (!userId) return respondJson(res, 401, { error: route.unauthorized });
    for (const [limiter, key] of [[route.limit, userId], ["paidIp", ip], ["paidGlobal", "global"]]) {
      const result = limits[limiter].take(key);
      if (!result.allowed) {
        console.warn(`Rate limit ${limiter} hit on ${pathname}`);
        return rateLimited(res, result);
      }
    }
  } else {
    const result = limits[route.limit].take(ip);
    if (!result.allowed) return rateLimited(res, result);
  }

  const input = await parseJson(req);
  const { status, body } = await route.run(input);
  return respondJson(res, status, body);
}

async function serveStatic(req, res, pathname) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return respondJson(res, 405, { error: "Method not allowed." });
  }
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return respondJson(res, 400, { error: "Invalid URL." });
  }

  let filename = resolve(WEB_ROOT, "." + decoded);
  if (filename !== WEB_ROOT && !filename.startsWith(WEB_ROOT + sep)) {
    return respondJson(res, 403, { error: "Forbidden." });
  }
  let info;
  try {
    info = await stat(filename);
  } catch {
    // SPA fallback only for page routes; do not turn missing assets into HTML.
  }
  if (!info?.isFile()) {
    if (extname(filename)) return respondJson(res, 404, { error: "Not found." });
    filename = resolve(WEB_ROOT, "index.html");
    try {
      info = await stat(filename);
    } catch {
      return respondJson(res, 503, { error: "Frontend build missing." });
    }
  }

  const isHtml = extname(filename) === ".html";
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[extname(filename)] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": isHtml ? "no-cache" : decoded.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "public, max-age=3600",
  });
  if (req.method === "HEAD") return res.end();
  const stream = createReadStream(filename);
  stream.on("error", (error) => {
    console.error("Static asset error:", error);
    res.destroy(error);
  });
  stream.pipe(res);
}

const server = createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("X-Frame-Options", "DENY");
  try {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (pathname === "/healthz") {
      return respondJson(res, 200, { status: "ok" });
    }
    if (pathname === "/api" || pathname.startsWith("/api/")) {
      return await handleApi(req, res, pathname);
    }
    return await serveStatic(req, res, pathname);
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status === 500) console.error("Unhandled request error:", error);
    if (!res.headersSent) {
      return respondJson(res, status, { error: status === 500 ? "Internal server error." : error.message });
    }
    res.destroy();
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`PodMark listening on 0.0.0.0:${PORT}`);
});

// Node as PID 1 ignores SIGTERM by default, so `docker stop` (and every
// Coolify redeploy) would wait out the full kill timeout. Drain and exit.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => {
    console.log(`${signal} received, shutting down.`);
    server.close(() => process.exit(0));
    server.closeIdleConnections();
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
