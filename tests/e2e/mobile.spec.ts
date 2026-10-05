import { expect, test, type Page } from "@playwright/test";

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth, `horizontal overflow: ${JSON.stringify(overflow)}`).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("susan_first_use_tour_seen_v1", "1");
  });
});

test.describe("mobile Susan AI smoke flow", () => {
  test("renders the chat shell and composer without horizontal overflow", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("textbox", { name: "Message Susan AI" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open sidebar" })).toBeVisible();
    await expect(page.getByRole("group", { name: "Workspace mode" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open settings" })).toBeVisible();
    await expect(page.getByText("Welcome to Susan AI")).toBeVisible();
    await expect(page.getByRole("button", { name: "Send message" })).toBeVisible();
    const composer = page.getByRole("textbox", { name: "Message Susan AI" });
    const composerBox = await composer.boundingBox();
    expect(composerBox?.width ?? 0).toBeGreaterThan(200);
    await expect(page.getByRole("button", { name: /Select model, current model/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("keeps automatic provider fallback opt-in and explains cross-provider use", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Select model, current model/ }).tap();
    const panel = page.getByRole("dialog", { name: "Model control panel" });
    await expect(panel).toBeVisible();
    const fallback = panel.getByRole("switch", { name: "Automatic fallback" });
    await expect(fallback).toHaveAttribute("aria-checked", "false");
    await expect(panel.getByText(/may resend the same conversation to another connected provider/)).toBeVisible();
    await expect(panel.getByText(/Rate-limit, quota, billing, and key errors never switch automatically/)).toBeVisible();
  });

  test("opens and closes Settings and About as mobile sheets", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Open settings" }).tap();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("button", { name: "Close Settings" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await settings.getByRole("button", { name: "Close Settings" }).tap();
    await expect(settings).toBeHidden();

    await page.getByRole("button", { name: "Open sidebar" }).tap();
    const sidebar = page.getByRole("complementary", { name: "Main sidebar" });
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole("button", { name: "About" }).tap();
    const about = page.getByRole("dialog", { name: "A calmer way to work with AI" });
    await expect(about).toBeVisible();
    await expect(about.getByRole("button", { name: "Close About Susan AI" })).toBeVisible();
    await expect(about.getByRole("navigation", { name: "About sections" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await about.getByRole("button", { name: "Close About Susan AI" }).tap();
    await expect(about).toBeHidden();
  });

  test("serves an installable standalone PWA manifest", async ({ request }) => {
    const response = await request.get("/manifest.webmanifest");
    expect(response.ok()).toBeTruthy();
    const manifest = await response.json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      expect.objectContaining({ sizes: "512x512", type: "image/png" }),
    ]));
  });

  test("does not expose the stale Civic Services section in the sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open sidebar" }).tap();
    const sidebar = page.getByRole("complementary", { name: "Main sidebar" });
    await expect(sidebar.getByRole("button", { name: "Civic Services" })).toHaveCount(0);
  });

  test("opens the Usage & activity dashboard from the mobile sidebar", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Open sidebar" }).tap();
    const sidebar = page.getByRole("complementary", { name: "Main sidebar" });
    await sidebar.getByRole("button", { name: "Expand library" }).tap();
    await sidebar.getByRole("button", { name: "Usage & activity" }).tap();
    await expect(page.getByRole("heading", { name: "Usage & activity" })).toBeVisible();
    await expect(page.getByText("Provider-reported tokens", { exact: true })).toBeVisible();
    await page.getByLabel("Monthly limit · USD").fill("25");
    await page.getByLabel("Warn at").selectOption("75");
    await page.getByRole("button", { name: "Save budget" }).tap();
    await expect(page.getByText("Monthly budget warning saved on this device. It never blocks or changes provider requests.")).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new CustomEvent("usage-budget-alert", { detail: { level: "near", spentUsd: 22.5, monthlyLimitUsd: 25, percent: 90 } })));
    await expect(page.getByText("Estimated usage is 90% ($22.50 of $25.00). No provider requests were blocked or changed.")).toBeVisible();
    await page.getByRole("button", { name: "Dismiss budget warning" }).tap();
    await expect(page.getByRole("button", { name: "Dismiss budget warning" })).toHaveCount(0);
    const passphrase = "example-backup-password-2026";
    await page.getByLabel("Backup password (12+ characters)").fill(passphrase);
    await page.getByLabel("Confirm backup password").fill(passphrase);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download encrypted backup" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^susan-ai-usage-.*\.encrypted\.json$/);
    const path = await download.path();
    expect(path).toBeTruthy();
    await page.getByLabel("Encrypted Susan AI backup").setInputFiles(path!);
    await page.getByLabel("Backup password", { exact: true }).fill(passphrase);
    await page.getByRole("button", { name: "Restore and merge" }).click();
    await expect(page.getByText(/Restored \d+ usage records and \d+ pricing rates/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});
