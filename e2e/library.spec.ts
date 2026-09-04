import { test, expect } from "@playwright/test";

test.describe("Library", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/library");
  });

  test("renders with the search bar and defaults to In Progress", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Library" })).toBeVisible();
    await expect(page.getByPlaceholder("Search notes, episodes, tags...")).toBeVisible();
    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).toBeVisible();
  });

  test("switches to Finished and shows completed episodes", async ({ page }) => {
    await page.getByRole("button", { name: "Finished", exact: true }).click();

    await expect(page.getByText("The Psychology of Compounding Habits")).toBeVisible();
    await expect(page.getByText("✓ Completed").first()).toBeVisible();
  });

  test("switches to Key Takeaways and shows saved notes", async ({ page }) => {
    await page.getByRole("button", { name: "Key Takeaways" }).click();

    await expect(
      page.getByText("Three-tier note system: capture -> distill -> express."),
    ).toBeVisible();
  });

  test("switches to Custom Folders", async ({ page }) => {
    await page.getByRole("button", { name: "Custom Folders" }).click();

    await expect(page.getByText("Q3 Learning Sprint")).toBeVisible();
    await expect(page.getByText("Investing Basics")).toBeVisible();
  });

  test("filters the episode list by tag", async ({ page }) => {
    await page.getByRole("button", { name: "#finance" }).click();

    await expect(page.getByText("Nothing in progress")).toBeVisible();

    await page.getByRole("button", { name: "Finished", exact: true }).click();
    await expect(page.getByText("No finished episodes yet.")).toBeVisible();
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

    expect(download.suggestedFilename()).toMatch(/^podbrain-export-\d{4}-\d{2}-\d{2}\.md$/);
  });
});
