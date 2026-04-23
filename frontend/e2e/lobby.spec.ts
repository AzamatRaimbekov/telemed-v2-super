import { test, expect } from "@playwright/test";

test.describe("Public Pages", () => {
  test("lobby page should load", async ({ page }) => {
    await page.goto("/lobby");
    await expect(page.locator("body")).toContainText(/MedCore|Очередь/);
  });
});
