import { defineConfig } from "@playwright/test";

/**
 * End-to-end interface tests. These are intentionally NOT part of `npm run
 * verify` (the release gate that the Pages deploy runs), because they need a
 * browser. Run them locally with:
 *
 *   npx playwright install chromium   # once
 *   npm run test:e2e
 *
 * In sandboxes that ship a browser, point at it with PW_EXECUTABLE_PATH.
 */
const executablePath = process.env.PW_EXECUTABLE_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  webServer: {
    command: "npm run build && npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    launchOptions: executablePath ? { executablePath } : {},
  },
});
