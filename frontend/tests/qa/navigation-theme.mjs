// Run through ego-browser nodejs in the existing owned TaskSpace 29.
const fs = await import('node:fs/promises')
const assert = (await import('node:assert/strict')).default
const root = '/tmp/readflix-route-theme-qa'
const fixtures = JSON.parse(await fs.readFile(`${root}/fixtures.json`, 'utf8'))
const task = await taskSpace(29)
const page = task.page('p1')
const base = 'http://127.0.0.1:5173'
const report = []
async function record(name, data = {}) { report.push({ name, ...data }); await fs.writeFile(`${root}/qa-results.json`, JSON.stringify(report, null, 2)); console.log(`PASS ${name}`) }
async function theme(mode) {
  await page.evaluate(mode => localStorage.setItem('readflix.appearance', mode), mode)
  await page.reload()
  await page.waitForFunction(mode => document.documentElement.dataset.theme === mode, mode)
}
async function goto(path) { await page.goto(base + path) }
async function readyLibrary() { await page.waitForSelector('[aria-label="閱讀 山間的日常"]') }
async function frameReady() { await page.waitForFunction(() => !!document.querySelector('foliate-paginator')?.shadowRoot?.querySelector('iframe')?.contentDocument?.body?.innerText && !document.body.innerText.includes('正在翻開書頁')) }
async function metrics() {
  return page.evaluate(() => ({ width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, theme: document.documentElement.dataset.theme,
    smallControls: [...document.querySelectorAll('button, a.MuiButton-root, a.MuiChip-root')].filter(el => { const r=el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !el.closest('[aria-hidden="true"]') && (r.width < 43 || r.height < 43) }).map(el => ({name:el.getAttribute('aria-label') || el.textContent, width:el.getBoundingClientRect().width, height:el.getBoundingClientRect().height})),
    smallInputs: [...document.querySelectorAll('input:not([type="range"]):not([type="hidden"]),textarea')].filter(el => el.getBoundingClientRect().width && parseFloat(getComputedStyle(el).fontSize) < 16).length }))
}
const epub = fixtures.books[0].id, txt = fixtures.books[3].id, pdf = fixtures.books[6].id
await goto('/library'); await readyLibrary()
for (const mode of ['light','dark']) {
  await theme(mode)
  for (const width of [375,393,768,1024,1280,1440]) {
    await page.cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<600})
    await readyLibrary()
    const data = await metrics(); assert.equal(data.overflow,false); assert.equal(data.smallControls.length,0); assert.equal(data.smallInputs,0)
    await page.screenshot({path:`${root}/library-${mode}-${width}-final.png`})
    await record(`library ${mode} ${width}`, data)
  }
}
await page.cdp('Emulation.setDeviceMetricsOverride',{width:375,height:812,deviceScaleFactor:1,mobile:true})
await goto('/library?collection=' + encodeURIComponent('散文選集')); await readyLibrary()
assert.equal(await page.evaluate(() => document.querySelectorAll('[aria-label^="閱讀 "]').length),3)
await page.click('[aria-label="閱讀 山間的日常"]'); await frameReady()
const readingUrl = await page.url()
assert.match(readingUrl, /from=/)
const positionBefore = await page.evaluate(() => document.querySelector('foliate-paginator')?.getContents?.()[0]?.doc?.body?.textContent?.slice(0,50))
await page.evaluate(() => { window.__qaRenderer = document.querySelector('foliate-paginator') })
await page.click('[aria-label="閱讀設定"]'); await page.waitForURL('**panel=settings')
await page.evaluate(() => history.back()); await page.waitForFunction(() => !location.search.includes('panel='))
assert.equal(await page.evaluate(() => window.__qaRenderer === document.querySelector('foliate-paginator')),true)
await page.evaluate(() => history.forward()); await page.waitForURL('**panel=settings')
assert.equal(await page.evaluate(() => window.__qaRenderer === document.querySelector('foliate-paginator')),true)
await record('reader settings back/forward retains renderer', {positionBefore})
await page.reload(); await frameReady(); await page.waitForSelector('[aria-label="關閉閱讀設定"]')
await record('reader settings deep link reload')
await page.click('[aria-label="關閉閱讀設定"]')
await page.click('[aria-label="返回書庫"]'); await page.waitForURL('**/library?collection=*'); await readyLibrary()
await record('return to original collection')
for (const mode of ['light','dark']) {
  await theme(mode)
  for (const path of ['/settings','/upload','/readers/new',`/reader/${epub}?panel=settings`,`/reader/${epub}?panel=contents`,`/reader/${epub}?panel=bookmarks`]) {
    await goto(path)
    await page.waitForSelector('[role="dialog"]')
    if(path.startsWith('/reader/')) await frameReady()
    const data = await metrics(); assert.equal(data.overflow,false); assert.equal(data.smallControls.length,0); assert.equal(data.smallInputs,0)
    await page.screenshot({path:`${root}/panel-${mode}-${path.replace(/[^a-z]+/gi,'-')}.png`})
    await record(`${mode} deep link ${path}`,data)
  }
}
await goto(`/reader/${txt}`)
await page.waitForFunction(() => document.querySelector('.epub-reader-root')?.innerText.includes('本機合成測試資料'))
const txtPct = Number(await page.evaluate(() => document.querySelector('input[type="range"]')?.value))
assert.ok(txtPct>=34 && txtPct<=36)
await page.reload(); await page.waitForFunction(() => document.querySelector('.epub-reader-root')?.innerText.includes('本機合成測試資料'))
assert.ok(Number(await page.evaluate(() => document.querySelector('input[type="range"]')?.value))>=34)
await record('TXT current-reader progress restored on deep link and refresh', {txtPct})
await goto(`/reader/${pdf}`); await page.waitForSelector('.react-pdf__Page__canvas')
assert.equal(await page.evaluate(() => document.querySelector('.react-pdf__Page')?.getAttribute('data-page-number')),'2')
await page.screenshot({path:`${root}/pdf-dark-375.png`})
await page.reload(); await page.waitForSelector('.react-pdf__Page__canvas')
assert.equal(await page.evaluate(() => document.querySelector('.react-pdf__Page')?.getAttribute('data-page-number')),'2')
await record('PDF page 2 restored on deep link and refresh')
await goto(`/reader/${epub}`); await frameReady()
await page.click('[aria-label="加書籤"]'); await page.click('[aria-label="書籤列表"]'); await page.waitForFunction(() => !!document.querySelector('[role="dialog"]')?.textContent.includes('%'))
await record('synthetic EPUB bookmark add and routed list')
await goto('/reader/missing-book'); await page.waitForSelector('text=這本書暫時無法開啟'); await record('missing book has recovery')
await goto('/does-not-exist'); await page.waitForSelector('text=這一頁不在書架上'); await record('unknown route has recovery')
await goto('/library?view=saved'); await page.waitForSelector('[aria-label="閱讀 慢慢走過四季"]'); await page.reload(); await page.waitForSelector('[aria-label="閱讀 慢慢走過四季"]'); await record('saved filter direct link and refresh')
await goto('/settings'); await page.waitForSelector('[aria-label="畫面外觀"]'); await page.click('text="淺色"');
await page.reload(); await page.waitForSelector('[aria-label="關閉個人設定"]')
assert.equal(await page.evaluate(() => document.documentElement.dataset.theme),'light')
const serverSettings = await page.fetch(`/api/users/${fixtures.users[0].id}/settings`)
assert.equal(JSON.parse(serverSettings.body).theme,'dark')
await record('local light persists after refresh; server theme remains dark')
console.log(JSON.stringify({passed:report.length,report:`${root}/qa-results.json`}))
