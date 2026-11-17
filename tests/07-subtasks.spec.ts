import { test, expect } from "@playwright/test";
import { register, createTodo, reload, request } from "./helpers";
test("add, toggle, progress, delete and parent cascade", async ({ page }) => {
  await register(page);
  const task = await createTodo(page, "Parent");
  await reload(page);
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "Manage subtasks" }).click();
  for (const title of ["Step A", "Step B"]) {
    await page.getByLabel("New subtask for Parent").fill(title);
    await page
      .getByRole("button", { name: "Add subtask", exact: true })
      .click();
    await expect(page.getByLabel(title, { exact: true })).toBeVisible();
  }
  await page.getByLabel("Step A", { exact: true }).check();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "50");
  await page.getByLabel("Step B", { exact: true }).check();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "100");
  await page.getByRole("button", { name: "Delete subtask Step A" }).click();
  await expect(page.getByText("1/1 subtasks", { exact: true })).toBeVisible();
  const data = await request<{ subtasks: { id: number }[] }>(
    page,
    `/api/todos/${task.id}`,
    "GET",
  );
  await request(page, `/api/todos/${task.id}`, "DELETE");
  expect(
    (
      await page.request.put(`/api/subtasks/${data.subtasks[0].id}`, {
        data: { completed: false },
      })
    ).status(),
  ).toBe(404);
});
