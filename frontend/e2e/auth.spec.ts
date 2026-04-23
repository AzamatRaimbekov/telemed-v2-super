import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should show login page", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByPlaceholder("doctor@clinic.kg")).toBeVisible();
    await expect(page.getByPlaceholder("Введите пароль")).toBeVisible();
  });

  test("should show error on wrong credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("doctor@clinic.kg").fill("wrong@email.com");
    await page.getByPlaceholder("Введите пароль").fill("wrongpass");
    await page.getByText("Войти в систему").click();
    // Should show error, not reload
    await expect(page.getByText(/Неверный|Ошибка/)).toBeVisible({ timeout: 5000 });
  });

  test("should show demo credentials hint", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("admin@medcore.kg")).toBeVisible();
  });
});
