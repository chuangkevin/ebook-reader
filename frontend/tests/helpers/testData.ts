import { test, expect } from '../fixtures/test';

/**
 * Common Test Data & Setup
 * Centralized test utilities and mock data
 */

/**
 * Test Book Fixtures
 * Define different EPUB formats for testing
 */
export const TEST_BOOKS = {
  horizontalLayout: {
    name: 'Horizontal Test Book',
    path: '/books/horizontal-test.epub',
    description: 'EPUB with horizontal-tb writing-mode',
    expectedWritingMode: 'horizontal',
    chaptersCount: 10,
    estimatedPagesPerChapter: 10,
  },
  verticalLayout: {
    name: 'Vertical Test Book',
    path: '/books/vertical-test.epub',
    description: 'EPUB with vertical-rl writing-mode',
    expectedWritingMode: 'vertical',
    chaptersCount: 10,
    estimatedPagesPerChapter: 15,
  },
  mixedLayout: {
    name: 'Mixed Layout Book',
    path: '/books/mixed-test.epub',
    description: 'EPUB with both horizontal and vertical content',
    expectedWritingMode: 'variable',
  },
};

/**
 * Common test scenarios
 */
export const TEST_SCENARIOS = {
  // 在章节的不同位置测试翻页
  positionInChapter: {
    start: 'At chapter start',
    middle: 'In chapter middle',
    nearEnd: 'Near chapter end',
    end: 'At chapter end',
  },

  // 不同的翻页方法
  pageNavigation: {
    nextButton: 'Click next button',
    prevButton: 'Click prev button',
    keyboard: 'Keyboard navigation',
    swipe: 'Touch swipe',
  },
};

/**
 * Assertion helpers
 */
export function assertNoChapterJump(
  beforeState: any,
  afterState: any,
  pageName: string
) {
  if (afterState.jumped) {
    throw Error(`[${pageName}] Chapter jump detected!
      Before: ${JSON.stringify(beforeState)}
      After:  ${JSON.stringify(afterState)}`);
  }
}

export function assertProperly Scrolled(
  delta: number,
  minExpected: number,
  actualScroll: number,
  pageName: string
) {
  const tolerance = delta * 0.1; // 10% tolerance
  const minScroll = minExpected - tolerance;
  const maxScroll = minExpected + tolerance;

  if (actualScroll < minScroll || actualScroll > maxScroll) {
    throw Error(`[${pageName}] Scroll distance outside expected range
      Expected: ${minExpected}px ±${tolerance}px
      Actual:   ${actualScroll}px`);
  }
}
