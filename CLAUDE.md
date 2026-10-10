# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

PodMark is a podcast tracker and learning journal PWA (search episodes, play, take timestamped notes, AI summaries, export to Obsidian/Notion). See `AGENTS.md` for style, commit, and trunk-based branching rules (short-lived branches off `main`, no stacked PRs), `README.md` for env setup, and `docs/PRD.md` for product scope. Hosting is Vercel via its Git integration (PR previews, `main` → production); see the README's Deploy section.

## Commands

Run from the repo root (npm workspaces: `frontend`, `backend`).

```bash
npm run dev                  # Vite on :5173; /api/* proxied to production podmark-ai.vercel.app (API_PROXY_TARGET="" disables)
vercel dev --listen 3001     # app + local /api/* functions, to test backend changes locally
npm run build                # tsc -b + vite build -> frontend/dist
npm run typecheck            # frontend, backend, and api/ (tsconfig.api.json)
npm run lint                 # oxlint
npm run test:e2e             # Playwright, desktop + mobile Chrome; starts `npm run dev` itself
npm run test:e2e -- e2e/discover.spec.ts      # single spec (path relative to frontend/)
cd frontend && npx playwright test e2e/discover.spec.ts --project=chromium -g "test name"   # Playwright flags need direct invocation
npm run test:api             # node:test: Vercel handlers + Neon JWT verification (compiles api/ + backend/ to build/ via tsconfig.test.json)
DATABASE_URL=... npm run db:migrate            # apply backend/neon/migrations/ (owner connection string; only ever a GitHub secret)
DATABASE_URL=... npm run db:verify             # check RLS isolation (writes/deletes rows for two fake user ids)
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, build, `test:api`, and `test:e2e -- --workers=2` on PRs and `main`; on push to `main` it also applies Neon migrations and verifies RLS. Deploys are not in CI: Vercel's Git integration builds a preview per PR and deploys production from `main`.

## Architecture

**Backend = Vercel functions over plain TS.** All server logic lives in `backend/src/` as framework-agnostic functions that take a plain input plus an `env` object and return `{ status, body }`. `api/*.ts` are thin Vercel adapters (method guard, auth check, `res.status().json()`); Vercel serves `frontend/dist` and `api/` from one origin (`vercel.json`). When adding or changing an endpoint, add a case to `tests/api.test.mjs` if behavior is security-relevant.

**ESM import rule:** relative imports in `api/` and `backend/` must use explicit `.js` extensions (root is `"type": "module"`, compiled with `nodenext`). The frontend (Vite bundler resolution) does not use extensions.

**Paid endpoints require auth.** `/api/summarize` and `/api/transcribe` call `verifyUser` (`backend/src/auth.ts`), which verifies the Neon Auth JWT locally against `NEON_AUTH_URL`'s JWKS (EdDSA only, issuer/audience pinned, anonymous tokens rejected). Without a valid session — or with `NEON_AUTH_URL` unset — they return 401. YouTube lookup/transcript endpoints are open.

**AI providers:** summaries use SumoPod (`SUMOPOD_API_KEY`, OpenAI-compatible) with Groq as fallback (`GROQ_API_KEY`); transcription uses Groq Whisper only. Note: `AGENTS.md` describes Groq as the summary provider — the code (`backend/src/summarize.ts`) is authoritative. Missing keys yield a 503, not a crash.

**Frontend state is local-first.** Zustand stores in `frontend/src/store/` persist to `localStorage` under `podmark-*` keys (with versioned `migrate` functions; `lib/migrateStorageKeys.ts` carries over legacy `podbrain-*` keys and must run before stores are imported). The app must work fully signed-out: `lib/neon.ts` exports `auth = null` / `db = null` when `VITE_NEON_AUTH_URL` / `VITE_NEON_DATA_API_URL` are unset, and every caller treats that as "accounts disabled". `auth` is Neon Auth via its Supabase-compatible adapter and `db` is a PostgREST client, so call sites keep supabase-js shapes. Always get the token via `getAccessToken()` (the JWT lives ~15 min).

**Sync (`frontend/src/lib/sync.ts`)** runs only while signed in (started/stopped by `useAuthStore`). It mirrors each store to a Neon table via the Data API using a persisted "dirty key" set rather than per-record timestamps: on pull, dirty keys keep the local value, everything else takes the server value (soft deletes via `deleted_at`). Some tables are debounced (`freeform_notes`, `activity`, `progress`). New persisted data that should sync needs a table in `backend/neon/migrations/` (with RLS keyed on `auth.user_id()`) and wiring in `sync.ts`; keep schema changes backward-compatible.

Routing is `HashRouter` (no SSR), so auth redirects must not rely on the URL hash.

**Audio playback** is global via `frontend/src/context/PlayerContext.tsx` (compact player + full-screen modal rendered in `App.tsx` outside the routes).

## Testing notes

- Playwright runs two dev servers: `:5173` with Neon env vars forced empty (hermetic, signed-out; `chromium` + `mobile-chrome` projects) and `:5174` pointed at fake `*.neon.test` hosts for `e2e/neon-*.spec.ts` (`accounts` project), where every Neon request is intercepted with `page.route()`. Never depend on a real Neon project.
- Playwright sets `API_PROXY_TARGET=""`, so `/api/*` is never proxied to production in tests; specs that touch API features mock those routes.
- The API tests (`tests/api.test.mjs`, `tests/auth.test.mjs`) never call paid providers or real Neon: provider keys are stripped and JWTs come from a local fixture (`tests/neonAuthFixture.mjs`).
