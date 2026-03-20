import { test, expect } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/**
 * 全螢幕模式測試
 * - 點擊全螢幕按鈕後工具列和進度條完全消失
 * - 閱讀區域佔滿整個畫面
 * - 全螢幕中翻頁不會退出全螢幕
 * - 點擊退出按鈕能恢復工具列和進度條
 */

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__fullscreen_${Date.now()}`)
  testBook = await uploadBook(TEST_EPUB, testUser.id)
})

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id, testUser?.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
})

async function openReader(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByText(testBook.title).click()
  await page.waitForURL(`/reader/${testBook.id}`)
  await page.waitForSelector('foliate-paginator', { timeout: 15000 })
  await page.waitForTimeout(2000)
}

test.describe('全螢幕模式', () => {
  test('點擊全螢幕按鈕隱藏工具列和進度條，閱讀區變大', async ({ page }) => {
    await openReader(page)

    const viewportHeight = page.viewportSize()!.height

    // === Before fullscreen ===
    const toolbar = page.locator('header')
    await expect(toolbar).toBeVisible()
    const toolbarBoxBefore = await toolbar.boundingBox()
    expect(toolbarBoxBefore!.height).toBeGreaterThan(30)

    // Slider should be visible
    const sliderContainer = page.locator('.MuiSlider-root')
    await expect(sliderContainer).toBeVisible()

    // Reader area height before fullscreen
    const readerArea = page.locator('foliate-paginator')
    const readerBefore = await readerArea.boundingBox()

    await page.screenshot({ path: 'test-results/10-fullscreen-before.png' })

    // === Enter fullscreen ===
    const fsBtn = page.locator('svg[data-testid="FullscreenIcon"]').locator('..')
    await expect(fsBtn).toBeVisible()
    await fsBtn.click()
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/10-fullscreen-after.png' })

    // Toolbar height should be 0
    const toolbarBoxAfter = await toolbar.boundingBox()
    expect(toolbarBoxAfter!.height).toBe(0)

    // Slider should be gone
    await expect(sliderContainer).not.toBeVisible()

    // Reader area should be taller
    const readerAfter = await readerArea.boundingBox()
    expect(readerAfter!.height).toBeGreaterThan(readerBefore!.height + 20)

    // Exit button should be visible
    const exitBtn = page.locator('svg[data-testid="FullscreenExitIcon"]').locator('..')
    await expect(exitBtn).toBeVisible()
  })

  test('全螢幕中翻頁不會退出全螢幕', async ({ page }) => {
    await openReader(page)

    // Enter fullscreen
    const fsBtn = page.locator('svg[data-testid="FullscreenIcon"]').locator('..')
    await fsBtn.click()
    await page.waitForTimeout(500)

    // Verify in fullscreen
    const toolbar = page.locator('header')
    expect((await toolbar.boundingBox())!.height).toBe(0)

    // Flip page by clicking right side
    const readerArea = page.locator('foliate-paginator')
    const box = await readerArea.boundingBox()
    await page.mouse.click(box!.x + box!.width - 20, box!.y + box!.height / 2)
    await page.waitForTimeout(1500)

    // Should still be fullscreen
    expect((await toolbar.boundingBox())!.height).toBe(0)
    await expect(page.locator('.MuiSlider-root')).not.toBeVisible()

    await page.screenshot({ path: 'test-results/10-fullscreen-after-flip.png' })
  })

  test('退出全螢幕恢復工具列和進度條', async ({ page }) => {
    await openReader(page)

    // Enter fullscreen
    const fsBtn = page.locator('svg[data-testid="FullscreenIcon"]').locator('..')
    await fsBtn.click()
    await page.waitForTimeout(500)

    // Exit fullscreen
    const exitBtn = page.locator('svg[data-testid="FullscreenExitIcon"]').locator('..')
    await exitBtn.click()
    await page.waitForTimeout(500)

    // Toolbar should be visible again
    const toolbar = page.locator('header')
    const toolbarBox = await toolbar.boundingBox()
    expect(toolbarBox!.height).toBeGreaterThan(30)

    // Slider should be visible again
    await expect(page.locator('.MuiSlider-root')).toBeVisible()

    await page.screenshot({ path: 'test-results/10-fullscreen-restored.png' })
  })
})
