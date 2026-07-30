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

test("a formatted (rich) paste splits an italic title from its author", async ({ page }) => {
  await page.getByRole("tab", { name: /Check what I have/ }).click();
  const html =
    "Andrew Butler and Petra Butler <em>The New Zealand Bill of Rights Act: A Commentary</em> (2nd ed, LexisNexis, Wellington, 2015)";
  await page.locator("textarea").focus();
  await page.evaluate((html) => {
    const dt = new DataTransfer();
    dt.setData("text/html", html);
    dt.setData("text/plain", html.replace(/<[^>]+>/g, ""));
    document
      .querySelector("textarea")!
      .dispatchEvent(
        new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }),
      );
  }, html);
  await expect(page.locator(".suggestion-top strong")).toContainText(/Text|book/i);
  await page.locator("textarea").press("Enter");
  await expect(page.locator("#input-author")).toHaveValue("Andrew Butler and Petra Butler");
  await expect(page.locator("#input-title")).toHaveValue(
    "The New Zealand Bill of Rights Act: A Commentary",
  );
});

test("the single box switches to link-lookup mode for a URL", async ({ page }) => {
  const box = page.locator("textarea");
  // Plain text shows the detection action…
  await box.fill("Evidence Act 2006, s 8");
  await expect(page.locator(".paste-actions")).toContainText(/Detected live|Use /i);
  // …and a link switches the primary action to "Look up link".
  await box.fill("https://doi.org/10.1000/xyz123");
  await expect(page.getByRole("button", { name: /Look up link/i })).toBeVisible();
  await expect(page.locator(".paste-actions")).toContainText(/Looks like a link/i);
});

test("a pasted list of references is worked through, not silently truncated", async ({ page }) => {
  await page.goto("/");
  await page.locator("textarea").fill(
    "1. Attorney-General v X [2007] NZCA 388 at [70].\n2. Evidence Act 2006, s 44.\n3. Peter Watts “Birks’ Unjust Enrichment” (2005) 121 LQR 163 at 165.",
  );
  await expect(page.locator(".reference-item")).toHaveCount(3);

  // The first reference is the one in hand, and its own type is detected.
  await page.getByRole("button", { name: /^Use Neutral-citation/ }).click();
  await expect(page.locator("#citation-form")).toBeVisible();
  await expect(page.locator(".citation-preview p")).toHaveText(
    "Attorney-General v X [2007] NZCA 388 at [70].",
  );

  // Adding it moves on to the second, which is a statute rather than a case.
  await page.getByRole("button", { name: /Add this authority/ }).click();
  await expect(page.locator(".reference-done")).toHaveCount(1);
  await expect(page.getByRole("button", { name: /^Use New Zealand statute/ })).toBeVisible();
});
