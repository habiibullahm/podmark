import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CircleCheck, Flame, NotebookPen, Tag } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { usePlayer } from "../context/PlayerContext";
import { useCurrentStreak, useLast7DaysMinutes } from "../store/useActivityStore";
import { getEffectiveStatus } from "../lib/episodes";
import { lastSevenDayLabels } from "../lib/week";
import { CARD, CARD_INTERACTIVE } from "../lib/ui";
import { PageHeader } from "../components/PageHeader";
import { SectionHeader } from "../components/SectionHeader";
import { TagChip } from "../components/TagChip";
import { EpisodeArtwork } from "../components/EpisodeArtwork";

export function Insights() {
  const navigate = useNavigate();
  const episodes = useEpisodesStore((s) => s.episodes);
  const notes = useNotesStore((s) => s.notes);
  const { getProgressFor } = usePlayer();
  const streak = useCurrentStreak();
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const last7Days = useLast7DaysMinutes();

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

  const dayLabels = useMemo(() => lastSevenDayLabels(), []);
  const maxMinutes = Math.max(...last7Days, dailyGoalTarget, 1);
  const weekTotal = last7Days.reduce((sum, m) => sum + m, 0);
  const goalLinePct = (dailyGoalTarget / maxMinutes) * 100;

  return (
    <div>
      <PageHeader title="Insights" subtitle="How your listening and note-taking are adding up." />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Current streak" value={`${streak} day${streak === 1 ? "" : "s"}`} icon={Flame} tone="streak" />
        <StatCard label="Episodes finished" value={String(finishedCount)} icon={CircleCheck} tone="success" />
        <StatCard label="Notes captured" value={String(notes.length)} icon={NotebookPen} tone="accent" />
        <StatCard label="Top tag" value={tagCounts[0] ? `#${tagCounts[0][0]}` : "—"} icon={Tag} tone="accent" />
      </div>

      <section className={`${CARD} mt-6 p-5`}>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[15px] font-bold text-text-primary">Listening time — last 7 days</h2>
            <p className="text-xs text-text-secondary">
              {weekTotal} min total · daily goal {dailyGoalTarget} min
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold text-text-tertiary">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
              Goal met
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-accent/60" aria-hidden="true" />
              Listened
            </span>
          </div>
        </div>
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t border-dashed border-border"
            style={{ bottom: `${(goalLinePct / 100) * 128 + 24}px` }}
          />
          <div className="flex items-end justify-between gap-2">
            {last7Days.map((minutes, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-32 w-full items-end justify-center">
                  <div
                    title={`${minutes} min`}
                    className={`w-full max-w-[36px] rounded-t-lg ${
                      minutes >= dailyGoalTarget ? "bg-success" : minutes > 0 ? "bg-accent/60" : "bg-bg-surface-alt"
                    }`}
                    style={{ height: `${Math.max(6, (minutes / maxMinutes) * 128)}px` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-text-tertiary">{dayLabels[i]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section className={`${CARD} p-5`}>
          <SectionHeader title="Most-used tags" />
          <div className="flex flex-wrap gap-2">
            {tagCounts.length > 0 ? (
              tagCounts.map(([tag, count]) => (
                <div key={tag} className="flex items-center gap-1.5 rounded-full bg-bg-surface-alt py-0.5 pl-0.5 pr-2.5">
                  <TagChip label={tag} />
                  <span className="text-xs font-bold text-text-secondary">×{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-text-secondary">No tagged notes yet.</p>
            )}
          </div>
        </section>

        <section className={`${CARD} p-5`}>
          <SectionHeader title="Notes per episode" />
          <div className="flex flex-col gap-2">
            {notesPerEpisode.length > 0 ? (
              notesPerEpisode.map(({ episode, count }) => (
                <button
                  key={episode.id}
                  type="button"
                  onClick={() => navigate(`/episode/${episode.id}`)}
                  className={`${CARD_INTERACTIVE} flex items-center gap-3 px-3 py-2.5 text-left shadow-none`}
                >
                  <EpisodeArtwork episode={episode} className="h-9 w-9 shrink-0 rounded-lg" />
                  <span className="line-clamp-1 flex-1 text-[13px] font-semibold text-text-primary">{episode.title}</span>
                  <span className="shrink-0 rounded-full bg-bg-surface-alt px-2.5 py-1 text-xs font-bold text-text-secondary">
                    {count} note{count === 1 ? "" : "s"}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-text-tertiary" aria-hidden="true" />
                </button>
              ))
            ) : (
              <p className="text-sm text-text-secondary">No notes yet — start capturing takeaways from an episode.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

const TONES = {
  accent: "bg-accent/10 text-accent",
  success: "bg-success/15 text-success",
  streak: "bg-streak/15 text-streak",
} as const;

function StatCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: LucideIcon; tone: keyof typeof TONES }) {
  return (
    <div className={`${CARD} p-4`}>
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <p className="mt-3 truncate text-xl font-extrabold tracking-tight text-text-primary">{value}</p>
      <p className="text-xs text-text-secondary">{label}</p>
    </div>
  );
}
