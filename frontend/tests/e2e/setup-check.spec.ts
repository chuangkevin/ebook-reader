import { test, expect } from '../fixtures/test';

/**
 * Quick check test to verify Playwright setup
 */
test.describe('Quick Setup Check', () => {
  test('should load the application', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if page loaded
    const title = await page.title();
    console.log('Page title:', title);

    // Check for main elements
    const body = page.locator('body');
    await expect(body).toBeVisible();

    console.log('✓ Application loaded successfully');
  });

  test('should find debug overlay after page turn', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Try to find and click page navigation
    const nextButton = page.locator('button:has-text("next"), button:has-text("Next"), [aria-label*="next"]').first();

    if (await nextButton.isVisible()) {
      await nextButton.click();
      await page.waitForTimeout(500);

      // Look for debug overlay
      const overlay = page.locator('#__debug_overlay');

      if (await overlay.isVisible()) {
        const content = await overlay.textContent();
        console.log('✓ Debug overlay found:');
        console.log(content);
      } else {
        console.log('⚠️  Debug overlay not found - may need to load a book first');
      }
    } else {
      console.log('⚠️  Page navigation buttons not found');
      console.log('   Available buttons:', await page.locator('button').count());
    }
  });

  test('should detect page structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take a screenshot to see the layout
    await page.screenshot({ path: 'test-results/screenshots/page-structure.png' });

    console.log('✓ Screenshot saved to test-results/screenshots/page-structure.png');
  });
});
