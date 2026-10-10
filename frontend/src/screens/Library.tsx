import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Ellipsis, FolderOpen, FolderPlus, Headphones, Pencil, Quote, SearchX, Trash2 } from "lucide-react";
import { useNotesStore } from "../store/useNotesStore";
import { useEpisodesStore } from "../store/useEpisodesStore";
import { useSettingsStore } from "../store/useSettingsStore";
import { useFoldersStore } from "../store/useFoldersStore";
import { usePlayer } from "../context/PlayerContext";
import { getEffectiveStatus } from "../lib/episodes";
import { buildLibraryMarkdown, downloadMarkdownFile, hasMeaningfulFreeformNotes } from "../lib/export";
import { useAllKnownTags } from "../lib/useAllTags";
import { BUTTON_DANGER, BUTTON_GHOST, BUTTON_PRIMARY, BUTTON_SECONDARY, CARD, MENU, MENU_ITEM } from "../lib/ui";
import { PageHeader } from "../components/PageHeader";
import { SearchInput } from "../components/SearchInput";
import { SegmentedTabSwitcher } from "../components/SegmentedTabSwitcher";
import { TagChip } from "../components/TagChip";
import { EpisodeCard } from "../components/EpisodeCard";
import { TakeawayCard } from "../components/TakeawayCard";
import { FolderCard } from "../components/FolderCard";
import { EmptyState } from "../components/EmptyState";

type TabKey = "episodes" | "takeaways" | "folders";

const TABS: { key: TabKey; label: string }[] = [
  { key: "episodes", label: "Episodes" },
  { key: "takeaways", label: "Takeaways" },
  { key: "folders", label: "Folders" },
];

// In-progress episodes surface first (most actionable), then not-started,
// then finished ones sink to the bottom — otherwise a unified list would
// bury what the user is actually likely to want next under old completions.
const STATUS_RANK: Record<string, number> = { "in-progress": 0, "not-started": 1, finished: 2 };

function NameForm({
  initial = "",
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: string;
  submitLabel: string;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
      className={`${CARD} flex items-center gap-2 border-accent/40 p-2.5`}
    >
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Folder name..."
        aria-label="Folder name"
        className="min-w-0 flex-1 bg-transparent px-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
      />
      <button type="button" onClick={onCancel} className={`${BUTTON_GHOST} px-2.5 py-1.5 text-xs`}>
        Cancel
      </button>
      <button type="submit" disabled={!value.trim()} className={`${BUTTON_PRIMARY} px-3 py-1.5 text-xs`}>
        {submitLabel}
      </button>
    </form>
  );
}

export function Library() {
  const location = useLocation();
  const navigate = useNavigate();
  const requestedTab = (location.state as { tab?: TabKey } | null)?.tab;
  const [tab, setTab] = useState<TabKey>(
    requestedTab && TABS.some((t) => t.key === requestedTab) ? requestedTab : "episodes",
  );
  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const storeNotes = useNotesStore((s) => s.notes);
  const freeformNotes = useNotesStore((s) => s.freeformNotes);
  const aiSummaries = useNotesStore((s) => s.aiSummaries);
  const episodes = useEpisodesStore((s) => s.episodes);
  const exportFormat = useSettingsStore((s) => s.exportFormat);
  const folders = useFoldersStore((s) => s.folders);
  const addFolder = useFoldersStore((s) => s.addFolder);
  const renameFolder = useFoldersStore((s) => s.renameFolder);
  const deleteFolder = useFoldersStore((s) => s.deleteFolder);
  const { getProgressFor } = usePlayer();

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [folderActionsOpen, setFolderActionsOpen] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const folderActionsRef = useRef<HTMLDivElement>(null);
  const selectedFolder = folders.find((f) => f.id === selectedFolderId) ?? null;
  const folderEpisodes = selectedFolder ? episodes.filter((e) => selectedFolder.episodeIds.includes(e.id)) : [];

  const closeFolderView = () => {
    setSelectedFolderId(null);
    setFolderActionsOpen(false);
    setRenamingFolder(false);
    setConfirmingDelete(false);
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

  const hasExportableContent =
    storeNotes.length > 0 ||
    Object.values(freeformNotes).some(hasMeaningfulFreeformNotes) ||
    Object.values(aiSummaries).some((bullets) => bullets.length > 0);

  const handleExportAll = () => {
    const markdown = buildLibraryMarkdown(episodes, storeNotes, exportFormat, freeformNotes, aiSummaries);
    downloadMarkdownFile(`podmark-export-${new Date().toISOString().slice(0, 10)}.md`, markdown);
  };

  const allTags = useAllKnownTags();

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
    <div>
      <PageHeader
        title="Library"
        subtitle={`${episodes.length} episode${episodes.length === 1 ? "" : "s"} · ${storeNotes.length} takeaway${storeNotes.length === 1 ? "" : "s"}`}
        actions={
          <button
            type="button"
            onClick={handleExportAll}
            disabled={!hasExportableContent}
            title={!hasExportableContent ? "No notes yet to export" : `Export all notes as Markdown (${exportFormat} format)`}
            className={BUTTON_SECONDARY}
          >
            <Download size={16} aria-hidden="true" />
            Export all
          </button>
        }
      />

      {/* Tabs lead, because the search and tag filters below them are scoped to
          whichever tab is selected. */}
      <SegmentedTabSwitcher
        tabs={TABS}
        active={tab}
        onChange={(t) => {
          setTab(t);
          closeFolderView();
          setNewFolderOpen(false);
        }}
      />

      {/* These filters apply to episodes and takeaways. On Folders (which
          filters nothing there) they'd be dead controls. */}
      {(tab === "episodes" || tab === "takeaways") && (
        <div className="mt-4 space-y-3">
          <SearchInput value={search} onChange={setSearch} />
          {allTags.length > 0 && (
            <div
              className="-mx-4 flex max-w-[100vw] flex-nowrap gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
              aria-label="Filter by tag"
            >
              {allTags.map((tag) => (
                <TagChip key={tag} label={tag} size="md" active={activeTags.includes(tag)} onClick={() => toggleTag(tag)} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-5">
        {tab === "episodes" &&
          (visibleEpisodes.length > 0 ? (
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleEpisodes.map((ep) => (
                <EpisodeCard key={ep.id} episode={ep} />
              ))}
            </div>
          ) : episodes.length === 0 ? (
            <EmptyState
              icon={Headphones}
              text="Your library is empty — find a real episode to get started."
              actionLabel="Find your first episode"
              onAction={() => navigate("/discover")}
            />
          ) : (
            <EmptyState icon={SearchX} text="No episodes match your search — try a different term or clear the tag filters." />
          ))}

        {tab === "takeaways" &&
          (takeaways.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {takeaways.map((note) => (
                <TakeawayCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Quote} text="No takeaways yet — save your first highlight." />
          ))}

        {tab === "folders" && selectedFolder && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button type="button" onClick={closeFolderView} className={`${BUTTON_GHOST} -ml-3`}>
                <ArrowLeft size={16} aria-hidden="true" />
                All Folders
              </button>
              <div className="relative" ref={folderActionsRef}>
                <button
                  type="button"
                  onClick={() => setFolderActionsOpen((v) => !v)}
                  aria-label="Folder options"
                  aria-expanded={folderActionsOpen}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary hover:bg-bg-surface-alt hover:text-text-primary"
                >
                  <Ellipsis size={18} aria-hidden="true" />
                </button>
                {folderActionsOpen && (
                  <div className={`${MENU} w-40`}>
                    <button
                      type="button"
                      onClick={() => {
                        setRenamingFolder(true);
                        setFolderActionsOpen(false);
                      }}
                      className={MENU_ITEM}
                    >
                      <Pencil size={15} aria-hidden="true" />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmingDelete(true);
                        setFolderActionsOpen(false);
                      }}
                      className={`${MENU_ITEM} text-danger`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>

            {renamingFolder ? (
              <NameForm
                initial={selectedFolder.name}
                submitLabel="Save"
                onCancel={() => setRenamingFolder(false)}
                onSubmit={(name) => {
                  renameFolder(selectedFolder.id, name);
                  setRenamingFolder(false);
                }}
              />
            ) : (
              <h2 className="text-xl font-extrabold tracking-tight text-text-primary">{selectedFolder.name}</h2>
            )}

            {confirmingDelete && (
              <div className="flex items-center justify-between gap-3 rounded-control border border-danger/40 bg-danger/5 p-3">
                <p className="text-[13px] text-text-primary">
                  Delete "{selectedFolder.name}"? Episodes stay in your library.
                </p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => setConfirmingDelete(false)} className={`${BUTTON_GHOST} px-2.5 py-1.5 text-xs`}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteFolder(selectedFolder.id);
                      closeFolderView();
                    }}
                    className={BUTTON_DANGER}
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}

            {folderEpisodes.length > 0 ? (
              <div className="grid gap-3 xl:grid-cols-2">
                {folderEpisodes.map((ep) => (
                  <EpisodeCard key={ep.id} episode={ep} />
                ))}
              </div>
            ) : (
              <EmptyState icon={FolderOpen} text="No episodes in this folder yet — add one from an episode's options menu." />
            )}
          </div>
        )}

        {tab === "folders" && !selectedFolder && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {folders.map((f) => (
                <FolderCard key={f.id} folder={f} onClick={() => setSelectedFolderId(f.id)} />
              ))}
            </div>

            {newFolderOpen ? (
              <NameForm
                submitLabel="Create"
                onCancel={() => setNewFolderOpen(false)}
                onSubmit={(name) => {
                  addFolder(name);
                  setNewFolderOpen(false);
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setNewFolderOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-border py-4 text-sm font-semibold text-text-secondary transition-colors hover:border-accent/60 hover:text-accent"
              >
                <FolderPlus size={16} aria-hidden="true" />
                New Folder
              </button>
            )}

            {folders.length === 0 && !newFolderOpen && <EmptyState icon={FolderOpen} text="No custom folders yet." />}
          </div>
        )}
      </div>
    </div>
  );
}
