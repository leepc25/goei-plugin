import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import { pathToFileURL } from 'node:url';
const file = process.argv[2] || '/home/user/goei-plugin/release/demo/jyaldi-v5-action.html';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1300, height: 900 } });
p.on('pageerror', (e) => console.log('[pageerror]', e.message));
p.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await p.goto(pathToFileURL(file).href);
await p.waitForTimeout(1500);
const st = async (l) => console.log(l.padEnd(10), await p.locator('#state').textContent(), '|', await p.evaluate(() => `x=${Math.round(G.x)} z=${G.z.toFixed(2)} y=${Math.round(G.y)} aim=${G.aim} ammo=${G.ammo}/${G.clips} E=${E.state} hp=${E.hp} Ex=${Math.round(E.x)}`));
const tap = async (k, ms = 100) => { await p.keyboard.down(k); await p.waitForTimeout(40); await p.keyboard.up(k); await p.waitForTimeout(ms); };
await p.keyboard.down('ArrowDown'); await p.waitForTimeout(400); await p.keyboard.up('ArrowDown'); await st('down-move');
await p.keyboard.down('ArrowUp'); await p.waitForTimeout(400); await p.keyboard.up('ArrowUp'); await st('up-move');
await tap('Space', 300); await st('jump-mid'); await p.waitForTimeout(900); await st('landed');
// 근접 콤보 3타 (앞으로 나가며)
await p.keyboard.down('ArrowRight'); await p.waitForTimeout(1500); await p.keyboard.up('ArrowRight'); await st('walked');
await tap('KeyA', 250); await st('melee1'); await tap('KeyA', 250); await st('melee2'); await tap('KeyA', 300); await st('melee3'); await p.waitForTimeout(1200); await st('after-combo');
// 권총: 뽑기 → 8발 → 빈 격발 → 재장전 ×2 → 예비 없음
await tap('KeyS', 700); await st('draw');
for (let i = 0; i < 9; i++) await tap('KeyS', 350);
await st('dry');
await tap('KeyR', 900); await st('reload1'); for (let i = 0; i < 8; i++) await tap('KeyS', 300); await tap('KeyR', 900); await st('reload2'); await tap('KeyR', 300); await st('reload3');
await p.waitForTimeout(1600); await st('holster');
// 대시 회피 (오른쪽)
await p.keyboard.down('ArrowRight'); await tap('ShiftLeft', 200); await p.keyboard.up('ArrowRight'); await st('dash'); await p.waitForTimeout(700);
// 충전 고유기
await p.keyboard.down('KeyD'); await p.waitForTimeout(800); await st('charge'); await p.keyboard.up('KeyD'); await p.waitForTimeout(300); await st('unique');
await p.waitForTimeout(900);
// 다운 → 기상
await tap('KeyK', 1400); await st('down'); await tap('KeyK', 500); await st('getup'); await p.waitForTimeout(1200); await st('after');
await p.click('#crt'); await p.click('#grid'); await p.waitForTimeout(200);
await p.screenshot({ path: 'demo-shot2.png' });
await b.close();
