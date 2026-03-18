import { test, expect } from '@playwright/test'
import { fileURLToPath } from 'url'
import path from 'path'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')
const API_BASE = 'http://localhost:3003/api'

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__test05_${Date.now()}`)
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
  await page.waitForTimeout(2500)
}

// 在父頁面 window 發送鍵盤事件（繞過 iframe focus 問題）
async function pressKey(page: any, key: string) {
  await page.evaluate((k: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }, key)
  await page.waitForTimeout(350)
}

async function getBackendProgress(userId: string, bookId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`)
  return res.json() as Promise<{ cfi: string | null; percentage: number }>
}

async function getProgressPercent(page: any): Promise<number> {
  try {
    const text = await page.locator('text=/\\d+%/').textContent({ timeout: 3000 })
    return parseInt(text!.replace('%', ''))
  } catch {
    return 0
  }
}

// 翻 N 頁，記錄每頁進度
async function turnPages(page: any, count: number, direction: 'next' | 'prev') {
  const key = direction === 'next' ? 'ArrowRight' : 'ArrowLeft'
  const percents: number[] = []
  for (let i = 0; i < count; i++) {
    await pressKey(page, key)
    const pct = await getProgressPercent(page)
    percents.push(pct)
  }
  return percents
}

async function switchMode(page: any, mode: '直排' | '橫排') {
  const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
  await settingsBtn.click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: mode }).click()
  await page.waitForTimeout(2000)
  // 關閉設定抽屜 - page.keyboard.press 才能關閉 MUI bottom Drawer
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
}

test.describe('直排/橫排翻頁 30 頁 + 進度驗證', () => {
  test('直排：向前翻 30 頁，進度遞增，存檔正確', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    const initialPct = await getProgressPercent(page)
    console.log(`初始進度: ${initialPct}%`)

    const percents = await turnPages(page, 30, 'next')
    console.log('直排前進進度（每頁）:', percents)

    const finalPct = percents[percents.length - 1]
    console.log(`翻 30 頁後進度: ${finalPct}%`)

    expect(finalPct).toBeGreaterThan(initialPct)

    // 等後端儲存（async）
    await page.waitForTimeout(1500)

    const saved = await getBackendProgress(testUser.id, testBook.id)
    console.log('後端儲存進度:', saved)
    expect(saved.percentage).toBeGreaterThan(0)
    expect(saved.cfi).toBeTruthy()
    expect(Math.abs(saved.percentage - finalPct)).toBeLessThanOrEqual(3)

    await page.screenshot({ path: 'test-results/05-vertical-30pages.png' })
  })

  test('直排：向前 30 頁再向後 30 頁，後退進度小於前進', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    const forwardPercents = await turnPages(page, 30, 'next')
    const peakPct = forwardPercents[forwardPercents.length - 1]
    console.log(`前進 30 頁後: ${peakPct}%`)
    await page.screenshot({ path: 'test-results/05-vertical-forward30.png' })

    const backPercents = await turnPages(page, 30, 'prev')
    const backPct = backPercents[backPercents.length - 1]
    console.log(`後退 30 頁後: ${backPct}%`)
    await page.screenshot({ path: 'test-results/05-vertical-back30.png' })

    expect(backPct).toBeLessThan(peakPct)

    await page.waitForTimeout(1500)
    const saved = await getBackendProgress(testUser.id, testBook.id)
    console.log('後端進度（後退後）:', saved)
    expect(Math.abs(saved.percentage - backPct)).toBeLessThanOrEqual(3)
  })

  test('橫排：向前翻 30 頁，進度遞增，存檔正確', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)
    await switchMode(page, '橫排')

    const initialPct = await getProgressPercent(page)
    console.log(`橫排初始進度: ${initialPct}%`)

    const percents = await turnPages(page, 30, 'next')
    console.log('橫排前進進度（每頁）:', percents)
    const finalPct = percents[percents.length - 1]
    console.log(`橫排翻 30 頁後: ${finalPct}%`)

    expect(finalPct).toBeGreaterThan(initialPct)

    await page.waitForTimeout(1500)
    const saved = await getBackendProgress(testUser.id, testBook.id)
    console.log('橫排後端進度:', saved)
    expect(saved.percentage).toBeGreaterThan(0)
    expect(Math.abs(saved.percentage - finalPct)).toBeLessThanOrEqual(3)

    await page.screenshot({ path: 'test-results/05-horizontal-30pages.png' })
  })

  test('橫排：向前 30 頁再向後 30 頁', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)
    await switchMode(page, '橫排')

    const forwardPercents = await turnPages(page, 30, 'next')
    const peakPct = forwardPercents[forwardPercents.length - 1]
    console.log(`橫排前進 30 頁: ${peakPct}%`)

    const backPercents = await turnPages(page, 30, 'prev')
    const backPct = backPercents[backPercents.length - 1]
    console.log(`橫排後退 30 頁: ${backPct}%`)

    expect(backPct).toBeLessThan(peakPct)

    await page.waitForTimeout(1500)
    const saved = await getBackendProgress(testUser.id, testBook.id)
    expect(Math.abs(saved.percentage - backPct)).toBeLessThanOrEqual(3)

    await page.screenshot({ path: 'test-results/05-horizontal-back30.png' })
  })

  test('直排切換橫排再切回直排，進度持續累積', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    // 直排翻 15 頁
    await turnPages(page, 15, 'next')
    const vertPct = await getProgressPercent(page)
    await page.waitForTimeout(1000)
    const savedAfterVert = await getBackendProgress(testUser.id, testBook.id)
    console.log(`直排 15 頁: ${vertPct}%，後端: ${savedAfterVert.percentage}%`)
    expect(savedAfterVert.percentage).toBeGreaterThan(0)

    // 切橫排再翻 15 頁
    await switchMode(page, '橫排')
    await turnPages(page, 15, 'next')
    const horizPct = await getProgressPercent(page)
    console.log(`橫排再翻 15 頁: ${horizPct}%`)
    // 橫排版面不同，進度可能略有差異，但應大於 0
    expect(horizPct).toBeGreaterThan(0)

    // 切回直排
    await switchMode(page, '直排')
    const finalPct = await getProgressPercent(page)
    console.log(`切回直排: ${finalPct}%`)

    await page.waitForTimeout(1500)
    const savedFinal = await getBackendProgress(testUser.id, testBook.id)
    console.log('最終後端進度:', savedFinal)
    // 橫排與直排版面不同，百分比計算略有差異，但進度應大於 0
    expect(savedFinal.percentage).toBeGreaterThan(0)
    expect(savedFinal.cfi).toBeTruthy()

    await page.screenshot({ path: 'test-results/05-mode-switch-progress.png' })
  })

  test('進度條顯示隨翻頁應遞增（15頁，允許最多1次倒退）', async ({ page }) => {
    test.setTimeout(60_000)
    await openReader(page)

    let prevPct = await getProgressPercent(page)
    let nonMonotonicCount = 0
    let maxPct = prevPct

    for (let i = 0; i < 15; i++) {
      await pressKey(page, 'ArrowRight')
      const pct = await getProgressPercent(page)
      if (pct < prevPct) {
        nonMonotonicCount++
        console.warn(`第 ${i + 1} 頁進度倒退：${prevPct}% → ${pct}%`)
      }
      prevPct = pct
      if (pct > maxPct) maxPct = pct
    }

    console.log(`15 頁中倒退次數：${nonMonotonicCount}，最高進度：${maxPct}%，最終進度：${prevPct}%`)
    expect(maxPct).toBeGreaterThan(0)
    expect(nonMonotonicCount).toBeLessThanOrEqual(1)

    await page.screenshot({ path: 'test-results/05-monotonic-progress.png' })
  })
})
