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
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("E2E Mock Episode")).toBeVisible();
    await expect(page.getByText("E2E Mock Show")).toBeVisible();

    await page.getByRole("button", { name: "+ Add to Library" }).click();
    await expect(page.getByRole("button", { name: "✓ In Library" })).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    expect(stored).toContain("itunes-999888777");
    expect(stored).toContain("https://example.com/audio.mp3");
  });

  test("added episode's tag appears in the Library tag filter row", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ITUNES_RESPONSE),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "+ Add to Library" }).click();

    // The tag filter row is hidden on Discover (it filters your own library,
    // not search results), so check it where it actually lives. A newly-added
    // episode's tag ("technology") appearing there proves the shared episodes
    // store updated.
    // exact: true so this matches the filter chip alone — the episode card is
    // itself a button whose accessible name also contains "#technology".
    await page.getByRole("button", { name: "Episodes" }).click();
    await expect(page.getByRole("button", { name: "#technology", exact: true })).toBeVisible();
  });

  test("clicking an added card navigates to its episode detail", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ITUNES_RESPONSE),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "+ Add to Library" }).click();
    await expect(page.getByRole("button", { name: "✓ In Library" })).toBeVisible();

    // Newly-added episodes start "not-started", so they don't show up in any
    // Library tab — clicking the now-added Discover card is the only way back
    // to it, and must route to its episode detail page.
    await page.getByText("E2E Mock Episode").click();

    await expect(page).toHaveURL(/#\/episode\/itunes-999888777/);
    await expect(page.getByText("E2E Mock Episode").first()).toBeVisible();
  });

  test("the In Library button opens the episode too", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(MOCK_ITUNES_RESPONSE),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("test query");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await page.getByRole("button", { name: "+ Add to Library" }).click();

    // The post-add button is the obvious focal point, so it must be a way in
    // rather than a dead disabled pill.
    await page.getByRole("button", { name: "✓ In Library" }).click();
    await expect(page).toHaveURL(/#\/episode\/itunes-999888777/);
  });

  test("shows an error state when the search request fails", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) => route.abort("failed"));

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("test query");
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
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("zzzznoresults");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText(/No episodes found/)).toBeVisible();
  });
});
