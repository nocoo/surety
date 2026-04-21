import { test as base, expect, type Page } from "@playwright/test";

/**
 * Wait for the page to finish loading API data.
 * Most pages use useEffect + fetch, so we wait for network idle.
 */
async function waitForDataLoad(page: Page) {
  await page.waitForLoadState("networkidle");
}

/**
 * Custom test fixture with common helpers.
 */
export const test = base.extend<{
  /** Navigate to a page and wait for data to load */
  navigateTo: (path: string) => Promise<void>;
}>({
  navigateTo: async ({ page }, use) => {
    const fn = async (path: string) => {
      await page.goto(path);
      await waitForDataLoad(page);
    };
    await use(fn);
  },
});

export { expect };

/**
 * Common selectors and helpers for Surety UI.
 */
export const selectors = {
  /** Get the Sheet (slide-in panel) that is currently open */
  sheet: '[data-slot="sheet-content"]',

  /** Get the AlertDialog (confirmation modal) */
  alertDialog: '[data-slot="alert-dialog-content"]',

  /** Get the Dialog (modal) */
  dialog: '[data-slot="dialog-content"]',

  /** Get a form input by its HTML id */
  inputById: (id: string) => `#${id}`,

  /** Get a table row */
  tableRow: '[data-slot="table-row"]',
} as const;
