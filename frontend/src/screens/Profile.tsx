import { useEffect, useState, type ReactNode } from "react";
import { CircleAlert, Cloud, CloudCheck, CloudOff, Flame, LoaderCircle, LogOut, Minus, Monitor, Moon, Plus, Sun } from "lucide-react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useCurrentStreak } from "../store/useActivityStore";
import { useAuthStore } from "../store/useAuthStore";
import { useSyncStore } from "../store/useSyncStore";
import { useThemeStore } from "../store/useThemeStore";
import { isAccountsConfigured } from "../lib/neon";
import { getAvatarLetter, getDisplayName } from "../lib/identity";
import { BUTTON_PRIMARY, CARD, INPUT } from "../lib/ui";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";

const GOAL_STEP = 5;
// Magic link is hidden until Neon Auth has a reliable email sender (custom
// SMTP); the flow stays wired up so flipping this restores the tab.
const MAGIC_LINK_ENABLED = false;
const RESEND_COOLDOWN_SEC = 60;
const RESEND_COOLDOWN_KEY = "podmark-magic-link-cooldown";

function SyncIndicator() {
  const phase = useSyncStore((s) => s.phase);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  if (phase === "error" && pendingCount > 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
        <CloudOff size={14} aria-hidden="true" />
        {pendingCount} change{pendingCount === 1 ? "" : "s"} waiting — check your connection.
      </p>
    );
  }
  if (phase === "syncing") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
        <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
        Syncing…
      </p>
    );
  }
  if (phase === "synced") {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-success">
        <CloudCheck size={14} aria-hidden="true" />
        Synced just now
      </p>
    );
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

  let body;
  if (!isAccountsConfigured) {
    body = (
      <p className="flex items-start gap-2 text-[13px] text-text-secondary">
        <Cloud size={16} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden="true" />
        Accounts aren't set up for this deployment yet — your library stays on this device only.
      </p>
    );
  } else if (status === "loading") {
    body = (
      <p className="flex items-center gap-2 text-[13px] text-text-secondary">
        <LoaderCircle size={16} className="animate-spin" aria-hidden="true" />
        Verifying sign-in…
      </p>
    );
  } else if (status === "signedIn") {
    body = (
      <div className="space-y-3">
        <p className="text-[13px] text-text-secondary">
          Signed in as <span className="font-semibold text-text-primary">{user?.email}</span>
        </p>
        <SyncIndicator />
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-control border border-border bg-bg-surface-alt px-4 py-2.5 text-sm font-semibold text-text-primary transition-colors hover:border-danger/50 hover:text-danger"
        >
          <LogOut size={16} aria-hidden="true" />
          Sign out
        </button>
      </div>
    );
  } else {
    const tabClass = (active: boolean) =>
      `rounded-lg px-2 py-2 transition-colors ${active ? "bg-bg-surface text-text-primary shadow-card" : "text-text-tertiary hover:text-text-primary"}`;
    body = (
      <div className="space-y-4">
        <div className={`grid ${MAGIC_LINK_ENABLED ? "grid-cols-3" : "grid-cols-2"} rounded-control bg-bg-surface-alt p-1 text-xs font-bold`}>
          <button type="button" aria-pressed={method === "login"} onClick={() => changeMethod("login")} className={tabClass(method === "login")}>Login</button>
          <button type="button" aria-pressed={method === "createAccount"} onClick={() => changeMethod("createAccount")} className={tabClass(method === "createAccount")}>Create account</button>
          {MAGIC_LINK_ENABLED && <button type="button" aria-pressed={method === "magicLink"} onClick={() => changeMethod("magicLink")} className={tabClass(method === "magicLink")}>Magic link</button>}
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
            {MAGIC_LINK_ENABLED ? "Sign in with a magic link to sync your library across devices." : "Sign in to sync your library across devices."}
          </p>
        )}
        <form className="space-y-2.5" onSubmit={(event) => { event.preventDefault(); method === "magicLink" ? void handleSendLink() : void handlePasswordSubmit(); }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            aria-label="Email"
            autoComplete="email"
            required
            className={INPUT}
          />
          {method !== "magicLink" && (
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              aria-label="Password"
              autoComplete={method === "createAccount" ? "new-password" : "current-password"}
              required
              className={INPUT}
            />
          )}
          <button
            type="submit"
            disabled={!email.trim() || sending || (method === "magicLink" ? cooldown > 0 : !password)}
            className={`${BUTTON_PRIMARY} w-full`}
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
        {authError && <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />{authError}</p>}
        {error && <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-danger"><CircleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />{error}</p>}
      </div>
    );
  }

  return (
    <section>
      <SectionHeader title="Account" />
      <div className={`${CARD} p-5`}>{body}</div>
    </section>
  );
}

function OptionButton({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-control border px-3 py-2.5 text-sm font-semibold transition-colors ${
        selected ? "border-accent bg-accent/10 text-accent" : "border-border text-text-secondary hover:border-accent/50 hover:text-text-primary"
      }`}
    >
      {children}
    </button>
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
    <div>
      <PageHeader title="Profile" subtitle="Your account, sync, and preferences." />

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div className="space-y-6">
          <section className={`${CARD} flex items-center gap-4 p-5`}>
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-accent/15 text-2xl font-extrabold text-accent">
              {getAvatarLetter(user)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight text-text-primary">{getDisplayName(user)}</p>
              <p className="flex items-center gap-1.5 text-xs text-text-secondary">
                <Flame size={13} className={streak > 0 ? "text-streak" : "text-text-tertiary"} aria-hidden="true" />
                <span>
                  {streak} day{streak === 1 ? "" : "s"} streak · {episodesCount} episodes · {notesCount} notes
                </span>
              </p>
            </div>
          </section>

          <AccountSection />
        </div>

        <div className="space-y-6">
          <section>
            <SectionHeader title="Daily goal" />
            <div className={`${CARD} flex items-center justify-between gap-4 p-5`}>
              <div>
                <p className="text-[15px] font-bold text-text-primary">{dailyGoalTarget} min / day</p>
                <p className="text-xs text-text-secondary">How long you want to listen and take notes each day.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Decrease daily goal"
                  onClick={() => adjustDailyGoalTarget(-GOAL_STEP)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
                >
                  <Minus size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Increase daily goal"
                  onClick={() => adjustDailyGoalTarget(GOAL_STEP)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
                >
                  <Plus size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title="Notifications" />
            <div className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[15px] font-bold text-text-primary">Daily reminder</p>
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
                  aria-label="Daily reminder"
                  onClick={handleToggleNotifications}
                  disabled={!notificationsSupported}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
                    notificationsEnabled ? "border-accent bg-accent" : "border-border bg-bg-surface-alt"
                  }`}
                >
                  <span
                    className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow-card transition-transform ${
                      notificationsEnabled ? "translate-x-[22px]" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              {notificationDenied && (
                <p className="mt-3 text-xs font-medium text-danger">
                  Notifications are blocked for this site — allow them in your browser's site settings, then try again.
                </p>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Appearance" />
            <div className={`${CARD} p-5`}>
              <p className="text-[15px] font-bold text-text-primary">Theme</p>
              <p className="mb-3 text-xs text-text-secondary">Follows your system by default.</p>
              <div className="flex gap-2">
                {(
                  [
                    { value: "system", label: "System", icon: Monitor },
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                  ] as const
                ).map(({ value, label, icon: Icon }) => (
                  <OptionButton key={value} selected={theme === value} onClick={() => setTheme(value)}>
                    <Icon size={15} aria-hidden="true" />
                    {label}
                  </OptionButton>
                ))}
              </div>
            </div>
          </section>

          <section>
            <SectionHeader title="Export" />
            <div className={`${CARD} p-5`}>
              <p className="text-[15px] font-bold text-text-primary">Preferred export format</p>
              <p className="mb-3 text-xs text-text-secondary">
                Used when exporting notes from the Library — a downloadable Markdown file either way.
              </p>
              <div className="flex gap-2">
                {(["obsidian", "notion"] as const).map((format) => (
                  <OptionButton key={format} selected={exportFormat === format} onClick={() => setExportFormat(format)}>
                    <span className="capitalize">{format}</span>
                  </OptionButton>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
