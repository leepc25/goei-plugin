const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(pathToFileURL(path.resolve('release/demo/jyaldi-v5-playable-preview.html')).href);
  await page.waitForSelector('[data-art-profile="production-v5-preview"]');
  await page.locator('[data-do="practice"]').click();
  const canvas=page.locator('canvas');
  await canvas.focus();
  const seen=[];
  async function pose(keys,action,frame){
    for(const key of keys)await page.keyboard.down(key);
    await page.waitForFunction(a=>document.querySelector('canvas').dataset.action===a,action);
    assert.equal(await canvas.getAttribute('data-frame'),String(frame));
    seen.push(action);
    await page.screenshot({path:`game-src/action/production-v5/playable-${action}.png`});
    for(const key of keys.reverse())await page.keyboard.up(key);
    await page.waitForTimeout(350);
  }
  const x=Number(await canvas.getAttribute('data-player-x'));
  await pose(['ArrowRight'],'walk',1);
  assert(Number(await canvas.getAttribute('data-player-x'))>x);
  await pose(['Shift','ArrowRight'],'run',2);
  await pose(['a','ArrowDown'],'crouch',3);
  await pose(['d'],'shot',5);
  await page.keyboard.down('z');
  await page.waitForFunction(()=>document.querySelector('canvas').dataset.action==='melee3');
  assert.equal(await canvas.getAttribute('data-frame'),'4');
  seen.push('melee3');
  await page.keyboard.up('z');
  await page.waitForTimeout(650);
  await page.screenshot({path:'game-src/action/production-v5/playable-overview.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('game-src/action/production-v5/playable-validation.json',JSON.stringify({offline:true,profile:'production-v5-preview',seen,errors,scope:'Six representative poses integrated, not complete animation'},null,2));
  console.log(JSON.stringify({seen,errors}));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
