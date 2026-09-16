# PodMark

A podcast tracker and learning journal: find real episodes, listen, capture timestamped notes and highlights, get an AI summary, and export to Obsidian or Notion.

Live: https://podbrain-five.vercel.app · Product requirements: [docs/PRD.md](docs/PRD.md)

## Layout

```
frontend/   The app — React 19, Vite, TypeScript, Tailwind v4, Zustand. npm workspace.
backend/    Service logic as plain TypeScript (summarize, YouTube lookup; later auth,
            sync, transcription). No HTTP framework, no process.env. npm workspace.
api/        Vercel serverless entrypoints. Each file is a thin adapter that parses the
            request, calls backend/, and writes the response. Lives at the root because
            Vercel only discovers functions in a folder named `api/` there.
docs/       Product documents.
```

One Vercel project deploys all of it: `vercel.json` builds `frontend/` and serves `api/` from the same origin, so the app calls `/api/*` with no CORS.

## Commands

Run everything from the repo root.

```bash
npm install                 # installs both workspaces
npm run dev                 # Vite on :5173 — does NOT serve /api/*
vercel dev --listen 3001    # app + /api/* together; use this to exercise AI or YouTube
npm run build               # -> frontend/dist
npm run typecheck           # frontend, backend, and api
npm run test:e2e            # Playwright, desktop + mobile Chrome (add --workers=2 on a busy machine)
npm run lint
```

## Environment

`api/summarize.ts` needs `SUMOPOD_API_KEY` (optionally `SUMOPOD_MODEL`, default `deepseek-v4-flash` — model access is restricted per key, check what's available on yours). SumoPod (`ai.sumopod.com`) is an OpenAI-compatible chat completions gateway; it doesn't expose an audio transcription endpoint, so `api/transcribe.ts` still needs `GROQ_API_KEY` for Whisper. For local `vercel dev`, pull env vars with `vercel env pull .env.local --environment=development` rather than hand-editing the file. YouTube lookup needs no key.

**Accounts (Supabase).** Optional — without these, the app runs fully signed-out on local `localStorage` data, exactly as before, and `/api/summarize` stays open. To enable accounts:

1. Create a Supabase project. Under **Authentication → URL Configuration**, set the Site URL to the deployed origin and add `http://localhost:3001` / `http://localhost:5173` as redirect URLs. Under **Authentication → Providers → Email**, enable email sign-in with "Confirm email" off (the magic link itself is the confirmation).
2. Run `backend/supabase/migrations/0001_init.sql` against the project (Supabase CLI `supabase db push`, or paste it into the SQL editor).
3. Set frontend env vars (Vite, public — safe in the browser): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
4. Set exactly one server env var (Vercel, secret) matching the project's JWT signing algorithm (**Settings → API → JWT**): `SUPABASE_JWT_SECRET` for HS256, or `SUPABASE_URL` for ES256 (its JWKS is derived from the URL). This is what `/api/summarize` uses to verify a session token locally, with no per-request network call.

Never put the Supabase **service-role** key anywhere in this repo or in a `VITE_`-prefixed env var — it belongs only in the Supabase dashboard.

## Server code conventions

Put logic in `backend/src/`, not in `api/`. A backend function takes a plain input and an `env` object and returns `{ status, body }`; the matching `api/` file only adds the method guard and `res.status().json()`. Relative imports in `api/` and `backend/` use explicit `.js` extensions — the root is `"type": "module"` and Vercel compiles functions with `nodenext` resolution, so the extension is required at runtime. `tsconfig.api.json` and `backend/tsconfig.json` use `nodenext` too, so a local typecheck catches what Vercel's would.

## Deploy

```bash
vercel build --prod
vercel deploy --prebuilt --prod --yes
```
