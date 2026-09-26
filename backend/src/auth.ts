// Verifies a Supabase session JWT locally — no network call per request, no
// supabase-js dependency here. Framework-agnostic like the rest of backend/:
// the caller supplies the Authorization header value and an env object.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

export interface AuthEnv {
  // Set exactly one, matching the Supabase project's JWT signing algorithm
  // (Settings -> API -> JWT): the legacy shared secret for HS256, or the
  // project URL (its JWKS is derived from it) for ES256.
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_URL?: string;
}

let cachedJwks: { url: string; keySet: JWTVerifyGetKey } | null = null;

function getJwks(supabaseUrl: string): JWTVerifyGetKey {
  if (cachedJwks?.url === supabaseUrl) return cachedJwks.keySet;
  const keySet = createRemoteJWKSet(new URL("/auth/v1/.well-known/jwks.json", supabaseUrl));
  cachedJwks = { url: supabaseUrl, keySet };
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
  if (!token) return null;

  try {
    let payload;
    if (env.SUPABASE_URL) {
      try {
        ({ payload } = await jwtVerify(token, getJwks(env.SUPABASE_URL)));
      } catch (jwksError) {
        if (!env.SUPABASE_JWT_SECRET) throw jwksError;
        ({ payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET)));
      }
    } else if (env.SUPABASE_JWT_SECRET) {
      ({ payload } = await jwtVerify(token, new TextEncoder().encode(env.SUPABASE_JWT_SECRET)));
    } else {
      return null;
    }
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
