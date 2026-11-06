import { expect, test } from "@playwright/test";

test("chủ nhà đăng ký, tạo nhà trọ và phòng đầu tiên", async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e-${stamp}@example.com`;
  const password = `E2e!${stamp}`;
  const tenantName = `E2E ${stamp}`;
  const propertyName = `Nhà trọ E2E ${stamp}`;
  const roomCode = `P.${stamp}`;

  await page.goto("/register");
  await page.locator("#register-full-name").fill("Chủ nhà kiểm thử E2E");
  await page.locator("#register-email").fill(email);
  await page.locator("#register-phone").fill("0901234567");
  await page.locator("#register-tenant").fill(tenantName);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-confirm").fill(password);
  await page.getByRole("checkbox", { name: /điều khoản sử dụng/ }).check();
  await page.getByRole("button", { name: "Đăng ký", exact: true }).click();

  await expect(page).toHaveURL(/\/landlord\/overview/);

  await page.goto("/landlord/properties");
  await page.getByRole("button", { name: "Thêm nhà trọ", exact: true }).click();

  const propertyDialog = page.getByRole("dialog");
  await expect(propertyDialog).toBeVisible();
  await propertyDialog.locator("#property-name").fill(propertyName);
  await propertyDialog.locator("#property-address").fill("Số 1 đường Kiểm Thử, Hà Nội");
  await propertyDialog.locator("#property-electricity").fill("3500");
  await propertyDialog.locator("#property-water").fill("15000");
  await propertyDialog
    .getByRole("button", { name: "Thêm nhà trọ", exact: true })
    .click();

  await expect(propertyDialog).toBeHidden();
  await expect(page.getByText(propertyName).first()).toBeVisible();

  await page.getByRole("button", { name: "Thêm phòng", exact: true }).click();

  const roomDialog = page.getByRole("dialog");
  await expect(roomDialog).toBeVisible();
  await roomDialog.locator("#room-property").selectOption({ label: propertyName });
  await roomDialog.locator("#room-code").fill(roomCode);
  await roomDialog.locator("#room-price").fill("3500000");
  await roomDialog.getByRole("button", { name: "Thêm phòng", exact: true }).click();

  await expect(roomDialog).toBeHidden();
  await page.getByRole("tab", { name: "Danh sách phòng" }).click();
  const roomRow = page
    .getByRole("row")
    .filter({ hasText: roomCode })
    .filter({ hasText: propertyName });
  await expect(roomRow).toBeVisible();
});
