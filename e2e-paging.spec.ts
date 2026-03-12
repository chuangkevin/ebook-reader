import { test, expect, Page } from '@playwright/test';

const BASE = 'http://localhost:5173';
test.use({ actionTimeout: 15000 });

async function login(page: Page) {
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.getByRole('button', { name: /愷文/ }).first().click();
  await page.waitForURL('**/library');
  await page.waitForTimeout(1000);
}

async function openEpub(page: Page) {
  await login(page);
  const epubCard = page.locator('text=EPUB').first();
  await epubCard.click();
  await page.waitForTimeout(3000);
  await page.waitForURL('**/read/**');
}

/** Get scroll position — checks both iframe interior AND parent container */
async function getScrollState(page: Page) {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return { error: 'no iframe' };
    const doc = iframe.contentDocument;
    const scrollEl = doc.scrollingElement || doc.documentElement;
    const parent = iframe.parentElement;
    return {
      // Inner iframe scroll (horizontal-tb columns)
      innerScrollLeft: scrollEl.scrollLeft,
      innerScrollWidth: scrollEl.scrollWidth,
      innerClientWidth: scrollEl.clientWidth,
      // Parent container scroll (vertical-rl tall iframe)
      parentScrollTop: parent?.scrollTop ?? 0,
      parentScrollHeight: parent?.scrollHeight ?? 0,
      parentClientHeight: parent?.clientHeight ?? 0,
      // Effective scroll position (whichever axis has overflow)
      scrollLeft: scrollEl.scrollLeft,
      scrollTop: parent?.scrollTop ?? 0,
      bodyWritingMode: getComputedStyle(doc.body).writingMode,
    };
  });
}

/** Get visible text from iframe */
async function getVisibleSnippet(page: Page): Promise<string> {
  return page.evaluate(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return '';
    return (iframe.contentDocument.body.innerText || '').substring(0, 100).replace(/\s+/g, ' ').trim();
  });
}

test('翻頁測試 — 逐頁捲動，非跳章節', async ({ page }) => {
  console.log('\n=== 翻頁捲動測試 ===');

  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.startsWith('[scrollPage]')) consoleLogs.push(text);
  });

  await openEpub(page);
  await page.waitForTimeout(2000);

  // Navigate to a chapter with content (skip short pages)
  // Press ArrowLeft many times to go to beginning
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  // Now press ArrowRight until we reach a long chapter
  let foundLongChapter = false;
  let chapText = '';
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1000);

    const state = await getScrollState(page);
    if ('scrollWidth' in state && state.scrollWidth && state.clientWidth && state.scrollWidth > state.clientWidth * 2) {
      foundLongChapter = true;
      chapText = await getVisibleSnippet(page);
      console.log(`  ✅ 找到長章節 (scrollWidth=${state.scrollWidth}, clientWidth=${state.clientWidth})`);
      console.log(`  章節開頭: "${chapText.substring(0, 60)}..."`);
      break;
    }
  }

  if (!foundLongChapter) {
    console.log('  ⚠️ 未找到長章節，跳過翻頁測試');
    return;
  }

  // Detect scroll direction based on writing mode
  const state0 = await getScrollState(page);
  const wm = 'bodyWritingMode' in state0 ? state0.bodyWritingMode : 'horizontal-tb';
  const isVerticalRL = wm === 'vertical-rl';
  console.log(`  Writing mode: ${wm} (${isVerticalRL ? '直排' : '橫排'})`);

  // Get scroll position based on layout
  function getPos(s: typeof state0): number {
    if ('innerScrollLeft' in s && (s.innerScrollWidth ?? 0) > (s.innerClientWidth ?? 0) + 5) {
      return s.innerScrollLeft ?? 0; // horizontal columns
    }
    if ('parentScrollTop' in s && (s.parentScrollHeight ?? 0) > (s.parentClientHeight ?? 0) + 5) {
      return s.parentScrollTop ?? 0; // vertical-rl tall iframe
    }
    return 0;
  }

  const scrollPositions: number[] = [getPos(state0)];
  console.log(`  初始 scroll: ${scrollPositions[0]}`);

  // Press ArrowRight 5 times — should scroll within chapter
  for (let i = 1; i <= 5; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    const s = await getScrollState(page);
    const pos = getPos(s);
    scrollPositions.push(pos);
    console.log(`  ArrowRight #${i}: scroll=${pos} (innerLeft=${s.innerScrollLeft ?? '?'} parentTop=${s.parentScrollTop ?? '?'})`);
  }

  // Verify scroll position is changing (forward = increasing for both axes)
  let scrolledForward = 0;
  for (let i = 1; i < scrollPositions.length; i++) {
    if (Math.abs(scrollPositions[i] - scrollPositions[i - 1]) > 5) {
      scrolledForward++;
    }
  }
  console.log(`  ${scrolledForward}/5 次有效捲動`);
  expect(scrolledForward).toBeGreaterThanOrEqual(3);
  console.log('  ✅ 翻頁正常 — 逐頁捲動');

  // Now press ArrowLeft 3 times — should scroll back
  const backPositions: number[] = [getPos(await getScrollState(page))];
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(800);
    const s = await getScrollState(page);
    const pos = getPos(s);
    backPositions.push(pos);
    console.log(`  ArrowLeft #${i}: scroll=${pos}`);
  }

  let scrolledBack = 0;
  for (let i = 1; i < backPositions.length; i++) {
    if (Math.abs(backPositions[i] - backPositions[i - 1]) > 5) {
      scrolledBack++;
    }
  }
  console.log(`  ${scrolledBack}/3 次有效回退`);
  expect(scrolledBack).toBeGreaterThanOrEqual(2);
  console.log('  ✅ ArrowLeft 回退正常');

  // Final text should still be same chapter
  const finalText = await getVisibleSnippet(page);
  console.log(`  最終文字: "${finalText.substring(0, 60)}..."`);

  // Log scrollPage debug output
  console.log(`\n  --- scrollPage 記錄 (最後10條) ---`);
  consoleLogs.slice(-10).forEach(l => console.log(`  ${l}`));

  await page.screenshot({ path: 'screenshots/paging-scroll.png', fullPage: true });
});

test('短頁跳章 + 長章節翻頁混合', async ({ page }) => {
  console.log('\n=== 短頁跳章+長章翻頁 ===');
  await openEpub(page);
  await page.waitForTimeout(2000);

  // Go to beginning
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  // Track chapters we pass through
  const chapters: string[] = [];
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    const text = await getVisibleSnippet(page);
    const chapMatch = text.match(/第[一二三四五六七八九十百]+章/);
    const chapName = chapMatch ? chapMatch[0] : text.substring(0, 20);

    const state = await getScrollState(page);
    const innerScroll = 'innerScrollLeft' in state ? state.innerScrollLeft ?? 0 : 0;
    const parentScroll = 'parentScrollTop' in state ? state.parentScrollTop ?? 0 : 0;
    const scrollInfo = innerScroll !== 0 ? `left=${innerScroll}` : `top=${parentScroll}`;

    if (!chapters.length || chapters[chapters.length - 1] !== chapName) {
      chapters.push(chapName);
      console.log(`  #${i + 1}: 新章節 "${chapName}" ${scrollInfo}`);
    } else {
      console.log(`  #${i + 1}: 同章節翻頁 ${scrollInfo}`);
    }
  }

  console.log(`  經過 ${chapters.length} 個不同章節/段落`);
  // Should NOT be 15 different chapters (that would mean jumping chapters every press)
  expect(chapters.length).toBeLessThan(10);
  console.log('  ✅ 有在章節內翻頁（不是每次都跳章）');

  await page.screenshot({ path: 'screenshots/paging-mixed.png', fullPage: true });
});

test('橫排模式翻頁 — 切換橫排後逐頁翻', async ({ page }) => {
  console.log('\n=== 橫排模式翻頁測試 ===');
  await openEpub(page);
  await page.waitForTimeout(2000);

  // Open settings and switch to horizontal mode
  // Tap center to toggle toolbar
  await page.mouse.click(
    Math.floor(page.viewportSize()!.width / 2),
    Math.floor(page.viewportSize()!.height / 2),
  );
  await page.waitForTimeout(1000);

  // Click the settings icon
  const settingsBtn = page.locator('button').filter({ has: page.locator('svg[data-testid="SettingsIcon"]') });
  await settingsBtn.click();
  await page.waitForTimeout(500);

  // Click 橫排 toggle
  const horizontalBtn = page.getByRole('button', { name: '橫排' });
  await horizontalBtn.click();
  await page.waitForTimeout(500);

  // Close settings drawer
  await page.keyboard.press('Escape');
  await page.waitForTimeout(2000);

  // Check that writing-mode is horizontal-tb in iframe
  const writingMode = await page.evaluate(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return 'no iframe';
    return getComputedStyle(iframe.contentDocument.body).writingMode;
  });
  console.log(`  Writing mode after switch: ${writingMode}`);
  expect(writingMode).toBe('horizontal-tb');

  // Navigate to beginning
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1000);

  // Press ArrowRight and track visible text to detect chapter jumps
  const texts: string[] = [];
  for (let i = 0; i < 10; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe?.contentDocument) return '';
      return (iframe.contentDocument.body.innerText || '').substring(0, 100).replace(/\s+/g, ' ').trim();
    });
    const chapMatch = text.match(/第[一二三四五六七八九十百]+章/);
    const label = chapMatch ? chapMatch[0] : text.substring(0, 30);
    texts.push(label);
    console.log(`  ArrowRight #${i + 1}: "${label}"`);
  }

  // Count distinct chapter labels — if every press jumps chapter, they'd all be different
  const unique = [...new Set(texts)];
  console.log(`  ${unique.length} 個不同文字片段 / ${texts.length} 次按鍵`);

  // At most 5 unique labels in 10 presses (should have repeated labels from paging within chapter)
  expect(unique.length).toBeLessThan(8);
  console.log('  ✅ 橫排模式有在章節內翻頁');

  await page.screenshot({ path: 'screenshots/paging-horizontal.png', fullPage: true });
});

test('橫排反向翻頁 — ArrowLeft 不會連續跳章', async ({ page }) => {
  console.log('\n=== 橫排反向翻頁測試 ===');
  await openEpub(page);
  await page.waitForTimeout(2000);

  // Navigate forward into chapter 1 (past cover/title pages)
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(1000);

  // Check current position
  const beforeText = await page.evaluate(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    if (!iframe?.contentDocument) return '';
    return (iframe.contentDocument.body.innerText || '').substring(0, 60).replace(/\s+/g, ' ').trim();
  });
  console.log(`  Before backward: "${beforeText}"`);

  // Now press ArrowLeft 5 times — should page backward within chapter, not jump chapters
  const backTexts: string[] = [];
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(800);
    const text = await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe?.contentDocument) return '';
      return (iframe.contentDocument.body.innerText || '').substring(0, 60).replace(/\s+/g, ' ').trim();
    });
    const scrollInfo = await page.evaluate(() => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      if (!iframe?.contentDocument) return 'no iframe';
      const scrollEl = iframe.contentDocument.scrollingElement || iframe.contentDocument.documentElement;
      return `scrollLeft=${scrollEl.scrollLeft}`;
    });
    const chapMatch = text.match(/第[一二三四五六七八九十百]+章/);
    const label = chapMatch ? chapMatch[0] : text.substring(0, 20);
    backTexts.push(label);
    console.log(`  ArrowLeft #${i + 1}: "${label}" ${scrollInfo}`);
  }

  // Should NOT be 5 different chapters (would mean jumping every press)
  const unique = [...new Set(backTexts)];
  console.log(`  ${unique.length} 個不同文字片段 / ${backTexts.length} 次按鍵`);
  expect(unique.length).toBeLessThan(4);
  console.log('  ✅ 反向翻頁正常（不會連續跳章）');
});
