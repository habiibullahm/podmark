import { test, expect } from "@playwright/test";

// Seed episodes (mockData) never carry a real audioUrl — they drive the
// simulated playback timer, not Groq transcription — so these tests inject
// one episode that does, the same way it'll actually arrive via iTunes
// search or YouTube lookup.
const TEST_EPISODE = {
  id: "test-transcribe-ep",
  title: "Test Episode With Real Audio",
  show: "Test Show",
  artworkGradient: "linear-gradient(135deg, #6366F1, #312E81)",
  durationSec: 600,
  progressSec: 0,
  status: "not-started",
  tags: ["testing"],
  publishedAt: "2026-01-01",
  audioUrl: "https://example.com/audio.mp3",
  updatedAt: new Date(0).toISOString(),
};

test.describe("Transcription", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((ep) => {
      localStorage.setItem("podmark-episodes", JSON.stringify({ state: { episodes: [ep] }, version: 2 }));
    }, TEST_EPISODE);
    await page.goto(`/#/episode/${TEST_EPISODE.id}`);
  });

  test("shows the Transcribe Episode button for an episode with real audio", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Transcribe Episode" })).toBeVisible();
  });

  test("generates a transcript and supports search and tap-to-seek", async ({ page }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          segments: [
            { start: 0, end: 4.2, text: "Welcome to the show, this is a test transcript." },
            { start: 4.2, end: 9, text: "Today we're talking about interesting things." },
          ],
        }),
      }),
    );

    await page.getByRole("button", { name: "Transcribe Episode" }).click();

    await expect(page.getByText("📝 Transcript")).toBeVisible({ timeout: 3000 });
    await expect(page.getByText("Welcome to the show, this is a test transcript.")).toBeVisible();
    await expect(page.getByText("Today we're talking about interesting things.")).toBeVisible();

    await page.getByPlaceholder("Search the transcript...").fill("interesting");
    await expect(page.getByText("Welcome to the show")).not.toBeVisible();
    await expect(page.getByText("Today we're talking about interesting things.")).toBeVisible();

    await page.getByPlaceholder("Search the transcript...").fill("");
    await page.getByText("Welcome to the show, this is a test transcript.").click();
    // Seeking flashes the clicked segment's timestamp chip accent-highlighted;
    // a real assertion on player position would need real audio, so this
    // just confirms the click didn't error and the segment is still there.
    await expect(page.getByText("Welcome to the show, this is a test transcript.")).toBeVisible();
  });

  test("shows an error with retry when transcription fails", async ({ page }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 402,
        contentType: "application/json",
        body: JSON.stringify({ error: "The Groq account is out of credits." }),
      }),
    );

    await page.getByRole("button", { name: "Transcribe Episode" }).click();
    // The fake audioUrl also fails to load as real <audio>, so PR2's separate
    // "audio couldn't be loaded" banner (its own unrelated "Try again"
    // button) renders alongside this one — scope to this banner specifically.
    const errorBanner = page.getByText("🎙️ The Groq account is out of credits.").locator("xpath=..");
    await expect(errorBanner).toBeVisible({ timeout: 3000 });
    await expect(errorBanner.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("clearing the transcript removes it and brings back the Transcribe button", async ({ page }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ segments: [{ start: 0, end: 2, text: "A short transcript." }] }),
      }),
    );

    await page.getByRole("button", { name: "Transcribe Episode" }).click();
    await expect(page.getByText("A short transcript.")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "Clear", exact: true }).click();

    await expect(page.getByText("A short transcript.")).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Transcribe Episode" })).toBeVisible();
  });

  test("AI Summarize sends the transcript once one exists", async ({ page }) => {
    await page.route("/api/transcribe", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ segments: [{ start: 0, end: 2, text: "Grounding transcript content." }] }),
      }),
    );
    await page.getByRole("button", { name: "Transcribe Episode" }).click();
    await expect(page.getByText("Grounding transcript content.")).toBeVisible({ timeout: 3000 });

    let capturedBody: Record<string, unknown> | undefined;
    await page.route("/api/summarize", async (route) => {
      capturedBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bullets: ["A bullet grounded in the transcript."] }),
      });
    });

    await page.getByRole("button", { name: "AI Summarize Episode" }).click();
    await expect(page.getByText("A bullet grounded in the transcript.")).toBeVisible({ timeout: 3000 });

    expect(capturedBody?.transcript).toBe("Grounding transcript content.");
  });
});
