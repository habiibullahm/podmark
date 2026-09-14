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

`api/summarize.ts` needs `GROQ_API_KEY` (and optionally `GROQ_MODEL`, default `openai/gpt-oss-120b`). For local `vercel dev`, pull it with `vercel env pull .env.local --environment=development` rather than hand-editing the file. YouTube lookup needs no key.

## Server code conventions

Put logic in `backend/src/`, not in `api/`. A backend function takes a plain input and an `env` object and returns `{ status, body }`; the matching `api/` file only adds the method guard and `res.status().json()`. Relative imports in `api/` and `backend/` use explicit `.js` extensions — the root is `"type": "module"` and Vercel compiles functions with `nodenext` resolution, so the extension is required at runtime. `tsconfig.api.json` and `backend/tsconfig.json` use `nodenext` too, so a local typecheck catches what Vercel's would.

## Deploy

```bash
vercel build --prod
vercel deploy --prebuilt --prod --yes
```
