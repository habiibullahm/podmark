import { useActivityStore, getTodayMinutes, localDateKey } from "../store/useActivityStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAuthStore } from "../store/useAuthStore";

// There's no push subscription / service-worker infra here, so this can
// only fire while a tab is actually open — it checks once on load and every
// few minutes after. That's a real, working reminder, just not a background
// one; the Profile copy says so rather than implying more than it does.
const REMINDER_HOUR = 20; // 8pm local
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LAST_REMINDER_KEY_PREFIX = "podmark-last-reminder-date";

function reminderStorageKey(): string {
  const userId = useAuthStore.getState().user?.id ?? "signed-out";
  return `${LAST_REMINDER_KEY_PREFIX}:${userId}`;
}

function maybeRemind() {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const { notificationsEnabled, dailyGoalTarget } = useSettingsStore.getState();
  if (!notificationsEnabled) return;

  const now = new Date();
  if (now.getHours() < REMINDER_HOUR) return;

  const today = localDateKey();
  const storageKey = reminderStorageKey();
  if (localStorage.getItem(storageKey) === today) return;

  const todayMinutes = getTodayMinutes(useActivityStore.getState().minutesByDate);
  if (todayMinutes >= dailyGoalTarget) return;

  new Notification("Haven't hit your listening goal yet", {
    body: `${todayMinutes} of ${dailyGoalTarget} minutes today — a quick episode gets you there.`,
    icon: "/favicon.svg",
  });
  localStorage.setItem(storageKey, today);
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDailyReminderWatcher() {
  if (intervalId || typeof window === "undefined") return;
  maybeRemind();
  intervalId = setInterval(maybeRemind, CHECK_INTERVAL_MS);
}
