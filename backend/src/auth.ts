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

// The raw token from an `Authorization: Bearer …` header, if any.
export function bearerToken(authorizationHeader: string | undefined | null): string | null {
  return authorizationHeader?.match(/^Bearer\s+(.+)$/i)?.[1] ?? null;
}

// Returns the authenticated user's id (the JWT's `sub`), or null if the
// header is missing, malformed, unverifiable, or auth isn't configured for
// this environment. Callers should treat null as "reject the request" —
// there is no partial-trust path here.
export async function verifyUser(
  authorizationHeader: string | undefined | null,
  env: AuthEnv,
): Promise<string | null> {
  const token = bearerToken(authorizationHeader);
  if (!env.NEON_AUTH_URL) {
    console.warn("auth: NEON_AUTH_URL is not set; rejecting");
    return null;
  }
  if (!token) return null;

  const authUrl = env.NEON_AUTH_URL.replace(/\/$/, "");
  const origin = new URL(authUrl).origin;
  try {
    const { payload } = await jwtVerify(token, getJwks(authUrl), {
      // Neon Auth signs with Ed25519; pinning the algorithm rules out
      // key-confusion tricks (e.g. HS256 signed with the public key).
      algorithms: ["EdDSA"],
      // Neon's anonymous tokens carry iss = the auth URL and aud = its
      // origin; Better Auth's user tokens default both to the auth URL.
      // Either form identifies only this Neon Auth instance, and the
      // signature is already pinned to its JWKS.
      issuer: [authUrl, origin],
      audience: [authUrl, origin],
    });
    // Neon Auth also hands out *anonymous* JWTs (GET /token/anonymous, no
    // account needed) signed by the same key and carrying a `sub`. Only a
    // signed-in user's token may reach paid endpoints.
    if (payload.role !== "authenticated") {
      console.warn(`auth: rejected token with role ${JSON.stringify(payload.role ?? null)}`);
      return null;
    }
    return typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  } catch (error) {
    // Reason only (e.g. ERR_JWT_CLAIM_VALIDATION_FAILED: unexpected "aud"
    // claim value) — never the token itself.
    const code = error instanceof Error && "code" in error ? String(error.code) : "error";
    console.warn(`auth: rejected token (${code}: ${error instanceof Error ? error.message : "unknown"})`);
    return null;
  }
}
