import { expect, test, type Page } from "@playwright/test";

const user = { name: "Susan Tester", email: "tester@example.com" };

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("susan_first_use_tour_seen_v1", "1");
    window.localStorage.removeItem("susan_agent_tasks_v1");
  });
}

test.describe("full Susan AI user journey", () => {
  test("dashboard navigation reaches Workflows and a workflow reaches fullscreen Agent output", async ({ page }) => {
    await preparePage(page);
    await page.route("**/api/auth/session", async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user }) });
    });

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "What would you like to accomplish today?" })).toBeVisible();
    const workflowsLink = page.getByRole("link", { name: "Workflows" });
    await expect(workflowsLink).toHaveAttribute("href", "/?section=workflows");
    await page.goto("/?section=workflows");
    await expect(page).toHaveURL(/section=workflows/);
    await expect(page.getByRole("heading", { name: "Workflows" })).toBeVisible();
    await expect(page.getByText("Repeatable tasks")).toBeVisible();

    await page.getByRole("button", { name: "Start workflow" }).first().click();
    await expect(page.getByRole("textbox", { name: "Agent goal input" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Live Output" })).toBeVisible();

    const fullscreen = page.getByRole("button", { name: "View output full screen" });
    await expect(fullscreen).toBeVisible();
    await fullscreen.click();
    const outputDialog = page.getByRole("dialog", { name: "Agent live output workspace" });
    await expect(outputDialog).toBeVisible();
    await expect(outputDialog.getByRole("button", { name: "Exit full screen" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(outputDialog).toBeHidden();
  });

  test("chat, search, Agent mode, Settings, and About remain usable on a narrow viewport", async ({ page }) => {
    await preparePage(page);
    await page.goto("/");
    await expect(page.getByText("Welcome to Susan AI")).toBeVisible();

    const modeGroup = page.getByRole("group", { name: "Workspace mode" });
    await modeGroup.getByRole("button", { name: "Search" }).click();
    await expect(page.getByRole("textbox", { name: /Search/i }).first()).toBeVisible();
    await modeGroup.getByRole("button", { name: "Agent" }).click();
    await expect(page.getByRole("textbox", { name: "Agent goal input" })).toBeVisible();
    await modeGroup.getByRole("button", { name: "Chat" }).click();
    await expect(page.getByRole("textbox", { name: "Message Susan AI" })).toBeVisible();

    await page.getByRole("button", { name: "Open settings" }).click();
    await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
    await page.getByRole("button", { name: "Close Settings" }).click();

    await page.getByRole("button", { name: "Open sidebar" }).click();
    const sidebar = page.getByRole("complementary", { name: "Main sidebar" });
    await sidebar.getByRole("button", { name: "About" }).click();
    await expect(page.getByRole("dialog", { name: "A calmer way to work with AI" })).toBeVisible();
  });
});
