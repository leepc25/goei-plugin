const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();
for (const [f,w,o,s] of process.argv.slice(2).map(x=>x.split(','))){
 const p=await b.newPage({viewport:{width:+w,height:400},deviceScaleFactor:+s});
 await p.goto('file://'+process.cwd()+'/'+f); await p.waitForTimeout(400);
 await p.screenshot({path:o,fullPage:true}); }
await b.close();})();
