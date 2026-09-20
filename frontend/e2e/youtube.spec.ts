import { test, expect } from "@playwright/test";

const MOCK_YOUTUBE_METADATA = {
  videoId: "dQw4w9WgXcQ",
  title: "E2E Mock YouTube Talk",
  channel: "E2E Mock Channel",
  thumbnailUrl: "https://example.com/thumb.jpg",
};

const YOUTUBE_URL = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

// Playwright's webServer runs plain Vite, which doesn't serve /api/* — the
// serverless function is mocked here the same way episode-detail.spec.ts
// mocks /api/summarize.
async function mockMetadata(page: import("@playwright/test").Page) {
  await page.route("/api/youtube", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_YOUTUBE_METADATA),
    }),
  );
}

// Looking up a link only previews it; adding is a second, deliberate step on
// the card — the same shape as a podcast search result.
async function lookupMockVideo(page: import("@playwright/test").Page) {
  await page.goto("/#/library");
  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill(YOUTUBE_URL);
  await page.getByRole("button", { name: "Look up", exact: true }).click();
}

async function addMockVideo(page: import("@playwright/test").Page) {
  await lookupMockVideo(page);
  await page.getByRole("button", { name: "+ Add to Library" }).click();
}

test.describe("YouTube episodes", () => {
  test("looking up a link only previews it — nothing is added until you say so", async ({
    page,
  }) => {
    await mockMetadata(page);
    await lookupMockVideo(page);

    // Preview is on screen with the same add affordance a search result has,
    // and the library is untouched until that button is pressed.
    await expect(page.getByText("E2E Mock YouTube Talk")).toBeVisible();
    await expect(page.getByRole("button", { name: "+ Add to Library" })).toBeVisible();
    const before = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    expect(before ?? "").not.toContain("youtube-dQw4w9WgXcQ");

    await page.getByRole("button", { name: "+ Add to Library" }).click();
    await expect(page.getByRole("button", { name: "✓ In Library" })).toBeVisible();
    const after = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    expect(after).toContain("youtube-dQw4w9WgXcQ");
  });

  test("adds a YouTube video to the library", async ({ page }) => {
    await mockMetadata(page);
    await addMockVideo(page);

    await expect(page.getByText("E2E Mock YouTube Talk")).toBeVisible();
    await expect(page.getByText("E2E Mock Channel")).toBeVisible();

    const stored = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    expect(stored).toContain("youtube-dQw4w9WgXcQ");
    expect(stored).toContain(YOUTUBE_URL);
  });

  test("a newly added video is not-started, not completed", async ({ page }) => {
    await mockMetadata(page);
    await addMockVideo(page);

    await page.getByRole("button", { name: "Episodes" }).click();
    const card = page.locator("button", { hasText: "E2E Mock YouTube Talk" }).first();

    // A YouTube video has an unknown (0) duration, which must not be read as
    // "watched to the end" — and with no duration there's no countdown to show.
    await expect(card).toBeVisible();
    await expect(card.getByText("✓ Completed")).toHaveCount(0);
    await expect(card.getByText(/left$/)).toHaveCount(0);
  });

  test("shows the error message for a YouTube link that isn't a video", async ({ page }) => {
    await page.route("/api/youtube", (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "That doesn't look like a YouTube video URL." }),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    // A channel link routes to the add path (it is a YouTube URL) but has no
    // video id for the server to resolve.
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("https://www.youtube.com/@MITOCW");
    await page.getByRole("button", { name: "Look up", exact: true }).click();

    await expect(page.getByText(/doesn't look like a YouTube video URL/)).toBeVisible();
  });

  test("plain search terms go to podcast search, not the YouTube path", async ({ page }) => {
    await page.route("https://itunes.apple.com/search**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ resultCount: 0, results: [] }),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill("structured notes");

    // The one field switches action based on what's in it.
    await expect(page.getByRole("button", { name: "Search", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Look up", exact: true })).toHaveCount(0);
  });

  test("shows the error message when the video is unavailable", async ({ page }) => {
    await page.route("/api/youtube", (route) =>
      route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({
          error: "That video isn't available — it may be private, deleted, or age-restricted.",
        }),
      }),
    );

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill(YOUTUBE_URL);
    await page.getByRole("button", { name: "Look up", exact: true }).click();

    await expect(page.getByText(/isn't available/)).toBeVisible();
  });

  test("episode detail is notes-only: YouTube link, highlights, no player, no AI", async ({
    page,
  }) => {
    await mockMetadata(page);
    await addMockVideo(page);
    await page.getByText("E2E Mock YouTube Talk").click();

    await expect(page).toHaveURL(/#\/episode\/youtube-dQw4w9WgXcQ/);
    await expect(page.getByRole("link", { name: /Watch on YouTube/ })).toHaveAttribute(
      "href",
      YOUTUBE_URL,
    );
    await expect(page.getByRole("button", { name: /Save Key Highlight/ })).toBeVisible();

    // No playable audio, so timestamp notes (which anchor to player position)
    // are hidden and the mini player never opens.
    await expect(page.getByRole("button", { name: /Add Timestamp Note/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);

    // Transcript retrieval is the supported path for getting the video's
    // content; AI summarization remains unavailable until a transcript exists.
    await expect(page.getByRole("button", { name: "Get Transcript" })).toBeVisible();
    await expect(page.getByRole("button", { name: /AI Summarize/ })).toHaveCount(0);
  });

  test("adding a video clears a previous search error, and searching clears the add card", async ({
    page,
  }) => {
    await mockMetadata(page);
    await page.route("https://itunes.apple.com/search**", (route) => route.abort("failed"));

    await page.goto("/#/library");
    await page.getByRole("button", { name: "Discover" }).click();
    const field = page.getByPlaceholder("Search podcasts, or paste a YouTube link...");

    await field.fill("something");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText(/Couldn't reach the podcast search service/)).toBeVisible();

    // The two actions share one field, so each must clear the other's feedback.
    await field.fill(YOUTUBE_URL);
    await page.getByRole("button", { name: "Look up", exact: true }).click();
    await expect(page.getByText("E2E Mock YouTube Talk")).toBeVisible();
    await expect(page.getByText(/Couldn't reach the podcast search service/)).toHaveCount(0);

    await field.fill("something else");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByText("E2E Mock YouTube Talk")).toHaveCount(0);
  });

  test("the added card doesn't linger after switching tabs", async ({ page }) => {
    await mockMetadata(page);
    await addMockVideo(page);
    await expect(page.getByText("E2E Mock YouTube Talk")).toBeVisible();

    await page.getByRole("button", { name: "Takeaways" }).click();
    await page.getByRole("button", { name: "Discover" }).click();

    await expect(page.getByText("E2E Mock YouTube Talk")).toHaveCount(0);
  });
});
