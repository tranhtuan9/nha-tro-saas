import { expect, test } from "@playwright/test";
import { formatBillingMonth, login, recentBillingMonths } from "./helpers";

test("landlord lập hóa đơn, renter xem và landlord hủy hóa đơn", async ({ page, browser }) => {
  const landlordEmail = process.env.E2E_LANDLORD_EMAIL;
  const renterEmail = process.env.E2E_RENTER_EMAIL;
  const password = process.env.DEMO_PASSWORD;

  if (!landlordEmail || !renterEmail || !password) {
    test.skip(
      true,
      "Thiếu E2E_LANDLORD_EMAIL, E2E_RENTER_EMAIL hoặc DEMO_PASSWORD trong .env.local",
    );
    return;
  }

  const baseURL = test.info().project.use.baseURL ?? "http://localhost:3000";
  const renterContext = await browser.newContext({ baseURL });
  const renterPage = await renterContext.newPage();

  await login(renterPage, renterEmail, password);
  await expect(renterPage).toHaveURL(/\/renter\/overview/);
  await renterPage.goto("/renter/contract");
  const renterRoomLabel = renterPage.getByText(/^Phòng \S+/).first();
  await expect(renterRoomLabel).toBeVisible({ timeout: 15_000 });
  const roomCode = (await renterRoomLabel.textContent())!.replace(/^Phòng\s+/, "").trim();

  await login(page, landlordEmail, password);
  await expect(page).toHaveURL(/\/landlord\/overview/);

  await page.goto("/landlord/invoices");
  await page.getByRole("button", { name: "Lập hóa đơn", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const propertySelect = dialog.locator("#invoice-property");
  const contractSelect = dialog.locator("#invoice-contract");
  await expect(propertySelect.locator("option").nth(1)).toBeAttached({ timeout: 15_000 });

  let propertyId: string | null = null;
  let contractId: string | null = null;
  const propertyCount = await propertySelect.locator("option").count();

  for (let index = 1; index < propertyCount; index += 1) {
    const propertyOption = propertySelect.locator("option").nth(index);
    const candidatePropertyId = await propertyOption.getAttribute("value");
    if (!candidatePropertyId) continue;

    await propertySelect.selectOption(candidatePropertyId);
    const matchingContract = contractSelect.locator("option").filter({ hasText: roomCode }).first();

    try {
      await expect(matchingContract).toBeAttached({ timeout: 5_000 });
    } catch {
      continue;
    }

    const candidateContractId = await matchingContract.getAttribute("value");
    if (!candidateContractId) continue;

    propertyId = candidatePropertyId;
    contractId = candidateContractId;
    await contractSelect.selectOption(candidateContractId);
    break;
  }

  if (!propertyId || !contractId) {
    test.skip(true, "Tài khoản người thuê chưa có hợp đồng đang hiệu lực");
    return;
  }

  const monthInput = dialog.locator("#invoice-month");
  const previewButton = dialog.getByRole("button", { name: "Xem trước" });
  const issueButton = dialog.getByRole("button", { name: "Phát hành hóa đơn" });
  const noReading = dialog.getByText("Chưa có chỉ số cho kỳ này.");
  const hasReading = dialog.getByText(/Điện:/);

  let issuedMonth: string | null = null;

  for (const [index, month] of recentBillingMonths(12).entries()) {
    const sheetLoaded =
      index === 0
        ? Promise.resolve()
        : page
            .waitForResponse(
              (response) =>
                response.url().includes("/meter-readings/sheet") &&
                response.url().includes(`billingMonth=${month}`),
              { timeout: 15_000 },
            )
            .catch(() => null);

    await monthInput.fill(month);
    await sheetLoaded;
    await expect(hasReading.or(noReading)).toBeVisible({ timeout: 15_000 });

    if (await noReading.isVisible()) continue;

    const previewResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/invoices/preview") &&
        response.request().method() === "POST",
    );
    await previewButton.click();
    const preview = await previewResponse;

    if (!preview.ok()) continue;
    await expect(issueButton).toBeEnabled();

    const createResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname.endsWith("/invoices") &&
        response.request().method() === "POST",
    );
    await issueButton.click();
    const created = await createResponse;

    if (!created.ok()) continue;

    await expect(dialog).toBeHidden();
    issuedMonth = month;
    break;
  }

  if (!issuedMonth) {
    test.skip(true, "Tài khoản demo không có kỳ chỉ số nào còn trống để lập hóa đơn");
    return;
  }

  const monthLabel = formatBillingMonth(issuedMonth);

  await page.getByLabel("Lọc theo nhà trọ").selectOption(propertyId);
  await page.getByLabel("Lọc theo trạng thái").selectOption("UNPAID");
  const listPromise = page.waitForResponse(
    (r) =>
      r.url().includes("/api/invoices") &&
      r.url().includes(`billingMonth=${issuedMonth}`) &&
      r.url().includes("status=UNPAID") &&
      r.url().includes(`propertyId=${propertyId}`) &&
      r.request().method() === "GET",
    { timeout: 15000 },
  );
  await page.getByLabel("Lọc theo kỳ").fill(issuedMonth);
  await listPromise;

  const landlordRow = page.getByRole("row").filter({ hasText: roomCode });
  await expect(landlordRow).toHaveCount(1, { timeout: 15_000 });
  await expect(landlordRow.first()).toContainText(monthLabel);

  await renterPage.goto("/renter/invoices");

  const renterRow = renterPage
    .getByRole("row")
    .filter({ hasText: roomCode })
    .filter({ hasText: monthLabel });
  await expect(renterRow).toBeVisible({ timeout: 15_000 });

  await renterContext.close();

  await landlordRow.getByRole("button", { name: "Hủy", exact: true }).click();

  const confirmDialog = page.getByRole("dialog", { name: "Hủy hóa đơn" });
  await expect(confirmDialog).toBeVisible();
  await confirmDialog.getByRole("button", { name: "Hủy hóa đơn", exact: true }).click();
  await expect(confirmDialog).toBeHidden();

  await page.getByLabel("Lọc theo trạng thái").selectOption("CANCELLED");
  await expect(page.getByRole("row").filter({ hasText: roomCode }).first()).toContainText(
    "Đã hủy",
  );
});
