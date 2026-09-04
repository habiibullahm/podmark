import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { folders } from "../data/mockData";
import { useNotesStore } from "../store/useNotesStore";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { searchPodcastEpisodes } from "../lib/itunesApi";
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

type TabKey = "in-progress" | "finished" | "takeaways" | "folders" | "discover";

const TABS: { key: TabKey; label: string }[] = [
  { key: "in-progress", label: "In Progress" },
  { key: "finished", label: "Finished" },
  { key: "takeaways", label: "Key Takeaways" },
  { key: "folders", label: "Custom Folders" },
  { key: "discover", label: "Discover" },
];

function DiscoverResultCard({ episode, onAdd, added }: { episode: Episode; onAdd: () => void; added: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-bg-surface p-3">
      <EpisodeArtwork episode={episode} className="h-12 w-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[14px] font-medium leading-snug text-text-primary">
          {episode.title}
        </p>
        <p className="line-clamp-1 text-xs text-text-secondary">{episode.show}</p>
        {episode.durationSec > 0 && (
          <p className="text-xs text-text-tertiary">{formatTime(episode.durationSec)}</p>
        )}
      </div>
      <button
        type="button"
        onClick={onAdd}
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
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("in-progress");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const storeNotes = useNotesStore((s) => s.notes);
  const episodes = useEpisodesStore((s) => s.episodes);
  const addEpisode = useEpisodesStore((s) => s.addEpisode);
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const { getProgressFor } = usePlayer();

  const handleExportAll = () => {
    const markdown = buildLibraryMarkdown(episodes, storeNotes, exportFormat);
    downloadMarkdownFile(`podmark-export-${new Date().toISOString().slice(0, 10)}.md`, markdown);
  };

  const [discoverQuery, setDiscoverQuery] = useState("");
  const [discoverResults, setDiscoverResults] = useState<Episode[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [discoverSearched, setDiscoverSearched] = useState(false);

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
  const inProgress = episodes.filter(
    (e) =>
      getEffectiveStatus(e, getProgressFor(e.id)) === "in-progress" &&
      matchesFilters(e.tags, e.title),
  );
  const finished = episodes.filter(
    (e) =>
      getEffectiveStatus(e, getProgressFor(e.id)) === "finished" &&
      matchesFilters(e.tags, e.title),
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

      <SearchBar value={search} onChange={setSearch} />

      <div className="mt-3 flex max-w-full flex-nowrap gap-2 overflow-x-auto px-5 pb-1 no-scrollbar md:flex-wrap md:overflow-visible md:px-0">
        {allTags.map((tag) => (
          <TagChip key={tag} label={tag} active={activeTags.includes(tag)} onClick={() => toggleTag(tag)} />
        ))}
      </div>

      <div className="mt-3">
        <SegmentedTabSwitcher tabs={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-4 space-y-2.5 px-5 md:px-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
        {tab === "in-progress" &&
          (inProgress.length > 0 ? (
            inProgress.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)
          ) : (
            <EmptyState icon="🎧" text="Nothing in progress — start an episode from the Dashboard." />
          ))}

        {tab === "finished" &&
          (finished.length > 0 ? (
            finished.map((ep) => <EpisodeCard key={ep.id} episode={ep} />)
          ) : (
            <EmptyState icon="✅" text="No finished episodes yet." />
          ))}

        {tab === "folders" &&
          (folders.length > 0 ? (
            <>
              {folders.map((f) => (
                <FolderCard key={f.id} folder={f} onClick={() => navigate("/library")} />
              ))}
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-4 text-sm font-medium text-text-secondary hover:border-accent/60 hover:text-accent"
              >
                + New Folder
              </button>
            </>
          ) : (
            <EmptyState icon="📁" text="No custom folders yet." />
          ))}
      </div>

      {tab === "takeaways" && (
        <div className="mt-1 grid grid-cols-1 gap-2.5 px-5 md:px-0 lg:grid-cols-2 xl:grid-cols-3">
          {takeaways.length > 0 ? (
            takeaways.map((note) => <TakeawayCard key={note.id} note={note} />)
          ) : (
            <EmptyState icon="⭐" text="No takeaways yet — save your first highlight." />
          )}
        </div>
      )}

      {tab === "discover" && (
        <div className="mt-1 px-5 md:px-0">
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

          <div className="mt-3 space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
            {discoverResults.map((ep) => (
              <DiscoverResultCard
                key={ep.id}
                episode={ep}
                added={episodes.some((e) => e.id === ep.id)}
                onAdd={() => addEpisode(ep)}
              />
            ))}
          </div>

          {discoverSearched && !discoverLoading && discoverResults.length === 0 && !discoverError && (
            <EmptyState icon="🔍" text="No episodes found for that search — try a different term." />
          )}

          {!discoverSearched && !discoverLoading && (
            <p className="mt-6 text-center text-sm text-text-tertiary">
              Search real podcasts via iTunes — added episodes play with real audio.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
