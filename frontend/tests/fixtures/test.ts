import { test as base, expect } from '@playwright/test';
import { ReaderTestHelper } from '../helpers/ReaderTestHelper';

/**
 * Custom Playwright fixtures for ebook-reader testing
 * Flow: Home → Create User → Library → Upload EPUB → Reader
 */

const TEST_EPUB_PATH = 'D:\\GitClone\\ebook-reader\\ebook\\哈利波特一_神秘的魔法石.epub';

export type TestFixtures = {
  readerHelper: ReaderTestHelper;
};

export const test = base.extend<TestFixtures>({
  readerHelper: async ({ page }, use) => {
    const helper = new ReaderTestHelper(page);

    // 1. Go to home page (User Selection Screen)
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 2. Create a test user - click the "Add" card
    await page.locator('text=Add').click();

    // 3. Fill in user name in the dialog
    const nameInput = page.locator('input').first();
    await nameInput.fill('Test User');

    // 4. Click "Create" button
    await page.locator('button:has-text("Create")').click();

    // 5. Wait for user to appear and click on it to go to library
    await page.waitForTimeout(500);
    await page.locator('text=Test User').click();

    // 6. Should now be on /library - wait for it
    await page.waitForURL('**/library', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // 7. Upload EPUB - the library has a hidden input[type="file"] and a FAB button
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_EPUB_PATH);

    // 8. Wait for upload to complete - book card should appear
    await page.waitForSelector('[class*="Card"], [class*="card"]', {
      timeout: 60000,
    });
    await page.waitForTimeout(2000);

    // 9. Click on the book to enter the reader
    const bookCard = page.locator('[class*="CardActionArea"], [class*="card"]').first();
    await bookCard.click();

    // 10. Wait for reader to load
    await page.waitForURL('**/read/**', { timeout: 15000 });
    await page.waitForTimeout(3000);

    await use(helper);

    await page.close();
  },
});

export { expect };
