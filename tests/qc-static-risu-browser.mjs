// QC(정적 감사) Risu 호환: 처리기 등록 하나가 거부돼도(권한 거부·옛 Risu) 나머지 처리기와 본체는 켜지는지,
// 본 화면 SafeElement 에 x- 아닌 속성을 쓰지 않는지(가짜 SafeElement 가 던짐), form 제출 없이 입력이 되는지(제출은 막혀 있음).
// 사용법: node tests/qc-static-risu-browser.mjs <fixture.json>
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launch, hostScript, plugin } from './qc-static-harness.mjs';

const fixture = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const chat = { message: [{ role: 'user', data: '안녕' }, { role: 'char', data: '첫 장면\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '1' } };
const { browser } = await launch();

for (const denied of ['addRisuReplacer', 'addRisuChatListener', 'addRisuScriptHandler']) {
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
  const errors = [];
  const logs = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => logs.push(m.text()));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;height:100vh"><div class="default-chat-screen" style="height:100%"></div></body></html>');
  await page.addScriptTag({ content: hostScript(fixture, chat) });
  // 이 등록 하나만 거부 (display 만 거부하면 input 은 되게: 처음 부른 것만)
  await page.addScriptTag({ content: `{ const f = window.risuai.${denied}; let once = false; window.risuai.${denied} = async (...a) => { if (!once) { once = true; throw new Error('permission denied'); } return f(...a); }; }` });
  await page.addScriptTag({ content: `(async () => { ${plugin}\n })().then(() => { window.__done = true; }).catch(e => { window.__bootError = String(e); });` });
  await page.waitForFunction(() => window.__done || window.__bootError, null, { timeout: 8000 });
  assert.equal(await page.evaluate(() => window.__bootError ?? null), null, `${denied} 거부에도 시작기가 끝까지 돈다`);
  await page.waitForFunction(() => document.querySelector('[x-goei-fab]')?.style.display === 'block', null, { timeout: 8000 });
  const got = await page.evaluate(() => ({ replacers: window.__calls.replacers.length, listeners: window.__calls.listeners.length, handlers: Object.keys(window.__calls.handlers).sort() }));
  if (denied !== 'addRisuReplacer') assert.equal(got.replacers, 1);
  if (denied !== 'addRisuChatListener') assert.equal(got.listeners, 1);
  assert.deepEqual(got.handlers, denied === 'addRisuScriptHandler' ? ['input'] : ['display', 'input']);
  assert.ok(logs.some((l) => l.includes('처리기를 걸지 못했어요')), '거부 까닭을 로그로');
  if (denied !== 'addRisuScriptHandler') {
    const html = await page.evaluate(() => window.__calls.handlers.display('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]'));
    assert.ok(html.includes('data-goei-status'), '표시 처리기는 그대로 상태창을 그린다');
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${denied} 하나가 거부돼도 나머지 처리기·플로팅 버튼이 켜짐 ${JSON.stringify(got)}`);
  await page.close();
}
await browser.close();
