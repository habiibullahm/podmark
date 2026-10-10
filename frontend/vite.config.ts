import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, loadEnv } from 'vite'

// `npm run dev` serves only the frontend; /api/* are Vercel functions. Proxy
// them to a deployed PodMark (production by default) so the full app works
// locally with no API keys on this machine. Local sign-in tokens are valid
// there too (same Neon project). Set API_PROXY_TARGET to another deployment,
// or to an empty string to turn the proxy off (Playwright does).
const DEFAULT_API_PROXY_TARGET = 'https://podmark-ai.vercel.app'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = env.API_PROXY_TARGET ?? DEFAULT_API_PROXY_TARGET

  return {
    server: apiProxyTarget
      ? {
          proxy: {
            '/api': {
              target: apiProxyTarget,
              changeOrigin: true,
              // One terminal line per proxied call (method, path, status,
              // time) — the API runs remotely, so this is the only local trace.
              configure: (proxy) => {
                const started = new WeakMap<object, number>()
                proxy.on('proxyReq', (_proxyReq, req) => {
                  started.set(req, Date.now())
                })
                proxy.on('proxyRes', (proxyRes, req) => {
                  const ms = Date.now() - (started.get(req) ?? Date.now())
                  console.log(`[api] ${req.method} ${req.url} → ${proxyRes.statusCode} (${ms} ms) via ${apiProxyTarget}`)
                })
                proxy.on('error', (err, req) => {
                  console.error(`[api] ${req.method} ${req.url} → proxy error: ${err.message}`)
                })
              },
            },
          },
        }
      : {},
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: {
          name: 'PodMark',
          short_name: 'PodMark',
          description: 'Personal Podcast Tracker & Learning Journal',
          theme_color: '#121212',
          background_color: '#121212',
          display: 'standalone',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
      }),
    ],
  }
})
