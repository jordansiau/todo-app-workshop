import { test, expect } from "@playwright/test";
import { register, createTodo, reload, request } from "./helpers";
import { minutesFromNow } from "../lib/timezone";
test("seven options, date dependency and exactly-once reminder API", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Show task options" }).click();
  await expect(page.getByLabel("Remind me", { exact: true })).toBeDisabled();
  expect(
    await page
      .getByLabel("Remind me", { exact: true })
      .locator("option")
      .count(),
  ).toBe(8);
  const t = await createTodo(page, "Due soon", {
    due_date: minutesFromNow(10),
    reminder_minutes: 15,
  });
  const first = await request<{ id: number }[]>(
    page,
    "/api/notifications/check",
    "GET",
  );
  expect(first.map((x) => x.id)).toEqual([t.id]);
  expect(await request(page, "/api/notifications/check", "GET")).toEqual([]);
  await reload(page);
  await expect(page.locator("article")).toContainText("15 minutes");
});
test("notification client calls browser constructor once when permission granted", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.defineProperty(window, "notificationsSeen", { value: seen });
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      constructor(title: string) {
        seen.push(title);
      }
    }
    Object.defineProperty(window, "Notification", {
      value: FakeNotification,
      configurable: true,
    });
  });
  await register(page);
  await createTodo(page, "Client reminder", {
    due_date: minutesFromNow(10),
    reminder_minutes: 15,
  });
  await reload(page);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { notificationsSeen: string[] })
            .notificationsSeen,
      ),
    )
    .toEqual(["Client reminder"]);
  await page.clock.install();
  await page.clock.fastForward(31000);
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { notificationsSeen: string[] })
          .notificationsSeen,
    ),
  ).toEqual(["Client reminder"]);
});
