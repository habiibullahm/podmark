# PodMark — Product Requirements

**Version** 1.0 · **Date** 15 Sep 2026 · **Status** Draft for review · **Codebase** `dc06b68` · **Live** podbrain-five.vercel.app

A podcast tracker and learning journal. This document reviews the shipped prototype flow by flow, defines the product it should become, and prioritises the gap between the two.

Published, shareable version: https://claude.ai/code/artifact/498b22cb-79ed-4171-9cc9-41ccaa7a78f7

---

## 01 · Executive summary

PodMark is a working prototype of a note-taking-first podcast app: find real episodes, listen, capture timestamped notes and highlights, get an AI summary, and export to Obsidian or Notion. The core loop is real — real iTunes search, real audio, real AI summaries via Groq, real streak and listening-minute tracking — and every screen renders honest data with no mock numbers left.

It is not yet a product. Three things stand between it and an MVP that a person other than its author would keep using:

- **It lives on one device.** Everything is browser `localStorage`. There is no account, no sync, and the profile is a hard-coded "Alex". A second device, a cleared cache, or a new phone means a blank app.
- **The library only grows.** Episodes can't be removed, notes can't be edited or deleted, AI summaries can't be cleared. Every action is permanent.
- **The AI summary is grounded in show notes, not the episode.** It works, but it summarises what the publisher wrote, not what was said. The competitors that win here transcribe the audio.

> **Recommendation.** Define MVP as "a learner can use PodMark as their only podcast note-taker for a month without losing anything." That means accounts and sync, full CRUD on the library, and audio transcription for podcast episodes — in that order. YouTube stays notes-only; the effort to auto-summarise it isn't justified for a podcast product (see §09).

---

## 02 · Product definition

### Problem

People who listen to educational podcasts — business, technology, self-improvement — retain very little of what they hear. Podcast players are built for playback, not learning: notes live in a separate app, timestamps are lost, and there's no way back to the moment an idea landed. Note-taking apps have the opposite problem: no player, no timeline, no context.

### Who it's for

**The learner-listener.** Listens to two to five long-form episodes a week, mostly non-fiction. Already keeps a second brain in Obsidian or Notion and wants podcast insights to land there with a timestamp attached. Values a habit streak. Will tolerate a lightweight PWA over a native app if it respects their existing tools.

The seeded content (*The Knowledge Project*, *Tech Deep Dive*, *Mindset Lab*, *Business Basics*) and the Obsidian/Notion export both already assume this person. The product should stop pretending to be a general podcast player and lean into it.

### Jobs to be done

| When I… | I want to… | So that… | Today |
|---|---|---|---|
| hear an idea worth keeping | capture it with the exact timestamp, in one tap | I can return to that moment later | ✅ Shipped |
| finish an episode | get a short summary of what was actually said | I can review without relistening | ⚠️ Partial — show-notes only |
| sit down to review | see my notes across episodes, by tag or search | ideas connect across shows | ✅ Shipped |
| want it in my second brain | export clean Markdown to Obsidian or Notion | it lives with everything else I know | ⚠️ Partial — omits freeform notes & summaries |
| want to keep the habit | see a streak and a daily goal | I listen with intent, not passively | ✅ Shipped |
| switch devices | have everything there | I don't hesitate to use it | ❌ Missing |
| change my mind | remove an episode, fix a note | the library stays mine | ❌ Missing |

### Positioning

| Product | What it is | How it gets transcripts | PodMark's angle |
|---|---|---|---|
| **Snipd** | AI-first podcast player; the direct competitor | Transcribes audio itself; imports YouTube by extracting audio server-side | Lighter, export-first, no lock-in. Must match on transcription to compete |
| **Podwise** | Summariser with mind maps; no player | Transcribes audio from RSS, links, or uploads | PodMark has the listening loop Podwise lacks |
| **Apple Podcasts / Spotify** | Platform players | First-party transcripts of their own catalogue | No note-taking, no export. PodMark is the layer on top |

**Wedge:** the only podcast app whose primary output is Markdown in *your* tools, with a habit layer. **Table stakes it's missing:** transcription and sync.

---

## 03 · Where it stands

An honest scorecard of the shipped prototype. "Shipped" means real and verified.

| Area | Status | Notes |
|---|---|---|
| Discover | ✅ Shipped | Real iTunes episode search (20 results). Paste a YouTube link to look it up. One smart field; adding is an explicit second step. |
| Playback | ✅ Shipped | Real audio for iTunes episodes; ±15s, 1–2× speed, seek, resume position. Persistent mini player and full-screen view. |
| Notes & highlights | ⚠️ Partial | Timestamped notes and quote highlights, plus a freeform Markdown editor per episode. No edit, no delete, tags limited to the episode's own. |
| AI summary | ⚠️ Partial | Real Groq call, 3–5 bullets, insert into notes, retry on error. Grounded in show notes, not the audio. |
| Library & folders | ⚠️ Partial | Search, tag filter, status-sorted list, folders with create/rename/delete. Filters show on Folders tab but don't apply there; nothing can be removed. |
| Streak & goal | ✅ Shipped | Real listened minutes per day (wall-clock, 1-minute threshold), today-or-yesterday streak rule, 7-day chart, adjustable goal. |
| Insights | ✅ Shipped | Streak, finished count, note count, top tag, weekly chart, most-used tags, notes per episode — all live. |
| Export | ⚠️ Partial | Markdown of all timestamped notes, Obsidian frontmatter optional. Freeform notes and AI summaries are left out. |
| YouTube | ✅ Shipped | Deliberately notes-only: Watch on YouTube, highlights, notes. No fake playback, no summary it can't ground. |
| Account & sync | ❌ Not built | No sign-in. Identity is a hard-coded "Alex". All seven stores are localStorage on one device. |
| Notifications | ❌ Not built | The "Daily reminder" toggle persists a boolean that nothing reads. |
| Offline | ❌ Not built | PWA shell is precached; search, AI, audio and artwork all need a connection with no handling. |

Test coverage: 102 Playwright end-to-end tests across desktop and mobile Chrome, all passing at the reviewed commit.

---

## 04 · User flow review

The five flows a learner actually runs, as the code implements them today. ⚑ marks friction or a dead end.

### Flow A — First open

1. App opens on the Dashboard as "Alex" with a 🔥 0 streak. Five seeded episodes, five notes and two folders are already in the library. There is no onboarding, no explanation that these are examples, and no way to clear them. **⚑ A new user's first impression is someone else's half-finished library.**
2. "Currently learning" shows the first in-progress seeded episode with Resume Listening and Jump to Notes.
3. Nothing prompts the user toward Discover, the one place they can add their own content.

### Flow B — Find and add a real episode

1. Library → Discover. One field: type words to search iTunes, or paste a YouTube link to look it up. The icon and button switch as you type.
2. Search returns up to 20 episode cards with artwork, show and duration. **⚑ No show-level results, no pagination, no filtering. You can't follow a show or see its latest episodes — every episode is found one at a time.**
3. "+ Add to Library" adds it; the button becomes "✓ In Library" and opens the episode. Duplicates are silently ignored.
4. The new episode appears at the top of Episodes as "not started". Its genres become tag chips in the filter row.

### Flow C — Listen and capture

1. Opening an episode loads it into the mini player, paused. Dashboard's Resume/Start Listening loads it playing.
2. "+ Add Timestamp Note" or "+ Save Key Highlight" opens a two-line capture form stamped with the current position and a tag picker. **⚑ The tag picker only offers the episode's own tags — often two, sometimes none. There is no way to type a new tag.**
3. Notes list below in timestamp order; tapping a 🕐 chip seeks the player to that moment. Freeform Markdown notes live in an Edit/Preview editor and save on every keystroke.
4. The mini player persists across every screen. **⚑ It can't be dismissed. Once anything is loaded, it's there until the tab closes.**
5. Each real minute of playback counts toward today's goal and, past one minute, the streak.

### Flow D — Summarise and review

1. "✨ AI Summarize Episode" sends the title, show and description to Groq and renders 3–5 bullets with "+ Add to notes" on each. Errors show a message and "Try again". **⚑ The description is the publisher's show notes. For an iTunes episode with none, the model is told to "infer likely content from the title" — a confident summary of an episode nobody read.**
2. Library → Takeaways lists every note across episodes, newest first, searchable by text and filterable by tag.
3. Insights shows the streak, counts, weekly listening chart and top tags.
4. "Export All ↗" downloads one Markdown file. **⚑ It contains timestamped notes and highlights only. The freeform notes editor — the largest writing surface in the app — and every AI summary are silently left out.**

### Flow E — Organise

1. Library → Folders: create with a name, rename, or delete with a confirm step. Deleting a folder never touches episodes.
2. To put an episode in a folder, open the episode and use the ⋯ menu. **⚑ This is the only place it can be done. Nothing in the Library or on a card offers it, so the feature is easy to never find.**
3. Search and tag chips render on the Folders tab but filter nothing there. **⚑ Dead controls.**

---

## 05 · Gap analysis

P0 blocks the MVP as defined in §06. P1 is needed for the MVP to feel finished. P2 is what a good v1.1 looks like.

| Pri | Gap | Why it matters | Proposed requirement |
|---|---|---|---|
| **P0** | No account or sync | All seven stores are device-local. Identity is hard-coded. Sign out is a disabled button. A product nobody can trust to keep their notes is not a product. | Email/magic-link or OAuth sign-in. Server-side persistence of all stores with the current localStorage as an offline cache. Profile name and avatar from the account. |
| **P0** | Nothing can be removed | No delete for episodes, notes, highlights or AI summaries; no edit for notes. Every mistake is permanent and the library only grows. | Remove episode from library (confirm; cascades notes/summary; removes from folders). Edit and delete on every note. Clear summary. |
| **P0** | Summary isn't grounded in the audio | Bullets come from show notes, or a title-only guess when there are none. This is the headline feature and it's the one competitors do properly. | Transcribe podcast episodes with Groq Whisper (`whisper-large-v3-turbo`, ~$0.04/hr, accepts the audio URL directly). Summarise from the transcript. Show the transcript, searchable, with tap-to-seek. |
| **P0** | Seeded example data | Five fake episodes and five fake notes ship to every new user with no way to clear them. | Empty-state onboarding that points to Discover. Seed data only in a dev/demo flag. |
| P1 | Episode-only discovery | No show-level search, no follow, no latest-episodes feed, 20 results max. A podcast app that can't follow a show. | Show search; follow a show; "New from shows you follow" on the Dashboard. |
| P1 | Export is incomplete | Freeform notes and AI summaries are omitted, so the second-brain promise is half kept. | Include freeform notes and summary per episode. Per-episode export (the builder already exists, it has no UI). |
| P1 | Tags are limited to the episode's | Notes can only take one of the episode's genre tags; untagged when the episode has none. Cross-show tagging is impossible. | Free-text tags with autocomplete from all existing tags; multiple per note. |
| P1 | Notifications do nothing | The toggle persists a boolean nothing reads. A control that lies. | Either implement a daily reminder via the PWA Notifications API, or remove the toggle until it can. |
| P1 | Mini player can't be dismissed | Once loaded it's permanent for the session. | Close control that clears the player. Escape and backdrop close on the full-screen view. |
| P1 | Audio failures are silent | A dead audio URL just sets play to false. The user sees a play button that doesn't play. | Surface "This episode's audio couldn't be loaded" with a retry and a link to the source. |
| P1 | Add-to-folder is hidden | Only reachable from the episode ⋯ menu. | Add to folder from the Library card menu and from the folder view itself. |
| P1 | Dead controls and small lies | Filters render on Folders but don't apply; "Jump to Notes" appends `#notes` but nothing scrolls; greeting is always "Good morning". | Hide filters on Folders or make them apply. Scroll to notes. Time-of-day greeting. |
| P1 | Single dark theme | No light mode, no toggle. | Light theme following system, with a manual override. |
| P2 | Player features | No queue, sleep timer, chapters or volume. | Up-next queue and sleep timer first; chapters when transcripts exist. |
| P2 | Offline listening | Only the app shell is cached. | Download episode audio for offline; cache artwork. |
| P2 | Folder polish | No user colours, no reorder, no name uniqueness. | Colour picker, drag reorder, duplicate-name check. |
| P2 | Sharing and deep links | No share, no 404 route. | Share a note or highlight as an image or link. 404 route. |
| P2 | YouTube summaries | Notes-only by design; no legitimate transcript source. | Only via a paid transcript API if demand appears. Not a podcast product priority. |

### Known defects to carry into the backlog

Found in code review; low severity, listed so they aren't lost.

- A highlight saved on a YouTube episode is stamped 0:00, and its 🕐 chip seeks whatever episode is loaded in the player.
- If "Regenerate" fails after a summary already exists, the error is stored but never shown; the stale summary stays.
- The Continue Learning compact row has no duration guard and would show "0:00 left" for an unknown-duration episode.
- An unknown route renders an empty content area inside the shell rather than a not-found screen.
- The `folders` and `activity` stores are not covered by the one-time `podbrain-*` → `podmark-*` key migration.

---

## 06 · MVP definition

> **MVP is done when** a learner-listener can use PodMark as their only podcast note-taking tool for one month across two devices without losing a note, and every summary they read reflects what was actually said.

### In scope

- Sign-in and server-side sync of episodes, notes, folders, settings, activity and progress; localStorage retained as an offline cache.
- Remove episode; edit and delete notes and highlights; clear a summary.
- Audio transcription for podcast episodes; summaries grounded in the transcript; transcript view with tap-to-seek.
- Empty-state onboarding; no seeded content in production.
- Complete export: timestamped notes, highlights, freeform notes, summary.
- Free-text tags on notes.
- Dismissible mini player; audio error surfaced.
- Notifications toggle either working or removed.

### Out of scope

- Following shows and a feed — valuable, but the note-taking loop must be trustworthy first.
- Offline audio, queue, sleep timer, chapters.
- Any automatic YouTube transcription.
- Social or sharing features.
- Native iOS/Android apps — the PWA is the MVP surface.

### Non-functional requirements

| Area | Requirement |
|---|---|
| Data safety | No user action is irreversible without a confirm. Sync conflicts resolve last-write-wins per record with no silent data loss. |
| Transcription | A 60-minute episode transcribes in under 60 seconds end to end. Files above Groq's tier limit are chunked or the user is told why it can't be done. |
| Cost | Transcription plus summary under $0.10 per episode at list prices; per-user rate limit to cap abuse. |
| Privacy | Notes are private by default. Transcripts are stored per user, not shared across users of the same episode, until a clear policy says otherwise. |
| Quality gate | Every P0/P1 item ships with Playwright coverage; the suite stays green on desktop and mobile Chrome. |

---

## 07 · Success metrics

Targets for the first 30 days after MVP launch with an invited cohort of 50 learner-listeners. None of these can be measured today — instrumentation is part of the MVP.

| Metric | Target | Definition |
|---|---|---|
| Activation | 70% | of sign-ups add a real episode in their first session |
| Core action | ≥ 2 | notes or highlights per episode listened past 5 minutes |
| Summary trust | ≥ 40% | of summaries have at least one bullet added to notes |
| Retention | 35% | week-4 return; median streak ≥ 3 days |
| Export | 25% | of active users export at least once |
| Reliability | ≥ 95% | transcription and summary success rate; zero sync data-loss reports |

Guardrails: transcription cost per active user per month; P95 time from "Summarize" to bullets; audio load failure rate.

---

## 08 · Roadmap

Three phases. Each ends with something a user can feel, not a layer nobody sees.

### Phase 1 — Trust the library
*Nothing is permanent by accident, and nothing is lost.*

- Remove episode; edit/delete notes; clear summary
- Sign-in and sync, localStorage as cache
- Empty-state onboarding; drop seed data in prod
- Dismissible player; audio errors surfaced
- Fix the dead controls and small lies

### Phase 2 — Summaries that are true
*The headline feature reflects the audio.*

- Groq Whisper transcription on the audio URL
- Summary grounded in the transcript
- Transcript view, searchable, tap-to-seek
- Free-text tags
- Complete export incl. freeform notes and summary

### Phase 3 — A podcast app
*Content comes to the user.*

- Show search and follow
- "New from shows you follow" on Dashboard
- Working daily reminder
- Light theme
- Queue and sleep timer

Sequencing rationale: sync before transcription because transcripts are the most expensive data to lose; transcription before follow-a-show because a bigger library of untrustworthy summaries is worse than a smaller one of good ones.

---

## 09 · Risks & decisions

### Decisions already made

| Decision | Rationale |
|---|---|
| YouTube is notes-only | No legitimate transcript source: captions are gated behind a PO Token and blocked from datacenter IPs; the audio can't be fetched. Snipd does it by extracting audio server-side — a ToS-gray, infrastructure-heavy path that a podcast product shouldn't take. Metadata via the public oEmbed endpoint, nothing more. |
| Unknown duration never means finished | A duration of 0 is "unknown", not "zero-length". Status derives from real progress; duration is only consulted to decide finished. |
| Streak needs a real minute | Listened minutes are wall-clock, capped per tick, and a day counts only past one minute — so a tap-and-pause can't earn a streak. |
| No fake numbers | Every stat, chart and count on every screen is derived from real state. Mock data was removed rather than dressed up. |

### Open risks

| Risk | Impact | Mitigation |
|---|---|---|
| Groq free-tier 25 MB file cap | Episodes over ~45 minutes at typical bitrates won't transcribe on the free tier. | Move to the dev tier (100 MB, pay-as-you-go) before Phase 2; chunk as a fallback. |
| Transcribing third-party audio | Legal posture is sound for open RSS audio a user is already streaming, but store transcripts per user, not as a shared corpus. | Per-user storage; delete transcript when the episode is removed; document the policy. |
| Sync migration from localStorage | Existing users' data must survive the move to accounts. | First sign-in uploads local stores; keep local as cache; write a migration test with the real store shapes. |
| Vercel function limits | Long transcriptions could exceed the default function timeout. | Groq's `url` parameter means no download on our side; set `maxDuration`; fall back to async job + poll if needed. |
| iTunes Search API | Unauthenticated, rate-limited, episode-only. A show feed needs RSS. | Phase 3 introduces RSS parsing server-side for followed shows. |

### Open questions

- Auth provider: magic link is the least friction for a PWA; is Google sign-in worth the extra surface?
- Backend: the app has no server state today. Supabase or Convex would give auth, Postgres and realtime sync with the least new infrastructure.
- Should transcripts be visible to the user, or only feed the summary? Recommendation: visible and tap-to-seek — it's the feature Snipd users cite most.
- Pricing: free with a monthly transcription cap, or free forever with the cap set by cost? Decide before Phase 2 ships.

---

## 10 · Appendix

### A. Stack

React 19, Vite 8, TypeScript, Tailwind CSS v4, Zustand with `persist`, React Router (hash routing), `vite-plugin-pwa`. Two Vercel serverless functions. Groq for AI (`openai/gpt-oss-120b` for summaries). Playwright for end-to-end tests. Deployed on Vercel.

### B. Data model and persistence

| Store | Key | Holds | Mutations |
|---|---|---|---|
| Episodes | `podmark-episodes` | id, title, show, artwork, duration, progress, status, tags, publishedAt, audioUrl?, sourceUrl?, description? | add only |
| Notes | `podmark-notes` | timestamped notes and highlights; AI summaries and errors per episode; freeform Markdown per episode | add note, set freeform, generate summary |
| Folders | `podmark-folders` | id, name, colour, episodeIds | add, rename, delete, add/remove episode |
| Settings | `podmark-settings` | daily goal (5–180 min), notifications flag, export format | adjust, toggle, set |
| Activity | `podmark-activity` | listened minutes by local date | add ms |
| UI | `podmark-ui` | sidebar collapsed | toggle |
| Progress | `podmark-progress` | seconds by episode id (raw localStorage, throttled writes, flushed on hide) | set |

### C. Serverless contracts

| Endpoint | Request | Response | Notes |
|---|---|---|---|
| `POST /api/summarize` | `{ title, show?, description? }` | `{ bullets: string[] }` or `{ error }` | Groq chat completion, 3–5 bullets. Maps 401/429/quota/model errors to specific user-facing messages. Needs `GROQ_API_KEY`; `GROQ_MODEL` optional. |
| `POST /api/youtube` | `{ url }` | `{ videoId, title, channel, thumbnailUrl }` or `{ error }` | Public oEmbed, no key. Accepts watch, youtu.be, shorts, live and embed forms. Returns no duration or captions. |

### D. Status and streak rules

- **Effective status:** progress ≥ duration → finished; progress > 0 → in-progress; else stored status. If duration is unknown (0): progress > 0 → in-progress, else stored status.
- **Listened minutes:** wall-clock delta between playback ticks, capped at 5 s per tick, accrued only while playing, keyed by local calendar date.
- **Streak:** a day counts at ≥ 1 minute. Count consecutive qualifying days back from today, or from yesterday if today hasn't qualified yet. Two missed days resets to 0.
- **Daily goal:** adjustable 5–180 minutes in steps of 5; default 30. Drives the Dashboard ring and the Insights chart threshold.

### E. Screens and routes

`/` Dashboard · `/library` Library (Episodes, Takeaways, Folders, Discover) · `/episode/:id` Episode detail · `/insights` Insights · `/profile` Profile. Mobile: bottom tab bar. Desktop: collapsible sidebar, profile and streak pinned at the bottom.
