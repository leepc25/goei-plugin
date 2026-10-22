// CDP dispatchTouchEvent uses Chromium's trusted multi-touch pipeline, not DOM event stubs.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { relative } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright');
const out = process.env.SHOTS || 'out/touch-input-round2';
await mkdir(out, { recursive: true });
// Optional baseline comparison reads only the owned input files from the requested ref.
const plugins = process.env.SOURCE_REF ? [{name:'input-baseline',setup(build){
  build.onLoad({filter:/[\\/]ui[\\/](touch|gamepad|input)\.ts$/},args=>({
    contents:execFileSync('git',['show',`${process.env.SOURCE_REF}:${relative(process.cwd(),args.path)}`],{encoding:'utf8'}),loader:'ts'
  }));
}}] : [];
let gameHtml = await readFile('dist/goei-action-game.html','utf8');
if (plugins.length) {
  const game=await build({entryPoints:['src/game/action/engine/demo.ts'],bundle:true,format:'esm',write:false,loader:{'.css':'text'},plugins});
  const start=gameHtml.lastIndexOf('<script type="module">');
  gameHtml=gameHtml.slice(0,start)+'<script type="module">'+game.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')+'</script></html>';
}
const fixture = await build({plugins, stdin: { contents: `
import { mountGameShell } from './src/game/action/ui';
import { Input } from './src/game/action/engine/input';
window.shell = mountGameShell(document.getElementById('box'), { synth: true, store: {load:()=>null,save:()=>{}} });
window.engineInput = new Input(); window.engineInput.attach();
shell.play(); window.events=[]; shell.input.on((code,down)=>events.push({code,down}));
`, resolveDir: process.cwd() }, bundle: true, format: 'iife', write: false, loader: { '.css': 'text' } });
const server = createServer(async (req, res) => {
  if (req.url === '/fixture.js') {res.setHeader('Content-Type', 'text/javascript'); return res.end(fixture.outputFiles[0].text);}
  res.setHeader('Content-Type', 'text/html');
  if (req.url === '/fixture') return res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}#box{position:fixed;inset:0}</style><div id="box"></div><script src="/fixture.js"></script>');
  res.end(gameHtml);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const results = [], errors = [];
try {
 for (const [width,height] of [[844,390],[667,375]]) {
  const context = await browser.newContext({ viewport:{width,height}, hasTouch:true, isMobile:true });
  const page = await context.newPage(); page.on('pageerror', e=>errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  const fingers = new Map();
  const send = async(type,id,x,y) => {
    let touchPoints;
    if(type==='touchEnd') {touchPoints=[fingers.get(id)];fingers.delete(id);}
    else {fingers.set(id,{id,x,y,radiusX:2,radiusY:2,force:1});touchPoints=[...fingers.values()];}
    await cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
    await page.waitForTimeout(35);
  };
  const point = async id => {const r=await page.locator(`[data-id="${id}"]`).boundingBox(); return [r.x+r.width/2,r.y+r.height/2]};
  const check = async(name,fn,route='/fixture') => {try {await page.goto(url+route);await page.waitForTimeout(150); await fn(); results.push({width,height,name,pass:true});}catch(e){results.push({width,height,name,pass:false,error:e.stack});}finally{if(fingers.size) await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});fingers.clear();}};
  await page.goto(url+'/fixture');
  await check('button slide outside releases attack',async()=>{
    await send('touchStart',1,...await point('attack'));
    assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),true);
    await send('touchMove',1,width/2,80);
    assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),false);
  });
  await check('stick sprint re-entry releases Shift',async()=>{
    await send('touchStart',1,180,240); await send('touchMove',1,220,240);
    await send('touchMove',1,180,240); await send('touchMove',1,220,240);
    await send('touchEnd',1); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>shell.input.held('ShiftLeft')),false);
  });
  await check('mixed keyboard + touch holds until both release',async()=>{
    await page.keyboard.down('KeyA');await send('touchStart',1,...await point('attack'));await page.keyboard.up('KeyA');
    assert.equal(await page.evaluate(()=>engineInput.sample().held.has('attack')),true);
    await send('touchEnd',1);assert.equal(await page.evaluate(()=>engineInput.sample().held.has('attack')),false);
  });
  await check('menu consumes keyboard attack',async()=>{
    await page.keyboard.press('Escape'); await page.keyboard.down('KeyA');
    assert.equal(await page.evaluate(()=>engineInput.sample().held.has('attack')),false);
    await page.keyboard.up('KeyA');await page.keyboard.press('Escape');
  });
  await check('two fingers on attack release independently',async()=>{
    const [x,y]=await point('attack');
    await send('touchStart',1,x-4,y);await send('touchStart',2,x+4,y);
    await send('touchEnd',1);assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),true);
    await send('touchEnd',2);assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),false);
  });
  await check('slide attack to investigate and back through empty space',async()=>{
    await send('touchStart',1,...await point('attack'));
    await send('touchMove',1,...await point('interact'));
    assert.deepEqual(await page.evaluate(()=>[shell.input.held('KeyA'),shell.input.held('KeyE')]),[false,true]);
    await send('touchMove',1,width/2,80);
    assert.equal(await page.evaluate(()=>shell.input.held('KeyE')),false);
    await send('touchMove',1,...await point('attack'));
    assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),true);
  });
  await check('leaving viewport releases stick and attack',async()=>{
    await send('touchStart',1,180,240);await send('touchMove',1,205,240);
    await send('touchStart',2,...await point('attack'));await send('touchMove',2,width+20,200);
    assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),false);
    assert.equal(await page.evaluate(()=>shell.input.held('ArrowRight')),true);
    await send('touchMove',1,-20,240);await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(()=>[shell.input.axis(),shell.input.held('ShiftLeft')]),[{x:0,y:0},false]);
  });
  await check('lost capture and blur cancel touch state',async()=>{
    await page.evaluate(()=>{window.captureTrace=[];const root=document.querySelector('.tp');for(const type of ['pointerdown','gotpointercapture','lostpointercapture','pointermove'])root.addEventListener(type,e=>{if(type==='pointerdown')window.lastPointer=e.pointerId;captureTrace.push({type,id:e.pointerId,has:root.hasPointerCapture(e.pointerId)});});});
    await send('touchStart',1,...await point('attack'));
    const [ax,ay]=await point('attack');await send('touchMove',1,ax+2,ay);
    await page.evaluate(()=>document.querySelector('.tp').releasePointerCapture(window.lastPointer));
    await send('touchMove',1,ax+4,ay);
    assert.equal(await page.evaluate(()=>shell.input.held('KeyA')),false,JSON.stringify(await page.evaluate(()=>captureTrace)));
    await send('touchEnd',1);
    await send('touchStart',2,180,240);await send('touchMove',2,220,240);
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(300);
    assert.deepEqual(await page.evaluate(()=>[shell.input.axis(),shell.input.held('ShiftLeft')]),[{x:0,y:0},false]);
  });
  await check('keyboard aliases and text-field key release',async()=>{
    await page.keyboard.down('ShiftLeft');await page.keyboard.down('ShiftRight');await page.keyboard.up('ShiftLeft');
    assert.equal(await page.evaluate(()=>engineInput.sample().held.has('shift')),true);
    await page.keyboard.up('ShiftRight');assert.equal(await page.evaluate(()=>engineInput.sample().held.has('shift')),false);
    await page.keyboard.down('ArrowRight');
    await page.evaluate(()=>{const input=document.createElement('input');document.body.append(input);input.focus();});
    await page.keyboard.up('ArrowRight');assert.equal(await page.evaluate(()=>engineInput.sample().held.has('right')),false);
  });
  await check('mock pad menu resume disconnect and mixed touch ownership',async()=>{
    await page.evaluate(()=>{
      window.mockPad={id:'round2',index:0,connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>[mockPad],configurable:true});
      window.padButton=(i,on)=>{mockPad.buttons[i]={pressed:on,value:on?1:0};shell.pad.poll();};
      padButton(9,true);shell.pad.poll();
    });
    assert.equal(await page.evaluate(()=>shell.menu.top.id),'pause');
    await page.evaluate(()=>{padButton(9,false);padButton(1,true);padButton(1,false);});
    assert.equal(await page.evaluate(()=>shell.menu.isOpen),false);
    await send('touchStart',1,...await point('attack'));
    await page.evaluate(()=>padButton(2,true));await send('touchEnd',1);
    assert.equal(await page.evaluate(()=>engineInput.sample().held.has('attack')),true);
    await page.evaluate(()=>{mockPad=null;shell.pad.poll();});
    assert.equal(await page.evaluate(()=>engineInput.sample().held.has('attack')),false);
  });
  await check('real game simultaneous movement attack investigation map menu',async()=>{
    await page.waitForFunction(()=>window.__goeiEngine?.world?.stage.mapView?.());
    // Observe real sampled input; do not inject player coordinates, actions, or map state.
    await page.evaluate(()=>{
      window.trace=[]; for(const type of ['pointerdown','pointerup','lostpointercapture','keydown','keyup']) window.addEventListener(type,e=>trace.push({type,id:e.pointerId,x:e.clientX,y:e.clientY,code:e.code}),true);
      const input=__goeiEngine.input, sample=input.sample.bind(input); window.samples=[];
      input.sample=()=>{const p=sample();samples.push({held:[...p.held],pressed:[...p.pressed],mx:p.mx});return p;};
    });
    const start=await page.evaluate(()=>({x:__goeiEngine.world.player.x,attack:__goeiEngine.world.player.attackId}));
    await send('touchStart',1,180,240);await send('touchMove',1,205,240);
    await page.waitForTimeout(250);
    assert.ok(await page.evaluate(()=>__goeiEngine.world.player.x)>start.x,'touch stick moves real player');
    await send('touchStart',2,...await point('attack'));await page.waitForTimeout(120);
    assert.ok(await page.evaluate(()=>__goeiEngine.world.player.attackId)>start.attack,'touch starts real attack');
    await send('touchMove',2,...await point('interact'));await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>samples.some(p=>p.pressed.includes('interact')&&p.held.includes('right'))),true,'investigate and movement reach World together');
    await send('touchEnd',2);
    // Open the map with the first finger still moving: closing it must not resume that stick.
    await send('touchStart',2,...await point('map'));await send('touchEnd',2);
    await page.waitForFunction(()=>document.querySelector('.gs.exploration-map'));
    await page.screenshot({path:`${out}/${width}x${height}-map.png`});
    const tick=await page.evaluate(()=>__goeiEngine.world.tick);await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>__goeiEngine.world.tick),tick);
    await send('touchStart',2,...await point('map'));await send('touchEnd',2);await page.waitForTimeout(150);
    assert.equal(await page.locator('.gs.exploration-map').count(),0,JSON.stringify(await page.evaluate(()=>trace)));
    assert.equal(await page.evaluate(()=>samples.at(-1).held.includes('right')),false);
    await send('touchEnd',1);
    await page.touchscreen.tap(...await point('menu'));
    await page.getByText('계속',{exact:true}).tap();
    await send('touchStart',1,180,240);await send('touchMove',1,205,240);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(()=>samples.at(-1).held.includes('right')),true,'input resumes after menu');
    await send('touchMove',1,-20,240);await send('touchEnd',1);await page.waitForTimeout(300);
    assert.equal(await page.evaluate(()=>samples.at(-1).held.includes('right')),false);
    await page.screenshot({path:`${out}/${width}x${height}-play.png`});
  },'/?start=stage=elevator');
  await check('real game mock pad movement attack map and menu resume',async()=>{
    await page.waitForFunction(()=>window.__goeiEngine?.world?.stage.mapView?.());
    await page.evaluate(()=>{
      window.mockPad={id:'round2-game',index:0,connected:true,axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,value:0}))};
      Object.defineProperty(navigator,'getGamepads',{value:()=>mockPad?[mockPad]:[],configurable:true});
    });
    const button=async i=>{
      await page.evaluate(i=>mockPad.buttons[i]={pressed:true,value:1},i);await page.waitForTimeout(120);
      await page.evaluate(i=>mockPad.buttons[i]={pressed:false,value:0},i);await page.waitForTimeout(120);
    };
    const start=await page.evaluate(()=>({x:__goeiEngine.world.player.x,attack:__goeiEngine.world.player.attackId}));
    await page.evaluate(()=>mockPad.axes=[0.7,0]);await page.waitForTimeout(200);
    assert.ok(await page.evaluate(()=>__goeiEngine.world.player.x)>start.x);
    await page.evaluate(()=>mockPad.axes=[0,0]);await button(2);
    assert.ok(await page.evaluate(()=>__goeiEngine.world.player.attackId)>start.attack);
    await button(8);assert.equal(await page.locator('.gs.exploration-map').count(),1);
    await button(8);assert.equal(await page.locator('.gs.exploration-map').count(),0);
    await button(9);assert.equal(await page.locator('.mn.on').count(),1);
    await button(1);assert.equal(await page.locator('.mn.on').count(),0);
    const x=await page.evaluate(()=>__goeiEngine.world.player.x);
    await page.evaluate(()=>mockPad.axes=[-0.7,0]);await page.waitForTimeout(200);
    assert.ok(await page.evaluate(()=>__goeiEngine.world.player.x)<x);
    await page.evaluate(()=>mockPad=null);
  },'/?start=stage=elevator');
  await check('real HQ touch walking and investigation exits first office',async()=>{
    await page.waitForFunction(()=>window.__goeiEngine?.world);
    // Cutscene preparation only; route, position, doors and interaction remain real.
    await page.evaluate(()=>window.__goeiStory.skip());
    await page.waitForFunction(()=>__goeiEngine.world.floor.id==='hq:office'&&!__goeiEngine.mods.blocking());
    const door=await page.evaluate(()=>__goeiEngine.world.stage.current().doors.find(d=>d.to));
    const walk=async(axis,value,sign)=>{
      await send('touchStart',1,180,240);
      await send('touchMove',1,180+(axis==='x'?sign*24:0),240+(axis==='y'?sign*24:0));
      await page.waitForFunction(({axis,value,sign})=>sign*(__goeiEngine.world.player[axis]-value)>=0,{axis,value,sign},{timeout:15000});
      await send('touchEnd',1);
    };
    await walk('y',486,-1);await walk('x',door.x+78,1);await walk('y',676,1);await walk('x',door.x+20,-1);
    await send('touchStart',2,...await point('interact'));await send('touchEnd',2);
    await page.waitForFunction(()=>__goeiEngine.world.floor.id==='hq:f2',{}, {timeout:5000});
    await page.screenshot({path:`${out}/${width}x${height}-hq-door.png`});
  },'/?start=hq');
  await context.close();
 }
 assert.deepEqual(errors,[]);
} finally {await browser.close();await new Promise(r=>server.close(r));await writeFile(`${out}/results.json`,JSON.stringify(results,null,2));}
for(const r of results) console.log(`${r.pass?'PASS':'FAIL'} ${r.width}x${r.height} ${r.name}${r.error?' '+r.error:''}`);
assert.ok(results.every(r=>r.pass),'touch input round2 regressions');
