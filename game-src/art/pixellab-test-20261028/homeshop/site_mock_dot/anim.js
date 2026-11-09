const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for (const [f,w,s,pre] of [['pc.html',900,2,'pcA'],['phone.html',360,2,'phA']]){
 const p=await b.newPage({viewport:{width:w,height:400},deviceScaleFactor:s});
 await p.goto('file://'+process.cwd()+'/'+f); await p.waitForTimeout(300);
 for(let i=0;i<17;i++){ const n=String(i).padStart(2,'0');
  await p.evaluate(n=>{document.querySelector('.scr>img').src='fr'+n+'.png'},n); await p.waitForTimeout(60);
  await p.screenshot({path:`${pre}${n}.png`,fullPage:true}); } }
await b.close();})();
