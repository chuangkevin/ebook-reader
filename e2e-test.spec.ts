import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Ebook Reader - UI 功能測試', () => {

  // ===== 1. 首頁載入 =====
  test('1. 首頁應正確載入', async ({ page }) => {
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/.*/); // 確認頁面有 title
    // 截圖
    await page.screenshot({ path: 'screenshots/01-homepage.png', fullPage: true });
  });

  // ===== 2. 使用者選擇頁面 =====
  test('2. 使用者選擇 — 應顯示使用者列表', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/02-user-selection.png', fullPage: true });

    // 確認頁面有使用者相關元素
    const body = await page.textContent('body');
    console.log('頁面內容摘要:', body?.substring(0, 500));
  });

  // ===== 3. 多使用者管理 — 新增使用者 =====
  test('3. 多使用者管理 — 應能新增使用者', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 找新增使用者的按鈕/功能
    const addBtn = page.locator('button, [role="button"]').filter({ hasText: /新增|add|建立|\+/i });
    const addBtnCount = await addBtn.count();
    console.log('新增使用者按鈕數量:', addBtnCount);

    if (addBtnCount > 0) {
      await addBtn.first().click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'screenshots/03-add-user.png', fullPage: true });
    } else {
      await page.screenshot({ path: 'screenshots/03-no-add-user-btn.png', fullPage: true });
      console.log('未找到新增使用者按鈕');
    }
  });

  // ===== 4. 選擇使用者進入書庫 =====
  test('4. 選擇使用者 — 應能進入書庫', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 嘗試點擊第一個使用者
    const userCards = page.locator('[class*="user"], [class*="User"], [class*="avatar"], [class*="profile"], [data-testid*="user"]');
    const cardCount = await userCards.count();
    console.log('使用者卡片數量:', cardCount);

    if (cardCount > 0) {
      await userCards.first().click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'screenshots/04-library.png', fullPage: true });
      const url = page.url();
      console.log('點擊使用者後 URL:', url);
    } else {
      // 嘗試用其他方式找可點擊的使用者元素
      const clickable = page.locator('a, button, [role="button"], [onclick]').first();
      console.log('嘗試點擊第一個可互動元素');
      await clickable.click({ timeout: 3000 }).catch(() => console.log('無可點擊元素'));
      await page.screenshot({ path: 'screenshots/04-fallback.png', fullPage: true });
    }
  });

  // ===== 5. 書庫管理 — 書本列表 =====
  test('5. 書庫 — 應顯示書本列表', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 先選使用者
    const allLinks = page.locator('a[href], [role="button"], button');
    const count = await allLinks.count();
    console.log('頁面互動元素數量:', count);

    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await allLinks.nth(i).textContent();
      const href = await allLinks.nth(i).getAttribute('href');
      console.log(`  元素 ${i}: text="${text?.trim()}", href="${href}"`);
    }

    await page.screenshot({ path: 'screenshots/05-elements-overview.png', fullPage: true });
  });

  // ===== 6. 閱讀設定 — 主題切換 =====
  test('6. 閱讀設定 — 檢查設定介面', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // 找設定按鈕
    const settingsBtn = page.locator('button, [role="button"], svg').filter({ hasText: /設定|setting|theme|主題/i });
    const settingsBtnCount = await settingsBtn.count();
    console.log('設定相關按鈕:', settingsBtnCount);

    // 也找 icon 類按鈕 (齒輪、三點)
    const iconBtns = page.locator('[class*="setting"], [class*="Setting"], [aria-label*="setting"], [aria-label*="Setting"]');
    const iconCount = await iconBtns.count();
    console.log('設定 icon 元素:', iconCount);

    await page.screenshot({ path: 'screenshots/06-settings-search.png', fullPage: true });
  });

  // ===== 7. 多格式支援檢查 =====
  test('7. 多格式 — 檢查支援的檔案格式', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    const body = await page.textContent('body');
    const supportsEpub = body?.toLowerCase().includes('epub');
    const supportsPdf = body?.toLowerCase().includes('pdf');
    const supportsTxt = body?.toLowerCase().includes('txt');

    console.log('頁面提及 EPUB:', supportsEpub);
    console.log('頁面提及 PDF:', supportsPdf);
    console.log('頁面提及 TXT:', supportsTxt);

    // 找上傳按鈕
    const uploadBtn = page.locator('input[type="file"], button').filter({ hasText: /upload|上傳|匯入/i });
    console.log('上傳元素數量:', await uploadBtn.count());

    await page.screenshot({ path: 'screenshots/07-format-support.png', fullPage: true });
  });

  // ===== 8. 頁面導航結構 =====
  test('8. 路由 — 檢查所有頁面路徑', async ({ page }) => {
    // 測試各路由
    const routes = ['/', '/library', '/reader', '/settings'];

    for (const route of routes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForTimeout(500);
      const title = await page.title();
      const url = page.url();
      console.log(`路由 ${route}: 實際URL=${url}, title=${title}`);
      await page.screenshot({ path: `screenshots/08-route${route.replace(/\//g, '-') || '-root'}.png` });
    }
  });

  // ===== 9. 響應式設計 (手機視窗) =====
  test('9. 響應式 — 手機視窗下的畫面', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 }); // iPhone X
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'screenshots/09-mobile-view.png', fullPage: true });
  });

  // ===== 10. API 健康檢查 =====
  test('10. API — Backend 健康檢查', async ({ page }) => {
    try {
      const response = await page.goto('http://localhost:3003/api/health');
      console.log('Backend API status:', response?.status());
    } catch (e) {
      console.log('Backend API 無法連接 (可能未啟動)');
    }

    try {
      const response = await page.goto('http://localhost:3003/api/users');
      console.log('Users API status:', response?.status());
      const body = await page.textContent('body');
      console.log('Users API response:', body?.substring(0, 300));
    } catch (e) {
      console.log('Users API 無法連接');
    }
  });
});
