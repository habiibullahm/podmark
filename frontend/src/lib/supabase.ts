import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// `null` whenever the env vars aren't set — every caller downstream treats
// that as "accounts aren't configured for this deployment yet" rather than
// crashing, which is what keeps a keyless `npm run dev` and the whole
// Playwright suite working fully signed-out.
//
// flowType: 'pkce' matters specifically because the app uses HashRouter —
// supabase-js's default "implicit" flow returns tokens in the URL hash,
// which collides with hash-based routes. PKCE returns `?code=` in the query
// string instead and exchanges it automatically on load. Its verifier lives
// in localStorage, so a magic link has to be opened in the same browser
// that requested it.
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: false,
          persistSession: true,
          autoRefreshToken: import.meta.env.MODE !== "test",
        },
      })
    : null;

export const isSupabaseConfigured = supabase !== null;
