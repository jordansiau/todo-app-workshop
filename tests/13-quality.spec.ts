import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { register, createTodo, createTag, addSubtask, reload } from "./helpers";
import { minutesFromNow } from "../lib/timezone";
import { writeFile } from "node:fs/promises";
async function accessible(page: import("@playwright/test").Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
test("accessible login, workspace, dialog, calendar; responsive themes and evidence", async ({
  page,
}, info) => {
  await page.goto("/login");
  await accessible(page);
  await page.screenshot({ path: info.outputPath("login.png"), fullPage: true });
  await register(page);
  const tag = await createTag(page, "Learning");
  const task = await createTodo(page, "Finish the workshop", {
    priority: "high",
    due_date: minutesFromNow(120),
    tag_ids: [tag.id],
    reminder_minutes: 30,
  });
  await createTodo(page, "Plan tomorrow", { priority: "medium" });
  await createTodo(page, "Read a chapter", { priority: "low" });
  await addSubtask(page, task.id, "Review the rubric");
  await addSubtask(page, task.id, "Share the repository");
  await reload(page);
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("workspace.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Edit Finish the workshop", exact: true })
    .click();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await accessible(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page.locator(".day")).toHaveCount(42);
  await accessible(page);
  await page.screenshot({
    path: info.outputPath("calendar.png"),
    fullPage: true,
  });
});
test("local production navigation and authenticated API timing evidence", async ({
  page,
}, info) => {
  await register(page);
  await createTodo(page, "Performance sample");
  await reload(page);
  const navigation = await page.evaluate(() => {
    const n = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming;
    return {
      load_ms: n.loadEventEnd,
      fcp_ms:
        performance.getEntriesByName("first-contentful-paint")[0]?.startTime ??
        null,
    };
  });
  const samples: number[] = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const response = await page.request.get("/api/todos");
    expect(response.ok()).toBe(true);
    samples.push(performance.now() - start);
  }
  const result = {
    environment:
      "Local production server; warm requests; not throttled; not cloud or Lighthouse",
    navigation,
    api_samples_ms: samples,
    api_average_ms: samples.reduce((a, b) => a + b, 0) / samples.length,
  };
  await writeFile(
    info.outputPath("performance.json"),
    JSON.stringify(result, null, 2),
  );
  await info.attach("local-production-performance", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(result.api_average_ms).toBeLessThan(300);
});
