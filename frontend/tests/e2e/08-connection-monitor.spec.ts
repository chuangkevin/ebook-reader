import { test, expect } from '@playwright/test'
import { assertBackendReady } from '../helpers/testDb'

test.beforeAll(async () => {
  await assertBackendReady()
})

test.describe('Connection Monitor', () => {
  test('在線時不顯示 banner', async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    const banner = page.locator('[data-testid="connection-banner"]')
    await expect(banner).not.toBeVisible()
  })

  test('斷網後顯示離線 banner', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Simulate offline
    await context.setOffline(true)
    await page.waitForTimeout(500)

    const banner = page.locator('[data-testid="connection-banner"]')
    await expect(banner).toBeVisible()
    await expect(banner).toContainText('離線')

    // Restore
    await context.setOffline(false)
    await page.waitForTimeout(500)
    await expect(banner).not.toBeVisible()
  })

  test('離線→上線切換 banner 正確顯示隱藏', async ({ page, context }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const banner = page.locator('[data-testid="connection-banner"]')

    // Go offline
    await context.setOffline(true)
    await page.waitForTimeout(500)
    await expect(banner).toBeVisible()

    // Go online
    await context.setOffline(false)
    await page.waitForTimeout(500)
    await expect(banner).not.toBeVisible()

    // Go offline again
    await context.setOffline(true)
    await page.waitForTimeout(500)
    await expect(banner).toBeVisible()

    // Restore
    await context.setOffline(false)
  })
})
