import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { summarize } from "../build/summarize.js";
import { transcribeEpisode } from "../build/transcribe.js";
import { lookupYouTubeVideo } from "../build/youtube.js";
import { verifyUser } from "../build/auth.js";

const PORT = Number(process.env.PORT || 3000);
const WEB_ROOT = resolve(process.cwd(), "frontend/dist");
const MAX_BODY_BYTES = 256 * 1024;

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

async function handleApi(req, res, pathname) {
  if (!["/api/youtube", "/api/summarize", "/api/transcribe"].includes(pathname)) {
    return respondJson(res, 404, { error: "API endpoint not found." });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return respondJson(res, 405, { error: "Method not allowed." });
  }
  if (!req.headers["content-type"]?.toLowerCase().includes("application/json")) {
    return respondJson(res, 415, { error: "Content-Type must be application/json." });
  }

  const input = await parseJson(req);
  if (pathname === "/api/youtube") {
    const { status, body } = await lookupYouTubeVideo(input);
    return respondJson(res, status, body);
  }

  // Paid provider endpoints require a valid Supabase session, just like Vercel.
  const userId = await verifyUser(req.headers.authorization, process.env);
  if (!userId) {
    return respondJson(res, 401, {
      error: pathname === "/api/summarize"
        ? "Sign in to use AI summary."
        : "Sign in to transcribe this episode.",
    });
  }
  const { status, body } = pathname === "/api/summarize"
    ? await summarize(input, process.env)
    : await transcribeEpisode(input, process.env);
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
