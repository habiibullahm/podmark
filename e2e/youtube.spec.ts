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

async function addMockVideo(page: import("@playwright/test").Page) {
  await page.goto("/#/library");
  await page.getByRole("button", { name: "Discover" }).click();
  await page.getByPlaceholder("Search podcasts, or paste a YouTube link...").fill(YOUTUBE_URL);
  await page.getByRole("button", { name: "Add", exact: true }).click();
}

test.describe("YouTube episodes", () => {
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
    await page.getByRole("button", { name: "Add", exact: true }).click();

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
    await expect(page.getByRole("button", { name: "Add", exact: true })).toHaveCount(0);
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
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByText(/isn't available/)).toBeVisible();
  });

  test("episode detail offers YouTube playback and hides timestamp notes", async ({ page }) => {
    await mockMetadata(page);
    await addMockVideo(page);
    await page.getByText("E2E Mock YouTube Talk").click();

    await expect(page).toHaveURL(/#\/episode\/youtube-dQw4w9WgXcQ/);
    await expect(page.getByRole("link", { name: /Watch on YouTube/ })).toHaveAttribute(
      "href",
      YOUTUBE_URL,
    );

    // No playable audio, so timestamp notes (which anchor to player position)
    // are hidden and the mini player never opens.
    await expect(page.getByRole("button", { name: /Add Timestamp Note/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Save Key Highlight/ })).toBeVisible();
  });

  test("a raw timestamped transcript is cleaned before it's stored", async ({ page }) => {
    await mockMetadata(page);
    await addMockVideo(page);
    await page.getByText("E2E Mock YouTube Talk").click();

    // Exactly what YouTube's transcript panel puts on the clipboard: a
    // timestamp line above each short, hard-wrapped caption cue.
    await page.getByRole("button", { name: "Add transcript" }).click();
    await page
      .getByPlaceholder("Paste the video transcript...")
      .fill("0:00\nMost people open this app and use\n0:04\nit like a search box.\n1:02:33\nThat is a mistake.");
    await page.getByRole("button", { name: "Save transcript" }).click();

    const stored = await page.evaluate(() => localStorage.getItem("podmark-episodes"));
    const episode = JSON.parse(stored ?? "{}").state.episodes.find(
      (e: { id: string }) => e.id === "youtube-dQw4w9WgXcQ",
    );
    expect(episode.description).toBe(
      "Most people open this app and use it like a search box. That is a mistake.",
    );
  });

  test("pasting a transcript enables AI summary", async ({ page }) => {
    await mockMetadata(page);
    await page.route("/api/summarize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bullets: ["Transcript-grounded bullet."] }),
      }),
    );

    await addMockVideo(page);
    await page.getByText("E2E Mock YouTube Talk").click();

    // Summarizing is blocked until there's real content to summarize.
    await expect(page.getByRole("button", { name: /AI Summarize Episode/ })).toBeDisabled();

    await page.getByRole("button", { name: "Add transcript" }).click();
    await page
      .getByPlaceholder("Paste the video transcript...")
      .fill("Welcome to the show. Today we discuss structured note-taking at length.");
    await page.getByRole("button", { name: "Save transcript" }).click();

    const summarize = page.getByRole("button", { name: /AI Summarize Episode/ });
    await expect(summarize).toBeEnabled();
    await summarize.click();

    await expect(page.getByText("Transcript-grounded bullet.")).toBeVisible();
  });
});
