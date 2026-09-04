import { test, expect } from "@playwright/test";

test.describe("Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/profile");
  });

  test("shows the user summary and settings sections", async ({ page }) => {
    await expect(page.getByText("12 day streak · 5 episodes")).toBeVisible();
    await expect(page.getByText("Daily goal")).toBeVisible();
    await expect(page.getByText("Notifications")).toBeVisible();
    await expect(page.getByText("Export", { exact: true })).toBeVisible();
  });

  test("daily goal +/- adjusts and persists across reload", async ({ page }) => {
    await expect(page.getByText("30 min / day")).toBeVisible();

    await page.getByRole("button", { name: "Increase daily goal" }).click();
    await page.getByRole("button", { name: "Increase daily goal" }).click();
    await expect(page.getByText("40 min / day")).toBeVisible();

    await page.reload();
    await expect(page.getByText("40 min / day")).toBeVisible();
  });

  test("notification toggle flips aria-checked and persists", async ({ page }) => {
    const toggle = page.getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", "true");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await page.reload();
    await expect(page.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  test("export format selection persists across reload", async ({ page }) => {
    await page.getByRole("button", { name: "notion", exact: true }).click();
    await page.reload();

    const notionButton = page.getByRole("button", { name: "notion", exact: true });
    await expect(notionButton).toHaveClass(/border-accent/);
  });
});
