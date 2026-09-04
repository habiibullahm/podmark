import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { SectionHeader } from "../components/SectionHeader";

const GOAL_STEP = 5;

export function Profile() {
  const episodesCount = useEpisodesStore((s) => s.episodes.length);
  const notesCount = useNotesStore((s) => s.notes.length);
  const dailyGoalTarget = useSettingsStore((s) => s.dailyGoalTarget);
  const adjustDailyGoalTarget = useSettingsStore((s) => s.adjustDailyGoalTarget);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const toggleNotifications = useSettingsStore((s) => s.toggleNotifications);
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const setExportFormat = useSettingsStore((s) => s.setExportFormat);

  return (
    <div className="pb-40 px-5 pt-[calc(env(safe-area-inset-top)+1.25rem)] md:px-0 md:pb-16 md:pt-0">
      <h1 className="mb-5 text-xl font-semibold text-text-primary">Profile</h1>

      <div className="flex items-center gap-4 rounded-2xl border border-border bg-bg-surface p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xl font-semibold text-accent">
          A
        </div>
        <div>
          <p className="text-[17px] font-semibold text-text-primary">Alex</p>
          <p className="text-xs text-text-secondary">
            🔥 12 day streak · {episodesCount} episodes · {notesCount} notes
          </p>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Daily goal" />
        <div className="mx-5 flex items-center justify-between rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <div>
            <p className="text-[15px] font-semibold text-text-primary">{dailyGoalTarget} min / day</p>
            <p className="text-xs text-text-secondary">How long you want to listen and take notes each day.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease daily goal"
              onClick={() => adjustDailyGoalTarget(-GOAL_STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
            >
              −
            </button>
            <button
              type="button"
              aria-label="Increase daily goal"
              onClick={() => adjustDailyGoalTarget(GOAL_STEP)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-surface-alt text-text-primary hover:bg-border"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Notifications" />
        <div className="mx-5 flex items-center justify-between rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <div>
            <p className="text-[15px] font-semibold text-text-primary">Daily reminder</p>
            <p className="text-xs text-text-secondary">Nudge me if I haven't hit my listening goal.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={notificationsEnabled}
            onClick={toggleNotifications}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              notificationsEnabled ? "border-accent bg-accent" : "border-border bg-bg-surface-alt"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                notificationsEnabled ? "translate-x-[22px]" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <SectionHeader title="Export" />
        <div className="mx-5 rounded-2xl border border-border bg-bg-surface p-4 md:mx-0">
          <p className="text-[15px] font-semibold text-text-primary">Preferred export format</p>
          <p className="mb-3 text-xs text-text-secondary">
            Used when exporting notes from the Library — a downloadable Markdown file either way.
          </p>
          <div className="flex gap-2">
            {(["obsidian", "notion"] as const).map((format) => (
              <button
                key={format}
                type="button"
                onClick={() => setExportFormat(format)}
                className={`flex-1 rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                  exportFormat === format
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-text-secondary hover:border-accent/60"
                }`}
              >
                {format}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6 mb-2">
        <button
          type="button"
          disabled
          title="Sign-in isn't implemented in this prototype yet"
          className="mx-5 w-[calc(100%-2.5rem)] rounded-2xl border border-border bg-bg-surface p-3.5 text-sm font-semibold text-text-tertiary md:mx-0 md:w-full"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
