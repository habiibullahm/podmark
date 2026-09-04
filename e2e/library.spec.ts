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
