import { test, expect } from "@playwright/test";

test.describe("Library edit and remove", () => {
  test("removing an episode cascades its notes, folder membership, and progress", async ({ page }) => {
    // Legacy raw-shape progress data, as PlayerContext used to write it
    // directly — exercises the useProgressStore migration as part of the
    // cascade-delete assertion below.
    await page.addInitScript(() => {
      localStorage.setItem("podmark-progress", JSON.stringify({ "ep-1": 500 }));
    });

    await page.goto("/#/episode/ep-1");

    await page.getByRole("button", { name: "⋯" }).click();
    await page.getByText("Remove from Library").click();
    await expect(page.getByText(/Remove ".*" and its 2 notes/)).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page).toHaveURL(/#\/library$/);
    await expect(
      page.getByText("Building a Second Brain: The Case for Structured Notes"),
    ).not.toBeVisible();

    await page.getByRole("button", { name: "Takeaways", exact: true }).click();
    await expect(
      page.getByText("You don't rise to the level of your goals"),
    ).not.toBeVisible();
    await expect(page.getByText("Three-tier note system")).not.toBeVisible();

    await page.getByRole("button", { name: "Folders", exact: true }).click();
    await page.getByText("Q3 Learning Sprint").click();
    await expect(
      page.getByText("Building a Second Brain: The Case for Structured Notes"),
    ).not.toBeVisible();
    await expect(page.getByText("How Transformers Actually Work, Explained Simply")).toBeVisible();

    const progressAfter = await page.evaluate(() => {
      const raw = localStorage.getItem("podmark-progress");
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return parsed.state?.progressByEpisode?.["ep-1"];
    });
    expect(progressAfter).toBeUndefined();
  });

  test("cancelling the remove confirmation keeps the episode", async ({ page }) => {
    await page.goto("/#/episode/ep-1");

    await page.getByRole("button", { name: "⋯" }).click();
    await page.getByText("Remove from Library").click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    await expect(
      page.getByText("Building a Second Brain: The Case for Structured Notes").first(),
    ).toBeVisible();
  });

  test("edits a timestamp note's text", async ({ page }) => {
    await page.goto("/#/episode/ep-1");

    await page.getByRole("button", { name: "Note options — 15:02" }).click();
    await page.getByText("Edit", { exact: true }).click();

    const textarea = page.locator("textarea").last();
    await textarea.fill("Updated: three-tier system, edited via e2e test");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Updated: three-tier system, edited via e2e test")).toBeVisible();
    await expect(page.getByText("Three-tier note system: capture")).not.toBeVisible();
  });

  test("deletes a highlight", async ({ page }) => {
    await page.goto("/#/episode/ep-1");

    await page.getByRole("button", { name: "Highlight options — 12:34" }).click();
    await page.getByText("Delete", { exact: true }).click();
    await expect(page.getByText("Delete this highlight?")).toBeVisible();
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    await expect(
      page.getByText("You don't rise to the level of your goals"),
    ).not.toBeVisible();
  });

  test("clears an AI summary", async ({ page }) => {
    await page.goto("/#/episode/ep-1");

    await page.route("/api/summarize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bullets: ["A bullet to be cleared."] }),
      }),
    );

    await page.getByRole("button", { name: "AI Summarize Episode" }).click();
    await expect(page.getByText("AI Summary")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await expect(page.getByText("AI Summary")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "AI Summarize Episode" })).toBeVisible();
  });
});
