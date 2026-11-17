import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Todo, Tag, Template, Subtask } from "../lib/db";
export async function register(page: Page) {
  const client = await page.context().newCDPSession(page);
  await client.send("WebAuthn.enable");
  await client.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  const username = "test-" + randomUUID().slice(0, 12);
  await page.goto("/login");
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Register with passkey" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer day starts here." }),
  ).toBeVisible();
  await expect(page.getByText("Loading your workspace…")).toHaveCount(0);
  return username;
}
export async function login(page: Page, username: string) {
  await page.getByLabel("Username").fill(username);
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(
    page.getByRole("heading", { name: "A clearer day starts here." }),
  ).toBeVisible();
}
export async function request<T>(
  page: Page,
  url: string,
  method = "POST",
  data: unknown = {},
): Promise<T> {
  const res = await page.request.fetch(url, {
    method,
    data: method === "GET" ? undefined : data,
  });
  expect(res.ok(), `${method} ${url}: ${await res.text()}`).toBeTruthy();
  return res.json();
}
export async function createTodo(
  page: Page,
  title: string,
  extra: object = {},
) {
  return request<Todo>(page, "/api/todos", "POST", { title, ...extra });
}
export async function createTag(page: Page, name: string, color = "#3b82f6") {
  return request<Tag>(page, "/api/tags", "POST", { name, color });
}
export async function addSubtask(page: Page, id: number, title: string) {
  return request<Subtask>(page, `/api/todos/${id}/subtasks`, "POST", { title });
}
export async function createTemplate(page: Page, input: object) {
  return request<Template>(page, "/api/templates", "POST", input);
}
export async function reload(page: Page) {
  await page.reload();
  await expect(page.getByText("Loading your workspace…")).toHaveCount(0);
}
