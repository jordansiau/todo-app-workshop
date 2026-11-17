import { test, expect } from "@playwright/test";
import { register, createTodo, addSubtask, createTag, reload } from "./helpers";
test("debounced subtask/title/tag search, AND filters, saved presets and clearing", async ({
  page,
}) => {
  await register(page);
  const tag = await createTag(page, "Office");
  const a = await createTodo(page, "Report", {
    priority: "high",
    tag_ids: [tag.id],
  });
  await addSubtask(page, a.id, "Budget");
  await createTodo(page, "Low report", { priority: "low" });
  await reload(page);
  await page.getByLabel("Search tasks", { exact: true }).fill("BUDG");
  await expect(page.locator("article h3")).toHaveText(["Report"]);
  await page.getByLabel("Search tasks", { exact: true }).fill("office");
  await expect(page.locator("article h3")).toHaveCount(0);
  await page.getByLabel("Search tag names too").check();
  await expect(page.locator("article h3")).toHaveText(["Report"]);
  await page
    .getByLabel("Priority filter", { exact: true })
    .selectOption("high");
  await page.getByLabel("Preset name").fill("Work focus");
  await page.getByRole("button", { name: "Save preset" }).click();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("article h3")).toHaveCount(2);
  await reload(page);
  await page.getByRole("button", { name: "Work focus", exact: true }).click();
  await expect(page.locator("article h3")).toHaveText(["Report"]);
});
