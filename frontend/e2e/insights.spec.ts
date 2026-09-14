import { test, expect } from "@playwright/test";

test.describe("Insights", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/insights");
  });

  test("shows stat cards and the weekly listening chart", async ({ page }) => {
    await expect(page.getByText("Current streak")).toBeVisible();
    await expect(page.getByText("Episodes finished")).toBeVisible();
    await expect(page.getByText("Notes captured")).toBeVisible();
    await expect(page.getByText("Listening time — last 7 days")).toBeVisible();
  });

  test("lists most-used tags with counts", async ({ page }) => {
    await expect(page.getByText("Most-used tags")).toBeVisible();
    await expect(page.getByText("×2")).toBeVisible();
  });

  test("clicking a notes-per-episode row navigates to that episode", async ({ page }) => {
    await page.getByText("Notes per episode").scrollIntoViewIfNeeded();
    await page
      .getByText("Building a Second Brain: The Case for Structured Notes")
      .click();

    await expect(page).toHaveURL(/#\/episode\/ep-1/);
  });
});
