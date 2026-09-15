import { create } from "zustand";
import { persist } from "zustand/middleware";
import { folders as seedFolders } from "../data/mockData";
import type { Folder } from "../data/types";

const FOLDER_COLORS = ["#6366F1", "#EC4899", "#22C55E", "#F59E0B", "#06B6D4"];

interface FoldersState {
  folders: Folder[];
  addFolder: (name: string) => void;
  renameFolder: (folderId: string, name: string) => void;
  deleteFolder: (folderId: string) => void;
  addEpisodeToFolder: (folderId: string, episodeId: string) => void;
  removeEpisodeFromFolder: (folderId: string, episodeId: string) => void;
  removeEpisodeEverywhere: (episodeId: string) => void;
}

function generateFolderId(): string {
  return `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const FOLDERS_VERSION = 2;
const SEED_FOLDER_IDS = new Set(seedFolders.map((f) => f.id));

export const useFoldersStore = create<FoldersState>()(
  persist(
    (set) => ({
      folders: import.meta.env.DEV ? seedFolders : [],
      addFolder: (name) =>
        set((state) => ({
          folders: [
            ...state.folders,
            {
              id: generateFolderId(),
              name,
              color: FOLDER_COLORS[state.folders.length % FOLDER_COLORS.length],
              episodeIds: [],
              updatedAt: new Date().toISOString(),
            },
          ],
        })),
      renameFolder: (folderId, name) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId ? { ...f, name, updatedAt: new Date().toISOString() } : f,
          ),
        })),
      deleteFolder: (folderId) =>
        set((state) => ({ folders: state.folders.filter((f) => f.id !== folderId) })),
      addEpisodeToFolder: (folderId, episodeId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId && !f.episodeIds.includes(episodeId)
              ? { ...f, episodeIds: [...f.episodeIds, episodeId], updatedAt: new Date().toISOString() }
              : f,
          ),
        })),
      removeEpisodeFromFolder: (folderId, episodeId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId
              ? {
                  ...f,
                  episodeIds: f.episodeIds.filter((id) => id !== episodeId),
                  updatedAt: new Date().toISOString(),
                }
              : f,
          ),
        })),
      removeEpisodeEverywhere: (episodeId) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.episodeIds.includes(episodeId)
              ? {
                  ...f,
                  episodeIds: f.episodeIds.filter((id) => id !== episodeId),
                  updatedAt: new Date().toISOString(),
                }
              : f,
          ),
        })),
    }),
    {
      name: "podmark-folders",
      version: FOLDERS_VERSION,
      migrate: (persistedState, version) => {
        const state = persistedState as FoldersState;
        if (version < 1 && Array.isArray(state?.folders)) {
          state.folders = state.folders.map((f) => ({
            ...f,
            updatedAt: f.updatedAt ?? new Date(0).toISOString(),
          }));
        }
        if (version < 2 && !import.meta.env.DEV && Array.isArray(state?.folders)) {
          state.folders = state.folders.filter((f) => !SEED_FOLDER_IDS.has(f.id));
        }
        return state;
      },
    },
  ),
);
