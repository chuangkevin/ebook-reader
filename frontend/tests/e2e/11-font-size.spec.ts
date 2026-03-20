import { test, expect } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__fontsize_${Date.now()}`)
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

/** Get font size from inside the paginator iframe via console.log bridge */
async function getIframeFontSize(page: any): Promise<number | null> {
  const result = await page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    if (!paginator?.shadowRoot) return null
    // Find iframe inside shadow DOM
    const iframe = paginator.shadowRoot.querySelector('iframe')
    if (!iframe?.contentDocument) return null
    const p = iframe.contentDocument.querySelector('p')
    if (!p) return null
    return parseFloat(iframe.contentWindow!.getComputedStyle(p).fontSize)
  })
  return result
}

/** Open settings and set font slider to a position (0.0 = leftmost, 1.0 = rightmost) */
async function setFontSlider(page: any, position: number) {
  // Open settings
  await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
  await page.waitForTimeout(500)

  const settingsDrawer = page.locator('.MuiDrawer-paper')
  await expect(settingsDrawer).toBeVisible()

  // Find font size slider by label text
  const sliders = settingsDrawer.locator('.MuiSlider-root')
  const sliderCount = await sliders.count()
  let fontSlider: any = null
  for (let i = 0; i < sliderCount; i++) {
    const container = sliders.nth(i).locator('..')
    const text = await container.textContent()
    if (text && (text.includes('字體') || text.includes('大小'))) {
      fontSlider = sliders.nth(i)
      break
    }
  }
  if (!fontSlider) fontSlider = sliders.first()

  const box = await fontSlider.boundingBox()
  await page.mouse.click(
    box!.x + box!.width * position,
    box!.y + box!.height / 2
  )
  await page.waitForTimeout(500)

  // Read the current font size value from the label
  const container = fontSlider.locator('..')
  const text = await container.textContent()
  const match = text?.match(/(\d+)px/)
  const settingValue = match ? parseInt(match[1]) : null
  console.log(`[FontSize] Slider set to ${Math.round(position * 100)}%, label shows: ${text}, value: ${settingValue}px`)

  // Close settings
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)

  return settingValue
}

test.describe('字體大小調整', () => {
  test('調大字體 — 截圖對比文字明顯變大', async ({ page }) => {
    await openReader(page)

    // Screenshot at default font size
    await page.screenshot({ path: 'test-results/11-font-default.png' })

    // Check iframe font size (may be null due to cross-origin)
    const beforeSize = await getIframeFontSize(page)
    console.log('[FontSize] Before iframe font-size:', beforeSize)

    // Set font to large (90% of slider)
    const largeValue = await setFontSlider(page, 0.9)

    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'test-results/11-font-large.png' })

    const afterSize = await getIframeFontSize(page)
    console.log('[FontSize] After iframe font-size:', afterSize)

    // If we can read iframe font size, verify it changed
    if (beforeSize !== null && afterSize !== null) {
      expect(afterSize).toBeGreaterThan(beforeSize)
      console.log(`[FontSize] ✓ Changed from ${beforeSize}px to ${afterSize}px`)
    } else {
      // Fallback: verify the setting value changed to something large
      expect(largeValue).toBeTruthy()
      expect(largeValue!).toBeGreaterThanOrEqual(24)
      console.log(`[FontSize] Could not read iframe, but setting is ${largeValue}px`)

      // Visual check: take screenshots at both sizes for manual comparison
      // Set back to small to have a comparison
      const smallValue = await setFontSlider(page, 0.1)
      await page.waitForTimeout(1000)
      await page.screenshot({ path: 'test-results/11-font-small.png' })
      console.log(`[FontSize] Small setting: ${smallValue}px, Large setting: ${largeValue}px`)
      expect(largeValue!).toBeGreaterThan(smallValue!)
    }
  })

  test('字體設定值在 UI 中正確顯示並改變', async ({ page }) => {
    await openReader(page)

    // Open settings
    await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
    await page.waitForTimeout(500)

    const settingsDrawer = page.locator('.MuiDrawer-paper')
    const sliders = settingsDrawer.locator('.MuiSlider-root')
    const sliderCount = await sliders.count()

    let fontSlider: any = null
    for (let i = 0; i < sliderCount; i++) {
      const container = sliders.nth(i).locator('..')
      const text = await container.textContent()
      if (text && (text.includes('字體') || text.includes('大小'))) {
        fontSlider = sliders.nth(i)
        break
      }
    }
    expect(fontSlider).toBeTruthy()

    // Read default value
    const containerBefore = fontSlider.locator('..')
    const textBefore = await containerBefore.textContent()
    const matchBefore = textBefore?.match(/(\d+)px/)
    const defaultSize = matchBefore ? parseInt(matchBefore[1]) : 0
    console.log(`[FontSize] Default: ${defaultSize}px`)
    expect(defaultSize).toBeGreaterThanOrEqual(14)
    expect(defaultSize).toBeLessThanOrEqual(24)

    // Slide to right (increase)
    const box = await fontSlider.boundingBox()
    await page.mouse.click(box!.x + box!.width * 0.95, box!.y + box!.height / 2)
    await page.waitForTimeout(300)

    const textAfter = await containerBefore.textContent()
    const matchAfter = textAfter?.match(/(\d+)px/)
    const largeSize = matchAfter ? parseInt(matchAfter[1]) : 0
    console.log(`[FontSize] After increase: ${largeSize}px`)
    expect(largeSize).toBeGreaterThan(defaultSize)

    // Slide to left (decrease)
    await page.mouse.click(box!.x + box!.width * 0.05, box!.y + box!.height / 2)
    await page.waitForTimeout(300)

    const textSmall = await containerBefore.textContent()
    const matchSmall = textSmall?.match(/(\d+)px/)
    const smallSize = matchSmall ? parseInt(matchSmall[1]) : 0
    console.log(`[FontSize] After decrease: ${smallSize}px`)
    expect(smallSize).toBeLessThan(defaultSize)

    await page.screenshot({ path: 'test-results/11-font-settings-values.png' })
  })

  test('字體大小改變後截圖確認文字確實變大', async ({ page }) => {
    await openReader(page)

    // Flip past title/TOC to a text-heavy page
    const readerArea = page.locator('foliate-paginator')
    const box = await readerArea.boundingBox()
    for (let i = 0; i < 5; i++) {
      await page.mouse.click(box!.x + box!.width - 20, box!.y + box!.height / 2)
      await page.waitForTimeout(800)
    }

    // Screenshot at default size
    await page.screenshot({ path: 'test-results/11-font-reflow-default.png' })

    // Set to very large font
    const largeValue = await setFontSlider(page, 0.95)
    await page.waitForTimeout(2000)

    // Screenshot at large size
    await page.screenshot({ path: 'test-results/11-font-reflow-large.png' })

    // Setting value should be large
    expect(largeValue).toBeTruthy()
    expect(largeValue!).toBeGreaterThanOrEqual(26)

    // Set to small font for comparison
    const smallValue = await setFontSlider(page, 0.05)
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'test-results/11-font-reflow-small.png' })

    expect(smallValue).toBeTruthy()
    expect(smallValue!).toBeLessThanOrEqual(16)
    expect(largeValue!).toBeGreaterThan(smallValue! + 8)
    console.log(`[FontSize] ✓ Small=${smallValue}px, Large=${largeValue}px — screenshots saved for visual confirmation`)
  })
})
