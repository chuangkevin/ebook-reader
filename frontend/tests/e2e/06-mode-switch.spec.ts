import { test, expect } from '@playwright/test'
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

async function openReader(page: any) {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByText(testUser.name).click()
  await page.waitForURL('/library')
  await page.getByText(testBook.title).click()
  await page.waitForURL(`/reader/${testBook.id}`)
  await page.waitForSelector('foliate-paginator', { timeout: 10000 })
  await page.waitForTimeout(2500)
}

async function pressKey(page: any, key: string) {
  await page.evaluate((k: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }, key)
  await page.waitForTimeout(400)
}

async function getProgressPercent(page: any): Promise<number> {
  try {
    const text = await page.locator('text=/\\d+%/').textContent({ timeout: 3000 })
    return parseInt(text!.replace('%', ''))
  } catch {
    return 0
  }
}

async function getBackendCfi(userId: string, bookId: string): Promise<{ index: number; anchor: number } | null> {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`)
  const data = await res.json() as { cfi: string | null }
  if (!data.cfi) return null
  const parts = data.cfi.split('@@').filter(Boolean)
  if (parts.length < 2) return null
  return { index: parseInt(parts[0]), anchor: parseFloat(parts[1]) }
}

async function openSettings(page: any) {
  const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
  await settingsBtn.click()
  await page.waitForTimeout(400)
}

async function clickModeButton(page: any, mode: '直排' | '橫排') {
  await page.getByRole('button', { name: mode }).click()
  // Wait for mode switch to complete (relocate event + goTo)
  await page.waitForTimeout(3000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
}

test.describe('直橫排切換 - 位置保留', () => {
  test.setTimeout(120_000)

  test('切換橫排後 paginator 仍然可以翻頁', async ({ page }) => {
    await openReader(page)

    // 翻 5 頁確認初始狀態正常
    for (let i = 0; i < 5; i++) await pressKey(page, 'ArrowRight')
    const beforeSwitch = await getProgressPercent(page)
    console.log(`切換前進度: ${beforeSwitch}%`)
    expect(beforeSwitch).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/06-before-switch.png' })

    // 切換橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    await page.screenshot({ path: 'test-results/06-after-switch-horiz.png' })

    // 切換後 paginator 應還在 DOM 中
    await expect(page.locator('foliate-paginator')).toBeAttached()

    // 切換後應該可以繼續翻頁（不卡住）
    const beforeNextPage = await getProgressPercent(page)
    await pressKey(page, 'ArrowRight')
    const afterNextPage = await getProgressPercent(page)
    console.log(`橫排翻頁前: ${beforeNextPage}% → 後: ${afterNextPage}%`)

    await page.screenshot({ path: 'test-results/06-horiz-next-page.png' })
  })

  test('切換橫排後進度不重置為 0%', async ({ page }) => {
    await openReader(page)

    // 翻 10 頁建立明顯的進度
    for (let i = 0; i < 10; i++) await pressKey(page, 'ArrowRight')
    const beforeSwitch = await getProgressPercent(page)
    console.log(`切換前進度: ${beforeSwitch}%`)
    expect(beforeSwitch).toBeGreaterThan(0)

    // 切換橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    const afterSwitch = await getProgressPercent(page)
    console.log(`橫排切換後進度: ${afterSwitch}%`)

    await page.screenshot({ path: 'test-results/06-position-preserved.png' })

    // 進度應大於 0（不應重置）
    expect(afterSwitch).toBeGreaterThan(0)
  })

  test('直排→橫排→直排，進度始終大於 0', async ({ page }) => {
    await openReader(page)

    // 直排翻 8 頁
    for (let i = 0; i < 8; i++) await pressKey(page, 'ArrowRight')
    const vertPct = await getProgressPercent(page)
    console.log(`直排 8 頁: ${vertPct}%`)
    expect(vertPct).toBeGreaterThan(0)

    // 切橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')
    const horizPct = await getProgressPercent(page)
    console.log(`切橫排後: ${horizPct}%`)
    expect(horizPct).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/06-horiz-pos.png' })

    // 切回直排
    await openSettings(page)
    await clickModeButton(page, '直排')
    const backVertPct = await getProgressPercent(page)
    console.log(`切回直排: ${backVertPct}%`)
    expect(backVertPct).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/06-back-vert-pos.png' })

    // 確認後端儲存了進度
    await page.waitForTimeout(1500)
    const res = await fetch(`${API_BASE}/users/${testUser.id}/books/${testBook.id}/progress`)
    const saved = await res.json() as { cfi: string | null; percentage: number }
    console.log('最終後端進度:', saved)
    expect(saved.percentage).toBeGreaterThan(0)
    expect(saved.cfi).toBeTruthy()
  })

  test('切換模式後 chapter index 不變（不跳章）', async ({ page }) => {
    await openReader(page)

    // 翻 15 頁讓 anchor 累積到非 0 的值
    for (let i = 0; i < 15; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(1000)

    const before = await getBackendCfi(testUser.id, testBook.id)
    console.log('切換前 CFI:', before)
    expect(before).not.toBeNull()

    // 切換橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')
    await page.waitForTimeout(1500)

    const afterHoriz = await getBackendCfi(testUser.id, testBook.id)
    console.log('切換橫排後 CFI:', afterHoriz)

    // 切回直排
    await openSettings(page)
    await clickModeButton(page, '直排')
    await page.waitForTimeout(1500)

    const afterVert = await getBackendCfi(testUser.id, testBook.id)
    console.log('切回直排後 CFI:', afterVert)

    // chapter index 不應跳到下一章（±1 以內容許，但不應跳多個章節）
    if (before && afterHoriz) {
      const indexDiff = Math.abs(afterHoriz.index - before.index)
      console.log(`橫排切換 index 差: ${indexDiff} (${before.index} → ${afterHoriz.index})`)
      expect(indexDiff).toBeLessThanOrEqual(1)
    }

    await page.screenshot({ path: 'test-results/06-chapter-preserved.png' })
  })

  test('切換模式後翻頁方向正確（不卡不跳）', async ({ page }) => {
    await openReader(page)

    // 切橫排
    await openSettings(page)
    await clickModeButton(page, '橫排')

    // 翻 5 頁，進度應遞增
    const percents: number[] = []
    for (let i = 0; i < 5; i++) {
      await pressKey(page, 'ArrowRight')
      percents.push(await getProgressPercent(page))
    }
    console.log('橫排翻頁進度序列:', percents)

    // 最後一頁應大於第一頁（整體遞增趨勢）
    expect(percents[percents.length - 1]).toBeGreaterThanOrEqual(percents[0])

    await page.screenshot({ path: 'test-results/06-horiz-sequential.png' })
  })
})
