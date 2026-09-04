export type EpisodeStatus = "in-progress" | "finished" | "not-started";

export interface Episode {
  id: string;
  title: string;
  show: string;
  artworkGradient: string; // CSS gradient placeholder in lieu of real artwork
  artworkImageUrl?: string; // real episode/show artwork, when available (overrides artworkGradient)
  durationSec: number;
  progressSec: number;
  status: EpisodeStatus;
  tags: string[];
  publishedAt: string;
  audioUrl?: string; // real audio file URL — when present, PlayerContext uses a real <audio> element instead of the simulated timer
  description?: string; // show notes / episode description, used as grounding content for AI summarization
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
