import { test, expect } from '../fixtures/test';

/**
 * Vertical Mode Page Navigation Tests (直排)
 * Tests for the chapter-jumping bug in portrait/vertical reading mode
 *
 * The vertical mode also exhibits chapter-jumping, suggesting a shared root cause
 * with horizontal mode or a separate issue in the scroll calculation logic.
 */

test.describe('Vertical Mode (直排) - Page Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to reader and switch to vertical writing mode
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // TODO: Switch to vertical writing mode via settings
    // This depends on your settings UI implementation
  });

  test('[Diagnostic] Verify vertical container dimensions', async ({ readerHelper }) => {
    /**
     * GOAL: Check if vertical scroll containers are properly sized
     * Similar to flex-compression in horizontal mode, vertical might have
     * scrollHeight === offsetHeight issue
     */

    const dims = await readerHelper.getContainerDimensions();

    console.log('Vertical Container Dimensions:');
    console.log(JSON.stringify(dims, null, 2));

    const isCompressed = dims.containerScrollHeight === dims.containerOffsetHeight;

    if (isCompressed) {
      console.error('⚠️  VERTICAL DIMENSION ISSUE DETECTED');
      console.error(
        `   scrollHeight (${dims.containerScrollHeight}) === offsetHeight (${dims.containerOffsetHeight})`
      );
      console.error('   This may cause maxTop to always be 0, forcing chapter jumps');
    } else {
      console.log('✓ Container height properly sized');
      console.log(`   scrollHeight: ${dims.containerScrollHeight}px`);
      console.log(`   offsetHeight: ${dims.containerOffsetHeight}px`);
      console.log(`   Available scroll: ${dims.containerScrollHeight - dims.containerOffsetHeight}px`);
    }

    await readerHelper.takeDebugScreenshot('vertical-dimensions-diagnosis');
  });

  test('[Diagnostic] Verify delta calculation for vertical mode', async ({ readerHelper }) => {
    /**
     * GOAL: Check if delta (page height) is calculated correctly
     *
     * In goNext/goPrev for vertical mode:
     *   delta = container.offsetHeight
     *
     * If this is wrong (e.g., always 0 or very small), page turns would appear to jump
     */

    const state = await readerHelper.validateVerticalScrollState();

    console.log('Vertical Scroll State:');
    console.log(JSON.stringify(state, null, 2));

    if (!state.delta || state.delta === 0) {
      console.error('⚠️  INVALID DELTA DETECTED');
      console.error(`   delta value: ${state.delta}`);
      console.error('   This will cause incorrect scroll calculations');
    } else {
      console.log(`✓ Delta calculated: ${state.delta}px`);
    }

    await readerHelper.takeDebugScreenshot('vertical-delta-diagnosis');
  });

  test('[Behavior] Single page turn should scroll within chapter (vertical)', async (
    { readerHelper }
  ) => {
    /**
     * GOAL: Verify that a single next/prev button click in vertical mode
     * advances within the chapter, not jumping to next chapter
     */

    const result = await readerHelper.turnPageAndValidate('next');

    console.log('Vertical Single Page Turn Result:');
    console.log(JSON.stringify(result, null, 2));

    if (result.jumped) {
      console.error('❌ CHAPTER JUMP DETECTED on single vertical page turn');
      console.error(`   willJump flag: ${result.jumped}`);
      console.error(`   Debug info:`, result.debug);
    } else {
      console.log('✓ Scrolled within chapter (no jump)');
      console.log(`   Scroll delta: ${result.scrollDelta}px`);
    }

    expect(result.jumped).toBe(false);
  });

  test('[Behavior] Sequential page turns in vertical mode', async ({ readerHelper }) => {
    /**
     * GOAL: Perform 5 consecutive vertical page turns
     * Verify they don't consistently jump chapters
     */

    const results = await readerHelper.detectPerpetualChapterJump();

    console.log('Vertical Sequential Page Turns:');
    console.log(JSON.stringify(results, null, 2));

    if (results.allJumped) {
      console.error('❌ PERPETUAL CHAPTER JUMP DETECTED IN VERTICAL MODE');
      console.error(`   All ${results.totalTurns} turns resulted in chapter jumps`);
    } else {
      console.log(`✓ Only ${results.jumpCount}/${results.totalTurns} turns jumped`);
    }

    expect(results.allJumped).toBe(false);
  });

  test('[Debug] Vertical scroll state throughout page turn', async ({ page, readerHelper }) => {
    /**
     * GOAL: Collect detailed scroll state information before, during, and after page turn
     * Useful for understanding exactly what conditions lead to chapter jump
     */

    const beforeTurn = await readerHelper.validateVerticalScrollState();
    console.log('Before turn:', JSON.stringify(beforeTurn, null, 2));

    const result = await readerHelper.turnPageAndValidate('next');

    const afterTurn = await readerHelper.validateVerticalScrollState();
    console.log('After turn:', JSON.stringify(afterTurn, null, 2));

    const comparison = {
      scrollTopDelta: afterTurn.scrollTop - beforeTurn.scrollTop,
      expectedDelta: beforeTurn.delta,
      actuallyJumped: result.jumped,
    };

    console.log('Comparison:', JSON.stringify(comparison, null, 2));

    await readerHelper.takeDebugScreenshot('vertical-scroll-state');
  });

  test('[Verification] Check layout.delta is properly set', async ({ page }) => {
    /**
     * GOAL: Verify that mgr.layout.delta has a sensible value for vertical mode
     *
     * This is used as fallback: (mgr.layout?.delta || container.offsetWidth)
     */

    const layoutDelta = await page.evaluate(() => {
      const r = (window as any).__epubReaderRef?.current?.rendition;
      if (!r) return null;
      const mgr = (r as any).manager;
      return {
        layoutDelta: mgr?.layout?.delta,
        axis: mgr?.settings?.axis,
        isPaginated: mgr?.isPaginated,
      };
    });

    console.log('Layout Delta Info:', JSON.stringify(layoutDelta, null, 2));

    if (!layoutDelta || !layoutDelta.layoutDelta) {
      console.warn('⚠️  Could not verify layout.delta - renderer reference not available');
    }
  });

  test('[Comparison] Compare horizontal vs vertical under same conditions', async (
    { page, readerHelper }
  ) => {
    /**
     * GOAL: Test the same book/chapter in both modes to identify mode-specific issues
     *
     * If only one mode has chapter-jumping, points to mode-specific bug
     * If both modes jump, points to shared root cause
     */

    // Test horizontal
    // await page.click('button:has-text("Horizontal")'); // or however you switch modes
    // const horizontalResults = await readerHelper.detectPerpetualChapterJump();

    // Test vertical
    // await page.click('button:has-text("Vertical")');
    // const verticalResults = await readerHelper.detectPerpetualChapterJump();

    // TODO: Implement based on your UI
  });

  test.describe('Vertical Mode Edge Cases', () => {
    test('[Edge] Top of page - previous button should go to previous chapter', async (
      { readerHelper }
    ) => {
      /**
       * GOAL: At the very top of a chapter (scrollTop === 0),
       * prev button should navigate to the previous chapter
       */

      // Implement navigation logic to detect this condition
    });

    test('[Edge] Bottom of page - next button should go to next chapter', async (
      { readerHelper }
    ) => {
      /**
       * GOAL: At near the bottom of a chapter (scrollTop near maxTop),
       * next button should navigate to the next chapter
       */

      // Implement navigation logic to detect this condition
    });

    test('[Edge] Very tall chapter - multiple page turns', async ({ readerHelper }) => {
      /**
       * GOAL: In a chapter with many pages, verify continuous scrolling
       * doesn't prematurely jump chapters
       */

      const results = await readerHelper.sequentialPageTurns(20, 'next');
      const jumpCount = results.filter(r => r.jumped).length;

      console.log(`Vertical: 20 page turns, ${jumpCount} jumps`);

      // Expect minimal jumps (only at chapter end)
      expect(jumpCount).toBeLessThanOrEqual(2);
    });
  });
});
