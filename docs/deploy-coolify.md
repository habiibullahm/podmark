# PodMark on Coolify (Sumopod VPS)

This deployment **does not require a database on the VPS**. It serves the Vite PWA and the existing `/api/*` behavior from one Node.js container. The database, auth and data API are managed by Neon. The existing Vercel deployment continues to work.

## Architecture

GitHub Actions (tests, Docker image build) -> GHCR -> Coolify Docker Image -> VPS (port 3000) -> Traefik HTTPS. Coolify does not build source on the 4 GB VPS.

Endpoints: `GET /healthz`, `POST /api/youtube`, `POST /api/youtube-transcript`, `POST /api/summarize`, `POST /api/transcribe`, and static PWA assets — the same set as `api/*.ts` on Vercel. Paid AI endpoints **require a verified Neon Auth session** (JWT checked against the Neon Auth JWKS).

### Abuse protection

All `/api/*` routes are rate-limited in memory (single container). Paid routes check the session first, then a per-user, per-IP and global hourly budget, so anonymous traffic can never spend provider credits or drain another user's quota. Over-limit requests get `429` with `Retry-After`. Defaults can be tuned in Coolify without a rebuild:

| Variable | Default | Scope |
|---|---|---|
| `RATE_LIMIT_API_PER_MIN` | 120 | every `/api/*` request, per IP |
| `RATE_LIMIT_YOUTUBE_PER_MIN` | 60 | `/api/youtube`, per IP |
| `RATE_LIMIT_YT_TRANSCRIPT_PER_HOUR` | 30 | `/api/youtube-transcript`, per IP (open to signed-out users, as on Vercel) |
| `RATE_LIMIT_SUMMARIZE_PER_USER_HOUR` | 20 | `/api/summarize`, per user |
| `RATE_LIMIT_TRANSCRIBE_PER_USER_HOUR` | 6 | `/api/transcribe`, per user |
| `RATE_LIMIT_PAID_PER_IP_HOUR` | 40 | both paid routes, per IP |
| `RATE_LIMIT_PAID_GLOBAL_HOUR` | 150 | both paid routes, whole server |

`TRUST_PROXY=1` is set in the image: the client IP is the right-most `X-Forwarded-For` hop written by Coolify's proxy. Never publish container port 3000 directly on the host, or clients could spoof that header.

## 1. GitHub configuration

In repository **Settings > Secrets and variables > Actions > Variables** set the PUBLIC Vite build variables:

- `VITE_NEON_AUTH_URL`: the Neon Auth URL of the branch (`neon neon-auth status`), e.g. `https://ep-….neonauth.<region>.aws.neon.tech/neondb/auth`.
- `VITE_NEON_DATA_API_URL`: the branch's Data API URL (`neon data-api get`), e.g. `https://ep-….apirest.<region>.aws.neon.tech/neondb/rest/v1`.

They are baked into browser assets during GitHub Actions build. Changing them only in Coolify at runtime will **not** change the frontend bundle. If accounts are disabled, the app runs in signed-out localStorage mode but AI endpoints will return 401, by design.

Merge the deployment PR to `master`. The workflow builds `ghcr.io/habiibullahm/podmark:latest` plus an immutable commit-SHA tag. **No API/provider/server secrets are used during image build.**

GitHub Container Registry packages may be private initially. Either make the image package public (it contains only browser-public config) or configure GHCR registry credentials on the Coolify deployment server. Never make secrets public.

## 2. Vercel DNS

The active nameservers for `habiibullahm.my.id` are Vercel DNS. In the Vercel team's **Domains > DNS Records**, add:

- Type: `A`
- Name: `podmark`
- Value: `43.157.227.176`

Do **not** change the root or `www` records of the portfolio. Check:

```bash
nslookup podmark.habiibullahm.my.id 1.1.1.1
```

## 3. Coolify

Go to https://coolify.habiibullahm.my.id -> Projects -> production -> + New -> **Docker Image**.

- Image name: `ghcr.io/habiibullahm/podmark`
- Tag: `latest` (for fully pinned rollbacks, use the commit-SHA tag)
- Server: `localhost`
- Ports Exposes: **3000** (the container must receive traffic on this port)
- Domain: `https://podmark.habiibullahm.my.id`
- Health check: `/healthz` on port `3000` (Coolify's check runs `curl` inside the container; the image includes it)
- Persistent storage: none required for the Node frontend/API container

Leave container ports private; expose the public site through the Coolify Traefik proxy.

### Runtime environment (Coolify only)

| Name | When needed | Notes |
|---|---|---|
| `SUMOPOD_API_KEY` | AI summaries, SumoPod provider | Server-only secret |
| `SUMOPOD_MODEL` | Optional | Must be allowed by the key |
| `GROQ_API_KEY` | Transcription; summary fallback | **Use a valid, current key** |
| `GROQ_MODEL` | Optional summary fallback | Defaults in backend |
| `NEON_AUTH_URL` | Session verification on paid AI endpoints | Same value as `VITE_NEON_AUTH_URL`; not a secret |
| `GETYOUTUBETRANSCRIPT_API_KEY` | Optional YouTube transcript provider | Server-only secret |
| `WEBSHARE_PROXY_USERNAME` / `WEBSHARE_PROXY_PASSWORD` | Optional residential proxy for YouTube transcripts | Server-only secret |
| `RATE_LIMIT_*` | Optional | See *Abuse protection* |
| `PORT` | Optional | Defaults to 3000 |

The container never connects to Postgres directly, so no database connection string belongs in Coolify. The Neon owner connection string is only for `npm run db:migrate` / `db:verify` from a trusted machine.

The Groq key used in an earlier PodMark environment was reported expired on October 4, 2026. Replace it before testing transcription.

Add `https://podmark.habiibullahm.my.id` as a Neon Auth trusted domain on the branch: `neon neon-auth domain add https://podmark.habiibullahm.my.id --project-id <id> --branch production`.

## 4. Automatic database migrations

On every push to `master`, the **migrate** job applies `backend/neon/migrations/*.sql` to Neon and runs the RLS check (`npm run db:verify`, which writes and deletes rows for two fake user ids only) **before** Coolify redeploys. Add the Neon `production` branch owner connection string as a repository **secret** — never a variable, and never in chat or a file:

```bash
gh secret set NEON_DATABASE_URL --repo habiibullahm/podmark
```

(`gh` prompts for the value, so it stays out of shell history.) Get it with `neon connection-string production --project-id bold-salad-14698024 --database-name neondb --role-name neondb_owner`. Without the secret, the job is skipped with a note in the run summary.

Migrations run while the previous image is still serving, so keep them backward compatible: add tables/columns, don't rename or drop in the same release. Every migration must be re-runnable (`if not exists`, `drop … if exists`).

## 5. Automatic redeploy (optional)

Once the Coolify Docker Image resource exists, obtain its deployment webhook and an access token. In GitHub repository **Actions secrets** configure `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN`. The workflow triggers Coolify after publishing the image. Without these secrets, the image is still published and you can click **Redeploy** in Coolify manually.

For stronger reproducibility, deploy and retain the image's immutable SHA tag, not only `latest`.

### CI pipeline

`.github/workflows/publish-coolify.yml` runs four jobs:

1. **test** — typecheck, lint, frontend build, Neon Auth JWT tests, smoke/security tests against the Node server, Playwright e2e (desktop + mobile Chrome).
2. **image** — builds the Docker image, starts it, waits for the Docker `HEALTHCHECK`, re-runs the smoke/security suite **against the container**, and checks it runs as non-root and stops gracefully. Only on `master` does it push `:<sha>` and `:latest` to GHCR.
3. **migrate** — `master` only: applies Neon migrations and verifies RLS (needs `NEON_DATABASE_URL`).
4. **deploy** — `master` only, after migrate: calls the Coolify webhook if configured.

Pull requests never push images or deploy.

### Rollback

Every `master` commit publishes an immutable `ghcr.io/habiibullahm/podmark:<commit-sha>` (listed in the run summary). To roll back, set the Coolify resource's image tag to a previous SHA and redeploy; set it back to `latest` to resume automatic deploys.

## 6. Verification checklist

1. Coolify shows **Healthy** on `/healthz`.
2. `curl -i https://podmark.habiibullahm.my.id/healthz` returns 200 JSON.
3. `curl -I https://podmark.habiibullahm.my.id/` returns 200 HTML.
4. `POST /api/youtube` and `POST /api/youtube-transcript` with an invalid URL return a controlled 400.
5. Unauthenticated `POST /api/summarize` returns **401**, not a billed provider call.
6. Create an account / sign in on the Profile screen, add an episode, and confirm it syncs to a second browser signed into the same account.
7. Test summary and transcription with a small, authorized episode, then inspect logs without exposing tokens.
8. Test mobile PWA install, refresh, and static assets.
9. Monitor `free -h`, `df -h /`, container memory/CPU, and Hermes gateway resource usage.

Do **not** repoint the existing Vercel production domain or decommission the Vercel app until all functionality is validated. For rollback, switch the Coolify image back to a previously published SHA tag.

## Local development / smoke test

```bash
npm ci
npm run typecheck
npm run build
npm run test:api                  # Neon Auth JWT tests; also compiles backend/ to build/
node tests/deployment-smoke.mjs   # starts the server itself; no provider is called

# or against a container (the test serves a stand-in Neon Auth JWKS on :31688):
docker build -t podmark:local .
docker run -d --name podmark-smoke -p 3000:3000 --add-host=host.docker.internal:host-gateway   -e NEON_AUTH_URL=http://host.docker.internal:31688/neondb/auth   -e RATE_LIMIT_SUMMARIZE_PER_USER_HOUR=2 -e RATE_LIMIT_YT_TRANSCRIPT_PER_HOUR=3 podmark:local
SMOKE_BASE_URL=http://127.0.0.1:3000 SMOKE_NEON_AUTH_URL=http://host.docker.internal:31688/neondb/auth   node tests/deployment-smoke.mjs
```

The legacy Vercel setup remains unchanged: Vercel still builds `frontend/dist` and discovers `api/*.ts` as functions.
