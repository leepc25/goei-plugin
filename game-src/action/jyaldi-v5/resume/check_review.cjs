const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');
const reviewHtml=process.env.REVIEW_HTML||'jyaldi-walk-resume.html',reviewOutput=process.env.REVIEW_OUTPUT||'walk-20261022',cycle=Number(process.env.REVIEW_CYCLE||48);
(async()=>{const root=path.resolve(__dirname,'../../../..');const browser=await chromium.launch({headless:true,channel:process.env.REVIEW_BROWSER_CHANNEL||'chrome'});const result=[];
try {for(const [name,width,height] of [['desktop',1280,900],['mobile',844,390],['portrait',390,844]]){
const page=await browser.newPage({viewport:{width,height}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.join(root,'release/demo',reviewHtml)).href);await page.waitForFunction(()=>window.reviewState?.().ready);
await page.locator('#play').click();await page.locator('#reset').click();
for(let i=0;i<8;i++){await page.getByRole('button',{name:`${i}장 보기`,exact:true}).click();if((await page.evaluate(()=>reviewState())).frame!==i)throw Error('frame navigation');}
await page.locator('#source').selectOption('old');await page.getByRole('button',{name:'0장 보기',exact:true}).click();
await page.locator('#source').selectOption('new');await page.locator('#guide').uncheck();await page.locator('#reset').click();await page.locator('#play').click();
await page.waitForFunction(expected=>reviewState().world>=expected,cycle);await page.locator('#play').click();
const state=await page.evaluate(()=>reviewState());const images=await page.locator('img').evaluateAll(ims=>ims.every(im=>im.complete&&im.naturalWidth>0));
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
await page.locator('#stage').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(__dirname,`${reviewOutput}/${name}.png`),fullPage:false});
if(errors.length||overflow||!images)throw Error(JSON.stringify({name,errors,overflow,images}));result.push({name,width,height,errors,overflow,images,state});await page.close();}
fs.writeFileSync(path.join(__dirname,reviewOutput,'browser-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
