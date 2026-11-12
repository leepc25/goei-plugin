// 마우스 제스처 모양 읽기 (src/ui/gesture.ts readStroke): 제스처 넷을 사람 손 모양 획(비스듬·둥근 모서리·삐침)으로 그려도 읽고, 제스처가 아닌 모양은 읽지 않는다.
// 실행: node --test tests/gesture.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = await mkdtemp(join(tmpdir(), 'goei-gesture-'));
await build({ entryPoints: ['src/ui/gesture.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { readStroke } = await import(pathToFileURL(join(dir, 'gesture.mjs')).href);

let seed = 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const R = (a, b) => a + (b - a) * rnd();
const G = () => (rnd() + rnd() + rnd() - 1.5) * 1.4;
const DEG = { U: -90, D: 90, L: 180, R: 0 };
/** dirs 방향으로 차례로 긋는 자취. lean = 방향에서 벗어난 각(획마다 줄 수 있다), corner = 둥근 모서리 길이, hook·startHook = 끝·첫머리 삐침 길이 */
function stroke(dirs, { lean = 0, corner = 0, hook = 0, startHook = 0, jitter = 1.5 } = {}) {
  let x = 400, y = 400;
  const pts = [[x, y]];
  const go = (ang, len) => { const n = Math.max(2, Math.round(len / 6)); for (let i = 0; i < n; i++) { x += (Math.cos(ang) * len) / n; y += (Math.sin(ang) * len) / n; pts.push([x + G() * jitter, y + G() * jitter]); } };
  if (startHook) go(R(0, Math.PI * 2), startHook);
  let prev = null;
  dirs.forEach((d, i) => {
    const ang = ((DEG[d] + (Array.isArray(lean) ? lean[i] ?? 0 : lean)) * Math.PI) / 180;
    if (prev !== null && corner) for (let k = 1; k <= 4; k++) { let da = ang - prev; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI; go(prev + (da * k) / 5, corner / 4); }
    go(ang, R(110, 240));
    prev = ang;
  });
  if (hook) go(R(0, Math.PI * 2), hook);
  return pts;
}
const GEST = { L: ['L'], R: ['R'], DR: ['D', 'R'], UL: ['U', 'L'] };
const HANDS = {
  '깨끗한 획': () => ({}),
  '기울기 ±30°': () => ({ lean: R(-30, 30) }),
  '둥근 모서리 40px': () => ({ lean: R(-10, 10), corner: 40 }),
  '끝 삐침 20~35px': () => ({ lean: R(-10, 10), hook: R(20, 35) }),
  '첫머리 삐침 12~30px': () => ({ lean: R(-10, 10), startHook: R(12, 30) }),
  '손 그림(기울기 ±20°, 모서리, 끝 삐침)': () => ({ lean: [R(-20, 20), R(-20, 20)], corner: 20, hook: R(0, 30) }),
};

for (const [g, dirs] of Object.entries(GEST)) {
  test(`${g}: 사람 손 모양 획 300개씩을 전부 읽는다`, () => {
    for (const [name, mk] of Object.entries(HANDS)) {
      seed = 7;
      for (let i = 0; i < 300; i++) assert.equal(readStroke(stroke(dirs, mk())), g, `${g} · ${name} · ${i}번째`);
    }
  });
}
test('두 획 제스처: 첫 획이 ㄱ 다리처럼 비스듬해도(25~50°) 읽는다', () => {
  seed = 7;
  for (let i = 0; i < 300; i++) {
    assert.equal(readStroke(stroke(['U', 'L'], { lean: [R(25, 50), R(-10, 10)], corner: 20 })), 'UL', `UL ${i}`);
    assert.equal(readStroke(stroke(['D', 'R'], { lean: [R(25, 50), R(-10, 10)], corner: 20 })), 'DR', `DR ${i}`);
  }
});
test('제스처가 아닌 모양은 읽지 않는다', () => {
  const others = [['U'], ['D'], ['R', 'D'], ['L', 'U'], ['D', 'L'], ['U', 'R'], ['R', 'L'], ['L', 'R'], ['U', 'R', 'D'], ['D', 'R', 'U'], ['U', 'L', 'D']];
  for (const dirs of others) for (const [name, mk] of Object.entries(HANDS)) {
    seed = 7;
    for (let i = 0; i < 100; i++) { const o = mk(); if (Array.isArray(o.lean)) o.lean = o.lean[1]; assert.equal(readStroke(stroke(dirs, o)), null, `${dirs.join('')} · ${name} · ${i}번째`); }
  }
});
test('거의 안 움직인 자취·점 하나는 제스처가 아니다', () => {
  assert.equal(readStroke([[10, 10]]), null);
  assert.equal(readStroke([[10, 10], [14, 12], [18, 9]]), null);
});
