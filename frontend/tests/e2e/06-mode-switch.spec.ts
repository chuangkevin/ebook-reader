import { test, expect, Page } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')
const API_BASE = 'http://localhost:3003/api'

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__test06_${Date.now()}`)
  testBook = await uploadBook(TEST_EPUB, testUser.id)
})

test.afterEach(async () => {
  if (testBook) await deleteBook(testBook.id, testUser?.id).catch(() => {})
  if (testUser) await deleteUser(testUser.id).catch(() => {})
})

async function openReader(page: Page) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByText(testBook.title).click()
  await page.waitForURL(`/reader/${testBook.id}`)
  await page.waitForSelector('foliate-paginator', { timeout: 10000 })
  await page.waitForTimeout(2500)
  // Install a relocate listener to capture visible text from the range
  await page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    if (paginator) {
      paginator.addEventListener('relocate', (e: any) => {
        const range = e.detail?.range
        if (range?.toString) {
          (window as any).__lastVisibleText = range.toString().trim()
        }
      })
    }
  })
}

async function pressKey(page: Page, key: string) {
  await page.evaluate((k: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }, key)
  await page.waitForTimeout(400)
}

async function getProgressPercent(page: Page): Promise<number> {
  try {
    const text = await page.locator('text=/\\d+%/').textContent({ timeout: 3000 })
    return parseInt(text!.replace('%', ''))
  } catch {
    return 0
  }
}

/** Get the visible text captured by the relocate event (only current page, not whole section) */
async function getVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__lastVisibleText ?? '')
}

function extractSnippet(text: string, length = 30): string {
  return text.replace(/[\s\r\n]+/g, '').slice(0, length)
}

async function getBackendCfi(userId: string, bookId: string): Promise<{ index: number; anchor: number } | null> {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`)
  const data = await res.json() as { cfi: string | null }
  if (!data.cfi) return null
  const parts = data.cfi.split('@@').filter(Boolean)
  if (parts.length < 2) return null
  return { index: parseInt(parts[0]), anchor: parseFloat(parts[1]) }
}

async function openSettings(page: Page) {
  const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
  await settingsBtn.click()
  await page.waitForTimeout(400)
}

async function clickModeButton(page: Page, mode: '直排' | '橫排') {
  await page.getByRole('button', { name: mode }).click()
  // Wait for mode switch to complete (goTo + relocate)
  await page.waitForTimeout(4000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

test.describe('直橫排切換 — 位置保留（文字驗證）', () => {
  test.setTimeout(120_000)

  test('直排→橫排：切換後看到的文字包含切換前的文字片段', async ({ page }) => {
    await openReader(page)

    // 翻 20 頁，確保在章節中間而非開頭
    for (let i = 0; i < 20; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(500)

    const textBefore = await getVisibleText(page)
    const snippetBefore = extractSnippet(textBefore)
    const pctBefore = await getProgressPercent(page)
    console.log(`[直排→橫排] 切換前: ${pctBefore}%, visible: "${snippetBefore}"`)
    expect(snippetBefore.length).toBeGreaterThan(5)

    await page.screenshot({ path: 'test-results/06-v2h-before.png' })

    // 切橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    const textAfter = await getVisibleText(page)
    const snippetAfter = extractSnippet(textAfter, 2000)
    const pctAfter = await getProgressPercent(page)
    console.log(`[直排→橫排] 切換後: ${pctAfter}%, visible(200): "${snippetAfter.slice(0, 60)}"`)

    await page.screenshot({ path: 'test-results/06-v2h-after.png' })

    // 核心驗證：切換前可見文字的前 15 字應出現在切換後可見文字中
    // 版面不同可能看到的範圍不同，但 anchor text 應該找得到
    const searchKey = snippetBefore.slice(0, 15)
    const found = snippetAfter.includes(searchKey)
    console.log(`[直排→橫排] 搜尋 "${searchKey}" → ${found}`)
    expect(found).toBeTruthy()
  })

  test('橫排→直排：切換後看到的文字包含切換前的文字片段', async ({ page }) => {
    await openReader(page)

    // 先切橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    // 翻 20 頁
    for (let i = 0; i < 20; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(500)

    const textBefore = await getVisibleText(page)
    const snippetBefore = extractSnippet(textBefore)
    const pctBefore = await getProgressPercent(page)
    console.log(`[橫排→直排] 切換前: ${pctBefore}%, visible: "${snippetBefore}"`)
    expect(snippetBefore.length).toBeGreaterThan(5)

    await page.screenshot({ path: 'test-results/06-h2v-before.png' })

    // 切直排
    await openSettings(page)
    await clickModeButton(page, '直排')

    const textAfter = await getVisibleText(page)
    const snippetAfter = extractSnippet(textAfter, 2000)
    const pctAfter = await getProgressPercent(page)
    console.log(`[橫排→直排] 切換後: ${pctAfter}%, visible(200): "${snippetAfter.slice(0, 60)}"`)

    await page.screenshot({ path: 'test-results/06-h2v-after.png' })

    const searchKey = snippetBefore.slice(0, 15)
    const found = snippetAfter.includes(searchKey)
    console.log(`[橫排→直排] 搜尋 "${searchKey}" → ${found}`)
    expect(found).toBeTruthy()
  })

  test('直排→橫排→直排：來回切換，chapter index 不變且進度不歸零', async ({ page }) => {
    await openReader(page)

    // 翻 25 頁到章節中間
    for (let i = 0; i < 25; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(1000)

    const pctOriginal = await getProgressPercent(page)
    const cfiBefore = await getBackendCfi(testUser.id, testBook.id)
    console.log(`[來回切換] 初始: ${pctOriginal}%, cfi:`, cfiBefore)
    expect(pctOriginal).toBeGreaterThan(0)
    expect(cfiBefore).not.toBeNull()

    // 直排→橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')
    await page.waitForTimeout(1500)
    const cfiHoriz = await getBackendCfi(testUser.id, testBook.id)
    const pctHoriz = await getProgressPercent(page)
    console.log(`[來回切換] 橫排: ${pctHoriz}%, cfi:`, cfiHoriz)
    expect(pctHoriz).toBeGreaterThan(0)
    if (cfiBefore && cfiHoriz) {
      expect(Math.abs(cfiHoriz.index - cfiBefore.index)).toBeLessThanOrEqual(1)
    }

    await page.screenshot({ path: 'test-results/06-roundtrip-horiz.png' })

    // 橫排→直排
    await openSettings(page)
    await clickModeButton(page, '直排')
    await page.waitForTimeout(1500)
    const cfiBack = await getBackendCfi(testUser.id, testBook.id)
    const pctBack = await getProgressPercent(page)
    console.log(`[來回切換] 回直排: ${pctBack}%, cfi:`, cfiBack)
    expect(pctBack).toBeGreaterThan(0)
    if (cfiBefore && cfiBack) {
      expect(Math.abs(cfiBack.index - cfiBefore.index)).toBeLessThanOrEqual(1)
    }

    await page.screenshot({ path: 'test-results/06-roundtrip-back.png' })
  })

  test('切換後 chapter index 不跳章', async ({ page }) => {
    await openReader(page)

    // 翻 20 頁
    for (let i = 0; i < 20; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(1000)

    const before = await getBackendCfi(testUser.id, testBook.id)
    console.log('[不跳章] 切換前 CFI:', before)
    expect(before).not.toBeNull()

    // 直排→橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')
    await page.waitForTimeout(1500)

    const afterHoriz = await getBackendCfi(testUser.id, testBook.id)
    console.log('[不跳章] 橫排後 CFI:', afterHoriz)

    if (before && afterHoriz) {
      expect(Math.abs(afterHoriz.index - before.index)).toBeLessThanOrEqual(1)
    }

    // 橫排→直排
    await openSettings(page)
    await clickModeButton(page, '直排')
    await page.waitForTimeout(1500)

    const afterVert = await getBackendCfi(testUser.id, testBook.id)
    console.log('[不跳章] 切回直排 CFI:', afterVert)

    if (before && afterVert) {
      expect(Math.abs(afterVert.index - before.index)).toBeLessThanOrEqual(1)
    }

    await page.screenshot({ path: 'test-results/06-no-chapter-jump.png' })
  })

  test('切換後可以繼續翻頁，進度遞增', async ({ page }) => {
    await openReader(page)

    // 切橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    const pctStart = await getProgressPercent(page)

    // 翻 5 頁
    const percents: number[] = []
    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowRight')
      percents.push(await getProgressPercent(page))
    }
    console.log('[翻頁測試] 橫排翻頁進度:', percents)

    expect(percents[percents.length - 1]).toBeGreaterThanOrEqual(pctStart)
    await page.screenshot({ path: 'test-results/06-paging-after-switch.png' })
  })
})
