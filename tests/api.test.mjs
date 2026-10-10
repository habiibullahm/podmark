// Vercel function handlers (api/*.ts, compiled to build/ by tsconfig.test.json)
// called with minimal req/res stand-ins: `npm run test:api`.
//
// Never reaches a paid provider, Neon, or the network: provider keys are fake,
// global fetch is replaced by a router that answers the Data API's
// consume_ai_quota RPC and each provider with canned responses (and fails the
// test on anything else), and JWTs come from a local stand-in for Neon Auth
// (tests/neonAuthFixture.mjs).
import assert from "node:assert/strict";
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import { startNeonAuthFixture } from "./neonAuthFixture.mjs";

const PROVIDER_KEYS = ["SUMOPOD_API_KEY", "GROQ_API_KEY", "GETYOUTUBETRANSCRIPT_API_KEY", "WEBSHARE_PROXY_USERNAME", "WEBSHARE_PROXY_PASSWORD"];
const NEON_VARS = ["NEON_AUTH_URL", "NEON_DATA_API_URL", "VITE_NEON_DATA_API_URL"];
const DATA_API = "https://data.neon.test/neondb/rest/v1";
const QUOTA_RPC = `${DATA_API}/rpc/consume_ai_quota`;
// A public IP literal: transcribe's SSRF guard accepts it without a DNS lookup.
const AUDIO_URL = "https://93.184.216.34/episode.mp3";

let neon;
let handlers;
const savedEnv = {};
const realFetch = globalThis.fetch;

// ---- fetch router ----------------------------------------------------------

const net = {
  calls: [],
  // What consume_ai_quota answers: remaining count, null (limit reached), or
  // { status } for a Data API failure.
  quota: 4,
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function fakeFetch(input, init = {}) {
  const url = String(input instanceof Request ? input.url : input);
  // The local Neon Auth fixture (JWKS) is real.
  if (url.startsWith(neon.authUrl)) return realFetch(input, init);
  const headers = new Headers(init.headers);
  net.calls.push({ url, method: init.method ?? "GET", authorization: headers.get("authorization") });

  if (url === QUOTA_RPC) {
    if (net.quota && typeof net.quota === "object") return json({ message: "boom" }, net.quota.status);
    return json(net.quota);
  }
  if (url === "https://ai.sumopod.com/v1/chat/completions") {
    return json({ choices: [{ message: { content: "- First insight\n- Second insight" } }] });
  }
  if (url === AUDIO_URL && init.method === "HEAD") return new Response(null, { status: 200 });
  if (url === "https://api.groq.com/openai/v1/audio/transcriptions") {
    return json({ segments: [{ start: 0, end: 2, text: "Hello there" }] });
  }
  if (url.startsWith("https://getyoutubetranscript.com/api/v1/transcript")) {
    return json({ data: { transcript: "Captions text" } });
  }
  throw new Error(`unexpected network call in test: ${url}`);
}

const providerCalls = () => net.calls.filter((c) => c.url !== QUOTA_RPC);
const quotaCalls = () => net.calls.filter((c) => c.url === QUOTA_RPC);

before(async () => {
  for (const name of [...PROVIDER_KEYS, ...NEON_VARS]) {
    savedEnv[name] = process.env[name];
    delete process.env[name];
  }
  neon = await startNeonAuthFixture();
  process.env.NEON_AUTH_URL = neon.authUrl;
  process.env.NEON_DATA_API_URL = DATA_API;
  globalThis.fetch = fakeFetch;
  handlers = {
    youtube: (await import("../build/api/youtube.js")).default,
    youtubeTranscript: (await import("../build/api/youtube-transcript.js")).default,
    summarize: (await import("../build/api/summarize.js")).default,
    transcribe: (await import("../build/api/transcribe.js")).default,
  };
});

beforeEach(() => {
  net.calls = [];
  net.quota = 4;
});

after(async () => {
  globalThis.fetch = realFetch;
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

function withProviderKeys() {
  beforeEach(() => {
    process.env.SUMOPOD_API_KEY = "test-sumopod-key";
    process.env.GROQ_API_KEY = "test-groq-key";
    process.env.GETYOUTUBETRANSCRIPT_API_KEY = "test-transcript-key";
  });
  afterEach(() => {
    for (const name of PROVIDER_KEYS) delete process.env[name];
  });
}

const PAID = {
  summarize: { body: { title: "Episode", show: "Show" }, invalid: {}, unauthorized: "Sign in to use AI summary." },
  transcribe: { body: { audioUrl: AUDIO_URL }, invalid: { audioUrl: "" }, unauthorized: "Sign in to transcribe this episode." },
  youtubeTranscript: { body: { url: "https://youtu.be/dQw4w9WgXcQ" }, invalid: { url: "not a youtube url" }, unauthorized: "Sign in to fetch YouTube transcripts." },
};

// ---- tests -----------------------------------------------------------------

describe("open endpoint: youtube lookup", () => {
  test("rejects non-POST with 405", async () => {
    assert.equal((await call(handlers.youtube, { method: "GET" })).statusCode, 405);
  });
  test("validates the URL before any network call (400)", async () => {
    const res = await call(handlers.youtube, { body: { url: "not a youtube url" } });
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /YouTube/);
    assert.equal(net.calls.length, 0);
  });
});

describe("paid endpoints require a signed-in Neon session", () => {
  for (const [name, { body, unauthorized }] of Object.entries(PAID)) {
    test(`${name}: rejects non-POST with 405`, async () => {
      assert.equal((await call(handlers[name], { method: "GET" })).statusCode, 405);
    });

    test(`${name}: 401 without a token`, async () => {
      const res = await call(handlers[name], { body });
      assert.equal(res.statusCode, 401);
      assert.equal(res.body.error, unauthorized);
      assert.equal(net.calls.length, 0);
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
      assert.equal(net.calls.length, 0);
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

  test("a signed-in user with no provider keys gets 503 without spending quota", async () => {
    const token = await neon.sign({ sub: "user-1" });
    for (const name of ["summarize", "transcribe"]) {
      assert.equal((await call(handlers[name], { body: PAID[name].body, token })).statusCode, 503);
    }
    assert.equal(quotaCalls().length, 0);
  });
});

describe("daily AI limit (consume_ai_quota via the Data API)", () => {
  withProviderKeys();

  for (const [name, { body, invalid }] of Object.entries(PAID)) {
    test(`${name}: under the limit — counts once with the caller's JWT, then calls the provider`, async () => {
      const token = await neon.sign({ sub: "user-quota" });
      const res = await call(handlers[name], { body, token });
      assert.equal(res.statusCode, 200, JSON.stringify(res.body));
      assert.equal(quotaCalls().length, 1);
      assert.equal(quotaCalls()[0].method, "POST");
      assert.equal(quotaCalls()[0].authorization, `Bearer ${token}`);
      // Exactly one count, made before the single paid call (transcribe's
      // free HEAD on the audio URL aside).
      const order = net.calls.filter((c) => c.method !== "HEAD").map((c) => (c.url === QUOTA_RPC ? "quota" : "provider"));
      assert.deepEqual(order, ["quota", "provider"]);
    });

    test(`${name}: limit reached — 429 and no provider call`, async () => {
      net.quota = null;
      const res = await call(handlers[name], { body, token: await neon.sign() });
      assert.equal(res.statusCode, 429);
      assert.match(res.body.error, /Daily limit reached \(5 AI requests per day\)/);
      assert.deepEqual(providerCalls().filter((c) => c.method !== "HEAD"), []);
    });

    test(`${name}: Data API failure fails closed — 503 and no provider call`, async () => {
      net.quota = { status: 500 };
      const res = await call(handlers[name], { body, token: await neon.sign() });
      assert.equal(res.statusCode, 503);
      assert.deepEqual(providerCalls().filter((c) => c.method !== "HEAD"), []);
    });

    test(`${name}: invalid input is rejected before the quota is touched`, async () => {
      const res = await call(handlers[name], { body: invalid, token: await neon.sign() });
      assert.equal(res.statusCode, 400);
      assert.equal(net.calls.length, 0);
    });
  }

  test("no Data API URL configured — 503, nothing spent", async () => {
    delete process.env.NEON_DATA_API_URL;
    try {
      const res = await call(handlers.summarize, { body: PAID.summarize.body, token: await neon.sign() });
      assert.equal(res.statusCode, 503);
      assert.equal(net.calls.length, 0);
    } finally {
      process.env.NEON_DATA_API_URL = DATA_API;
    }
  });

  test("falls back to VITE_NEON_DATA_API_URL (the same public URL Vercel already has)", async () => {
    delete process.env.NEON_DATA_API_URL;
    process.env.VITE_NEON_DATA_API_URL = `${DATA_API}/`;
    try {
      const res = await call(handlers.summarize, { body: PAID.summarize.body, token: await neon.sign() });
      assert.equal(res.statusCode, 200);
      assert.equal(quotaCalls().length, 1);
    } finally {
      delete process.env.VITE_NEON_DATA_API_URL;
      process.env.NEON_DATA_API_URL = DATA_API;
    }
  });
});

describe("request input limits", () => {
  withProviderKeys();
  const long = (n) => "x".repeat(n);

  test("non-object JSON bodies are rejected (400) on every endpoint", async () => {
    const token = await neon.sign();
    for (const name of ["youtube", ...Object.keys(PAID)]) {
      for (const body of [undefined, null, "a string", ["array"]]) {
        const res = await call(handlers[name], { body, token });
        assert.equal(res.statusCode, 400, `${name} ${JSON.stringify(body)}`);
      }
    }
    assert.equal(net.calls.length, 0);
  });

  test("summarize caps title, show, description and transcript", async () => {
    const token = await neon.sign();
    const cases = [
      [{ title: long(501) }, /Title is too long/],
      [{ title: "Ok", show: long(501) }, /Show name is too long/],
      [{ title: "Ok", description: long(20_001) }, /Description is too long/],
      [{ title: "Ok", transcript: long(1_000_001) }, /Transcript is too long/],
    ];
    for (const [body, message] of cases) {
      const res = await call(handlers.summarize, { body, token });
      assert.equal(res.statusCode, 400);
      assert.match(res.body.error, message);
    }
    assert.equal(net.calls.length, 0);
  });

  test("summarize accepts fields at the limits (transcript is truncated for the prompt)", async () => {
    const res = await call(handlers.summarize, {
      body: { title: long(500), show: long(500), description: long(20_000), transcript: long(200_000) },
      token: await neon.sign(),
    });
    assert.equal(res.statusCode, 200);
  });

  test("URLs longer than 2048 characters are rejected (400)", async () => {
    const token = await neon.sign();
    const longYouTube = `https://www.youtube.com/watch?v=dQw4w9WgXcQ&x=${long(2_100)}`;
    for (const [name, body] of [
      ["youtube", { url: longYouTube }],
      ["youtubeTranscript", { url: longYouTube }],
      ["transcribe", { audioUrl: `${AUDIO_URL}?x=${long(2_100)}` }],
    ]) {
      const res = await call(handlers[name], { body, token });
      assert.equal(res.statusCode, 400, name);
      assert.match(res.body.error, /too long/);
    }
    assert.equal(net.calls.length, 0);
  });
});
