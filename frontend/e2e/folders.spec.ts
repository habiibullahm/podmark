import { test, expect } from "@playwright/test";

test.describe("Custom Folders", () => {
  test("clicking a seeded folder shows its real episodes", async ({ page }) => {
    await page.goto("/#/library");
    await page.getByRole("button", { name: "Folders", exact: true }).click();

    await page.getByText("Q3 Learning Sprint").click();

    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes")).toBeVisible();
    await expect(page.getByText("How Transformers Actually Work, Explained Simply")).toBeVisible();

    await page.getByText("← All Folders").click();
    await expect(page.getByText("Q3 Learning Sprint")).toBeVisible();
    await expect(page.getByText("Investing Basics")).toBeVisible();
  });

  test("creates a new folder and adds an episode to it via the episode detail menu", async ({ page }) => {
    await page.goto("/#/library");
    await page.getByRole("button", { name: "Folders", exact: true }).click();

    await page.getByRole("button", { name: "+ New Folder" }).click();
    await page.getByPlaceholder("Folder name...").fill("Deep Focus");
    await page.getByRole("button", { name: "Create", exact: true }).click();

    await expect(page.getByText("Deep Focus")).toBeVisible();
    await expect(page.getByText("0 items")).toBeVisible();

    await page.goto("/#/episode/ep-4");
    await page.getByRole("button", { name: "⋯" }).click();
    await page.getByText("Deep Focus").click();

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Folders", exact: true }).click();
    await page.getByText("Deep Focus").click();

    await expect(page.getByText("Reading Financial Statements Like an Investor").first()).toBeVisible();
  });

  test("the add-to-folder menu closes when clicking elsewhere on the page", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "⋯" }).click();

    await expect(page.getByText("Add to folder")).toBeVisible();

    await page.getByText("Notes", { exact: true }).click();

    await expect(page.getByText("Add to folder")).not.toBeVisible();
  });
});
