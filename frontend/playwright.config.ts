import { defineConfig, devices } from "@playwright/test";

// Fake Neon endpoints for the accounts specs (e2e/neon-*.spec.ts). Nothing is
// served at these hosts — every request is intercepted with page.route().
export const NEON_TEST_AUTH_URL = "https://auth.neon.test/neondb/auth";
export const NEON_TEST_DATA_API_URL = "https://data.neon.test/neondb/rest/v1";

// Anchored to the file name: Playwright matches against the absolute path.
const ACCOUNTS_SPECS = /[\\/]neon-[^\\/]*\.spec\.ts$/;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "html",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", testIgnore: ACCOUNTS_SPECS, use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chrome", testIgnore: ACCOUNTS_SPECS, use: { ...devices["Pixel 7"] } },
    {
      name: "accounts",
      testMatch: ACCOUNTS_SPECS,
      use: { ...devices["Desktop Chrome"], baseURL: "http://localhost:5174" },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      // The suite's baseline guarantee is that the app works fully signed-out
      // with no Neon Auth project configured — that's what keeps every non-auth
      // spec valid regardless of accounts. Force that here so a developer's own
      // frontend/.env.local can't silently make this run exercise a different,
      // non-hermetic code path.
      // API_PROXY_TARGET="" keeps /api/* off production; specs mock it.
      env: { VITE_NEON_AUTH_URL: "", VITE_NEON_DATA_API_URL: "", API_PROXY_TARGET: "" },
    },
    {
      // Same app with accounts switched on, pointed at the fake Neon hosts.
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://localhost:5174",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
      env: { VITE_NEON_AUTH_URL: NEON_TEST_AUTH_URL, VITE_NEON_DATA_API_URL: NEON_TEST_DATA_API_URL, API_PROXY_TARGET: "" },
    },
  ],
});
