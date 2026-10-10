import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Clock3, Headphones, Link2, NotebookPen, Search, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useNotesStore } from "../store/useNotesStore";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useAuthStore } from "../store/useAuthStore";
import { useCurrentStreak, useTodayMinutes, useLast7DaysMinutes } from "../store/useActivityStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { getGreeting } from "../lib/format";
import { getDisplayName } from "../lib/identity";
import { isYouTubeUrl } from "../lib/youtubeApi";
import { useIsDesktop } from "../lib/useMediaQuery";
import { BUTTON_PRIMARY, CARD } from "../lib/ui";
import { ContinueLearningCard } from "../components/ContinueLearningCard";
import { DailyGoalCard } from "../components/DailyGoalCard";
import { StreakCard } from "../components/StreakCard";
import { SectionHeader } from "../components/SectionHeader";
import { TakeawayCard } from "../components/TakeawayCard";
import { PodcastCard } from "../components/PodcastCard";
import { EmptyState } from "../components/EmptyState";
import { SearchInput } from "../components/SearchInput";

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className={`${CARD} flex items-center gap-3 p-4`}>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-lg font-extrabold tabular-nums leading-tight text-text-primary">{value}</p>
        <p className="line-clamp-1 text-xs text-text-secondary">{label}</p>
      </div>
    </div>
  );
}

// Search or paste a link from Home; Discover runs it.
function QuickAdd() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const isLink = isYouTubeUrl(query);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (query.trim()) navigate("/discover", { state: { query: query.trim() } });
      }}
      className="flex gap-2"
    >
      <div className="min-w-0 flex-1">
        <SearchInput
          value={query}
          onChange={setQuery}
          size="lg"
          icon={isLink ? Link2 : Search}
          placeholder="Find a podcast episode or paste a YouTube link"
        />
      </div>
      <button type="submit" disabled={!query.trim()} className={`${BUTTON_PRIMARY} px-5`}>
        {isLink ? "Import" : "Find"}
      </button>
    </form>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const isDesktop = useIsDesktop();
  const user = useAuthStore((s) => s.user);
  const episodes = useEpisodesStore((s) => s.episodes);
  const { getProgressFor } = usePlayer();
  const statuses = episodes.map((e) => getEffectiveStatus(e, getProgressFor(e.id)));
  const featuredIndex = statuses.findIndex((s) => s === "in-progress");
  const featured = episodes.length === 0 ? null : featuredIndex >= 0 ? episodes[featuredIndex] : episodes[0];
  const featuredStatus = featuredIndex >= 0 ? statuses[featuredIndex] : statuses[0];
  const continuing = episodes.filter((e, i) => statuses[i] === "in-progress" && e.id !== featured?.id);
  const finishedCount = statuses.filter((s) => s === "finished").length;
  const inProgressCount = statuses.filter((s) => s === "in-progress").length;
  const notes = useNotesStore((s) => s.notes);
  const recentTakeaways = [...notes].reverse().slice(0, 4);
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const todayMinutes = useTodayMinutes();
  const last7Days = useLast7DaysMinutes();
  const weekMinutes = last7Days.reduce((sum, m) => sum + m, 0);
  const streak = useCurrentStreak();

  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{today}</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-tight tracking-tight text-text-primary md:text-3xl">
          {getGreeting()}, {getDisplayName(user)}
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {episodes.length === 0
            ? "Find an episode and start capturing what you learn."
            : `${todayMinutes} min listened today · ${notes.length} takeaway${notes.length === 1 ? "" : "s"} saved`}
        </p>
        <div className="mt-5">
          <QuickAdd />
        </div>
      </header>

      {featured ? (
        <ContinueLearningCard episode={featured} hasStarted={featuredStatus !== "not-started"} />
      ) : (
        <EmptyState
          icon={Headphones}
          title="Your library is empty"
          text="Find your first episode to start tracking what you learn."
          actionLabel="Find your first episode"
          onAction={() => navigate("/discover")}
        />
      )}

      {/* On desktop the utility panel carries the goal and streak. */}
      {!isDesktop && (
        <div className="grid gap-4 sm:grid-cols-2">
          <DailyGoalCard goal={{ targetMinutes: dailyGoalTarget, todayMinutes, last7Days }} />
          <StreakCard streak={streak} last7Days={last7Days} />
        </div>
      )}

      {recentTakeaways.length > 0 && (
        <section>
          <SectionHeader
            title="Recent Takeaways"
            actionLabel="See all"
            onAction={() => navigate("/library", { state: { tab: "takeaways" } })}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {recentTakeaways.map((note) => (
              <TakeawayCard key={note.id} note={note} />
            ))}
          </div>
        </section>
      )}

      {continuing.length > 0 && (
        <section>
          <SectionHeader title="Continue Listening" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
            {continuing.map((ep) => (
              <PodcastCard
                key={ep.id}
                episode={ep}
                href={`/episode/${ep.id}`}
                onCardClick={() => navigate(`/episode/${ep.id}`)}
                progressSec={getProgressFor(ep.id)}
              />
            ))}
          </div>
        </section>
      )}

      {episodes.length > 0 && (
        <section>
          <SectionHeader title="Learning activity" actionLabel="View insights" onAction={() => navigate("/insights")} />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile icon={Clock3} label="Minutes this week" value={String(weekMinutes)} />
            <StatTile icon={NotebookPen} label="Takeaways saved" value={String(notes.length)} />
            <StatTile icon={TrendingUp} label="In progress" value={String(inProgressCount)} />
            <StatTile icon={CircleCheck} label="Finished" value={String(finishedCount)} />
          </div>
        </section>
      )}
    </div>
  );
}
