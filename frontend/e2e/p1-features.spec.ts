import { test, expect } from "@playwright/test";
import fs from "node:fs";

test.describe("Free-text tags", () => {
  test("adds a note with a custom free-text tag not on the episode", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "+ Add Timestamp Note" }).click();
    await page.getByPlaceholder("What's worth remembering here?").fill("A note with a custom tag");

    await page.getByRole("textbox", { name: "Add a tag" }).fill("deep-work");
    await page.keyboard.press("Enter");
    await expect(page.getByText("#deep-work")).toBeVisible();

    await page.getByRole("button", { name: "Save", exact: true }).click();

    await expect(page.getByText("A note with a custom tag")).toBeVisible();
    await expect(page.getByText("#deep-work")).toBeVisible();
  });

  test("editing a note's tags supports multiple free-text tags", async ({ page }) => {
    await page.goto("/#/episode/ep-1");
    await page.getByRole("button", { name: "Note options — 15:02" }).click();
    await page.getByText("Edit", { exact: true }).click();

    await page.getByRole("textbox", { name: "Add a tag" }).fill("second-tag");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("#productivity").first()).toBeVisible();
    await expect(page.getByText("#second-tag")).toBeVisible();
  });
});

test.describe("Complete export", () => {
  test("per-episode export includes freeform notes and the AI summary", async ({ page }) => {
    await page.route("/api/summarize", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ bullets: ["A summarized bullet point."] }),
      }),
    );

    await page.goto("/#/episode/ep-1");
    const notes = page.getByPlaceholder(/Write freeform Markdown notes/);
    await notes.fill("My real freeform notes for this episode.");

    await page.getByRole("button", { name: "AI Summarize Episode" }).click();
    await expect(page.getByText("A summarized bullet point.")).toBeVisible({ timeout: 3000 });

    await page.getByRole("button", { name: "⋯" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByText("Export episode ↗").click(),
    ]);

    const filePath = await download.path();
    const content = fs.readFileSync(filePath!, "utf-8");
    expect(content).toContain("## AI Summary");
    expect(content).toContain("A summarized bullet point.");
    expect(content).toContain("## Notes");
    expect(content).toContain("My real freeform notes for this episode.");
  });

  test("library export includes an episode with only freeform notes, no timestamped notes", async ({ page }) => {
    await page.goto("/#/episode/ep-4");
    await page.getByPlaceholder(/Write freeform Markdown notes/).fill("Only freeform content here.");

    await page.goto("/#/library");
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Export All ↗" }).click(),
    ]);

    const filePath = await download.path();
    const content = fs.readFileSync(filePath!, "utf-8");
    expect(content).toContain("Only freeform content here.");
  });
});

test.describe("Add to folder from the Library card", () => {
  test("adds an episode to a folder from its card menu without opening the episode", async ({ page }) => {
    await page.goto("/#/library");
    await page.getByRole("button", { name: /Add ".*" to folder/ }).first().click();
    await page.getByText("📁 Investing Basics").click();

    await page.getByRole("button", { name: "Folders", exact: true }).click();
    await page.getByText("Investing Basics").click();
    await expect(
      page.getByText("Building a Second Brain: The Case for Structured Notes"),
    ).toBeVisible();
  });
});

test.describe("Notifications", () => {
  test("re-enabling after disabling requests permission and only re-enables if granted", async ({ page }) => {
    await page.addInitScript(() => {
      let requested = false;
      Object.defineProperty(Notification, "permission", { get: () => (requested ? "denied" : "default") });
      // @ts-expect-error stubbing a browser API for the test
      Notification.requestPermission = async () => {
        requested = true;
        return "denied";
      };
    });
    await page.goto("/#/profile");

    const toggle = page.getByRole("switch");
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    // Denied permission must not silently re-enable the setting.
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText(/Notifications are blocked for this site/)).toBeVisible();
  });

  test("re-enabling succeeds when permission is granted", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Notification, "permission", { value: "default", writable: true });
      // @ts-expect-error stubbing a browser API for the test
      Notification.requestPermission = async () => "granted";
    });
    await page.goto("/#/profile");

    const toggle = page.getByRole("switch");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Appearance", () => {
  test("selecting a theme persists across reload", async ({ page }) => {
    await page.goto("/#/profile");
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    await expect(page.getByRole("button", { name: "Light", exact: true })).toHaveClass(/border-accent/);
  });

  test("System removes the explicit theme override", async ({ page }) => {
    await page.goto("/#/profile");
    await page.getByRole("button", { name: "Dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.getByRole("button", { name: "System", exact: true }).click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
  });
});
