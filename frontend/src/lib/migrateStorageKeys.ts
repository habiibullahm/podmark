const KEY_MIGRATIONS = [
  ["podbrain-notes", "podmark-notes"],
  ["podbrain-ui", "podmark-ui"],
  ["podbrain-episodes", "podmark-episodes"],
  ["podbrain-settings", "podmark-settings"],
  ["podbrain-progress", "podmark-progress"],
] as const;

// One-time carry-over from the PodBrain -> PodMark rename: without this,
// every existing user's notes/settings/progress would silently vanish the
// next time they load the app, since the persisted stores now read new keys.
// Runs as an import side effect (see below) so it executes before main.tsx's
// later imports pull in the zustand stores, which read their key at import time.
function migrateStorageKeys(): void {
  for (const [oldKey, newKey] of KEY_MIGRATIONS) {
    if (localStorage.getItem(newKey) !== null) continue;
    const old = localStorage.getItem(oldKey);
    if (old !== null) {
      localStorage.setItem(newKey, old);
      localStorage.removeItem(oldKey);
    }
  }
}

migrateStorageKeys();
