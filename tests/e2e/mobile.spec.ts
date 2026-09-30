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
    await expectNoHorizontalOverflow(page);
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
});
