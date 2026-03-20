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

/** Get computed font size of first text element inside paginator iframe */
async function getIframeFontSize(page: any): Promise<number> {
  return page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    if (!paginator) return -1
    const contents = paginator.getContents?.() ?? []
    if (contents.length === 0) return -2
    const doc = contents[0].doc as Document
    if (!doc) return -3
    // Find first paragraph or text element
    const el = doc.querySelector('p') || doc.querySelector('div') || doc.body
    if (!el) return -4
    return parseFloat(getComputedStyle(el).fontSize)
  })
}

async function setFontSize(page: any, targetPx: number) {
  // Open settings
  await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
  await page.waitForTimeout(300)

  // Find the font size slider and set value
  // The slider is under "字體大小" section, min=14 max=28 step=2
  const slider = page.locator('text=字體大小').locator('..').locator('input[type="range"]')
  await slider.fill(String(targetPx))
  await page.waitForTimeout(500)

  // Close settings
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

test.describe('字體大小調整', () => {
  test('預設字體大小 18px 應正確套用', async ({ page }) => {
    await openReader(page)
    const fontSize = await getIframeFontSize(page)
    console.log(`[FontSize] Default: ${fontSize}px`)
    await page.screenshot({ path: 'test-results/08-font-default-18px.png' })
    expect(fontSize).toBe(18)
  })

  test('字體大小 14px 應正確套用', async ({ page }) => {
    await openReader(page)
    await setFontSize(page, 14)
    const fontSize = await getIframeFontSize(page)
    console.log(`[FontSize] After set 14: ${fontSize}px`)
    await page.screenshot({ path: 'test-results/08-font-14px.png' })
    expect(fontSize).toBe(14)
  })

  test('字體大小 24px 應正確套用', async ({ page }) => {
    await openReader(page)
    await setFontSize(page, 24)
    const fontSize = await getIframeFontSize(page)
    console.log(`[FontSize] After set 24: ${fontSize}px`)
    await page.screenshot({ path: 'test-results/08-font-24px.png' })
    expect(fontSize).toBe(24)
  })

  test('字體大小 28px 應正確套用', async ({ page }) => {
    await openReader(page)
    await setFontSize(page, 28)
    const fontSize = await getIframeFontSize(page)
    console.log(`[FontSize] After set 28: ${fontSize}px`)
    await page.screenshot({ path: 'test-results/08-font-28px.png' })
    expect(fontSize).toBe(28)
  })

  test('從 14px 到 28px 來回切換，每次都應正確', async ({ page }) => {
    await openReader(page)

    // 14px
    await setFontSize(page, 14)
    let fs = await getIframeFontSize(page)
    console.log(`[FontSize] 14px: ${fs}`)
    await page.screenshot({ path: 'test-results/08-font-cycle-14px.png' })
    expect(fs).toBe(14)

    // 28px
    await setFontSize(page, 28)
    fs = await getIframeFontSize(page)
    console.log(`[FontSize] 28px: ${fs}`)
    await page.screenshot({ path: 'test-results/08-font-cycle-28px.png' })
    expect(fs).toBe(28)

    // 20px
    await setFontSize(page, 20)
    fs = await getIframeFontSize(page)
    console.log(`[FontSize] 20px: ${fs}`)
    await page.screenshot({ path: 'test-results/08-font-cycle-20px.png' })
    expect(fs).toBe(20)
  })

  test('直排模式下字體大小也應正確套用', async ({ page }) => {
    await openReader(page)

    // Ensure vertical mode
    await page.locator('svg[data-testid="SettingsIcon"]').locator('..').click()
    await page.waitForTimeout(300)
    await page.getByText('直排').click()
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(2000)

    // Set 24px
    await setFontSize(page, 24)
    const fontSize = await getIframeFontSize(page)
    console.log(`[FontSize] Vertical 24px: ${fontSize}`)
    await page.screenshot({ path: 'test-results/08-font-vertical-24px.png' })
    expect(fontSize).toBe(24)
  })
})
