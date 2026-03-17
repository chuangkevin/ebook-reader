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

const PREFIX = '__test02_'
// test.epub 放在 spike 目錄下，Node 可直接讀取
const TEST_EPUB_PATH = 'D:/Projects/ebook-reader/spike/test.epub'

test.describe('書庫', () => {
  let testUser: TestUser
  let testBook: TestBook

  test.beforeAll(async () => {
    await assertBackendReady()
    await cleanupUsersWithPrefix(PREFIX)
  })

  test.beforeEach(async () => {
    testUser = await createUser(`${PREFIX}Reader`)
    testBook = await uploadBook(TEST_EPUB_PATH, testUser.id)
  })

  test.afterEach(async () => {
    // 先刪書（避免外鍵殘留），再刪使用者
    await deleteBook(testBook.id)
    await deleteUser(testUser.id)
    await cleanupUsersWithPrefix(PREFIX)
  })

  /**
   * 共用導航：前往首頁 → 點選測試使用者 → 進入書庫
   */
  async function navigateToLibrary(page: any) {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.getByText(testUser.name).click()
    await page.waitForURL('/library')
    await page.waitForLoadState('networkidle')
  }

  test('顯示書庫書籍列表', async ({ page }) => {
    await navigateToLibrary(page)
    await expect(page.getByText(testBook.title)).toBeVisible()
    await page.screenshot({ path: 'test-results/02-library.png' })
  })

  test('書庫顯示上傳按鈕', async ({ page }) => {
    await navigateToLibrary(page)
    // Toolbar 上有 UploadFileIcon 旁的「上傳書籍」文字（桌面寬度）
    const uploadBtn = page
      .locator('svg[data-testid="UploadFileIcon"]')
      .locator('..')
    await expect(uploadBtn).toBeVisible()
    await page.screenshot({ path: 'test-results/02-upload-btn.png' })
  })

  test('點擊書籍導向閱讀器', async ({ page }) => {
    await navigateToLibrary(page)
    await page.getByText(testBook.title).click()
    await expect(page).toHaveURL(`/reader/${testBook.id}`)
    await page.screenshot({ path: 'test-results/02-enter-reader.png' })
  })

  test('可以刪除書籍', async ({ page }) => {
    await navigateToLibrary(page)

    // 書卡右上角的 DeleteIcon 按鈕
    const bookCard = page.locator('.MuiCard-root').filter({ hasText: testBook.title })
    const deleteBtn = bookCard.locator('svg[data-testid="DeleteIcon"]').locator('..')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // 書籍應從列表消失
    await expect(page.getByText(testBook.title)).not.toBeVisible()
    await page.screenshot({ path: 'test-results/02-delete-book.png' })

    // 後端已刪除，afterEach 刪除時 404 視為成功，不用擔心
  })

  test('書庫工具列顯示使用者名稱', async ({ page }) => {
    await navigateToLibrary(page)

    // AppBar 右側顯示當前使用者名稱
    await expect(page.getByText(testUser.name)).toBeVisible()
    // 也應有書庫標題
    await expect(page.getByText('書庫')).toBeVisible()
    await page.screenshot({ path: 'test-results/02-library-header.png' })
  })
})
