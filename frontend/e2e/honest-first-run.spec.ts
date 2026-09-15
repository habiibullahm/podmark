import { test, expect } from "@playwright/test";

test.describe("An honest first run", () => {
  test("dismissing the mini player clears it", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Dismiss" }).click();

    await expect(page.getByRole("button", { name: "Dismiss" })).not.toBeVisible();
  });

  test("Escape closes the full-screen player", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "Play", exact: true }).click();
    await page.getByText("Building a Second Brain: The Case for Structured Notes").last().click();

    await expect(page.getByText("Now Playing")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Now Playing")).not.toBeVisible();
  });

  test("Folders tab hides the search bar and tag filters", async ({ page }) => {
    await page.goto("/#/library");
    await page.getByRole("button", { name: "Folders", exact: true }).click();

    await expect(page.getByPlaceholder("Search notes, episodes, tags...")).not.toBeVisible();
  });

  test("Episodes and Takeaways tabs still show the search bar", async ({ page }) => {
    await page.goto("/#/library");
    await expect(page.getByPlaceholder("Search notes, episodes, tags...")).toBeVisible();

    await page.getByRole("button", { name: "Takeaways", exact: true }).click();
    await expect(page.getByPlaceholder("Search notes, episodes, tags...")).toBeVisible();
  });

  test("Jump to Notes scrolls the notes section into view", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "Jump to Notes" }).click();

    await expect(page).toHaveURL(/#\/episode\/.*#notes/);
    await expect(page.locator("#notes")).toBeInViewport();
  });

  test("an empty library shows a call to action instead of a blank list", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem("podmark-episodes", JSON.stringify({ state: { episodes: [] }, version: 2 }));
    });
    await page.goto("/#/");

    await expect(page.getByText("Find your first episode to start tracking what you learn.")).toBeVisible();
    await page.getByRole("button", { name: "Find your first episode" }).click();
    await expect(page).toHaveURL(/#\/library/);
    await expect(page.getByPlaceholder(/Search podcasts, or paste a YouTube link/)).toBeVisible();
  });

  test("an unknown route shows a not-found screen with a way home", async ({ page }) => {
    await page.goto("/#/this-route-does-not-exist");

    await expect(page.getByText("Page not found")).toBeVisible();
    await page.getByRole("button", { name: "Go home" }).click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
