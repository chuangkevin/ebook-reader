import { test, expect } from '@playwright/test'
import {
  assertBackendReady,
  createUser,
  deleteUser,
  cleanupUsersWithPrefix,
  type TestUser,
} from '../helpers/testDb'

// 所有使用者名稱都加前綴，方便測試後清理
const PREFIX = '__test01_'

test.describe('使用者選擇畫面', () => {
  let user1: TestUser
  let user2: TestUser

  test.beforeAll(async () => {
    await assertBackendReady()
    // 先清理可能殘留的舊測試資料
    await cleanupUsersWithPrefix(PREFIX)
  })

  test.beforeEach(async () => {
    user1 = await createUser(`${PREFIX}小明`)
    user2 = await createUser(`${PREFIX}小華`)
  })

  test.afterEach(async () => {
    // 每次測試後刪除本次建立的使用者
    await deleteUser(user1.id)
    await deleteUser(user2.id)
    // 額外清理「新增使用者」測試可能建立的使用者
    await cleanupUsersWithPrefix(PREFIX)
  })

  test('顯示所有使用者卡片', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(user1.name)).toBeVisible()
    await expect(page.getByText(user2.name)).toBeVisible()
    await page.screenshot({ path: 'test-results/01-user-list.png' })
  })

  test('點擊使用者後導向書庫', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.getByText(user1.name).click()
    await expect(page).toHaveURL('/library')
    await page.screenshot({ path: 'test-results/01-after-user-select.png' })
  })

  test('可以新增使用者', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 點擊「新增讀者」卡片（CardActionArea 內包含 PersonAddIcon 與文字）
    await page.getByText('新增讀者').click()

    // 填入姓名
    const input = page.getByRole('textbox')
    await expect(input).toBeVisible()
    const newName = `${PREFIX}NewUser`
    await input.fill(newName)

    // 點擊「新增」按鈕
    await page.getByRole('button', { name: '新增' }).click()

    // 對話框關閉，新使用者出現在畫面上
    await expect(page.getByText(newName)).toBeVisible()
    await page.screenshot({ path: 'test-results/01-add-user.png' })
  })

  test('可以刪除使用者', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await expect(page.getByText(user1.name)).toBeVisible()

    // 找到 user1 卡片內的刪除按鈕（DeleteIcon）
    // 使用者卡片結構：Card > CardActionArea（含名稱）+ IconButton（含 DeleteIcon）
    // 透過 user1 名稱文字找到父卡片，再找 DeleteIcon
    const userCard = page.locator('.MuiCard-root').filter({ hasText: user1.name })
    const deleteBtn = userCard.locator('svg[data-testid="DeleteIcon"]').locator('..')
    await expect(deleteBtn).toBeVisible()
    await deleteBtn.click()

    // 等待使用者從畫面消失
    await expect(page.getByText(user1.name)).not.toBeVisible()
    await page.screenshot({ path: 'test-results/01-delete-user.png' })
  })
})
