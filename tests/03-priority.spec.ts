import { test, expect } from "@playwright/test";
import { register, createTodo, reload } from "./helpers";
test("priority sorts high-medium-low, filters and edits", async ({ page }) => {
  await register(page);
  await createTodo(page, "Low task", { priority: "low" });
  await createTodo(page, "High task", { priority: "high" });
  await createTodo(page, "Medium task");
  await reload(page);
  await expect(page.locator("article h3")).toHaveText([
    "High task",
    "Medium task",
    "Low task",
  ]);
  await page.getByLabel("Priority filter", { exact: true }).selectOption("low");
  await expect(page.locator("article h3")).toHaveText(["Low task"]);
  await page
    .getByRole("button", { name: "Edit Low task", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Priority", { exact: true })
    .selectOption("high");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.locator("article h3")).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("article .badge.high")).toHaveCount(2);
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
});
