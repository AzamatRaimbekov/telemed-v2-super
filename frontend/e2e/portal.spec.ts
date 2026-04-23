import { test, expect } from "@playwright/test";

test.describe("Patient Portal", () => {
  test("should show portal login", async ({ page }) => {
    await page.goto("/portal/login");
    await expect(page.locator("body")).toContainText(/Портал|Вход/);
  });

  test("should redirect unauthenticated to portal login", async ({ page }) => {
    await page.goto("/portal/dashboard");
    await expect(page).toHaveURL(/portal\/login/);
  });
});
