const { chromium } = require('playwright'); const fs=require('fs'); const path=require('path');
(async()=>{const b=await chromium.launch(); const body=fs.readFileSync('arca.html','utf8');
 const head='<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@700;900&display=swap"><link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">';
 for(const [tag,vw,pad,open] of [['pc',900,20,false],['pc_open',900,20,true],['phone',390,12,false],['phone_open',390,12,true]]){
  const f=path.resolve(`_pv_${tag}.html`); fs.writeFileSync(f,head+`<body style="margin:0;background:#fff;font-family:Pretendard,sans-serif;font-size:15px"><div style="padding:${pad}px">${open?body.replace(/<details /g,'<details open '):body}</div></body>`);
  const p=await b.newPage({viewport:{width:vw,height:900},deviceScaleFactor:vw<500?2:1}); await p.goto('file://'+f); await p.waitForLoadState('networkidle'); await p.evaluate(()=>document.fonts.ready); await p.waitForTimeout(500);
  await p.screenshot({path:`pv_${tag}.png`,fullPage:true}); console.log(tag, await p.evaluate(()=>document.documentElement.scrollHeight)); await p.close(); }
 await b.close();})();
