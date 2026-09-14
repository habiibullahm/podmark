import type { Folder } from "../data/types";

export function FolderCard({
  folder,
  onClick,
}: {
  folder: Folder;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-bg-surface p-3.5 text-left"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style={{ backgroundColor: `${folder.color}26` }}
      >
        📁
      </div>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-medium text-text-primary">{folder.name}</p>
        <p className="text-xs text-text-secondary">
          {folder.episodeIds.length} item{folder.episodeIds.length === 1 ? "" : "s"}
        </p>
      </div>
    </button>
  );
}
