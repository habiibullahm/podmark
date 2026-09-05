import { test, expect } from "@playwright/test";

test.describe("Library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/library");
  });

  test("renders with the search bar and defaults to the unified Episodes tab", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByPlaceholder("Search notes, episodes, tags...")).toBeVisible();
    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).toBeVisible();
  });

  test("Episodes tab shows every status — in progress, not started, and finished", async ({ page }) => {
    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).toBeVisible();
    await expect(page.getByText("Reading Financial Statements Like an Investor")).toBeVisible();
    await expect(page.getByText("The Psychology of Compounding Habits")).toBeVisible();
    await expect(page.getByText("✓ Completed").first()).toBeVisible();
  });

  test("switches to Takeaways and shows saved notes", async ({ page }) => {
    await page.getByRole("button", { name: "Takeaways" }).click();

    await expect(
      page.getByText("Three-tier note system: capture -> distill -> express."),
    ).toBeVisible();
  });

  test("switches to Folders", async ({ page }) => {
    await page.getByRole("button", { name: "Folders", exact: true }).click();

    await expect(page.getByText("Q3 Learning Sprint")).toBeVisible();
    await expect(page.getByText("Investing Basics")).toBeVisible();
  });

  test("an episode with unknown duration still counts as started once played", async ({ page }) => {
    // iTunes results without trackTimeMillis map to durationSec 0 but still
    // have real audio, so progress on them must not be ignored just because
    // there's no duration to compare it against.
    // addInitScript rather than evaluate: PlayerContext flushes its progress
    // map to localStorage on pagehide, so anything written before the reload
    // gets clobbered on the way out. An init script lands after that flush.
    await page.addInitScript(() => {
      localStorage.setItem(
        "podmark-episodes",
        JSON.stringify({
          state: {
            episodes: [
              {
                id: "itunes-nodur",
                title: "Unknown Duration Episode",
                show: "Test Show",
                artworkGradient: "linear-gradient(135deg, #6366F1, #312E81)",
                durationSec: 0,
                progressSec: 0,
                status: "not-started",
                tags: [],
                publishedAt: "",
                audioUrl: "https://example.com/audio.mp3",
              },
            ],
          },
          version: 0,
        }),
      );
      localStorage.setItem("podmark-progress", JSON.stringify({ "itunes-nodur": 600 }));
    });

    await page.goto("/#/");
    await page.reload();

    await expect(page.getByText("Unknown Duration Episode")).toBeVisible();
    await expect(page.getByRole("button", { name: /Resume Listening/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Listening/ })).toHaveCount(0);
  });

  test("filters the episode list by tag", async ({ page }) => {
    await page.getByRole("button", { name: "#finance", exact: true }).click();

    await expect(page.getByText("Reading Financial Statements Like an Investor")).toBeVisible();
    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).not.toBeVisible();
  });

  test("search filters the episode list by title", async ({ page }) => {
    await page.getByPlaceholder("Search notes, episodes, tags...").fill("Second Brain");

    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).toBeVisible();
    await expect(page.getByText("How Transformers Actually Work")).not.toBeVisible();
  });

  test("Export All downloads a Markdown file of notes", async ({ page }) => {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export All ↗" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^podmark-export-\d{4}-\d{2}-\d{2}\.md$/);
  });
});
