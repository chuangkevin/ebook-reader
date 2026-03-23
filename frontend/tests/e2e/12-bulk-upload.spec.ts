/**
 * 12-bulk-upload.spec.ts
 * 批次上傳書籍 — UploadDialog 功能測試
 *
 * 5.1 上傳書籍 → Dialog 出現進度條、完成後顯示 ✓
 * 5.2 上傳重複書名 → 顯示「跳過」，不中斷其他上傳
 */
import { test, expect } from '@playwright/test'
import fs from 'fs'
import {
  assertBackendReady,
  createUser,
  deleteUser,
  uploadBook,
  deleteBook,
  cleanupUsersWithPrefix,
  listBooks,
  type TestUser,
} from '../helpers/testDb'

const PREFIX = '__test12_'
const TEST_EPUB_PATH = 'D:/Projects/ebook-reader/spike/test.epub'

async function navigateToLibrary(page: any, user: TestUser) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(user.name).click()
  await page.waitForURL('/library')
  await page.waitForLoadState('networkidle')
}

test.describe('批次上傳書籍', () => {
  let testUser: TestUser

  test.beforeAll(async () => {
    await assertBackendReady()
    await cleanupUsersWithPrefix(PREFIX)
  })

  test.beforeEach(async () => {
    testUser = await createUser(`${PREFIX}Uploader`)
  })

  test.afterEach(async () => {
    // Clean up any books uploaded by test user
    const books = await listBooks()
    for (const b of books) {
      if (b.uploadedBy === testUser.id) {
        await deleteBook(b.id, testUser.id).catch(() => {})
      }
    }
    await deleteUser(testUser.id)
    await cleanupUsersWithPrefix(PREFIX)
  })

  test('5.1 上傳書籍：Dialog 出現、進度條顯示、完成後顯示勾選', async ({ page }) => {
    await navigateToLibrary(page, testUser)

    // Open SpeedDial and click "選擇檔案"
    const speedDial = page.locator('[aria-label="上傳書籍"]')
    await speedDial.click()
    await page.screenshot({ path: 'test-results/12-speeddial-open.png' })

    // Find the file input and set files directly (bypasses file picker)
    const fileInput = page.locator('input[type="file"][multiple]')
    const buffer = fs.readFileSync(TEST_EPUB_PATH)
    await fileInput.setInputFiles([{ name: 'test.epub', mimeType: 'application/epub+zip', buffer }])

    // Dialog should appear
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('上傳書籍')).toBeVisible()

    await page.screenshot({ path: 'test-results/12-upload-dialog.png' })

    // Wait for the item to appear in dialog
    await expect(page.locator('[role="dialog"]').getByText('test.epub')).toBeVisible({ timeout: 5000 })

    // Wait for upload to complete (CheckCircleIcon appears or "完成" summary)
    await expect(page.locator('svg[data-testid="CheckCircleIcon"]')).toBeVisible({ timeout: 30000 })

    await page.screenshot({ path: 'test-results/12-upload-done.png' })

    // Summary should be visible
    await expect(page.getByText(/完成.*本/)).toBeVisible()

    // Close dialog
    await page.getByRole('button', { name: '關閉' }).click()
    await expect(page.getByRole('dialog')).not.toBeVisible()
  })

  test('5.2 上傳重複書名：重複項顯示「跳過」，不中斷上傳', async ({ page }) => {
    // Pre-upload book so it already exists
    const existing = await uploadBook(TEST_EPUB_PATH, testUser.id)

    await navigateToLibrary(page, testUser)

    // Open SpeedDial and select file
    const speedDial = page.locator('[aria-label="上傳書籍"]')
    await speedDial.click()

    const fileInput = page.locator('input[type="file"][multiple]')
    const buffer = fs.readFileSync(TEST_EPUB_PATH)
    await fileInput.setInputFiles([{ name: 'test.epub', mimeType: 'application/epub+zip', buffer }])

    // Dialog appears
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 })

    // Wait for duplicate warning icon
    await expect(page.locator('svg[data-testid="WarningAmberIcon"]')).toBeVisible({ timeout: 30000 })

    // "已存在，跳過" text should appear
    await expect(page.getByText('已存在，跳過')).toBeVisible()

    await page.screenshot({ path: 'test-results/12-duplicate-skip.png' })

    // Summary should show 0 done, 1 skipped
    await expect(page.getByText(/跳過.*1.*本|1.*跳過/)).toBeVisible()

    // Close
    await page.getByRole('button', { name: '關閉' }).click()

    // Cleanup pre-uploaded book
    await deleteBook(existing.id, testUser.id).catch(() => {})
  })
})
