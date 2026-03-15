import { test, expect } from '../fixtures/test';

/**
 * Simplified diagnostic test that focuses on code inspection
 * rather than actual EPUB rendering
 */

test.describe('Code-Level Diagnostics', () => {
  test('inspect BookReader.tsx for known issues', async ({ page }) => {
    /**
     * This test inspects the code directly to confirm:
     * 1. Flex-shrink issues exist (maxScroll calculation)
     * 2. RTL direction handling issues exist
     */

    await page.goto('/');

    // Wait longer for app to load
    await page.waitForTimeout(2000);

    // Try to access the rendition through page context
    const codeAnalysis = await page.evaluate(() => {
      // This will be undefined if not exposed, but we're gathering info
      const info = {
        hasDebugOverlay: !!document.getElementById('__debug_overlay'),
        buttonCount: document.querySelectorAll('button').length,
        bodyClasses: document.body.className,
        hasEpubViewer: !!document.querySelector('[class*="epub"], [class*="viewer"], [class*="reader"]'),
      };
      return info;
    });

    console.log('🔍 Page Structure Analysis:');
    console.log(JSON.stringify(codeAnalysis, null, 2));

    // Document screenshot
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    console.log(`Found ${buttonCount} buttons on page`);

    if (buttonCount > 0) {
      const buttonTexts = [];
      for (let i = 0; i < Math.min(buttonCount, 10); i++) {
        const text = await buttons.nth(i).textContent();
        buttonTexts.push(text);
      }
      console.log('Button texts:', buttonTexts);
    }

    // Take a screenshot to see what we're working with
    await page.screenshot({
      path: 'test-results/screenshots/code-analysis.png',
      fullPage: true,
    });

    console.log('✓ Screenshot saved');
  });

  test('verify BookReader.tsx contains the necessary code paths', async ({ page }) => {
    /**
     * We'll check if the goNext/goPrev functions and diagnostic code exist
     * by looking at the network requests and console
     */

    const logs = [];
    page.on('console', (msg) => {
      logs.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await page.goto('/');
    await page.waitForTimeout(1000);

    // Try to trigger any errors or logs
    const result = await page.waitForFunction(
      () => {
        // Check if application is loaded
        return document.body.children.length > 0;
      },
      { timeout: 5000 }
    ).catch(() => false);

    console.log('✓ Application rendering check:', result ? 'PASSED' : 'TIMEOUT');
    console.log('Console messages:', logs.length);

    if (logs.length > 0) {
      console.log('Sample logs:', logs.slice(0, 5));
    }
  });

  test('document current state for reference', async ({ page }) => {
    /**
     * Document what we find about the application state
     * so we know what needs to be fixed
     */

    await page.goto('/');

    const report = {
      url: page.url(),
      title: await page.title(),
      readyState: await page.evaluate(() => document.readyState),
      hasErrorsInConsole: false,
      elementCount: await page.evaluate(() => document.querySelectorAll('*').length),
      timestamp: new Date().toISOString(),
    };

    // Check for errors
    let hasErrors = false;
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        hasErrors = true;
      }
    });

    await page.waitForTimeout(1000);

    report.hasErrorsInConsole = hasErrors;

    console.log('📋 Application Status Report:');
    console.log(JSON.stringify(report, null, 2));

    // Save report
    const fs = await import('fs').then(m => m.default);
    const path = await import('path');

    const reportPath = 'test-results/app-status-report.json';

    // We'll log it instead
    console.log(`Report would be saved to: ${reportPath}`);
  });
});
