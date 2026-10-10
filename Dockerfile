# GitHub Actions builds the image; the VPS only pulls and runs it.
FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
RUN npm ci --no-audit --no-fund

COPY . .
# Vite embeds these public browser values at BUILD time (Neon Auth and Data
# API endpoints — not secrets; the browser calls them directly).
ARG VITE_NEON_AUTH_URL=""
ARG VITE_NEON_DATA_API_URL=""
ENV VITE_NEON_AUTH_URL=${VITE_NEON_AUTH_URL}
ENV VITE_NEON_DATA_API_URL=${VITE_NEON_DATA_API_URL}
RUN npm run build && ./node_modules/.bin/tsc -p tsconfig.deploy.json

FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.source="https://github.com/habiibullahm/podmark" \
      org.opencontainers.image.description="PodMark PWA + API server"
WORKDIR /app
# TRUST_PROXY: the container is only reachable through Coolify's proxy, so the
# right-most X-Forwarded-For hop is the real client (used for rate limits).
ENV NODE_ENV=production PORT=3000 TRUST_PROXY=1

# curl for health checks: Coolify's own health check runs curl/wget inside the
# container, and the slim base image ships neither — without it Coolify marks
# the container unhealthy and its proxy never routes to it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/package.json
COPY backend/package.json ./backend/package.json
# Only the backend's runtime deps — the frontend ships as static files.
RUN npm ci --omit=dev --workspace=backend --no-audit --no-fund && npm cache clean --force

COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/build ./build
COPY --from=build /app/server ./server

USER node
EXPOSE 3000
# Shell form so it follows PORT if the platform overrides it.
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-3000}/healthz" >/dev/null || exit 1
CMD ["node", "server/index.mjs"]
