import { expect, type Page } from "@playwright/test";

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/login");
  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

export function recentBillingMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];

  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    months.push(`${date.getFullYear()}-${month}`);
  }

  return months;
}

export function formatBillingMonth(month: string): string {
  const [year, value] = month.split("-");
  return `${value}/${year}`;
}
