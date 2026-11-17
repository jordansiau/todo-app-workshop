"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Search,
  SlidersHorizontal,
  Tag as TagIcon,
  Copy,
  Download,
  Upload,
  Bell,
  Pencil,
  Trash2,
  Repeat,
  ChevronDown,
} from "lucide-react";
import { Header } from "@/components/Header";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";
import type {
  Todo,
  Tag,
  Template,
  Priority,
  RecurrencePattern,
} from "@/lib/db";
import {
  emptyFilters,
  applyFilters,
  sectionTodos,
  sortTodos,
  progress,
  reminderChoices,
  type Filters,
} from "@/lib/logic";
import {
  formatSingaporeDate,
  getSingaporeNow,
  parseDate,
  toLocalInput,
} from "@/lib/timezone";
import { useNotifications } from "@/lib/hooks/useNotifications";
type TaskInput = {
  title: string;
  priority: Priority;
  due_date: string | null;
  is_recurring: boolean;
  recurrence_pattern: RecurrencePattern | null;
  reminder_minutes: number | null;
  tag_ids: number[];
};
function TodoForm({
  todo,
  tags,
  onSave,
  onCancel,
  busy,
}: {
  todo?: Todo;
  tags: Tag[];
  onSave: (v: TaskInput) => Promise<boolean | void>;
  onCancel?: () => void;
  busy: boolean;
}) {
  const [title, setTitle] = useState(todo?.title || ""),
    [priority, setPriority] = useState<Priority>(todo?.priority || "medium"),
    [due, setDue] = useState(todo?.due_date ? toLocalInput(todo.due_date) : ""),
    [repeat, setRepeat] = useState(todo?.is_recurring || false),
    [pattern, setPattern] = useState<RecurrencePattern>(
      todo?.recurrence_pattern || "daily",
    ),
    [reminder, setReminder] = useState(
      todo?.reminder_minutes ? String(todo.reminder_minutes) : "",
    ),
    [ids, setIds] = useState(todo?.tags.map((t) => t.id) || []),
    [detail, setDetail] = useState(!!todo);
  return (
    <form
      className="todo-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const saved = await onSave({
          title,
          priority,
          due_date: due
            ? todo?.due_date && due === toLocalInput(todo.due_date)
              ? todo.due_date
              : parseDate(due).toISOString()
            : null,
          is_recurring: repeat,
          recurrence_pattern: repeat ? pattern : null,
          reminder_minutes: reminder ? Number(reminder) : null,
          tag_ids: ids,
        });
        if (saved !== false && !todo) {
          setTitle("");
          setDue("");
          setRepeat(false);
          setReminder("");
          setIds([]);
          setPriority("medium");
        }
      }}
    >
      <div className="create-row">
        <label className="grow">
          <span className="sr-only">Task title</span>
          <input
            aria-label="Task title"
            required
            maxLength={500}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to get done?"
          />
        </label>
        <button className="primary" disabled={busy}>
          <Plus size={18} />
          {todo ? "Save task" : "Add task"}
        </button>
      </div>
      <button
        type="button"
        className="link details-toggle"
        onClick={() => setDetail(!detail)}
      >
        <SlidersHorizontal size={14} />
        {detail ? "Hide" : "Show"} task options
      </button>
      {detail && (
        <div className="options">
          <div className="form-grid">
            <label>
              Priority
              <select
                aria-label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Due date (SGT)
              <input
                type="datetime-local"
                value={due}
                onChange={(e) => {
                  setDue(e.target.value);
                  if (!e.target.value) {
                    setReminder("");
                    setRepeat(false);
                  }
                }}
              />
            </label>
            <label>
              Remind me
              <select
                aria-label="Remind me"
                disabled={!due}
                value={reminder}
                onChange={(e) => setReminder(e.target.value)}
              >
                <option value="">No reminder</option>
                {reminderChoices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label} before
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="row wrap">
            <label className="check">
              <input
                type="checkbox"
                checked={repeat}
                disabled={!due}
                onChange={(e) => setRepeat(e.target.checked)}
              />
              Repeat task
            </label>
            {repeat && (
              <label>
                Repeat frequency
                <select
                  aria-label="Repeat frequency"
                  value={pattern}
                  onChange={(e) =>
                    setPattern(e.target.value as RecurrencePattern)
                  }
                >
                  {["daily", "weekly", "monthly", "yearly"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            )}
            {tags.map((tag) => (
              <label key={tag.id} className="check">
                <input
                  type="checkbox"
                  checked={ids.includes(tag.id)}
                  onChange={() =>
                    setIds(
                      ids.includes(tag.id)
                        ? ids.filter((id) => id !== tag.id)
                        : [...ids, tag.id],
                    )
                  }
                />
                {tag.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
function TemplateForm({
  initial,
  onSave,
  busy,
}: {
  initial: Partial<Template>;
  onSave: (v: Partial<Template>) => Promise<void>;
  busy: boolean;
}) {
  const [v, setV] = useState(initial);
  const change = (key: string, value: unknown) => setV({ ...v, [key]: value });
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(v);
      }}
    >
      <label>
        Template name
        <input
          required
          maxLength={100}
          value={v.name || ""}
          onChange={(e) => change("name", e.target.value)}
        />
      </label>
      <label>
        Description
        <textarea
          maxLength={1000}
          value={v.description || ""}
          onChange={(e) => change("description", e.target.value)}
        />
      </label>
      <label>
        Category
        <input
          maxLength={100}
          value={v.category || ""}
          onChange={(e) => change("category", e.target.value)}
        />
      </label>
      <label>
        Task title
        <input
          required
          value={v.title_template || ""}
          onChange={(e) => change("title_template", e.target.value)}
        />
      </label>
      <div className="form-grid">
        <label>
          Priority
          <select
            aria-label="Priority"
            value={v.priority || "medium"}
            onChange={(e) => change("priority", e.target.value)}
          >
            {["high", "medium", "low"].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <label>
          Due in minutes
          <input
            type="number"
            min={1}
            max={5256000}
            value={v.due_date_offset_minutes ?? ""}
            onChange={(e) =>
              change(
                "due_date_offset_minutes",
                e.target.value ? Number(e.target.value) : null,
              )
            }
          />
        </label>
        <label>
          Reminder
          <select
            aria-label="Reminder"
            value={v.reminder_minutes ?? ""}
            onChange={(e) =>
              change(
                "reminder_minutes",
                e.target.value ? Number(e.target.value) : null,
              )
            }
          >
            <option value="">None</option>
            {reminderChoices.map((x) => (
              <option key={x.value} value={x.value}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Recurrence
        <select
          aria-label="Recurrence"
          value={v.is_recurring ? v.recurrence_pattern || "daily" : ""}
          onChange={(e) => {
            setV({
              ...v,
              is_recurring: !!e.target.value,
              recurrence_pattern: (e.target.value ||
                null) as RecurrencePattern | null,
            });
          }}
        >
          <option value="">None</option>
          {["daily", "weekly", "monthly", "yearly"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </label>
      <label>
        Subtasks (one per line)
        <textarea
          value={(v.subtasks || []).map((s) => s.title).join("\n")}
          onChange={(e) =>
            change(
              "subtasks",
              e.target.value
                .split("\n")
                .filter(Boolean)
                .map((title, position) => ({ title, position })),
            )
          }
        />
      </label>
      <button className="primary" disabled={busy}>
        Save template
      </button>
    </form>
  );
}
export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]),
    [tags, setTags] = useState<Tag[]>([]),
    [templates, setTemplates] = useState<Template[]>([]),
    [user, setUser] = useState<{ id: number; username: string } | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const [filters, setFilters] = useState<Filters>(emptyFilters),
    [query, setQuery] = useState(""),
    [debounced, setDebounced] = useState(""),
    [expanded, setExpanded] = useState<number[]>([]),
    [editing, setEditing] = useState<Todo | null>(null),
    [remove, setRemove] = useState<Todo | null>(null),
    [manage, setManage] = useState<"tags" | "templates" | null>(null),
    [templateEdit, setTemplateEdit] = useState<Partial<Template> | null>(null),
    [tagEdit, setTagEdit] = useState<Tag | null>(null),
    [tagName, setTagName] = useState(""),
    [tagColor, setTagColor] = useState("#3b82f6"),
    [category, setCategory] = useState(""),
    [presets, setPresets] = useState<{ name: string; filters: Filters }[]>([]),
    [presetName, setPresetName] = useState(""),
    [clock, setClock] = useState(getSingaporeNow());
  const notifications = useNotifications();
  const refresh = useCallback(async () => {
    const [ts, gs, ps, me] = await Promise.all([
      api<Todo[]>("/api/todos"),
      api<Tag[]>("/api/tags"),
      api<Template[]>("/api/templates"),
      api<{ user: { id: number; username: string } }>("/api/auth/me"),
    ]);
    setTodos(ts);
    setTags(gs);
    setTemplates(ps);
    setUser(me.user);
  }, []);
  useEffect(() => {
    void refresh()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [refresh]);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    const timer = setInterval(() => setClock(getSingaporeNow()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (user) {
      try {
        const v = JSON.parse(
          localStorage.getItem(`todo-app:filter-presets:${user.id}`) || "[]",
        );
        if (Array.isArray(v))
          setPresets(
            v
              .filter((p) => typeof p.name === "string" && p.filters)
              .slice(0, 20),
          );
      } catch {
        setPresets([]);
      }
    }
  }, [user]);
  async function mutate(
    action: () => Promise<unknown>,
    optimistic?: () => void,
  ) {
    const snapshot = todos;
    setBusy(true);
    setError("");
    setMessage("");
    optimistic?.();
    try {
      await action();
      await refresh();
      return true;
    } catch (e) {
      setTodos(snapshot);
      setError(e instanceof Error ? e.message : "Request failed");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const sections = useMemo(
    () =>
      sectionTodos(
        sortTodos(applyFilters(todos, { ...filters, search: debounced })),
        clock,
      ),
    [todos, filters, debounced, clock],
  );
  const count = Object.values(sections).reduce((n, a) => n + a.length, 0),
    completed = todos.filter((t) => t.completed).length;
  function savePresets(value: typeof presets) {
    setPresets(value);
    if (user)
      localStorage.setItem(
        `todo-app:filter-presets:${user.id}`,
        JSON.stringify(value),
      );
  }
  const toolbar = (
    <div className="toolbar">
      <button onClick={() => setManage("tags")}>
        <TagIcon size={16} />
        Manage tags
      </button>
      <button onClick={() => setManage("templates")}>
        <Copy size={16} />
        Templates
      </button>
      <Link
        className="button"
        download
        prefetch={false}
        href="/api/todos/export?format=json"
      >
        <Download size={16} />
        JSON
      </Link>
      <Link
        className="button"
        download
        prefetch={false}
        href="/api/todos/export?format=csv"
      >
        CSV
      </Link>
      <label className="button upload">
        <Upload size={16} />
        Import JSON
        <input
          className="sr-only"
          type="file"
          accept="application/json,.json"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              if (file.size > 1048576) throw new Error("File exceeds 1 MB");
              const data = JSON.parse(await file.text());
              await mutate(async () => {
                const result = await api<{ imported: number }>(
                  "/api/todos/import",
                  "POST",
                  data,
                );
                setMessage(`Imported ${result.imported} tasks.`);
              });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invalid JSON");
            } finally {
              e.target.value = "";
            }
          }}
        />
      </label>
    </div>
  );
  return (
    <>
      <Header username={user?.username} />
      <main className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">YOUR PERSONAL WORKSPACE · SINGAPORE TIME</p>
            <h1>A clearer day starts here.</h1>
            <p className="muted">
              Capture the small things. Make progress on the big ones.
            </p>
          </div>
          <div className="summary">
            <strong>{todos.length - completed}</strong>
            <span>to do</span>
            <strong>{completed}</strong>
            <span>done</span>
          </div>
        </div>
        {toolbar}
        <div aria-live="polite">
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          {message && (
            <p role="status" className="success">
              {message}
            </p>
          )}
        </div>
        <section className="panel composer" aria-label="Create a task">
          <TodoForm
            tags={tags}
            busy={busy}
            onSave={async (v) => {
              return await mutate(() => api("/api/todos", "POST", v));
            }}
          />
        </section>
        <section className="panel filters" aria-label="Search and filters">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search tasks"
              placeholder="Search tasks and subtasks…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="filter-row">
            <label>
              Priority filter
              <select
                aria-label="Priority filter"
                value={filters.priority}
                onChange={(e) =>
                  setFilters({ ...filters, priority: e.target.value })
                }
              >
                <option value="">All priorities</option>
                {["high", "medium", "low"].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Tag filter
              <select
                aria-label="Tag filter"
                value={filters.tagId}
                onChange={(e) =>
                  setFilters({ ...filters, tagId: e.target.value })
                }
              >
                <option value="">All tags</option>
                {tags.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status filter
              <select
                aria-label="Status filter"
                value={filters.completion}
                onChange={(e) =>
                  setFilters({ ...filters, completion: e.target.value })
                }
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Due from
              <input
                type="date"
                value={filters.from}
                onChange={(e) =>
                  setFilters({ ...filters, from: e.target.value })
                }
              />
            </label>
            <label>
              Due to
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              />
            </label>
            <button
              onClick={() => {
                setFilters(emptyFilters);
                setQuery("");
              }}
            >
              Clear filters
            </button>
          </div>
          <div className="row wrap presets">
            <label className="check">
              <input
                type="checkbox"
                checked={filters.advanced}
                onChange={(e) =>
                  setFilters({ ...filters, advanced: e.target.checked })
                }
              />
              Search tag names too
            </label>
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                if (presetName.trim()) {
                  savePresets(
                    [
                      ...presets.filter((p) => p.name !== presetName.trim()),
                      {
                        name: presetName.trim(),
                        filters: { ...filters, search: query },
                      },
                    ].slice(-20),
                  );
                  setPresetName("");
                }
              }}
            >
              <input
                aria-label="Preset name"
                placeholder="Name this filter"
                maxLength={50}
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
              <button>Save preset</button>
            </form>
            {presets.map((p) => (
              <span className="row" key={p.name}>
                <button
                  onClick={() => {
                    setFilters({ ...emptyFilters, ...p.filters });
                    setQuery(p.filters.search);
                  }}
                >
                  {p.name}
                </button>
                <button
                  aria-label={`Delete preset ${p.name}`}
                  onClick={() =>
                    savePresets(presets.filter((x) => x.name !== p.name))
                  }
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </section>
        <div className="results-line">
          <span>
            {loading
              ? "Loading your workspace…"
              : `${count} task${count === 1 ? "" : "s"} shown`}
          </span>
          <button
            className="link"
            onClick={notifications.request}
            disabled={
              notifications.permission === "granted" ||
              notifications.permission === "unsupported"
            }
          >
            <Bell size={15} />
            {notifications.permission === "granted"
              ? "Reminders enabled"
              : notifications.permission === "denied"
                ? "Notifications blocked in browser"
                : notifications.permission === "unsupported"
                  ? "Notifications unavailable"
                  : "Enable reminders"}
          </button>
        </div>
        {notifications.error && <p role="status">{notifications.error}</p>}
        {!loading && count === 0 && (
          <section className="empty panel">
            <div className="empty-symbol">✓</div>
            <h2>
              {todos.length ? "No matching tasks" : "Space for a fresh start"}
            </h2>
            <p className="muted">
              {todos.length
                ? "Try another search or clear your filters."
                : "Add your first task above. One small step is enough."}
            </p>
          </section>
        )}
        {Object.entries(sections).map(
          ([name, items]) =>
            items.length > 0 && (
              <section key={name} className="task-section" aria-label={name}>
                <h2 className="section-title">
                  {name}
                  <span>{items.length}</span>
                </h2>
                <div className="task-list">
                  {items.map((todo) => (
                    <article
                      className={`task panel ${todo.completed ? "completed" : ""}`}
                      key={todo.id}
                      data-testid={`todo-${todo.id}`}
                    >
                      <div className="task-top">
                        <input
                          className="task-check"
                          type="checkbox"
                          aria-label={`Complete ${todo.title}`}
                          checked={todo.completed}
                          disabled={busy}
                          onChange={() =>
                            void mutate(
                              () =>
                                api(`/api/todos/${todo.id}`, "PUT", {
                                  completed: !todo.completed,
                                }),
                              () =>
                                setTodos(
                                  todos.map((t) =>
                                    t.id === todo.id
                                      ? { ...t, completed: !t.completed }
                                      : t,
                                  ),
                                ),
                            )
                          }
                        />
                        <div className="grow">
                          <h3>{todo.title}</h3>
                          <div className="metadata">
                            <span className={`badge ${todo.priority}`}>
                              {todo.priority}
                            </span>
                            {todo.due_date && (
                              <time
                                dateTime={todo.due_date}
                                className={name === "Overdue" ? "overdue" : ""}
                              >
                                {formatSingaporeDate(todo.due_date)}
                              </time>
                            )}
                            {todo.is_recurring && (
                              <span className="badge repeat">
                                <Repeat size={12} />
                                {todo.recurrence_pattern}
                              </span>
                            )}
                            {todo.reminder_minutes && (
                              <span className="badge">
                                <Bell size={12} />
                                {
                                  reminderChoices.find(
                                    (x) => x.value === todo.reminder_minutes,
                                  )?.label
                                }
                              </span>
                            )}
                            {todo.tags.map((t) => (
                              <button
                                key={t.id}
                                className="tag-pill"
                                onClick={() =>
                                  setFilters({
                                    ...filters,
                                    tagId: String(t.id),
                                  })
                                }
                              >
                                <i style={{ backgroundColor: t.color }} />
                                {t.name}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="actions">
                          <button
                            aria-label={`Edit ${todo.title}`}
                            title="Edit task"
                            onClick={() => setEditing(todo)}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            aria-label={`Save ${todo.title} as template`}
                            title="Save as template"
                            onClick={() =>
                              setTemplateEdit({
                                name: todo.title,
                                title_template: todo.title,
                                priority: todo.priority,
                                is_recurring: todo.is_recurring,
                                recurrence_pattern: todo.recurrence_pattern,
                                reminder_minutes: todo.reminder_minutes,
                                due_date_offset_minutes: todo.due_date
                                  ? Math.max(
                                      1,
                                      Math.ceil(
                                        (parseDate(todo.due_date).getTime() -
                                          getSingaporeNow().getTime()) /
                                          60000,
                                      ),
                                    )
                                  : null,
                                subtasks: todo.subtasks.map((s) => ({
                                  title: s.title,
                                  position: s.position,
                                })),
                              })
                            }
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            aria-label={`Delete ${todo.title}`}
                            title="Delete task"
                            onClick={() => setRemove(todo)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                      {todo.subtasks.length > 0 && (
                        <div className="progress-block">
                          <div className="progress-label">
                            <span>
                              {todo.subtasks.filter((s) => s.completed).length}/
                              {todo.subtasks.length} subtasks
                            </span>
                            <span>{progress(todo.subtasks)}%</span>
                          </div>
                          <progress
                            className={
                              progress(todo.subtasks) === 100 ? "done" : ""
                            }
                            max={100}
                            value={progress(todo.subtasks)}
                            aria-label={`${todo.title} subtask progress`}
                          />
                        </div>
                      )}
                      <button
                        className="link subtask-toggle"
                        onClick={() =>
                          setExpanded(
                            expanded.includes(todo.id)
                              ? expanded.filter((id) => id !== todo.id)
                              : [...expanded, todo.id],
                          )
                        }
                      >
                        <ChevronDown size={14} />
                        {expanded.includes(todo.id) ? "Hide" : "Manage"}{" "}
                        subtasks
                      </button>
                      {expanded.includes(todo.id) && (
                        <div className="subtasks">
                          {todo.subtasks.map((s) => (
                            <div className="row" key={s.id}>
                              <label className="check grow">
                                <input
                                  type="checkbox"
                                  checked={s.completed}
                                  disabled={busy}
                                  onChange={() =>
                                    void mutate(
                                      () =>
                                        api(`/api/subtasks/${s.id}`, "PUT", {
                                          completed: !s.completed,
                                        }),
                                      () =>
                                        setTodos(
                                          todos.map((t) =>
                                            t.id === todo.id
                                              ? {
                                                  ...t,
                                                  subtasks: t.subtasks.map(
                                                    (child) =>
                                                      child.id === s.id
                                                        ? {
                                                            ...child,
                                                            completed:
                                                              !child.completed,
                                                          }
                                                        : child,
                                                  ),
                                                }
                                              : t,
                                          ),
                                        ),
                                    )
                                  }
                                />
                                {s.title}
                              </label>
                              <button
                                aria-label={`Rename subtask ${s.title}`}
                                onClick={() => {
                                  const title = window.prompt(
                                    "Subtask title",
                                    s.title,
                                  );
                                  if (title)
                                    void mutate(() =>
                                      api(`/api/subtasks/${s.id}`, "PUT", {
                                        title,
                                      }),
                                    );
                                }}
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                aria-label={`Delete subtask ${s.title}`}
                                onClick={() =>
                                  void mutate(() =>
                                    api(`/api/subtasks/${s.id}`, "DELETE"),
                                  )
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                          <form
                            className="row"
                            onSubmit={async (e) => {
                              e.preventDefault();
                              const form = e.currentTarget,
                                input = form.elements.namedItem(
                                  "subtask",
                                ) as HTMLInputElement;
                              if (
                                await mutate(() =>
                                  api(
                                    `/api/todos/${todo.id}/subtasks`,
                                    "POST",
                                    { title: input.value },
                                  ),
                                )
                              )
                                form.reset();
                            }}
                          >
                            <input
                              name="subtask"
                              aria-label={`New subtask for ${todo.title}`}
                              required
                              maxLength={500}
                              placeholder="Add a small step…"
                            />
                            <button disabled={busy}>Add subtask</button>
                          </form>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </section>
            ),
        )}
        <footer>
          Built for a little less overwhelm. All dates use Asia/Singapore.
        </footer>
      </main>
      {editing && (
        <Modal error={error} title="Edit task" onClose={() => setEditing(null)}>
          <TodoForm
            todo={editing}
            tags={tags}
            busy={busy}
            onCancel={() => setEditing(null)}
            onSave={async (v) => {
              if (await mutate(() => api(`/api/todos/${editing.id}`, "PUT", v)))
                setEditing(null);
            }}
          />
        </Modal>
      )}
      {remove && (
        <Modal
          error={error}
          title="Delete task?"
          onClose={() => setRemove(null)}
        >
          <p>
            This will delete “{remove.title}” and its subtasks. This cannot be
            undone.
          </p>
          <div className="row end">
            <button onClick={() => setRemove(null)}>Cancel</button>
            <button
              className="danger"
              disabled={busy}
              onClick={async () => {
                if (
                  await mutate(
                    () => api(`/api/todos/${remove.id}`, "DELETE"),
                    () => setTodos(todos.filter((t) => t.id !== remove.id)),
                  )
                )
                  setRemove(null);
              }}
            >
              Delete task
            </button>
          </div>
        </Modal>
      )}
      {manage === "tags" && (
        <Modal
          error={error}
          title="Manage tags"
          onClose={() => {
            setManage(null);
            setTagEdit(null);
            setTagName("");
          }}
        >
          <form
            className="row wrap"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await mutate(() =>
                  api(
                    `/api/tags${tagEdit ? `/${tagEdit.id}` : ""}`,
                    tagEdit ? "PUT" : "POST",
                    { name: tagName, color: tagColor },
                  ),
                )
              ) {
                setTagEdit(null);
                setTagName("");
              }
            }}
          >
            <label className="grow">
              Tag name
              <input
                required
                maxLength={50}
                value={tagName}
                onChange={(e) => setTagName(e.target.value)}
              />
            </label>
            <label>
              Color
              <input
                type="color"
                value={tagColor}
                onChange={(e) => setTagColor(e.target.value)}
              />
            </label>
            <button className="primary" disabled={busy}>
              {tagEdit ? "Save tag" : "Create tag"}
            </button>
            {tagEdit && (
              <button
                type="button"
                onClick={() => {
                  setTagEdit(null);
                  setTagName("");
                }}
              >
                Cancel edit
              </button>
            )}
          </form>
          <div className="stack tag-list">
            {tags.map((t) => (
              <div className="row" key={t.id}>
                <span className="tag-pill grow">
                  <i style={{ backgroundColor: t.color }} />
                  {t.name}
                </span>
                <button
                  aria-label={`Edit tag ${t.name}`}
                  onClick={() => {
                    setTagEdit(t);
                    setTagName(t.name);
                    setTagColor(t.color);
                  }}
                >
                  <Pencil size={15} />
                </button>
                <button
                  aria-label={`Delete tag ${t.name}`}
                  disabled={busy}
                  onClick={() =>
                    void mutate(() => api(`/api/tags/${t.id}`, "DELETE"))
                  }
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
      {manage === "templates" && (
        <Modal error={error} title="Templates" onClose={() => setManage(null)}>
          <div className="row">
            <label className="grow">
              Category filter
              <select
                aria-label="Category filter"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">All categories</option>
                {[
                  ...new Set(templates.map((t) => t.category).filter(Boolean)),
                ].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              onClick={() => setTemplateEdit({ title_template: "", name: "" })}
            >
              New template
            </button>
          </div>
          <div className="stack template-list">
            {templates
              .filter((t) => !category || t.category === category)
              .map((t) => (
                <article key={t.id} className="template-card">
                  <h3>{t.name}</h3>
                  <p>{t.description}</p>
                  <p className="hint">
                    {t.category || "Uncategorized"} · {t.priority} ·{" "}
                    {t.subtasks.length} subtasks ·{" "}
                    {t.due_date_offset_minutes
                      ? `due in ${t.due_date_offset_minutes} min`
                      : "no due date"}
                    {t.is_recurring ? ` · ${t.recurrence_pattern}` : ""}
                  </p>
                  <details>
                    <summary>Preview task</summary>
                    <p>{t.title_template}</p>
                    <ul>
                      {t.subtasks.map((s, i) => (
                        <li key={i}>{s.title}</li>
                      ))}
                    </ul>
                  </details>
                  <div className="row">
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={async () => {
                        if (
                          await mutate(() =>
                            api(`/api/templates/${t.id}/use`, "POST", {}),
                          )
                        )
                          setManage(null);
                      }}
                    >
                      Use {t.name}
                    </button>
                    <button
                      aria-label={`Edit template ${t.name}`}
                      onClick={() => setTemplateEdit(t)}
                    >
                      Edit
                    </button>
                    <button
                      aria-label={`Delete template ${t.name}`}
                      disabled={busy}
                      onClick={() =>
                        void mutate(() =>
                          api(`/api/templates/${t.id}`, "DELETE"),
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </article>
              ))}
          </div>
          {templates.length === 0 && (
            <p className="muted">
              Save any task as a template, or create one here.
            </p>
          )}
        </Modal>
      )}
      {templateEdit && (
        <Modal
          error={error}
          title={templateEdit.id ? "Edit template" : "Save template"}
          onClose={() => setTemplateEdit(null)}
        >
          <TemplateForm
            initial={templateEdit}
            busy={busy}
            onSave={async (v) => {
              if (
                await mutate(() =>
                  api(
                    `/api/templates${v.id ? `/${v.id}` : ""}`,
                    v.id ? "PUT" : "POST",
                    v,
                  ),
                )
              )
                setTemplateEdit(null);
            }}
          />
        </Modal>
      )}
    </>
  );
}
