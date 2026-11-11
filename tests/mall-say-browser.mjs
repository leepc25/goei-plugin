// 우주 쇼핑몰 상담: 보낸 말이 응답을 기다리는 동안 바로 보인다 (작업용): node tests/mall-say-browser.mjs <사진 폴더>
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, launch, loadFixture, openWin, closeEditor } from './qc-settings-harness.mjs';
import { build } from 'esbuild';
const out = await build({ stdin: { contents: `export { emptyShop } from './src/core/shop'; export { mallVarsOf } from './src/core/malls';`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const emptyShopState = (key) => M.mallVarsOf('cos', { ...M.emptyShop({ raw: '', shop: '우주 쇼핑몰', owner: '운영자' }, key), loaded: true });

const OUT = process.argv[2] || '.scratch/mall-say';
mkdirSync(OUT, { recursive: true });
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const browser = await launch();
const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1', $pp_on: '0', ...emptyShopState('c1') } };
const { page, errors } = await boot(browser, fx, chat, { width: 1280, height: 800, touch: false });
await openWin(page);
if (await page.$('.gw:not([hidden]) .gw-win')) await closeEditor(page).catch(() => {});
await page.click('.gx-nav .gx-nb:not(.mob)[data-value="net"]');
await page.click('.br-bm[data-value="cos"]');
await page.click(':text("운영자에게 질문")');
await page.waitForSelector('[data-input="mall-say"], [data-enter="mall-say"]');
// 응답을 3초 늦게 준다 → 그 사이에 내 말이 보여야 한다
await page.evaluate(() => { window.risuai.runLLMModel = async () => { await new Promise((r) => setTimeout(r, 3000)); return { type: 'success', result: '<owner>가능하다. 선불이다.</owner>\n<change mode="none">\n</change>' }; }; });
await page.fill('[data-enter="mall-say"]', '맞춤 제작 되나요');
await page.press('[data-enter="mall-say"]', 'Enter');
await page.waitForFunction(() => [...document.querySelectorAll('.q-me p')].some((p) => p.textContent.includes('맞춤 제작 되나요')), null, { timeout: 2000 });
assert.equal(await page.locator('.q-op :text("가능하다")').count(), 0, '응답은 아직');
await page.screenshot({ path: `${OUT}/waiting.png` });
await page.waitForFunction(() => [...document.querySelectorAll('.q-op p')].some((p) => p.textContent.includes('가능하다')), null, { timeout: 8000 });
assert.deepEqual(errors, []);
await browser.close();
console.log('mall-say ok');
