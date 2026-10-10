# PodMark

A podcast tracker and learning journal: find real episodes, listen, capture timestamped notes and highlights, get an AI summary, and export to Obsidian or Notion.

Live: https://podmark-ai.vercel.app · Product requirements: [docs/PRD.md](docs/PRD.md)

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
npm run dev                 # Vite on :5173; /api/* is proxied to production (API_PROXY_TARGET to change, "" to disable)
vercel dev --listen 3001    # app + local /api/* functions (needs a linked Vercel project and local keys)
npm run build               # -> frontend/dist
npm run typecheck           # frontend, backend, and api
npm run test:e2e            # Playwright, desktop + mobile Chrome (add --workers=2 on a busy machine)
npm run test:api            # Neon Auth JWT verification (compiles backend/ to build/)
npm run lint
```

## Environment

`api/summarize.ts` needs `SUMOPOD_API_KEY` (optionally `SUMOPOD_MODEL`, default `deepseek-v4-flash` — model access is restricted per key, check what's available on yours). SumoPod (`ai.sumopod.com`) is an OpenAI-compatible chat completions gateway; it doesn't expose an audio transcription endpoint, so `api/transcribe.ts` still needs `GROQ_API_KEY` for Whisper. For local `vercel dev`, pull env vars with `vercel env pull .env.local --environment=development` rather than hand-editing the file. YouTube lookup needs no key.

**Accounts (Neon).** Optional — without these, the app runs fully signed-out on local `localStorage` data, and `/api/summarize` / `/api/transcribe` stay open. Accounts use Neon Auth (managed Better Auth) for sign-in and the Neon Data API (PostgREST) for sync, with Row Level Security keyed on the JWT's `sub`. To enable accounts on a Neon branch:

1. In the Neon Console (or `neon` CLI), enable **Auth** and the **Data API** on the branch. Keep email/password on; magic link uses Neon's shared sender until a custom SMTP provider is configured. Add the deployed origin as a trusted domain (`neon neon-auth domain add https://…`).
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
