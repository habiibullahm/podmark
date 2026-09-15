import { create } from "zustand";

export type SyncPhase = "idle" | "syncing" | "synced" | "error";

interface SyncState {
  phase: SyncPhase;
  pendingCount: number;
  lastSyncedAt: number | null;
}

// Read by the Profile screen's sync indicator; written only by lib/sync.ts.
export const useSyncStore = create<SyncState>()(() => ({
  phase: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
}));
