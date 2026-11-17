import { test, expect } from "@playwright/test";
import { register, createTodo, request } from "./helpers";
import { minutesFromNow, nextDueDate } from "../lib/timezone";
import type { Todo } from "../lib/db";
for (const pattern of ["daily", "weekly", "monthly", "yearly"])
  test(`completion generates one ${pattern} successor`, async ({ page }) => {
    await register(page);
    const t = await createTodo(page, "Routine", {
      due_date: minutesFromNow(60),
      is_recurring: true,
      recurrence_pattern: pattern,
      priority: "high",
      reminder_minutes: 15,
    });
    await request(page, `/api/todos/${t.id}`, "PUT", { completed: true });
    await request(page, `/api/todos/${t.id}`, "PUT", { completed: true });
    const todos = await request<Todo[]>(page, "/api/todos", "GET");
    expect(todos).toHaveLength(2);
    const next = todos.find((x) => x.id !== t.id)!;
    expect(next.due_date).toBe(nextDueDate(t.due_date!, pattern));
    expect(next.priority).toBe("high");
    expect(next.reminder_minutes).toBe(15);
    expect(next.completed).toBe(false);
  });
