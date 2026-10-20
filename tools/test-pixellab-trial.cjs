const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{pathToFileURL}=require('url');
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.goto(pathToFileURL(path.resolve('release/demo/jyaldi-pixellab-trial.html')).href);
  await p.waitForFunction(()=>window.walkStudy && document.querySelector('#status').textContent.includes('128'));
  const x=await p.evaluate(()=>walkStudy.state.x);
  await p.locator('canvas').focus();await p.keyboard.down('ArrowRight');
  const seen=new Set();
  for(let i=0;i<32;i++){await p.waitForTimeout(55);seen.add(await p.evaluate(()=>walkStudy.state.frame));}
  assert.equal(seen.size,8);assert((await p.evaluate(()=>walkStudy.state.x))>x+100);
  await p.keyboard.up('ArrowRight');
  await p.waitForFunction(()=>walkStudy.state.phase==='idle');
  assert.equal(await p.evaluate(()=>walkStudy.state.frame),0);
  const stopped=await p.evaluate(()=>walkStudy.state.x);await p.waitForTimeout(250);
  assert.equal(await p.evaluate(()=>walkStudy.state.x),stopped);
  await p.locator('#compare').check();
  for(const frame of [0,1,2,3,4,5,6,7,8]){
    await p.locator(`[data-frame="${frame}"]`).click();await p.waitForTimeout(50);
    assert.equal(await p.evaluate(()=>walkStudy.state.frame),frame);
  }
  await p.locator('#speed').selectOption('.25');
  await p.locator('#auto').click();await p.waitForTimeout(600);
  await p.locator('#pause').click();
  const paused=await p.evaluate(()=>walkStudy.state.x);await p.waitForTimeout(150);
  assert.equal(await p.evaluate(()=>walkStudy.state.x),paused);
  await p.screenshot({path:'game-src/action/pixellab-trial/browser-overview.png'});
  await p.setViewportSize({width:390,height:844});
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  const report={keyboardMove:true,stopReturnsToNeutral:true,walkFrames:[...seen].sort(),frameSelection:true,slowMotion:true,pause:true,mobileOverflow:false,errors,visualApproval:false};
  fs.writeFileSync('game-src/action/pixellab-trial/browser-validation.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
