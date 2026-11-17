import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/db.ts",
        "lib/timezone.ts",
        "lib/logic.ts",
        "lib/holidays.ts",
      ],
      reporter: ["text", "json-summary", "html"],
      thresholds: { lines: 80, functions: 80, statements: 80, branches: 75 },
    },
  },
});
