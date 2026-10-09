# PodMark on Coolify (Sumopod VPS)

This deployment **does not require a database on the VPS**. It serves the Vite PWA and the existing `/api/*` behavior from one Node.js container. Supabase stays managed. The existing Vercel deployment continues to work.

## Architecture

GitHub Actions (tests, Docker image build) -> GHCR -> Coolify Docker Image -> VPS (port 3000) -> Traefik HTTPS. Coolify does not build source on the 4 GB VPS.

Endpoints: `GET /healthz`, `POST /api/youtube`, `POST /api/summarize`, `POST /api/transcribe`, and static PWA assets. Paid AI endpoints continue to **require a verified Supabase session**.

## 1. GitHub configuration

In repository **Settings > Secrets and variables > Actions > Variables** set the PUBLIC Vite build variables:

- `VITE_SUPABASE_URL`: URL of the existing managed Supabase project.
- `VITE_SUPABASE_ANON_KEY`: browser-safe Supabase anon/publishable key supported by this app.

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
- Health check: `/healthz`
- Persistent storage: none required for the Node frontend/API container

Leave container ports private; expose the public site through the Coolify Traefik proxy.

### Runtime environment (Coolify only)

| Name | When needed | Notes |
|---|---|---|
| `SUMOPOD_API_KEY` | AI summaries, SumoPod provider | Server-only secret |
| `SUMOPOD_MODEL` | Optional | Must be allowed by the key |
| `GROQ_API_KEY` | Transcription; summary fallback | **Use a valid, current key** |
| `GROQ_MODEL` | Optional summary fallback | Defaults in backend |
| `SUPABASE_URL` | ES256/JWKS JWT validation | Use same Supabase project as frontend |
| `SUPABASE_JWT_SECRET` | Legacy HS256 JWT validation | Do not set a guessed value |
| `PORT` | Optional | Defaults to 3000 |

For session verification, configure the JWT setting appropriate to the Supabase signing algorithm. If ES256, set `SUPABASE_URL`; for legacy HS256, use its proper JWT secret (optionally `SUPABASE_URL` for JWKS-first / HS256-fallback behavior). Never put the Supabase service-role key into the frontend or this deployment.

The Groq key used in an earlier PodMark environment was reported expired on October 4, 2026. Replace it before testing transcription.

Add `https://podmark.habiibullahm.my.id` to Supabase Authentication redirect allow-list. If this becomes the primary app URL, update the Supabase Site URL accordingly, while retaining any needed Vercel preview/legacy redirects.

## 4. Automatic redeploy (optional)

Once the Coolify Docker Image resource exists, obtain its deployment webhook and an access token. In GitHub repository **Actions secrets** configure `COOLIFY_WEBHOOK` and `COOLIFY_TOKEN`. The workflow triggers Coolify after publishing the image. Without these secrets, the image is still published and you can click **Redeploy** in Coolify manually.

For stronger reproducibility, deploy and retain the image's immutable SHA tag, not only `latest`.

## 5. Verification checklist

1. Coolify shows **Healthy** on `/healthz`.
2. `curl -i https://podmark.habiibullahm.my.id/healthz` returns 200 JSON.
3. `curl -I https://podmark.habiibullahm.my.id/` returns 200 HTML.
4. `POST /api/youtube` with invalid URL returns a controlled 400.
5. Unauthenticated `POST /api/summarize` returns **401**, not a billed provider call.
6. Login via Supabase and confirm a valid session.
7. Test summary and transcription with a small, authorized episode, then inspect logs without exposing tokens.
8. Test mobile PWA install, refresh, and static assets.
9. Monitor `free -h`, `df -h /`, container memory/CPU, and Hermes gateway resource usage.

Do **not** repoint the existing Vercel production domain or decommission the Vercel app until all functionality is validated. For rollback, switch the Coolify image back to a previously published SHA tag.

## Local development / smoke test

```bash
npm ci
npm run typecheck
npm run build
./node_modules/.bin/tsc -p tsconfig.deploy.json
node server/index.mjs
# in another terminal:
curl -i http://localhost:3000/healthz
```

The legacy Vercel setup remains unchanged: Vercel still builds `frontend/dist` and discovers `api/*.ts` as functions.
