const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Single-letter weekday labels for the last 7 days, oldest first and ending
// today — matches the order of getLast7DaysMinutes().
export function lastSevenDayLabels(): string[] {
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(today - 6 + i + 7) % 7]);
}
