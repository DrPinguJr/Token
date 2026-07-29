import { expect, test } from "@playwright/test";

test("opens the Tokenly entry screen", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/enter$/);
  await expect(
    page.getByRole("link", { name: "Tokenly x Big Blue Floorball" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible();
});
