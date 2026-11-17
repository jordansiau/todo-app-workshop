export const TIMEZONE = "Asia/Singapore";
/** Date construction is centralized here; never shift an instant twice. */
export function getSingaporeNow() {
  return new Date();
}
export function parseDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(value);
  if (!match) throw new Error("Invalid ISO date");
  const [, year, month, day] = match;
  const calendarDate = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day)),
  );
  if (calendarDate.toISOString().slice(0, 10) !== `${year}-${month}-${day}`)
    throw new Error("Invalid calendar date");
  const text = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(value)
    ? `${value}+08:00`
    : value;
  const date = new Date(text);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid date");
  return date;
}
export function toLocalInput(value: string | Date) {
  const date = typeof value === "string" ? parseDate(value) : value;
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: string) => p.find((x) => x.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
export function dateKey(value: string | Date) {
  return toLocalInput(value).slice(0, 10);
}
export function formatSingaporeDate(
  value: string | null,
  options?: Intl.DateTimeFormatOptions,
) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-SG", {
    ...(options || {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    timeZone: TIMEZONE,
  }).format(parseDate(value));
}
export function nowISO() {
  return getSingaporeNow().toISOString();
}
export function minutesFromNow(minutes: number, now = getSingaporeNow()) {
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}
export function nextDueDate(value: string, pattern: string) {
  const local = toLocalInput(value);
  const [year, month, day] = local.slice(0, 10).split("-").map(Number);
  const time = local.slice(11);
  if (pattern === "daily" || pattern === "weekly")
    return new Date(
      parseDate(value).getTime() + (pattern === "daily" ? 1 : 7) * 86400000,
    ).toISOString();
  const targetMonth = pattern === "monthly" ? month : month - 1;
  const targetYear = pattern === "yearly" ? year + 1 : year;
  const maxDay = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  const anchor = new Date(
    Date.UTC(targetYear, targetMonth, Math.min(day, maxDay)),
  );
  return parseDate(
    `${anchor.toISOString().slice(0, 10)}T${time}`,
  ).toISOString();
}
export function calendarGrid(month: string) {
  const current = dateKey(getSingaporeNow()).slice(0, 7);
  const valid =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(month) &&
    Number(month.slice(0, 4)) >= 1900 &&
    Number(month.slice(0, 4)) <= 2100;
  const chosen = valid ? month : current;
  const [y, m] = chosen.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  first.setUTCDate(1 - first.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(first);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}
export function shiftMonth(month: string, offset: number) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + offset, 1)).toISOString().slice(0, 7);
}
