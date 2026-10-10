import { Link } from "react-router-dom";
import { Target } from "lucide-react";
import type { DailyGoal } from "../data/types";
import { clampPercent } from "../lib/format";
import { CARD } from "../lib/ui";
import { lastSevenDayLabels } from "../lib/week";

// Today's listening against the daily goal, with the last 7 days as bars.
// Everything shown is the user's real listening — no placeholder numbers.
export function DailyGoalCard({ goal }: { goal: DailyGoal }) {
  const pct = clampPercent(goal.todayMinutes, goal.targetMinutes);
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct / 100);
  const remaining = Math.max(0, goal.targetMinutes - goal.todayMinutes);
  const maxDay = Math.max(...goal.last7Days, goal.targetMinutes, 1);
  const labels = lastSevenDayLabels();

  return (
    <section aria-label="Today's listening" className={`${CARD} p-4`}>
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.12em] text-text-tertiary">
          <Target size={14} aria-hidden="true" />
          Today's listening
        </p>
        <Link to="/profile" className="rounded-md text-xs font-semibold text-accent hover:text-accent/80">
          Edit goal
        </Link>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <div className="relative h-16 w-16 shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90" aria-hidden="true">
            <circle cx="32" cy="32" r={radius} fill="none" className="stroke-bg-surface-alt" strokeWidth="6" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              className={pct >= 100 ? "stroke-success" : "stroke-accent"}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-text-primary">
            {pct}%
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-[15px] font-bold tabular-nums text-text-primary">
            {goal.todayMinutes} / {goal.targetMinutes} min today
          </p>
          <p className="text-xs text-text-secondary">
            {remaining > 0 ? `${remaining} min to go` : "Goal complete — nice work"}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-1.5" aria-label="Minutes listened, last 7 days">
        {goal.last7Days.map((minutes, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-8 w-full items-end justify-center">
              <div
                title={`${minutes} min`}
                className={`w-full max-w-[14px] rounded-full ${
                  minutes >= goal.targetMinutes ? "bg-success" : minutes > 0 ? "bg-accent/60" : "bg-bg-surface-alt"
                }`}
                style={{ height: `${Math.max(4, (minutes / maxDay) * 32)}px` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-text-tertiary">{labels[i]}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
