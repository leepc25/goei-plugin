// 통합판을 여섯 번 열고 닫은 뒤 남은 캔버스·그림·AudioContext 수를 잰다 (GC 뒤). 인자로 경로를 주면 힙 스냅숏도 저장.
// 주의: waitForFunction이 객체를 돌려주면 그 핸들이 월드를 붙잡아 거짓 누수가 보인다 (!!로 불리언만 받기).
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const { chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files', '--js-flags=--expose-gc', '--autoplay-policy=no-user-gesture-required'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
pg.on('pageerror', (e) => console.log('ERR', e.message));
await pg.goto('file://' + process.cwd() + '/release/demo/goei-action-game.html?start=stage=dummy');
await pg.waitForFunction(() => !!globalThis.__goeiEngine?.world, null, { timeout: 15000 });
for (let i = 0; i < 5; i++) {
  await pg.evaluate(() => __goeiDemo.open());
  await pg.waitForFunction(() => !!globalThis.__goeiEngine?.world, null, { timeout: 15000 });
  await pg.mouse.click(600, 400); await pg.keyboard.press('KeyA');
  await pg.waitForTimeout(400);
}
await pg.evaluate(() => __goeiDemo.close());
await pg.waitForTimeout(3000);
const cdp = await pg.context().newCDPSession(pg);
await cdp.send('HeapProfiler.collectGarbage');
if (process.argv[2]) {
let chunks = '';
cdp.on('HeapProfiler.addHeapSnapshotChunk', (e) => (chunks += e.chunk));
await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false });
(await import('node:fs')).writeFileSync(process.argv[2], chunks);
}
const count = async (ctor) => {
  const { result } = await cdp.send('Runtime.evaluate', { expression: ctor + '.prototype' });
  const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId });
  const { result: n } = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function(){return this.length + (this[0] && this[0].state ? " " + this.map(x=>x.state).join(",") : "")}', returnByValue: true });
  return n.value;
};
for (const c of ['HTMLCanvasElement', 'CanvasRenderingContext2D', 'AudioContext', 'HTMLImageElement']) console.log(c, await count(c));
await b.close();
