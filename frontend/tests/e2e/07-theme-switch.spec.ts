import { test, expect, Page } from '@playwright/test'
import { createUser, deleteUser, uploadBook, deleteBook } from '../helpers/testDb'
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_EPUB = path.resolve(__dirname, '../../../ebook/哈利波特一_神秘的魔法石.epub')

let testUser: any
let testBook: any

test.beforeEach(async () => {
  testUser = await createUser(`__test07_${Date.now()}`)
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
}

async function pressKey(page: Page, key: string) {
  await page.evaluate((k: string) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }))
  }, key)
  await page.waitForTimeout(400)
}

async function openSettings(page: Page) {
  const settingsBtn = page.locator('svg[data-testid="SettingsIcon"]').locator('..')
  await settingsBtn.click()
  await page.waitForTimeout(400)
}

async function selectTheme(page: Page, theme: '亮色' | '護眼' | '暗色') {
  await page.getByRole('button', { name: theme }).click()
  await page.waitForTimeout(800)
}

/** Get the background color of the reader area (outer container) */
async function getReaderBgColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    // The reader area is the Box containing the paginator
    const paginator = document.querySelector('foliate-paginator')
    const readerArea = paginator?.closest('[class*="MuiBox"]') as HTMLElement
    if (!readerArea) return ''
    return window.getComputedStyle(readerArea).backgroundColor
  })
}

/** Check if paginator shadow DOM #background has the expected color */
async function getPaginatorBgColor(page: Page): Promise<string> {
  return page.evaluate(() => {
    const paginator = document.querySelector('foliate-paginator') as any
    const bg = paginator?.shadowRoot?.getElementById('background')
    return bg ? bg.style.background : ''
  })
}

test.describe('主題切換', () => {
  test.setTimeout(120_000)

  test('切換到黑暗主題，整個閱讀區域變為深色', async ({ page }) => {
    await openReader(page)
    await page.screenshot({ path: 'test-results/07-theme-initial.png' })

    await openSettings(page)
    await selectTheme(page, '暗色')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/07-theme-dark.png' })

    // Check outer container bg
    const outerBg = await getReaderBgColor(page)
    console.log('[主題] 外層背景:', outerBg)

    // Check paginator shadow DOM #background
    const paginatorBg = await getPaginatorBgColor(page)
    console.log('[主題] paginator #background:', paginatorBg)
    expect(paginatorBg).toContain('26, 26, 26')
  })

  test('非第一頁切換主題，無白色殘留', async ({ page }) => {
    await openReader(page)

    // 翻 10 頁到非第一頁
    for (let i = 0; i < 10; i++) await pressKey(page, 'ArrowRight')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/07-theme-page10-before.png' })

    // 切換到暗色
    await openSettings(page)
    await selectTheme(page, '暗色')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)

    await page.screenshot({ path: 'test-results/07-theme-page10-dark.png' })

    const paginatorBg = await getPaginatorBgColor(page)
    console.log('[主題] 非首頁 paginator bg:', paginatorBg)
    expect(paginatorBg).toContain('26, 26, 26')
  })

  test('主題循環切換 light → dark → sepia → light', async ({ page }) => {
    await openReader(page)

    // 翻 5 頁
    for (let i = 0; i < 5; i++) await pressKey(page, 'ArrowRight')

    const themes: Array<{ name: '亮色' | '護眼' | '暗色'; bg: string }> = [
      { name: '暗色', bg: '26, 26, 26' },
      { name: '護眼', bg: '245, 236, 215' },
      { name: '亮色', bg: '255, 255, 255' },
    ]

    for (const { name, bg } of themes) {
      await openSettings(page)
      await selectTheme(page, name)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(500)

      await page.screenshot({ path: `test-results/07-theme-cycle-${name}.png` })

      const paginatorBg = await getPaginatorBgColor(page)
      console.log(`[主題循環] ${name}: paginator bg = ${paginatorBg}`)
      expect(paginatorBg).toContain(bg)
    }
  })
})
