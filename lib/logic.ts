import type { Todo } from "./db";
import { dateKey, getSingaporeNow, parseDate } from "./timezone";
export interface Filters {
  search: string;
  priority: string;
  tagId: string;
  completion: string;
  from: string;
  to: string;
  advanced: boolean;
}
export const emptyFilters: Filters = {
  search: "",
  priority: "",
  tagId: "",
  completion: "",
  from: "",
  to: "",
  advanced: false,
};
export function applyFilters(todos: Todo[], f: Filters) {
  const q = f.search.trim().toLowerCase();
  return todos.filter(
    (t) =>
      (!q ||
        [
          t.title,
          ...t.subtasks.map((s) => s.title),
          ...(f.advanced ? t.tags.map((tag) => tag.name) : []),
        ].some((s) => s.toLowerCase().includes(q))) &&
      (!f.priority || t.priority === f.priority) &&
      (!f.tagId || t.tags.some((tag) => String(tag.id) === f.tagId)) &&
      (!f.completion || t.completed === (f.completion === "completed")) &&
      (!f.from || (!!t.due_date && dateKey(t.due_date) >= f.from)) &&
      (!f.to || (!!t.due_date && dateKey(t.due_date) <= f.to)),
  );
}
export function sortTodos(todos: Todo[]) {
  const order = { high: 0, medium: 1, low: 2 };
  return [...todos].sort(
    (a, b) =>
      order[a.priority] - order[b.priority] ||
      (a.due_date ? parseDate(a.due_date).getTime() : Infinity) -
        (b.due_date ? parseDate(b.due_date).getTime() : Infinity) ||
      b.created_at.localeCompare(a.created_at) ||
      a.id - b.id,
  );
}
export function sectionTodos(todos: Todo[], now = getSingaporeNow()) {
  return {
    Overdue: todos.filter(
      (t) => !t.completed && t.due_date && parseDate(t.due_date) < now,
    ),
    Active: todos.filter(
      (t) => !t.completed && (!t.due_date || parseDate(t.due_date) >= now),
    ),
    Completed: todos.filter((t) => t.completed),
  };
}
export function progress(subtasks: { completed: boolean }[]) {
  return subtasks.length
    ? Math.round(
        (subtasks.filter((s) => s.completed).length / subtasks.length) * 100,
      )
    : 0;
}
export const reminderChoices = [
  { value: 15, label: "15 minutes" },
  { value: 30, label: "30 minutes" },
  { value: 60, label: "1 hour" },
  { value: 120, label: "2 hours" },
  { value: 1440, label: "1 day" },
  { value: 2880, label: "2 days" },
  { value: 10080, label: "1 week" },
];
