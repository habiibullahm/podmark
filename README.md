# PodMark

A podcast tracker and learning journal: find real episodes, listen, capture timestamped notes and highlights, get an AI summary, and export to Obsidian or Notion.

Live: https://podmark-ai.vercel.app · Product requirements: [docs/PRD.md](docs/PRD.md)

## Layout

```
frontend/   The app — React 19, Vite, TypeScript, Tailwind v4, Zustand. npm workspace.
backend/    Service logic as plain TypeScript (auth, summarize, transcribe, YouTube) and
            Neon migrations. No HTTP framework, no process.env. npm workspace.
api/        Vercel serverless entrypoints. Each file is a thin adapter that parses the
            request, calls backend/, and writes the response. Lives at the root because
            Vercel only discovers functions in a folder named `api/` there.
tests/      API tests (node:test) for the Vercel handlers and JWT verification.
scripts/    Neon migrate / RLS-verify scripts (run by CI).
docs/       Product requirements and branching strategy.
```

One Vercel project deploys all of it: `vercel.json` builds `frontend/` and serves `api/` from the same origin, so the app calls `/api/*` with no CORS.

## Development workflow

Trunk-based, full policy in [docs/BRANCHING_STRATEGY.md](docs/BRANCHING_STRATEGY.md):

1. `git switch master && git pull --ff-only`, then `git switch -c feat/<topic>` (or `fix/`, `chore/`, `docs/`).
2. Build it locally with `npm run dev` (below) and run the checks.
3. Push and open a PR to `master`. CI runs every check and Vercel builds a preview deployment.
4. After the owner approves: squash merge. Vercel deploys production; CI applies Neon migrations.
5. Delete the branch; start the next change from fresh `master`.

## Local development

### Setup (once)

```bash
npm install                                          # both workspaces
cd frontend && npx playwright install chromium       # browser for the e2e tests
```

To sign in locally, create `frontend/.env.local` (gitignored) with the two public Neon endpoints:

```bash
VITE_NEON_AUTH_URL=<Neon Auth URL>
VITE_NEON_DATA_API_URL=<Neon Data API URL>
```

Copy them from the Neon Console (project → Auth / Data API) or the Vercel project's environment variables. Without this file the app still runs, signed-out, on `localStorage` only.

### Run

```bash
npm run dev        # http://localhost:5173, hot reload
```

| Feature | Locally | Notes |
|---|---|---|
| UI, library, notes, player, export | yes | runs entirely in the browser |
| Sign-in and sync | yes, with `frontend/.env.local` | **real Neon database, shared with production** (demo app, one database) |
| AI summary, transcription, YouTube import | yes | `/api/*` is proxied to production (`https://podmark-ai.vercel.app`); each call prints an `[api] POST /api/summarize → 200 (812 ms) via …` line in the terminal. Uses production AI credits |
| Your edits to `api/` or `backend/` | **no** | the proxy runs production's code — see below |

`API_PROXY_TARGET` (env or `frontend/.env.local`) points the proxy at another deployment; an empty value turns it off, so `/api/*` returns 404.

### Changing backend code

`npm run dev` never runs your local `api/` or `backend/`. Test server changes with, in order:

1. `npm run test:api`: the real handlers with mock requests and locally signed JWTs. Fast, no network, no keys. Add a case in `tests/api.test.mjs` for new behavior.
2. `vercel dev --listen 3001` (after `vercel link`): app + your local functions on http://localhost:3001. Needs `NEON_AUTH_URL` and the provider keys you want to test in the root `.env`. Sensitive keys can't be pulled from Vercel, so use your own.
3. The PR's preview deployment, which runs exactly what will ship.

### Test

```bash
npm run typecheck    # frontend, backend, and api/
npm run lint         # oxlint
npm run test:api     # API handlers + Neon JWT verification (~seconds)
npm run test:e2e     # Playwright: desktop, mobile, accounts (~2 min)
npm run build        # -> frontend/dist
```

Run all of them before pushing; CI runs the same set. Playwright starts its own dev servers with Neon and `/api` mocked, so e2e tests never touch the real database or spend credits (add `-- --workers=2` on a busy machine).

```bash
npm run test:e2e -- e2e/library.spec.ts                                              # one spec
cd frontend && npx playwright test e2e/library.spec.ts --project=chromium -g "name"  # one test
npm run test:e2e:ui                                                                  # watch/debug in a browser
```

| You changed | Check with |
|---|---|
| A screen or component | `npm run dev` by hand + the matching `frontend/e2e/*.spec.ts` |
| Sign-in or sync | `npm run test:e2e -- e2e/neon-accounts.spec.ts` + a real sign-in on localhost |
| `api/*` or `backend/src/*` | `npm run test:api` (+ a new test case), then the PR preview |
| A migration in `backend/neon/migrations/` | CI applies it and runs `db:verify` on merge; by hand see [Environment](#environment) |

### Debugging

- Browser DevTools → Network: Neon Auth (`/get-session`, `/token`), the Data API (`/rest/v1/<table>`) and `/api/*`. A 401 on `/api/*` means no valid session.
- The `npm run dev` terminal: one `[api]` line per proxied call, with status and time.
- Server-side errors: Vercel dashboard → project → Logs (the functions run there).

## Environment

`api/summarize.ts` needs `SUMOPOD_API_KEY` (optionally `SUMOPOD_MODEL`, default `deepseek-v4-flash` — model access is restricted per key, check what's available on yours). SumoPod (`ai.sumopod.com`) is an OpenAI-compatible chat completions gateway; it doesn't expose an audio transcription endpoint, so `api/transcribe.ts` still needs `GROQ_API_KEY` for Whisper. For local `vercel dev`, `vercel env pull .env.local --environment=development` fetches the non-sensitive variables; sensitive keys are never pulled, so add your own to the root `.env`. YouTube lookup needs no key.

**Accounts (Neon).** Optional — without these, the app runs fully signed-out on local `localStorage` data, and `/api/summarize` / `/api/transcribe` answer 401 (they require a signed-in user). Accounts use Neon Auth (managed Better Auth) for sign-in and the Neon Data API (PostgREST) for sync, with Row Level Security keyed on the JWT's `sub`. To enable accounts on a Neon branch:

1. In the Neon Console (or `neon` CLI), enable **Auth** and the **Data API** on the branch. Keep email/password on. Magic link is built but hidden in the UI (`MAGIC_LINK_ENABLED` in `frontend/src/screens/Profile.tsx`) until a custom SMTP provider is configured; Neon's shared sender is unreliable. Add the deployed origin as a trusted domain (`neon neon-auth domain add https://…`).
2. Apply the schema with the branch owner's connection string, then check RLS (the check writes and deletes rows for two fake user ids only). CI does this automatically on every push to `master` when the `NEON_DATABASE_URL` GitHub secret is set. By hand:
   ```bash
   DATABASE_URL="<owner connection string>" npm run db:migrate
   DATABASE_URL="<owner connection string>" npm run db:verify
   ```
3. Set frontend env vars (Vite, public — the browser calls these directly): `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL`.
4. Set the server env var `NEON_AUTH_URL` (same value as `VITE_NEON_AUTH_URL`). `/api/summarize` and `/api/transcribe` verify the session JWT against its JWKS locally — Ed25519 only, issuer and audience pinned, and Neon's anonymous tokens rejected.

The owner connection string is only for migrations: it lives in the `NEON_DATABASE_URL` GitHub Actions secret and never goes into the app, Vercel, or a `VITE_` variable.

## Server code conventions

Put logic in `backend/src/`, not in `api/`. A backend function takes a plain input and an `env` object and returns `{ status, body }`; the matching `api/` file only adds the method guard and `res.status().json()`. Relative imports in `api/` and `backend/` use explicit `.js` extensions — the root is `"type": "module"` and Vercel compiles functions with `nodenext` resolution, so the extension is required at runtime. `tsconfig.api.json` and `backend/tsconfig.json` use `nodenext` too, so a local typecheck catches what Vercel's would.

## Deploy

Hosting is Vercel, through its Git integration — there is no deploy script:

- **Pull requests** get a preview deployment (behind Vercel Authentication).
- **Merges to `master`** deploy production at `https://podmark-ai.vercel.app`.
- **Rollback:** Vercel dashboard → Deployments → promote the previous production deployment (Instant Rollback).

GitHub Actions (`.github/workflows/ci.yml`) runs typecheck, lint, build, API tests and Playwright on every PR and on `master`; on `master` it also applies Neon migrations and checks RLS.

Vercel environment variables (Production, Preview and Development):

| Name | Kind | Purpose |
|---|---|---|
| `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL` | public, build-time | Neon Auth / Data API endpoints for the browser |
| `NEON_AUTH_URL` | server | JWT verification on `/api/summarize` and `/api/transcribe` |
| `SUMOPOD_API_KEY`, `GROQ_API_KEY` | secret | AI summaries (SumoPod, Groq fallback) and transcription (Groq) |
| `GETYOUTUBETRANSCRIPT_API_KEY`, `WEBSHARE_PROXY_USERNAME`/`PASSWORD` | secret, optional | YouTube transcripts |

Login only works on origins listed as Neon Auth trusted domains (`neon neon-auth domain add <origin> --project-id … --branch production`). Preview URLs are not trusted by default; add a specific preview URL when you need to test sign-in there.
