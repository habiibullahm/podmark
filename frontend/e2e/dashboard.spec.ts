import { test, expect } from "@playwright/test";
import { getGreeting } from "../src/lib/format";

test.describe("Dashboard", () => {
  test("renders core widgets", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("button", { name: /Resume Listening|Start Listening/ })).toBeVisible();
    await expect(page.getByText(/min today/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Takeaways" })).toBeVisible();
  });

  test("renders the mobile greeting header on narrow viewports", async ({ page }) => {
    // AppHeader is md:hidden — the sidebar shows identity/streak instead on
    // wider viewports, so this needs a real mobile-sized viewport.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(page.getByText(getGreeting())).toBeVisible();
  });

  test("Resume Listening navigates to episode detail and starts playback", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /Resume Listening|Start Listening/ }).click();

    await expect(page).toHaveURL(/#\/episode\//);
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("Jump to Notes navigates to the episode's detail screen", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Jump to Notes" }).click();

    await expect(page).toHaveURL(/#\/episode\//);
    await expect(page.getByPlaceholder(/Write freeform Markdown notes/)).toBeVisible();
  });

  test("See all navigates to the Library screen", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "See all" }).click();

    await expect(page).toHaveURL(/#\/library/);
  });
});
