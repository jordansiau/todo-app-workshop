import { test, expect } from "@playwright/test";
import { register, request, reload } from "./helpers";
import { minutesFromNow, toLocalInput } from "../lib/timezone";
test("editing an overdue task preserves its original due instant", async ({
  page,
}) => {
  await register(page);
  const due = minutesFromNow(-120);
  await request(page, "/api/todos/import", "POST", {
    version: 1,
    todos: [{ title: "Overdue task", due_date: due }],
  });
  await reload(page);
  await page
    .getByRole("button", { name: "Edit Overdue task", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Task title", { exact: true })
    .fill("Renamed overdue");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("region", { name: "Overdue", exact: true })
      .getByRole("heading", { name: "Renamed overdue" }),
  ).toBeVisible();
  const tasks = await request<{ due_date: string }[]>(
    page,
    "/api/todos",
    "GET",
  );
  expect(tasks[0].due_date).toBe(due);
});
test("all metadata through composer; future validation and Singapore date", async ({
  page,
}) => {
  await register(page);
  await page.getByLabel("Task title", { exact: true }).fill("Scheduled task");
  await page.getByRole("button", { name: "Show task options" }).click();
  await page.getByLabel("Priority", { exact: true }).selectOption("high");
  await page
    .getByLabel("Due date (SGT)")
    .fill(toLocalInput(minutesFromNow(120)));
  await page.getByLabel("Repeat task", { exact: true }).check();
  await page.getByLabel("Repeat frequency").selectOption("monthly");
  await page.getByLabel("Remind me", { exact: true }).selectOption("60");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Scheduled task" }),
  ).toBeVisible();
  await expect(page.locator("article")).toContainText("monthly");
  const tasks = await request<
    { due_date: string; priority: string; reminder_minutes: number }[]
  >(page, "/api/todos", "GET");
  expect(tasks[0].priority).toBe("high");
  expect(tasks[0].reminder_minutes).toBe(60);
  expect(toLocalInput(tasks[0].due_date)).toBe(
    toLocalInput(minutesFromNow(120)),
  );
  const res = await page.request.post("/api/todos", {
    data: { title: "Past", due_date: minutesFromNow(-5) },
  });
  expect(res.status()).toBe(400);
});
