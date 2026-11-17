import { test, expect } from "@playwright/test";
import { register, login, createTodo } from "./helpers";
test("real passkey register, logout, login and HTTP-only seven-day cookie", async ({
  page,
}) => {
  const name = await register(page);
  await createTodo(page, "Private task");
  const cookie = (await page.context().cookies()).find(
    (c) => c.name === "session",
  )!;
  expect(cookie.httpOnly).toBe(true);
  expect(cookie.sameSite).toBe("Lax");
  expect(cookie.expires - Date.now() / 1000).toBeGreaterThan(6 * 86400);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/login/);
  expect((await page.request.get("/api/todos")).status()).toBe(401);
  await login(page, name);
  await expect(
    page.getByRole("heading", { name: "Private task" }),
  ).toBeVisible();
});
test("unauthenticated routes, forged session and invalid verification rejected", async ({
  page,
}) => {
  await page.goto("/calendar");
  await expect(page).toHaveURL(/login/);
  for (const url of [
    "/api/todos",
    "/api/tags",
    "/api/templates",
    "/api/holidays",
    "/api/notifications/check",
    "/api/todos/export",
  ])
    expect((await page.request.get(url)).status()).toBe(401);
  expect(
    (
      await page.request.post("/api/auth/login-verify", {
        data: { id: "fake" },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.post("/api/auth/register-options", {
        headers: { Origin: "https://evil.example" },
        data: { username: "attacker" },
      })
    ).status(),
  ).toBe(403);
});
test("users cannot read or mutate each other’s data", async ({
  page,
  browser,
}) => {
  await register(page);
  const todo = await createTodo(page, "Private");
  const otherContext = await browser.newContext();
  const other = await otherContext.newPage();
  await register(other);
  expect((await other.request.get(`/api/todos/${todo.id}`)).status()).toBe(404);
  expect(
    (
      await other.request.put(`/api/todos/${todo.id}`, {
        data: { title: "stolen" },
      })
    ).status(),
  ).toBe(404);
  expect((await other.request.delete(`/api/todos/${todo.id}`)).status()).toBe(
    404,
  );
  expect(await (await other.request.get("/api/todos")).json()).toEqual([]);
  await otherContext.close();
});
