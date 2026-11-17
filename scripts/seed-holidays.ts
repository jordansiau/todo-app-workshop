import { seedHolidays } from "../lib/holidays";
import { closeDB } from "../lib/db";
process.stdout.write(
  `Seeded ${seedHolidays()} Singapore holiday dates for 2026.\n`,
);
closeDB();
