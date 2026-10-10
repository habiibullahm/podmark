// Vercel function handlers (api/*.ts, compiled to build/ by tsconfig.test.json)
// called with minimal req/res stand-ins: `npm run test:api`.
//
// Never reaches a paid provider or the network: provider keys are removed from
// process.env, invalid inputs are rejected before any fetch, and JWTs come from
// a local stand-in for Neon Auth (tests/neonAuthFixture.mjs).
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { startNeonAuthFixture } from "./neonAuthFixture.mjs";

const PROVIDER_KEYS = ["SUMOPOD_API_KEY", "GROQ_API_KEY", "GETYOUTUBETRANSCRIPT_API_KEY", "WEBSHARE_PROXY_USERNAME", "WEBSHARE_PROXY_PASSWORD"];

let neon;
let handlers;
const savedEnv = {};

before(async () => {
  for (const name of [...PROVIDER_KEYS, "NEON_AUTH_URL"]) {
    savedEnv[name] = process.env[name];
    delete process.env[name];
  }
  neon = await startNeonAuthFixture();
  process.env.NEON_AUTH_URL = neon.authUrl;
  handlers = {
    youtube: (await import("../build/api/youtube.js")).default,
    youtubeTranscript: (await import("../build/api/youtube-transcript.js")).default,
    summarize: (await import("../build/api/summarize.js")).default,
    transcribe: (await import("../build/api/transcribe.js")).default,
  };
});

after(async () => {
  await neon.close();
  for (const [name, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

async function call(handler, { method = "POST", body = {}, token } = {}) {
  const req = { method, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res = {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  await handler(req, res);
  return res;
}

describe("open endpoints", () => {
  for (const name of ["youtube", "youtubeTranscript"]) {
    test(`${name}: rejects non-POST with 405`, async () => {
      assert.equal((await call(handlers[name], { method: "GET" })).statusCode, 405);
    });
    test(`${name}: validates the URL before any network call (400)`, async () => {
      const res = await call(handlers[name], { body: { url: "not a youtube url" } });
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, /YouTube/);
    });
  }
});

describe("paid endpoints require a signed-in Neon session", () => {
  const cases = {
    summarize: { body: { title: "Episode" }, unauthorized: "Sign in to use AI summary." },
    transcribe: { body: { audioUrl: "https://example.com/a.mp3" }, unauthorized: "Sign in to transcribe this episode." },
  };

  for (const [name, { body, unauthorized }] of Object.entries(cases)) {
    test(`${name}: rejects non-POST with 405`, async () => {
      assert.equal((await call(handlers[name], { method: "GET" })).statusCode, 405);
    });

    test(`${name}: 401 without a token`, async () => {
      const res = await call(handlers[name], { body });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, unauthorized);
    });

    test(`${name}: 401 for anonymous, expired, and foreign-key tokens`, async () => {
      const tokens = [
        await neon.sign({ role: "anonymous" }),
        await neon.sign({ expiresIn: "-1m" }),
        await neon.sign({ key: await neon.otherKey() }),
      ];
      for (const token of tokens) {
        assert.equal((await call(handlers[name], { body, token })).statusCode, 401);
      }
    });

    test(`${name}: a signed-in user reaches the service (503: no provider key in tests)`, async () => {
      const res = await call(handlers[name], { body, token: await neon.sign({ sub: "user-1" }) });
      assert.equal(res.statusCode, 503);
    });
  }

  test("returns 401 when NEON_AUTH_URL is not configured", async () => {
    const token = await neon.sign();
    process.env.NEON_AUTH_URL = "";
    try {
      assert.equal((await call(handlers.summarize, { body: { title: "Episode" }, token })).statusCode, 401);
    } finally {
      process.env.NEON_AUTH_URL = neon.authUrl;
    }
  });
});
