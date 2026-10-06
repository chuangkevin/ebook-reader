const fs=await import('node:fs/promises'), assert=(await import('node:assert/strict')).default
const task=await taskSpace(29), page=task.page('p2'), base='http://127.0.0.1:5173', root='/tmp/readflix-route-theme-qa'
const results=[]
for(const mode of ['light','dark']) {
  await page.goto(`${base}/library`)
  await page.waitForSelector('[aria-label="閱讀 山間的日常"]')
  await page.evaluate(mode=>localStorage.setItem('readflix.appearance',mode),mode)
  await page.cdp('Emulation.setDeviceMetricsOverride',{width:393,height:852,deviceScaleFactor:1,mobile:true})
  for(const scenario of ['empty','error']) {
    const script=await page.cdp('Page.addScriptToEvaluateOnNewDocument',{source:`const qaFetch=window.fetch; window.fetch=(input,init)=>String(input)==='/api/books'?${scenario==='empty'?"Promise.resolve(new Response('[]',{headers:{'Content-Type':'application/json'}}))":"Promise.reject(new Error('QA library unavailable'))"}:qaFetch(input,init);`})
    await page.reload()
    await page.waitForSelector(`text=${scenario==='empty'?'書庫是空的':'書庫暫時無法載入'}`)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    await page.screenshot({path:`${root}/${scenario}-${mode}-393.png`})
    results.push({name:`${scenario} library ${mode}`,passed:true})
    await page.cdp('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier})
  }
}
await page.reload();await page.waitForSelector('[aria-label="閱讀 山間的日常"]')
await page.goto(`${base}/?returnTo=${encodeURIComponent('https://example.com/')}`)
await page.waitForSelector('[aria-label="選擇讀者 閱讀測試"]');await page.click('[aria-label="選擇讀者 閱讀測試"]');await page.waitForURL(`${base}/library`)
results.push({name:'external return URL rejected',passed:true})
await fs.writeFile(`${root}/state-results.json`,JSON.stringify(results,null,2))
console.log(JSON.stringify(results))
