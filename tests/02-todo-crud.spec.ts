import { test, expect } from "@playwright/test";
import { register } from "./helpers";
test("create, edit, complete and confirmed deletion through UI", async ({
  page,
}) => {
  await register(page);
  await page
    .getByLabel("Task title", { exact: true })
    .fill("Read course notes");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  const card = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name: "Read course notes" }) });
  await expect(card).toBeVisible();
  await card
    .getByRole("button", { name: "Edit Read course notes", exact: true })
    .click();
  const modal = page.getByRole("dialog");
  await modal
    .getByLabel("Task title", { exact: true })
    .fill("Review course notes");
  await modal.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(modal).toHaveCount(0);
  await page
    .getByLabel("Complete Review course notes", { exact: true })
    .check();
  await expect(
    page
      .getByRole("region", { name: "Completed", exact: true })
      .getByRole("heading", { name: "Review course notes" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Review course notes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review course notes" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Review course notes", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Delete task", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review course notes" }),
  ).toHaveCount(0);
});
test("invalid input leaves composer intact and shows error", async ({
  page,
}) => {
  await register(page);
  await page.getByLabel("Task title", { exact: true }).fill("   ");
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Too small",
  );
  await expect(page.getByLabel("Task title", { exact: true })).toHaveValue(
    "   ",
  );
});
