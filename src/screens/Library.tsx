import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNotesStore } from "../store/useNotesStore";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { searchPodcastEpisodes } from "../lib/itunesApi";
import { fetchYouTubeEpisode } from "../lib/youtubeApi";
import { buildLibraryMarkdown, downloadMarkdownFile } from "../lib/export";
import { formatTime } from "../lib/format";
import type { Episode } from "../data/types";
import { SearchBar } from "../components/SearchBar";
import { SegmentedTabSwitcher } from "../components/SegmentedTabSwitcher";
import { TagChip } from "../components/TagChip";
import { EpisodeCard } from "../components/EpisodeCard";
import { TakeawayCard } from "../components/TakeawayCard";
import { FolderCard } from "../components/FolderCard";
import { EmptyState } from "../components/EmptyState";
import { EpisodeArtwork } from "../components/EpisodeArtwork";

type TabKey = "episodes" | "takeaways" | "folders" | "discover";

const TABS: { key: TabKey; label: string }[] = [
  { key: "episodes", label: "Episodes" },
  { key: "takeaways", label: "Takeaways" },
  { key: "folders", label: "Folders" },
  { key: "discover", label: "Discover" },
];

// In-progress episodes surface first (most actionable), then not-started,
// then finished ones sink to the bottom — otherwise a unified list would
// bury what the user is actually likely to want next under old completions.
const STATUS_RANK: Record<string, number> = { "in-progress": 0, "not-started": 1, finished: 2 };

function DiscoverResultCard({ episode, onAdd, added }: { episode: Episode; onAdd: () => void; added: boolean }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={added ? () => navigate(`/episode/${episode.id}`) : undefined}
      className={`flex items-start gap-3 rounded-2xl border border-border bg-bg-surface p-3 pb-4 ${
        added ? "cursor-pointer hover:border-accent/60" : ""
      }`}
    >
      <EpisodeArtwork episode={episode} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[15px] font-medium leading-snug text-text-primary">
          {episode.title}
        </p>
        <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
        {episode.durationSec > 0 && (
          <p className="text-xs text-text-tertiary">{formatTime(episode.durationSec)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onAdd();
        }}
        disabled={added}
        className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
          added
            ? "bg-success/15 text-success"
            : "bg-accent text-white hover:bg-accent/90"
        }`}
      >
        {added ? "✓ Added" : "+ Add"}
      </button>
    </div>
  );
}

export function Library() {
  const location = useLocation();
  const requestedTab = (location.state as { tab?: TabKey } | null)?.tab;
  const [tab, setTab] = useState<TabKey>(
    requestedTab && TABS.some((t) => t.key === requestedTab) ? requestedTab : "episodes",
  );
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const storeNotes = useNotesStore((s) => s.notes);
  const episodes = useEpisodesStore((s) => s.episodes);
  const addEpisode = useEpisodesStore((s) => s.addEpisode);
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const folders = useFoldersStore((s) => s.folders);
  const addFolder = useFoldersStore((s) => s.addFolder);
  const renameFolder = useFoldersStore((s) => s.renameFolder);
  const deleteFolder = useFoldersStore((s) => s.deleteFolder);
  const { getProgressFor } = usePlayer();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderActionsOpen, setFolderActionsOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const folderActionsRef = useRef<HTMLDivElement>(null);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderEpisodes = selectedFolder
    ? episodes.filter((e) => selectedFolder.episodeIds.includes(e.id))
    : [];

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    addFolder(name);
    setNewFolderName("");
    setNewFolderOpen(false);
  };

  const closeFolderView = () => {
    setSelectedFolderId(null);
    setFolderActionsOpen(false);
    setRenamingFolder(false);
    setConfirmingDelete(false);
  };

  const handleRenameFolder = () => {
    const name = renameValue.trim();
    if (!name || !selectedFolder) return;
    renameFolder(selectedFolder.id, name);
    setRenamingFolder(false);
  };

  const handleDeleteFolder = () => {
    if (!selectedFolder) return;
    deleteFolder(selectedFolder.id);
    closeFolderView();
  };

  useEffect(() => {
    if (!folderActionsOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (folderActionsRef.current && !folderActionsRef.current.contains(e.target as Node)) {
        setFolderActionsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [folderActionsOpen]);

  const handleExportAll = () => {
    const markdown = buildLibraryMarkdown(episodes, storeNotes, exportFormat);
    downloadMarkdownFile(`podmark-export-${new Date().toISOString().slice(0, 10)}.md`, markdown);
  };

  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverResults, setDiscoverResults] = useState<Episode[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSearched, setDiscoverSearched] = useState(false);

  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubeAdded, setYoutubeAdded] = useState<Episode | null>(null);

  const addYoutubeVideo = async () => {
    const url = youtubeUrl.trim();
    if (!url) return;
    setYoutubeLoading(true);
    setYoutubeError(null);
    setYoutubeAdded(null);
    try {
      const episode = await fetchYouTubeEpisode(url);
      addEpisode(episode);
      setYoutubeAdded(episode);
      setYoutubeUrl("");
    } catch (err) {
      setYoutubeError(err instanceof Error ? err.message : "Couldn't add that YouTube video.");
    } finally {
      setYoutubeLoading(false);
    }
  };

  const runDiscoverSearch = async () => {
    const term = discoverQuery.trim();
    if (!term) return;
    setDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const results = await searchPodcastEpisodes(term);
      setDiscoverResults(results);
      setDiscoverSearched(true);
    } catch (err) {
      console.error("Podcast search failed:", err);
      setDiscoverError("Couldn't reach the podcast search service — check your connection and try again.");
    } finally {
      setDiscoverLoading(false);
    }
  };

  const allTags = useMemo(
    () => Array.from(new Set(episodes.flatMap((e) => e.tags))).sort(),
    [episodes],
  );

  const toggleTag = (tag: string) =>
    setActiveTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));

  const matchesFilters = (tags: string[], text: string) => {
    const matchesSearch = search.trim() === "" || text.toLowerCase().includes(search.toLowerCase());
    const matchesTags = activeTags.length === 0 || activeTags.some((t) => tags.includes(t));
    return matchesSearch && matchesTags;
  };

  // Not memoized: status depends on live playback progress, and the
  // Provider re-renders every ~1s while an episode plays, so this recomputes
  // on that cadence (not just on user-driven re-renders like a search
  // keystroke). The episode list is small, so that's cheap here, but don't
  // assume this only runs rarely.
  const visibleEpisodes = episodes
    .filter((e) => matchesFilters(e.tags, e.title))
    .sort(
      (a, b) =>
        STATUS_RANK[getEffectiveStatus(a, getProgressFor(a.id))] -
        STATUS_RANK[getEffectiveStatus(b, getProgressFor(b.id))],
    );
  const takeaways = useMemo(
    () => [...storeNotes].reverse().filter((n) => matchesFilters(n.tags, n.text)),
    [storeNotes, search, activeTags],
  );

  return (
    <div className="pb-40 md:pb-16">
      <div className="flex items-center justify-between px-5 pb-4 pt-[calc(env(safe-area-inset-top)+1rem)] md:px-0 md:pt-0">
        <h1 className="text-[28px] font-bold text-text-primary">Library</h1>
        <button
          type="button"
          onClick={handleExportAll}
          disabled={storeNotes.length === 0}
          title={storeNotes.length === 0 ? "No notes yet to export" : `Export all notes as Markdown (${exportFormat} format)`}
          className="text-sm font-medium text-accent disabled:cursor-not-allowed disabled:text-text-tertiary"
        >
          Export All ↗
        </button>
      </div>

      {/* The library-wide search and tag filters apply to your own episodes and
          notes, so on Discover (which searches elsewhere) they'd be dead
          controls sitting above a second search field. */}
      {tab !== "discover" && (
        <>
          <div className="px-5 md:px-0">
            <SearchBar value={search} onChange={setSearch} />
          </div>

          <div className="mt-3 flex max-w-full flex-nowrap gap-2 overflow-x-auto px-5 pb-1 no-scrollbar md:flex-wrap md:overflow-visible md:px-0">
            {allTags.map((tag) => (
              <TagChip
                key={tag}
                label={tag}
                active={activeTags.includes(tag)}
                onClick={() => toggleTag(tag)}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-3">
        <SegmentedTabSwitcher
          tabs={TABS}
          active={tab}
          onChange={(t) => {
            setTab(t);
            closeFolderView();
            setNewFolderOpen(false);
          }}
        />
      </div>

      <div className="mt-4 space-y-2.5 px-5 md:px-0">
        {tab === "episodes" &&
          (visibleEpisodes.length > 0 ? (
            visibleEpisodes.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)
          ) : (
            <EmptyState icon="🎧" text="No episodes match your search — try a different term or clear the tag filters." />
          ))}

        {tab === "folders" && selectedFolder && (
          <>
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={closeFolderView}
                className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-text-primary"
              >
                ← All Folders
              </button>
              <div className="relative" ref={folderActionsRef}>
                <button
                  type="button"
                  onClick={() => setFolderActionsOpen((v) => !v)}
                  className="rounded-lg px-2 text-lg text-text-secondary hover:text-text-primary"
                >
                  ⋯
                </button>
                {folderActionsOpen && (
                  <div className="absolute right-0 top-full z-20 mt-2 w-40 rounded-xl border border-border bg-bg-surface p-1.5 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setRenameValue(selectedFolder.name);
                        setRenamingFolder(true);
                        setFolderActionsOpen(false);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-text-primary hover:bg-bg-surface-alt"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(true);
                        setFolderActionsOpen(false);
                      }}
                      className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm text-red-400 hover:bg-bg-surface-alt"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {renamingFolder ? (
              <div className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-bg-surface p-3">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRenameFolder()}
                  placeholder="Folder name..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setRenamingFolder(false)}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRenameFolder}
                  disabled={!renameValue.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            ) : (
              <p className="text-[17px] font-semibold text-text-primary">{selectedFolder.name}</p>
            )}

            {confirmingDelete && (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3">
                <p className="text-[13px] text-text-primary">
                  Delete "{selectedFolder.name}"? Episodes stay in your library.
                </p>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteFolder}
                    className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {folderEpisodes.length > 0 ? (
              folderEpisodes.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)
            ) : (
              <EmptyState
                icon="📁"
                text="No episodes in this folder yet — add one from an episode's ⋯ menu."
              />
            )}
          </>
        )}

        {tab === "folders" && !selectedFolder && (
          <>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((f) => (
                <FolderCard key={f.id} folder={f} onClick={() => setSelectedFolderId(f.id)} />
              ))}
            </div>

            {newFolderOpen ? (
              <div className="flex items-center gap-2 rounded-2xl border border-accent/40 bg-bg-surface p-3">
                <input
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
                  placeholder="Folder name..."
                  className="min-w-0 flex-1 bg-transparent text-[14px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNewFolderOpen(false);
                    setNewFolderName("");
                  }}
                  className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setNewFolderOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-medium text-text-secondary hover:border-accent/60 hover:text-accent"
              >
                + New Folder
              </button>
            )}

            {folders.length === 0 && !newFolderOpen && (
              <EmptyState icon="📁" text="No custom folders yet." />
            )}
          </>
        )}
      </div>

      {tab === "takeaways" && (
        <div className="mt-1 space-y-2.5 px-5 md:px-0">
          {takeaways.length > 0 ? (
            takeaways.map((note) => <TakeawayCard key={note.id} note={note} />)
          ) : (
            <EmptyState icon="⭐" text="No takeaways yet — save your first highlight." />
          )}
        </div>
      )}

      {tab === "discover" && (
        <div className="mt-1 px-5 md:px-0">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            Add a YouTube video
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addYoutubeVideo();
            }}
            className="flex gap-2"
          >
            <div className="flex-1">
              <SearchBar
                value={youtubeUrl}
                onChange={setYoutubeUrl}
                placeholder="Paste a YouTube URL..."
                icon="🔗"
              />
            </div>
            <button
              type="submit"
              disabled={youtubeLoading || !youtubeUrl.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {youtubeLoading ? "Adding…" : "Add"}
            </button>
          </form>

          {youtubeError && <p className="mt-3 text-sm text-text-secondary">{youtubeError}</p>}

          {youtubeAdded && (
            <div className="mt-3">
              <DiscoverResultCard episode={youtubeAdded} added onAdd={() => {}} />
            </div>
          )}

          <div className="my-4 border-t border-border" />

          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-tertiary">
            Search podcasts
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runDiscoverSearch();
            }}
            className="flex gap-2"
          >
            <div className="flex-1">
              <SearchBar
                value={discoverQuery}
                onChange={setDiscoverQuery}
                placeholder="Search real podcasts & episodes..."
              />
            </div>
            <button
              type="submit"
              disabled={discoverLoading || !discoverQuery.trim()}
              className="shrink-0 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
            >
              {discoverLoading ? "Searching…" : "Search"}
            </button>
          </form>

          {discoverError && (
            <p className="mt-3 text-sm text-text-secondary">{discoverError}</p>
          )}

          {discoverLoading && (
            <div className="mt-3 space-y-2.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="flex animate-pulse items-center gap-3 rounded-2xl border border-border bg-bg-surface p-3"
                >
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-bg-surface-alt" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-bg-surface-alt" />
                    <div className="h-3 w-1/2 rounded bg-bg-surface-alt" />
                  </div>
                  <div className="h-7 w-16 shrink-0 rounded-lg bg-bg-surface-alt" />
                </div>
              ))}
            </div>
          )}

          {!discoverLoading && (
            <div className="mt-3 space-y-2.5">
              {discoverResults.map((ep) => (
                <DiscoverResultCard
                  key={ep.id}
                  episode={ep}
                  added={episodes.some((e) => e.id === ep.id)}
                  onAdd={() => addEpisode(ep)}
                />
              ))}
            </div>
          )}

          {discoverSearched && !discoverLoading && discoverResults.length === 0 && !discoverError && (
            <EmptyState icon="🔍" text="No episodes found for that search — try a different term." />
          )}

          {!discoverSearched && !discoverLoading && (
            <p className="mt-6 text-center text-sm text-text-tertiary">
              Search real podcasts via iTunes — added episodes play with real audio. YouTube videos
              are saved for notes and AI summary, and play on YouTube.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
