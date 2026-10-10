import { SupabaseAuthAdapter } from "@neondatabase/auth/vanilla/adapters";
import { fetchWithToken, NeonPostgrestClient } from "@neondatabase/postgrest-js";

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL;

// Neon Auth (managed Better Auth) through its Supabase-compatible adapter, so
// the auth store keeps the same session/user shape and event names it had
// with supabase-js. `null` whenever the env vars aren't set — every caller
// treats that as "accounts aren't configured for this deployment", which is
// what keeps a keyless `npm run dev` and the Playwright suite fully
// signed-out.
//
// Built straight from the adapter builder — exactly what createAuthClient()
// does at runtime — because createAuthClient's return type resolves the
// Supabase adapter to the plain Better Auth client (its conditional type
// checks the structurally-wider Better Auth adapter first).
export const auth = authUrl && dataApiUrl ? SupabaseAuthAdapter()(authUrl) : null;

export type AuthSession = NonNullable<
  Awaited<ReturnType<NonNullable<typeof auth>["getSession"]>>["data"]["session"]
>;
export type AuthUser = AuthSession["user"];

// The session's access_token is Neon Auth's short-lived (~15 min) JWT. The
// adapter caches the session only until that JWT expires and refetches after,
// so always ask it for the token rather than reusing one held in app state.
export async function getAccessToken(): Promise<string | null> {
  if (!auth) return null;
  const { data } = await auth.getSession();
  return data.session?.access_token ?? null;
}

// Neon Data API (PostgREST): same query builder as supabase-js, so sync.ts's
// upsert/select calls are unchanged. Every request carries the current JWT;
// RLS scopes rows to its `sub` via auth.user_id().
export const db =
  auth && dataApiUrl
    ? new NeonPostgrestClient({
        dataApiUrl,
        options: { global: { fetch: fetchWithToken(getAccessToken) } },
      })
    : null;

export const isAccountsConfigured = auth !== null;
