// 폰 공용 서랍(.gx-cdr: 하단 바 위 손잡이로 여는 사이트·설정 줄) 움직임 시험 (2026-11-12 사용자:
// 「서랍이 최하단바 뒤에서 올라와야 하는데 앞에서 올라오는것처럼 보인다 … 없던게 생기는거 같아 … 마지막줄이랑 최하단바랑은 여백이 살짝」)
//  ① 닫힘: 서랍이 바를 덮지 않고, 바 위의 버튼이 눌린다  ② 열리는 동안: 흐려지지 않고(opacity 1) 미끄러지기만 하며, 바 그림이 한 점도 안 바뀐다(= 바 뒤에서 올라옴)
//  ③ 손잡이가 서랍 윗선에 붙어 같이 움직인다  ④ 다 열림: 마지막 줄과 바 사이 여백 8 이상  ⑤ 닫힘도 같은 식  ⑥ 메뉴를 골라 다시 그려져도 미끄러져 닫힌다
//  ⑦ 메뉴마다 같다  ⑧ 움직임 줄이기 설정이면 바로 바뀐다
// 사용법: node tests/cdr-browser.mjs <fixture.json>
import { boot, closeEditor, launch, loadFixture, openWin, sleep } from './qc-settings-harness.mjs';

const PAD_MIN = 8;
const GRIP_H = 8;
const fx = loadFixture(process.argv[2]);
const browser = await launch();
let pass = 0; const fails = [];
const ok = (cond, name, info = '') => { if (cond) pass++; else { fails.push(`${name}${info ? ` — ${info}` : ''}`); console.log('FAIL', name, info); } };

const ss = { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_anomaly_on: '1', $pp_on: '0' };
const chat = { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동|목표]' }], scriptstate: ss };
const { page, errors } = await boot(browser, fx, chat, { width: 390, height: 844, touch: true });
await openWin(page);
const goTab = async (t) => { await page.evaluate((t) => document.querySelector(`.gx-nav [data-action="tab"][data-value="${t}"]`)?.click(), t); await sleep(500); };
await goTab('board'); await closeEditor(page, true).catch(() => {}); await goTab('board');
// 바 그림을 점 단위로 견주려고, 서랍과 상관없이 혼자 움직이는 것(오른쪽 아래 둥근 단추의 번짐 등)은 멈춘다. 서랍은 transition 이라 영향 없음
await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; }' });
await sleep(300);

const geo = () => page.evaluate(() => {
  const R = (e) => { const b = e.getBoundingClientRect(); return { t: b.top, b: b.bottom, l: b.left, r: b.right }; };
  const cdr = document.querySelector('.gx-cdr'), p = cdr.querySelector('.gx-cpanel'), g = cdr.querySelector('.gx-cgrip'), nav = cdr.closest('.gx-nav');
  const tools = [...p.querySelectorAll('.ph-tool')]; const cs = getComputedStyle(p); const n = R(nav);
  const at = (x, y) => { const e = document.elementFromPoint(x, y); return !e ? 'none' : e.closest('.gx-cpanel') ? 'panel' : e.closest('.gx-cgrip') ? 'grip' : e.closest('.gx-nav') ? 'nav' : 'other'; };
  return { panel: R(p), grip: R(g), nav: n, lastBottom: Math.max(...tools.map((e) => e.getBoundingClientRect().bottom)), op: +cs.opacity, vis: cs.visibility, clip: getComputedStyle(cdr).clipPath,
    open: cdr.classList.contains('open'), hitBar: at(innerWidth / 4, n.t + 20), hitAbove: at(innerWidth / 4, n.t - 30), sw: document.documentElement.scrollWidth, n: tools.length };
});
const cdrAnims = () => page.evaluate(() => document.getAnimations().filter((a) => a.effect?.target?.closest?.('.gx-cdr')).map((a) => `${a.transitionProperty}:${a.effect.getTiming().duration}`));
const seek = (ms) => page.evaluate((ms) => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.gx-cdr')) { a.pause(); a.currentTime = ms; } }, ms);
const finish = async () => { await page.evaluate(() => { for (const a of document.getAnimations()) if (a.effect?.target?.closest?.('.gx-cdr')) a.finish(); }); await sleep(60); };
const barShot = async () => { const g = await geo(); return (await page.screenshot({ clip: { x: 0, y: Math.ceil(g.nav.t) + 1, width: 390, height: Math.floor(g.nav.b - g.nav.t) - 2 } })).toString('base64'); };
const tapGrip = () => page.evaluate(() => document.querySelector('.gx-cgrip').click());

// ① 닫힘
const c0 = await geo();
const bar0 = await barShot();
ok(!c0.open && c0.vis === 'hidden', '닫힘: 서랍 줄이 숨겨져 있다', JSON.stringify([c0.open, c0.vis]));
ok(c0.hitBar === 'nav', '닫힘: 바 자리를 누르면 바가 눌린다', c0.hitBar);
ok(c0.hitAbove !== 'panel' && c0.hitAbove !== 'grip', '닫힘: 바 위(서랍이 올라올 자리)는 뒤의 화면이 눌린다', c0.hitAbove);
ok(c0.clip !== 'none', '그릇이 바 윗선에서 자른다 (clip-path)', c0.clip);
ok(Math.abs(c0.grip.b - c0.nav.t) <= 1.5 && Math.abs(c0.grip.b - c0.grip.t - GRIP_H) < 0.6, '닫힘: 손잡이가 바 바로 위에 붙어 있다', JSON.stringify([c0.grip, c0.nav.t]));

// ② ③ 열리는 동안
await tapGrip();
const an = await cdrAnims();
ok(an.some((a) => a.startsWith('transform:')), '열림: 미끄러짐(transform)이 돈다', an.join(' '));
ok(!an.some((a) => a.startsWith('opacity:')), '열림: 흐려졌다 나타나는 것(opacity)이 없다', an.join(' '));
const dur = Number((an.find((a) => a.startsWith('transform:')) ?? ':0').split(':')[1]);
ok(dur >= 200 && dur <= 300, '열림: 움직이는 시간 0.2~0.3초', String(dur));
const tops = [];
for (const f of [0.2, 0.4, 0.6, 0.8]) {
  await seek(dur * f); await sleep(40);
  const g = await geo(); tops.push(g.panel.t);
  ok(g.op === 1 && g.vis === 'visible', `열림 ${Math.round(f * 100)}%: 또렷하게 보인다`, JSON.stringify([g.op, g.vis]));
  ok(g.hitBar === 'nav', `열림 ${Math.round(f * 100)}%: 바 자리는 바가 눌린다 (서랍이 바를 덮지 않음)`, g.hitBar);
  ok((await barShot()) === bar0, `열림 ${Math.round(f * 100)}%: 바 그림이 닫힘 때와 똑같다 (바 뒤에서 올라옴)`);
  ok(Math.abs(g.grip.b - g.panel.t) < 0.6, `열림 ${Math.round(f * 100)}%: 손잡이가 서랍 윗선에 붙어 있다`, JSON.stringify([g.grip.b, g.panel.t]));
}
ok(tops.every((t, i) => i === 0 || t < tops[i - 1] - 1) && tops[0] < c0.panel.t - 1, '열림: 위치가 한 방향으로 올라간다', tops.map((t) => t.toFixed(1)).join(' > '));
// ④ 다 열림
await finish();
const o = await geo();
ok(o.open && Math.abs(o.panel.b - o.nav.t) <= 1.5, '다 열림: 서랍 밑이 바 윗선에 닿는다', JSON.stringify([o.panel.b, o.nav.t]));
ok(o.nav.t - o.lastBottom >= PAD_MIN, `다 열림: 마지막 줄과 바 사이 여백 ${PAD_MIN} 이상`, String(o.nav.t - o.lastBottom));
ok(o.hitAbove === 'panel', '다 열림: 서랍 줄이 눌린다', o.hitAbove);
ok((await barShot()) === bar0, '다 열림: 바 그림이 그대로다');
ok(o.sw <= 390, '가로 넘침 없음', String(o.sw));
ok(o.n >= 2 && o.panel.t > 0, '서랍 줄이 화면 안에 다 들어온다', JSON.stringify([o.n, o.panel.t]));

// ⑤ 닫히는 동안
await tapGrip();
const an2 = await cdrAnims();
ok(an2.some((a) => a.startsWith('transform:')) && !an2.some((a) => a.startsWith('opacity:')), '닫힘: 미끄러지기만 한다', an2.join(' '));
const downs = [];
for (const f of [0.25, 0.5, 0.75]) {
  await seek(dur * f); await sleep(40);
  const g = await geo(); downs.push(g.panel.t);
  ok(g.op === 1 && g.vis === 'visible', `닫힘 ${Math.round(f * 100)}%: 사라지지 않고 보이는 채로 내려간다`, JSON.stringify([g.op, g.vis]));
  ok((await barShot()) === bar0, `닫힘 ${Math.round(f * 100)}%: 바 그림이 그대로다 (바 뒤로 내려감)`);
}
ok(downs.every((t, i) => i === 0 || t > downs[i - 1] + 1), '닫힘: 위치가 한 방향으로 내려간다', downs.map((t) => t.toFixed(1)).join(' < '));
await finish();
const c1 = await geo();
ok(!c1.open && c1.vis === 'hidden' && c1.hitAbove !== 'panel', '다 닫힘: 서랍 줄이 숨고 뒤가 눌린다', JSON.stringify([c1.vis, c1.hitAbove]));

// ⑥ 메뉴를 골라 다시 그려질 때
await tapGrip(); await finish();
await page.evaluate(() => document.querySelector('.gx-nav [data-action="tab"][data-value="records"]').click());
await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const an3 = await cdrAnims();
ok(an3.some((a) => a.startsWith('transform:')), '메뉴를 고르면: 뚝 사라지지 않고 미끄러져 닫힌다', an3.join(' ') || '움직임 없음');
await finish(); await sleep(300);
const c2 = await geo();
ok(!c2.open && c2.vis === 'hidden', '메뉴를 고른 뒤: 닫혀 있다', JSON.stringify([c2.open, c2.vis]));

// ⑦ 메뉴마다
for (const t of ['map', 'records', 'board', 'phone', 'items']) {
  const has = await page.evaluate((t) => !!document.querySelector(`.gx-nav [data-action="tab"][data-value="${t}"]`), t);
  if (!has) continue;
  await goTab(t);
  const a = await geo();
  await tapGrip(); await finish();
  const b = await geo();
  ok(!a.open && a.hitBar === 'nav' && a.vis === 'hidden', `${t}: 닫힘 모습`, JSON.stringify([a.open, a.hitBar, a.vis]));
  ok(b.open && b.nav.t - b.lastBottom >= PAD_MIN && Math.abs(b.grip.b - b.panel.t) < 0.6 && b.hitAbove === 'panel' && b.sw <= 390, `${t}: 열림 모습 (여백·손잡이·눌림)`, JSON.stringify([b.nav.t - b.lastBottom, b.grip.b - b.panel.t, b.hitAbove, b.sw]));
  await tapGrip(); await finish();
}
// 서랍에서 사이트를 고르면 인터넷으로 가고 닫힌다. 인터넷 안에서도 서랍이 같다
await goTab('board'); await tapGrip(); await finish();
await page.evaluate(() => document.querySelector('.gx-cdr.open .gx-cpanel [data-action="br-site"]').click());
await sleep(800); await finish();
const n1 = await geo();
ok(!n1.open && n1.vis === 'hidden', '사이트를 고른 뒤: 닫혀 있다', JSON.stringify([n1.open, n1.vis]));
await tapGrip(); await finish();
const n2 = await geo();
ok(n2.open && n2.nav.t - n2.lastBottom >= PAD_MIN && n2.hitAbove === 'panel', '인터넷 안: 열림 모습', JSON.stringify([n2.nav.t - n2.lastBottom, n2.hitAbove]));
await tapGrip(); await finish();
// 설정 창의 폰 바에는 서랍이 없다 (그대로)
await tapGrip(); await finish();
await page.evaluate(() => document.querySelector('.gx-cdr.open .gx-cpanel [data-action="ed-open"]').click());
await sleep(900);
const ed = await page.evaluate(() => ({ nav: !!document.querySelector('.gw-nav'), cdr: !!document.querySelector('.gw-nav .gx-cdr') }));
ok(ed.nav && !ed.cdr, '설정 창: 폰 바가 있고 서랍은 없다', JSON.stringify(ed));
await closeEditor(page, true).catch(() => {});
await sleep(400);

// ⑧ 움직임 줄이기
await page.emulateMedia({ reducedMotion: 'reduce' });
await goTab('board');
if ((await geo()).open) { await tapGrip(); await sleep(100); }
await tapGrip();
const an4 = await cdrAnims();
const r1 = await geo();
ok(an4.length === 0 && r1.open && r1.vis === 'visible' && Math.abs(r1.panel.b - r1.nav.t) <= 1.5, '움직임 줄이기: 바로 열린다', JSON.stringify([an4, r1.open, r1.vis]));
await tapGrip();

ok(errors.length === 0, '콘솔 오류 없음', errors.slice(0, 2).join(' | '));
console.log(`cdr-browser: ${pass} pass, ${fails.length} fail`);
await browser.close();
process.exit(fails.length ? 1 : 0);
