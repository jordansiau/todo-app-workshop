import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  getSingaporeNow,
  nextDueDate,
  nowISO,
  parseDate,
  minutesFromNow,
} from "./timezone";

export type Priority = "high" | "medium" | "low";
export type RecurrencePattern = "daily" | "weekly" | "monthly" | "yearly";
export interface Tag {
  id: number;
  name: string;
  color: string;
}
export interface Subtask {
  id: number;
  todo_id: number;
  title: string;
  completed: boolean;
  position: number;
}
export interface Todo {
  id: number;
  user_id: number;
  title: string;
  completed: boolean;
  priority: Priority;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  last_notification_sent: string | null;
  created_at: string;
  updated_at: string | null;
  tags: Tag[];
  subtasks: Subtask[];
}
export interface Template {
  id: number;
  name: string;
  description: string;
  category: string;
  title_template: string;
  priority: Priority;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  due_date_offset_minutes: number | null;
  subtasks: { title: string; position: number }[];
}
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
let instance: Database.Database | undefined;
export function db() {
  if (instance) return instance;
  const path = process.env.DATABASE_PATH || "./data/todos.db";
  mkdirSync(dirname(path), { recursive: true });
  instance = new Database(path);
  instance.pragma("journal_mode = WAL");
  instance.pragma("foreign_keys = ON");
  instance.pragma("busy_timeout = 5000");
  instance.exec(`
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS authenticators(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, credential_id TEXT NOT NULL UNIQUE, credential_public_key BLOB NOT NULL, counter INTEGER NOT NULL DEFAULT 0, transports TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_auth_user ON authenticators(user_id);
    CREATE TABLE IF NOT EXISTS auth_challenges(id TEXT PRIMARY KEY, username TEXT NOT NULL, flow TEXT NOT NULL, challenge TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS todos(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high','medium','low')), due_date TEXT, is_recurring INTEGER NOT NULL DEFAULT 0, recurrence_pattern TEXT, reminder_minutes INTEGER, last_notification_sent TEXT, recurrence_spawned INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT);
    CREATE INDEX IF NOT EXISTS idx_todo_user ON todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todo_due ON todos(due_date);
    CREATE TABLE IF NOT EXISTS subtasks(id INTEGER PRIMARY KEY, todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE, title TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_subtask_todo ON subtasks(todo_id);
    CREATE TABLE IF NOT EXISTS tags(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL COLLATE NOCASE, color TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id,name));
    CREATE TABLE IF NOT EXISTS todo_tags(todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE, tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE, PRIMARY KEY(todo_id,tag_id));
    CREATE TABLE IF NOT EXISTS templates(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '', title_template TEXT NOT NULL, priority TEXT NOT NULL, is_recurring INTEGER NOT NULL DEFAULT 0, recurrence_pattern TEXT, reminder_minutes INTEGER, due_date_offset_minutes INTEGER, subtasks_json TEXT NOT NULL DEFAULT '[]', created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_template_user ON templates(user_id);
    CREATE TABLE IF NOT EXISTS holidays(id INTEGER PRIMARY KEY, date TEXT NOT NULL UNIQUE, name TEXT NOT NULL, created_at TEXT NOT NULL);
  `);
  return instance;
}
export function closeDB() {
  instance?.close();
  instance = undefined;
}
const title = z.string().trim().min(1).max(500);
const priority = z.enum(["high", "medium", "low"]);
const pattern = z.enum(["daily", "weekly", "monthly", "yearly"]);
const reminder = z
  .union([
    z.literal(15),
    z.literal(30),
    z.literal(60),
    z.literal(120),
    z.literal(1440),
    z.literal(2880),
    z.literal(10080),
  ])
  .nullable();
const fields = z.object({
  title,
  completed: z.boolean().default(false),
  priority: priority.default("medium"),
  due_date: z.string().max(40).nullable().default(null),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: pattern.nullable().default(null),
  reminder_minutes: reminder.default(null),
  tag_ids: z.array(z.number().int().positive()).max(100).default([]),
});
function validated(input: unknown, checkFuture: boolean) {
  const v = fields.parse(input);
  if (v.due_date) {
    try {
      if (!/^\d{4}-\d{2}-\d{2}T/.test(v.due_date))
        throw new Error("Expected ISO datetime");
      v.due_date = parseDate(v.due_date).toISOString();
    } catch {
      throw new AppError("Invalid due date");
    }
  }
  if (
    checkFuture &&
    v.due_date &&
    parseDate(v.due_date).getTime() < getSingaporeNow().getTime() + 60_000
  )
    throw new AppError("Due date must be at least one minute in the future");
  if (v.is_recurring && (!v.due_date || !v.recurrence_pattern))
    throw new AppError("Repeating tasks require a due date and pattern");
  if (v.reminder_minutes !== null && !v.due_date)
    throw new AppError("Reminders require a due date");
  if (!v.is_recurring) v.recurrence_pattern = null;
  return v;
}
type Values = z.infer<typeof fields>;
function insertTodo(user: number, v: Values) {
  const id = Number(
    db()
      .prepare(
        "INSERT INTO todos(user_id,title,completed,priority,due_date,is_recurring,recurrence_pattern,reminder_minutes,created_at) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        user,
        v.title,
        +v.completed,
        v.priority,
        v.due_date,
        +v.is_recurring,
        v.recurrence_pattern,
        v.reminder_minutes,
        nowISO(),
      ).lastInsertRowid,
  );
  setTags(user, id, v.tag_ids);
  return id;
}
function setTags(user: number, id: number, ids: number[]) {
  for (const tag of new Set(ids))
    if (
      !db()
        .prepare("SELECT id FROM tags WHERE id=? AND user_id=?")
        .get(tag, user)
    )
      throw new AppError("Tag not found", 404);
  db().prepare("DELETE FROM todo_tags WHERE todo_id=?").run(id);
  for (const tag of new Set(ids))
    db().prepare("INSERT INTO todo_tags VALUES(?,?)").run(id, tag);
}
export function listTodos(user: number): Todo[] {
  const rows = db()
    .prepare("SELECT * FROM todos WHERE user_id=? ORDER BY id DESC")
    .all(user) as Todo[];
  const subtasks = db()
    .prepare(
      "SELECT s.* FROM subtasks s JOIN todos t ON t.id=s.todo_id WHERE t.user_id=? ORDER BY s.position,s.id",
    )
    .all(user) as Subtask[];
  const tags = db()
    .prepare(
      "SELECT g.*,tt.todo_id FROM tags g JOIN todo_tags tt ON tt.tag_id=g.id JOIN todos t ON t.id=tt.todo_id WHERE t.user_id=? AND g.user_id=?",
    )
    .all(user, user) as (Tag & { todo_id: number })[];
  const subMap = new Map<number, Subtask[]>(),
    tagMap = new Map<number, Tag[]>();
  for (const s of subtasks) {
    const a = subMap.get(s.todo_id) || [];
    a.push({ ...s, completed: !!s.completed });
    subMap.set(s.todo_id, a);
  }
  for (const t of tags) {
    const a = tagMap.get(t.todo_id) || [];
    a.push(t);
    tagMap.set(t.todo_id, a);
  }
  return rows.map((t) => ({
    ...t,
    completed: !!t.completed,
    is_recurring: !!t.is_recurring,
    subtasks: subMap.get(t.id) || [],
    tags: tagMap.get(t.id) || [],
  }));
}
export function getTodo(user: number, id: number) {
  const t = listTodos(user).find((t) => t.id === id);
  if (!t) throw new AppError("Task not found", 404);
  return t;
}
export function createTodo(user: number, input: unknown) {
  const v = validated(input, true);
  const id = db().transaction(() => insertTodo(user, v))();
  return getTodo(user, id);
}
export function updateTodo(user: number, id: number, input: unknown) {
  const parsed = fields.partial().parse(input);
  const patch = Object.fromEntries(
    Object.entries(parsed).filter(([key]) =>
      Object.hasOwn(input as object, key),
    ),
  ) as Partial<Values>;
  db().transaction(() => {
    const old = getTodo(user, id),
      v = validated(
        { ...old, tag_ids: old.tags.map((t) => t.id), ...patch },
        patch.due_date !== undefined && patch.due_date !== old.due_date,
      );
    db()
      .prepare(
        "UPDATE todos SET title=?,completed=?,priority=?,due_date=?,is_recurring=?,recurrence_pattern=?,reminder_minutes=?,updated_at=?,last_notification_sent=CASE WHEN due_date IS NOT ? OR reminder_minutes IS NOT ? THEN NULL ELSE last_notification_sent END WHERE id=? AND user_id=?",
      )
      .run(
        v.title,
        +v.completed,
        v.priority,
        v.due_date,
        +v.is_recurring,
        v.recurrence_pattern,
        v.reminder_minutes,
        nowISO(),
        v.due_date,
        v.reminder_minutes,
        id,
        user,
      );
    setTags(user, id, v.tag_ids);
    if (
      !old.completed &&
      v.completed &&
      v.is_recurring &&
      v.due_date &&
      v.recurrence_pattern
    ) {
      // Only the first incomplete-to-complete transition generates an instance.
      // Unchecking a completed recurrence does not create another chain.
      const exists = db()
        .prepare("SELECT id FROM todos WHERE id=? AND recurrence_spawned=1")
        .get(id);
      if (!exists) {
        const next = insertTodo(user, {
          ...v,
          completed: false,
          due_date: nextDueDate(v.due_date, v.recurrence_pattern),
        });
        for (const s of old.subtasks)
          db()
            .prepare(
              "INSERT INTO subtasks(todo_id,title,position,created_at) VALUES(?,?,?,?)",
            )
            .run(next, s.title, s.position, nowISO());
        db()
          .prepare(
            "UPDATE todos SET recurrence_spawned=1 WHERE id=? AND user_id=?",
          )
          .run(id, user);
      }
    }
  })();
  return getTodo(user, id);
}
export function deleteTodo(user: number, id: number) {
  getTodo(user, id);
  db().prepare("DELETE FROM todos WHERE user_id=? AND id=?").run(user, id);
}
export function listTags(user: number) {
  return db()
    .prepare(
      "SELECT id,name,color FROM tags WHERE user_id=? ORDER BY name COLLATE NOCASE",
    )
    .all(user) as Tag[];
}
const tagSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .default("#3b82f6"),
});
export function saveTag(user: number, input: unknown, id?: number) {
  const v = tagSchema.parse(input);
  if (id && !listTags(user).some((t) => t.id === id))
    throw new AppError("Tag not found", 404);
  if (
    listTags(user).some(
      (t) => t.id !== id && t.name.toLowerCase() === v.name.toLowerCase(),
    )
  )
    throw new AppError("A tag with this name already exists", 409);
  if (id)
    db()
      .prepare("UPDATE tags SET name=?,color=? WHERE id=? AND user_id=?")
      .run(v.name, v.color, id, user);
  else
    id = Number(
      db()
        .prepare(
          "INSERT INTO tags(user_id,name,color,created_at) VALUES(?,?,?,?)",
        )
        .run(user, v.name, v.color, nowISO()).lastInsertRowid,
    );
  return listTags(user).find((t) => t.id === id)!;
}
export function deleteTag(user: number, id: number) {
  if (
    !db().prepare("DELETE FROM tags WHERE id=? AND user_id=?").run(id, user)
      .changes
  )
    throw new AppError("Tag not found", 404);
}
export function saveSubtask(
  user: number,
  todo: number,
  input: unknown,
  id?: number,
) {
  const parent = getTodo(user, todo);
  const v = z
    .object({ title: title.optional(), completed: z.boolean().optional() })
    .parse(input);
  if (id) {
    const old = parent.subtasks.find((s) => s.id === id);
    if (!old) throw new AppError("Subtask not found", 404);
    db()
      .prepare(
        "UPDATE subtasks SET title=?,completed=? WHERE id=? AND todo_id=?",
      )
      .run(v.title ?? old.title, +(v.completed ?? old.completed), id, todo);
  } else {
    if (!v.title) throw new AppError("Subtask title is required");
    const position =
      Math.max(-1, ...parent.subtasks.map((s) => s.position)) + 1;
    id = Number(
      db()
        .prepare(
          "INSERT INTO subtasks(todo_id,title,position,created_at) VALUES(?,?,?,?)",
        )
        .run(todo, v.title, position, nowISO()).lastInsertRowid,
    );
  }
  return getTodo(user, todo).subtasks.find((s) => s.id === id)!;
}
export function deleteSubtask(user: number, todo: number, id: number) {
  if (!getTodo(user, todo).subtasks.some((s) => s.id === id))
    throw new AppError("Subtask not found", 404);
  db().prepare("DELETE FROM subtasks WHERE id=? AND todo_id=?").run(id, todo);
}
const templateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(1000).default(""),
  category: z.string().trim().max(100).default(""),
  title_template: title,
  priority: priority.default("medium"),
  is_recurring: z.boolean().default(false),
  recurrence_pattern: pattern.nullable().default(null),
  reminder_minutes: reminder.default(null),
  due_date_offset_minutes: z
    .number()
    .int()
    .min(1)
    .max(5256000)
    .nullable()
    .default(null),
  subtasks: z
    .array(z.object({ title, position: z.number().int().min(0) }))
    .max(100)
    .default([]),
});
export function listTemplates(user: number): Template[] {
  return (
    db()
      .prepare("SELECT * FROM templates WHERE user_id=? ORDER BY name")
      .all(user) as (Template & { subtasks_json: string })[]
  ).map((t) => ({
    ...t,
    is_recurring: !!t.is_recurring,
    subtasks: JSON.parse(t.subtasks_json),
  }));
}
export function saveTemplate(user: number, input: unknown, id?: number) {
  const v = templateSchema.parse(input);
  validated(
    {
      title: v.title_template,
      ...v,
      due_date: v.due_date_offset_minutes
        ? minutesFromNow(v.due_date_offset_minutes)
        : null,
    },
    false,
  );
  if (id && !listTemplates(user).some((t) => t.id === id))
    throw new AppError("Template not found", 404);
  const args = [
    v.name,
    v.description,
    v.category,
    v.title_template,
    v.priority,
    +v.is_recurring,
    v.recurrence_pattern,
    v.reminder_minutes,
    v.due_date_offset_minutes,
    JSON.stringify(v.subtasks),
  ];
  if (id)
    db()
      .prepare(
        "UPDATE templates SET name=?,description=?,category=?,title_template=?,priority=?,is_recurring=?,recurrence_pattern=?,reminder_minutes=?,due_date_offset_minutes=?,subtasks_json=? WHERE id=? AND user_id=?",
      )
      .run(...args, id, user);
  else
    id = Number(
      db()
        .prepare(
          "INSERT INTO templates(name,description,category,title_template,priority,is_recurring,recurrence_pattern,reminder_minutes,due_date_offset_minutes,subtasks_json,user_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
        )
        .run(...args, user, nowISO()).lastInsertRowid,
    );
  return listTemplates(user).find((t) => t.id === id)!;
}
export function useTemplate(user: number, id: number) {
  const t = listTemplates(user).find((t) => t.id === id);
  if (!t) throw new AppError("Template not found", 404);
  const todo = db().transaction(() => {
    const id = insertTodo(
      user,
      validated(
        {
          title: t.title_template,
          ...t,
          due_date: t.due_date_offset_minutes
            ? minutesFromNow(t.due_date_offset_minutes)
            : null,
        },
        false,
      ),
    );
    for (const s of t.subtasks)
      db()
        .prepare(
          "INSERT INTO subtasks(todo_id,title,position,created_at) VALUES(?,?,?,?)",
        )
        .run(id, s.title, s.position, nowISO());
    return id;
  })();
  return getTodo(user, todo);
}
export function deleteTemplate(user: number, id: number) {
  if (
    !db()
      .prepare("DELETE FROM templates WHERE id=? AND user_id=?")
      .run(id, user).changes
  )
    throw new AppError("Template not found", 404);
}
export function exportData(user: number) {
  return {
    version: 1,
    exported_at: nowISO(),
    todos: listTodos(user).map(
      ({
        title,
        completed,
        priority,
        due_date,
        is_recurring,
        recurrence_pattern,
        reminder_minutes,
        tags,
        subtasks,
      }) => ({
        title,
        completed,
        priority,
        due_date,
        is_recurring,
        recurrence_pattern,
        reminder_minutes,
        tags: tags.map(({ name, color }) => ({ name, color })),
        subtasks: subtasks.map(({ title, completed, position }) => ({
          title,
          completed,
          position,
        })),
      }),
    ),
  };
}
const importSchema = z.object({
  version: z.literal(1),
  todos: z
    .array(
      fields.omit({ tag_ids: true }).extend({
        tags: z.array(tagSchema).max(100).default([]),
        subtasks: z
          .array(
            z.object({
              title,
              completed: z.boolean().default(false),
              position: z.number().int().min(0).default(0),
            }),
          )
          .max(100)
          .default([]),
      }),
    )
    .max(1000),
});
export function importData(user: number, input: unknown) {
  const data = importSchema.parse(input);
  const values = data.todos.map((t) => validated(t, false));
  db().transaction(() => {
    data.todos.forEach((t, i) => {
      const ids = t.tags.map(
        (tag) =>
          listTags(user).find(
            (g) => g.name.toLowerCase() === tag.name.toLowerCase(),
          )?.id ?? saveTag(user, tag).id,
      );
      const id = insertTodo(user, { ...values[i], tag_ids: ids });
      for (const s of t.subtasks)
        db()
          .prepare(
            "INSERT INTO subtasks(todo_id,title,completed,position,created_at) VALUES(?,?,?,?,?)",
          )
          .run(id, s.title, +s.completed, s.position, nowISO());
    });
  })();
  return data.todos.length;
}
export function csvData(user: number) {
  const cell = (v: unknown) =>
    '"' +
    String(v ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return [
    "ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder,Tags,Subtasks",
    ...listTodos(user).map((t) =>
      [
        t.id,
        t.title,
        t.completed,
        t.due_date,
        t.priority,
        t.is_recurring,
        t.recurrence_pattern,
        t.reminder_minutes,
        t.tags.map((g) => g.name).join("; "),
        t.subtasks
          .map((s) => `${s.completed ? "[x]" : "[ ]"} ${s.title}`)
          .join("; "),
      ]
        .map(cell)
        .join(","),
    ),
  ].join("\r\n");
}
export function claimNotifications(user: number) {
  return db().transaction(() => {
    const now = getSingaporeNow().getTime();
    const due = listTodos(user).filter(
      (t) =>
        !t.completed &&
        t.due_date &&
        t.reminder_minutes &&
        !t.last_notification_sent &&
        parseDate(t.due_date).getTime() >= now &&
        parseDate(t.due_date).getTime() - t.reminder_minutes * 60000 <= now,
    );
    for (const t of due)
      db()
        .prepare(
          "UPDATE todos SET last_notification_sent=? WHERE id=? AND user_id=?",
        )
        .run(nowISO(), t.id, user);
    return due;
  })();
}
export function newChallenge(
  username: string,
  flow: string,
  challenge: string,
) {
  db().prepare("DELETE FROM auth_challenges WHERE expires<?").run(Date.now());
  const id = randomUUID();
  db()
    .prepare("INSERT INTO auth_challenges VALUES(?,?,?,?,?)")
    .run(id, username, flow, challenge, Date.now() + 300000);
  return id;
}
export function consumeChallenge(id: string, flow: string) {
  return db().transaction(() => {
    const row = db()
      .prepare(
        "SELECT * FROM auth_challenges WHERE id=? AND flow=? AND expires>?",
      )
      .get(id, flow, Date.now()) as
      { username: string; challenge: string } | undefined;
    db()
      .prepare("DELETE FROM auth_challenges WHERE id=? AND flow=?")
      .run(id, flow);
    if (!row) throw new AppError("Passkey request expired. Try again.");
    return row;
  })();
}
