import { test as base, expect } from '@playwright/test';
import { ReaderTestHelper } from '../helpers/ReaderTestHelper';

/**
 * Custom Playwright fixtures for ebook-reader testing
 * Provides pre-configured test helpers and authentication
 */

export type TestFixtures = {
  readerHelper: ReaderTestHelper;
};

export const test = base.extend<TestFixtures>({
  readerHelper: async ({ page }, use) => {
    const helper = new ReaderTestHelper(page);

    // Setup
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Use the fixture
    await use(helper);

    // Cleanup
    await page.close();
  },
});

export { expect };
