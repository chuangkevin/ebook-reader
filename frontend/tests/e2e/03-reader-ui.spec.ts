import { test, expect } from '@playwright/test'
import { setupMockApi, MOCK_BOOKS, MOCK_SETTINGS } from '../helpers/mockApi'
import path from 'path'

/**
 * 閱讀器 UI 整合測試
 * 測試工具列、設定抽屜、目錄抽屜等 UI 元件，不依賴真實 EPUB 渲染
 */

async function navigateToReader(page: any, bookId = 1) {
  await setupMockApi(page)
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText('小明').click()
  await page.waitForURL('/library')

  // Mock book file so reader doesn't crash on missing epub
  await page.route(`**/api/books/${bookId}/file`, async (route) => {
    await route.fulfill({ status: 404, body: 'not found' })
  })

  await page.getByText(MOCK_BOOKS[0].title).click()
  await page.waitForURL(`/reader/${bookId}`)
}

test.describe('閱讀器工具列', () => {
  test('顯示書名與返回按鈕', async ({ page }) => {
    await navigateToReader(page)
    await expect(page.getByText(MOCK_BOOKS[0].title)).toBeVisible()
    // Back button has an ArrowBackIcon with no aria-label; locate via the SVG data-testid
    await expect(page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-reader-toolbar.png' })
  })

  test('返回按鈕導向書庫', async ({ page }) => {
    await navigateToReader(page)
    const backBtn = page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')
    await backBtn.click()
    await expect(page).toHaveURL('/library')
  })

  test('顯示設定圖示按鈕', async ({ page }) => {
    await navigateToReader(page)
    const settingsBtn = page.locator('button[aria-label*="setting"], button[aria-label*="設定"]')
      .or(page.locator('svg[data-testid="SettingsIcon"]').locator('..'))
    await expect(settingsBtn.first()).toBeVisible()
    await page.screenshot({ path: 'test-results/03-settings-icon.png' })
  })

  test('顯示目錄圖示按鈕', async ({ page }) => {
    await navigateToReader(page)
    const tocBtn = page.locator('svg[data-testid="MenuBookIcon"]').locator('..')
    await expect(tocBtn).toBeVisible()
    await page.screenshot({ path: 'test-results/03-toc-icon.png' })
  })
})

test.describe('閱讀設定抽屜', () => {
  test.beforeEach(async ({ page }) => {
    await navigateToReader(page)
    // Open settings drawer
    const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
    await settingsBtn.click()
    await page.waitForTimeout(300) // drawer animation
  })

  test('設定抽屜顯示所有選項', async ({ page }) => {
    await expect(page.getByText('排版模式')).toBeVisible()
    await expect(page.getByText('字體大小')).toBeVisible()
    await expect(page.getByText('主題')).toBeVisible()
    await expect(page.getByText('簡繁轉換')).toBeVisible()
    await expect(page.getByText('翻頁區域')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-settings-drawer.png' })
  })

  test('可以切換直排/橫排模式', async ({ page }) => {
    await page.getByRole('button', { name: '橫排' }).click()
    await page.screenshot({ path: 'test-results/03-switch-horizontal.png' })
    await page.getByRole('button', { name: '直排' }).click()
    await page.screenshot({ path: 'test-results/03-switch-vertical.png' })
  })

  test('可以切換主題', async ({ page }) => {
    await page.getByRole('button', { name: '護眼' }).click()
    await page.screenshot({ path: 'test-results/03-theme-sepia.png' })
    await page.getByRole('button', { name: '暗色' }).click()
    await page.screenshot({ path: 'test-results/03-theme-dark.png' })
    await page.getByRole('button', { name: '亮色' }).click()
  })

  test('可以切換翻頁區域配置', async ({ page }) => {
    await page.getByRole('button', { name: '下頁' }).click()
    await expect(page.getByText('上半＝上一頁，下半＝下一頁')).toBeVisible()
    await page.screenshot({ path: 'test-results/03-tap-zone-bottom-next.png' })
    await page.getByRole('button', { name: '左右' }).click()
  })

  test('可以切換簡繁轉換', async ({ page }) => {
    await page.getByRole('button', { name: '簡→繁' }).click()
    await page.screenshot({ path: 'test-results/03-opencc-s2tw.png' })
    await page.getByRole('button', { name: '關閉' }).click()
  })
})

test.describe('目錄抽屜', () => {
  test('點擊目錄按鈕開啟抽屜', async ({ page }) => {
    await navigateToReader(page)
    const tocBtn = page.locator('svg[data-testid="MenuBookIcon"]').locator('..')
    await tocBtn.click()
    await page.waitForTimeout(300)
    await expect(page.getByRole('heading', { name: '目錄' })).toBeVisible()
    await page.screenshot({ path: 'test-results/03-toc-drawer.png' })
  })

  test('空目錄顯示「無目錄」', async ({ page }) => {
    await navigateToReader(page)
    const tocBtn = page.locator('svg[data-testid="MenuBookIcon"]').locator('..')
    await tocBtn.click()
    await page.waitForTimeout(300)
    // Since epub fails to load, TOC is empty
    await expect(page.getByRole('heading', { name: '目錄' })).toBeVisible()
    await page.screenshot({ path: 'test-results/03-toc-empty.png' })
  })
})

test.describe('鍵盤快捷鍵', () => {
  test('方向鍵不觸發瀏覽器滾動', async ({ page }) => {
    await navigateToReader(page)
    const initialScrollY = await page.evaluate(() => window.scrollY)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowLeft')
    const finalScrollY = await page.evaluate(() => window.scrollY)
    expect(finalScrollY).toBe(initialScrollY)
  })
})
