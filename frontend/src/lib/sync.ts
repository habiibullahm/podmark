// Syncs every local store to Supabase while signed in. Started by
// useAuthStore when status becomes "signedIn", stopped on sign-out.
//
// Conflict strategy: rather than comparing per-record updatedAt timestamps
// (which only Episode/NoteBlock/Folder carry), every table shares one
// mechanism — a persisted "dirty" set of keys with a local change not yet
// confirmed pushed. On pull, a key currently marked dirty is left alone
// (the pending local edit wins); every other key takes the server's value,
// including removal when the server row carries deleted_at. This protects
// an unsynced local edit exactly like a per-record timestamp would, without
// requiring every store to carry one. Once a push succeeds the key stops
// being dirty, so the next pull picks up whatever is authoritative on the
// server — which, since the server's updated_at is maintained by a single
// trigger, is inherently the most recent write across every device. This is
// last-write-wins in effect, just arbitrated by "is this pending" instead of
// two clocks.
//
// First sign-in on a device is a plain pull with one twist: local-only keys
// (not present on the server yet) are left untouched rather than deleted,
// then immediately marked dirty so the very next push cycle uploads them.
// Because ids are randomly generated, a collision between two devices'
// never-synced records is effectively impossible, so "server wins for
// overlapping keys, keep local-only keys" merges without overwriting either
// side. Settings has no natural id and no such guarantee, so it gets the
// simpler rule the plan calls for explicitly: server wins if a row exists,
// otherwise the local settings get uploaded.
import { supabase } from "./supabase";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useNotesStore } from "../store/useNotesStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useActivityStore } from "../store/useActivityStore";
import { useProgressStore } from "../store/useProgressStore";
import { useSyncStore } from "../store/useSyncStore";
import type { Episode, NoteBlock, Folder } from "../data/types";
import type { ExportFormat } from "../store/useSettingsStore";

type Row = Record<string, unknown>;

const TABLES = [
  "episodes",
  "notes",
  "folders",
  "freeform_notes",
  "ai_summaries",
  "settings",
  "activity",
  "progress",
] as const;
type TableName = (typeof TABLES)[number];

// Tables whose writes are debounced, because they change on every keystroke
// or every playback tick — pushing on every change would be wasteful. The
// rest (episodes, notes, folders, ai_summaries, settings) push immediately;
// those changes are infrequent and usually deliberate ("save").
const DEBOUNCED_TABLES = new Set<TableName>(["freeform_notes", "activity", "progress"]);
const DEBOUNCE_MS = 1000;
const RETRY_INTERVAL_MS = 30_000;
const SETTINGS_KEY = "singleton";

const DIRTY_STORAGE_KEY = "podmark-sync-dirty";

function loadDirty(): Record<TableName, Set<string>> {
  const result = Object.fromEntries(TABLES.map((t) => [t, new Set<string>()])) as Record<
    TableName,
    Set<string>
  >;
  try {
    const raw = localStorage.getItem(DIRTY_STORAGE_KEY);
    if (!raw) return result;
    const parsed = JSON.parse(raw) as Partial<Record<TableName, string[]>>;
    for (const t of TABLES) {
      if (Array.isArray(parsed[t])) result[t] = new Set(parsed[t]);
    }
  } catch {
    // ignore corrupt state — starting clean just means an extra pull-apply
  }
  return result;
}

function saveDirty(dirty: Record<TableName, Set<string>>) {
  try {
    const plain = Object.fromEntries(TABLES.map((t) => [t, Array.from(dirty[t])]));
    localStorage.setItem(DIRTY_STORAGE_KEY, JSON.stringify(plain));
  } catch {
    // ignore write failures (e.g. private browsing storage limits)
  }
}

function mergedFlagKey(userId: string): string {
  return `podmark-sync-merged:${userId}`;
}

// ---- Per-table row <-> local-shape mapping ----------------------------

function episodeToRow(e: Episode): Row {
  return {
    id: e.id,
    title: e.title,
    show: e.show,
    artwork_gradient: e.artworkGradient,
    artwork_image_url: e.artworkImageUrl ?? null,
    duration_sec: e.durationSec,
    progress_sec: e.progressSec,
    status: e.status,
    tags: e.tags,
    published_at: e.publishedAt,
    audio_url: e.audioUrl ?? null,
    source_url: e.sourceUrl ?? null,
    description: e.description ?? null,
    deleted_at: null,
  };
}

function rowToEpisode(r: Row): Episode {
  return {
    id: r.id as string,
    title: r.title as string,
    show: r.show as string,
    artworkGradient: (r.artwork_gradient as string) ?? "",
    artworkImageUrl: (r.artwork_image_url as string) ?? undefined,
    durationSec: (r.duration_sec as number) ?? 0,
    progressSec: (r.progress_sec as number) ?? 0,
    status: r.status as Episode["status"],
    tags: (r.tags as string[]) ?? [],
    publishedAt: (r.published_at as string) ?? "",
    audioUrl: (r.audio_url as string) ?? undefined,
    sourceUrl: (r.source_url as string) ?? undefined,
    description: (r.description as string) ?? undefined,
    updatedAt: r.updated_at as string,
  };
}

function noteToRow(n: NoteBlock): Row {
  return {
    id: n.id,
    episode_id: n.episodeId,
    type: n.type,
    timestamp_sec: n.timestampSec,
    text: n.text,
    tags: n.tags,
    created_at: n.createdAt,
    deleted_at: null,
  };
}

function rowToNote(r: Row): NoteBlock {
  return {
    id: r.id as string,
    episodeId: r.episode_id as string,
    type: r.type as NoteBlock["type"],
    timestampSec: (r.timestamp_sec as number) ?? 0,
    text: (r.text as string) ?? "",
    tags: (r.tags as string[]) ?? [],
    createdAt: (r.created_at as string) ?? (r.updated_at as string),
    updatedAt: r.updated_at as string,
  };
}

function folderToRow(f: Folder): Row {
  return {
    id: f.id,
    name: f.name,
    color: f.color,
    episode_ids: f.episodeIds,
    deleted_at: null,
  };
}

function rowToFolder(r: Row): Folder {
  return {
    id: r.id as string,
    name: r.name as string,
    color: r.color as string,
    episodeIds: (r.episode_ids as string[]) ?? [],
    updatedAt: r.updated_at as string,
  };
}

// ---- Sync engine state --------------------------------------------------

let dirty = loadDirty();
// Suppresses the store subscriptions below while a pull is applying remote
// data, so rehydration never echoes straight back out as a push.
let applyingRemote = false;
let started = false;
let retryTimer: ReturnType<typeof setInterval> | null = null;
const debounceTimers = new Map<TableName, ReturnType<typeof setTimeout>>();
const unsubscribers: (() => void)[] = [];

// A soft-delete upsert still has to satisfy the table's NOT NULL columns
// (title, show, episode_id, type, name, color — none of them have a
// default), so it can't be built from just {id, deleted_at} once the record
// is gone from the local store. This holds each removed record's last known
// field values, captured the moment its subscribe listener sees it vanish,
// so the tombstone push has something valid to send. In-memory only — if a
// dirty delete somehow survives a reload with no cached row (the local
// store never even reached this device in the first place), the push falls
// back to an empty-but-valid row, which is harmless: it either lands as an
// already-deleted row the client never sees again, or is overwritten by a
// later real value.
const pendingDeleteRows: Record<"episodes" | "notes" | "folders", Map<string, Row>> = {
  episodes: new Map(),
  notes: new Map(),
  folders: new Map(),
};

function markDirty(table: TableName, key: string) {
  dirty[table].add(key);
  saveDirty(dirty);
}

function clearDirty(table: TableName, key: string) {
  dirty[table].delete(key);
  saveDirty(dirty);
}

function updatePendingCount() {
  const pendingCount = TABLES.reduce((sum, t) => sum + dirty[t].size, 0);
  useSyncStore.setState({ pendingCount });
}

function schedulePush(table: TableName, run: () => Promise<void>) {
  updatePendingCount();
  const delay = DEBOUNCED_TABLES.has(table) ? DEBOUNCE_MS : 0;
  const existing = debounceTimers.get(table);
  if (existing) clearTimeout(existing);
  debounceTimers.set(
    table,
    setTimeout(() => {
      debounceTimers.delete(table);
      useSyncStore.setState({ phase: "syncing" });
      run()
        .then(() => {
          updatePendingCount();
          useSyncStore.setState({ phase: "synced", lastSyncedAt: Date.now() });
        })
        .catch((err) => {
          console.error(`Sync push failed for ${table}:`, err);
          updatePendingCount();
          useSyncStore.setState({ phase: "error" });
        });
    }, delay),
  );
}

// ---- episodes / notes / folders: array-of-objects keyed by id ----------

// Minimal values for each table's NOT NULL columns that have no database
// default — only used if pendingDeleteRows has nothing cached, which means
// the app closed between marking this key dirty-for-deletion and pushing it
// (the cache is in-memory only). The real field values don't matter once a
// row is soft-deleted; this just has to be a row Postgres will accept.
const DELETE_FALLBACKS: Record<"episodes" | "notes" | "folders", Row> = {
  episodes: { title: "", show: "" },
  notes: { episode_id: "", type: "timestamp-note" },
  folders: { name: "", color: "" },
};

function deleteTombstone(table: "episodes" | "notes" | "folders", id: string, idKey: string): Row {
  const cached = pendingDeleteRows[table].get(id);
  return { ...DELETE_FALLBACKS[table], ...cached, [idKey]: id, deleted_at: new Date().toISOString() };
}

async function pushEpisodes() {
  if (!supabase) return;
  const keys = Array.from(dirty.episodes);
  if (keys.length === 0) return;
  const byId = new Map(useEpisodesStore.getState().episodes.map((e) => [e.id, e]));
  const rows = keys.map((id) => {
    const ep = byId.get(id);
    if (ep) {
      pendingDeleteRows.episodes.set(id, episodeToRow(ep));
      return episodeToRow(ep);
    }
    return deleteTombstone("episodes", id, "id");
  });
  const { error } = await supabase.from("episodes").upsert(rows, { onConflict: "user_id,id" });
  if (error) throw error;
  for (const id of keys) {
    clearDirty("episodes", id);
    if (!byId.has(id)) pendingDeleteRows.episodes.delete(id);
  }
}

async function pushNotes() {
  if (!supabase) return;
  const keys = Array.from(dirty.notes);
  if (keys.length === 0) return;
  const byId = new Map(useNotesStore.getState().notes.map((n) => [n.id, n]));
  const rows = keys.map((id) => {
    const note = byId.get(id);
    if (note) {
      pendingDeleteRows.notes.set(id, noteToRow(note));
      return noteToRow(note);
    }
    return deleteTombstone("notes", id, "id");
  });
  const { error } = await supabase.from("notes").upsert(rows, { onConflict: "user_id,id" });
  if (error) throw error;
  for (const id of keys) {
    clearDirty("notes", id);
    if (!byId.has(id)) pendingDeleteRows.notes.delete(id);
  }
}

async function pushFolders() {
  if (!supabase) return;
  const keys = Array.from(dirty.folders);
  if (keys.length === 0) return;
  const byId = new Map(useFoldersStore.getState().folders.map((f) => [f.id, f]));
  const rows = keys.map((id) => {
    const folder = byId.get(id);
    if (folder) {
      pendingDeleteRows.folders.set(id, folderToRow(folder));
      return folderToRow(folder);
    }
    return deleteTombstone("folders", id, "id");
  });
  const { error } = await supabase.from("folders").upsert(rows, { onConflict: "user_id,id" });
  if (error) throw error;
  for (const id of keys) {
    clearDirty("folders", id);
    if (!byId.has(id)) pendingDeleteRows.folders.delete(id);
  }
}

async function pullEpisodes(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("episodes").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useEpisodesStore.setState((state) => {
      const local = new Map(state.episodes.map((e) => [e.id, e]));
      for (const row of (data ?? []) as Row[]) {
        const id = row.id as string;
        if (dirty.episodes.has(id)) continue;
        if (row.deleted_at) {
          local.delete(id);
        } else {
          local.set(id, rowToEpisode(row));
        }
      }
      if (isFirstMerge) {
        for (const [id] of local) {
          if (!(data ?? []).some((r) => (r as Row).id === id)) markDirty("episodes", id);
        }
      }
      return { episodes: Array.from(local.values()) };
    });
  } finally {
    applyingRemote = false;
  }
}

async function pullNotes(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("notes").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useNotesStore.setState((state) => {
      const local = new Map(state.notes.map((n) => [n.id, n]));
      for (const row of (data ?? []) as Row[]) {
        const id = row.id as string;
        if (dirty.notes.has(id)) continue;
        if (row.deleted_at) {
          local.delete(id);
        } else {
          local.set(id, rowToNote(row));
        }
      }
      if (isFirstMerge) {
        for (const [id] of local) {
          if (!(data ?? []).some((r) => (r as Row).id === id)) markDirty("notes", id);
        }
      }
      return { notes: Array.from(local.values()) };
    });
  } finally {
    applyingRemote = false;
  }
}

async function pullFolders(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("folders").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useFoldersStore.setState((state) => {
      const local = new Map(state.folders.map((f) => [f.id, f]));
      for (const row of (data ?? []) as Row[]) {
        const id = row.id as string;
        if (dirty.folders.has(id)) continue;
        if (row.deleted_at) {
          local.delete(id);
        } else {
          local.set(id, rowToFolder(row));
        }
      }
      if (isFirstMerge) {
        for (const [id] of local) {
          if (!(data ?? []).some((r) => (r as Row).id === id)) markDirty("folders", id);
        }
      }
      return { folders: Array.from(local.values()) };
    });
  } finally {
    applyingRemote = false;
  }
}

// ---- freeform_notes / activity / progress: Record<key, scalar> ---------

async function pushFreeformNotes() {
  if (!supabase) return;
  const keys = Array.from(dirty.freeform_notes);
  if (keys.length === 0) return;
  const map = useNotesStore.getState().freeformNotes;
  const rows = keys.map((episodeId) =>
    episodeId in map
      ? { episode_id: episodeId, text: map[episodeId], deleted_at: null }
      : { episode_id: episodeId, text: "", deleted_at: new Date().toISOString() },
  );
  const { error } = await supabase.from("freeform_notes").upsert(rows, { onConflict: "user_id,episode_id" });
  if (error) throw error;
  for (const id of keys) clearDirty("freeform_notes", id);
}

async function pullFreeformNotes(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("freeform_notes").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useNotesStore.setState((state) => {
      const local = { ...state.freeformNotes };
      for (const row of (data ?? []) as Row[]) {
        const episodeId = row.episode_id as string;
        if (dirty.freeform_notes.has(episodeId)) continue;
        if (row.deleted_at) delete local[episodeId];
        else local[episodeId] = row.text as string;
      }
      if (isFirstMerge) {
        for (const episodeId of Object.keys(local)) {
          if (!(data ?? []).some((r) => (r as Row).episode_id === episodeId)) {
            markDirty("freeform_notes", episodeId);
          }
        }
      }
      return { freeformNotes: local };
    });
  } finally {
    applyingRemote = false;
  }
}

async function pushActivity() {
  if (!supabase) return;
  const keys = Array.from(dirty.activity);
  if (keys.length === 0) return;
  const map = useActivityStore.getState().minutesByDate;
  const rows = keys.map((date) =>
    date in map
      ? { date, minutes: map[date], deleted_at: null }
      : { date, minutes: 0, deleted_at: new Date().toISOString() },
  );
  const { error } = await supabase.from("activity").upsert(rows, { onConflict: "user_id,date" });
  if (error) throw error;
  for (const key of keys) clearDirty("activity", key);
}

async function pullActivity(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("activity").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useActivityStore.setState((state) => {
      const local = { ...state.minutesByDate };
      for (const row of (data ?? []) as Row[]) {
        const date = row.date as string;
        if (dirty.activity.has(date)) continue;
        if (row.deleted_at) delete local[date];
        else local[date] = row.minutes as number;
      }
      if (isFirstMerge) {
        for (const date of Object.keys(local)) {
          if (!(data ?? []).some((r) => (r as Row).date === date)) markDirty("activity", date);
        }
      }
      return { minutesByDate: local };
    });
  } finally {
    applyingRemote = false;
  }
}

async function pushProgress() {
  if (!supabase) return;
  const keys = Array.from(dirty.progress);
  if (keys.length === 0) return;
  const map = useProgressStore.getState().progressByEpisode;
  const rows = keys.map((episodeId) =>
    episodeId in map
      ? { episode_id: episodeId, seconds: map[episodeId], deleted_at: null }
      : { episode_id: episodeId, seconds: 0, deleted_at: new Date().toISOString() },
  );
  const { error } = await supabase.from("progress").upsert(rows, { onConflict: "user_id,episode_id" });
  if (error) throw error;
  for (const id of keys) clearDirty("progress", id);
}

async function pullProgress(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("progress").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useProgressStore.setState((state) => {
      const local = { ...state.progressByEpisode };
      for (const row of (data ?? []) as Row[]) {
        const episodeId = row.episode_id as string;
        if (dirty.progress.has(episodeId)) continue;
        if (row.deleted_at) delete local[episodeId];
        else local[episodeId] = row.seconds as number;
      }
      if (isFirstMerge) {
        for (const episodeId of Object.keys(local)) {
          if (!(data ?? []).some((r) => (r as Row).episode_id === episodeId)) {
            markDirty("progress", episodeId);
          }
        }
      }
      return { progressByEpisode: local };
    });
  } finally {
    applyingRemote = false;
  }
}

// ---- ai_summaries: two local maps (bullets + error) share one table ----

async function pushAiSummaries() {
  if (!supabase) return;
  const keys = Array.from(dirty.ai_summaries);
  if (keys.length === 0) return;
  const { aiSummaries, aiSummaryErrors } = useNotesStore.getState();
  const rows = keys.map((episodeId) => {
    const bullets = aiSummaries[episodeId];
    const errorMsg = aiSummaryErrors[episodeId];
    if (!bullets && !errorMsg) {
      return { episode_id: episodeId, bullets: [], error: null, deleted_at: new Date().toISOString() };
    }
    return { episode_id: episodeId, bullets: bullets ?? [], error: errorMsg ?? null, deleted_at: null };
  });
  const { error } = await supabase.from("ai_summaries").upsert(rows, { onConflict: "user_id,episode_id" });
  if (error) throw error;
  for (const id of keys) clearDirty("ai_summaries", id);
}

async function pullAiSummaries(isFirstMerge: boolean) {
  if (!supabase) return;
  const { data, error } = await supabase.from("ai_summaries").select("*");
  if (error) throw error;
  applyingRemote = true;
  try {
    useNotesStore.setState((state) => {
      const aiSummaries = { ...state.aiSummaries };
      const aiSummaryErrors = { ...state.aiSummaryErrors };
      for (const row of (data ?? []) as Row[]) {
        const episodeId = row.episode_id as string;
        if (dirty.ai_summaries.has(episodeId)) continue;
        if (row.deleted_at) {
          delete aiSummaries[episodeId];
          delete aiSummaryErrors[episodeId];
          continue;
        }
        const bullets = row.bullets as string[];
        if (bullets && bullets.length > 0) aiSummaries[episodeId] = bullets;
        else delete aiSummaries[episodeId];
        if (row.error) aiSummaryErrors[episodeId] = row.error as string;
        else delete aiSummaryErrors[episodeId];
      }
      if (isFirstMerge) {
        const localKeys = new Set([...Object.keys(aiSummaries), ...Object.keys(aiSummaryErrors)]);
        for (const episodeId of localKeys) {
          if (!(data ?? []).some((r) => (r as Row).episode_id === episodeId)) {
            markDirty("ai_summaries", episodeId);
          }
        }
      }
      return { aiSummaries, aiSummaryErrors };
    });
  } finally {
    applyingRemote = false;
  }
}

// ---- settings: singleton, server wins if present ------------------------

async function pushSettings() {
  if (!supabase) return;
  if (!dirty.settings.has(SETTINGS_KEY)) return;
  const { dailyGoalTarget, notificationsEnabled, exportFormat } = useSettingsStore.getState();
  const { error } = await supabase
    .from("settings")
    .upsert(
      { daily_goal_target: dailyGoalTarget, notifications_enabled: notificationsEnabled, export_format: exportFormat },
      { onConflict: "user_id" },
    );
  if (error) throw error;
  clearDirty("settings", SETTINGS_KEY);
}

async function pullSettings() {
  if (!supabase) return;
  const { data, error } = await supabase.from("settings").select("*").maybeSingle();
  if (error) throw error;
  if (dirty.settings.has(SETTINGS_KEY)) return;
  applyingRemote = true;
  try {
    if (data) {
      const row = data as Row;
      useSettingsStore.setState({
        dailyGoalTarget: row.daily_goal_target as number,
        notificationsEnabled: row.notifications_enabled as boolean,
        exportFormat: row.export_format as ExportFormat,
      });
    } else {
      markDirty("settings", SETTINGS_KEY);
    }
  } finally {
    applyingRemote = false;
  }
}

// ---- lifecycle -----------------------------------------------------------

async function pullAll(isFirstMerge: boolean) {
  await Promise.all([
    pullEpisodes(isFirstMerge),
    pullNotes(isFirstMerge),
    pullFolders(isFirstMerge),
    pullFreeformNotes(isFirstMerge),
    pullAiSummaries(isFirstMerge),
    pullSettings(),
    pullActivity(isFirstMerge),
    pullProgress(isFirstMerge),
  ]);
}

async function flushAllDirty() {
  await Promise.all([
    pushEpisodes(),
    pushNotes(),
    pushFolders(),
    pushFreeformNotes(),
    pushAiSummaries(),
    pushSettings(),
    pushActivity(),
    pushProgress(),
  ]);
}

function attachSubscriptions() {
  unsubscribers.push(
    useEpisodesStore.subscribe((state, prev) => {
      if (applyingRemote || state.episodes === prev.episodes) return;
      const prevIds = new Set(prev.episodes.map((e) => e.id));
      const nextIds = new Set(state.episodes.map((e) => e.id));
      for (const e of state.episodes) if (e !== prev.episodes.find((p) => p.id === e.id)) markDirty("episodes", e.id);
      for (const id of prevIds) {
        if (nextIds.has(id)) continue;
        const removed = prev.episodes.find((p) => p.id === id);
        if (removed) pendingDeleteRows.episodes.set(id, episodeToRow(removed));
        markDirty("episodes", id);
      }
      schedulePush("episodes", pushEpisodes);
    }),
  );
  unsubscribers.push(
    useNotesStore.subscribe((state, prev) => {
      if (applyingRemote) return;
      if (state.notes !== prev.notes) {
        const prevIds = new Set(prev.notes.map((n) => n.id));
        const nextIds = new Set(state.notes.map((n) => n.id));
        for (const n of state.notes) if (n !== prev.notes.find((p) => p.id === n.id)) markDirty("notes", n.id);
        for (const id of prevIds) {
          if (nextIds.has(id)) continue;
          const removed = prev.notes.find((p) => p.id === id);
          if (removed) pendingDeleteRows.notes.set(id, noteToRow(removed));
          markDirty("notes", id);
        }
        schedulePush("notes", pushNotes);
      }
      if (state.freeformNotes !== prev.freeformNotes) {
        const keys = new Set([...Object.keys(state.freeformNotes), ...Object.keys(prev.freeformNotes)]);
        for (const k of keys) if (state.freeformNotes[k] !== prev.freeformNotes[k]) markDirty("freeform_notes", k);
        schedulePush("freeform_notes", pushFreeformNotes);
      }
      if (state.aiSummaries !== prev.aiSummaries || state.aiSummaryErrors !== prev.aiSummaryErrors) {
        const keys = new Set([
          ...Object.keys(state.aiSummaries),
          ...Object.keys(prev.aiSummaries),
          ...Object.keys(state.aiSummaryErrors),
          ...Object.keys(prev.aiSummaryErrors),
        ]);
        for (const k of keys) {
          if (state.aiSummaries[k] !== prev.aiSummaries[k] || state.aiSummaryErrors[k] !== prev.aiSummaryErrors[k]) {
            markDirty("ai_summaries", k);
          }
        }
        schedulePush("ai_summaries", pushAiSummaries);
      }
    }),
  );
  unsubscribers.push(
    useFoldersStore.subscribe((state, prev) => {
      if (applyingRemote || state.folders === prev.folders) return;
      const prevIds = new Set(prev.folders.map((f) => f.id));
      const nextIds = new Set(state.folders.map((f) => f.id));
      for (const f of state.folders) if (f !== prev.folders.find((p) => p.id === f.id)) markDirty("folders", f.id);
      for (const id of prevIds) {
        if (nextIds.has(id)) continue;
        const removed = prev.folders.find((p) => p.id === id);
        if (removed) pendingDeleteRows.folders.set(id, folderToRow(removed));
        markDirty("folders", id);
      }
      schedulePush("folders", pushFolders);
    }),
  );
  unsubscribers.push(
    useSettingsStore.subscribe((state, prev) => {
      if (applyingRemote) return;
      if (
        state.dailyGoalTarget !== prev.dailyGoalTarget ||
        state.notificationsEnabled !== prev.notificationsEnabled ||
        state.exportFormat !== prev.exportFormat
      ) {
        markDirty("settings", SETTINGS_KEY);
        schedulePush("settings", pushSettings);
      }
    }),
  );
  unsubscribers.push(
    useActivityStore.subscribe((state, prev) => {
      if (applyingRemote || state.minutesByDate === prev.minutesByDate) return;
      const keys = new Set([...Object.keys(state.minutesByDate), ...Object.keys(prev.minutesByDate)]);
      for (const k of keys) if (state.minutesByDate[k] !== prev.minutesByDate[k]) markDirty("activity", k);
      schedulePush("activity", pushActivity);
    }),
  );
  unsubscribers.push(
    useProgressStore.subscribe((state, prev) => {
      if (applyingRemote || state.progressByEpisode === prev.progressByEpisode) return;
      const keys = new Set([...Object.keys(state.progressByEpisode), ...Object.keys(prev.progressByEpisode)]);
      for (const k of keys) if (state.progressByEpisode[k] !== prev.progressByEpisode[k]) markDirty("progress", k);
      schedulePush("progress", pushProgress);
    }),
  );
}

export async function startSync(userId: string) {
  if (started || !supabase) return;
  started = true;
  dirty = loadDirty();
  attachSubscriptions();
  updatePendingCount();

  const isFirstMerge = localStorage.getItem(mergedFlagKey(userId)) === null;
  useSyncStore.setState({ phase: "syncing" });
  try {
    await pullAll(isFirstMerge);
    if (isFirstMerge) localStorage.setItem(mergedFlagKey(userId), "1");
    await flushAllDirty();
    useSyncStore.setState({ phase: "synced", lastSyncedAt: Date.now() });
  } catch (err) {
    console.error("Initial sync failed:", err);
    useSyncStore.setState({ phase: "error" });
  }
  updatePendingCount();

  retryTimer = setInterval(() => {
    updatePendingCount();
    flushAllDirty()
      .then(() => useSyncStore.setState({ phase: "synced", lastSyncedAt: Date.now() }))
      .catch((err) => {
        console.error("Retry sync failed:", err);
        useSyncStore.setState({ phase: "error" });
      })
      .finally(updatePendingCount);
  }, RETRY_INTERVAL_MS);
}

export function stopSync() {
  started = false;
  for (const unsub of unsubscribers.splice(0)) unsub();
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();
  if (retryTimer) {
    clearInterval(retryTimer);
    retryTimer = null;
  }
  useSyncStore.setState({ phase: "idle", pendingCount: 0, lastSyncedAt: null });
}
