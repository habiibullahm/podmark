import type { DailyGoal, Episode, Folder, NoteBlock } from "./types";

export const episodes: Episode[] = [
  {
    id: "ep-1",
    title: "Building a Second Brain: The Case for Structured Notes",
    show: "The Knowledge Project",
    artworkGradient: "linear-gradient(135deg, #6366F1, #312E81)",
    durationSec: 41 * 60,
    progressSec: 23 * 60 + 10,
    status: "in-progress",
    tags: ["productivity", "mindset"],
    publishedAt: "2026-08-28",
  },
  {
    id: "ep-2",
    title: "How Transformers Actually Work, Explained Simply",
    show: "Tech Deep Dive",
    artworkGradient: "linear-gradient(135deg, #22C55E, #14532D)",
    durationSec: 52 * 60,
    progressSec: 18 * 60,
    status: "in-progress",
    tags: ["ai", "coding"],
    publishedAt: "2026-08-25",
  },
  {
    id: "ep-3",
    title: "The Psychology of Compounding Habits",
    show: "Mindset Lab",
    artworkGradient: "linear-gradient(135deg, #F59E0B, #7C2D12)",
    durationSec: 36 * 60,
    progressSec: 36 * 60,
    status: "finished",
    tags: ["mindset", "productivity"],
    publishedAt: "2026-08-20",
  },
  {
    id: "ep-4",
    title: "Reading Financial Statements Like an Investor",
    show: "Business Basics",
    artworkGradient: "linear-gradient(135deg, #EC4899, #831843)",
    durationSec: 47 * 60,
    progressSec: 0,
    status: "not-started",
    tags: ["finance", "business"],
    publishedAt: "2026-08-18",
  },
  {
    id: "ep-5",
    title: "Designing APIs That Don't Rot",
    show: "Tech Deep Dive",
    artworkGradient: "linear-gradient(135deg, #22C55E, #14532D)",
    durationSec: 39 * 60,
    progressSec: 39 * 60,
    status: "finished",
    tags: ["coding", "ai"],
    publishedAt: "2026-08-10",
  },
];

export const noteBlocks: NoteBlock[] = [
  {
    id: "note-1",
    episodeId: "ep-1",
    type: "highlight",
    timestampSec: 12 * 60 + 34,
    text: "You don't rise to the level of your goals, you fall to the level of your systems — and your notes are your system.",
    tags: ["productivity"],
    createdAt: "2026-08-29",
  },
  {
    id: "note-2",
    episodeId: "ep-1",
    type: "timestamp-note",
    timestampSec: 15 * 60 + 2,
    text: "Three-tier note system: capture -> distill -> express. Most people stop at capture.",
    tags: ["productivity"],
    createdAt: "2026-08-29",
  },
  {
    id: "note-3",
    episodeId: "ep-2",
    type: "highlight",
    timestampSec: 8 * 60 + 45,
    text: "Attention isn't a mechanism, it's a learned weighting over every other token in the sequence.",
    tags: ["ai"],
    createdAt: "2026-08-26",
  },
  {
    id: "note-4",
    episodeId: "ep-3",
    type: "highlight",
    timestampSec: 22 * 60 + 10,
    text: "Identity-based habits stick because you're not chasing an outcome, you're casting a vote for who you want to be.",
    tags: ["mindset"],
    createdAt: "2026-08-21",
  },
  {
    id: "note-5",
    episodeId: "ep-5",
    type: "timestamp-note",
    timestampSec: 5 * 60 + 20,
    text: "Version APIs at the boundary, not internally. Internal churn shouldn't break external contracts.",
    tags: ["coding"],
    createdAt: "2026-08-11",
  },
];

export const folders: Folder[] = [
  { id: "folder-1", name: "Q3 Learning Sprint", color: "#6366F1", episodeIds: ["ep-1", "ep-2"] },
  { id: "folder-2", name: "Investing Basics", color: "#EC4899", episodeIds: ["ep-4"] },
];

export const dailyGoal: DailyGoal = {
  targetMinutes: 30,
  todayMinutes: 18,
  last7Days: [22, 30, 12, 30, 25, 8, 18],
};

export const allTags = Array.from(
  new Set(episodes.flatMap((e) => e.tags)),
).sort();
