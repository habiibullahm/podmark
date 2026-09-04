import { test, expect } from "@playwright/test";

test.describe("Episode Detail", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/episode/ep-1");
  });

  test("shows episode info and the notes canvas", async ({ page }) => {
    await expect(
      page.getByText("Building a Second Brain: The Case for Structured Notes").first(),
    ).toBeVisible();
    await expect(page.getByText("The Knowledge Project").first()).toBeVisible();
    await expect(page.getByPlaceholder(/Write freeform Markdown notes/)).toBeVisible();
  });

  test("adds a timestamp note", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Timestamp Note" }).click();

    const draft = page.getByPlaceholder("What's worth remembering here?");
    await draft.fill("E2E test timestamp note");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("E2E test timestamp note")).toBeVisible();
  });

  test("saves a key highlight", async ({ page }) => {
    await page.getByRole("button", { name: "+ Save Key Highlight" }).click();

    const draft = page.getByPlaceholder(/Paste or type the key quote/);
    await draft.fill("E2E test highlight");
    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("E2E test highlight")).toBeVisible();
  });

  test("cancel discards the draft note", async ({ page }) => {
    await page.getByRole("button", { name: "+ Add Timestamp Note" }).click();
    await page.getByPlaceholder("What's worth remembering here?").fill("should not be saved");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByPlaceholder("What's worth remembering here?")).not.toBeVisible();
    await expect(page.getByText("should not be saved")).not.toBeVisible();
  });

  test("AI Summarize Episode generates bullet points insertable into notes", async ({ page }) => {
    await page.route("/api/summarize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bullets: ["Core thesis of the episode, mocked for this test.", "A second bullet."] }),
      }),
    );

    await page.getByRole("button", { name: "AI Summarize Episode" }).click();

    await expect(page.getByText("AI Summary")).toBeVisible({ timeout: 3000 });
    const insertButtons = page.getByRole("button", { name: "+ Add to notes" });
    await expect(insertButtons.first()).toBeVisible();

    await insertButtons.first().click();
    await expect(page.getByPlaceholder(/Write freeform Markdown notes/)).toContainText("Core thesis");
  });

  test("AI Summarize Episode shows a graceful message when the API isn't configured", async ({ page }) => {
    await page.route("/api/summarize", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "AI summarization isn't configured yet — no API key set." }),
      }),
    );

    await page.getByRole("button", { name: "AI Summarize Episode" }).click();

    await expect(page.getByText("AI summarization isn't configured yet")).toBeVisible({ timeout: 3000 });
  });

  test("notes preview renders Markdown and round-trips back to edit", async ({ page }) => {
    const notes = page.getByPlaceholder(/Write freeform Markdown notes/);
    await notes.fill("# Heading\n\n- point one\n- point two\n\n**bold text**");

    await page.getByRole("button", { name: "preview", exact: true }).click();

    await expect(notes).not.toBeVisible();
    await expect(page.getByRole("heading", { name: "Heading", level: 1 })).toBeVisible();
    await expect(page.getByText("point one")).toBeVisible();
    await expect(page.getByText("bold text")).toBeVisible();

    await page.getByRole("button", { name: "edit", exact: true }).click();
    await expect(notes).toHaveValue(/# Heading/);
  });

  test("preview shows an empty-state message for blank notes", async ({ page }) => {
    const notes = page.getByPlaceholder(/Write freeform Markdown notes/);
    await notes.fill("");

    await page.getByRole("button", { name: "preview", exact: true }).click();

    await expect(page.getByText(/Nothing to preview yet/)).toBeVisible();
  });

  test("play/pause toggles the persistent mini player", async ({ page }) => {
    await page.getByRole("button", { name: "Play" }).click();

    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
    await expect(page.getByText("Building a Second Brain: The Case for Structured Notes").last()).toBeVisible();
  });
});
