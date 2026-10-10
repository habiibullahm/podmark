// Verifies a Neon Auth (managed Better Auth) session JWT locally against the
// project's JWKS — no network call per request once the keys are cached, no
// auth SDK here. Framework-agnostic like the rest of backend/: the caller
// supplies the Authorization header value and an env object.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AuthEnv {
  // Neon Auth base URL for the branch, e.g.
  // https://ep-….neonauth.<region>.aws.neon.tech/neondb/auth
  // Its JWKS lives at <url>/.well-known/jwks.json.
  NEON_AUTH_URL?: string;
}

let cachedJwks: { url: string; keySet: JWTVerifyGetKey } | null = null;

function getJwks(authUrl: string): JWTVerifyGetKey {
  if (cachedJwks?.url === authUrl) return cachedJwks.keySet;
  const keySet = createRemoteJWKSet(new URL(`${authUrl.replace(/\/$/, "")}/.well-known/jwks.json`));
  cachedJwks = { url: authUrl, keySet };
  return keySet;
}

// Returns the authenticated user's id (the JWT's `sub`), or null if the
// header is missing, malformed, unverifiable, or auth isn't configured for
// this environment. Callers should treat null as "reject the request" —
// there is no partial-trust path here.
export async function verifyUser(
  authorizationHeader: string | undefined | null,
  env: AuthEnv,
): Promise<string | null> {
  const token = authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || !env.NEON_AUTH_URL) return null;

  const authUrl = env.NEON_AUTH_URL.replace(/\/$/, "");
  try {
    const { payload } = await jwtVerify(token, getJwks(authUrl), {
      // Neon Auth signs with Ed25519; pinning the algorithm rules out
      // key-confusion tricks (e.g. HS256 signed with the public key).
      algorithms: ["EdDSA"],
      // Observed on real tokens: iss is the full auth URL, aud its origin.
      issuer: authUrl,
      audience: new URL(authUrl).origin,
    });
    // Neon Auth also hands out *anonymous* JWTs (GET /token/anonymous, no
    // account needed) signed by the same key and carrying a `sub`. Only a
    // signed-in user's token may reach paid endpoints.
    if (payload.role !== "authenticated") return null;
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch {
    return null;
  }
}
