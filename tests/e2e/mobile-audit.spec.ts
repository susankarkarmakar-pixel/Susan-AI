import { expect, test, type Page } from "@playwright/test";

async function preparePage(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("susan_first_use_tour_seen_v1", "1");
    window.localStorage.removeItem("susan_agent_tasks_v1");
  });
}

async function collectAudit(page: Page) {
  return page.evaluate(() => {
    const visible = (element: Element) => {
      const node = element as HTMLElement;
      const style = window.getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) !== 0 && rect.width > 0 && rect.height > 0;
    };
    const accessibleName = (element: Element) => {
      const node = element as HTMLElement;
      return node.getAttribute("aria-label") || node.getAttribute("title") || node.textContent?.replace(/\s+/g, " ").trim() || "";
    };
    const interactive = [...document.querySelectorAll("button, a[href], input, textarea, select")].filter((element) => visible(element) && !(element instanceof HTMLInputElement && element.type === "file"));
    const unlabeled = interactive.filter((element) => !accessibleName(element)).map((element) => element.outerHTML.slice(0, 180));
    const undersized = interactive.flatMap((element) => {
      if (!element.matches("button, a[href]")) return [];
      const rect = element.getBoundingClientRect();
      return rect.width < 40 || rect.height < 40 ? [{ name: accessibleName(element), width: Math.round(rect.width), height: Math.round(rect.height) }] : [];
    });
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const paints = performance.getEntriesByType("paint") as PerformancePaintTiming[];
    const longTasks = performance.getEntriesByType("longtask");
    const layoutShifts = performance.getEntriesByType("layout-shift") as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      overflow: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
      interactiveCount: interactive.length,
      unlabeled,
      undersized: undersized.slice(0, 20),
      timing: {
        responseEnd: navigation?.responseEnd || 0,
        domContentLoaded: navigation?.domContentLoadedEventEnd || 0,
        load: navigation?.loadEventEnd || 0,
        fcp: paints.find((entry) => entry.name === "first-contentful-paint")?.startTime || 0,
        longTaskCount: longTasks.length,
        cls: layoutShifts.reduce((total, entry) => total + (entry.hadRecentInput ? 0 : entry.value || 0), 0),
      },
    };
  });
}

test.describe("mobile performance and accessibility audit", () => {
  test("chat shell passes overflow, naming, dialog, and timing heuristics", async ({ page }) => {
    await preparePage(page);
    await page.goto("/", { waitUntil: "networkidle" });
    await expect(page.getByText("Welcome to Susan AI")).toBeVisible();
    const baseline = await collectAudit(page);
    console.log(`[mobile-audit] baseline ${JSON.stringify(baseline)}`);
    expect(baseline.overflow.scrollWidth).toBeLessThanOrEqual(baseline.overflow.clientWidth + 1);
    expect(baseline.unlabeled).toEqual([]);
    expect(baseline.timing.fcp).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Open settings" }).click();
    const settings = page.getByRole("dialog", { name: "Settings" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("button", { name: "Close Settings" })).toBeVisible();
    const settingsAudit = await collectAudit(page);
    console.warn(`[mobile-audit] settings accessibility warnings ${JSON.stringify(settingsAudit.unlabeled)}`);
    await settings.getByRole("button", { name: "Close Settings" }).click();

    await page.getByRole("button", { name: "Open sidebar" }).click();
    const sidebar = page.getByRole("complementary", { name: "Main sidebar" });
    await sidebar.getByRole("button", { name: "About" }).click();
    const about = page.getByRole("dialog", { name: "A calmer way to work with AI" });
    await expect(about).toBeVisible();
    await expect(about.getByRole("button", { name: "Close About Susan AI" })).toBeVisible();
    const aboutAudit = await collectAudit(page);
    console.warn(`[mobile-audit] about accessibility warnings ${JSON.stringify(aboutAudit.unlabeled)}`);
    console.log(`[mobile-audit] settings ${JSON.stringify(settingsAudit)}`);
    console.log(`[mobile-audit] about ${JSON.stringify(aboutAudit)}`);
  });
});
