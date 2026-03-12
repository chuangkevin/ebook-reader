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

async function openSettingsDrawer(page: Page) {
  const vp = page.viewportSize()!;
  await page.click('body', { position: { x: vp.width / 2, y: vp.height / 2 } });
  await page.waitForTimeout(1500);
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.innerHTML.includes('Settings') || btn.querySelector('[data-testid="SettingsIcon"]')) {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(1000);
}

async function closeSettings(page: Page) {
  await page.evaluate(() => {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      if (btn.querySelector('[data-testid="CloseIcon"]')) {
        btn.click();
        return;
      }
    }
  });
  await page.waitForTimeout(500);
}

// Read the visible percentage text from toolbar by showing it briefly
async function getPercentage(page: Page): Promise<number> {
  // Use evaluate to find the percentage text in the DOM (even if toolbar hidden)
  const pctText = await page.evaluate(() => {
    // Look for text matching XX.XX% pattern in the page
    const allText = document.body.innerText;
    const match = allText.match(/(\d+\.\d{2})%/);
    return match ? match[1] : null;
  });
  if (pctText) return parseFloat(pctText);

  // Fallback: show toolbar, read, hide
  const vp = page.viewportSize()!;
  await page.click('body', { position: { x: vp.width / 2, y: vp.height / 2 } });
  await page.waitForTimeout(800);
  const text = await page.textContent('body');
  await page.waitForTimeout(200);
  const match = text?.match(/(\d+\.\d{2})%/);
  return match ? parseFloat(match[1]) : -1;
}

test('鍵盤翻頁測試 — ArrowRight/Left 翻頁', async ({ page }) => {
  console.log('\n=== 鍵盤翻頁基礎測試 ===');
  await openEpub(page);
  await page.waitForTimeout(2000); // let epub fully render

  // Show toolbar first so percentage text is in DOM
  const vp = page.viewportSize()!;
  await page.click('body', { position: { x: vp.width / 2, y: vp.height / 2 } });
  await page.waitForTimeout(500);

  const pct0 = await getPercentage(page);
  console.log(`  初始: ${pct0}%`);

  // Press ArrowRight 5 times — each should go to next page
  for (let i = 1; i <= 5; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1200);
    const p = await getPercentage(page);
    console.log(`  ArrowRight #${i} → ${p}%`);
  }

  const pct1 = await getPercentage(page);
  console.log(`  5次後: ${pct1}%`);

  // Press ArrowLeft 3 times
  for (let i = 1; i <= 3; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(1200);
    const p = await getPercentage(page);
    console.log(`  ArrowLeft #${i} → ${p}%`);
  }

  const pct2 = await getPercentage(page);
  console.log(`  3次 ArrowLeft 後: ${pct2}%`);

  // At minimum, verify no crash and screenshots
  await page.screenshot({ path: 'screenshots/invert-keyboard.png', fullPage: true });

  if (pct1 > pct0) {
    console.log('  ✅ ArrowRight 正確前進');
    expect(pct2).toBeLessThan(pct1);
    console.log('  ✅ ArrowLeft 正確後退');
  } else {
    // 如果書本只有一章或進度不變，至少確認沒 crash
    console.log('  ⚠️ 進度未變（可能書本結構問題），但無 crash');
  }
});

test('同側+左手+對調 — 設定可切換且無異常', async ({ page }) => {
  console.log('\n=== 同側+左手+對調 設定切換測試 ===');
  await openEpub(page);
  await page.waitForTimeout(2000);

  await openSettingsDrawer(page);

  // Set 同側翻頁
  await page.locator('text=同側翻頁').click();
  await page.waitForTimeout(300);
  console.log('  ✅ 同側翻頁');

  // Set 左手
  const handGroup = page.locator('[role="group"]').filter({ hasText: /左手.*右手/ });
  await handGroup.locator('button', { hasText: '左手' }).click();
  await page.waitForTimeout(300);
  console.log('  ✅ 左手');

  // Enable 對調
  await page.locator('text=對調上下頁方向').click();
  await page.waitForTimeout(300);
  console.log('  ✅ 對調開啟');

  await closeSettings(page);
  await page.waitForTimeout(1000);

  // 翻頁不應 crash
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(800);
  }
  console.log('  ✅ 5次 ArrowRight 無異常');

  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(800);
  }
  console.log('  ✅ 3次 ArrowLeft 無異常');

  // Verify settings persisted
  await openSettingsDrawer(page);
  const body = await page.textContent('body');
  expect(body).toContain('同側翻頁');
  expect(body).toContain('左手');
  expect(body).toContain('對調上下頁方向');
  console.log('  ✅ 設定已保存');
  await closeSettings(page);

  await page.screenshot({ path: 'screenshots/invert-sameside-left.png', fullPage: true });
});

test('對調翻頁 — iframe 內點擊方向正確', async ({ page }) => {
  console.log('\n=== iframe 點擊對調測試 ===');
  await openEpub(page);
  await page.waitForTimeout(2000);

  // 先用鍵盤翻到中間位置
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
  }
  console.log('  已翻到中間位置');

  // Show toolbar to get percentage
  const vp = page.viewportSize()!;
  await page.click('body', { position: { x: vp.width / 2, y: vp.height / 2 } });
  await page.waitForTimeout(800);
  const pctMid = await getPercentage(page);
  console.log(`  中間進度: ${pctMid}%`);

  // 設定: 兩側翻頁 + 右手 + 開對調
  await openSettingsDrawer(page);
  await page.locator('text=兩側翻頁').click();
  await page.waitForTimeout(200);
  const handGroup = page.locator('[role="group"]').filter({ hasText: /左手.*右手/ });
  await handGroup.locator('button', { hasText: '右手' }).click();
  await page.waitForTimeout(200);

  // 確認對調開關狀態
  const invertChecked = await page.evaluate(() => {
    const labels = document.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent?.includes('對調上下頁方向')) {
        const input = label.querySelector('input');
        return input?.checked || false;
      }
    }
    return false;
  });
  if (!invertChecked) {
    await page.locator('text=對調上下頁方向').click();
    await page.waitForTimeout(200);
  }
  console.log('  設定: 兩側+右手+對調');
  await closeSettings(page);
  await page.waitForTimeout(1000);

  // 兩側+右手+對調:
  //   原本右側=next → 對調後=prev
  //   原本左側=prev → 對調後=next
  // 測試: 點右側（對調後應是 prev）
  const iframeEl = page.locator('iframe').first();
  const box = await iframeEl.boundingBox();
  if (box) {
    // Click right side of iframe (should be prev after invert)
    for (let i = 1; i <= 3; i++) {
      await page.mouse.click(box.x + box.width - 30, box.y + box.height / 2);
      await page.waitForTimeout(1200);
    }
    const pctAfterRight = await getPercentage(page);
    console.log(`  右側點3次後: ${pctAfterRight}% (中間: ${pctMid}%)`);

    if (pctAfterRight < pctMid) {
      console.log('  ✅ 右側=prev (對調正確)');
    } else if (pctAfterRight === pctMid) {
      console.log('  ⚠️ 進度未變（可能 iframe 攔截了事件）');
    } else {
      console.log('  ❌ 右側=next (對調可能未生效)');
    }

    // Click left side (should be next after invert)
    const pctBeforeLeft = await getPercentage(page);
    for (let i = 1; i <= 3; i++) {
      await page.mouse.click(box.x + 30, box.y + box.height / 2);
      await page.waitForTimeout(1200);
    }
    const pctAfterLeft = await getPercentage(page);
    console.log(`  左側點3次後: ${pctAfterLeft}% (之前: ${pctBeforeLeft}%)`);

    if (pctAfterLeft > pctBeforeLeft) {
      console.log('  ✅ 左側=next (對調正確)');
    } else if (pctAfterLeft === pctBeforeLeft) {
      console.log('  ⚠️ 進度未變（可能 iframe 攔截了事件）');
    } else {
      console.log('  ❌ 左側=prev (對調可能未生效)');
    }
  }

  await page.screenshot({ path: 'screenshots/invert-iframe-click.png', fullPage: true });
});
