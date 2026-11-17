import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as s from "../../lib/db";
import {
  applyFilters,
  emptyFilters,
  sortTodos,
  sectionTodos,
  progress,
} from "../../lib/logic";
import {
  calendarGrid,
  dateKey,
  minutesFromNow,
  nextDueDate,
  parseDate,
  shiftMonth,
  toLocalInput,
  formatSingaporeDate,
} from "../../lib/timezone";
import { seedHolidays } from "../../lib/holidays";
let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "todo-unit-"));
  process.env.DATABASE_PATH = join(dir, "test.db");
});
afterAll(() => {
  s.closeDB();
  rmSync(dir, { recursive: true, force: true });
});
beforeEach(() => {
  s.db().exec(
    "DELETE FROM users; DELETE FROM auth_challenges; DELETE FROM holidays;",
  );
  s.db()
    .prepare("INSERT INTO users(id,username,created_at) VALUES(?,?,?)")
    .run(1, "alice", minutesFromNow(0));
  s.db()
    .prepare("INSERT INTO users(id,username,created_at) VALUES(?,?,?)")
    .run(2, "bob", minutesFromNow(0));
});
const task = (input: object = {}) =>
  s.createTodo(1, { title: "Task", ...input });
describe("Singapore dates", () => {
  it("interprets local inputs once, rejects invalid dates, formats SGT", () => {
    expect(parseDate("2028-01-31T12:30").toISOString()).toBe(
      "2028-01-31T04:30:00.000Z",
    );
    expect(toLocalInput("2028-01-31T04:30:00Z")).toBe("2028-01-31T12:30");
    expect(dateKey("2028-01-31T20:00:00Z")).toBe("2028-02-01");
    expect(() => parseDate("bad")).toThrow();
    expect(() => parseDate("2028-02-31T12:00")).toThrow();
    expect(formatSingaporeDate(null)).toBe("No due date");
    expect(formatSingaporeDate("2028-01-01T00:00:00Z")).toContain("Jan");
  });
  it.each([
    ["2028-01-31T12:30", "monthly", "2028-02-29"],
    ["2029-01-31T12:30", "monthly", "2029-02-28"],
    ["2028-02-29T12:30", "yearly", "2029-02-28"],
    ["2028-12-31T12:30", "monthly", "2029-01-31"],
    ["2028-01-31T12:30", "daily", "2028-02-01"],
    ["2028-01-31T12:30", "weekly", "2028-02-07"],
  ])("clamps %s %s", (date, pattern, expected) =>
    expect(dateKey(nextDueDate(date, pattern))).toBe(expected),
  );
  it("creates unique complete 42-day grids with leap days and navigation", () => {
    const grid = calendarGrid("2028-02");
    expect(grid).toHaveLength(42);
    expect(new Set(grid).size).toBe(42);
    expect(grid).toContain("2028-02-29");
    expect(parseDate(grid[0]).getUTCDay()).toBe(0);
    expect(calendarGrid("invalid")).toHaveLength(42);
    expect(shiftMonth("2028-12", 1)).toBe("2029-01");
  });
});
describe("data validation and ownership", () => {
  it("trims title, defaults priority, rejects blank/invalid enum/invalid dependencies/past dates", () => {
    expect(task({ title: " hi " }).title).toBe("hi");
    expect(task().priority).toBe("medium");
    for (const data of [
      { title: " " },
      { priority: "urgent" },
      { is_recurring: true },
      { reminder_minutes: 15 },
      { due_date: minutesFromNow(-1) },
      { due_date: "bad" },
      { reminder_minutes: 20, due_date: minutesFromNow(10) },
    ])
      expect(() => task(data)).toThrow();
  });
  it("preserves metadata on partial updates and permits completion of overdue tasks", () => {
    const t = task({
      priority: "high",
      due_date: minutesFromNow(10),
      is_recurring: true,
      recurrence_pattern: "weekly",
      reminder_minutes: 15,
    });
    const updated = s.updateTodo(1, t.id, { title: "Renamed" });
    expect(updated.priority).toBe("high");
    expect(updated.is_recurring).toBe(true);
    s.db()
      .prepare("UPDATE todos SET due_date=? WHERE id=?")
      .run(minutesFromNow(-5), t.id);
    expect(s.updateTodo(1, t.id, { completed: true }).completed).toBe(true);
  });
  it("rejects cross-user access for all entities, including associations", () => {
    const t = task(),
      tag = s.saveTag(2, { name: "Private" }),
      sub = s.saveSubtask(1, t.id, { title: "Step" }),
      template = s.saveTemplate(1, { name: "Private", title_template: "Task" });
    expect(s.listTodos(2)).toEqual([]);
    for (const fn of [
      () => s.getTodo(2, t.id),
      () => s.updateTodo(2, t.id, { title: "x" }),
      () => s.deleteTodo(2, t.id),
      () => s.updateTodo(1, t.id, { tag_ids: [tag.id] }),
      () => s.saveSubtask(2, t.id, { title: "x" }, sub.id),
      () => s.deleteSubtask(2, t.id, sub.id),
      () => s.saveTag(1, { name: "x" }, tag.id),
      () => s.deleteTag(1, tag.id),
      () => s.saveTemplate(2, { name: "x", title_template: "x" }, template.id),
      () => s.useTemplate(2, template.id),
      () => s.deleteTemplate(2, template.id),
    ])
      expect(fn).toThrow();
    expect(s.getTodo(1, t.id).title).toBe("Task");
  });
  it("cascades children and associations without deleting reusable tags", () => {
    const t = task(),
      tag = s.saveTag(1, { name: "Work" });
    s.updateTodo(1, t.id, { tag_ids: [tag.id, tag.id] });
    s.saveSubtask(1, t.id, { title: "child" });
    s.deleteTodo(1, t.id);
    expect(s.db().prepare("SELECT * FROM subtasks").all()).toEqual([]);
    expect(s.db().prepare("SELECT * FROM todo_tags").all()).toEqual([]);
    expect(s.listTags(1)).toHaveLength(1);
  });
});
describe("recurrence and reminders", () => {
  it("creates exactly one successor with inherited settings, tags and reset subtasks", () => {
    const tag = s.saveTag(1, { name: "work" }),
      t = task({
        priority: "high",
        due_date: minutesFromNow(60),
        is_recurring: true,
        recurrence_pattern: "daily",
        reminder_minutes: 30,
        tag_ids: [tag.id],
      });
    s.saveSubtask(1, t.id, { title: "Step" });
    s.updateTodo(1, t.id, { completed: true });
    s.updateTodo(1, t.id, { completed: true });
    s.updateTodo(1, t.id, { completed: false });
    s.updateTodo(1, t.id, { completed: true });
    const next = s.listTodos(1).find((x) => x.id !== t.id)!;
    expect(s.listTodos(1)).toHaveLength(2);
    expect(next.priority).toBe("high");
    expect(next.tags[0].id).toBe(tag.id);
    expect(next.subtasks[0].completed).toBe(false);
    expect(
      parseDate(next.due_date!).getTime() - parseDate(t.due_date!).getTime(),
    ).toBe(86400000);
    expect(next.reminder_minutes).toBe(30);
  });
  it("claims only eligible reminders, once, resets when rescheduled", () => {
    const t = task({ due_date: minutesFromNow(10), reminder_minutes: 15 });
    task({ due_date: minutesFromNow(60), reminder_minutes: 15 });
    task({
      due_date: minutesFromNow(10),
      reminder_minutes: 15,
      completed: true,
    });
    expect(s.claimNotifications(2)).toEqual([]);
    expect(s.claimNotifications(1).map((t) => t.id)).toEqual([t.id]);
    expect(s.claimNotifications(1)).toEqual([]);
    s.updateTodo(1, t.id, { due_date: minutesFromNow(11) });
    expect(s.claimNotifications(1)).toHaveLength(1);
  });
});
describe("tags, subtasks and templates", () => {
  it("validates tag names/colors, reuses case-insensitive names and propagates edits/deletes", () => {
    const tag = s.saveTag(1, { name: " Work " });
    expect(() => s.saveTag(1, { name: "work" })).toThrow();
    expect(() => s.saveTag(1, { name: "", color: "red" })).toThrow();
    const t = task({ tag_ids: [tag.id] });
    s.saveTag(1, { name: "Office", color: "#ff0000" }, tag.id);
    expect(s.getTodo(1, t.id).tags[0].name).toBe("Office");
    s.deleteTag(1, tag.id);
    expect(s.getTodo(1, t.id).tags).toEqual([]);
  });
  it("keeps append positions after deletion and handles subtask edits/progress", () => {
    const t = task(),
      a = s.saveSubtask(1, t.id, { title: "A" }),
      b = s.saveSubtask(1, t.id, { title: "B" });
    s.deleteSubtask(1, t.id, a.id);
    const c = s.saveSubtask(1, t.id, { title: "C" });
    expect(c.position).toBe(2);
    s.saveSubtask(1, t.id, { completed: true, title: "renamed" }, b.id);
    expect(progress(s.getTodo(1, t.id).subtasks)).toBe(50);
    expect(progress([])).toBe(0);
    expect(progress([{ completed: true }])).toBe(100);
    expect(() => s.saveSubtask(1, t.id, {})).toThrow();
    expect(() => s.saveSubtask(1, t.id, {}, 999)).toThrow();
    expect(() => s.deleteSubtask(1, t.id, 999)).toThrow();
  });
  it("recreates template subtasks and relative due date without tags, deleting template preserves tasks", () => {
    const t = s.saveTemplate(1, {
      name: "Routine",
      category: "Work",
      title_template: "Review",
      priority: "high",
      is_recurring: true,
      recurrence_pattern: "weekly",
      reminder_minutes: 15,
      due_date_offset_minutes: 60,
      subtasks: [{ title: "Read", position: 2 }],
    });
    const next = s.useTemplate(1, t.id);
    expect(next.subtasks[0].title).toBe("Read");
    expect(next.subtasks[0].position).toBe(2);
    expect(next.tags).toEqual([]);
    expect(parseDate(next.due_date!).getTime()).toBeGreaterThan(
      Date.now() + 59 * 60000,
    );
    s.saveTemplate(1, { ...t, name: "Renamed" }, t.id);
    expect(s.listTemplates(1)[0].name).toBe("Renamed");
    s.deleteTemplate(1, t.id);
    expect(s.getTodo(1, next.id)).toBeTruthy();
    expect(() =>
      s.saveTemplate(1, {
        name: "Bad",
        title_template: "x",
        is_recurring: true,
      }),
    ).toThrow();
  });
});
describe("portable data and atomicity", () => {
  it("roundtrips subtasks/tags/completion with new IDs, reuses tags ignoring case", () => {
    const tag = s.saveTag(1, { name: "Work" }),
      t = task({ tag_ids: [tag.id], completed: true }),
      sub = s.saveSubtask(1, t.id, { title: "Step" });
    s.saveSubtask(1, t.id, { completed: true }, sub.id);
    const data = s.exportData(1);
    expect(data.todos[0]).not.toHaveProperty("id");
    data.todos[0].tags[0].name = "work";
    expect(s.importData(1, data)).toBe(1);
    const copy = s.listTodos(1).find((x) => x.id !== t.id)!;
    expect(copy.subtasks[0].id).not.toBe(sub.id);
    expect(copy.subtasks[0].completed).toBe(true);
    expect(copy.completed).toBe(true);
    expect(s.listTags(1)).toHaveLength(1);
  });
  it("validates whole payload before writing and rolls back failed relationships", () => {
    task();
    expect(() =>
      s.importData(1, {
        version: 1,
        todos: [{ title: "ok" }, { title: "bad", due_date: "invalid" }],
      }),
    ).toThrow();
    expect(s.listTodos(1)).toHaveLength(1);
    expect(() => s.importData(1, { version: 2, todos: [] })).toThrow();
    const tag = s.saveTag(1, { name: "T" });
    expect(() => task({ tag_ids: [tag.id, 999] })).toThrow();
    expect(s.listTodos(1)).toHaveLength(1);
  });
  it("quotes CSV commas/quotes/newlines and neutralizes spreadsheet formulas", () => {
    task({ title: '=HYPERLINK("x"), test\nline' });
    const csv = s.csvData(1);
    expect(csv).toContain('"\'=HYPERLINK(""x"")');
    expect(csv).toContain("test\nline");
  });
});
describe("filtering, ordering and global holidays", () => {
  it("AND-combines search, tag, priority, status and date filters, including subtasks/tags", () => {
    const tag = s.saveTag(1, { name: "Office" }),
      t = task({
        title: "Report",
        priority: "high",
        tag_ids: [tag.id],
        due_date: minutesFromNow(60),
      });
    s.saveSubtask(1, t.id, { title: "Budget" });
    task({ title: "Other", priority: "low" });
    const list = s.listTodos(1);
    expect(
      applyFilters(list, {
        ...emptyFilters,
        search: "BUDG",
        priority: "high",
        tagId: String(tag.id),
        completion: "active",
        from: dateKey(t.due_date!),
        to: dateKey(t.due_date!),
      }),
    ).toHaveLength(1);
    expect(
      applyFilters(list, { ...emptyFilters, search: "office" }),
    ).toHaveLength(0);
    expect(
      applyFilters(list, { ...emptyFilters, search: "office", advanced: true }),
    ).toHaveLength(1);
    expect(
      applyFilters(list, { ...emptyFilters, completion: "completed" }),
    ).toHaveLength(0);
  });
  it("sorts priority then due date and separates overdue/completed", () => {
    const low = task({ priority: "low" }),
      high = task({ priority: "high" }),
      early = task({ priority: "high", due_date: minutesFromNow(5) });
    expect(sortTodos(s.listTodos(1)).map((t) => t.id)).toEqual([
      early.id,
      high.id,
      low.id,
    ]);
    s.db()
      .prepare("UPDATE todos SET due_date=? WHERE id=?")
      .run(minutesFromNow(-5), early.id);
    s.updateTodo(1, low.id, { completed: true });
    const sections = sectionTodos(s.listTodos(1));
    expect(sections.Overdue[0].id).toBe(early.id);
    expect(sections.Completed[0].id).toBe(low.id);
    expect(sections.Active[0].id).toBe(high.id);
  });
  it("filters 1000 tasks in under 100ms", () => {
    const t = task();
    const list = Array.from({ length: 1000 }, (_, i) => ({
      ...t,
      id: i,
      title: `Task ${i}`,
    }));
    const start = performance.now();
    expect(
      applyFilters(list, { ...emptyFilters, search: "Task 99" }),
    ).toHaveLength(11);
    expect(performance.now() - start).toBeLessThan(100);
  });
  it("seeds holidays idempotently and consumes expiring challenges once", () => {
    expect(seedHolidays()).toBe(14);
    seedHolidays();
    expect(s.db().prepare("SELECT * FROM holidays").all()).toHaveLength(14);
    const id = s.newChallenge("alice", "register", "challenge");
    expect(s.consumeChallenge(id, "register").challenge).toBe("challenge");
    expect(() => s.consumeChallenge(id, "register")).toThrow();
    const expired = s.newChallenge("alice", "login", "x");
    s.db()
      .prepare("UPDATE auth_challenges SET expires=0 WHERE id=?")
      .run(expired);
    expect(() => s.consumeChallenge(expired, "login")).toThrow();
  });
});
