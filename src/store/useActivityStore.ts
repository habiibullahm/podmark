import { create } from "zustand";
import { persist } from "zustand/middleware";

// Local (not UTC) calendar-day key, so a listening session near midnight
// lands on the day the user actually experienced it, not a day off in UTC.
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface ActivityState {
  listenedDates: string[]; // deduped YYYY-MM-DD (local) calendar days with real listening
  logToday: () => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      listenedDates: [],
      logToday: () => {
        const today = localDateKey();
        if (get().listenedDates.includes(today)) return;
        set((state) => ({ listenedDates: [...state.listenedDates, today] }));
      },
    }),
    { name: "podmark-activity" },
  ),
);

// Consecutive-day streak ending today or yesterday — a day not yet listened
// to doesn't zero the streak until it's actually over (matches the common
// "streak is safe until midnight" convention), but two missed days does.
export function getCurrentStreak(listenedDates: string[]): number {
  const listened = new Set(listenedDates);
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!listened.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (listened.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function useCurrentStreak(): number {
  const listenedDates = useActivityStore((s) => s.listenedDates);
  return getCurrentStreak(listenedDates);
}
