import { Folder as FolderIcon } from "lucide-react";
import type { Folder } from "../data/types";
import { CARD_INTERACTIVE } from "../lib/ui";

export function FolderCard({ folder, onClick }: { folder: Folder; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD_INTERACTIVE} flex w-full items-center gap-3.5 p-4 text-left`}
    >
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
        style={{ backgroundColor: `${folder.color}22`, color: folder.color }}
      >
        <FolderIcon size={20} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-bold text-text-primary">{folder.name}</span>
        <span className="block text-xs text-text-secondary">
          {folder.episodeIds.length} item{folder.episodeIds.length === 1 ? "" : "s"}
        </span>
      </span>
    </button>
  );
}
