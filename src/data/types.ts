export type EpisodeStatus = "in-progress" | "finished" | "not-started";

export interface Episode {
  id: string;
  title: string;
  show: string;
  artworkGradient: string; // CSS gradient placeholder in lieu of real artwork
  durationSec: number;
  progressSec: number;
  status: EpisodeStatus;
  tags: string[];
  publishedAt: string;
}

export type NoteBlockType = "timestamp-note" | "highlight";

export interface NoteBlock {
  id: string;
  episodeId: string;
  type: NoteBlockType;
  timestampSec: number;
  text: string;
  tags: string[];
  createdAt: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  episodeIds: string[];
}

export interface DailyGoal {
  targetMinutes: number;
  todayMinutes: number;
  last7Days: number[]; // minutes per day, oldest first
}
