import { test, expect } from "@playwright/test";

const MOCK_ITUNES_RESPONSE = {
  resultCount: 1,
  results: [
    {
      trackId: 999888777,
      trackName: "E2E Mock Episode",
      collectionName: "E2E Mock Show",
      artworkUrl600: "https://example.com/art.jpg",
      episodeUrl: "https://example.com/audio.mp3",
      trackTimeMillis: 600000,
      releaseDate: "2026-01-01T00:00:00Z",
      genres: [{ id: "1318", name: "Technology" }],
    },
  ],
};

test.describe("Discover (real podcast search)", () => {
  test("searches and adds an episode to the library", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ITUNES_RESPONSE),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search real podcasts & episodes...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("E2E Mock Episode")).toBeVisible();
    await expect(page.getByText("E2E Mock Show")).toBeVisible();

    await page.getByRole("button", { name: "+ Add" }).click();
    await expect(page.getByRole("button", { name: "✓ Added" })).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    expect(stored).toContain("itunes-999888777");
    expect(stored).toContain("https://example.com/audio.mp3");
  });

  test("added episode appears in the In Progress/library elsewhere after adding", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ITUNES_RESPONSE),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search real podcasts & episodes...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "+ Add" }).click();

    // A newly-added episode's tag ("technology") should now appear in the
    // library-wide tag filter row, proving the shared episodes store updated.
    await expect(page.getByRole("button", { name: "#technology" })).toBeVisible();
  });

  test("shows an error state when the search request fails", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) => route.abort("failed"));

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search real podcasts & episodes...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText(/Couldn't reach the podcast search service/)).toBeVisible();
  });

  test("shows an empty state for a query with no results", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ resultCount: 0, results: [] }),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search real podcasts & episodes...").fill("zzzznoresults");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText(/No episodes found/)).toBeVisible();
  });
});
