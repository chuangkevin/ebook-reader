import { test, expect } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 閱讀器 UI 整合測試（真實後端 + 真實 EPUB，無 mock）
 */

const TEST_EPUB = path.resolve(__dirname, '../../../spike/test.epub')

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__test03_${Date.now()}`)
  testBook = await uploadBook(TEST_EPUB, testUser.id)
})

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
})

async function openReader(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByText(testBook.title).click()
  await page.waitForURL(`/reader/${testBook.id}`)
  await page.waitForSelector('foliate-paginator', { timeout: 10000 })
  await page.waitForTimeout(2000)
}

test.describe('閱讀器工具列', () => {
  test('顯示書名與返回按鈕', async ({ page }) => {
    await openReader(page)
    await expect(page.getByText(testBook.title)).toBeVisible()
    await expect(page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-reader-toolbar.png' })
  })

  test('返回按鈕導向書庫', async ({ page }) => {
    await openReader(page)
    await page.locator('svg[data-testid="ArrowBackIcon"]').locator('..').click()
    await expect(page).toHaveURL('/library')
  })

  test('顯示設定與目錄圖示按鈕', async ({ page }) => {
    await openReader(page)
    await expect(page.locator('svg[data-testid="SettingsIcon"]').locator('..')).toBeVisible()
    await expect(page.locator('svg[data-testid="MenuBookIcon"]').locator('..')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-reader-icons.png' })
  })

  test('進度百分比顯示在工具列', async ({ page }) => {
    await openReader(page)
    await expect(page.locator('text=/\\d+%/')).toBeVisible()
  })
})

test.describe('閱讀設定抽屜', () => {
  test('點擊設定按鈕開啟抽屜', async ({ page }) => {
    await openReader(page)
    await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('排版模式')).toBeVisible()
    await expect(page.getByText('字體大小')).toBeVisible()
    await expect(page.getByText('主題')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-settings-drawer.png' })
  })

  test('可以切換直排/橫排模式', async ({ page }) => {
    await openReader(page)
    await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await page.getByText('橫排').click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    // 等待模式切換完成
    await page.waitForTimeout(2000)
    await expect(page.locator('foliate-paginator')).toBeAttached()
    await page.screenshot({ path: 'test-results/03-horiz-mode.png' })
    // 再切回直排
    await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await page.getByText('直排').click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(2000)
    await expect(page.locator('foliate-paginator')).toBeAttached()
    await page.screenshot({ path: 'test-results/03-vert-mode.png' })
  })
})

test.describe('目錄抽屜', () => {
  test('點擊目錄按鈕開啟抽屜', async ({ page }) => {
    await openReader(page)
    await page.locator('svg[data-testid="MenuBookIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('presentation')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-toc-drawer.png' })
  })

  test('可以按 Escape 關閉目錄抽屜', async ({ page }) => {
    await openReader(page)
    await page.locator('svg[data-testid="MenuBookIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    await expect(page.locator('foliate-paginator')).toBeAttached()
  })
})
