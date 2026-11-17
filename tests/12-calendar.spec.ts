import { test, expect } from "@playwright/test";
import { register, createTodo } from "./helpers";
import { dateKey, minutesFromNow } from "../lib/timezone";
test("42 days, URL navigation, holidays, overflow and day modal", async ({
  page,
}) => {
  await register(page);
  const due = minutesFromNow(120),
    day = dateKey(due);
  for (let i = 0; i < 4; i++)
    await createTodo(page, `Calendar task ${i}`, { due_date: due });
  await page.goto(`/calendar?month=${day.slice(0, 7)}`);
  const cell = page.getByRole("button", {
    name: new RegExp(`^${day}.*4 tasks$`),
  });
  await expect(cell).toContainText("+1 more");
  expect(await page.locator(".day").count()).toBe(42);
  await cell.click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Calendar task 3" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(page).toHaveURL(/month=/);
  await page.getByRole("button", { name: "Previous month" }).click();
  await expect(cell).toBeVisible();
  await page.goto("/calendar?month=2026-12");
  await expect(page.getByText("Christmas Day", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(page).toHaveURL(
    new RegExp(`month=${dateKey(minutesFromNow(0)).slice(0, 7)}`),
  );
});
