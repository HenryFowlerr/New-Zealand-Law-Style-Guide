import { expect, test } from "@playwright/test";

/**
 * Interface-level tests covering the paths a student actually takes: live
 * detection, keyboard flow, fail-closed prompting, hostile input, the footnote
 * composer, and worked examples. Engine correctness is covered exhaustively by
 * the node:test suites; these guard the wiring between the engine and the UI.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("live detection then Enter opens a prefilled, ready journal", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  await page
    .locator("textarea")
    .fill("Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.");
  await expect(page.locator(".suggestion-top")).toHaveCount(1);
  await page.locator("textarea").press("Enter");
  await expect(page.locator("#citation-form")).toBeVisible();
  await page.locator(".confirmation-box input").check();
  await expect(page.locator(".result-status.ready")).toBeVisible();
  await expect(page.locator(".citation-preview p")).toContainText(
    "(2005) 121 LQR 163 at 165",
  );
});

test("a bare word neither crashes nor opens a form", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  await page.locator("textarea").fill("Smith");
  await page.waitForTimeout(400);
  await expect(page.locator("#citation-form")).toHaveCount(0);
});

test("dropping a required field keeps the tool fail-closed", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("neutral");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-caseName", "Attorney-General v X");
  await page.fill("#input-year", "2007");
  await page.fill("#input-court", "NZCA");
  await expect(page.locator(".result-status.ready")).toHaveCount(0);
  await page.fill("#input-judgmentNumber", "388");
  await expect(page.locator(".result-status.ready")).toBeVisible();
  await expect(page.locator(".citation-preview p")).toHaveText(
    "Attorney-General v X [2007] NZCA 388.",
  );
});

test("a two-digit year is rejected with an error", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("statute");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-title", "Evidence Act");
  await page.fill("#input-year", "06");
  await expect(page.locator(".issue-error")).toHaveCount(1);
  await expect(page.locator(".result-status.ready")).toHaveCount(0);
});

test("injected markup never renders into the preview", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("statute");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-title", "<img src=x onerror=alert(1)> Act");
  await page.fill("#input-year", "2006");
  await expect(page.locator(".citation-preview img")).toHaveCount(0);
});

test("Hansard is detected from a pasted reference and built correctly", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  await page.locator("textarea").fill("(21 September 2010) 666 NZPD 14104.");
  await expect(page.locator(".suggestion-top strong")).toContainText(/Hansard|Parliamentary/);
  await page.locator("textarea").press("Enter");
  await page.locator(".confirmation-box input").check();
  await expect(page.locator(".citation-preview p")).toHaveText(
    "(21 September 2010) 666 NZPD 14104.",
  );
});

test("the footnote composer collects an authority and persists it", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("statute");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-title", "Evidence Act");
  await page.fill("#input-year", "2006");
  await page.getByRole("button", { name: /Add this authority/ }).click();
  await expect(page.locator(".authority-list li")).toHaveCount(1);
  await expect(page.locator(".composed-output p")).toContainText("Evidence Act 2006");
  await page.reload();
  await expect(page.locator(".authority-list li")).toHaveCount(1);
});

test("the build-from-details picker exposes every verified format", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await expect(page.locator(".type-card")).toHaveCount(17);
});
