import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
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
  session: Session | null;
  user: User | null;
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

export const useAuthStore = create<AuthState>()(() => ({
  session: null,
  user: null,
  // Without a configured Supabase project there's no session to resolve —
  // settle on signedOut immediately instead of hanging on "loading" forever.
  status: supabase ? "loading" : "signedOut",
  authError: null,
  signIn: async (email) => {
    if (!supabase) return { error: "Accounts aren't set up for this deployment yet." };
    useAuthStore.setState({ authError: null });
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (!error) return { error: null };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        error: "Email send limit reached. Wait before requesting another magic link, then try again.",
      };
    }
    return { error: error.message };
  },
  signInWithPassword: async (email, password) => {
    if (!supabase) return { error: "Accounts aren't set up for this deployment yet.", needsEmailConfirmation: false };
    useAuthStore.setState({ authError: null });
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null, needsEmailConfirmation: false };
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Sign-in failed. Try again.", needsEmailConfirmation: false };
    }
  },
  signUp: async (email, password) => {
    if (!supabase) return { error: "Accounts aren't set up for this deployment yet.", needsEmailConfirmation: false };
    useAuthStore.setState({ authError: null });
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      return {
        error: error?.message ?? null,
        needsEmailConfirmation: !error && !data.session,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Account creation failed. Try again.",
        needsEmailConfirmation: false,
      };
    }
  },
  signOut: async () => {
    if (!supabase) return;
    // Data-store reset happens in the onAuthStateChange listener below, once
    // Supabase confirms the SIGNED_OUT event — a single place to react to
    // sign-out regardless of whether it was this call or a session expiring.
    await supabase.auth.signOut();
  },
}));

if (supabase) {
  const params = new URLSearchParams(window.location.search);
  let callbackPending = params.has("code");

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION" && callbackPending) return;
    if (event === "SIGNED_OUT") {
      stopSync();
      resetAllDataStores();
    }
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
      status: callbackPending ? "loading" : session ? "signedIn" : "signedOut",
      authError: null,
    });
    if (session?.user) startSync(session.user.id);
  });

  void (async () => {
    try {
    const code = params.get("code");
    const callbackError = params.get("error_description") || params.get("error");
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      params.delete("code");
      params.delete("error");
      params.delete("error_code");
      params.delete("error_description");
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      callbackPending = false;
      useAuthStore.setState({
        session: error ? null : data.session,
        user: error ? null : data.session?.user ?? null,
        status: error || !data.session ? "signedOut" : "signedIn",
        authError: error ? `Magic link failed: ${error.message}` : null,
      });
      if (!error && data.session?.user) startSync(data.session.user.id);
      return;
    }

    if (callbackError) {
      params.delete("error");
      params.delete("error_code");
      params.delete("error_description");
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      callbackPending = false;
      useAuthStore.setState({ status: "signedOut", authError: `Magic link failed: ${callbackError}` });
      return;
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    callbackPending = false;
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
      status: session ? "signedIn" : "signedOut",
      authError: error?.message ?? null,
    });
    if (session?.user) startSync(session.user.id);
    } catch (error) {
      callbackPending = false;
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
      useAuthStore.setState({ status: "signedOut", authError: error instanceof Error ? `Magic link failed: ${error.message}` : "Magic link failed. Request a new link." });
    }
  })();
}
