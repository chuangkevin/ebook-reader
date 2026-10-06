// Requires fresh synthetic fixtures and one owned ego-browser TaskSpace.
// Replace taskSpace(30) with the owned space ID; never rerun against live data.
const fs=await import('node:fs/promises'), assert=(await import('node:assert/strict')).default;
const root='/tmp/readflix-route-theme-qa', fixtures=JSON.parse(await fs.readFile(`${root}/fixtures.json`,'utf8'));
const task=await taskSpace(30),page=task.page('p1'),base='http://127.0.0.1:5173';
const results=[];
async function pass(name,data={}){results.push({name,...data});await fs.writeFile(`${root}/review-results.json`,JSON.stringify(results,null,2));console.log('PASS '+name)}
const user=fixtures.users[1].id,book=fixtures.books[2].id;
await page.goto(`${base}/`);
await page.waitForSelector('[aria-label="選擇讀者 另一位讀者"]');
await page.click('[aria-label="選擇讀者 另一位讀者"]');
const initialProgress=JSON.parse((await page.fetch(`/api/users/${user}/progress`)).body);
assert.ok(!initialProgress.some(item=>item.bookId===book),'Requires a fresh synthetic seed, never clear live progress');
await page.goto(`${base}/reader/${book}`);
await page.waitForFunction(()=>document.querySelector('foliate-paginator')?.getContents?.().length>0&&!document.body.innerText.includes('正在翻開書頁'));
await page.click('[aria-label="加書籤"]');
await page.waitForFunction(()=>document.body.innerText.includes('已加入書籤'));
const firstBookmarks=JSON.parse((await page.fetch(`/api/users/${user}/books/${book}/page-bookmarks`)).body);
assert.equal(firstBookmarks.length,1);assert.ok(firstBookmarks[0].position.startsWith('@@0@@'));
await pass('unopened EPUB first page can be bookmarked without turning a page',{bookmark:firstBookmarks[0]});
// A pending local EPUB position newer than the server must update visible progress and bookmark labels.
await page.goto(`${base}/library`);
await page.evaluate(({user,book})=>localStorage.setItem(`readflix.progress.${user}.${book}`,JSON.stringify({cfi:'@@1@@0.3@@2@@0.65',pending:true,updatedAt:Date.now()})),{user,book});
const recorder=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`window.__qaProgress=[];const originalFetch=window.fetch;window.fetch=(input,init)=>{if(String(input).endsWith('/progress')&&init?.method==='PUT')window.__qaProgress.push(JSON.parse(init.body));return originalFetch(input,init)}`});
await page.goto(`${base}/reader/${book}`);
await page.waitForFunction(()=>window.__qaProgress?.length>0);
const restored=await page.evaluate(()=>({percent:Number(document.querySelector('input[type="range"]').value),writes:window.__qaProgress}));
assert.ok(restored.percent>50);assert.ok(restored.writes.every(write=>write.cfi.startsWith('@@1@@')));
await page.click('[aria-label="加書籤"]');await page.waitForFunction(()=>document.body.innerText.includes('已加入書籤'));
const bookmarks=JSON.parse((await page.fetch(`/api/users/${user}/books/${book}/page-bookmarks`)).body);
assert.ok(bookmarks.some(mark=>mark.position.startsWith('@@1@@')&&mark.label===`${restored.percent}%`));
await pass('pending EPUB restores final percentage, bookmark label, and never writes initial chapter',restored);
await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:recorder.identifier});
for(const [path,selector] of [['/settings/','[aria-label="關閉個人設定"]'],['/upload/','text="選擇檔案"'],['/readers/new/','input']]){
 await page.goto(base+path);await page.waitForSelector('[role="dialog"]');await page.waitForSelector(selector);
 await page.reload();await page.waitForSelector('[role="dialog"]');await page.waitForSelector(selector);
 await pass(`trailing slash direct entry and refresh ${path}`);
}
await page.goto(`${base}/library/?collection=${encodeURIComponent('散文選集')}`);await page.waitForSelector('[aria-label="閱讀 山間的日常"]');
await page.click('[aria-label="閱讀 山間的日常"]');await page.waitForSelector('[aria-label="返回書庫"]');await page.click('[aria-label="返回書庫"]');
assert.match(await page.url(),/library\/?\?collection=/);await pass('trailing slash library retains collection return URL');
await page.goto(`${base}/library`);await page.waitForSelector('[aria-label="閱讀 山間的日常"]');
console.log(await page.snapshot());

const paths=[];for(let i=1;i<=4;i++){const file=`${root}/review-upload-${i}.txt`;await fs.writeFile(file,`合成上傳測試 ${i}。僅本機 QA 使用。`);paths.push(file)}
await page.evaluate(()=>{const send=XMLHttpRequest.prototype.send;window.__qaUploadRequests=[];window.__qaUploadPending=[];XMLHttpRequest.prototype.send=function(body){if(body instanceof FormData&&body.has('file')){window.__qaUploadRequests.push(body.get('file').name);window.__qaUploadPending.push(()=>send.call(this,body));return}return send.call(this,body)}});
await page.click('loc=href:/upload?returnTo=%2Flibrary');await page.waitForSelector('text="選擇檔案"');
const chooserPromise=page.waitForFileChooser({timeout:10000});await page.click('text="選擇檔案"');const chooser=await chooserPromise;await chooser.setFiles(paths);
await page.waitForFunction(()=>window.__qaUploadRequests.length===3);
await page.evaluate(()=>history.go(-2));await page.waitForURL('**/library');
await page.evaluate(()=>history.go(2));await page.waitForURL('**/upload?returnTo=*');
await page.waitForFunction(()=>document.body.innerText.includes('上傳中 (0/4)'));
assert.equal(await page.evaluate(()=>window.__qaUploadRequests.length),3);
await page.evaluate(()=>window.__qaUploadPending.splice(0).forEach(send=>send()));
await page.waitForFunction(()=>window.__qaUploadRequests.length===4);
await page.evaluate(()=>history.go(-2));await page.waitForURL('**/library');
await page.click('[aria-label="個人設定"]');await page.waitForSelector('[aria-label="關閉個人設定"]');
await page.evaluate(()=>window.__qaUploadPending.splice(0).forEach(send=>send()));
await page.waitForFunction(()=>document.body.innerText.includes('完成 4 本'));
const sent=await page.evaluate(()=>window.__qaUploadRequests);
assert.equal(sent.length,4);assert.equal(new Set(sent).size,4);assert.match(await page.url(),/settings/);
results.push({name:'stalled four-file upload survives back/forward without resubmission; completion preserves current settings route',sent});
await page.waitForFunction(()=>!document.body.innerText.includes('完成 4 本'));
assert.match(await page.url(),/settings/);
results.push({name:'upload completion toast dismissal does not navigate away from another route'});
await fs.writeFile(`${root}/review-results.json`,JSON.stringify(results,null,2));
console.log('PASS upload history and background completion, exactly four requests');
console.log(await page.snapshot());
