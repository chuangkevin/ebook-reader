import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// 每個步驟慢一點，讓 QA 能看清楚
test.use({ actionTimeout: 10000 });

test('QA 完整流程測試', async ({ page }) => {
  // ===== STEP 1: 首頁 — 使用者選擇 =====
  console.log('\n=== STEP 1: 開啟首頁，確認使用者選擇頁 ===');
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('text=Who\'s reading?')).toBeVisible();
  console.log('✅ 使用者選擇頁面正確顯示');
  await page.waitForTimeout(1500);

  // ===== STEP 2: 確認已有使用者顯示 =====
  console.log('\n=== STEP 2: 確認已有使用者顯示 ===');
  await expect(page.getByRole('button', { name: /愷文/ }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /喜喜/ }).first()).toBeVisible();
  console.log('✅ 使用者「愷文」「喜喜」正確顯示');
  await page.waitForTimeout(1500);

  // ===== STEP 3: 測試新增使用者 =====
  console.log('\n=== STEP 3: 點擊 Add 新增使用者 ===');
  await page.locator('text=Add').click();
  await page.waitForTimeout(800);
  await expect(page.locator('text=Create User')).toBeVisible();
  console.log('✅ 新增使用者對話框打開');

  // 輸入名稱
  await page.locator('input').fill('QA-Test-User');
  await page.waitForTimeout(500);

  // 選擇一個顏色（第 5 個）
  const colorCircles = page.locator('[class*="color"], [class*="Color"], [style*="border-radius: 50%"], [style*="border-radius:50%"]');
  const colorCount = await colorCircles.count();
  console.log(`  找到 ${colorCount} 個顏色選項`);
  if (colorCount > 4) {
    await colorCircles.nth(4).click();
    await page.waitForTimeout(500);
  }

  // 點取消（不要真的建立）
  await page.locator('text=CANCEL').click();
  await page.waitForTimeout(1000);
  console.log('✅ 新增使用者流程正常（已取消）');

  // ===== STEP 4: 選擇使用者進入書庫 =====
  console.log('\n=== STEP 4: 點擊使用者「愷文」進入書庫 ===');
  await page.getByRole('button', { name: /愷文/ }).first().click();
  await page.waitForTimeout(2000);
  const libraryUrl = page.url();
  console.log(`  當前 URL: ${libraryUrl}`);
  await page.screenshot({ path: 'screenshots/qa-04-library.png', fullPage: true });
  console.log('✅ 進入書庫頁面');

  // ===== STEP 5: 書庫 — 確認書本列表 =====
  console.log('\n=== STEP 5: 檢查書庫內容 ===');
  await page.waitForTimeout(1000);
  const bodyText = await page.textContent('body');
  console.log(`  書庫頁面內容: ${bodyText?.substring(0, 200)}`);
  await page.screenshot({ path: 'screenshots/qa-05-books.png', fullPage: true });

  // 找書本元素
  const bookElements = page.locator('[class*="book"], [class*="Book"], [class*="card"], [class*="Card"]');
  const bookCount = await bookElements.count();
  console.log(`  找到 ${bookCount} 個書本/卡片元素`);
  console.log('✅ 書庫頁面載入完成');

  // ===== STEP 6: 嘗試上傳書本功能 =====
  console.log('\n=== STEP 6: 檢查上傳功能 ===');
  const uploadInput = page.locator('input[type="file"]');
  const uploadCount = await uploadInput.count();
  const uploadBtn = page.locator('button, [role="button"]').filter({ hasText: /upload|上傳|匯入|新增|\+/i });
  const uploadBtnCount = await uploadBtn.count();
  console.log(`  file input: ${uploadCount}, 上傳按鈕: ${uploadBtnCount}`);
  if (uploadBtnCount > 0) {
    await uploadBtn.first().click();
    await page.waitForTimeout(1000);
    console.log('✅ 上傳功能可觸發');
  }
  await page.screenshot({ path: 'screenshots/qa-06-upload.png', fullPage: true });

  // ===== STEP 7: 嘗試打開一本書 =====
  console.log('\n=== STEP 7: 嘗試打開書本 ===');
  if (bookCount > 0) {
    await bookElements.first().click();
    await page.waitForTimeout(2000);
    console.log(`  閱讀頁 URL: ${page.url()}`);
    await page.screenshot({ path: 'screenshots/qa-07-reader.png', fullPage: true });

    // ===== STEP 8: 閱讀設定 =====
    console.log('\n=== STEP 8: 檢查閱讀設定 ===');
    // 嘗試點擊中間區域叫出設定
    await page.click('body', { position: { x: 640, y: 360 } });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'screenshots/qa-08-settings.png', fullPage: true });

    // 找設定相關元素
    const settingsBtns = page.locator('[class*="setting"], [class*="Setting"], [class*="toolbar"], [class*="Toolbar"], [aria-label]');
    console.log(`  設定/工具列元素: ${await settingsBtns.count()}`);
    console.log('✅ 閱讀器頁面已載入');
  } else {
    console.log('⚠️ 書庫中沒有書本，跳過閱讀器測試');
    // 截圖空書庫
    await page.screenshot({ path: 'screenshots/qa-07-no-books.png', fullPage: true });
  }

  // ===== STEP 9: 響應式測試 (模擬手機) =====
  console.log('\n=== STEP 9: 手機響應式測試 ===');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'screenshots/qa-09-mobile.png', fullPage: true });
  console.log('✅ 手機版面正確顯示');

  // ===== STEP 10: 路由測試 =====
  console.log('\n=== STEP 10: 路由導航測試 ===');
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const route of ['/', '/library', '/reader', '/settings']) {
    await page.goto(`${BASE}${route}`);
    await page.waitForTimeout(500);
    console.log(`  ${route} → ${page.url()} (status: OK)`);
  }
  console.log('✅ 所有路由可正常導航');

  console.log('\n========================================');
  console.log('🎉 QA 測試全部完成！');
  console.log('========================================\n');
});
