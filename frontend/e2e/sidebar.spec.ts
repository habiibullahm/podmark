import { test, expect } from "@playwright/test";

// Sidebar only renders at md:+ widths — force a wide viewport regardless of
// which project (including mobile-chrome) runs this file.
test.use({ viewport: { width: 1280, height: 800 } });

test.describe("Collapsible sidebar", () => {
  test("toggles collapsed state and persists across reload", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("PodMark")).toBeVisible();

    await page.getByRole("button", { name: "Collapse sidebar" }).click();
    await expect(page.getByText("PodMark")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Expand sidebar" })).toBeVisible();

    await page.reload();
    await expect(page.getByText("PodMark")).not.toBeVisible();

    await page.getByRole("button", { name: "Expand sidebar" }).click();
    await expect(page.getByText("PodMark")).toBeVisible();
  });

  test("navigates between screens via the sidebar", async ({ page }) => {
    await page.goto("/");

    // Accessible names include the icon glyph (e.g. "🎧 Library"), so match
    // by substring rather than exact text.
    await page.getByRole("link", { name: /Library/ }).click();
    await expect(page).toHaveURL(/#\/library/);

    await page.getByRole("link", { name: /Home/ }).click();
    await expect(page).toHaveURL(/#\/$/);
  });
});
