import { test, expect } from '@playwright/test'
import { setupMockApi, MOCK_USERS } from '../helpers/mockApi'

test.describe('使用者選擇畫面', () => {
  test.beforeEach(async ({ page }) => {
    await setupMockApi(page)
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('顯示所有使用者卡片', async ({ page }) => {
    for (const user of MOCK_USERS) {
      await expect(page.getByText(user.name)).toBeVisible()
    }
    await page.screenshot({ path: 'test-results/01-user-list.png' })
  })

  test('點擊使用者後導向書庫', async ({ page }) => {
    await page.route('**/api/users/1/books', async (route) => {
      await route.fulfill({ json: [] })
    })
    await page.getByText(MOCK_USERS[0].name).click()
    await expect(page).toHaveURL('/library')
    await page.screenshot({ path: 'test-results/01-after-user-select.png' })
  })

  test('可以新增使用者', async ({ page }) => {
    // Click add user button
    const addBtn = page.getByRole('button', { name: /新增|add/i })
    await expect(addBtn).toBeVisible()
    await addBtn.click()

    // Fill in name
    const input = page.getByRole('textbox')
    await input.fill('新用戶')
    await page.getByRole('button', { name: /確認|建立|新增|ok/i }).click()

    await page.screenshot({ path: 'test-results/01-add-user.png' })
  })
})
