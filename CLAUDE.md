# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PodMark is a podcast tracker and learning journal PWA (search episodes, play, take timestamped notes, AI summaries, export to Obsidian/Notion). See `AGENTS.md` for style and commit conventions, `README.md` for env setup, `docs/PRD.md` for product scope, and `docs/deploy-coolify.md` for the Docker/Coolify deployment.

## Commands

Run from the repo root (npm workspaces: `frontend`, `backend`).

```bash
npm run dev                  # Vite on :5173 (does NOT serve /api/*)
vercel dev --listen 3001     # app + /api/* together, needed to exercise AI/YouTube endpoints
npm run build                # tsc -b + vite build -> frontend/dist
npm run typecheck            # frontend, backend, and api/ (tsconfig.api.json)
npm run lint                 # oxlint
npm run test:e2e             # Playwright, desktop + mobile Chrome; starts `npm run dev` itself
npm run test:e2e -- e2e/discover.spec.ts      # single spec (path relative to frontend/)
cd frontend && npx playwright test e2e/discover.spec.ts --project=chromium -g "test name"   # Playwright flags need direct invocation
node tests/deployment-smoke.mjs                # smoke/security tests for server/index.mjs; needs build/ (below)
./node_modules/.bin/tsc -p tsconfig.deploy.json  # compile backend/src -> build/ for the Node server
```

CI (`.github/workflows/publish-coolify.yml`) runs typecheck, lint, build, deploy-compile, smoke tests, and `test:e2e -- --workers=2`, then builds and smoke-tests the Docker image.

## Architecture

**Two deployment targets share one backend.** All server logic lives in `backend/src/` as framework-agnostic functions that take a plain input plus an `env` object and return `{ status, body }`. Two thin adapters wrap it:
- `api/*.ts` — Vercel functions (method guard, auth check, `res.status().json()`).
- `server/index.mjs` — plain Node HTTP server for the Docker/Coolify image. It imports the *compiled* backend from `build/` (via `tsconfig.deploy.json`), serves `frontend/dist` with SPA fallback, exposes `/healthz`, and adds in-memory rate limiting (`server/rateLimit.mjs`).

When adding or changing an endpoint, update **both** `api/<name>.ts` and the `ROUTES` table in `server/index.mjs` (it mirrors `api/` one-to-one), plus `tests/deployment-smoke.mjs` if behavior is security-relevant.

**ESM import rule:** relative imports in `api/` and `backend/` must use explicit `.js` extensions (root is `"type": "module"`, compiled with `nodenext`). The frontend (Vite bundler resolution) does not use extensions.

**Paid endpoints require auth.** `/api/summarize` and `/api/transcribe` call `verifyUser` (`backend/src/auth.ts`), which verifies the Supabase JWT locally via `SUPABASE_URL` (JWKS/ES256) or `SUPABASE_JWT_SECRET` (HS256). Without a valid session they return 401. YouTube lookup/transcript endpoints are open.

**AI providers:** summaries use SumoPod (`SUMOPOD_API_KEY`, OpenAI-compatible) with Groq as fallback (`GROQ_API_KEY`); transcription uses Groq Whisper only. Note: `AGENTS.md` describes Groq as the summary provider — the code (`backend/src/summarize.ts`) is authoritative. Missing keys yield a 503, not a crash.

**Frontend state is local-first.** Zustand stores in `frontend/src/store/` persist to `localStorage` under `podmark-*` keys (with versioned `migrate` functions; `lib/migrateStorageKeys.ts` carries over legacy `podbrain-*` keys and must run before stores are imported). The app must work fully signed-out: `lib/supabase.ts` exports `supabase = null` when `VITE_SUPABASE_*` are unset, and every caller treats that as "accounts disabled".

**Sync (`frontend/src/lib/sync.ts`)** runs only while signed in (started/stopped by `useAuthStore`). It mirrors each store to a Supabase table using a persisted "dirty key" set rather than per-record timestamps: on pull, dirty keys keep the local value, everything else takes the server value (soft deletes via `deleted_at`). Some tables are debounced (`freeform_notes`, `activity`, `progress`). New persisted data that should sync needs a table in `backend/supabase/migrations/` (with RLS) and wiring in `sync.ts`.

**Routing/auth quirk:** the app uses `HashRouter`, so Supabase auth uses the PKCE flow (`?code=` in the query string) to avoid colliding with hash routes; magic links must open in the same browser that requested them.

**Audio playback** is global via `frontend/src/context/PlayerContext.tsx` (compact player + full-screen modal rendered in `App.tsx` outside the routes).

## Testing notes

- Playwright's `webServer` forces `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` to empty so specs run hermetically signed-out; don't write specs that depend on a real Supabase project.
- `/api/*` is not served by `npm run dev`, so e2e specs that touch API features mock those routes.
- The smoke test never calls paid providers: it strips provider keys and signs its own JWTs with a test secret.
