import { Page, expect } from '@playwright/test';

/**
 * Test Helper Functions for ebook-reader testing
 * Provides utilities for debugging, assertion, and common operations
 */

export class ReaderTestHelper {
  constructor(private page: Page) {}

  /**
   * 獲取實時診斷信息（來自調試疊層）
   * Returns debug overlay information displayed during page turns
   */
  async getDebugInfo() {
    const overlay = await this.page.locator('#__debug_overlay').textContent();
    if (!overlay) {
      throw new Error('Debug overlay not found. Ensure debug mode is enabled.');
    }
    try {
      return JSON.parse(overlay);
    } catch (e) {
      throw new Error(`Failed to parse debug info: ${overlay}`);
    }
  }

  /**
   * 驗證水平滾動狀態
   * Validates horizontal scroll state for chapter-jumping detection
   *
   * Key metrics for detecting flex-shrink issue:
   * - maxScroll should be > 0 (if === 0, flex compression detected)
   * - willJump indicates if next page turn will jump chapter
   */
  async validateHorizontalScrollState() {
    const debug = await this.getDebugInfo();
    const state = {
      scrollLeft: debug.scrollLeft,
      maxScroll: debug.maxScroll,
      scrollWidth: debug.scrollW,
      offsetWidth: debug.offsetW,
      willJump: debug.willJump,
      direction: debug.dir,
      flexShrink: debug.flexShrink,
      childWidth: debug.childW,
    };
    return state;
  }

  /**
   * 驗證直排滾動狀態
   * Validates vertical scroll state
   */
  async validateVerticalScrollState() {
    const debug = await this.getDebugInfo();
    const state = {
      scrollTop: debug.scrollTop,
      scrollHeight: debug.scrollHeight,
      offsetHeight: debug.offsetHeight,
      maxTop: debug.maxTop,
      willJump: debug.willJump,
      delta: debug.delta,
    };
    return state;
  }

  /**
   * 取得容器尺寸信息
   */
  async getContainerDimensions() {
    const dims = await this.page.evaluate(() => {
      const container = document.querySelector('[data-epub-container]');
      if (!container) throw new Error('EPUB container not found');

      const firstChild = container.firstElementChild as HTMLElement;
      return {
        containerScrollWidth: (container as HTMLElement).scrollWidth,
        containerOffsetWidth: (container as HTMLElement).offsetWidth,
        containerScrollHeight: (container as HTMLElement).scrollHeight,
        containerOffsetHeight: (container as HTMLElement).offsetHeight,
        firstChildWidth: firstChild?.offsetWidth,
        firstChildMinWidth: firstChild?.style.minWidth,
        firstChildFlexShrink: firstChild?.style.flexShrink,
        containerDirection: getComputedStyle(container).direction,
      };
    });
    return dims;
  }

  /**
   * 執行翻頁並驗證結果
   * Performs page turn and validates resulting state
   */
  async turnPageAndValidate(direction: 'next' | 'prev', expectJump: boolean = false) {
    const beforeDims = await this.getContainerDimensions();
    const beforeScroll = await this.page.evaluate(() => {
      const c = document.querySelector('[data-epub-container]');
      return (c as HTMLElement)?.scrollLeft ?? (c as HTMLElement)?.scrollTop;
    });

    // Click next/prev button
    if (direction === 'next') {
      await this.page.locator('button:has-text("Next")').click();
    } else {
      await this.page.locator('button:has-text("Prev")').click();
    }

    // Wait for scroll/render
    await this.page.waitForTimeout(500);

    const afterScroll = await this.page.evaluate(() => {
      const c = document.querySelector('[data-epub-container]');
      return (c as HTMLElement)?.scrollLeft ?? (c as HTMLElement)?.scrollTop;
    });

    const debug = await this.getDebugInfo();

    return {
      beforeScroll,
      afterScroll,
      scrollDelta: Math.abs(afterScroll - beforeScroll),
      jumped: debug.willJump,
      containerDims: {
        before: beforeDims,
        after: await this.getContainerDimensions(),
      },
      debug,
    };
  }

  /**
   * 在特定位置截圖
   */
  async takeDebugScreenshot(name: string) {
    await this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: false
    });
  }

  /**
   * 驗證 Flex 壓縮問題
   * Detects if flex container is compressing child elements
   * Flex compression: container.scrollWidth === container.offsetWidth
   */
  async detectFlexCompression() {
    const dims = await this.getContainerDimensions();
    const isCompressed = dims.containerScrollWidth === dims.containerOffsetWidth;
    return {
      isCompressed,
      scrollWidth: dims.containerScrollWidth,
      offsetWidth: dims.containerOffsetWidth,
      childMinWidth: dims.firstChildMinWidth,
      expectedMinWidth: dims.firstChildWidth,
    };
  }

  /**
   * 驗證 RTL 方向問題
   */
  async detectRTLIssue() {
    const dims = await this.getContainerDimensions();
    const hasRTLMismatch = dims.containerDirection === 'rtl';
    return {
      hasRTLMismatch,
      direction: dims.containerDirection,
    };
  }

  /**
   * 連續翻頁測試（用於檢測"每翻一次就跳章"的問題）
   */
  async sequentialPageTurns(
    count: number,
    direction: 'next' | 'prev' = 'next'
  ) {
    const results = [];
    for (let i = 0; i < count; i++) {
      const result = await this.turnPageAndValidate(direction);
      results.push({
        turn: i + 1,
        ...result,
      });

      // Add delay between turns
      await this.page.waitForTimeout(300);
    }
    return results;
  }

  /**
   * 檢測是否存在"翻一頁等於翻一章"的現象
   * Returns true if every page turn results in chapter jump
   */
  async detectPerpetualChapterJump() {
    const results = await this.sequentialPageTurns(5, 'next');
    const jumpCount = results.filter(r => r.jumped).length;
    return {
      totalTurns: results.length,
      jumpCount,
      allJumped: jumpCount === results.length,
      results,
    };
  }

  /**
   * 等待並驗證元素出現
   */
  async waitForElement(selector: string, timeout = 5000) {
    return this.page.waitForSelector(selector, { timeout });
  }

  /**
   * 導出詳細的測試報告
   */
  async exportDiagnosticReport(testName: string) {
    const flexCompression = await this.detectFlexCompression();
    const rtlIssue = await this.detectRTLIssue();
    const containerDims = await this.getContainerDimensions();
    const debugInfo = await this.getDebugInfo();

    const report = {
      timestamp: new Date().toISOString(),
      testName,
      diagnostics: {
        flexCompression,
        rtlIssue,
        containerDimensions: containerDims,
        debugInfo,
      },
      url: this.page.url(),
    };

    console.log('=== DIAGNOSTIC REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
}
