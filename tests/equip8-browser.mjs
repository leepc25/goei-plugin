// 소지품 위쪽 띠 (2026-11-12 사용자): 장착 8칸(손 2 · 장비 6, 사용자 2026-11-14: 무기 칸 → 손 칸), PC [아바타 256 | 장착 4열×2줄 칸 97 | 사용 칸], 아바타·장착 묶음에 끌어 놓기,
// 폰 [아바타 | 장착 2열×4줄 칸 59] · 사용 칸 없음 · 장착 칸 무게 글자 숨김 · 누르면 「사용」/「사용 취소」, 상점 팔기 화면의 8칸.
// 사용법: node tests/equip8-browser.mjs [out-dir]   (PART=layout,drag,phone,sell 로 절 고르기)
import { mkdirSync } from 'node:fs';
import { boot, closeEditor, closeWin, launch, loadFixture, openWin, sleep, VIEWPORTS } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
const out = process.argv[2] ?? '/tmp/equip8-shots';
mkdirSync(out, { recursive: true });
const PART = (process.env.PART ?? 'layout,drag,phone,sell').split(',');
const SCALE = Number(process.env.SCALE ?? 1);
const V = (vp) => (SCALE === 1 ? vp : { ...(typeof vp === 'string' ? VIEWPORTS[vp] : vp), scale: SCALE });
const store = { 'p:goei:data-items': distPack('goei-data-items'), 'p:goei:data-looks': distPack('goei-data-looks') };
const at = '2026-11-07T00:00:00Z';
const I = (id, name, o = {}) => ({ id, name, desc: '', effect: '', use: false, state: 'ok', from: 'manual', anchor: '', at, ...o });
/** 물건 목록. full = 8칸 다 참, part = 장비 첫 칸·넷째 칸만(저장된 slot 3 이 넷째 장비 칸에 그대로 있는지), none = 아무것도 안 참 */
const listOf = (kase) => {
  const full = kase === 'full', eq = kase !== 'none';
  return [
    I('i_mask', '토끼 가면', { equip: 'gear', ...(eq ? { slot: 0 } : {}), weight: 0.2 }),
    I('i_glove', '가죽 장갑', { equip: 'gear', ...(full ? { slot: 1 } : {}), weight: 0.2 }),
    I('i_light', '소형 손전등', { use: true, weight: 0.3 }),
    I('i_suit', '사내용 정장 세트', { equip: 'gear', ...(full ? { slot: 2 } : {}), weight: 1.2 }),
    I('i_pouch', '전술 벨트 파우치', { weight: 0.4 }),
    I('i_candy', '딸기맛 막대사탕', { use: true, uses: 2, weight: 0.04 }),
    I('i_gown', '일회용 병원 가운', { equip: 'gear', weight: 0.3 }),
    I('i_vest', '방검 조끼', { equip: 'gear', ...(eq ? { slot: 3 } : {}), weight: 1.5 }),
    I('i_boot', '안전화', { equip: 'gear', ...(full ? { slot: 4 } : {}), weight: 0.9 }),
    I('i_gas', '방독면', { equip: 'gear', ...(full ? { slot: 5 } : {}), weight: 0.6 }),
    I('i_baton', '삼단봉', { equip: 'weapon', use: true, ...(full ? { slot: 0 } : {}), weight: 0.5 }),
    I('i_bar', '쇠지렛대', { equip: 'weapon', ...(full ? { slot: 1 } : {}), weight: 1.8 }),
  ];
};
const chatOf = (kase, use = [], theme = 'dark', tail = '') => ({
  message: [{ role: 'user', data: 'hi', chatId: 'u1' }, { role: 'char', data: `본문\n[▣|2025.03.10|05:52 PM|🌧|8°C|중림동 손길 의원 회복실|목표]${tail}`, chatId: 'c1' }],
  scriptstate: { $st_look: '7.1', $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: theme, $st_anomaly_on: '1', $pp_on: '0', $st_items: JSON.stringify({ list: listOf(kase), log: [] }), $st_item_use: JSON.stringify(use) },
});
const b = await launch();
const errorsAll = [];
const report = {};
const bad = (m) => { errorsAll.push(m); console.log('  ✗', m); };

async function openItems(vp, chat) {
  const { page, errors } = await boot(b, fx, chat, V(vp), { store });
  await openWin(page); await sleep(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await sleep(200);
  await page.evaluate(() => document.querySelector('[data-action="tab"][data-value="items"], [data-action="nav-tab"][data-value="items"]')?.click());
  await sleep(900);
  return { page, errors };
}
const measure = (page, root = '.gx-items') => page.evaluate((root) => {
  const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) }; };
  const one = (q) => { const e = document.querySelector(q); return e && e.offsetParent ? R(e) : null; };
  const slots = [...document.querySelectorAll(`${root} .it-eqslots .it-slot`)].map((e) => ({ ...R(e), drop: e.dataset.drop, empty: e.classList.contains('empty'), id: e.dataset.value ?? '', wt: (() => { const w = e.querySelector('.it-wt'); return w ? getComputedStyle(w).display !== 'none' : null; })() }));
  const box = document.querySelector(`${root} .it-eqbox, ${root}.it-eqbox`);
  return { win: [innerWidth, innerHeight], box: box ? R(box) : null, av: one(`${root} .it-av`), eqcol: one(`${root} .it-eqcol`), eqslots: one(`${root} .it-eqslots`), slots, usebox: one(`${root} .it-usebox`), hint: document.querySelector(`${root} .it-uhint`)?.textContent ?? null, over: document.documentElement.scrollWidth > innerWidth, boxOver: box ? box.scrollWidth > box.clientWidth + 1 : null };
}, root);
/** 칸 수·차례·크기·배치(열 수) 확인 */
function checkSlots(tag, m, size, cols) {
  const want = ['equip:weapon:0', 'equip:weapon:1', ...[0, 1, 2, 3, 4, 5].map((i) => `equip:gear:${i}`)];
  if (m.slots.map((s) => s.drop).join() !== want.join()) bad(`[${tag}] 칸 차례: ${m.slots.map((s) => s.drop).join()}`);
  const sz = [...new Set(m.slots.map((s) => `${s.w}x${s.h}`))];
  if (size && (sz.length !== 1 || sz[0] !== `${size}x${size}`)) bad(`[${tag}] 칸 크기 ${sz.join(' ')} (바람 ${size})`);
  if (sz.length !== 1) bad(`[${tag}] 칸 크기가 섞임 ${sz.join(' ')}`);
  const xs = [...new Set(m.slots.map((s) => s.x))], ys = [...new Set(m.slots.map((s) => s.y))];
  if (xs.length !== cols || ys.length !== 8 / cols) bad(`[${tag}] 배치 ${xs.length}열×${ys.length}줄 (바람 ${cols}열×${8 / cols}줄)`);
  // 겹침 없음, 줄 차례 = 왼쪽 위부터
  m.slots.forEach((s, i) => { if (s.x !== xs.sort((a, c) => a - c)[i % cols] || s.y !== ys.sort((a, c) => a - c)[Math.floor(i / cols)]) bad(`[${tag}] ${i}번 칸 자리 (${s.x},${s.y})`); });
  if (m.over) bad(`[${tag}] 화면 가로 넘침`);
  if (m.boxOver) bad(`[${tag}] 띠 안 가로 넘침`);
  return { size: sz.join(' '), cols: xs.length, rows: ys.length };
}
/** 사용 예정·칸 자리. 칸 값은 `갈래:번호`, 제 갈래가 아닌데 손에 든(held) 물건은 `held:번호` (held 표시가 빠지면 화면 손 칸에 안 보인다) */
const stateOf = (page) => page.evaluate(() => ({ use: JSON.parse(window.__chat.scriptstate.$st_item_use || '[]'), slots: Object.fromEntries(JSON.parse(window.__chat.scriptstate.$st_items).list.filter((x) => x.slot !== undefined).map((x) => [x.id, `${x.held === true ? 'held' : x.equip}:${x.slot}`])), note: [...document.querySelectorAll('.gx-toast, .gx-note, [role="status"]')].map((e) => e.textContent.trim()).filter(Boolean).join(' / ') }));

// ── 1. PC 배치: 실제 창 1920×1080, 그리고 1100×900·좁은 PC 800×900
if (PART.includes('layout')) {
  for (const [name, vp] of [['pc1920', { width: 1920, height: 1080, touch: false }], ['pc1100', 'pc'], ['pc800', { width: 800, height: 900, touch: false }]]) {
    for (const kase of ['full', 'none']) {
      const { page, errors } = await openItems(vp, chatOf(kase, kase === 'full' ? [{ id: 'i_light', n: 1 }, { id: 'i_candy', n: 2 }] : []));
      const m = await measure(page);
      const c = checkSlots(`${name}/${kase}`, m, name === 'pc1920' ? 97 : 0, 4);
      if (!m.usebox) bad(`[${name}/${kase}] PC 에 사용 칸이 없음`);
      if (kase === 'none' && !/끌어다 놓으면/.test(m.hint ?? '')) bad(`[${name}/${kase}] 빈 사용 칸 안내 글: ${m.hint}`);
      if (name === 'pc1920' && m.eqslots?.w !== 412) bad(`[${name}/${kase}] 장착 칸 묶음 폭 ${m.eqslots?.w} (바람 412)`);
      if (name === 'pc1100' && (m.box?.h !== 286 || m.usebox?.w < 160 || m.slots[0].w < 59)) bad(`[${name}/${kase}] 좁은 창 한 줄 배치: 띠 ${m.box?.h} 사용 칸 ${m.usebox?.w} 칸 ${m.slots[0].w}`);
      if (name === 'pc1920') {
        if (m.av?.w !== 256) bad(`[${name}/${kase}] 아바타 폭 ${m.av?.w} (바람 256)`);
        if (m.box?.h !== 286) bad(`[${name}/${kase}] 띠 높이 ${m.box?.h} (바람 286)`);
      }
      if (m.usebox && m.box && m.usebox.x + m.usebox.w > m.box.x + m.box.w) bad(`[${name}/${kase}] 사용 칸이 띠 밖으로`);
      report[`${name}/${kase}`] = { win: m.win.join('×'), 띠: m.box && `${m.box.w}×${m.box.h}`, 아바타: m.av && `${m.av.w}×${m.av.h}`, 장착칸묶음: m.eqslots && `${m.eqslots.w}×${m.eqslots.h}`, 칸: c.size, 배치: `${c.cols}열×${c.rows}줄`, 사용칸: m.usebox && `${m.usebox.w}×${m.usebox.h}` };
      await page.screenshot({ path: `${out}/${name}_${kase}.png` });
      errorsAll.push(...errors.map((e) => `[${name}/${kase}] ${e}`));
      await page.close();
    }
  }
}

// ── 2. PC 끌어 놓기 (실제 끌기 이벤트)
if (PART.includes('drag')) {
  const { page, errors } = await openItems({ width: 1920, height: 1080, touch: false }, chatOf('part'));
  const drag = async (from, to, pos) => { await page.dragAndDrop(from, to, pos ? { targetPosition: pos } : {}); await sleep(450); };
  const cell = (id) => `.it-grid .it-c[data-value="${id}"]`;
  const s0 = await stateOf(page);
  // 저장된 slot 3 은 넷째 장비 칸(아랫줄 둘째)에 그대로
  const m0 = await measure(page);
  if (s0.slots.i_vest !== 'gear:3' || m0.slots[5].id !== 'i_vest' || m0.slots[2].id !== 'i_mask') bad(`[drag] 저장된 칸 자리: ${JSON.stringify(s0.slots)} / 화면 ${m0.slots.map((s) => s.id || '-').join()}`);
  // ① 쓰는 물건 → 아바타 = 사용 예정
  await drag(cell('i_candy'), '.gx-items .it-av');
  const s1 = await stateOf(page);
  if (!s1.use.some((u) => u.id === 'i_candy' && u.n === 1)) bad(`[drag①] 쓰는 물건 → 아바타: ${JSON.stringify(s1.use)}`);
  if (JSON.stringify(s1.slots) !== JSON.stringify(s0.slots)) bad(`[drag①] 장착이 바뀜 ${JSON.stringify(s1.slots)}`);
  await drag(cell('i_candy'), '.gx-items .it-av');
  const s1b = await stateOf(page);
  if (!s1b.use.some((u) => u.id === 'i_candy' && u.n === 2)) bad(`[drag①] 두 번째 놓기 ×2: ${JSON.stringify(s1b.use)}`);
  // ② 장착 물건 → 아바타 = 맞는 갈래 첫 빈 칸 (장비 0·3 이 차 있으니 1)
  await drag(cell('i_gown'), '.gx-items .it-av');
  const s2 = await stateOf(page);
  if (s2.slots.i_gown !== 'gear:1') bad(`[drag②] 장비 → 아바타: ${JSON.stringify(s2.slots)}`);
  // ②b 장착 물건 → 장착 묶음(능력치 줄 자리) = 다음 빈 칸 2
  await drag(cell('i_glove'), '.gx-items .it-eqcol', { x: 12, y: 6 });
  const s2b = await stateOf(page);
  if (s2b.slots.i_glove !== 'gear:2') bad(`[drag②b] 장비 → 장착 묶음: ${JSON.stringify(s2b.slots)}`);
  // ③ 쓸 수도 장착할 수도 있는 물건 → 아바타 = 장착
  await drag(cell('i_baton'), '.gx-items .it-av');
  const s3 = await stateOf(page);
  if (s3.slots.i_baton !== 'weapon:0' || s3.use.some((u) => u.id === 'i_baton')) bad(`[drag③] 둘 다 되는 물건: ${JSON.stringify(s3)}`);
  // 칸에 직접 놓기 그대로: 새로 생긴 여섯째 장비 칸(5)
  await drag(cell('i_suit'), '[data-drop="equip:gear:5"]');
  const s4 = await stateOf(page);
  if (s4.slots.i_suit !== 'gear:5') bad(`[drag] 칸에 직접 놓기(장비 6번째 칸): ${JSON.stringify(s4.slots)}`);
  await drag(cell('i_boot'), '[data-drop="equip:gear:4"]');
  const s5 = await stateOf(page);
  if (s5.slots.i_boot !== 'gear:4') bad(`[drag] 칸에 직접 놓기(장비 5번째 칸): ${JSON.stringify(s5.slots)}`);
  const sans = (o, id) => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([k]) => k !== id)));
  // 갈래도 사용도 없는 물건 → 아바타 = 빈 손 칸에 든다 (사용자 2026-11-14: 손 칸에는 아무 물건이나). 손 0 은 삼단봉이라 빈 손 칸은 1
  await drag(cell('i_pouch'), '.gx-items .it-av');
  const s5p = await stateOf(page);
  const m5p = await measure(page);
  if (s5p.slots.i_pouch !== 'held:1' || m5p.slots[1].id !== 'i_pouch') bad(`[drag] 갈래 없는 물건 → 아바타(빈 손 칸): ${JSON.stringify(s5p.slots)} / 화면 ${m5p.slots.map((x) => x.id || '-').join()}`);
  if (sans(s5p.slots, 'i_pouch') !== JSON.stringify(s5.slots) || JSON.stringify(s5p.use) !== JSON.stringify(s5.use)) bad(`[drag] 갈래 없는 물건을 들었는데 다른 것이 바뀜 ${JSON.stringify(s5p)}`);
  // 손 칸의 물건 → 격자 = 손에서 내린다 (다음 단계가 빈 손 칸 1 을 쓴다)
  await drag('.gx-items .it-eqslots .it-slot[data-value="i_pouch"]', '.gx-items .it-grid', { x: 8, y: 8 });
  const s5q = await stateOf(page);
  if (JSON.stringify([s5q.use, s5q.slots]) !== JSON.stringify([s5.use, s5.slots]) || !(await page.$(cell('i_pouch')))) bad(`[drag] 손 칸 → 격자로 안 내려감 ${JSON.stringify(s5q.slots)}`);
  // 손 칸에는 아무 물건이나 (사용자 2026-11-14): 쓰는 물건(장착 갈래 없음)을 빈 손 칸 위에 놓으면 그 손 칸에 든다. 사용 예정에는 안 들어간다
  await drag(cell('i_light'), '[data-drop="equip:weapon:1"]');
  const s6 = await stateOf(page);
  const m6 = await measure(page);
  if (s6.use.some((u) => u.id === 'i_light') || JSON.stringify(s6.use) !== JSON.stringify(s5q.use)) bad(`[drag] 손 칸에 놓은 물건이 사용 예정에: ${JSON.stringify(s6.use)}`);
  if (s6.slots.i_light !== 'held:1' || m6.slots[1].id !== 'i_light') bad(`[drag] 손 칸에 안 들어감 ${JSON.stringify(s6.slots)} / 화면 ${m6.slots.map((x) => x.id || '-').join()}`);
  if (sans(s6.slots, 'i_light') !== JSON.stringify(s5q.slots)) bad(`[drag] 손 칸에 놓았는데 다른 칸이 바뀜 ${JSON.stringify(s6.slots)}`);
  // 손 2칸이 다 참(삼단봉·손전등) → 갈래 없는 물건을 아바타에 놓으면 제자리 + 안내 글
  await drag(cell('i_pouch'), '.gx-items .it-av');
  const s7 = await stateOf(page);
  const txt7 = await page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
  if (JSON.stringify([s7.use, s7.slots]) !== JSON.stringify([s6.use, s6.slots])) bad(`[drag] 손이 꽉 찼는데 무언가 바뀜 ${JSON.stringify(s7)}`);
  if (!txt7.includes('손 칸이 다 찼어요')) bad(`[drag] 손이 꽉 찼는데 안내 글이 안 보임`);
  if (!(await page.$(cell('i_pouch')))) bad(`[drag] 손이 꽉 찼는데 물건이 격자에서 사라짐`);
  // ④ 장비 6칸이 다 참 → 아바타에 놓으면 제자리 + 안내 글
  const before = await stateOf(page);
  if (Object.values(before.slots).filter((v) => v.startsWith('gear:')).length !== 6) bad(`[drag④] 준비: 장비 6칸이 다 안 참 ${JSON.stringify(before.slots)}`);
  await drag(cell('i_gas'), '.gx-items .it-av');
  const s8 = await stateOf(page);
  const txt = await page.evaluate(() => document.querySelector('.gx')?.innerText ?? '');
  if (s8.slots.i_gas !== undefined || JSON.stringify(s8.slots) !== JSON.stringify(before.slots)) bad(`[drag④] 꽉 찼는데 바뀜 ${JSON.stringify(s8.slots)}`);
  if (!txt.includes('장비 칸이 다 찼어요')) bad(`[drag④] 안내 글이 안 보임`);
  if (!(await page.$(cell('i_gas')))) bad(`[drag④] 물건이 격자에서 사라짐`);
  await page.screenshot({ path: `${out}/pc_drag_full.png` });
  // 사용 칸에 직접 놓기 그대로
  await drag(cell('i_candy'), '[data-drop="use"]');
  const s9 = await stateOf(page);
  if (!s9.use.some((u) => u.id === 'i_candy' && u.n === 2)) bad(`[drag] 사용 칸 놓기(남은 2회라 2에서 멈춤): ${JSON.stringify(s9.use)}`);
  // 끄는 동안 놓을 자리 표시: 아바타 위에 올리면 it-over-ok
  const src = await (await page.$(cell('i_gas'))).boundingBox();
  const av = await (await page.$('.gx-items .it-av')).boundingBox();
  await page.mouse.move(src.x + src.width / 2, src.y + src.height / 2); await page.mouse.down();
  await page.mouse.move(src.x + src.width / 2 + 20, src.y + src.height / 2 - 20, { steps: 4 });
  await page.mouse.move(av.x + av.width / 2, av.y + av.height / 2, { steps: 8 }); await sleep(250);
  const hover = await page.evaluate(() => ({ av: document.querySelector('.gx-items .it-av')?.classList.contains('it-over-ok'), dragging: !!document.querySelector('.it-dragging') }));
  await page.screenshot({ path: `${out}/pc_drag_over_avatar.png` });
  await page.mouse.up(); await sleep(300);
  if (!hover.av) bad(`[drag] 끄는 동안 아바타 자리 표시가 없음 ${JSON.stringify(hover)}`);
  report.drag = { '①쓰는 물건→아바타': s1b.use, '②장비→아바타': s2.slots.i_gown, '②b장비→장착 묶음': s2b.slots.i_glove, '③둘 다→아바타': s3.slots.i_baton, '칸에 직접(장비5·6번째)': [s5.slots.i_boot, s4.slots.i_suit], '갈래 없는 물건→아바타': s5p.slots.i_pouch, '쓰는 물건→칸 위': s6.slots.i_light, '손 꽉 참': '제자리 + 안내 글', '④꽉 참': '제자리 + 안내 글' };
  errorsAll.push(...errors.map((e) => `[drag] ${e}`));
  await page.close();
}

// ── 3. 폰: 사용 칸 없음, 2열×4줄 칸 59, 장착 칸 무게 글자 숨김, 누르면 「사용」/「사용 취소」
if (PART.includes('phone')) {
  for (const kase of ['full', 'none']) {
    const { page, errors } = await openItems('phone', chatOf(kase, kase === 'full' ? [{ id: 'i_light', n: 1 }] : []));
    const m = await measure(page);
    const c = checkSlots(`phone/${kase}`, m, 59, 2);
    if (m.usebox || await page.$('.gx-items .it-usebox')) bad(`[phone/${kase}] 사용 칸이 있음`);
    const txt = await page.evaluate(() => document.querySelector('.gx-items')?.innerText ?? '');
    if (/끌어다 놓으면|여기에 모여요/.test(txt)) bad(`[phone/${kase}] 사용 안내 글이 남음`);
    if (kase === 'full' && m.slots.some((s) => s.wt !== false)) bad(`[phone/full] 장착 칸 무게 글자가 보임 ${m.slots.map((s) => s.wt).join()}`);
    // 4줄 높이가 아바타 높이를 넘지 않음 (사용자: 아바타에 비해 너무 길면 안 됨)
    if (!m.av || !m.eqslots || m.eqslots.h > m.av.h + 1 || m.eqslots.y < m.av.y - 1) bad(`[phone/${kase}] 장착 칸 4줄(${m.eqslots?.h})이 아바타(${m.av?.h}) 옆에 안 맞음`);
    report[`phone/${kase}`] = { win: m.win.join('×'), 띠: m.box && `${m.box.w}×${m.box.h}`, 아바타: m.av && `${m.av.w}×${m.av.h}`, 장착칸묶음: m.eqslots && `${m.eqslots.w}×${m.eqslots.h}`, 칸: c.size, 배치: `${c.cols}열×${c.rows}줄`, 사용칸: '없음' };
    await page.screenshot({ path: `${out}/phone_${kase}.png` });
    if (kase === 'full') {
      // 격자 칸의 무게 글자는 그대로, 장착 칸을 누르면 팝업에 무게
      const gridWt = await page.evaluate(() => { const w = document.querySelector('.it-grid .it-c .it-wt'); return w ? getComputedStyle(w).display : null; });
      if (gridWt === 'none' || gridWt === null) bad(`[phone] 격자 칸 무게 글자까지 숨음 (${gridWt})`);
      await page.evaluate(() => document.querySelector('.gx-items .it-eqslots [data-value="i_vest"]')?.click()); await sleep(400);
      const pop = await page.evaluate(() => [...document.querySelectorAll('.it-pop, .gx-sheet, .it-sheet, [role="dialog"]')].filter((e) => e.getClientRects().length).map((e) => e.innerText).join('\n'));
      if (!/1\.5\s*kg/.test(pop)) bad(`[phone] 장착 칸 팝업에 무게가 없음: ${pop.slice(0, 200)}`);
      await page.screenshot({ path: `${out}/phone_slot_popup.png` });
      await page.evaluate(() => document.querySelector('[data-action="items-close"]')?.click()); await sleep(300);
      // 사용 흐름: 물건 → 사용 → 「사용 예정」 딱지 → 한 번 더(×2) → 사용 취소
      const press = (a) => page.evaluate((a) => { const e = [...document.querySelectorAll(`[data-action="${a}"]`)].find((x) => x.offsetParent); e?.click(); return !!e; }, a);
      const tags = () => page.evaluate(() => [...document.querySelectorAll('.it-grid .it-q8')].map((e) => `${e.closest('.it-c').dataset.value}:${e.textContent.trim()}`));
      await page.evaluate(() => document.querySelector('.it-grid .it-c[data-value="i_candy"]')?.click()); await sleep(400);
      const f1 = await press('items-use'); await sleep(450);
      const t1 = await tags();
      const f2 = await press('items-use'); await sleep(450);
      const t2 = await tags();
      await page.screenshot({ path: `${out}/phone_use_queued.png` });
      const f3 = await press('items-unuse'); await sleep(450);
      const t3 = await tags(); const u3 = (await stateOf(page)).use;
      if (!f1 || !t1.some((t) => t.startsWith('i_candy:사용 예정'))) bad(`[phone] 사용 → 딱지: ${f1} ${t1}`);
      if (!f2 || !t2.some((t) => /^i_candy:사용 예정.*2/.test(t))) bad(`[phone] 사용 두 번 → ×2: ${f2} ${t2}`);
      if (!f3 || t3.some((t) => t.startsWith('i_candy')) || u3.some((u) => u.id === 'i_candy')) bad(`[phone] 사용 취소: ${f3} ${t3} ${JSON.stringify(u3)}`);
      report['phone/사용 흐름'] = { 사용: t1.join(), '사용 한 번 더': t2.join(), '사용 취소 뒤': t3.join() || '(딱지 없음)' };
    }
    errorsAll.push(...errors.map((e) => `[phone/${kase}] ${e}`));
    await page.close();
  }
}

// ── 4. 상점 팔기 화면: 장착 8칸이 넘치지 않고 다 보임 (PC·폰)
if (PART.includes('sell')) {
  const SHELF = `<shop-identity>\nsells: 공구\nnever: 식품\nprices: 동네 값\nprice_range: 1000~200000\n</shop-identity>\n<owner>뭐 찾소.</owner>\n<shelf>\n손전등|18000|사용|flashlight|LED 손전등|어두운 곳을 비춘다\n</shelf>`;
  for (const [name, vp] of [['pc1920', { width: 1920, height: 1080, touch: false }], ['pc1100', 'pc'], ['phone', 'phone']]) {
    const chat = chatOf('full', [], 'dark', '\n[shop: 을지로 철물점|백사헌]');
    chat.message[1].data = chat.message[1].data.replace('중림동 손길 의원 회복실', '을지로 철물점');
    const CHAR = chat.message[1].data;
    const { page, errors } = await boot(b, fx, chat, V(vp), { store });
    await openWin(page); await sleep(300);
    if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
    await sleep(200);
    await page.evaluate(async () => { await window.__calls.listeners[0]({ char: window.__char, chat: window.__chat, characterIndex: 0, chatIndex: 0, messageIndex: 1 }); });
    await sleep(300);
    const html = await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
    await closeWin(page); await sleep(200);
    await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:20px;width:420px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
    await page.evaluate((t) => window.__calls.handlers.display(t), CHAR);
    await page.evaluate((t) => { window.__llm = [t]; }, SHELF);
    await page.click('#chat-card [data-goei-shop]');
    await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
    await page.waitForFunction(() => !!document.querySelector('.gx-solo'), null, { timeout: 8000 }).catch(() => {});
    await page.waitForFunction(() => !document.querySelector('.sh-spin'), null, { timeout: 8000 }).catch(() => {}); await sleep(300);
    await page.evaluate(() => { const x = document.createElement('button'); x.dataset.action = 'shop-pick'; x.style.display = 'none'; document.querySelector('.gx-panel')?.appendChild(x); x.click(); x.remove(); });
    await sleep(500);
    const m = await measure(page, '.sh-pick');
    if (m.slots.length !== 8) bad(`[sell/${name}] 칸 수 ${m.slots.length}`);
    else {
      const want = ['equip:weapon:0', 'equip:weapon:1', ...[0, 1, 2, 3, 4, 5].map((i) => `equip:gear:${i}`)];
      if (m.slots.map((s) => s.drop).join() !== want.join()) bad(`[sell/${name}] 칸 차례`);
      if (new Set(m.slots.map((s) => `${s.w}x${s.h}`)).size !== 1) bad(`[sell/${name}] 칸 크기 섞임 ${m.slots.map((s) => `${s.w}x${s.h}`).join()}`);
      if (m.slots.some((s) => s.empty)) bad(`[sell/${name}] 찬 칸이 비어 보임`);
    }
    const fit = await page.evaluate(() => {
      const zone = document.querySelector('.sh-pick .sh-mine')?.getBoundingClientRect(); const body = document.querySelector('.sh-body');
      const out = [...document.querySelectorAll('.sh-pick .it-slot')].filter((e) => { const r = e.getBoundingClientRect(); return r.left < zone.left - 1 || r.right > zone.right + 1; }).length;
      const rs = [...document.querySelectorAll('.sh-pick .it-slot')].map((e) => e.getBoundingClientRect());
      const lap = rs.some((a, i) => rs.some((c, j) => j > i && a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1));
      const cells = [...document.querySelectorAll('.sh-pick .it-c:not(.it-slot)')].map((e) => e.getBoundingClientRect());
      const lapCell = rs.some((a) => cells.some((c) => a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1));
      const av = document.querySelector('.sh-pick .it-av')?.getBoundingClientRect();
      const lapAv = av ? rs.concat(cells).some((a) => a.left < av.right - 1 && av.left < a.right - 1 && a.top < av.bottom - 1 && av.top < a.bottom - 1) : false;
      return { out, lap, lapCell, lapAv, hscroll: body ? body.scrollWidth > body.clientWidth + 1 : null, zone: zone ? Math.round(zone.width) : null };
    });
    if (fit.out || fit.lap || fit.lapCell || fit.lapAv || fit.hscroll || m.over) bad(`[sell/${name}] 넘침·겹침 ${JSON.stringify(fit)} over=${m.over}`);
    // 장착 띠와 소지품 구획이 서로 다른 테두리 상자, 사이가 떨어져 있고, 장착 칸과 물건 카드 크기가 다름 (2026-11-12 사용자: 「장착칸이랑 아이템칸이랑 구분도 없냐」)
    const sep = await page.evaluate(() => {
      const R = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), b: Math.round(r.bottom) }; };
      const band = document.querySelector('.sh-pick .it-eqbox.sell'), zone = document.querySelector('.sh-pick .sh-mine');
      if (!band || !zone) return null;
      const bw = (e) => parseFloat(getComputedStyle(e).borderTopWidth) || 0;
      const slot = document.querySelector('.sh-pick .it-eqslots .it-slot'), card = zone.querySelector('.it-c');
      const head = zone.querySelector('.sh-zh');
      return {
        band: R(band), zone: R(zone), gap: Math.round(zone.getBoundingClientRect().top - band.getBoundingClientRect().bottom),
        bandBorder: bw(band), zoneBorder: bw(zone), nested: band.contains(zone) || zone.contains(band),
        slotsInBand: [...document.querySelectorAll('.sh-pick .it-slot')].every((e) => band.contains(e)), avInBand: !!band.querySelector('.it-av'),
        cardsInZone: [...document.querySelectorAll('.sh-pick .it-c:not(.it-slot)')].every((e) => zone.contains(e)), cards: zone.querySelectorAll('.it-c').length,
        slot: slot ? R(slot) : null, card: card ? R(card) : null, head: head ? head.textContent.trim() : '', headInZone: !!head && head.getBoundingClientRect().top >= zone.getBoundingClientRect().top,
        sameLeft: Math.round(band.getBoundingClientRect().left) === Math.round(zone.getBoundingClientRect().left), sameWidth: Math.round(band.getBoundingClientRect().width) === Math.round(zone.getBoundingClientRect().width),
      };
    });
    const GAP = 8; // 띠와 구획 사이 최소 간격 (.sh-eq margin-bottom 10)
    if (!sep) bad(`[sell/${name}] 장착 띠 상자나 소지품 구획이 없음`);
    else {
      if (sep.nested) bad(`[sell/${name}] 장착 띠와 소지품 구획이 한 상자 안에 있음`);
      if (sep.bandBorder < 1 || sep.zoneBorder < 1) bad(`[sell/${name}] 테두리 없음 (띠 ${sep.bandBorder}, 구획 ${sep.zoneBorder})`);
      if (sep.gap < GAP) bad(`[sell/${name}] 띠와 구획 사이 ${sep.gap}px (바람 ≥ ${GAP})`);
      if (!sep.slotsInBand || !sep.avInBand) bad(`[sell/${name}] 장착 칸·아바타가 띠 상자 밖에 있음`);
      if (!sep.cardsInZone || !sep.cards) bad(`[sell/${name}] 물건 카드가 소지품 구획 밖에 있음 (${sep.cards})`);
      if (!sep.sameLeft || !sep.sameWidth) bad(`[sell/${name}] 띠와 구획의 왼쪽 끝·폭이 다름 (띠 ${sep.band.x}/${sep.band.w}, 구획 ${sep.zone.x}/${sep.zone.w})`);
      if (!/^소지품/.test(sep.head) || !sep.headInZone) bad(`[sell/${name}] 소지품 구획 제목 줄이 구획 안에 없음 (${sep.head})`);
      if (sep.slot && sep.card && (Math.abs(sep.slot.w - sep.card.w) < 8 || sep.slot.h === sep.card.h)) bad(`[sell/${name}] 장착 칸 ${sep.slot.w}×${sep.slot.h} 과 물건 카드 ${sep.card.w}×${sep.card.h} 크기가 같음`);
      const wantSlot = name === 'phone' ? 59 : 97;
      if (sep.slot && sep.slot.w !== wantSlot) bad(`[sell/${name}] 장착 칸 ${sep.slot.w} (바람 ${wantSlot} — 소지품 창 장착 칸과 같은 크기)`);
    }
    report[`sellsep/${name}`] = sep && { 띠: `${sep.band.w}×${sep.band.h}`, 구획: `${sep.zone.w}×${sep.zone.h}`, 간격: sep.gap, 장착칸: sep.slot && `${sep.slot.w}×${sep.slot.h}`, 물건카드: sep.card && `${sep.card.w}×${sep.card.h}`, 제목: sep.head };
    await page.screenshot({ path: `${out}/sell_${name}.png` });
    // 장착한 물건을 눌러 팔 물건으로 고를 수 있음 (새 칸 = 장비 여섯째)
    await page.evaluate(() => document.querySelector('.sh-pick .it-slot[data-value="i_gas"]')?.click()); await sleep(400);
    const sel = await page.evaluate(() => JSON.parse(window.__chat.scriptstate.$st_shop || '{}').sell?.itemId);
    if (sel !== 'i_gas') bad(`[sell/${name}] 여섯째 장비 칸 물건을 팔 물건으로 못 고름 (${sel})`);
    const xs = new Set(m.slots.map((s) => s.x)).size, ys = new Set(m.slots.map((s) => s.y)).size;
    report[`sell/${name}`] = { win: m.win.join('×'), 칸: m.slots[0] && `${m.slots[0].w}×${m.slots[0].h}`, 배치: `${xs}열×${ys}줄`, 아바타: m.av && `${m.av.w}×${m.av.h}`, 구획폭: fit.zone };
    await page.screenshot({ path: `${out}/sell_${name}_picked.png` });
    errorsAll.push(...errors.map((e) => `[sell/${name}] ${e}`));
    await page.close();
  }
}

await b.close();
console.log(JSON.stringify(report, null, 1));
if (errorsAll.length) { console.log(`FAIL ${errorsAll.length}`); for (const e of errorsAll) console.log(' -', e); process.exit(1); }
console.log('equip8-browser: OK');
