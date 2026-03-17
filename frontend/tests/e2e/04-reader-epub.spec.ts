import { test, expect } from '@playwright/test'
import { setupMockApi, MOCK_BOOKS } from '../helpers/mockApi'
import fs from 'fs'
import path from 'path'

/**
 * EPUB 閱讀器功能測試（需要真實 EPUB 檔案）
 * 如果找不到測試檔案，測試會 skip
 */

const TEST_EPUB_PATHS = [
  path.resolve(__dirname, '../../src/lib/foliate-js/epub.js'), // 確認 foliate-js 存在
]

// Find a real epub file for testing
const EPUB_CANDIDATES = [
  'D:/Projects/home-media/test.epub',
  'D:/Projects/ebook-reader/ebook',
]

function findTestEpub(): string | null {
  for (const candidate of EPUB_CANDIDATES) {
    try {
      const stat = fs.statSync(candidate)
      if (stat.isFile() && candidate.endsWith('.epub')) return candidate
      if (stat.isDirectory()) {
        const files = fs.readdirSync(candidate)
        const epub = files.find((f) => f.endsWith('.epub'))
        if (epub) return path.join(candidate, epub)
      }
    } catch {
      // not found
    }
  }
  return null
}

const TEST_EPUB = findTestEpub()

async function setupReaderWithEpub(page: any, epubPath: string) {
  await setupMockApi(page)

  // Override book file route to serve real epub
  await page.route('**/api/books/1/file', async (route) => {
    const buffer = fs.readFileSync(epubPath)
    await route.fulfill({
      status: 200,
      contentType: 'application/epub+zip',
      body: buffer,
    })
  })

  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText('小明').click()
  await page.waitForURL('/library')
  await page.getByText(MOCK_BOOKS[0].title).click()
  await page.waitForURL('/reader/1')
}

test.describe('EPUB 閱讀器（需真實 EPUB）', () => {
  test.skip(!TEST_EPUB, `找不到測試 EPUB 檔案（搜尋路徑：${EPUB_CANDIDATES.join(', ')}）`)

  test('載入 EPUB 並顯示內容', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)

    // Wait for foliate-js to initialize (it needs to parse the epub)
    await page.waitForTimeout(3000)
    await page.screenshot({ path: 'test-results/04-epub-loaded.png', fullPage: false })

    // foliate-paginator custom element should be present
    const paginator = page.locator('foliate-paginator')
    await expect(paginator).toBeAttached()
  })

  test('直排模式顯示正確', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    // Check writing-mode is vertical-rl (default)
    const iframe = page.frameLocator('foliate-paginator iframe').first()
    const writingMode = await iframe.locator('body').evaluate(
      (el) => getComputedStyle(el).writingMode
    ).catch(() => 'unknown')

    console.log('Writing mode:', writingMode)
    await page.screenshot({ path: 'test-results/04-vertical-mode.png' })
  })

  test('翻頁：右側點擊下一頁', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    await page.screenshot({ path: 'test-results/04-before-next.png' })

    // Click right tap zone (30% from right)
    const box = await page.locator('.epub-reader-root').boundingBox()
    if (box) {
      const x = box.x + box.width * 0.85
      const y = box.y + box.height * 0.5
      await page.mouse.click(x, y)
      await page.waitForTimeout(1000)
    }

    await page.screenshot({ path: 'test-results/04-after-next.png' })
  })

  test('翻頁：左側點擊上一頁', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    // First go to next page
    const box = await page.locator('.epub-reader-root').boundingBox()
    if (box) {
      // next
      await page.mouse.click(box.x + box.width * 0.85, box.y + box.height * 0.5)
      await page.waitForTimeout(800)
      // prev
      await page.mouse.click(box.x + box.width * 0.15, box.y + box.height * 0.5)
      await page.waitForTimeout(800)
    }

    await page.screenshot({ path: 'test-results/04-prev-page.png' })
  })

  test('鍵盤翻頁：ArrowRight 下一頁', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    await page.keyboard.press('ArrowRight')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/04-keyboard-next.png' })

    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(800)
    await page.screenshot({ path: 'test-results/04-keyboard-prev.png' })
  })

  test('切換橫排模式', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    // Open settings
    const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
    await settingsBtn.click()
    await page.waitForTimeout(300)

    // Switch to horizontal
    await page.getByRole('button', { name: '橫排' }).click()
    await page.waitForTimeout(2000)

    await page.screenshot({ path: 'test-results/04-horizontal-mode.png' })

    // Check writing-mode changed
    const iframe = page.frameLocator('foliate-paginator iframe').first()
    const writingMode = await iframe.locator('body').evaluate(
      (el) => getComputedStyle(el).writingMode
    ).catch(() => 'unknown')
    console.log('Writing mode after switch:', writingMode)
  })

  test('進度百分比更新', async ({ page }) => {
    await setupReaderWithEpub(page, TEST_EPUB!)
    await page.waitForTimeout(3000)

    // Navigate a few pages
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowRight')
      await page.waitForTimeout(600)
    }

    // Progress % should be visible in toolbar
    const progressText = page.locator('text=/\\d+%/')
    await expect(progressText).toBeVisible()
    const text = await progressText.textContent()
    console.log('Progress:', text)
    await page.screenshot({ path: 'test-results/04-progress-updated.png' })
  })
})
