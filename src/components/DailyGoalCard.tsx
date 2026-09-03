import type { DailyGoal } from "../data/types";

export function DailyGoalCard({ goal }: { goal: DailyGoal }) {
  const pct = Math.min(100, Math.round((goal.todayMinutes / goal.targetMinutes) * 100));
  const circumference = 2 * Math.PI * 20;
  const offset = circumference * (1 - pct / 100);
  const remaining = Math.max(0, goal.targetMinutes - goal.todayMinutes);
  const maxDay = Math.max(...goal.last7Days, goal.targetMinutes);

  return (
    <div className="mx-5 mt-3 flex items-center gap-4 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0 md:mt-0 md:h-full">
      <svg width="52" height="52" viewBox="0 0 52 52" className="shrink-0 -rotate-90">
        <circle cx="26" cy="26" r="20" fill="none" className="stroke-bg-surface-alt" strokeWidth="5" />
        <circle
          cx="26"
          cy="26"
          r="20"
          fill="none"
          className="stroke-accent"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>

      <div className="flex-1">
        <p className="text-[15px] font-semibold text-text-primary">
          {goal.todayMinutes} / {goal.targetMinutes} min today
        </p>
        <p className="text-xs text-text-secondary">
          {remaining > 0 ? `${remaining} min to go` : "Goal complete 🎉"}
        </p>
      </div>

      <div className="flex items-end gap-1">
        {goal.last7Days.map((m, i) => (
          <div
            key={i}
            className={`w-1.5 rounded-full ${m >= goal.targetMinutes ? "bg-success" : "bg-bg-surface-alt"}`}
            style={{ height: `${Math.max(6, (m / maxDay) * 32)}px` }}
          />
        ))}
      </div>
    </div>
  );
}
