import { test, expect } from "@playwright/test";

test.describe("Landing Page", () => {
  test("should load landing page", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/MedCore/);
  });

  test("should have navbar with demo button", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Заказать демо")).toBeVisible();
  });

  test("should navigate to login", async ({ page }) => {
    await page.goto("/");
    await page.getByText("Войти").first().click();
    await expect(page).toHaveURL(/login/);
  });
});
