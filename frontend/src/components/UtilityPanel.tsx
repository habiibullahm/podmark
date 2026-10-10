import { useNavigate } from "react-router-dom";
import { Headphones } from "lucide-react";
import { usePlayer } from "../context/PlayerContext";
import { useSettingsStore } from "../store/useSettingsStore";
import { useCurrentStreak, useLast7DaysMinutes, useTodayMinutes } from "../store/useActivityStore";
import { CARD } from "../lib/ui";
import { UTILITY_PANEL_WIDTH_CLASS } from "../lib/sidebarLayout";
import { PlayerCard } from "./PlayerCard";
import { DailyGoalCard } from "./DailyGoalCard";
import { StreakCard } from "./StreakCard";

function NothingPlayingCard() {
  const navigate = useNavigate();
  return (
    <section aria-label="Player" className={`${CARD} flex flex-col items-center p-5 text-center`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
        <Headphones size={22} aria-hidden="true" />
      </span>
      <p className="mt-3 text-[15px] font-bold text-text-primary">Nothing playing</p>
      <p className="mt-1 text-xs text-text-secondary">Pick an episode from your library to start listening.</p>
      <button
        type="button"
        onClick={() => navigate("/library")}
        className="mt-3 rounded-lg px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/10"
      >
        Open library
      </button>
    </section>
  );
}

// Right-hand zone of the desktop layout: what's playing and how today's
// listening is going. Contextual — the player card only shows while an
// episode is loaded, and the panel steps aside on that episode's own
// workspace, which has the player built in.
export function UtilityPanel() {
  const { episode } = usePlayer();
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const todayMinutes = useTodayMinutes();
  const last7Days = useLast7DaysMinutes();
  const streak = useCurrentStreak();

  return (
    <aside
      aria-label="Listening and goals"
      className={`thin-scrollbar fixed inset-y-0 right-0 z-20 flex flex-col gap-4 overflow-y-auto border-l border-border bg-bg-primary px-4 py-6 ${UTILITY_PANEL_WIDTH_CLASS}`}
    >
      {episode ? <PlayerCard /> : <NothingPlayingCard />}
      <DailyGoalCard goal={{ targetMinutes: dailyGoalTarget, todayMinutes, last7Days }} />
      <StreakCard streak={streak} last7Days={last7Days} />
    </aside>
  );
}
