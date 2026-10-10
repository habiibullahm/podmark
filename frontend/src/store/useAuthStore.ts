import { create } from "zustand";
import { auth, type AuthSession, type AuthUser } from "../lib/neon";
import { useEpisodesStore } from "./useEpisodesStore";
import { useNotesStore } from "./useNotesStore";
import { useFoldersStore } from "./useFoldersStore";
import { useSettingsStore } from "./useSettingsStore";
import { useActivityStore } from "./useActivityStore";
import { useProgressStore } from "./useProgressStore";
import { useTranscriptStore } from "./useTranscriptStore";
import { startSync, stopSync } from "../lib/sync";

export type AuthStatus = "loading" | "signedOut" | "signedIn";

interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
  status: AuthStatus;
  authError: string | null;
  signIn: (email: string) => Promise<{ error: string | null }>;
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

// Every store that holds a user's own data — so the next person to sign in
// on this browser never inherits the previous user's library. Not persisted
// UI preferences (useUIStore) on purpose; those aren't per-account.
function resetAllDataStores() {
  useEpisodesStore.setState({ episodes: [] });
  useNotesStore.setState({ notes: [], aiSummaries: {}, aiSummaryErrors: {}, freeformNotes: {} });
  useFoldersStore.setState({ folders: [] });
  useSettingsStore.setState({ dailyGoalTarget: 30, notificationsEnabled: true, exportFormat: "obsidian" });
  useActivityStore.setState({ minutesByDate: {} });
  useProgressStore.setState({ progressByEpisode: {} });
  useTranscriptStore.setState({ transcripts: {}, transcribing: {}, transcribeErrors: {} });
}

// Single place that reacts to a session change, whether it came from this
// tab's own sign-in/out or from the adapter's listener. The adapter only
// broadcasts SIGNED_IN/SIGNED_OUT to *other* tabs (via localStorage
// `storage` events), so actions below must call this themselves.
function applySession(session: AuthSession | null, keepAuthError = false) {
  if (!session) {
    stopSync();
    if (useAuthStore.getState().status === "signedIn") resetAllDataStores();
  }
  useAuthStore.setState((state) => ({
    session,
    user: session?.user ?? null,
    status: session ? "signedIn" : "signedOut",
    authError: keepAuthError ? state.authError : null,
  }));
  if (session?.user) startSync(session.user.id);
}

export const useAuthStore = create<AuthState>()(() => ({
  session: null,
  user: null,
  // Without a configured Neon Auth project there's no session to resolve —
  // settle on signedOut immediately instead of hanging on "loading" forever.
  status: auth ? "loading" : "signedOut",
  authError: null,
  signIn: async (email) => {
    if (!auth) return { error: "Accounts aren't set up for this deployment yet." };
    useAuthStore.setState({ authError: null });
    // Magic link via Better Auth's plugin (the Supabase adapter's
    // signInWithOtp sends a one-time *code* instead). The link verifies on
    // the Neon Auth domain, then redirects back here with a
    // neon_auth_session_verifier param that the adapter's getSession()
    // exchanges and strips — or with ?error=… on failure.
    try {
      const { error } = await auth.getBetterAuthInstance().signIn.magicLink({
        email,
        callbackURL: `${window.location.origin}/`,
      });
      if (!error) return { error: null };
      if (error.status === 429) {
        return {
          error: "Email send limit reached. Wait before requesting another magic link, then try again.",
        };
      }
      return { error: error.message ?? "Couldn't send the magic link. Try again." };
    } catch (error) {
      if (error instanceof Error && "status" in error && error.status === 429) {
        return {
          error: "Email send limit reached. Wait before requesting another magic link, then try again.",
        };
      }
      return { error: error instanceof Error ? error.message : "Couldn't send the magic link. Try again." };
    }
  },
  signInWithPassword: async (email, password) => {
    if (!auth) return { error: "Accounts aren't set up for this deployment yet.", needsEmailConfirmation: false };
    useAuthStore.setState({ authError: null });
    try {
      const { data, error } = await auth.signInWithPassword({ email, password });
      if (!error) applySession(data.session);
      return { error: error?.message ?? null, needsEmailConfirmation: false };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign-in failed. Try again.", needsEmailConfirmation: false };
    }
  },
  signUp: async (email, password) => {
    if (!auth) return { error: "Accounts aren't set up for this deployment yet.", needsEmailConfirmation: false };
    useAuthStore.setState({ authError: null });
    try {
      const { data, error } = await auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      // With email verification required, Better Auth creates the user but
      // no session; the adapter reports that as session_not_found.
      if (error?.code === "session_not_found") return { error: null, needsEmailConfirmation: true };
      if (!error) applySession(data.session);
      return { error: error?.message ?? null, needsEmailConfirmation: false };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Account creation failed. Try again.",
        needsEmailConfirmation: false,
      };
    }
  },
  signOut: async () => {
    if (!auth) return;
    const { error } = await auth.signOut();
    if (error) {
      useAuthStore.setState({ authError: `Sign-out failed: ${error.message}` });
      return;
    }
    applySession(null);
  },
}));

if (auth) {
  // A failed magic link comes back as ?error=INVALID_TOKEN (or similar);
  // surface it once and clean the URL.
  const params = new URLSearchParams(window.location.search);
  const callbackError = params.get("error");
  if (callbackError) {
    params.delete("error");
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    useAuthStore.setState({ authError: `Magic link failed: ${callbackError.replaceAll("_", " ").toLowerCase()}` });
  }

  // The adapter emits INITIAL_SESSION from getSession() on subscribe — which
  // also completes a magic-link return by exchanging the
  // neon_auth_session_verifier param — and afterwards relays sign-in/out from
  // other tabs. A session that can't be resolved settles on signedOut.
  auth.onAuthStateChange((event, session) => {
    applySession(session, event === "INITIAL_SESSION");
  });
}
