// 칸 입력 (2026-11-12 사용자: 「이름|설명|하한|상한|가중치」 같은 줄을 글 상자에 치게 하지 말고 칸마다 입력칸을).
// 값 등급(우주 쇼핑몰·포인트몰) · 상담사 주사위 칸(포인트몰) · 그림 대체 말(소지품, 접어 둠).
// ① 저장값이 없으면 기본값이 칸마다 들어 있다 ② 칸 하나를 고치면 옛 글 꼴 그대로 저장되고 나머지 줄이 남는다
// ③ 창을 닫았다 열어도 같은 값 ④ 기본값과 같아지면 저장을 비운다 ⑤ 줄을 다 지우면·「기본값으로」면 기본값
// ⑥ 못 쓰는 줄은 붉은 글 ⑦ 숫자 상자는 공통 .st-step ⑧ 가로 넘침 없음 ⑨ 시작 전(새 채팅 기본값)에서도 된다.
// 사용: node tests/fields-browser.mjs <fixture.json> [사진 폴더]
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, goNode, launch, loadFixture, openEditor, openWin, prefsOf, sleep } from './qc-settings-harness.mjs';

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const fx = loadFixture(args[0] || new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const OUT = args[1] || '.scratch/fields';
mkdirSync(OUT, { recursive: true });
const browser = await launch();
const started = () => ({
  message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]', chatId: 'c1' }],
  scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' },
});
let checks = 0;
const eq = (a, b, m) => { assert.deepEqual(a, b, m); checks++; };
const ok = (v, m) => { assert.ok(v, m); checks++; };

for (const [vp, size] of [['pc', { width: 1920, height: 1080, touch: false }], ['phone', 'phone']]) {
  const { page, errors } = await boot(browser, fx, started(), size);
  const ss = () => page.evaluate(() => window.__chat.scriptstate);
  const q = (s) => `.gw ${s}`;
  const vals = (s) => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.value), s);
  const count = (s) => page.locator(s).count();
  const put = async (s, v) => { await page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [s, v]); await sleep(350); };
  const click = async (s) => { await page.evaluate((s) => document.querySelector(s).click(), s); await sleep(350); };
  const cell = (ch, key) => q(`[data-change="${ch}"][data-key="${key}"]`);
  const noOverflow = async (tag) => eq(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth || [...document.querySelectorAll('.gw .ms-tb')].some((t) => t.scrollWidth > t.clientWidth + 1)), false, `[${vp}] ${tag}: 가로 넘침 없음`);
  const shot = async (tag, s) => { await page.evaluate((s) => document.querySelector(s)?.closest('.ps-row, details')?.scrollIntoView({ block: 'start' }), s); await sleep(300); await page.screenshot({ path: `${OUT}/${vp}-${tag}.png` }); };
  const reopen = async (node) => { await closeEditor(page, true); await openEditor(page, node); await sleep(300); };
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);

  /* ── 값 등급 (우주 쇼핑몰) ── */
  await openEditor(page, 'set:cos'); await sleep(300);
  const TR = q('.ms-tb:not(.ms-axs):not(.ms-pairs) .ms-tb-r');
  eq(await count(TR), 5, `[${vp}] 값 등급 기본 5줄`);
  eq(await count(q('[data-change="ms-roll"][data-key="cos:tiers"]')), 0, '옛 글 상자 없음');
  const names0 = await vals(q('[data-change="ms-tier"][data-key$=":name"]'));
  eq(names0, ['최저가', '저가', '중가', '고가', '최고가'], '기본 등급 이름이 칸에 들어 있다');
  eq(await vals(q('[data-change="ms-tier"][data-key="cos:3:lo"]')), ['10000000'], '고가 하한 기본값');
  eq(await count(q('.ms-tb-err')), 0, '기본값에는 붉은 글 없음');
  eq(await count(q('[data-action="ms-roll-reset"]')), 0, '고친 게 없으면 「기본값으로」 없음');
  // 숫자 상자는 공통 규격 그대로
  eq(await page.evaluate(() => [...document.querySelectorAll('.gw .ms-tb .st-step')].map((e) => Math.round(e.getBoundingClientRect().height))).then((h) => [...new Set(h)]), [34], '가중치 상자 높이 34');
  ok(await page.evaluate(() => { const a = document.querySelector('.gw .ms-tb .st-step'); const b = [...document.querySelectorAll('.gw .st-step')].find((e) => !e.closest('.ms-tb')); return !b || Math.round(a.getBoundingClientRect().width) === Math.round(b.getBoundingClientRect().width); }), '가중치 상자 폭 = 다른 숫자 상자 폭');
  // 같은 값을 다시 넣으면 저장 안 함
  await put(cell('ms-tier', 'cos:0:name'), '최저가');
  ok(!(await ss()).$cos_roll_tiers, '기본값과 같으면 저장 안 함');
  // 칸 하나 고침 → 옛 글 꼴, 나머지 줄 그대로
  await put(cell('ms-tier', 'cos:1:hi'), '5999999');
  const t1 = (await ss()).$cos_roll_tiers;
  eq(t1.split('\n').length, 5, '다섯 줄이 다 저장된다');
  eq(t1.split('\n')[1], '저가|common — modestly useful, low stakes|2500000|5999999|1', '「이름|설명|하한|상한|가중치」 꼴 그대로');
  ok(await page.evaluate(() => !!document.querySelector('.gw .ms-tb:not(.ms-axs)')?.closest('.ps-row')?.classList.contains('ps-changed')), '바꾼 줄 점');
  eq(await count(q('[data-action="ms-roll-reset"]')), 1, '「기본값으로」가 나온다');
  // 가중치 ±1, 0~99
  await click(q('[data-action="ms-tier-w"][data-value="cos:0:+"]'));
  eq((await ss()).$cos_roll_tiers.split('\n')[0].split('|')[4], '2', '가중치 +1');
  await click(q('[data-action="ms-tier-w"][data-value="cos:0:-"]')); await click(q('[data-action="ms-tier-w"][data-value="cos:0:-"]'));
  eq((await ss()).$cos_roll_tiers.split('\n')[0].split('|')[4], '0', '가중치 0까지');
  ok(await page.evaluate(() => document.querySelector('.gw [data-action="ms-tier-w"][data-value="cos:0:-"]').disabled), '0에서 − 잠김');
  // 등급 추가 → 빈 줄 + 붉은 글, 다시 그려도 남는다
  await click(q('[data-action="ms-tier-add"]'));
  eq(await count(TR), 6, '등급 추가');
  eq(await count(q('.ms-tb-r.bad .ms-tb-err')), 1, '덜 채운 줄에 붉은 글');
  await put(cell('ms-tier', 'cos:5:name'), '시험|등급'); await put(cell('ms-tier', 'cos:5:lo'), '50000000'); await put(cell('ms-tier', 'cos:5:hi'), '40000000');
  eq((await ss()).$cos_roll_tiers.split('\n')[5], '시험 등급||50000000|40000000|1', '세로줄 글자는 빈칸으로');
  ok((await page.evaluate(() => document.querySelector('.gw .ms-tb-r.bad .ms-tb-err')?.textContent)).includes('상한'), '상한 < 하한 붉은 글');
  await put(cell('ms-tier', 'cos:5:hi'), '60000000');
  eq(await count(q('.ms-tb-err')), 0, '고치면 붉은 글이 사라진다');
  await shot('tiers-edited', TR);
  await noOverflow('값 등급');
  // 닫았다 열어도 같은 값
  await reopen('set:cos');
  eq(await vals(q('[data-change="ms-tier"][data-key="cos:5:name"]')), ['시험 등급'], '다시 열어도 그대로'); eq(await count(TR), 6);
  // 줄 지우기
  await click(q('[data-action="ms-tier-del"][data-value="cos:5"]'));
  eq(await count(TR), 5, '× 로 줄 지우기');
  // 12줄 상한
  for (let i = 0; i < 7; i++) await click(q('[data-action="ms-tier-add"]'));
  eq(await count(TR), 12); ok(await page.evaluate(() => document.querySelector('.gw [data-action="ms-tier-add"]').disabled), '12줄이면 「등급 추가」 잠김');
  // 기본값으로
  await click(q('[data-action="ms-roll-reset"]'));
  ok(!(await ss()).$cos_roll_tiers, '「기본값으로」'); eq(await vals(q('[data-change="ms-tier"][data-key$=":name"]')), names0);
  // 다 지우면 기본값
  for (let i = 4; i >= 0; i--) await click(q(`[data-action="ms-tier-del"][data-value="cos:${i}"]`));
  ok(!(await ss()).$cos_roll_tiers, '다 지우면 저장을 비운다'); eq(await count(TR), 5, '다 지우면 기본 5줄이 돌아온다');

  /* ── 포인트몰: 값 등급(p) + 상담사 주사위 칸 ── */
  await goNode(page, 'set:bm'); await sleep(300);
  eq(await count(TR), 5, `[${vp}] 포인트몰 값 등급 기본 5줄`);
  await put(cell('ms-tier', 'bm:0:lo'), '40');
  ok((await ss()).$bm_roll_tiers.split('\n')[0].includes('|40|'), '포인트몰 값 등급 저장'); ok(!(await ss()).$cos_roll_tiers, '몰끼리 안 섞인다');
  await click(q('[data-action="ms-roll-reset"]')); ok(!(await ss()).$bm_roll_tiers);
  const AX = q('.ms-axs .ms-ax');
  eq(await count(AX), 7, '주사위 기본 7칸'); eq(await count(q('[data-change="ms-desk"][data-key="axes"]')), 0, '옛 글 상자 없음');
  eq(await count(q('.ms-axs .gx-chip')), 0, '칩 없음');
  const ax0 = await vals(q('[data-change="ms-ax-vals"]'));
  ok(ax0[0].startsWith('사원, 사원, 사원'), '값 칸에 기본 글(쉼표)');
  await put(cell('ms-ax-vals', '0'), ax0[0]);
  ok(!(await ss()).$bm_desk_axes, '같으면 저장 안 함'); eq(await count(q('[data-action="ms-desk-reset"]')), 0);
  await put(cell('ms-ax-vals', '0'), '사원，인턴, , 대리: 과장');
  const a1 = (await ss()).$bm_desk_axes;
  eq(a1.split('\n').length, 7, '일곱 칸이 다 저장된다');
  eq(a1.split('\n')[0], '직급: 사원, 인턴, 대리 과장', '「칸 이름: 값, 값」 꼴 그대로');
  await put(cell('ms-ax-name', '0'), '직급: 새');
  eq((await ss()).$bm_desk_axes.split('\n')[0], '직급 새: 사원, 인턴, 대리 과장', '이름의 쌍점은 빈칸으로');
  await click(q('[data-action="ms-ax-add"]'));
  eq(await count(AX), 8, '칸 추가'); eq(await count(q('.ms-ax.bad .ms-tb-err')), 1, '빈 칸에 붉은 글');
  await put(cell('ms-ax-name', '7'), '취미'); await put(cell('ms-ax-vals', '7'), '낚시, 등산');
  eq((await ss()).$bm_desk_axes.split('\n')[7], '취미: 낚시, 등산'); eq(await count(q('.ms-axs .ms-tb-err')), 0);
  await shot('axes-edited', AX);
  await noOverflow('주사위 칸');
  await reopen('set:bm');
  eq(await vals(q('[data-change="ms-ax-name"][data-key="7"]')), ['취미'], '다시 열어도 그대로');
  await click(q('[data-action="ms-ax-del"][data-value="7"]')); eq(await count(AX), 7);
  await click(q('[data-action="ms-desk-reset"]'));
  ok(!(await ss()).$bm_desk_axes, '「기본값으로」'); eq(await vals(q('[data-change="ms-ax-vals"]')), ax0);
  for (let i = 6; i >= 0; i--) await click(q(`[data-action="ms-ax-del"][data-value="${i}"]`));
  ok(!(await ss()).$bm_desk_axes); eq(await count(AX), 7, '다 지우면 기본 7칸');

  /* ── 그림 대체 말 (소지품): 접어 둠 ── */
  await goNode(page, 'set:items'); await sleep(300);
  const D = q('details[data-keep="items-alias"]');
  eq(await count(D), 1, `[${vp}] 그림 대체 말 접는 덩어리`);
  eq(await count(q('[data-change="set-items-alias"]')), 0, '옛 글 상자 없음');
  eq(await page.evaluate((s) => document.querySelector(s).open, D), false, '처음엔 접혀 있다');
  eq(await page.evaluate((s) => document.querySelector(`${s} > summary`).textContent.replace(/\s+/g, ' ').trim(), D), '그림 대체 말32줄', '제목 줄 + 줄 수');
  eq(await page.evaluate((s) => Math.round(document.querySelector(s).getBoundingClientRect().height), D), 46, '접힌 높이 46 (기존 접는 양식)');
  await shot('alias-closed', D);
  await page.evaluate((s) => { document.querySelector(`${s} > summary`).click(); }, D); await sleep(300);
  const AR = `${D} .ms-pairs .ms-tb-r`;
  eq(await count(AR), 32, '열면 32줄');
  eq(await vals(cell('set-items-alias-cell', '0:a')), ['외투']); eq(await vals(cell('set-items-alias-cell', '0:b')), ['코트']);
  // PC 는 한 줄에 두 쌍, 폰은 한 쌍
  const tops = await page.evaluate((s) => [...document.querySelectorAll(s)].slice(0, 2).map((e) => Math.round(e.getBoundingClientRect().top)), AR);
  eq(tops[0] === tops[1], vp === 'pc', vp === 'pc' ? 'PC: 한 줄에 두 쌍' : '폰: 한 줄에 한 쌍');
  await put(cell('set-items-alias-cell', '0:b'), '코트');
  ok(!(await ss()).$it_icon_alias, '같으면 저장 안 함');
  await put(cell('set-items-alias-cell', '0:b'), '재킷 → x');
  const al1 = (await ss()).$it_icon_alias;
  eq(al1.split('\n').length, 32, '32줄이 다 저장된다'); eq(al1.split('\n')[0], '외투 → 재킷 x', '「끝 말 → 바꿀 말」 꼴 그대로');
  eq(await page.evaluate((s) => document.querySelector(s).open, D), true, '고쳐도 접히지 않는다');
  ok(await page.evaluate((s) => document.querySelector(s).classList.contains('ps-changed'), D), '바꾼 표시');
  await click(q('[data-action="set-items-alias-add"]'));
  eq(await count(AR), 33, '추가'); eq(await page.evaluate((s) => document.querySelector(`${s} .adv-count`).textContent, D), '33줄');
  eq(await count(`${D} .ms-tb-err`), 0, '아직 빈 줄에는 붉은 글 없음');
  await put(cell('set-items-alias-cell', '32:a'), '시험말');
  eq(await count(`${D} .ms-tb-err`), 1, '한 칸만 채운 줄에 붉은 글');
  await put(cell('set-items-alias-cell', '32:b'), '코트');
  eq((await ss()).$it_icon_alias.split('\n')[32], '시험말 → 코트'); eq(await count(`${D} .ms-tb-err`), 0);
  await shot('alias-open', D);
  await noOverflow('그림 대체 말');
  await reopen('set:items');
  eq(await page.evaluate((s) => document.querySelector(s).open, D), true, '다시 열어도 펼친 채');
  eq(await vals(cell('set-items-alias-cell', '32:a')), ['시험말'], '다시 열어도 그대로');
  await click(q('[data-action="set-items-alias-del"][data-value="32"]'));
  eq(await count(AR), 32, '× 로 줄 지우기');
  await click(q('[data-action="set-items-alias-reset"]'));
  ok(!(await ss()).$it_icon_alias, '「기본값으로」'); eq(await vals(cell('set-items-alias-cell', '0:b')), ['코트']);
  eq(await count(q('[data-action="set-items-alias-reset"]')), 0);
  eq(errors.filter((e) => !/favicon/.test(e)), [], `[${vp}] 콘솔 오류 없음`);
  console.log(vp, 'ok');
  await page.close();
}

/* ── 시작 전 (새 채팅 기본값): 소지품 설정은 기본값에, 쇼핑몰 값은 이 채팅에 ── */
{
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, { width: 1920, height: 1080, touch: false });
  const put = async (s, v) => { await page.evaluate(([s, v]) => { const el = document.querySelector(s); el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); }, [s, v]); await sleep(350); };
  await openWin(page); await sleep(300);
  await openEditor(page, 'set:items'); await sleep(300);
  const D = '.gw details[data-keep="items-alias"]';
  eq(await page.locator(D).count(), 1, '시작 전: 그림 대체 말 덩어리');
  await page.evaluate((s) => { document.querySelector(s).open = true; }, D);
  await put('.gw [data-change="set-items-alias-cell"][data-key="1:b"]', '점퍼류');
  eq((await prefsOf(page)).vars?.$it_icon_alias?.split('\n')[1], '점퍼 → 점퍼류', '시작 전: 새 채팅 기본값에 저장');
  await page.evaluate(() => document.querySelector('.gw [data-action="set-items-alias-reset"]').click()); await sleep(350);
  ok(!(await prefsOf(page)).vars?.$it_icon_alias, '시작 전: 「기본값으로」');
  await goNode(page, 'set:cos'); await sleep(300);
  eq(await page.locator('.gw [data-change="ms-tier"][data-key="cos:0:name"]').count(), 1, '시작 전: 값 등급 표');
  await put('.gw [data-change="ms-tier"][data-key="cos:0:hi"]', '3000000');
  const where = await page.evaluate(() => ({ chat: window.__chat.scriptstate?.$cos_roll_tiers ?? '', prefs: JSON.parse(window.__store['p:goei:prefs'] || '{}').vars?.$cos_roll_tiers ?? '' }));
  ok((where.chat || where.prefs).split('\n')[0].endsWith('|999999|3000000|1'), `시작 전: 값 등급 저장 (${where.chat ? '이 채팅' : '기본값'})`);
  await goNode(page, 'set:bm'); await sleep(300);
  eq(await page.locator('.gw .ms-axs .ms-ax').count(), 7, '시작 전: 주사위 칸');
  eq(errors.filter((e) => !/favicon/.test(e)), [], '시작 전: 콘솔 오류 없음');
  console.log('pre-start ok');
  await page.close();
}
await browser.close();
console.log('ok', checks, 'checks', OUT);
