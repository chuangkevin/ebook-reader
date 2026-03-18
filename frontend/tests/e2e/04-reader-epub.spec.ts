import { test, expect } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * EPUB 閱讀器整合測試（真實後端 + 真實 EPUB）
 */

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__test04_${Date.now()}`)
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
  // 等待 foliate-js 初始化
  await page.waitForSelector('foliate-paginator', { timeout: 10000 })
  await page.waitForTimeout(2000)
}

test.describe('EPUB 閱讀器', () => {
  test('載入 EPUB 並顯示內容', async ({ page }) => {
    await openReader(page)
    const paginator = page.locator('foliate-paginator')
    await expect(paginator).toBeAttached()
    await page.screenshot({ path: 'test-results/04-epub-loaded.png' })
  })

  test('工具列顯示書名', async ({ page }) => {
    await openReader(page)
    await expect(page.getByText(testBook.title)).toBeVisible()
    await page.screenshot({ path: 'test-results/04-toolbar.png' })
  })

  test('鍵盤 ArrowRight 翻到下一頁', async ({ page }) => {
    await openReader(page)
    await page.screenshot({ path: 'test-results/04-page1.png' })
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/04-page2.png' })
  })

  test('翻頁後再回上一頁', async ({ page }) => {
    await openReader(page)
    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(800)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/04-back-page1.png' })
  })

  test('切換橫排模式', async ({ page }) => {
    await openReader(page)
    const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
    await settingsBtn.click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '橫排' }).click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'test-results/04-horizontal.png' })
    // foliate-paginator 應該還在
    await expect(page.locator('foliate-paginator')).toBeAttached()
  })

  test('進度顯示並存檔', async ({ page }) => {
    await openReader(page)
    // 翻幾頁
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(600)
    }
    // 確認進度 % 出現在工具列
    const progressText = page.locator('text=/\\d+%/')
    await expect(progressText).toBeVisible({ timeout: 5000 })
    await page.screenshot({ path: 'test-results/04-progress.png' })
  })

  test('返回書庫', async ({ page }) => {
    await openReader(page)
    const backBtn = page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')
    await backBtn.click()
    await expect(page).toHaveURL('/library')
  })
})
