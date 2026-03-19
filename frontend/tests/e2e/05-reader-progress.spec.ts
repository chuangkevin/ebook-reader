import { test, expect, Page } from '@playwright/test'
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
  // Install relocate listener to capture visible range text
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
  await page.waitForTimeout(350)
}

async function getBackendProgress(userId: string, bookId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/books/${bookId}/progress`)
  return res.json() as Promise<{ cfi: string | null; percentage: number }>
}

async function getProgressPercent(page: Page): Promise<number> {
  try {
    const text = await page.locator('text=/\\d+%/').textContent({ timeout: 3000 })
    return parseInt(text!.replace('%', ''))
  } catch {
    return 0
  }
}

/** Get visible text from the relocate event's range (current page only) */
async function getVisibleText(page: Page): Promise<string> {
  return page.evaluate(() => (window as any).__lastVisibleText ?? '')
}

function extractSnippet(text: string, length = 30): string {
  return text.replace(/[\s\r\n]+/g, '').slice(0, length)
}

async function turnPages(page: Page, count: number, direction: 'next' | 'prev') {
  const key = direction === 'next' ? 'ArrowRight' : 'ArrowLeft'
  const percents: number[] = []
  for (let i = 0; i < count; i++) {
    await pressKey(page, key)
    const pct = await getProgressPercent(page)
    percents.push(pct)
  }
  return percents
}

async function switchMode(page: Page, mode: '直排' | '橫排') {
  const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
  await settingsBtn.click()
  await page.waitForTimeout(300)
  await page.getByRole('button', { name: mode }).click()
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(600)
}

test.describe('進度儲存與翻頁', () => {
  test('直排：翻 30 頁，進度遞增，後端存檔正確', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    const initialPct = await getProgressPercent(page)
    const percents = await turnPages(page, 30, 'next')
    const finalPct = percents[percents.length - 1]
    console.log(`直排 30 頁: ${initialPct}% → ${finalPct}%`)

    expect(finalPct).toBeGreaterThan(initialPct)

    await page.waitForTimeout(1500)
    const saved = await getBackendProgress(testUser.id, testBook.id)
    console.log('後端:', saved)
    expect(saved.percentage).toBeGreaterThan(0)
    expect(saved.cfi).toBeTruthy()
    expect(Math.abs(saved.percentage - finalPct)).toBeLessThanOrEqual(3)

    await page.screenshot({ path: 'test-results/05-vertical-30pages.png' })
  })

  test('直排：前進 30 頁再後退 30 頁', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    const fwd = await turnPages(page, 30, 'next')
    const peak = fwd[fwd.length - 1]
    const back = await turnPages(page, 30, 'prev')
    const backPct = back[back.length - 1]
    console.log(`前進 ${peak}% → 後退 ${backPct}%`)

    expect(backPct).toBeLessThan(peak)
    await page.screenshot({ path: 'test-results/05-vertical-back30.png' })
  })

  test('橫排：翻 30 頁，進度遞增，後端存檔正確', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)
    await switchMode(page, '橫排')

    const initialPct = await getProgressPercent(page)
    const percents = await turnPages(page, 30, 'next')
    const finalPct = percents[percents.length - 1]
    console.log(`橫排 30 頁: ${initialPct}% → ${finalPct}%`)

    expect(finalPct).toBeGreaterThan(initialPct)

    await page.waitForTimeout(1500)
    const saved = await getBackendProgress(testUser.id, testBook.id)
    expect(saved.percentage).toBeGreaterThan(0)
    expect(Math.abs(saved.percentage - finalPct)).toBeLessThanOrEqual(3)

    await page.screenshot({ path: 'test-results/05-horizontal-30pages.png' })
  })

  test('進度條 15 頁遞增（允許最多 1 次倒退）', async ({ page }) => {
    test.setTimeout(60_000)
    await openReader(page)

    let prevPct = await getProgressPercent(page)
    let nonMonotonicCount = 0

    for (let i = 0; i < 15; i++) {
      await pressKey(page, 'ArrowRight')
      const pct = await getProgressPercent(page)
      if (pct < prevPct) {
        nonMonotonicCount++
        console.warn(`第 ${i + 1} 頁倒退: ${prevPct}% → ${pct}%`)
      }
      prevPct = pct
    }

    console.log(`倒退次數: ${nonMonotonicCount}, 最終: ${prevPct}%`)
    expect(prevPct).toBeGreaterThan(0)
    expect(nonMonotonicCount).toBeLessThanOrEqual(1)
  })
})

test.describe('進度還原（重開閱讀器）', () => {
  test('翻 20 頁後回書庫再進入，可見文字與離開時一致', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)

    // 翻 20 頁到章節中間
    for (let i = 0; i < 20; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(500)

    const textBefore = await getVisibleText(page)
    const snippetBefore = extractSnippet(textBefore)
    const pctBefore = await getProgressPercent(page)
    console.log(`[還原] 離開前: ${pctBefore}%, visible: "${snippetBefore}"`)
    expect(snippetBefore.length).toBeGreaterThan(5)

    await page.screenshot({ path: 'test-results/05-before-leave.png' })

    // 等進度存檔
    await page.waitForTimeout(2000)

    // 回書庫
    const backBtn = page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')
    await backBtn.click()
    await page.waitForURL('/library')
    await page.waitForTimeout(1000)

    // 重新進入 — need to re-install the relocate listener
    await page.getByText(testBook.title).click()
    await page.waitForURL(`/reader/${testBook.id}`)
    await page.waitForSelector('foliate-paginator', { timeout: 10000 })
    await page.waitForTimeout(3000)
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
    // Trigger a relocate so we can capture visible text
    await pressKey(page, 'ArrowRight')
    await pressKey(page, 'ArrowLeft')
    await page.waitForTimeout(500)

    const textAfter = await getVisibleText(page)
    const snippetAfter = extractSnippet(textAfter, 200)
    const pctAfter = await getProgressPercent(page)
    console.log(`[還原] 重開後: ${pctAfter}%, visible(200): "${snippetAfter.slice(0, 60)}"`)

    await page.screenshot({ path: 'test-results/05-after-reopen.png' })

    // 核心驗證：重開後看到的文字應包含離開前的文字片段
    const searchKey = snippetBefore.slice(0, 15)
    const found = snippetAfter.includes(searchKey)
    console.log(`[還原] 搜尋 "${searchKey}": ${found}`)
    expect(found).toBeTruthy()
  })

  test('橫排翻頁後回書庫再進入，進度不歸零', async ({ page }) => {
    test.setTimeout(120_000)
    await openReader(page)
    await switchMode(page, '橫排')

    // 翻 20 頁
    for (let i = 0; i < 20; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(500)

    const pctBefore = await getProgressPercent(page)
    console.log(`[橫排還原] 離開前: ${pctBefore}%`)
    expect(pctBefore).toBeGreaterThan(0)

    await page.waitForTimeout(2000)

    // 回書庫再進入
    const backBtn = page.locator('svg[data-testid="ArrowBackIcon"]').locator('..')
    await backBtn.click()
    await page.waitForURL('/library')
    await page.waitForTimeout(1000)

    await page.getByText(testBook.title).click()
    await page.waitForURL(`/reader/${testBook.id}`)
    await page.waitForSelector('foliate-paginator', { timeout: 10000 })
    await page.waitForTimeout(3000)

    const pctAfter = await getProgressPercent(page)
    console.log(`[橫排還原] 重開後: ${pctAfter}%`)

    expect(pctAfter).toBeGreaterThan(0)

    await page.screenshot({ path: 'test-results/05-horiz-reopen.png' })
  })
})
