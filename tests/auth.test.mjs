// Neon Auth JWT verification (backend/src/auth.ts, compiled to build/ by
// tsconfig.deploy.json): `npm run test:api`.
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { SignJWT } from "jose";
import { verifyUser } from "../build/auth.js";
import { startNeonAuthFixture } from "./neonAuthFixture.mjs";

let neon;
let env;
before(async () => {
  neon = await startNeonAuthFixture();
  env = { NEON_AUTH_URL: neon.authUrl };
});
after(() => neon.close());

const bearer = (token) => `Bearer ${token}`;

describe("verifyUser", () => {
  test("accepts a signed-in user's token and returns its sub", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ sub: "user-123" })), env), "user-123");
  });

  test("tolerates a trailing slash in NEON_AUTH_URL", async () => {
    const token = await neon.sign();
    assert.equal(await verifyUser(bearer(token), { NEON_AUTH_URL: `${neon.authUrl}/` }), "user-a");
  });

  test("rejects Neon's anonymous tokens (same key, role=anonymous)", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ role: "anonymous" })), env), null);
  });

  test("rejects a token without a role claim", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ role: null })), env), null);
  });

  test("rejects a token from another Neon branch/project (issuer mismatch)", async () => {
    const token = await neon.sign({ issuer: "https://ep-other.neonauth.example/neondb/auth" });
    assert.equal(await verifyUser(bearer(token), env), null);
  });

  test("rejects a token with the wrong audience", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ audience: "https://evil.example" })), env), null);
  });

  test("rejects an expired token", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ expiresIn: "-1m" })), env), null);
  });

  test("rejects a token signed by a key not in the JWKS", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign({ key: await neon.otherKey() })), env), null);
  });

  test("rejects HS256 tokens (algorithm is pinned to EdDSA)", async () => {
    const token = await new SignJWT({ role: "authenticated" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("attacker").setIssuer(neon.authUrl).setAudience(new URL(neon.authUrl).origin)
      .setExpirationTime("5m")
      .sign(new TextEncoder().encode("guessable-secret"));
    assert.equal(await verifyUser(bearer(token), env), null);
  });

  test("rejects an unsigned (alg: none) token", async () => {
    const part = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const token = `${part({ alg: "none" })}.${part({ sub: "x", role: "authenticated", iss: neon.authUrl })}.`;
    assert.equal(await verifyUser(bearer(token), env), null);
  });

  test("rejects a tampered signature", async () => {
    const token = await neon.sign();
    const tampered = token.slice(0, -4) + (token.endsWith("AAAA") ? "BBBB" : "AAAA");
    assert.equal(await verifyUser(bearer(tampered), env), null);
  });

  test("rejects missing, malformed and non-Bearer headers", async () => {
    const token = await neon.sign();
    for (const header of [undefined, null, "", "Bearer", "garbage", `Basic ${token}`, token]) {
      assert.equal(await verifyUser(header, env), null);
    }
  });

  test("returns null when NEON_AUTH_URL isn't configured", async () => {
    assert.equal(await verifyUser(bearer(await neon.sign()), {}), null);
  });
});
