import { test, expect } from '../fixtures/test';

/**
 * Horizontal Mode Page Navigation Tests (橫排)
 * Tests for the chapter-jumping bug in landscape/horizontal reading mode
 *
 * Root causes being tested:
 * 1. Flex-shrink compression: container.scrollWidth === container.offsetWidth → maxScroll = 0
 * 2. RTL direction mismatch: epub.js scrollBy() negates x value for RTL
 */

test.describe('Horizontal Mode (橫排) - Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reader with a test EPUB
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // TODO: Select a horizontal-layout EPUB book
    // This depends on your test data setup
  });

  test('[Diagnostic] Detect flex-shrink compression on page load', async ({ readerHelper }) => {
    /**
     * GOAL: Verify if flex compression is causing maxScroll === 0
     * This is Root Cause #1
     *
     * Expected (GOOD):  scrollWidth > offsetWidth
     * Problematic (BAD): scrollWidth === offsetWidth
     */

    const compression = await readerHelper.detectFlexCompression();

    console.log('Flex Compression Diagnostic:');
    console.log(JSON.stringify(compression, null, 2));

    // Report findings
    if (compression.isCompressed) {
      console.error('⚠️  FLEX COMPRESSION DETECTED');
      console.error(
        `   scrollWidth (${compression.scrollWidth}) === offsetWidth (${compression.offsetWidth})`
      );
      console.error(`   firstChild.minWidth: ${compression.childMinWidth} (should be set)`);
      console.error(`   Expected minWidth: ${compression.expectedMinWidth}px`);
    } else {
      console.log('✓ No flex compression detected');
    }

    // Take screenshot for documentation
    await readerHelper.takeDebugScreenshot('horizontal-flex-diagnosis');
  });

  test('[Diagnostic] Detect RTL direction mismatch', async ({ readerHelper }) => {
    /**
     * GOAL: Verify if RTL direction is causing scroll direction inversion
     * This is Root Cause #2
     *
     * Expected (GOOD):  direction = 'ltr'
     * Problematic (BAD): direction = 'rtl'
     */

    const rtlCheck = await readerHelper.detectRTLIssue();

    console.log('RTL Direction Diagnostic:');
    console.log(JSON.stringify(rtlCheck, null, 2));

    if (rtlCheck.hasRTLMismatch) {
      console.error('⚠️  RTL DIRECTION MISMATCH DETECTED');
      console.error('   Container direction is set to "rtl" which causes epub.js');
      console.error('   scrollBy() to negate the x value, inverting scroll direction');
    } else {
      console.log('✓ Direction correctly set to ltr');
    }

    await readerHelper.takeDebugScreenshot('horizontal-rtl-diagnosis');
  });

  test('[Behavior] Single page turn should scroll within chapter', async ({ readerHelper }) => {
    /**
     * GOAL: Verify that a single next/prev button click advances within the chapter
     * rather than jumping to the next chapter.
     *
     * SUCCESS: scrollLeft increases by delta amount
     * FAILURE: next chapter loads (chapter-jump detected via willJump flag)
     */

    const result = await readerHelper.turnPageAndValidate('next');

    console.log('Single Page Turn Result:');
    console.log(JSON.stringify(result, null, 2));

    // Verify we scrolled within the page
    if (result.jumped) {
      console.error('❌ CHAPTER JUMP DETECTED on single page turn');
      console.error(`   willJump flag: ${result.jumped}`);
      console.error(`   Debug info:`, result.debug);
    } else {
      console.log('✓ Scrolled within chapter (no jump)');
      console.log(`   Scroll delta: ${result.scrollDelta}px`);
    }

    // This test should eventually pass with the fix
    expect(result.jumped).toBe(false);
  });

  test('[Behavior] Sequential page turns should not always jump', async ({ readerHelper }) => {
    /**
     * GOAL: Perform 5 consecutive page turns and verify they don't all jump chapters
     * This identifies the "every page turn = chapter jump" bug
     *
     * CURRENT BEHAVIOR (BUG): willJump = true for every turn
     * FIXED BEHAVIOR: willJump = false for most turns, true only at chapter end
     */

    const results = await readerHelper.detectPerpetualChapterJump();

    console.log('Sequential Page Turns Result:');
    console.log(JSON.stringify(results, null, 2));

    if (results.allJumped) {
      console.error('❌ PERPETUAL CHAPTER JUMP DETECTED');
      console.error(`   All ${results.totalTurns} turns resulted in chapter jumps`);
      console.error('   This indicates maxScroll === 0 (likely flex compression)');
    } else {
      console.log(`✓ Only ${results.jumpCount}/${results.totalTurns} turns resulted in jumps`);
      console.log('  (Jumps at chapter boundaries are expected)');
    }

    expect(results.allJumped).toBe(false);
  });

  test('[Debug] Export full diagnostic report for horizontal mode', async ({ readerHelper }) => {
    /**
     * GOAL: Collect all diagnostic information for analysis
     * Useful for understanding the exact state when chapter-jumping occurs
     */

    const report = await readerHelper.exportDiagnosticReport('horizontal-mode-diagnosis');

    // Verify critical metrics
    expect(report.diagnostics).toBeDefined();
    expect(report.diagnostics.flexCompression).toBeDefined();
    expect(report.diagnostics.rtlIssue).toBeDefined();
    expect(report.diagnostics.containerDimensions).toBeDefined();

    console.log('✓ Diagnostic report generated');
  });

  test('[Verification] Confirm minWidth prevents flex compression', async ({ readerHelper }) => {
    /**
     * GOAL: After applying minWidth fix, verify it prevents flex compression
     *
     * This test validates the fix from commit 07d5915:
     *   element.style.minWidth = newW + 'px'
     */

    const compression = await readerHelper.detectFlexCompression();

    if (compression.isCompressed) {
      console.warn('minWidth fix not applied or ineffective');
      console.warn(`Expected minWidth: ${compression.expectedMinWidth}px`);
      console.warn(`Actual minWidth: ${compression.childMinWidth}`);
    }

    expect(compression.isCompressed).toBe(false);
  });

  test('[Verification] Confirm direction is set to ltr', async ({ readerHelper }) => {
    /**
     * GOAL: After applying direction fix, verify container uses ltr
     *
     * This test validates the fix from commit 07d5915:
     *   mgr.settings.direction = 'ltr'
     */

    const rtlCheck = await readerHelper.detectRTLIssue();

    expect(rtlCheck.hasRTLMismatch).toBe(false);
  });

  test('[Performance] Measure scroll responsiveness', async ({ page, readerHelper }) => {
    /**
     * GOAL: Measure time between click and visible scroll movement
     * Helps identify if fixes introduce performance regressions
     */

    const startTime = Date.now();

    await readerHelper.turnPageAndValidate('next');

    const elapsed = Date.now() - startTime;

    console.log(`Page turn took ${elapsed}ms`);

    // Should complete within 1 second for good UX
    expect(elapsed).toBeLessThan(1000);
  });

  test.describe('Edge Cases', () => {
    test('[Edge] Page turn at chapter end should transition to next chapter', async (
      { readerHelper }
    ) => {
      /**
       * GOAL: Verify that when already at the end of a chapter,
       * the next page turn correctly jumps to the next chapter (not stays in place)
       */

      // TODO: Navigate to near the end of a chapter
      // Then verify the next page turn transitions correctly

      // This test requires:
      // 1. A way to detect chapter boundaries
      // 2. Navigation to just before the boundary
      // 3. Verification that the next turn shows the next chapter
    });

    test('[Edge] Page turn at chapter start (prev) should transition to prev chapter', async (
      { readerHelper }
    ) => {
      // Similar to above but for previous button at chapter start
    });

    test('[Edge] Very long chapter should handle multiple page turns', async (
      { readerHelper }
    ) => {
      /**
       * GOAL: In a chapter with many pages, verify continuous page turns
       * don't prematurely jump to next chapter
       */

      const results = await readerHelper.sequentialPageTurns(20, 'next');

      // Count jumps - should be 0 or very few (only at chapter end)
      const jumpCount = results.filter(r => r.jumped).length;

      console.log(`20 page turns: ${jumpCount} jumps (target: 1 at chapter end)`);

      // Expect only 1 jump (at the very end) for a book with longer chapters
      expect(jumpCount).toBeLessThanOrEqual(2);
    });
  });
});
