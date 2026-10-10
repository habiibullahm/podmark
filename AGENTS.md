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

## Trunk-Based Development

For the complete branch naming, PR lifecycle, hotfix, release, and deployment policy, see [`docs/BRANCHING_STRATEGY.md`](docs/BRANCHING_STRATEGY.md).

PodMark uses **trunk-based development**. `master` is the only long-lived integration branch and must remain releasable.

- **Start from the trunk.** Create every `feat/*`, `fix/*`, `chore/*`, or `docs/*` branch from the latest `master`. Do not use long-lived `develop`, release, or integration branches.
- **Keep branches short-lived.** Aim to merge within one working day (at most a few days). Split large milestones into independently reviewable, working changes instead of accumulating a long-running branch.
- **Target `master` directly.** Open small, focused PRs against `master`; avoid stacked PRs. If stacking is temporarily necessary, retarget the dependent PR to `master` as soon as its prerequisite is merged.
- **Integrate safely.** Keep `master` buildable and the main user journeys working. Hide incomplete functionality behind feature flags or keep it inactive; do not merge broken intermediate states.
- **Require a green PR.** Run relevant typecheck, lint, tests, and build checks. Address failing CI before merge. Do not push directly to `master`; get the repository owner's approval before merging.
- **Deploy from trunk only.** Production image publishing and Coolify deployment may run only after a push/merge to `master`, never from a feature-branch PR or manual run on another ref.
- **Clean up promptly.** Prefer squash merge for focused PRs, delete merged feature branches, and start the next change from current `master`. Keep database changes backward-compatible when possible so frequent merges remain safe.

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

- **`SUMOPOD_API_KEY`** — primary provider for AI summarization (optional `SUMOPOD_MODEL`, default `deepseek-v4-flash`).
- **`GROQ_API_KEY`** — required for transcription (Whisper); also the summarization fallback when SumoPod is unset or fails. Add provider keys to Vercel Production env before deploying.
- **`VITE_NEON_AUTH_URL`** and **`VITE_NEON_DATA_API_URL`** — Neon Auth and Data API endpoints for the frontend (public).
- **`NEON_AUTH_URL`** — server-side, for verifying session JWTs on the paid AI endpoints.
- All secrets go through Vercel environment variables or `.env.local` (which is gitignored). Never commit secrets.
- `README.md` (Environment section) documents the required variables.

## Architecture Notes

- **State:** Zustand stores with `persist` middleware (`localStorage`, synced to Neon via the Data API when signed in).
- **AI:** SumoPod (`deepseek-v4-flash`) for summaries with Groq (`openai/gpt-oss-120b`) as fallback; Groq `whisper-large-v3-turbo` for transcription.
- **Auth:** Neon Auth (managed Better Auth) — email/password and magic link — with Row Level Security on every table (`backend/neon/migrations/`).
- **Deployment:** Single Vercel project. Hash routing via React Router — no SSR.
