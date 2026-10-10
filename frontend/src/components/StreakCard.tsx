import { Flame } from "lucide-react";
import { CARD } from "../lib/ui";
import { lastSevenDayLabels } from "../lib/week";

// Consecutive listening days, plus which of the last 7 days counted.
export function StreakCard({ streak, last7Days }: { streak: number; last7Days: number[] }) {
  const labels = lastSevenDayLabels();

  return (
    <section aria-label="Listening streak" className={`${CARD} p-4`}>
      <div className="flex items-center gap-3">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            streak > 0 ? "bg-streak/15 text-streak" : "bg-bg-surface-alt text-text-tertiary"
          }`}
        >
          <Flame size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] font-bold tabular-nums text-text-primary">
            {streak}-day streak
          </p>
          <p className="text-xs text-text-secondary">
            {streak > 0 ? "Listen today to keep it going." : "Listen a minute today to start one."}
          </p>
        </div>
      </div>
      <ol className="mt-4 flex justify-between" aria-label="Days with listening, last 7 days">
        {last7Days.map((minutes, i) => {
          const listened = minutes >= 1;
          return (
            <li key={i} className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                  listened ? "bg-streak text-white" : "bg-bg-surface-alt text-text-tertiary"
                } ${i === last7Days.length - 1 ? "ring-2 ring-accent/30 ring-offset-1 ring-offset-bg-surface" : ""}`}
              >
                {labels[i]}
                <span className="sr-only">{listened ? " listened" : " no listening"}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
