// Stand-in for a Neon Auth branch: serves an Ed25519 JWKS at
// <authUrl>/.well-known/jwks.json and mints tokens shaped like real Neon Auth
// JWTs (observed: alg EdDSA, iss = full auth URL, aud = its origin,
// role = authenticated | anonymous). Lets tests exercise backend/src/auth.ts
// end to end without accounts or network access.
import { createServer } from "node:http";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

export async function startNeonAuthFixture(authUrl = "http://127.0.0.1:0/neondb/auth") {
  const { publicKey, privateKey } = await generateKeyPair("EdDSA", { crv: "Ed25519" });
  const jwk = { ...(await exportJWK(publicKey)), kid: "test-key", alg: "EdDSA", use: "sig" };
  const requested = new URL(authUrl);

  const server = createServer((req, res) => {
    if (req.url === `${requested.pathname}/.well-known/jwks.json`) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
      return;
    }
    res.writeHead(404).end();
  });
  // 0.0.0.0 so a container under test can reach it via host.docker.internal.
  await new Promise((resolve) => server.listen(Number(requested.port), "0.0.0.0", resolve));
  const port = server.address().port;
  const url = new URL(authUrl);
  url.port = String(port);
  const resolvedAuthUrl = url.toString().replace(/\/$/, "");

  async function sign({
    sub = "user-a",
    role = "authenticated",
    issuer = resolvedAuthUrl,
    audience = new URL(resolvedAuthUrl).origin,
    expiresIn = "15m",
    key = privateKey,
    alg = "EdDSA",
  } = {}) {
    // role: null omits the claim entirely.
    return new SignJWT(role === null ? {} : { role })
      .setProtectedHeader({ alg, kid: "test-key" })
      .setSubject(sub)
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .sign(key);
  }

  async function otherKey() {
    return (await generateKeyPair("EdDSA", { crv: "Ed25519" })).privateKey;
  }

  return {
    authUrl: resolvedAuthUrl,
    sign,
    otherKey,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}
