import { create } from "zustand";
import { persist } from "zustand/middleware";
import { folders as seedFolders } from "../data/mockData";
import type { Folder } from "../data/types";

const FOLDER_COLORS = ["#6366F1", "#EC4899", "#22C55E", "#F59E0B", "#06B6D4"];

interface FoldersState {
  folders: Folder[];
  addFolder: (name: string) => void;
  addEpisodeToFolder: (folderId: string, episodeId: string) => void;
  removeEpisodeFromFolder: (folderId: string, episodeId: string) => void;
}

function generateFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export const useFoldersStore = create<FoldersState>()(
  persist(
    (set) => ({
      folders: seedFolders,
      addFolder: (name) =>
        set((state) => ({
          folders: [
            ...state.folders,
            {
              id: generateFolderId(),
              name,
              color: FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length],
              episodeIds: [],
            },
          ],
        })),
      addEpisodeToFolder: (folderId, episodeId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId && !f.episodeIds.includes(episodeId)
              ? { ...f, episodeIds: [...f.episodeIds, episodeId] }
              : f,
          ),
        })),
      removeEpisodeFromFolder: (folderId, episodeId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId ? { ...f, episodeIds: f.episodeIds.filter((id) => id !== episodeId) } : f,
          ),
        })),
    }),
    { name: "podmark-folders" },
  ),
);
