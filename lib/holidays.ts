import { db } from "./db";
import { nowISO } from "./timezone";
// MOM's gazetted dates and substitute Mondays, verified 17 November 2026.
// https://www.mom.gov.sg/newsroom/press-releases/2025/0616-public-holidays-for-2026
export const holidays2026 = [
  ["2026-01-01", "New Year's Day"],
  ["2026-02-17", "Chinese New Year"],
  ["2026-02-18", "Chinese New Year"],
  ["2026-03-21", "Hari Raya Puasa"],
  ["2026-04-03", "Good Friday"],
  ["2026-05-01", "Labour Day"],
  ["2026-05-27", "Hari Raya Haji"],
  ["2026-05-31", "Vesak Day"],
  ["2026-06-01", "Vesak Day (observed)"],
  ["2026-08-09", "National Day"],
  ["2026-08-10", "National Day (observed)"],
  ["2026-11-08", "Deepavali"],
  ["2026-11-09", "Deepavali (observed)"],
  ["2026-12-25", "Christmas Day"],
];
export function seedHolidays() {
  db().transaction(() => {
    for (const [date, name] of holidays2026)
      db()
        .prepare(
          "INSERT INTO holidays(date,name,created_at) VALUES(?,?,?) ON CONFLICT(date) DO UPDATE SET name=excluded.name",
        )
        .run(date, name, nowISO());
  })();
  return holidays2026.length;
}
