import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { dailyGoal } from "../data/mockData";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { usePlayer } from "../context/PlayerContext";
import { useCurrentStreak } from "../store/useActivityStore";
import { getEffectiveStatus } from "../lib/episodes";
import { SectionHeader } from "../components/SectionHeader";
import { TagChip } from "../components/TagChip";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function last7DayLabels(): string[] {
  const today = new Date().getDay();
  return Array.from({ length: 7 }, (_, i) => WEEKDAY_LABELS[(today - 6 + i + 7) % 7]);
}

export function Insights() {
  const navigate = useNavigate();
  const episodes = useEpisodesStore((s) => s.episodes);
  const notes = useNotesStore((s) => s.notes);
  const { getProgressFor } = usePlayer();
  const streak = useCurrentStreak();

  const finishedCount = useMemo(
    () => episodes.filter((e) => getEffectiveStatus(e, getProgressFor(e.id)) === "finished").length,
    [episodes, getProgressFor],
  );

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) {
      for (const tag of note.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [notes]);

  const notesPerEpisode = useMemo(() => {
    const counts = new Map<string, number>();
    for (const note of notes) counts.set(note.episodeId, (counts.get(note.episodeId) ?? 0) + 1);
    return [...counts.entries()]
      .map(([episodeId, count]) => ({ episode: episodes.find((e) => e.id === episodeId), count }))
      .filter((row): row is { episode: NonNullable<typeof row.episode>; count: number } => !!row.episode)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [notes, episodes]);

  const dayLabels = useMemo(last7DayLabels, []);
  const maxMinutes = Math.max(...dailyGoal.last7Days, dailyGoal.targetMinutes);

  return (
    <div className="pb-40 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-0 md:pb-16 md:pt-0">
      <h1 className="mb-5 text-xl font-semibold text-text-primary">Insights</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} icon="🔥" />
        <StatCard label="Episodes finished" value={String(finishedCount)} icon="✅" />
        <StatCard label="Notes captured" value={String(notes.length)} icon="📝" />
        <StatCard label="Top tag" value={tagCounts[0] ? `#${tagCounts[0][0]}` : "—"} icon="🏷️" />
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-bg-surface p-4">
        <p className="mb-4 text-[15px] font-semibold text-text-primary">Listening time — last 7 days</p>
        <div className="flex items-end justify-between gap-2">
          {dailyGoal.last7Days.map((minutes, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex h-24 w-full items-end justify-center">
                <div
                  className={`w-full max-w-[28px] rounded-t-md ${
                    minutes >= dailyGoal.targetMinutes ? "bg-success" : "bg-accent/60"
                  }`}
                  style={{ height: `${Math.max(6, (minutes / maxMinutes) * 96)}px` }}
                />
              </div>
              <span className="text-[11px] text-text-tertiary">{dayLabels[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Most-used tags" />
        <div className="flex flex-wrap gap-2 px-5 md:px-0">
          {tagCounts.length > 0 ? (
            tagCounts.map(([tag, count]) => (
              <div key={tag} className="flex items-center gap-1.5">
                <TagChip label={tag} />
                <span className="text-xs text-text-tertiary">×{count}</span>
              </div>
            ))
          ) : (
            <p className="text-sm text-text-secondary">No tagged notes yet.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Notes per episode" />
        <div className="flex flex-col gap-2 px-5 md:px-0">
          {notesPerEpisode.length > 0 ? (
            notesPerEpisode.map(({ episode, count }) => (
              <button
                key={episode.id}
                type="button"
                onClick={() => navigate(`/episode/${episode.id}`)}
                className="flex items-center justify-between rounded-xl border border-border bg-bg-surface px-3.5 py-3 text-left hover:border-accent/60"
              >
                <span className="line-clamp-1 text-[13px] font-medium text-text-primary">{episode.title}</span>
                <span className="shrink-0 rounded-full bg-bg-surface-alt px-2.5 py-1 text-xs font-semibold text-text-secondary">
                  {count} note{count === 1 ? "" : "s"}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-text-secondary">No notes yet — start capturing takeaways from an episode.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-surface p-3.5">
      <p className="text-lg">{icon}</p>
      <p className="mt-1.5 text-[17px] font-semibold text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}
