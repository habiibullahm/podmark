import { useNavigate } from "react-router-dom";
import { dailyGoal } from "../data/mockData";
import { useNotesStore } from "../store/useNotesStore";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useCurrentStreak } from "../store/useActivityStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { AppHeader } from "../components/AppHeader";
import { CurrentlyLearningWidget } from "../components/CurrentlyLearningWidget";
import { DailyGoalCard } from "../components/DailyGoalCard";
import { SectionHeader } from "../components/SectionHeader";
import { TakeawayCard } from "../components/TakeawayCard";
import { EpisodeCard } from "../components/EpisodeCard";

export function Dashboard() {
  const navigate = useNavigate();
  const episodes = useEpisodesStore((s) => s.episodes);
  const { getProgressFor } = usePlayer();
  const currentlyLearningStatuses = episodes.map((e) => getEffectiveStatus(e, getProgressFor(e.id)));
  const currentlyLearningIndex = currentlyLearningStatuses.findIndex((s) => s === "in-progress");
  const currentlyLearning = currentlyLearningIndex >= 0 ? episodes[currentlyLearningIndex] : episodes[0];
  const currentlyLearningStatus =
    currentlyLearningIndex >= 0 ? currentlyLearningStatuses[currentlyLearningIndex] : currentlyLearningStatuses[0];
  const continuing = episodes.filter(
    (e, i) => currentlyLearningStatuses[i] === "in-progress" && e.id !== currentlyLearning.id,
  );
  const notes = useNotesStore((s) => s.notes);
  const recentTakeaways = [...notes].reverse().slice(0, 6);
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const goal = { ...dailyGoal, targetMinutes: dailyGoalTarget };
  const streak = useCurrentStreak();

  return (
    <div className="pb-40 md:pb-16">
      <AppHeader greeting="Good morning" streak={streak} />

      <div className="flex flex-col gap-3 md:px-0 lg:grid lg:grid-cols-[1.6fr_1fr] lg:gap-4">
        <CurrentlyLearningWidget episode={currentlyLearning} hasStarted={currentlyLearningStatus !== "not-started"} />
        <DailyGoalCard goal={goal} />
      </div>

      <div className="mt-6">
        <SectionHeader
          title="Recent Takeaways"
          actionLabel="See all"
          onAction={() => navigate("/library")}
        />
        <div className="flex flex-col gap-3 px-5 md:px-0">
          {recentTakeaways.map((note) => (
            <TakeawayCard key={note.id} note={note} />
          ))}
        </div>
      </div>

      {continuing.length > 0 && (
        <div className="mt-6">
          <SectionHeader title="Continue Learning" />
          <div className="space-y-1 md:px-0">
            {continuing.map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} variant="row-compact" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
