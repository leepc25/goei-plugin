// 인물 시험장 (2026-10-29): 옛 통합 테스트룸(room.html)을 대신한다. 엔진을 따로 두지 않고 게임을 그대로 띄운 뒤
// 옆 판에서 인물·무대를 고르고, 동작·생활 줄·장면을 단추로 틀어 본다. 전투·이펙트·판정·피해는 게임 코드(fighter/core.ts) 그대로라
// 여기서 본 것이 본 게임에서 나오는 것과 같다.
// 열기: npm run build → 저장소 맨 위에서 `python3 -m http.server 8765` → http://localhost:8765/dist/goei-testroom.html
//   ?char=이름(기본 에일린) · ?start=stage=dummy|spar|training 또는 hq · &ai=easy|normal|hard|nightmare · ?packs=팩 주소(기본 ../game-pack/)
import { mountGame } from '../main';
import { FighterPlayer } from './player';
import type { GameAssets } from '../../bridge';
import { PERK_TEXT, TRAIT_TEXT } from '../../perks/defs.gen';
import { GRADE_NAME, HELD, kitOf, perkOk, type Grade } from '../../perks/rules';
import { openDraft } from '../../perks/draftUi';

type Row = { key: string; name: string; num: string; npc: boolean };

const q = new URLSearchParams(location.search);
if (!q.get('start')) {
  q.set('start', 'stage=dummy');
  history.replaceState(null, '', `${location.pathname}?${q}`);
}
const base = new URL(q.get('packs') ?? '../game-pack/', location.href).href.replace(/\/?$/, '/');
const at = (pack: string, f: string) => `${base}${pack}/${f}`;
const assets: GameAssets = {
  ready: async (pack) => (await fetch(at(pack, 'pack.json')).catch(() => null))?.ok ?? false,
  url: async (pack, f) => at(pack, f),
  bytes: async (pack, f) => { const r = await fetch(at(pack, f)).catch(() => null); return r?.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
  atlas: async () => null,
  list: async () => [],
};

const css = `
html,body{margin:0;height:100%;background:#111;color:#ddd;font:13px/1.45 system-ui,sans-serif;overflow:hidden}
#side{position:fixed;left:0;top:0;bottom:0;width:340px;overflow:auto;padding:10px 12px;box-sizing:border-box;background:#181a1d;border-right:1px solid #2a2d31}
#box{position:fixed;left:340px;right:0;top:0;bottom:0}
h1{font-size:15px;margin:0 0 6px} h2{font-size:13px;margin:12px 0 6px;color:#e8c27a}
.m{color:#8b9097;font-size:12px} .row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
button,select{background:#262a2f;color:#ddd;border:1px solid #3a3f45;border-radius:6px;padding:4px 8px;font:inherit;cursor:pointer}
button:hover{background:#30353b} select{max-width:200px}
.grid{display:flex;flex-wrap:wrap;gap:4px} .grid button{padding:2px 6px;font-size:12px}
label{display:flex;gap:6px;align-items:center}
@media (max-width:760px){#side{width:100%;bottom:auto;height:42%;border-right:0;border-bottom:1px solid #2a2d31}#box{left:0;top:42%}}
`;
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.innerHTML = '<div id="side"></div><div id="box"></div>';
const side = document.getElementById('side')!;
const box = document.getElementById('box')!;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = '') => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text) n.textContent = text;
  return n;
};
/** 단추: 누른 뒤 포커스를 게임으로 돌려 키 입력이 단추에 먹히지 않게 */
const btn = (label: string, fn: () => void, title = '') => {
  const b = el('button', title ? { title } : {}, label);
  b.onclick = () => { fn(); b.blur(); (box.querySelector('canvas') as HTMLCanvasElement | null)?.focus(); };
  return b;
};
const go = (patch: Record<string, string | null>) => {
  for (const [k, v] of Object.entries(patch)) (v === null ? q.delete(k) : q.set(k, v));
  location.search = q.toString();
};

// ── 위: 인물·무대 (게임과 상관없이 바로 그림) ──
const head = el('div');
head.append(el('h1', {}, '인물 시험장'), el('div', { class: 'm' }, '검수용 · 게임 코드 그대로 · 화면을 한 번 누른 뒤 키로 조종'));
const pickRow = el('div', { class: 'row' });
const sel = el('select', { 'aria-label': '인물 고르기' });
pickRow.append(btn('◀', () => step(-1), '이전 인물'), sel, btn('▶', () => step(1), '다음 인물'));
head.append(el('h2', {}, '인물'), pickRow);
let roster: Row[] = [];
const cur = q.get('char') ?? '에일린';
const step = (d: number) => {
  if (!roster.length) return;
  const i = roster.findIndex((r) => r.name === cur);
  go({ char: roster[(i + d + roster.length) % roster.length].name });
};
sel.onchange = () => go({ char: sel.value });
void fetch(at('action-fx', 'roster.json')).then((r) => r.json()).then((rows: Row[]) => {
  roster = rows;
  for (const [label, npc] of [['요원', false], ['NPC', true]] as const) {
    const g = el('optgroup', { label });
    for (const r of rows.filter((x) => !!x.npc === npc)) { const o = el('option', { value: r.name }, `${r.num} ${r.name}`); if (r.name === cur) o.selected = true; g.append(o); }
    sel.append(g);
  }
}).catch(() => { sel.append(el('option', {}, '명단을 못 읽음 (팩 주소 확인)')); });

const stageRow = el('div', { class: 'row' });
const start = q.get('start') ?? '';
const ai = q.get('ai') ?? 'normal';
stageRow.append(
  btn(`${start === 'stage=dummy' ? '● ' : ''}허수아비`, () => go({ start: 'stage=dummy', ai: null })),
  btn(`${start === 'stage=spar' ? '● ' : ''}AI 대련`, () => go({ start: 'stage=spar', ai })),
  btn(`${start === 'stage=training' ? '● ' : ''}훈련장`, () => go({ start: 'stage=training', ai: null })),
);
const aiSel = el('select', { 'aria-label': 'AI 난이도' });
for (const d of ['easy', 'normal', 'hard', 'nightmare']) { const o = el('option', { value: d }, `AI ${d}`); if (d === ai) o.selected = true; aiSel.append(o); }
aiSel.onchange = () => go({ start: 'stage=spar', ai: aiSel.value });
stageRow.append(aiSel);
head.append(el('h2', {}, '무대'), stageRow);
side.append(head);

// ── 아래: 지금 인물의 엔진에 붙는 단추 (게임이 뜬 뒤 채운다) ──
const live = el('div');
live.append(el('div', { class: 'm' }, '게임을 불러오는 중…'));
side.append(live);

function fill(p: FighterPlayer) {
  live.innerHTML = '';
  const c = p.core;
  const cfg = p.art.cfg as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const sk = (cfg.skills ?? {}) as Record<string, { name?: string }>;
  const bal = (cfg.bal ?? {}) as { role?: string; gun?: string; speed?: string; cd?: Record<string, number> };
  const info = el('div', { class: 'm' });
  info.innerHTML = [
    `<b style="color:${cfg.color ?? '#ddd'}">${cfg.name}</b> · ${cfg.key}`,
    `고유기(D) ${sk.skill?.name ?? '—'} · 충전(S) ${sk.charge?.name ?? '—'} · 필살(F) ${sk.super?.name ?? '—'}${sk.skill2 ? ` · 기술2 ${sk.skill2.name}` : ''}`,
    `역할 ${bal.role ?? '—'} · 손 ${bal.speed ?? '—'} · 총 ${bal.gun ?? '—'} · 쿨 ${Object.entries(bal.cd ?? {}).map(([k, v]) => `${k} ${v}초`).join(' · ') || '—'}`,
  ].join('<br>');
  live.append(el('h2', {}, '이 인물'), info);

  const free = el('input', { type: 'checkbox' }) as HTMLInputElement;
  free.checked = c.freeSuper;
  free.onchange = () => { c.freeSuper = free.checked; };
  const lab = el('label');
  lab.append(free, document.createTextNode('필살 게이지 무시'));
  live.append(el('h2', {}, '스위치'), lab);

  // 퍽 (임시 · 괴이 안, src/game/perks): 3택1 보상 창·하나씩 넣고 빼기·방 사건·쌓임 표시
  const perkBox = el('div');
  live.append(el('h2', {}, '퍽 (임시 · 괴이 안)'), el('div', { class: 'm' }, '「3택1 보상」은 본 게임 방 보상 창 그대로 · 아래 목록 + 로 바로 넣기(회색 = 이 인물 출현 조건 밖, 시험용으로는 넣을 수 있음) · 아이템 보류 8개는 뺌'), perkBox);
  const world = () => (globalThis as { __goeiEngine?: { world: { paused: boolean; api: { spawn(s: object): unknown }; player: { x: number; y: number } } | null } }).__goeiEngine?.world ?? null;
  const kit = kitOf(cfg, (id) => c.has(id), p.base.str);
  const ctl = el('div', { class: 'grid' });
  ctl.append(
    btn('3택1 보상', () => openDraft(box, p, { world: world() })),
    btn('방 들어감', () => p.perks.roomEnter()),
    btn('방 깸', () => p.perks.roomClear()),
    btn('퍽 다 비우기', () => p.perks.reset()),
  );
  // 괴이 한 판 시험(던전 전): 들어감 → 방 깸 → 죽음·중간 복귀·귀환에 퍽이 지워지는지, 저장 → 새로고침 → 이어하기에 그대로 돌아오는지
  const runRow = el('div', { class: 'grid' });
  const runMsg = el('div', { class: 'm' });
  const SAVE = 'goei.testroom.perkRun';
  const ended = (r: { reason: string; rooms: number; kills: number; perks: string[] }) => { runMsg.textContent = `판 끝(${({ death: '죽음', retreat: '중간 복귀', return: '귀환' } as Record<string, string>)[r.reason]}): 깬 방 ${r.rooms} · 처치 ${r.kills} · 지운 퍽 ${r.perks.length}개`; };
  runRow.append(
    btn('괴이 들어감', () => { p.perks.startRun(); runMsg.textContent = '판 시작'; }),
    btn('죽음', () => ended(p.perks.endRun('death'))),
    btn('중간 복귀', () => ended(p.perks.endRun('retreat'))),
    btn('귀환', () => ended(p.perks.endRun('return'))),
    btn('저장', () => { try { localStorage.setItem(SAVE, JSON.stringify(p.perks.snapshot())); runMsg.textContent = '저장함 · 새로고침 뒤 「이어하기」'; } catch { runMsg.textContent = '저장 못 함'; } }),
    btn('이어하기', () => { try { p.perks.restore(JSON.parse(localStorage.getItem(SAVE) ?? 'null')); runMsg.textContent = '저장한 판을 불러옴'; } catch { runMsg.textContent = '불러오기 못 함'; } }),
  );
  perkBox.append(el('div', { class: 'm', style: 'margin-top:6px;color:#e8c27a' }, '괴이 한 판'), runRow, runMsg);
  ctl.append(
    btn('적 3 (칼잡이)', () => { const w = world(); if (w) for (let i = 0; i < 3; i++) w.api.spawn({ kind: 'fb_sword', x: w.player.x + 260 + i * 90, y: w.player.y + (i - 1) * 40 }); }),
    btn('적 AI 1', () => { const w = world(); if (w) w.api.spawn({ kind: 'ai-char', x: w.player.x + 300, y: w.player.y }); }),
  );
  const gradeSel = el('select', { 'aria-label': '넣을 등급' }) as HTMLSelectElement;
  GRADE_NAME.forEach((n, i) => gradeSel.append(el('option', { value: String(i) }, `+ 로 넣을 등급: ${n}`)));
  perkBox.append(gradeSel);
  const ownBox = el('div', { class: 'm' });
  const listBox = el('div');
  perkBox.append(ctl, el('div', { class: 'm', style: 'margin-top:6px;color:#e8c27a' }, '가진 것'), ownBox, listBox);
  let seen = '';
  const drawOwn = () => {
    const st = p.perks.stacks().map((x) => `${x.name} ${x.v}/${x.max}`).join(' · ');
    const key = `${p.perks.version}|${st}|${p.perks.active}|${p.perks.depth}`;
    if (key === seen) return;
    seen = key;
    ownBox.innerHTML = '';
    const g = el('div', { class: 'grid' });
    for (const [n] of p.perks.ranks) g.append(btn(`− ${n} (${(p.perks.grades.get(n) ?? []).map((x) => GRADE_NAME[x]).join('·')})`, () => p.perks.remove(n)));
    for (const n of p.perks.traits) g.append(btn(`− [특성] ${n}`, () => p.perks.remove(n)));
    if (!p.perks.ranks.size && !p.perks.traits.size) g.append(el('span', {}, '없음'));
    ownBox.append(g);
    if (st) ownBox.append(el('div', {}, `쌓임: ${st}`));
    ownBox.append(el('div', {}, `판: ${p.perks.active ? `진행 중 · 깬 방 ${p.perks.depth}` : '밖'}`));
  };
  perkTick = drawOwn;
  const cats = [...new Set(PERK_TEXT.map((x) => x.cat))];
  for (const cat of cats) {
    const g = el('div', { class: 'grid' });
    for (const d of PERK_TEXT.filter((x) => x.cat === cat && !HELD.has(x.name))) {
      const ok = perkOk(d.name, kit, { ranks: new Map([...PERK_TEXT.map((x) => [x.name, 1] as [string, number])]), traits: new Set(['저주받은 손']) });
      const b = btn(`+ ${d.name}`, () => p.perks.add(d.name, Number(gradeSel.value) as Grade), `${d.kind} · 랭크 ${d.rank >= 99 ? '∞' : d.rank}${d.cond ? ` · 조건 ${d.cond}` : ''}\n${d.eff}`);
      if (!ok) b.style.opacity = '0.45';
      if (d.kind === '쌍') b.style.borderColor = '#e0b43a';
      g.append(b);
    }
    listBox.append(el('div', { class: 'm', style: 'margin-top:6px' }, cat), g);
  }
  const tg = el('div', { class: 'grid' });
  for (const t of TRAIT_TEXT.filter((x) => !HELD.has(x.name))) { const b = btn(`+ ${t.name}`, () => p.perks.addTrait(t.name), `장점 ${t.good}\n대가 ${t.cost}`); b.style.borderColor = '#9a6ae0'; tg.append(b); }
  listBox.append(el('div', { class: 'm', style: 'margin-top:6px' }, '특성'), tg);

  // 의자 맞추기 (옛 테스트룸 칸 그대로): 앉아 있는 방향의 의자를 1화소씩 옮기고 「값 복사」로 chairs/<키>.json 에 넣을 값을 낸다.
  // 고친 값은 이 브라우저에 인물별로 남는다(옛 테스트룸과 같은 열쇠 chair.<키>)
  const chairBox = el('div');
  live.append(el('h2', {}, '의자 맞추기'), el('div', { class: 'm' }, '1화소씩 · 값 복사해서 Claude에게 주면 chairs/<키>.json 에 고정'), chairBox);
  const store = `chair.${cfg.key}`;
  try { Object.assign(c.chairEdits, JSON.parse(localStorage.getItem(store) ?? '{}')); } catch { /* 저장소를 못 쓰면 이번만 */ }
  const save = () => { try { localStorage.setItem(store, JSON.stringify(c.chairEdits)); } catch { /* 저장 못 함 */ } };
  const NAME: Record<string, string> = { front: '정면', side: '옆', back: '후면' };
  let lastSeat = '';
  const drawChairBox = () => {
    const seat = c.P.seat as { dir: string } | null;
    const k = seat ? `${seat.dir}:${JSON.stringify(c.chairFit(seat.dir))}` : '';
    if (k === lastSeat) return;
    lastSeat = k;
    chairBox.innerHTML = '';
    if (!seat) { chairBox.append(el('div', { class: 'm' }, '의자에 앉으면(장면 · 의자) 여기서 맞춥니다.')); return; }
    const f = c.chairFit(seat.dir);
    chairBox.append(el('div', { class: 'm' }, `${cfg.name} · ${NAME[seat.dir] ?? seat.dir} · 앞뒤 ${f.dx} · 위아래 ${f.dy} · 크기 ${f.s}`));
    const row = el('div', { class: 'grid' });
    const nudge = (key: 'dx' | 'dy' | 's', v: number) => {
      const cur = c.chairFit(seat.dir);
      const e = { dx: cur.dx, dy: cur.dy, s: cur.s };
      e[key] = +(e[key] + v).toFixed(2);
      c.chairEdits[seat.dir] = e;
      save();
    };
    for (const [lab, key, v] of [['◀ 뒤로', 'dx', -1], ['앞으로 ▶', 'dx', 1], ['▲ 위로', 'dy', -1], ['아래로 ▼', 'dy', 1], ['작게', 's', -0.02], ['크게', 's', 0.02]] as const) row.append(btn(lab, () => nudge(key, v)));
    row.append(btn('이 방향 원래 값으로', () => { delete c.chairEdits[seat.dir]; save(); }));
    const ta = el('textarea', { rows: '3', style: 'width:100%;margin-top:4px;background:#111;color:#ddd;border:1px solid #3a3f45' }) as HTMLTextAreaElement;
    ta.hidden = true;
    row.append(btn('값 복사', () => {
      const out: Record<string, unknown> = {};
      for (const d of ['front', 'side', 'back']) { const v = c.chairFit(d); out[d] = { dx: v.dx, dy: v.dy, s: v.s, ...(v.img ? { img: v.img } : {}) }; }
      ta.value = `"${cfg.key}": ${JSON.stringify(out)}`;
      ta.hidden = false;
      void navigator.clipboard?.writeText(ta.value).catch(() => {});
      ta.select();
    }));
    chairBox.append(row, ta);
  };
  drawChairBox();
  chairTick = drawChairBox;

  for (const [title, list] of c.SCENES as [string, [string, () => void][]][]) {
    const g = el('div', { class: 'grid' });
    for (const [label, fn] of list) g.append(btn(label, fn));
    live.append(el('h2', {}, `장면 · ${title}`), g);
  }

  const lifeG = el('div', { class: 'grid' });
  for (const id of c.lifeIds()) lifeG.append(btn(id, () => c.playLife(id)));
  live.append(el('h2', {}, '생활·직무 줄'), el('div', { class: 'm' }, '누르면 그 줄을 틂 · 방향키로 끊음'), lifeG);

  const ids = Object.keys(c.A).sort((a, b) => parseFloat(a.replace('_', '.')) - parseFloat(b.replace('_', '.')) || a.localeCompare(b));
  const allG = el('div', { class: 'grid' });
  for (const id of ids) allG.append(btn(`${id}`, () => c.act(id), `${c.nOf(id)}장`));
  live.append(el('h2', {}, `동작 하나씩 (${ids.length}줄)`), allG);

  live.append(el('h2', {}, '조작'), el('div', { class: 'm' }, '방향키 이동(두 번 빠르게 = 달리기) · Space 점프 · Q 약공 · W 강공 · C 막기·회피 · A 사격 · S 충전(누르고 떼기) · D 고유기 · F 필살 · Tab 무기 · R 전투 자세 · Z 앉기 · X 웅크림 · V 도망 · B 뒷걸음 · Esc 메뉴'));
}

let chairTick: () => void = () => {};
let perkTick: () => void = () => {};
mountGame(box, { assets });
let shown: FighterPlayer | null = null;
setInterval(() => {
  const w = (globalThis as { __goeiEngine?: { world: { player: unknown } | null } }).__goeiEngine?.world;
  const p = w?.player;
  if (p instanceof FighterPlayer && p !== shown) { shown = p; fill(p); }
  chairTick();
  perkTick();
}, 200);
