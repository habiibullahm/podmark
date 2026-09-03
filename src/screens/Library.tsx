import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { allTags, episodes, folders } from "../data/mockData";
import { useNotesStore } from "../store/useNotesStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { SearchBar } from "../components/SearchBar";
import { SegmentedTabSwitcher } from "../components/SegmentedTabSwitcher";
import { TagChip } from "../components/TagChip";
import { EpisodeCard } from "../components/EpisodeCard";
import { TakeawayCard } from "../components/TakeawayCard";
import { FolderCard } from "../components/FolderCard";
import { EmptyState } from "../components/EmptyState";

type TabKey = "in-progress" | "finished" | "takeaways" | "folders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "in-progress", label: "In Progress" },
  { key: "finished", label: "Finished" },
  { key: "takeaways", label: "Key Takeaways" },
  { key: "folders", label: "Custom Folders" },
];

export function Library() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("in-progress");
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const storeNotes = useNotesStore((s) => s.notes);
  const { getProgressFor } = usePlayer();

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
  // keystroke). The mock episode list is tiny, so that's cheap here, but
  // don't assume this only runs rarely.
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
        <button type="button" className="text-sm font-medium text-accent">
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
    </div>
  );
}
