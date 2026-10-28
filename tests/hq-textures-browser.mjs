// 본부 그림 팩이 실제로 그려지는지 (리스 필드 모드 틀 field-harness: 팩을 bridge.assets 로 준다).
// 사무실 = hq-textures 벽·바닥 (art/hqTextures.ts → window.__GOEI_BG_ART__ → drawHqTextureWall), 2층 복도 = hq-field 장면 그림(painted).
// 옛 시작 방(__GOEI_START_ROOM__)은 폐기됐다. npm run build 뒤: node tests/hq-textures-browser.mjs  (사진 out/hq-textures/)
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { openField, enterHub } from './field-harness.mjs';

const results = [];
const out = 'out/hq-textures';
await mkdir(out, { recursive: true });
for (const mobile of [false, true]) {
  const { browser, page, errors } = await openField(mobile ? { width: 844, height: 390, panel: false } : { width: 1280, height: 720, panel: false });
  // 그려진 그림 주소를 모은다 (drawImage 가로채기). 페이지는 이미 떠 있으니 지금부터 그려지는 것만 본다
  // 바닥은 무늬(createPattern)로 깔리므로 drawImage 만으로는 안 잡힌다: 무늬 원본 그림도 같이 모은다
  await page.evaluate(() => {
    window.artDraws = new Set();
    for (const C of [CanvasRenderingContext2D, globalThis.OffscreenCanvasRenderingContext2D].filter(Boolean)) {
      const orig = C.prototype.drawImage; C.prototype.drawImage = function (im, ...a) { if (im && im.src) window.artDraws.add(im.src); return orig.call(this, im, ...a); };
      const pat = C.prototype.createPattern; C.prototype.createPattern = function (im, ...a) { if (im && im.src) window.artDraws.add(im.src); return pat.call(this, im, ...a); };
    }
  });
  await enterHub(page);
  await page.waitForFunction(() => window.__goeiEngine?.world?.floor.id === 'hq:office');
  await page.waitForFunction(() => { const bg = window.__GOEI_BG_ART__?.hq_office; return !!bg && Object.keys(bg).some((k) => k.startsWith('hq_office_wall') && window.artDraws.has(bg[k])); }, null, { timeout: 15000 });
  const office = await page.evaluate(() => { const bg = window.__GOEI_BG_ART__.hq_office; return { wall: Object.keys(bg).filter((k) => k.startsWith('hq_office_wall') && window.artDraws.has(bg[k])), floor: window.artDraws.has(bg.hq_office_floor) }; });
  assert.ok(office.wall.length, '사무실 벽 그림이 그려진다');
  assert.ok(office.floor, '사무실 바닥 그림(무늬)이 깔린다');
  await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'pc'}-office.png` });
  // 2층 복도로: 사무실 아래 출입(S)에서 E
  const door = await page.evaluate(() => window.__goeiEngine.world.stage.current().doors.find((d) => d.to));
  await page.evaluate(([x]) => { const w = window.__goeiEngine.world; w.player.x = x; w.player.y = 640; }, [door.x]);
  await page.waitForFunction(() => !!window.__goeiEngine.world.stage.nearInfo(), null, { timeout: 5000 });
  await page.keyboard.press('KeyE');
  await page.waitForFunction(() => window.__goeiEngine.world.floor.id === 'hq:f2', null, { timeout: 10000 });
  await page.waitForTimeout(800);
  const corridor = await page.evaluate(() => { const s = window.__goeiEngine.world.stage.current(); const known = new Set(Object.values(window.__GOEI_BG_ART__).flatMap((g) => Object.values(g))); return { painted: s.painted, field: [...window.artDraws].some((u) => !known.has(u)) }; });
  assert.equal(corridor.painted, 'f2');
  assert.ok(corridor.field, '복도 장면 그림(hq-field)이 그려진다');
  assert.deepEqual(errors, []);
  await page.screenshot({ path: `${out}/${mobile ? 'mobile' : 'pc'}-corridor.png` });
  results.push({ mobile, office, corridor, errors });
  await browser.close();
}
await writeFile(`${out}/results.json`, JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
console.log('hq-textures-browser 통과');
