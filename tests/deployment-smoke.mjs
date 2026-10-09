// Smoke + security tests for the deployment server. Two modes:
//   node tests/deployment-smoke.mjs                 spawns server/index.mjs
//   SMOKE_BASE_URL=http://127.0.0.1:3000 node ...   tests a running container
// A container under test must be started with the same SMOKE_ENV below
// (CI does this) so auth and rate-limit assertions line up.
//
// No paid provider is ever called: provider keys are absent, so an
// authenticated request stops at the backend's 503 "not configured".
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { setTimeout as wait } from "node:timers/promises";
import { SignJWT } from "jose";

export const SMOKE_ENV = {
  SUPABASE_JWT_SECRET: "podmark-smoke-test-secret-not-used-anywhere-real",
  RATE_LIMIT_SUMMARIZE_PER_USER_HOUR: "2",
  RATE_LIMIT_YT_TRANSCRIPT_PER_HOUR: "3",
};

const external = process.env.SMOKE_BASE_URL;
const port = 31687;
const base = external ?? `http://127.0.0.1:${port}`;
let server;

if (!external) {
  const env = { ...process.env, ...SMOKE_ENV, PORT: String(port) };
  for (const name of ["SUMOPOD_API_KEY", "GROQ_API_KEY", "SUPABASE_URL", "GETYOUTUBETRANSCRIPT_API_KEY", "TRUST_PROXY"]) {
    delete env[name];
  }
  server = spawn(process.execPath, ["server/index.mjs"], { env, stdio: "inherit" });
}

function token(sub, secret = SMOKE_ENV.SUPABASE_JWT_SECRET, expiresIn = "5m") {
  return new SignJWT({ role: "authenticated" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(new TextEncoder().encode(secret));
}

function post(path, body, headers = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const results = [];
async function check(name, fn) {
  await fn();
  results.push(name);
}

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const health = await fetch(base + "/healthz");
      if (health.ok) {
        assert.deepEqual(await health.json(), { status: "ok" });
        ready = true;
        break;
      }
    } catch {
      // not listening yet
    }
    await wait(250);
  }
  assert.equal(ready, true, "server did not become healthy");

  await check("static: homepage HTML + security headers", async () => {
    const res = await fetch(base + "/");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("cache-control"), "no-cache");
  });

  await check("static: SPA route falls back to index.html", async () => {
    const res = await fetch(base + "/library");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
  });

  await check("static: missing asset is 404, not HTML", async () => {
    const res = await fetch(base + "/assets/does-not-exist.js");
    assert.equal(res.status, 404);
  });

  await check("static: path traversal is blocked", async () => {
    const res = await fetch(base + "/..%2f..%2f..%2fetc%2fpasswd");
    assert.ok([403, 404].includes(res.status), `got ${res.status}`);
    assert.doesNotMatch(await res.text(), /root:/);
  });

  await check("static: manifest is served with its content type", async () => {
    const res = await fetch(base + "/manifest.webmanifest");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /manifest\+json/);
  });

  await check("api: unknown endpoint is 404", async () => {
    assert.equal((await fetch(base + "/api/unknown")).status, 404);
  });

  for (const path of ["/api/youtube", "/api/youtube-transcript", "/api/summarize", "/api/transcribe"]) {
    await check(`api: ${path} is routed and rejects GET with 405`, async () => {
      const res = await fetch(base + path);
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST");
    });
  }

  await check("api: non-JSON content type is 415", async () => {
    const res = await fetch(base + "/api/youtube", { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" });
    assert.equal(res.status, 415);
  });

  await check("api: malformed JSON is 400", async () => {
    assert.equal((await post("/api/youtube", "{not json")).status, 400);
  });

  await check("api: oversized body is 413", async () => {
    const res = await post("/api/youtube", { url: "x".repeat(1024 * 1024 + 10) });
    assert.equal(res.status, 413);
  });

  await check("api: /api/youtube validates input (400)", async () => {
    assert.equal((await post("/api/youtube", { url: "invalid" })).status, 400);
  });

  await check("api: /api/youtube-transcript validates input (400), then rate-limits per IP (429)", async () => {
    for (let i = 0; i < 3; i++) {
      assert.equal((await post("/api/youtube-transcript", { url: "invalid" })).status, 400);
    }
    const limited = await post("/api/youtube-transcript", { url: "invalid" });
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
  });

  for (const path of ["/api/summarize", "/api/transcribe"]) {
    await check(`auth: ${path} without token is 401`, async () => {
      assert.equal((await post(path, { title: "t", audioUrl: "https://example.com/a.mp3" })).status, 401);
    });
    await check(`auth: ${path} with forged/expired/garbage token is 401`, async () => {
      const forged = await token("attacker", "wrong-secret");
      const expired = await token("user-a", SMOKE_ENV.SUPABASE_JWT_SECRET, "-1m");
      const unsigned = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"x"}').toString("base64url")}.`;
      for (const value of [forged, expired, unsigned, "garbage"]) {
        const res = await post(path, { title: "t" }, { Authorization: `Bearer ${value}` });
        assert.equal(res.status, 401);
      }
    });
  }

  await check("auth: valid token reaches the service (503: no provider key in test)", async () => {
    const res = await post("/api/transcribe", { audioUrl: "https://example.com/a.mp3" }, { Authorization: `Bearer ${await token("user-a")}` });
    assert.equal(res.status, 503);
  });

  await check("abuse: paid endpoint is rate-limited per user, other users unaffected", async () => {
    const userB = { Authorization: `Bearer ${await token("user-b")}` };
    assert.equal((await post("/api/summarize", { title: "t" }, userB)).status, 503);
    assert.equal((await post("/api/summarize", { title: "t" }, userB)).status, 503);
    const limited = await post("/api/summarize", { title: "t" }, userB);
    assert.equal(limited.status, 429);
    assert.ok(Number(limited.headers.get("retry-after")) > 0);
    const userC = { Authorization: `Bearer ${await token("user-c")}` };
    assert.equal((await post("/api/summarize", { title: "t" }, userC)).status, 503);
  });

  await check("abuse: unauthenticated calls don't consume a user's quota", async () => {
    for (let i = 0; i < 5; i++) assert.equal((await post("/api/summarize", { title: "t" })).status, 401);
    const userD = { Authorization: `Bearer ${await token("user-d")}` };
    assert.equal((await post("/api/summarize", { title: "t" }, userD)).status, 503);
  });

  for (const name of results) console.log(`  ok  ${name}`);
  console.log(`PodMark deployment smoke tests passed (${results.length} checks against ${base}).`);
} finally {
  server?.kill("SIGTERM");
}
