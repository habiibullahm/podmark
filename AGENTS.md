# Repository Guidelines

## Project Structure

```
podmark/
├── api/               # Vercel Functions (thin adapters)
│   ├── summarize.ts
│   ├── transcribe.ts
│   ├── youtube.ts
│   └── youtube-transcript.ts
├── backend/           # Service logic (framework-agnostic TS)
│   └── src/
│       ├── auth.ts
│       └── ...
├── frontend/          # React 19 PWA (Vite, Tailwind, Zustand)
│   └── src/
│       ├── components/
│       ├── screens/
│       ├── store/
│       └── lib/
├── docs/PRD.md        # Product requirements
└── package.json       # Workspace root
```

The monorepo uses npm workspaces. Business logic lives in `backend/`; `api/` contains only Vercel-function adapters that call into it.

## Build, Test & Development

| Command | Description |
|---|---|
| `npm run dev` | Start the frontend dev server (Vite) |
| `npm run build` | Type-check and build the frontend |
| `npm run typecheck` | Type-check all workspaces + API functions |
| `npm run lint` | Run Oxlint across the repo |
| `npm run test:e2e` | Run Playwright e2e tests (headless) |
| `npm run test:e2e:ui` | Run Playwright tests with the UI mode |

All commands run from the repository root. The Vercel config expects the frontend build output at `frontend/dist`.

## Coding Style & Naming

- **TypeScript only.** Prefer explicit types; avoid `any` unless justified.
- **Indentation:** 2 spaces, no tabs.
- **Naming:** `camelCase` for variables, functions, and files. `PascalCase` for components and types. `UPPER_SNAKE` for constants.
- **Styling:** Tailwind CSS v4 utility classes — no separate CSS modules.
- **Linting:** Oxlint (`npm run lint`). Run before committing.

## Testing Guidelines

- **Framework:** Playwright for end-to-end tests under `frontend/e2e/`.
- **Naming:** Test files describe the feature or flow being tested (e.g., `discover.spec.ts`).
- **Running:** `npm run test:e2e` from the root. Test artifacts go to `frontend/test-results/` and `frontend/playwright-report/`.
- **Scope:** No unit tests at this stage. Focus on critical user journeys: search, playback, note-taking, export.

## Commit & Pull Requests

**Commits** follow Conventional Commits (`type(scope): description`). Types used in this repo:
- `feat:` — new feature
- `fix:` — bug fix
- `chore:` — tooling, config, or maintenance
- `docs:` — documentation or PRD updates

Keep the subject under 72 characters. Include a body only when it adds context about *why* a change was made.

**Pull requests** should include:
- A descriptive title matching the commit convention
- A summary of what changed and why
- Screenshots or screen recordings for UI changes
- Links to any related issues or PRD sections

## Environment & Secrets

- **`GROQ_API_KEY`** — required for AI summarization and transcription. Add to Vercel Production env before deploying.
- **`VITE_SUPABASE_URL`** and **`VITE_SUPABASE_ANON_KEY`** — Supabase project credentials for the frontend.
- All secrets go through Vercel environment variables or `.env.local` (which is gitignored). Never commit secrets.
- An `.env.example` at the workspace root documents required variables.

## Architecture Notes

- **State:** Zustand stores with `persist` middleware (currently `localStorage`; Supabase sync in Phase 1).
- **AI:** Groq API (`openai/gpt-oss-120b` for summaries, `whisper-large-v3-turbo` for transcription).
- **Auth (Phase 1):** Supabase magic-link authentication with Row Level Security.
- **Deployment:** Single Vercel project. Hash routing via React Router — no SSR.
