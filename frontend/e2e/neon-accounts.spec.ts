import { test, expect, type Page, type Request } from "@playwright/test";
import { NEON_TEST_AUTH_URL as AUTH, NEON_TEST_DATA_API_URL as DATA } from "../playwright.config";

// Accounts against a fake Neon: the app is built with VITE_NEON_* pointing at
// *.neon.test (see playwright.config.ts) and every Neon Auth / Data API call
// is answered here. This pins the client-side contract — Neon Auth's
// Supabase-compatible adapter, the JWT in `set-auth-jwt`, and the exact
// Data API requests sync.ts makes. Real JWT verification is covered by
// tests/auth.test.mjs and RLS by `npm run db:verify`.

const TABLES = ["episodes", "notes", "freeform_notes", "ai_summaries", "folders", "settings", "activity", "progress", "transcripts"];
const USER = { id: "user-demo-1", email: "demo@example.com", name: "", emailVerified: true, createdAt: "2026-10-10T00:00:00.000Z", updatedAt: "2026-10-10T00:00:00.000Z" };

function fakeJwt(sub: string): string {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${part({ alg: "EdDSA", kid: "test" })}.${part({ sub, role: "authenticated", iat: now, exp: now + 900 })}.c2ln`;
}

interface FakeNeon {
  jwt: string;
  dataRequests: Request[];
  signedIn: boolean;
}

async function fakeNeon(page: Page, { signedIn = false, rejectPassword = false } = {}): Promise<FakeNeon> {
  const origin = new URL(page.url() === "about:blank" ? "http://localhost:5174" : page.url()).origin;
  const state: FakeNeon = { jwt: fakeJwt(USER.id), dataRequests: [], signedIn };
  const cors = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "authorization, content-type, prefer, accept, x-neon-client-info, accept-profile, content-profile, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Expose-Headers": "set-auth-jwt",
  };
  const session = () => ({
    session: { id: "sess-1", token: "opaque-session-token", userId: USER.id, expiresAt: new Date(Date.now() + 7 * 864e5).toISOString(), createdAt: USER.createdAt, updatedAt: USER.updatedAt },
    user: USER,
  });

  await page.route(`${AUTH}/**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.replace("/neondb/auth", "");
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const json = (status: number, body: unknown, extra: Record<string, string> = {}) =>
      route.fulfill({ status, headers: { ...cors, ...extra }, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/get-session") {
      return state.signedIn ? json(200, session(), { "set-auth-jwt": state.jwt }) : json(200, null);
    }
    if (path === "/sign-in/email" || path === "/sign-up/email") {
      if (rejectPassword) return json(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "Invalid email or password" });
      state.signedIn = true;
      return json(200, { redirect: false, token: "opaque-session-token", user: USER });
    }
    if (path === "/sign-out") {
      state.signedIn = false;
      return json(200, { success: true });
    }
    if (path === "/token") return state.signedIn ? json(200, { token: state.jwt }) : json(401, { message: "Unauthorized" });
    return json(404, { message: `unmocked ${path}` });
  });

  await page.route(`${DATA}/**`, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    state.dataRequests.push(request);
    return route.fulfill({ status: request.method() === "POST" ? 201 : 200, headers: cors, contentType: "application/json", body: "[]" });
  });

  return state;
}

const tableOf = (request: Request) => new URL(request.url()).pathname.split("/").pop() ?? "";

async function signIn(page: Page) {
  await page.goto("/#/profile");
  await page.getByPlaceholder("you@example.com").fill(USER.email);
  await page.getByPlaceholder("Password").fill("correct horse battery staple");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

test.describe("Accounts (Neon Auth + Data API)", () => {
  test("email/password sign-in syncs all 9 tables with the Neon JWT", async ({ page }) => {
    const neon = await fakeNeon(page);
    await signIn(page);

    await expect(page.getByText(`Signed in as ${USER.email}`)).toBeVisible();
    await expect(page.getByText("Synced just now")).toBeVisible();

    // Pull: one select per table, every request authorised with the JWT —
    // never the opaque session token.
    const reads = neon.dataRequests.filter((r) => r.method() === "GET");
    expect(new Set(reads.map(tableOf))).toEqual(new Set(TABLES));
    for (const request of neon.dataRequests) {
      expect(request.headers()["authorization"]).toBe(`Bearer ${neon.jwt}`);
    }

    // Push: first merge uploads the local library as upserts keyed on the
    // composite primary keys, never sending user_id (the DB fills it from
    // the JWT via auth.user_id(), and RLS rejects anything else).
    const episodesWrite = neon.dataRequests.find((r) => r.method() === "POST" && tableOf(r) === "episodes");
    expect(episodesWrite, "episodes upsert").toBeTruthy();
    expect(new URL(episodesWrite!.url()).searchParams.get("on_conflict")).toBe("user_id,id");
    expect(episodesWrite!.headers()["prefer"]).toContain("resolution=merge-duplicates");
    const rows = episodesWrite!.postDataJSON() as Record<string, unknown>[];
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row).not.toHaveProperty("user_id");

    const settingsWrite = neon.dataRequests.find((r) => r.method() === "POST" && tableOf(r) === "settings");
    expect(new URL(settingsWrite!.url()).searchParams.get("on_conflict")).toBe("user_id");
  });

  test("session survives a reload without signing in again", async ({ page }) => {
    await fakeNeon(page);
    await signIn(page);
    await expect(page.getByText(`Signed in as ${USER.email}`)).toBeVisible();

    await page.reload();
    await expect(page.getByText(`Signed in as ${USER.email}`)).toBeVisible();
    await expect(page.getByPlaceholder("Password")).not.toBeVisible();
  });

  test("offers email/password only — magic link is hidden", async ({ page }) => {
    await fakeNeon(page);
    await page.goto("/#/profile");
    await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Magic link" })).toHaveCount(0);
  });

  test("a wrong password shows the error and stays signed out", async ({ page }) => {
    const neon = await fakeNeon(page, { rejectPassword: true });
    await signIn(page);

    await expect(page.getByText("Invalid email or password")).toBeVisible();
    await expect(page.getByText(`Signed in as ${USER.email}`)).not.toBeVisible();
    expect(neon.dataRequests).toHaveLength(0);
  });

  test("sign-out returns to the sign-in form and stops syncing", async ({ page }) => {
    const neon = await fakeNeon(page);
    await signIn(page);
    await expect(page.getByText("Synced just now")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
    await expect(page.getByText("Guest").first()).toBeVisible();

    const before = neon.dataRequests.length;
    await page.goto("/#/episode/ep-1");
    await page.waitForTimeout(1500);
    expect(neon.dataRequests.length).toBe(before);
  });

  test("AI summary is gated on sign-in and sends the Neon JWT", async ({ page }) => {
    const neon = await fakeNeon(page);
    let summarizeAuth: string | undefined;
    await page.route("**/api/summarize", (route) => {
      summarizeAuth = route.request().headers()["authorization"];
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ bullets: ["Mocked insight"] }) });
    });

    await page.goto("/#/episode/ep-1");
    await expect(page.getByText("Sign in to use AI summary")).toBeVisible();

    await signIn(page);
    await expect(page.getByText(`Signed in as ${USER.email}`)).toBeVisible();
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "AI Summarize Episode" }).click();

    await expect(page.getByText("Mocked insight")).toBeVisible();
    expect(summarizeAuth).toBe(`Bearer ${neon.jwt}`);
  });
});
