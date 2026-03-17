import { test, expect } from '@playwright/test'
import { setupMockApi, MOCK_BOOKS } from '../helpers/mockApi'

test.describe('書庫', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Select user 1
    await page.getByText('小明').click()
    await page.waitForURL('/library')
    await page.waitForLoadState('networkidle')
  })

  test('顯示書庫書籍列表', async ({ page }) => {
    for (const book of MOCK_BOOKS) {
      await expect(page.getByText(book.title)).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/02-library.png' })
  })

  test('有閱讀進度的書顯示進度條', async ({ page }) => {
    // 三體有 progress: @@3@@0.45，應顯示 45% 進度
    const progressBar = page.locator('[role="progressbar"]').last()
    await expect(progressBar).toBeVisible()
    await page.screenshot({ path: 'test-results/02-progress-bar.png' })
  })

  test('點擊書籍導向閱讀器', async ({ page }) => {
    await page.route('**/api/users/1/settings', async (route) => {
      await route.fulfill({
        json: { writingMode: 'vertical-rl', fontSize: 18, theme: 'light', openccMode: 'none', tapZoneLayout: 'default' },
      })
    })

    await page.getByText(MOCK_BOOKS[0].title).click()
    await expect(page).toHaveURL(`/reader/${MOCK_BOOKS[0].id}`)
    await page.screenshot({ path: 'test-results/02-enter-reader.png' })
  })

  test('可以刪除書籍', async ({ page }) => {
    // The delete button contains a DeleteIcon (MUI SVG with data-testid="DeleteIcon")
    const deleteBtn = page.locator('svg[data-testid="DeleteIcon"]').locator('..').first()
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()
    await page.screenshot({ path: 'test-results/02-delete-book.png' })
  })
})
