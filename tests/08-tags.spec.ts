import { test, expect } from "@playwright/test";
import { register, createTodo, createTag, reload, request } from "./helpers";
test("tag UI create, duplicate error, assignment, live rename, filter and delete", async ({
  page,
}) => {
  await register(page);
  await page.getByRole("button", { name: "Manage tags" }).click();
  await page.getByLabel("Tag name", { exact: true }).fill("Work");
  await page.getByLabel("Color", { exact: true }).fill("#f00000");
  await page.getByRole("button", { name: "Create tag", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Work", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  const tags = await request<{ id: number }[]>(page, "/api/tags", "GET");
  const tag2 = await createTag(page, "Home");
  await createTodo(page, "Tagged", { tag_ids: [tags[0].id, tag2.id] });
  await createTodo(page, "Untagged");
  await reload(page);
  await page
    .getByRole("article")
    .filter({ hasText: "Tagged" })
    .getByRole("button", { name: "Work", exact: true })
    .click();
  await expect(page.locator("article h3")).toHaveText(["Tagged"]);
  expect(
    (await page.request.post("/api/tags", { data: { name: "work" } })).status(),
  ).toBe(409);
  await page.getByRole("button", { name: "Manage tags" }).click();
  await page.getByRole("button", { name: "Edit tag Work" }).click();
  await page.getByLabel("Tag name", { exact: true }).fill("Office");
  await page.getByRole("button", { name: "Save tag", exact: true }).click();
  await expect(
    page.getByRole("dialog").getByText("Office", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete tag Office" }).click();
  await expect(
    page.getByRole("dialog").getByText("Office", { exact: true }),
  ).toHaveCount(0);
});
