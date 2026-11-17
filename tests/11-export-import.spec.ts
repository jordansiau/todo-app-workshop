import { test, expect } from "@playwright/test";
import {
  register,
  createTodo,
  createTag,
  addSubtask,
  reload,
  request,
} from "./helpers";
import type { Todo } from "../lib/db";
test("malformed, oversized and partially invalid imports write nothing", async ({
  page,
}) => {
  await register(page);
  expect(
    (
      await page.request.post("/api/todos/import", {
        headers: { "Content-Type": "application/json" },
        data: "{bad",
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/todos/import", {
        data: {
          version: 1,
          todos: [
            { title: "Must roll back" },
            { title: "bad", due_date: "2028-02-31T12:00" },
          ],
        },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/todos/import", {
        data: { version: 1, todos: [], padding: "x".repeat(1_048_576) },
      })
    ).status(),
  ).toBe(413);
  expect(await request(page, "/api/todos", "GET")).toEqual([]);
  expect((await page.request.get("/api/todos/NaN")).status()).toBe(400);
});
test("JSON download and file import preserve relationships with new IDs", async ({
  page,
}) => {
  await register(page);
  const tag = await createTag(page, "Work"),
    todo = await createTodo(page, "Portable", { tag_ids: [tag.id] });
  await addSubtask(page, todo.id, "Step");
  await reload(page);
  const event = page.waitForEvent("download");
  await page.getByRole("link", { name: "JSON", exact: true }).click();
  const download = await event;
  expect(download.suggestedFilename()).toMatch(/^todos-.*\.json$/);
  const data = await request(page, "/api/todos/export", "GET");
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole("status")).toContainText("Imported 1 tasks");
  const all = await request<Todo[]>(page, "/api/todos", "GET");
  expect(all).toHaveLength(2);
  expect(all[0].id).not.toBe(todo.id);
  expect(all[0].tags[0].id).toBe(tag.id);
  expect(all[0].subtasks[0].title).toBe("Step");
  await page.getByLabel("Import JSON", { exact: true }).setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  expect((await request<Todo[]>(page, "/api/todos", "GET")).length).toBe(2);
});
