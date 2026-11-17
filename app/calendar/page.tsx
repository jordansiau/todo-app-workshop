"use client";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/client";
import type { Todo } from "@/lib/db";
import {
  calendarGrid,
  dateKey,
  getSingaporeNow,
  shiftMonth,
  formatSingaporeDate,
} from "@/lib/timezone";
export default function Calendar() {
  const [month, setMonth] = useState(dateKey(getSingaporeNow()).slice(0, 7)),
    [todos, setTodos] = useState<Todo[]>([]),
    [holidays, setHolidays] = useState<{ date: string; name: string }[]>([]),
    [selected, setSelected] = useState(""),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("month");
    if (
      q &&
      /^\d{4}-(0[1-9]|1[0-2])$/.test(q) &&
      Number(q.slice(0, 4)) >= 1900 &&
      Number(q.slice(0, 4)) <= 2100
    )
      setMonth(q);
    void Promise.all([
      api<Todo[]>("/api/todos"),
      api<{ date: string; name: string }[]>("/api/holidays"),
    ])
      .then(([t, h]) => {
        setTodos(t);
        setHolidays(h);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  function navigate(value: string) {
    setMonth(value);
    window.history.replaceState(null, "", `/calendar?month=${value}`);
  }
  const today = dateKey(getSingaporeNow());
  const dated = (day: string) =>
    todos.filter((t) => t.due_date && dateKey(t.due_date) === day);
  return (
    <>
      <Header />
      <main className="workspace">
        <p className="eyebrow">THE BIGGER PICTURE · SINGAPORE TIME</p>
        <h1>Your month, at a glance.</h1>
        <p className="muted">
          Tasks, deadlines, and Singapore public holidays in one place.
        </p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="calendar-controls">
          <h2>
            {formatSingaporeDate(month + "-01T00:00:00+08:00", {
              month: "long",
              year: "numeric",
            })}
          </h2>
          <div className="row">
            <button
              aria-label="Previous month"
              onClick={() => navigate(shiftMonth(month, -1))}
            >
              ←
            </button>
            <button onClick={() => navigate(today.slice(0, 7))}>Today</button>
            <button
              aria-label="Next month"
              onClick={() => navigate(shiftMonth(month, 1))}
            >
              →
            </button>
          </div>
        </div>
        {loading && <p role="status">Loading calendar…</p>}
        {month.slice(0, 4) !== "2026" && (
          <p className="hint">
            Holiday data currently covers 2026. Other years show tasks without
            public holidays.
          </p>
        )}
        <div className="calendar-grid" aria-label="Month calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div className="weekday" key={day}>
              {day}
            </div>
          ))}
          {calendarGrid(month).map((day, i) => {
            const tasks = dated(day),
              holiday = holidays.find((h) => h.date === day);
            return (
              <button
                key={day}
                aria-label={`${day}${holiday ? " " + holiday.name : ""}, ${tasks.length} tasks`}
                className={`day ${day === today ? "today" : ""} ${day < today ? "past" : ""} ${day.slice(0, 7) !== month ? "adjacent" : ""} ${i % 7 === 0 || i % 7 === 6 ? "weekend" : ""}`}
                onClick={() => setSelected(day)}
              >
                <span className="day-number">{Number(day.slice(-2))}</span>
                {holiday && <p className="holiday">{holiday.name}</p>}
                {tasks.slice(0, 3).map((t) => (
                  <span className={`calendar-task ${t.priority}`} key={t.id}>
                    {t.completed ? "✓ " : ""}
                    {t.title}
                  </span>
                ))}
                {tasks.length > 3 && (
                  <span className="calendar-more">
                    +{tasks.length - 3} more
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <footer>42-day grid · Click a day to see all its tasks.</footer>
      </main>
      {selected && (
        <Modal title={selected} onClose={() => setSelected("")}>
          {holidays
            .filter((h) => h.date === selected)
            .map((h) => (
              <p key={h.date} className="badge repeat">
                {h.name}
              </p>
            ))}
          {dated(selected).length === 0 ? (
            <p className="muted">No tasks due on this day.</p>
          ) : (
            dated(selected).map((t) => (
              <div className="template-card" key={t.id}>
                <h3>
                  {t.completed ? "✓ " : ""}
                  {t.title}
                </h3>
                <span className={`badge ${t.priority}`}>{t.priority}</span>
                <p className="hint">{formatSingaporeDate(t.due_date)}</p>
              </div>
            ))
          )}
        </Modal>
      )}
    </>
  );
}
