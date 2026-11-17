import { test, expect } from "@playwright/test";
import { register, createTodo, addSubtask, reload, request } from "./helpers";
import { minutesFromNow } from "../lib/timezone";
import type { Todo, Template } from "../lib/db";
test("save, preview, edit, use and delete template with subtasks and relative date", async ({
  page,
}) => {
  await register(page);
  const todo = await createTodo(page, "Weekly review", {
    due_date: minutesFromNow(120),
    priority: "high",
    is_recurring: true,
    recurrence_pattern: "weekly",
    reminder_minutes: 30,
  });
  await addSubtask(page, todo.id, "Review notes");
  await reload(page);
  await page
    .getByRole("button", { name: "Save Weekly review as template" })
    .click();
  await page
    .getByLabel("Template name", { exact: true })
    .fill("Review routine");
  await page.getByLabel("Category", { exact: true }).fill("Work");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Templates", exact: true }).click();
  await page.getByLabel("Category filter").selectOption("Work");
  await page.getByText("Preview task", { exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Review notes", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit template Review routine" })
    .click();
  await page.getByLabel("Description", { exact: true }).fill("Keep on track");
  await page
    .getByRole("button", { name: "Save template", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Use Review routine", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const tasks = await request<Todo[]>(page, "/api/todos", "GET");
  expect(tasks).toHaveLength(2);
  expect(tasks[0].subtasks[0].title).toBe("Review notes");
  expect(tasks[0].subtasks[0].completed).toBe(false);
  expect(tasks[0].priority).toBe("high");
  const templates = await request<Template[]>(page, "/api/templates", "GET");
  await request(page, `/api/templates/${templates[0].id}`, "DELETE");
  expect((await request<Todo[]>(page, "/api/todos", "GET")).length).toBe(2);
});
