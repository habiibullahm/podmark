import { test, expect } from "@playwright/test";

// This CI/dev environment has no Supabase project configured (no
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY), which is deliberate — it's
// what keeps every other spec in this suite running fully signed-out. These
// tests lock in that "accounts are optional" contract: the identity
// everywhere is the generic "Guest", not a hard-coded person, and Profile
// says plainly that accounts aren't set up rather than pretending sign-in
// works. The actual magic-link flow against a real Supabase project can
// only be verified by hand, in a real browser, once a project exists.
test.describe("Accounts (unconfigured deployment)", () => {
  test("Profile explains accounts aren't set up, with no broken sign-in UI", async ({ page }) => {
    await page.goto("/#/profile");

    await expect(page.getByText("Guest").first()).toBeVisible();
    await expect(page.getByText("Account", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Accounts aren't set up for this deployment yet"),
    ).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).not.toBeVisible();
  });

  test("Sidebar and mobile header show the generic Guest identity", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByText("Guest").first()).toBeVisible();
  });

  test("AI Summarize stays open (not gated) when accounts aren't configured", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await expect(page.getByRole("button", { name: "AI Summarize Episode" })).toBeVisible();
    await expect(page.getByText("Sign in to use AI summary")).not.toBeVisible();
  });
});
