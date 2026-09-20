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
  signIn: (email: string) => Promise<{ error: string | null }>;
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
  signIn: async (email) => {
    if (!supabase) return { error: "Accounts aren't set up for this deployment yet." };
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
  signOut: async () => {
    if (!supabase) return;
    // Data-store reset happens in the onAuthStateChange listener below, once
    // Supabase confirms the SIGNED_OUT event — a single place to react to
    // sign-out regardless of whether it was this call or a session expiring.
    await supabase.auth.signOut();
  },
}));

if (supabase) {
  void supabase.auth.getSession().then(({ data: { session } }) => {
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
      status: session ? "signedIn" : "signedOut",
    });
  });

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      stopSync();
      resetAllDataStores();
    }
    useAuthStore.setState({
      session,
      user: session?.user ?? null,
      status: session ? "signedIn" : "signedOut",
    });
    if (session?.user) {
      startSync(session.user.id);
    }
  });
}
