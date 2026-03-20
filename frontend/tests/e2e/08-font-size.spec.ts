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
  testUser = await createUser(`__test08_${Date.now()}`)
  testBook = await uploadBook(TEST_EPUB, testUser.id)
})

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id, testUser?.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
})

async function openReaderAndGoToBody(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByText(testBook.title).click()
  await page.waitForURL(`/reader/${testBook.id}`)
  await page.waitForSelector('foliate-paginator', { timeout: 10000 })
  await page.waitForTimeout(2000)

  // Use TOC to navigate to first chapter with body text
  await page.locator('svg[data-testid="MenuBookIcon"]').locator('..').click()
  await page.waitForTimeout(500)
  // Click the first chapter link in TOC (skip cover/copyright)
  const tocItems = page.locator('.MuiDrawer-root .MuiListItemButton-root')
  const count = await tocItems.count()
  // Find a chapter that's likely body text (index 2+ to skip cover/toc)
  const targetIdx = Math.min(2, count - 1)
  await tocItems.nth(targetIdx).click()
  await page.waitForTimeout(2000)

  // Verify we're on body text by checking for <p> elements
  const hasP = await page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    const contents = paginator?.getContents?.() ?? []
    if (contents.length === 0) return false
    const doc = contents[0].doc as Document
    return !!doc?.querySelector('p')
  })
  console.log(`[FontSize] On body text page: ${hasP}`)

  // If still no <p>, navigate forward a few pages
  if (!hasP) {
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('ArrowLeft')
      await page.waitForTimeout(800)
    }
    await page.waitForTimeout(1000)
  }
}

/** Get computed font size of first <p> inside paginator iframe */
async function getIframeFontSize(page: any): Promise<number> {
  return page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    if (!paginator) return -1
    const contents = paginator.getContents?.() ?? []
    if (contents.length === 0) return -2
    const doc = contents[0].doc as Document
    if (!doc) return -3
    const el = doc.querySelector('p') || doc.querySelector('div') || doc.body
    if (!el) return -4
    return parseFloat(getComputedStyle(el).fontSize)
  })
}

/** Get first visible text content for debugging */
async function getVisibleText(page: any): Promise<string> {
  return page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    if (!paginator) return ''
    const contents = paginator.getContents?.() ?? []
    if (contents.length === 0) return ''
    const doc = contents[0].doc as Document
    if (!doc) return ''
    const p = doc.querySelector('p')
    return p?.textContent?.slice(0, 30) ?? '(no p found)'
  })
}

/** Take screenshot of just the reader content area (no toolbar) */
async function screenshotReader(page: any, name: string) {
  const paginator = page.locator('foliate-paginator')
  await paginator.screenshot({ path: `test-results/${name}` })
}

async function setFontSizeViaSlider(page: any, targetPx: number) {
  await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
  await page.waitForTimeout(300)

  // MUI Slider: we need to use evaluate to set the value
  // Find the slider input for font size (the first range input in the drawer)
  const sliderInput = page.locator('.MuiDrawer-root input[type="range"]').first()
  await sliderInput.fill(String(targetPx))
  await page.waitForTimeout(300)

  // Close settings
  await page.keyboard.press('Escape')
  await page.waitForTimeout(1000)
}

test.describe('字體大小調整 — 正文截圖驗證', () => {
  test('字體 18px vs 28px 截圖必須不同', async ({ page }) => {
    await openReaderAndGoToBody(page)

    const text = await getVisibleText(page)
    console.log(`[FontSize] Visible text: ${text}`)

    // Default 18px
    const fs18 = await getIframeFontSize(page)
    console.log(`[FontSize] Default fontSize: ${fs18}px`)
    const screenshot18 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-body-18px.png' })

    // Change to 28px
    await setFontSizeViaSlider(page, 28)
    const fs28 = await getIframeFontSize(page)
    console.log(`[FontSize] After 28px: ${fs28}px`)
    const screenshot28 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-body-28px.png' })

    // Verify computed values changed
    expect(fs28).toBe(28)
    expect(fs18).not.toBe(fs28)

    // Pixel comparison: screenshots MUST be different
    const buf18 = Buffer.from(screenshot18)
    const buf28 = Buffer.from(screenshot28)
    const same = buf18.equals(buf28)
    console.log(`[FontSize] Screenshots identical: ${same}`)
    expect(same, '18px and 28px screenshots should look different').toBe(false)
  })

  test('字體 14px vs 24px 截圖必須不同', async ({ page }) => {
    await openReaderAndGoToBody(page)

    // Set 14px
    await setFontSizeViaSlider(page, 14)
    const fs14 = await getIframeFontSize(page)
    console.log(`[FontSize] 14px computed: ${fs14}px`)
    const screenshot14 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-body-14px.png' })

    // Set 24px
    await setFontSizeViaSlider(page, 24)
    const fs24 = await getIframeFontSize(page)
    console.log(`[FontSize] 24px computed: ${fs24}px`)
    const screenshot24 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-body-24px.png' })

    expect(fs14).toBe(14)
    expect(fs24).toBe(24)

    const same = Buffer.from(screenshot14).equals(Buffer.from(screenshot24))
    console.log(`[FontSize] Screenshots identical: ${same}`)
    expect(same, '14px and 24px screenshots should look different').toBe(false)
  })

  test('直排模式字體大小也應有視覺差異', async ({ page }) => {
    await openReaderAndGoToBody(page)

    // Default 18px screenshot
    const screenshot18 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-vertical-18px.png' })

    // Change to 28px
    await setFontSizeViaSlider(page, 28)
    await page.waitForTimeout(1000)
    const screenshot28 = await page.locator('foliate-paginator').screenshot()
    await page.locator('foliate-paginator').screenshot({ path: 'test-results/08-vertical-28px.png' })

    const same = Buffer.from(screenshot18).equals(Buffer.from(screenshot28))
    console.log(`[FontSize] Vertical 18 vs 28 identical: ${same}`)
    expect(same, 'Vertical mode: 18px and 28px should look different').toBe(false)
  })
})
