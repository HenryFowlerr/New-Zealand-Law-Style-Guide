import { expect, test } from "@playwright/test";

/**
 * Interface tests for the data-driven engine covering all Style Guide types.
 * They exercise the real student paths — live detection, fail-closed prompting,
 * hostile input, the footnote composer — through the generic form and renderer.
 * Engine correctness is covered exhaustively by the node:test suites.
 */

test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("live detection recognises a reported case and builds it exactly", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  await page
    .locator("textarea")
    .fill(
      "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
    );
  await expect(page.locator(".suggestion-top strong")).toContainText(/Reported case/);
  await page.locator("textarea").press("Enter");
  await expect(page.locator("#citation-form")).toBeVisible();
  await page.locator(".confirmation-box input").check();
  await expect(page.locator(".result-status.ready")).toBeVisible();
  await expect(page.locator(".citation-preview p")).toHaveText(
    "Z v Dental Complaints Assessment Committee [2008] NZSC 55, [2009] 1 NZLR 1 at [26].",
  );
});

test("a bare word neither crashes nor opens a form", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  await page.locator("textarea").fill("Smith");
  await page.waitForTimeout(400);
  await expect(page.locator("#citation-form")).toHaveCount(0);
});

test("building a statute is fail-closed until every required field is present", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("New Zealand statute");
  await page.locator(".search-field input").press("Enter");
  await expect(page.locator("#citation-form")).toBeVisible();
  await page.fill("#input-shortTitle", "Evidence Act");
  await expect(page.locator(".result-status.ready")).toHaveCount(0);
  await page.fill("#input-year", "2006");
  await expect(page.locator(".result-status.ready")).toBeVisible();
  await expect(page.locator(".citation-preview p")).toHaveText("Evidence Act 2006.");
  await page.fill("#input-pinpoint", "s 8");
  await expect(page.locator(".citation-preview p")).toHaveText("Evidence Act 2006, s 8.");
});

test("injected markup never renders into the preview", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("New Zealand statute");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-shortTitle", "<img src=x onerror=alert(1)> Act");
  await page.fill("#input-year", "2006");
  await expect(page.locator(".citation-preview img")).toHaveCount(0);
});

test("the footnote composer collects an authority and persists it", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("New Zealand statute");
  await page.locator(".search-field input").press("Enter");
  await page.fill("#input-shortTitle", "Evidence Act");
  await page.fill("#input-year", "2006");
  await page.getByRole("button", { name: /Add this authority/ }).click();
  await expect(page.locator(".authority-list li")).toHaveCount(1);
  await expect(page.locator(".composed-output p")).toContainText("Evidence Act 2006");
  await page.reload();
  await expect(page.locator(".authority-list li")).toHaveCount(1);
});

test("the picker exposes every Style Guide source type across all groups", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await expect(page.locator(".type-card")).toHaveCount(86);
  await expect(page.locator(".type-group h3")).toHaveText([
    "Cases",
    "Legislation",
    "Parliamentary & official",
    "Secondary sources",
    "International & foreign",
    "Subsequent references",
  ]);
});

test("an international type (treaty) builds from scratch", async ({ page }) => {
  await page.getByRole("tab", { name: /Build from details/ }).click();
  await page.locator(".search-field input").fill("Treaty");
  await page.locator('.type-card:has(strong:text-is("Treaty"))').click();
  await expect(page.locator("#citation-form")).toBeVisible();
  await expect(page.locator(".form-heading h2")).toHaveText("Treaty");
});
