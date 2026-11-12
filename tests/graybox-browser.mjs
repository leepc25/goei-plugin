// 기본값이 든 글 칸 (2026-11-12 사용자: 회색 안내 글을 기본값으로 쓰지 않는다 — 한 글자만 쳐도 다 사라졌다).
// 우주 쇼핑몰·포인트몰 진열 배정(목록·값 등급), 포인트몰 상담사 주사위 칸, 망상홈쇼핑 주문 전화번호·출연 형태.
// ① 저장값이 없으면 칸에 기본값이 진짜 글로 들어 있다 ② 한 군데만 고쳐도 나머지가 남는다 ③ 기본값과 같으면 저장하지 않는다
// ④ 다르게 고친 줄만 「바꾼 줄」 점 ⑤ 다 지우면·「기본값으로」를 누르면 기본값으로 돌아간다.  사용: node tests/graybox-browser.mjs <fixture.json> [사진 폴더] [--shots-only]
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, goNode, launch, loadFixture, openEditor, openWin, sleep } from './qc-settings-harness.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const shotsOnly = process.argv.includes('--shots-only');
const fx = loadFixture(args[0] || new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const OUT = args[1] || '.scratch/graybox';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
for (const [vp, size] of [['pc', { width: 1920, height: 1080, touch: false }], ['phone', 'phone']]) {
  const chat = {
    message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }],
    scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' },
  };
  const { page, errors } = await boot(browser, fx, chat, size);
  const ss = () => page.evaluate(() => window.__chat.scriptstate);
  const sel = (k, key) => `.gw [data-change="${k}"][data-key="${key}"]`;
  const val = (s) => page.evaluate((s) => document.querySelector(s)?.value ?? null, s);
  const ph = (s) => page.evaluate((s) => document.querySelector(s)?.getAttribute('placeholder') ?? '', s);
  const changed = (s) => page.evaluate((s) => !!document.querySelector(s)?.closest('.ps-row')?.classList.contains('ps-changed'), s);
  const put = async (s, v) => { await page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [s, v]); await sleep(350); };
  const shot = async (tag, s) => { await page.evaluate((s) => document.querySelector(s)?.closest('.ps-group')?.scrollIntoView({ block: 'start' }), s); await sleep(300); await page.screenshot({ path: `${OUT}/${vp}-${tag}.png` }); };
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await openEditor(page, 'set:cos'); await sleep(300);
  const G = sel('ms-roll', 'cos:genres'); const T = sel('ms-roll', 'cos:tiers');
  await shot('cos-1-first', G);
  if (shotsOnly) {
    // 사용자가 겪은 일 그대로: 칸을 누르고 글자 하나를 친다
    await page.focus(G); await page.keyboard.press('Control+End'); await page.keyboard.type('x'); await sleep(200);
    await shot('cos-2-typed', G);
    await page.close();
    continue;
  }
  // ① 기본값이 진짜 글로
  const g0 = await val(G); const t0 = await val(T);
  assert.ok(g0.split(',').length === 20, `[${vp}] 장르 칸에 기본 20종이 들어 있다: ${g0.slice(0, 60)}`);
  assert.equal(t0.split('\n').length, 5, `[${vp}] 값 등급 칸에 기본 5단계`);
  assert.equal(await ph(G), '', '회색 안내 글 없음'); assert.equal(await ph(T), '');
  assert.equal(await changed(G), false); assert.equal(await changed(T), false);
  assert.equal(await page.locator('.gw [data-action="ms-roll-reset"]').count(), 0, '고친 게 없으면 「기본값으로」 없음');
  // ③ 손대지 않고 나가면(같은 글) 저장 안 함
  await put(G, g0); await put(T, `${t0}\n`);
  assert.ok(!(await ss()).$cos_roll_genres, '기본값과 같으면 저장 안 함'); assert.ok(!(await ss()).$cos_roll_tiers);
  // ② 하나만 덧붙이면 나머지가 남는다 + ④ 점
  await page.focus(G); await page.keyboard.press('Control+End'); await page.keyboard.type(', 시험 장르'); await page.evaluate((s) => document.querySelector(s).blur(), G); await sleep(400);
  const g1 = (await ss()).$cos_roll_genres;
  assert.equal(g1, `${g0}, 시험 장르`, '친 글 + 기본 20종이 그대로');
  assert.equal(await val(G), g1); assert.equal(await changed(G), true, '바꾼 줄 점'); assert.equal(await changed(T), false);
  assert.equal(await page.locator('.gw [data-action="ms-roll-reset"]').count(), 1);
  await shot('cos-2-typed', G);
  // 다음 진열 요청에 고친 목록이 쓰인다 (읽는 쪽)
  // ⑤ 다 지우면 기본값
  await put(G, '   ');
  assert.ok(!(await ss()).$cos_roll_genres); assert.equal(await val(G), g0, '다 지우면 기본값이 다시 들어온다'); assert.equal(await changed(G), false);
  // 값 등급: 한 줄만 고침 → 나머지 줄 남음, 「기본값으로」 → 되돌아감
  const lines = t0.split('\n'); const edited = [lines[0].replace(/\|[^|]*$/, '|7'), ...lines.slice(1)].join('\n');
  await put(T, edited);
  assert.equal((await ss()).$cos_roll_tiers, edited); assert.equal((await val(T)).split('\n').length, 5); assert.equal(await changed(T), true);
  await page.evaluate(() => document.querySelector('.gw [data-action="ms-roll-reset"]').click()); await sleep(400);
  assert.ok(!(await ss()).$cos_roll_tiers); assert.equal(await val(T), t0, '「기본값으로」'); assert.equal(await changed(T), false);
  // 쓸 수 있는 줄이 없는 글 → 기본 따름
  await put(T, '아무 글'); assert.ok(!(await ss()).$cos_roll_tiers); assert.equal(await val(T), t0);
  // 포인트몰: 분류·값 등급·상담사 주사위 칸
  await goNode(page, 'set:bm'); await sleep(300);
  const BG = sel('ms-roll', 'bm:genres'); const A = sel('ms-desk', 'axes');
  const b0 = await val(BG); const a0 = await val(A);
  assert.ok(b0.includes(','), '분류 칸에 기본 목록'); assert.equal(a0.split('\n').length, 7, '주사위 기본 7칸'); assert.equal(await ph(A), '');
  await put(A, a0); assert.ok(!(await ss()).$bm_desk_axes, '같으면 저장 안 함');
  assert.equal(await page.locator('.gw [data-action="ms-desk-reset"]').count(), 0);
  const a1 = a0.replace('사원, 사원, 사원', '사원, 인턴');
  await put(A, a1); assert.equal((await ss()).$bm_desk_axes, a1); assert.equal((await val(A)).split('\n').length, 7); assert.equal(await changed(A), true);
  await shot('bm-desk-edited', A);
  await page.evaluate(() => document.querySelector('.gw [data-action="ms-desk-reset"]').click()); await sleep(400);
  assert.ok(!(await ss()).$bm_desk_axes); assert.equal(await val(A), a0);
  // 망상홈쇼핑: 주문 전화번호·출연 형태
  await goNode(page, 'set:hs'); await sleep(300);
  const TEL = sel('hs-text', 'tel'); const F = sel('hs-text', 'forms');
  assert.equal(await val(TEL), '080-404-0000'); assert.equal(await val(F), '전화 출연, 엑스트라, 모델'); assert.equal(await ph(F), '');
  await put(F, '전화 출연, 엑스트라, 모델'); assert.ok(!(await ss()).$hs_forms);
  await put(F, '전화 출연, 엑스트라, 모델, 방청객'); assert.equal((await ss()).$hs_forms, '전화 출연, 엑스트라, 모델, 방청객'); assert.equal(await changed(F), true); assert.equal(await changed(TEL), false);
  await shot('hs-forms-edited', F);
  await put(F, ''); assert.ok(!(await ss()).$hs_forms); assert.equal(await val(F), '전화 출연, 엑스트라, 모델'); assert.equal(await changed(F), false);
  await put(TEL, '080-111-2222'); assert.equal((await ss()).$hs_tel, '080-111-2222'); assert.equal(await changed(TEL), true);
  await put(TEL, ''); assert.ok(!(await ss()).$hs_tel); assert.equal(await val(TEL), '080-404-0000');
  // 가로 넘침·이름 줄바꿈 없음
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  assert.deepEqual(errors.filter((e) => !/favicon/.test(e)), []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
console.log('ok', OUT);
