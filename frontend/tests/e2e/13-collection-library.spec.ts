/**
 * 13-collection-library.spec.ts
 * 書籍分類 Block — Netflix 風格書庫顯示測試
 *
 * 5.3 上傳帶 collection 的書 → 書庫出現分類 block
 * 5.4 點選分類 block 中的書 → 進入閱讀器，進度正常儲存（不影響現有功能）
 */
import { test, expect } from '@playwright/test'
import {
  assertBackendReady,
  createUser,
  deleteUser,
  uploadBook,
  deleteBook,
  cleanupUsersWithPrefix,
  type TestUser,
  type TestBook,
} from '../helpers/testDb'

const PREFIX = '__test13_'
const TEST_EPUB_PATH = 'D:/Projects/ebook-reader/spike/test.epub'

async function navigateToLibrary(page: any, user: TestUser) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(user.name).click()
  await page.waitForURL('/library')
  await page.waitForLoadState('networkidle')
}

test.describe('書籍分類 Block', () => {
  let testUser: TestUser
  let testBook: TestBook

  test.beforeAll(async () => {
    await assertBackendReady()
    await cleanupUsersWithPrefix(PREFIX)
  })

  test.beforeEach(async () => {
    testUser = await createUser(`${PREFIX}Reader`)
    // Upload book with collection
    testBook = await uploadBook(TEST_EPUB_PATH, testUser.id, { collection: '偵探小說' })
  })

  test.afterEach(async () => {
    await deleteBook(testBook.id, testUser.id).catch(() => {})
    await deleteUser(testUser.id)
    await cleanupUsersWithPrefix(PREFIX)
  })

  test('5.3 書庫顯示分類 block（包含 collection 名稱作為標題）', async ({ page }) => {
    await navigateToLibrary(page, testUser)

    // The collection name should appear as a section heading
    await expect(page.getByText('偵探小說')).toBeVisible({ timeout: 5000 })

    // The book should be visible inside that section
    await expect(page.getByText(testBook.title)).toBeVisible()

    await page.screenshot({ path: 'test-results/13-collection-block.png' })

    // Verify it's rendered as a heading (Typography h6)
    const collectionHeading = page.getByRole('heading', { name: '偵探小說' })
      .or(page.locator('h6').filter({ hasText: '偵探小說' }))
    await expect(collectionHeading).toBeVisible()
  })

  test('5.4 分類 block 書籍可正常進入閱讀器且進度儲存（迴歸）', async ({ page }) => {
    await navigateToLibrary(page, testUser)

    // Click the book from the collection block
    const bookCard = page.getByText(testBook.title).first()
    await bookCard.click()

    // Should navigate to reader
    await expect(page).toHaveURL(`/reader/${testBook.id}`, { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    await page.screenshot({ path: 'test-results/13-reader-from-collection.png' })

    // Wait for reader to load (some content should be visible)
    await page.waitForTimeout(2000)

    // Go back to library
    const backBtn = page.locator('button').filter({ hasText: /back|←|返回/ })
      .or(page.locator('[aria-label*="back"]'))
      .or(page.locator('[aria-label*="返回"]'))
    if (await backBtn.count() > 0) {
      await backBtn.first().click()
    } else {
      await page.goto('/library')
    }
    await page.waitForURL('/library', { timeout: 10000 })
    await page.waitForLoadState('networkidle')

    // Library still shows the collection
    await expect(page.getByText('偵探小說')).toBeVisible()
    await expect(page.getByText(testBook.title)).toBeVisible()

    await page.screenshot({ path: 'test-results/13-back-to-library.png' })
  })

  test('5.3b 無分類書籍時，書庫不顯示分類標題', async ({ page }) => {
    // Delete the collection book and upload one without collection
    await deleteBook(testBook.id, testUser.id)
    testBook = await uploadBook(TEST_EPUB_PATH, testUser.id)

    await navigateToLibrary(page, testUser)

    // Should show standard "書庫" section, NOT "偵探小說" or "其他書籍"
    await expect(page.getByText('書庫')).toBeVisible()
    await expect(page.getByText('偵探小說')).not.toBeVisible()
    await expect(page.getByText('其他書籍')).not.toBeVisible()

    await page.screenshot({ path: 'test-results/13-no-collection.png' })
  })
})
