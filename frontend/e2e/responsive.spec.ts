import { test, expect, type Page } from "@playwright/test";

// Layout smoke test for the app shell at the four reference widths: no
// horizontal overflow on any screen, the right navigation for the size, the
// utility panel only on desktop (and not on the episode workspace), and only
// ever one set of player controls on the page.
const SIZES = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "laptop", width: 1024, height: 768 },
  { name: "desktop", width: 1440, height: 900 },
];
const ROUTES = ["/#/", "/#/discover", "/#/library", "/#/episode/ep-1", "/#/insights", "/#/profile"];

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

for (const size of SIZES) {
  test.describe(`${size.name} (${size.width}px)`, () => {
    test.use({ viewport: { width: size.width, height: size.height } });
    // Viewport is fixed here, so one browser project is enough.
    test.skip(({ isMobile }) => isMobile, "layout runs once, in the desktop Chrome project");

    test("every screen fits without horizontal scrolling", async ({ page }) => {
      for (const route of ROUTES) {
        await page.goto(route);
        await expect(page.locator("main#main")).toBeVisible();
        expect(await horizontalOverflow(page), route).toBeLessThanOrEqual(0);
      }
    });

    test("shows the navigation and utility zones for this size", async ({ page }) => {
      await page.goto("/#/library");
      const bottomNav = page.getByRole("navigation", { name: "Main" });
      const panel = page.getByRole("complementary", { name: "Listening and goals" });

      if (size.width < 768) {
        await expect(bottomNav.getByRole("link", { name: "Discover", exact: true })).toBeVisible();
        await expect(page.getByRole("complementary", { name: "Primary" })).toBeHidden();
      } else {
        await expect(page.getByRole("complementary", { name: "Primary" })).toBeVisible();
      }

      if (size.width >= 1024) {
        await expect(panel).toBeVisible();
        await page.goto("/#/episode/ep-1");
        await expect(panel).toHaveCount(0);
      } else {
        await expect(panel).toHaveCount(0);
      }
    });

    test("only one set of player controls exists at a time", async ({ page }) => {
      await page.goto("/#/episode/ep-1");
      await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(1);
      await page.goto("/#/library");
      await expect(page.getByRole("button", { name: "Play", exact: true })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "Dismiss" })).toHaveCount(1);
    });
  });
}

test.describe("dark theme", () => {
  test.use({ colorScheme: "dark", viewport: { width: 1440, height: 900 } });
  test.skip(({ isMobile }) => isMobile, "theme runs once, in the desktop Chrome project");

  test("follows the system preference with dark surfaces", async ({ page }) => {
    await page.goto("/#/");
    const [canvas, text] = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return [style.backgroundColor, style.color];
    });
    expect(canvas).toBe("rgb(13, 14, 18)");
    expect(text).toBe("rgb(242, 243, 247)");
  });
});
