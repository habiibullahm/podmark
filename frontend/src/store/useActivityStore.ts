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

// A day only counts toward the streak once genuine listening has happened —
// without this, pressing play and immediately pausing would permanently
// count as a full day.
const MIN_MINUTES_FOR_STREAK = 1;

interface ActivityState {
  minutesByDate: Record<string, number>; // real cumulative listened minutes, local calendar day
  addListenedMs: (ms: number) => void;
}

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      minutesByDate: {},
      addListenedMs: (ms) => {
        if (ms <= 0) return;
        const today = localDateKey();
        set((state) => ({
          minutesByDate: {
            ...state.minutesByDate,
            [today]: (state.minutesByDate[today] ?? 0) + ms / 60_000,
          },
        }));
      },
    }),
    { name: "podmark-activity" },
  ),
);

// Consecutive-day streak ending today or yesterday — a day not yet listened
// to doesn't zero the streak until it's actually over (matches the common
// "streak is safe until midnight" convention), but two missed days does.
export function getCurrentStreak(minutesByDate: Record<string, number>): number {
  const hasListened = (d: Date) => (minutesByDate[localDateKey(d)] ?? 0) >= MIN_MINUTES_FOR_STREAK;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!hasListened(cursor)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (hasListened(cursor)) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function getTodayMinutes(minutesByDate: Record<string, number>): number {
  return Math.round(minutesByDate[localDateKey()] ?? 0);
}

// Oldest first, ending today — matches the DailyGoal.last7Days convention.
export function getLast7DaysMinutes(minutesByDate: Record<string, number>): number[] {
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 6);
  const days: number[] = [];
  for (let i = 0; i < 7; i++) {
    days.push(Math.round(minutesByDate[localDateKey(cursor)] ?? 0));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function useCurrentStreak(): number {
  const minutesByDate = useActivityStore((s) => s.minutesByDate);
  return getCurrentStreak(minutesByDate);
}

export function useTodayMinutes(): number {
  const minutesByDate = useActivityStore((s) => s.minutesByDate);
  return getTodayMinutes(minutesByDate);
}

export function useLast7DaysMinutes(): number[] {
  const minutesByDate = useActivityStore((s) => s.minutesByDate);
  return getLast7DaysMinutes(minutesByDate);
}
