import { expect, test } from "@playwright/test";

test("introduces Tokenly and offers the primary entry action", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Your event tokens, in one happy place.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter Tokenly" })).toBeVisible();
});
