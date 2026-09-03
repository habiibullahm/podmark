import { useNavigate } from "react-router-dom";
import { episodes, dailyGoal } from "../data/mockData";
import { useNotesStore } from "../store/useNotesStore";
import { AppHeader } from "../components/AppHeader";
import { CurrentlyLearningWidget } from "../components/CurrentlyLearningWidget";
import { DailyGoalCard } from "../components/DailyGoalCard";
import { SectionHeader } from "../components/SectionHeader";
import { TakeawayCard } from "../components/TakeawayCard";
import { EpisodeCard } from "../components/EpisodeCard";

export function Dashboard() {
  const navigate = useNavigate();
  const currentlyLearning = episodes.find((e) => e.status === "in-progress") ?? episodes[0];
  const continuing = episodes.filter(
    (e) => e.status === "in-progress" && e.id !== currentlyLearning.id,
  );
  const notes = useNotesStore((s) => s.notes);
  const recentTakeaways = [...notes].reverse().slice(0, 6);

  return (
    <div className="pb-24 md:pb-8">
      <AppHeader greeting="Good morning" streak={12} />

      <div className="md:grid md:grid-cols-[1.6fr_1fr] md:gap-4 md:px-0">
        <CurrentlyLearningWidget episode={currentlyLearning} />
        <DailyGoalCard goal={dailyGoal} />
      </div>

      <div className="mt-6">
        <SectionHeader
          title="Recent Takeaways"
          actionLabel="See all"
          onAction={() => navigate("/library")}
        />
        <div className="flex snap-x gap-3 overflow-x-auto px-5 pb-1 no-scrollbar md:grid md:grid-cols-3 md:overflow-visible md:px-0">
          {recentTakeaways.map((note) => (
            <TakeawayCard key={note.id} note={note} />
          ))}
        </div>
      </div>

      {continuing.length > 0 && (
        <div className="mt-6">
          <SectionHeader title="Continue Learning" />
          <div className="space-y-1 md:grid md:grid-cols-2 md:gap-3 md:space-y-0 md:px-0">
            {continuing.map((ep) => (
              <EpisodeCard key={ep.id} episode={ep} variant="row-compact" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
