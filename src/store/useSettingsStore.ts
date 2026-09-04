import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ExportFormat = "obsidian" | "notion";

const GOAL_MIN = 5;
const GOAL_MAX = 180;

interface SettingsState {
  dailyGoalTarget: number;
  notificationsEnabled: boolean;
  exportFormat: ExportFormat;
  adjustDailyGoalTarget: (deltaMinutes: number) => void;
  toggleNotifications: () => void;
  setExportFormat: (format: ExportFormat) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      dailyGoalTarget: 30,
      notificationsEnabled: true,
      exportFormat: "obsidian",
      adjustDailyGoalTarget: (deltaMinutes) =>
        set((state) => ({
          dailyGoalTarget: Math.max(GOAL_MIN, Math.min(GOAL_MAX, state.dailyGoalTarget + deltaMinutes)),
        })),
      toggleNotifications: () => set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      setExportFormat: (format) => set({ exportFormat: format }),
    }),
    { name: "podmark-settings" },
  ),
);
