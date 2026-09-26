import { useEffect, useState } from "react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useCurrentStreak } from "../store/useActivityStore";
import { useAuthStore } from "../store/useAuthStore";
import { useSyncStore } from "../store/useSyncStore";
import { useThemeStore } from "../store/useThemeStore";
import { isSupabaseConfigured } from "../lib/supabase";
import { getAvatarLetter, getDisplayName } from "../lib/identity";
import { SectionHeader } from "../components/SectionHeader";

const GOAL_STEP = 5;
const RESEND_COOLDOWN_SEC = 60;
const RESEND_COOLDOWN_KEY = "podmark-magic-link-cooldown";

function SyncIndicator() {
  const phase = useSyncStore((s) => s.phase);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  if (phase === "error" && pendingCount > 0) {
    return (
      <p className="text-xs text-red-400">
        {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting — check your connection.
      </p>
    );
  }
  if (phase === "syncing") {
    return <p className="text-xs text-text-tertiary">Syncing…</p>;
  }
  if (phase === "synced") {
    return <p className="text-xs text-text-tertiary">Synced just now</p>;
  }
  return null;
}

function AccountSection() {
  const status = useAuthStore((s) => s.status);
  const authError = useAuthStore((s) => s.authError);
  const user = useAuthStore((s) => s.user);
  const signIn = useAuthStore((s) => s.signIn);
  const signInWithPassword = useAuthStore((s) => s.signInWithPassword);
  const signUp = useAuthStore((s) => s.signUp);
  const signOut = useAuthStore((s) => s.signOut);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState<"login" | "createAccount" | "magicLink">("login");
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(() => {
    try {
      return Math.max(0, Math.ceil((Number(localStorage.getItem(RESEND_COOLDOWN_KEY)) - Date.now()) / 1000));
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = window.setInterval(() => {
      setCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [cooldown]);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SEC);
    try {
      localStorage.setItem(RESEND_COOLDOWN_KEY, String(Date.now() + RESEND_COOLDOWN_SEC * 1000));
    } catch {
      // Storage can be unavailable in privacy-restricted browsers.
    }
  };

  const handleSendLink = async () => {
    if (!email.trim() || sending || cooldown > 0) return;
    setSending(true);
    setError(null);
    const { error: signInError } = await signIn(email.trim());
    setSending(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    setSent(true);
    startCooldown();
  };

  const changeMethod = (nextMethod: typeof method) => {
    setMethod(nextMethod);
    setError(null);
    setSent(false);
    setNeedsEmailConfirmation(false);
    setPassword("");
  };

  const handlePasswordSubmit = async () => {
    if (!email.trim() || !password || sending) return;
    setSending(true);
    setError(null);
    const result = method === "createAccount"
      ? await signUp(email.trim(), password)
      : await signInWithPassword(email.trim(), password);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setPassword("");
    setNeedsEmailConfirmation(result.needsEmailConfirmation);
  };

  if (!isSupabaseConfigured) {
    return (
      <div className="mt-6 mb-2">
        <SectionHeader title="Account" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[13px] text-text-secondary">
            Accounts aren't set up for this deployment yet — your library stays on this device only.
          </p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="mt-6 mb-2">
        <SectionHeader title="Account" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[13px] text-text-secondary">Verifying sign-in…</p>
        </div>
      </div>
    );
  }

  if (status === "signedIn") {
    return (
      <div className="mt-6 mb-2">
        <SectionHeader title="Account" />
        <div className="mx-5 space-y-3 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[13px] text-text-secondary">
            Signed in as <span className="font-medium text-text-primary">{user?.email}</span>
          </p>
          <SyncIndicator />
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full rounded-xl border border-border bg-bg-surface-alt p-3 text-sm font-semibold text-text-primary hover:border-red-400/60 hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 mb-2">
      <SectionHeader title="Account" />
      <div className="mx-5 space-y-3 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
        <div className="grid grid-cols-3 rounded-xl bg-bg-surface-alt p-1 text-xs font-semibold">
          <button type="button" onClick={() => changeMethod("login")} className={`rounded-lg px-2 py-2 ${method === "login" ? "bg-bg-surface text-text-primary" : "text-text-tertiary"}`}>Login</button>
          <button type="button" onClick={() => changeMethod("createAccount")} className={`rounded-lg px-2 py-2 ${method === "createAccount" ? "bg-bg-surface text-text-primary" : "text-text-tertiary"}`}>Create account</button>
          <button type="button" onClick={() => changeMethod("magicLink")} className={`rounded-lg px-2 py-2 ${method === "magicLink" ? "bg-bg-surface text-text-primary" : "text-text-tertiary"}`}>Magic link</button>
        </div>
        {needsEmailConfirmation ? (
          <p role="status" className="text-[13px] text-text-secondary">Check your email and open the confirmation link to finish creating your account.</p>
        ) : sent ? (
          <p className="text-[13px] text-text-secondary">
            Check your email and open the link <span className="font-medium text-text-primary">on this device</span>{" "}
            — the sign-in link only works in the browser that requested it.
          </p>
        ) : (
          <p className="text-[13px] text-text-secondary">
            Sign in with a magic link to sync your library across devices.
          </p>
        )}
        <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); method === "magicLink" ? void handleSendLink() : void handlePasswordSubmit(); }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
            className="min-w-0 flex-1 rounded-xl border border-border bg-bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
          />
          {method !== "magicLink" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={method === "createAccount" ? "new-password" : "current-password"}
              required
              className="w-full rounded-xl border border-border bg-bg-surface-alt px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          )}
          <button
            type="submit"
            disabled={!email.trim() || sending || (method === "magicLink" ? cooldown > 0 : !password)}
            className="w-full rounded-xl bg-accent px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {sending
              ? method === "magicLink" ? "Sending…" : method === "createAccount" ? "Creating account…" : "Signing in…"
              : method === "magicLink" && cooldown > 0
                ? `Resend in ${cooldown}s`
                : method === "magicLink" && sent
                  ? "Resend link"
                  : method === "magicLink" ? "Send magic link" : method === "createAccount" ? "Create account" : "Sign in"}
          </button>
        </form>
        {authError && <p className="text-xs text-red-400">{authError}</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
}

export function Profile() {
  const episodesCount = useEpisodesStore((s) => s.episodes.length);
  const notesCount = useNotesStore((s) => s.notes.length);
  const streak = useCurrentStreak();
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const adjustDailyGoalTarget = useSettingsStore((s) => s.adjustDailyGoalTarget);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const toggleNotifications = useSettingsStore((s) => s.toggleNotifications);
  const [notificationDenied, setNotificationDenied] = useState(false);
  const notificationsSupported = typeof Notification !== "undefined";

  const handleToggleNotifications = async () => {
    if (notificationsEnabled) {
      toggleNotifications();
      return;
    }
    if (!notificationsSupported) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      setNotificationDenied(false);
      toggleNotifications();
    } else {
      setNotificationDenied(true);
    }
  };
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const setExportFormat = useSettingsStore((s) => s.setExportFormat);
  const user = useAuthStore((s) => s.user);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  return (
    <div className="pb-40 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-0 md:pb-16 md:pt-0">
      <h1 className="mb-5 text-xl font-semibold text-text-primary">Profile</h1>

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-surface p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent">
          {getAvatarLetter(user)}
        </div>
        <div>
          <p className="text-[17px] font-semibold text-text-primary">{getDisplayName(user)}</p>
          <p className="text-xs text-text-secondary">
            🔥 {streak} day{streak === 1 ? "" : "s"} streak · {episodesCount} episodes · {notesCount} notes
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Daily goal" />
        <div className="mx-5 flex items-center justify-between rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <div>
            <p className="text-[15px] font-semibold text-text-primary">{dailyGoalTarget} min / day</p>
            <p className="text-xs text-text-secondary">How long you want to listen and take notes each day.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease daily goal"
              onClick={() => adjustDailyGoalTarget(-GOAL_STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Increase daily goal"
              onClick={() => adjustDailyGoalTarget(GOAL_STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Notifications" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[15px] font-semibold text-text-primary">Daily reminder</p>
              <p className="text-xs text-text-secondary">
                {notificationsSupported
                  ? "Nudge me here if I haven't hit my listening goal by evening — only while PodMark is open in a tab."
                  : "Notifications aren't supported in this browser."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={notificationsEnabled}
              onClick={handleToggleNotifications}
              disabled={!notificationsSupported}
              className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                notificationsEnabled ? "border-accent bg-accent" : "border-border bg-bg-surface-alt"
              }`}
            >
              <span
                className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  notificationsEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          {notificationDenied && (
            <p className="mt-3 text-xs text-red-400">
              Notifications are blocked for this site — allow them in your browser's site settings, then try again.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Appearance" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[15px] font-semibold text-text-primary">Theme</p>
          <p className="mb-3 text-xs text-text-secondary">Follows your system by default.</p>
          <div className="flex gap-2">
            {(
              [
                { value: "system", label: "System" },
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
                  theme === opt.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/60"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Export" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[15px] font-semibold text-text-primary">Preferred export format</p>
          <p className="mb-3 text-xs text-text-secondary">
            Used when exporting notes from the Library — a downloadable Markdown file either way.
          </p>
          <div className="flex gap-2">
            {(["obsidian", "notion"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setExportFormat(format)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  exportFormat === format
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/60"
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      <AccountSection />
    </div>
  );
}
