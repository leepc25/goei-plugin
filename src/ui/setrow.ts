// 설정 줄 그리기 (2026-11-11 설정 개편 2단계). 설정 줄·묶음의 모양은 여기 한 곳에서만 만든다.
// 페이지는 정의표(core/setdef)와 「선」(Wire: 지금 값 읽기·버튼 이름)을 주고, 줄 HTML 을 직접 쓰지 않는다.
import { onOffSwitch } from './controls';
import type { SetDef, SetGroup, SetPage } from '../core/setdef/types';
import { defChanged, defShown } from '../core/deftext';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 범위 배지: 'device' = 이 기기 공통 값, 'chat'·'defaults' = 범위 전환이 없는 페이지에서 그 줄만 다른 범위일 때 */
export const SCOPE_BADGE = { device: '이 기기', chat: '이 채팅', defaults: '새 채팅 기본값' } as const;
export type RowScope = keyof typeof SCOPE_BADGE;
/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작. label·help·control 은 HTML */
export const setRow = (label: string, control: string, help = '', cls = '', scope?: RowScope): string =>
  `<div class="ps-row${cls ? ` ${cls}` : ''}"><div class="ps-label"><b>${label}${scope ? `<i class="gx-scope${scope === 'device' ? '' : ` ${scope}`}">${SCOPE_BADGE[scope]}</i>` : ''}</b>${help ? `<small>${helpFmt(help)}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
/** 설명 글을 한 가지 모양으로 (모든 줄 공통): 문장은 마침표로 끝내고, 「이름 = 뜻」이 이어진 글은 항목 목록(helpBox)으로 끊는다.
 *  이미 모양을 갖춘 글(태그가 든 글)은 그대로 둔다 */
const HELP_TERM = '[^=.,:]{1,18}';
export const helpFmt = (h: string): string => {
  if (!h || h.includes('<')) return h;
  const end = (s: string) => { const t = s.trim().replace(/,$/, ''); return /[.!?)」…]$/.test(t) ? t : `${t}.`; };
  const parts = h.split(new RegExp(`\\s+·\\s+(?=${HELP_TERM} = )|(?<=[.,)])\\s+(?=${HELP_TERM} = )`)).map((s) => s.trim()).filter(Boolean);
  const item = new RegExp(`^(${HELP_TERM}) = (.+)$`, 's');
  const items: [string, string][] = [];
  let lead = '';
  for (const [i, p] of parts.entries()) {
    const m = item.exec(p);
    if (m) items.push([m[1].trim(), end(m[2])]);
    else if (i === 0) lead = end(p);
    else if (items.length) items[items.length - 1][1] += ` ${end(p)}`;
  }
  if (!items.length) return end(h);
  return `<span class="hb">${lead ? `<span class="hb-lead">${lead}</span>` : ''}<span class="hb-list">${items.map(([t, d]) => `<span class="hb-i"><b>${t}</b><span>${d}</span></span>`).join('')}</span></span>`;
};
/** 설정 묶음 */
/** 한 묶음(상자) 안의 수 상자는 같은 크기 (sameStep): 한 줄이라도 큰 것이 필요하면 그 묶음은 모두 큰 것. 격자가 든 묶음은 격자 규칙(작은 것)을 따른다 */
export const groupStep = (rows: string): string => (rows.includes('ck-line') ? rows : sameStep(rows));
export const setGroup = (title: string, rows: string, note = ''): string =>
  `<section class="ps-group">${title ? `<h3>${title}</h3>` : ''}${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${groupStep(rows)}</div></section>`;

/** 고르기 조작: ON/OFF 둘뿐이면 스위치. 버튼 값은 「열쇠=값」 */
export function setSeg(action: string, key: string, cur: string, items: [string, string][], disabled = false): string {
  const val = (v: string) => (key ? `${key}=${v}` : v);
  const sw = onOffSwitch(items, cur, action, val, disabled);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${val(v)}" aria-pressed="${cur === v}"${disabled ? ' disabled' : ''}>${label}</button>`)
    .join('')}</div>`;
}

/** 페이지와 정의표를 잇는 선 */
export interface Wire {
  /** 지금 저장된 값 (없으면 기본값) */
  cur(key: string): string;
  /** 최소·최대 줄의 지금 값 */
  minmax?(key: string): [number, number];
  /** 값에 따라 달라지는 설명 (표의 설명 대신) */
  help?: Record<string, () => string>;
  /** custom 줄의 조작 HTML 과, 값에 따라 달라지는 설명 */
  custom?: Record<string, () => { ctl: string; help?: string }>;
  /** 저장 중: 조작을 잠근다 */
  busy?: boolean;
  /** 버튼 값·열쇠 앞에 붙는 갈래 (쇼핑몰의 사이트: 「cos:열쇠=값」) */
  scope?: string;
  /** 묶음 맨 앞에 넣을 HTML (묶음 이름 → 글) */
  lead?: Record<string, string>;
  /** 페이지 이름 (묶음 이름 '@page' 자리) */
  pageTitle?: string;
  /** 세부 값 표의 줄 (ui/advanced.ts advRow) · 칩 줄 */
  adv?(item: string): string;
  advChips?(items: string[], label: string): string;
  advSet?(label: string, items: [string, string][], help: string): string;
}

/** 버튼 이름: 기능 열쇠가 머리 (gn-cfg·gn-text·gn-count) */
const act = (page: SetPage, kind: 'cfg' | 'text' | 'count' | 'num' | 'shnum' | 'step') => `${page.id}-${kind}`;

/** 수 한 칸 */
const sk = (w: Wire, key: string) => (w.scope ? `${w.scope}:${key}` : key);
const numBox = (page: SetPage, key: string, cur: string | number, lo: number, hi: number, unit: string, aria: string, kind: 'num' | 'shnum' | 'count' = 'num', busy = false) =>
  stepBox(act(page, kind), key, cur, lo, hi, unit, aria, busy);
/** 수 조작의 공통 규격: 한 상자 「− 값 +」. 가운데 값은 직접 쳐도 된다. − + 와 입력은 같은 처리기에 「열쇠=값」을 보낸다.
 *  한 번에 움직이는 폭: 범위가 1만 이상이면 500, 1천 이상이면 50, 200 이상이면 10, 그 밖은 1 */
/** 수 칸 폭: 그 값이 가질 수 있는 가장 긴 수(최대값)의 자릿수에 맞춘다 */
/** 수 상자 「− 값 +」는 앱 전체에 두 크기뿐 (2026-11-12 사용자: 큰 것·작은 것. 자릿수로 폭이 바뀌지 않는다, src/ui/editor/style.css --step-sm·--step-lg).
 * 작은 것 = 가장 빽빽한 격자(인터넷 「양」, 한 줄 8개)에 들어가는 폭. 그 줄이 가질 수 있는 값(가장 큰 수·0일 때의 말)에 단위를 붙인 글이
 * 작은 것의 가운데 칸(STEP_SM_ROOM px)에 다 들어가면 작은 것, 하나라도 안 들어가면 큰 것. 크기는 여기 한 곳에서만 정한다. */
const STEP_SM_ROOM = 29;
const textPx = (t: string): number => [...t].reduce((n, ch) => n + (/[0-9]/.test(ch) ? 7.6 : ch === ' ' ? 3.6 : /[.,%]/.test(ch) ? 9 : ch.charCodeAt(0) > 0x2e7f ? 12.4 : 8), 0);
export const stepSize = (hi: number, unit = '', zero = ''): '' | ' lg' => {
  const u = unit ? textPx(unit) + 3 : 0;
  return Math.max(textPx(String(Math.abs(Math.trunc(hi)))), zero ? textPx(zero) : 0) + u > STEP_SM_ROOM ? ' lg' : '';
};
/** 글로 보이는 수 상자(<b>값단위</b>)의 크기: 보일 수 있는 가장 긴 글로 정한다 */
export const stepSizeText = (...texts: string[]): '' | ' lg' => (Math.max(...texts.map(textPx)) > STEP_SM_ROOM ? ' lg' : '');
/** 한 묶음(같은 줄·같은 격자)의 수 상자는 같은 크기: 하나라도 큰 것이면 모두 큰 것 */
export function sameStep(html: string): string { return sameStep0(html); }
const sameStep0 = (html: string): string => (/class="st-step[^"]* lg"/.test(html) ? html.replace(/class="st-step( adv-step)?"/g, 'class="st-step$1 lg"') : html);
export const stepBox = (action: string, key: string, cur: string | number, lo: number, hi: number, unit: string, aria: string, busy = false): string => {
  const raw = String(cur ?? '').trim();
  const n = Math.max(lo, Math.min(hi, Number(raw) || 0));
  const st = hi - lo >= 10000 ? 500 : hi - lo >= 1000 ? 50 : hi - lo >= 200 ? 10 : 1;
  const b = (to: number, on: boolean, sign: string, name: string) => `<button class="gx-step" data-action="${action}" data-value="${esc(key)}=${to}" ${on && !busy ? '' : 'disabled'} aria-label="${esc(aria)} ${name}">${sign}</button>`;
  return `<div class="st-step adv-step${stepSize(hi, unit)}">${b(Math.max(lo, n - st), n > lo, '−', '줄이기')}<input class="adv-val" type="number" inputmode="numeric" min="${lo}" max="${hi}" step="${st}" data-change="${action}" data-key="${esc(key)}" value="${raw === '' ? '' : n}" aria-label="${esc(aria)}"${busy ? ' disabled' : ''}>${unit ? `<span>${esc(unit)}</span>` : ''}${b(Math.min(hi, n + st), n < hi, '+', '늘리기')}</div>`;
};

function control(page: SetPage, d: SetDef, w: Wire): { ctl: string; cur: string } {
  const c = d.ctl;
  if (c.t === 'seg') {
    const raw = w.cur(d.key);
    const cur = c.fb !== undefined && !c.opts.some(([v]) => v === raw) ? c.fb : raw;
    const seg = page.flat ? setSeg(`${page.id}-${d.key}`, '', cur, c.opts, w.busy) : setSeg(page.segAct ?? act(page, 'cfg'), sk(w, d.key), cur, c.opts, w.busy);
    const i = d.inline;
    if (!i) return { ctl: seg, cur };
    const on = c.opts.find(([, l]) => l === 'ON')?.[0];
    return { ctl: `<span class="ph-inline">${seg}${!i.whenOn || cur === on ? `<span class="ph-inline">${numBox(page, i.key, w.cur(i.key), i.lo, i.hi, i.unit, i.aria ?? d.label)}</span>` : ''}</span>`, cur };
  }
  if (c.t === 'num') {
    const v = w.cur(d.key);
    const box = numBox(page, sk(w, d.key), v, c.lo, c.hi, c.unit, d.aria ?? d.label, c.act ?? 'num');
    return { ctl: `<span class="ph-inline">${box}</span>`, cur: v };
  }
  if (c.t === 'text') {
    const v = w.cur(d.key);
    return { ctl: `<input class="gx-search ps-text" data-change="${page.flat ? `${page.id}-${d.key}"` : `${act(page, 'text')}" data-key="${sk(w, d.key)}"`} value="${esc(c.def !== undefined ? defShown(v, c.def) : v === '-' ? '' : v)}"${c.max ? ` maxlength="${c.max}"` : ''}${c.def !== undefined ? '' : ` placeholder="${esc(c.ph)}"`}>`, cur: v };
  }
  if (c.t === 'minmax') {
    const [a, b] = w.minmax!(d.key);
    if (c.keys) {
      const one = (key: string, n: number, name: string) => numBox(page, sk(w, key), n, c.lo, c.hi, c.unit, `${d.aria ?? d.label} ${name}`, c.act ?? 'num');
      return { ctl: `<span class="ph-inline"><span class="ph-inline ph-pair"><span>최소</span>${one(c.keys[0], a, '최소')}</span><span class="ph-inline ph-pair"><span>최대</span>${one(c.keys[1], b, '최대')}</span></span>`, cur: `${a}~${b}` };
    }
    const box = (side: 'min' | 'max', n: number, name: string) => stepBox(act(page, c.act ?? 'count'), `${d.key}_${side}`, n, c.lo, c.hi, c.unit, `${d.label} ${name}`, w.busy);
    return { ctl: `<span class="ph-inline"><span class="ph-inline ph-pair"><span>최소</span>${box('min', a, '최소')}</span><span class="ph-inline ph-pair"><span>최대</span>${box('max', b, '최대')}</span></span>`, cur: `${a}~${b}` };
  }
  if (c.t === 'step') {
    const n = Number(w.cur(d.key));
    const b = (dir: '-' | '+', on: boolean, name: string) => `<button class="gx-step" data-action="${c.action ?? act(page, 'step')}" data-value="${sk(w, c.vkey ?? d.key)}:${dir}" ${on ? '' : 'disabled'} aria-label="${esc(d.label)} ${name}">${dir === '-' ? '−' : '+'}</button>`;
    return { ctl: `<div class="st-step${stepSizeText(`${c.hi}${c.unit}`, `${c.lo}${c.unit}`)}">${b('-', n > c.lo, '줄이기')}<b>${esc(`${n}${c.unit}`)}</b>${b('+', n < c.hi, '늘리기')}</div>`, cur: String(n) };
  }
  return { ctl: '', cur: '' };
}

/** 정의표의 줄 하나 */
/** 격자 칸 폭 (모든 격자 공통, 2026-11-12 사용자: 수 칸이 좁다 → 다른 칸을 조금씩 좁혀서):
 *  체크 칸이 수 칸보다 많은 격자에서만 수 칸을 넓힌다. 수 칸이 대부분인 격자는 고르게 둔다(체크 칸을 좁히지 않는다) */
function ckCols(isNum: boolean[]): string {
  const nums = isNum.filter(Boolean).length;
  const wide = nums > 0 && isNum.length - nums > nums;
  return isNum.map((n) => (wide && n ? 'minmax(126px, 1.35fr)' : 'minmax(0, 1fr)')).join(' ');
}

export function defRow(page: SetPage, d: SetDef, w: Wire): string {
  for (const c of d.show ? (Array.isArray(d.show) ? d.show : [d.show]) : []) {
    if ('eq' in c ? w.cur(c.key) !== c.eq : w.cur(c.key) === c.ne) return '';
  }
  if (d.ctl.t === 'adv') return w.adv?.(d.ctl.item) ?? '';
  if (d.ctl.t === 'advchips') return w.advChips?.(d.ctl.items, d.label) ?? '';
  if (d.ctl.t === 'advset') return w.advSet?.(d.label, d.ctl.items, typeof d.help === 'string' ? d.help : '') ?? '';
  if (d.ctl.t === 'custom') {
    const c = w.custom?.[d.key]?.();
    if (!c) return '';
    return setRow(d.label, c.ctl, c.help ?? w.help?.[d.key]?.() ?? (typeof d.help === 'string' ? d.help : ''), '', d.scope);
  }
  if (d.ctl.t === 'area' && d.ctl.labeled) {
    const help = w.help?.[d.key]?.() ?? (typeof d.help === 'string' ? d.help : '');
    return setRow(d.label, `<textarea class="gx-search ${d.ctl.cls}" rows="${d.ctl.rows}" data-change="${act(page, 'text')}" data-key="${sk(w, d.key)}" placeholder="${esc(d.ctl.ph)}">${esc(w.cur(d.key))}</textarea>`, help);
  }
  if (d.ctl.t === 'area') {
    return `<div class="ps-row"><textarea class="gx-search ${d.ctl.cls}" data-change="${page.id}-${d.key}" rows="${d.ctl.rows}" placeholder="${esc(d.ctl.ph)}">${esc(w.cur(d.key))}</textarea></div>`;
  }
  const { ctl, cur } = control(page, d, w);
  const help = w.help?.[d.key]?.() ?? (typeof d.help === 'string' ? d.help : d.help ? (d.help[cur] ?? '') : '');
  // 기본값이 든 글 칸: 다르게 고친 줄만 「바꾼 줄」 점 (세부 값 줄과 같은 표시)
  const changed = d.ctl.t === 'text' && d.ctl.def !== undefined && defChanged(cur, d.ctl.def);
  return setRow(d.label, ctl, help, changed ? 'ps-changed' : '', d.scope);
}
/** 정의표의 묶음 하나 */
export const defGroup = (page: SetPage, g: SetGroup, w: Wire): string =>
  setGroup(g.title === '@page' ? (w.pageTitle ?? '') : g.title, (g.note ? `<p class="ps-note">${g.note}</p>` : '') + (w.lead?.[g.title] ?? '') + g.rows.map((d) => defRow(page, d, w)).join(''));
/** 정의표 전체 */
export const defGroups = (page: SetPage, w: Wire): string => page.groups.map((g) => defGroup(page, g, w)).join('\n      ');

/* ── 표 (줄 = 설정, 칸 = 사이트). 같은 틀을 쓰는 사이트들의 설정을 한 장에서 견주고 바꾼다 (설정 개편 4단계) ── */
export interface MxCol { name: string; icon?: string }
/** cells: 칸마다 조작 HTML (null = 그 사이트에 없는 줄) · one: 모든 사이트가 같이 쓰는 값 (칸을 합친다) */
export interface MxRow { label: string; help?: string; cells?: (string | null)[]; one?: string; oneNote?: string }
const mxCell = (col: MxCol, html: string | null, i: number) =>
  `<div class="mx-cell mx-c${i}${html === null ? ' none' : ''}"><span class="mx-site">${esc(col.name)}</span>${html === null ? '<span class="mx-none">없음</span>' : html}</div>`;
export const mxRow = (cols: MxCol[], r: MxRow): string =>
  `<div class="mx-row${r.label ? '' : ' nolabel'}"><b class="mx-label">${r.label}</b>${r.one !== undefined
    ? `<div class="mx-cell mx-all">${r.one}${r.oneNote ? `<span class="mx-shared">${esc(r.oneNote)}</span>` : ''}</div>`
    : cols.map((c, i) => mxCell(c, r.cells?.[i] ?? null, i)).join('')}${r.help ? `<small class="mx-help">${r.help}</small>` : ''}</div>`;
export const mxGroup = (title: string, cols: MxCol[], rows: MxRow[], note = ''): string =>
  `<section class="ps-group">${title ? `<h3>${title}</h3>` : ''}<div class="ps-rows">${note ? `<p class="mx-note">${note}</p>` : ''}${rows.map((r) => mxRow(cols, r)).join('')}</div></section>`;

/** 설명을 항목마다 한 줄로: 「이름 = 뜻. 덧말.」을 끊어 이름은 굵게. 「묶음: 이름 = …」의 묶음은 작은 머리로 */
export const helpList = (t: string): string => {
  const items: { head?: string; term?: string; desc: string }[] = [];
  for (const raw of t.split(/(?<=\.)\s+/)) {
    const sent = raw.trim(); if (!sent) continue;
    const m = /^(?:([^=:]{1,14}): )?([^=]{1,26}?) = (.+)$/.exec(sent);
    if (m) items.push({ head: m[1], term: m[2], desc: m[3] });
    else if (items.length && items[items.length - 1].term) items[items.length - 1].desc += ` ${sent}`;
    else items.push({ desc: sent });
  }
  return `<span class="hl">${items.map((i) => `${i.head ? `<span class="hl-h">${esc(i.head)}</span>` : ''}<span class="hl-i">${i.term ? `<b>${esc(i.term)}</b>` : ''}<span>${i.desc}</span></span>`).join('')}</span>`;
};

/* ── 체크 격자: 줄 = 메뉴, 열 = 고를 값 하나하나. one = 그 묶음에서 하나만(동그라미), check = 켜고 끄기(네모), num = 수(공통 규격 「− 값 +」) ── */
export interface CkGroup { name: string; opts: string[]; kind: 'one' | 'check' | 'num'; band?: boolean }
/** 수 칸: 지금 값과 범위. step = − + 한 번에 움직이는 폭 */
export interface CkNum { n: number; lo: number; hi: number; step?: number }
/** 칸 하나: true·false(체크) · 수 · null(그 메뉴에 없는 값) */
export type CkMark = boolean | CkNum | null;
/** acts: 칸마다 누르면 보낼 값. 체크 칸은 「갈래:메뉴:열쇠=값」 그대로(fam-set), 수 칸은 「갈래:메뉴:열쇠」(fam-num 이 「=값」을 붙인다) */
export interface CkRow { label: string; marks: CkMark[]; acts: (string | null)[] }
/** 격자 칸의 조작 하나 (PC 격자와 폰 묶음이 같이 쓴다) */
/** rel = − + 단추가 「열쇠:-」「열쇠:+」를 보낸다 (처리기가 폭을 아는 값: 상황판 괴이 발생) */
export interface CkActs { set: string; num: string; rel?: boolean }
const FAM_ACTS: CkActs = { set: 'fam-set', num: 'fam-num' };
/** 지금 그리는 수 조작의 단위 (크기 규칙 stepSize 가 본다. 격자 칸은 단위가 머리에 있어 빈 글) */
let ckUnit = '';
/** 격자 칸을 그리는 중인지: 격자 칸의 수 상자는 늘 작은 것 (칸 폭이 작은 것에 맞춰져 있다) */
let inGrid = true;
let ckActs: CkActs = FAM_ACTS;
const ckCtl = (m: CkMark | undefined, act: string | null | undefined, aria: string, round: boolean, busy: boolean): string => {
  // 체크 칸인데 보낼 값이 없으면 잠긴 칸 (다른 설정 때문에 지금 못 바꾸는 값)
  if (typeof m === 'boolean' && !act) return `<button class="ck-m ${round ? 'round' : 'box'}${m ? ' on' : ''}" aria-pressed="${m}" aria-label="${aria} (잠김)" disabled></button>`;
  if (m === null || m === undefined || !act) return '<span class="ck-x" aria-label="없음">–</span>';
  const off = busy ? ' disabled' : '';
  if (typeof m === 'boolean') return `<button class="ck-m ${round ? 'round' : 'box'}${m ? ' on' : ''}" data-action="${ckActs.set}" data-value="${esc(act)}" aria-pressed="${m}" aria-label="${aria}"${off}></button>`;
  const st = m.step ?? 1;
  const b = (to: number, on: boolean, sign: string, name: string) => `<button class="gx-step" data-action="${ckActs.num}" data-value="${esc(act)}${ckActs.rel ? `:${sign === '+' ? '+' : '-'}` : `=${to}`}" ${on && !busy ? '' : 'disabled'} aria-label="${aria} ${name}">${sign}</button>`;
  return `<div class="st-step adv-step${inGrid ? '' : stepSize(m.hi, ckUnit)}">${b(Math.max(m.lo, m.n - st), m.n > m.lo, '−', '줄이기')}<input class="adv-val" type="number" inputmode="numeric" min="${m.lo}" max="${m.hi}" step="${st}" data-change="${ckActs.num}" data-key="${esc(act)}" value="${m.n}" aria-label="${aria}"${off}>${b(Math.min(m.hi, m.n + st), m.n < m.hi, '+', '늘리기')}</div>`;
};
/** 수 조작 하나 (격자 밖 줄에서도 같은 모양·같은 처리기) */
export const numCtl = (act: string, m: CkNum, aria: string, unit = '', busy = false, acts: CkActs = FAM_ACTS): string => {
  ckActs = acts;
  ckUnit = unit;
  inGrid = false;
  const html = ckCtl(m, act, esc(aria), false, busy);
  ckActs = FAM_ACTS;
  ckUnit = '';
  inGrid = true;
  return unit ? html.replace(/(<input[^>]*>)/, `$1<span>${esc(unit)}</span>`) : html;
};
export const ckGrid = (groups: CkGroup[], rows: CkRow[], foot = '', title = '', busy = false): string => {
  const flat = groups.flatMap((g) => g.opts.map((o, i) => ({ g, o, first: i === 0, band: i === 0 && !!g.band, pair: g.kind === 'num' && g.opts.length === 2 ? (i === 0 ? ' ck-pl' : ' ck-pr') : '' })));
  const named = groups.some((g) => g.name);
  const head1 = named ? `<div class="ck-line ck-h1"><span></span>${groups.map((g) => `<b class="ck-first${g.band ? ' ck-band' : ''}" style="grid-column: span ${g.opts.length}">${esc(g.name)}</b>`).join('')}</div>` : '';
  const head2 = `<div class="ck-line ck-h2${named ? '' : ' solo'}"><span></span>${flat.map((c) => `<span class="${c.first ? 'ck-first' : ''}${c.band ? ' ck-band' : ''}">${esc(c.o)}</span>`).join('')}</div>`;
  const body = rows.map((r) => `<div class="ck-line ck-row"><b class="ck-name">${r.label}</b>${flat.map((c, i) =>
    `<span class="ck-cell${c.first ? ' ck-first' : ''}${c.band ? ' ck-band' : ''}${c.pair}">${ckCtl(r.marks[i], r.acts[i], `${esc(c.g.name)} ${esc(c.o)}`, c.g.kind === 'one', busy)}</span>`).join('')}</div>`).join('');
  return `<section class="ps-group ck${groups.some((g) => g.kind === 'num') ? ' ck-hasnum' : ''}" style="--ck-n:${flat.length};--ck-cols:${ckCols(flat.map((c) => c.g.kind === 'num'))}">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="ps-rows">${head1}${head2}${body}</div>${foot ? `<small class="mx-foot">${foot}</small>` : ''}</section>`;
};
/** 띠 여러 개를 PC에서는 한 격자로 나란히, 폰에서는 띠마다 하나로 (폭이 달라서). foot = 설명(helpBox) */
export interface CkBand { title: string; groups: CkGroup[]; marks: CkMark[][]; acts: (string | null)[][]; foot: string }
export const ckWide = (bands: CkBand[], labels: string[], busy = false, acts: CkActs = FAM_ACTS): string => {
  ckActs = acts;
  try { return ckWide0(bands, labels, busy); } finally { ckActs = FAM_ACTS; }
};
/** 같은 종류 수 여럿을 한 줄에: 「이름 + 상자」 짝 */
/** 「이름 + 수 상자」 짝 여럿이 든 줄: 고정 열(이름 칸 폭·상자 폭이 모든 줄에서 같다 → 윗줄 N번째 짝 바로 아래에 아랫줄 N번째 짝), 상자는 한 줄 안에서 같은 크기 */
export const numSet = (items: [string, string][]): string => sameStep(`<div class="fam-set">${items.map(([l, c]) => `<span class="fam-set1"><span class="fam-l">${esc(l)}</span>${c}</span>`).join('')}</div>`);
const ckWide0 = (bands: CkBand[], labels: string[], busy = false): string => {
  const groups = bands.flatMap((b) => b.groups.map((g, i) => ({ ...g, name: g.name || b.title, band: i === 0 })));
  const rows = labels.map((label, r) => ({ label, marks: bands.flatMap((b) => b.marks[r]), acts: bands.flatMap((b) => b.acts[r]) }));
  const foot = bands.filter((b) => b.foot).map((b) => `<span class="ck-foot1">${b.foot}</span>`).join('');
  const pc = ckGrid(groups, rows, foot, bands.map((b) => b.title).join(' · '), busy).replace('class="ps-group ck', 'class="ps-group ck ck-pc');
  /** 폰: 수가 든 띠는 메뉴마다 묶어 쌓는다 (규격 「− 값 +」 상자는 여러 칸으로 나란히 못 넣는다) */
  const stack = (b: CkBand): string => {
    let at = 0;
    const cols = b.groups.map((g) => ({ g, from: (at += g.opts.length) - g.opts.length }));
    return `<div class="mx mx-grid ck-ph" style="--mx-n:${cols.length}"><section class="ps-group"><h3>${esc(b.title)}</h3><div class="ps-rows">${labels.map((label, r) => `<div class="mx-row"><b class="mx-label">${label}</b>${cols.map(({ g, from }) => `<div class="mx-cell"><span class="mx-site">${esc(g.name)}</span><span class="fam-set">${g.opts.map((o, i) => {
      const m = b.marks[r][from + i];
      return m === null || m === undefined ? '' : `<span class="fam-set1">${g.opts.length > 1 || o !== '켬' ? `<span>${esc(o)}</span>` : ''}${ckCtl(m, b.acts[r][from + i], `${esc(g.name)} ${esc(o)}`, false, busy)}</span>`;
    }).join('')}</span></div>`).join('')}</div>`).join('')}</div>${b.foot ? `<small class="mx-foot">${b.foot}</small>` : ''}</section></div>`;
  };
  const hasNum = (b: CkBand) => b.marks.some((row) => row.some((m) => m !== null && typeof m === 'object'));
  const ph = bands.map((b) => hasNum(b) ? stack(b) : ckGrid(b.groups, labels.map((label, r) => ({ label, marks: b.marks[r], acts: b.acts[r] })), b.foot, b.title, busy).replace('class="ps-group ck', 'class="ps-group ck ck-ph')).join('');
  return pc + ph;
};
/** 표 머리 (사이트 이름 줄). 스크롤해도 위에 붙어 있다 */
let mxSeq = 0;
export const mxHead = (cols: MxCol[], id = ''): string =>
  `<div class="mx-head"><span></span>${cols.map((c, i) => `<label for="${id}-${i}">${c.icon ?? ''}<span>${esc(c.name)}</span></label>`).join('')}</div>`;
// 폰: 사이트 탭 하나만 보인다 (시안: 라디오로 고름)
/** 격자: 줄 = 메뉴, 칸 = 메뉴마다 똑같이 있는 설정. 폰에서는 메뉴마다 칸을 세로로 쌓는다 */
export const mxGrid = (cols: MxCol[], rows: MxRow[], foot = '', title = ''): string =>
  `<div class="mx mx-grid" style="--mx-n:${cols.length}"><section class="ps-group">${title ? `<h3>${esc(title)}</h3>` : ''}<div class="ps-rows">${mxHead(cols)}${rows.map((r) => mxRow(cols, r)).join('')}</div>${foot ? `<small class="mx-foot">${foot.includes('<') ? foot : helpList(foot)}</small>` : ''}</section></div>`;
/** 값 하나짜리 줄 묶음 (그 틀의 모든 메뉴가 같이 쓴다) */
export const mxPlain = (groups: string): string => `<div class="mx" style="--mx-n:1">${groups}</div>`;
export const mxTable = (cols: MxCol[], groups: string): string => {
  const id = `mxr${++mxSeq}`;
  return `<div class="mx" style="--mx-n:${cols.length}">${cols.map((_, i) => `<input type="radio" class="mx-r" name="${id}" id="${id}-${i}"${i === 0 ? ' checked' : ''}>`).join('')}${mxHead(cols, id)}${groups}</div>`;
};

/** 설명 한 가지 모양: 「하는 일」 한 문장(lead) + 이름 붙은 것이 여럿이면 항목 목록. 제목·세로선 없음 */
export const helpBox = (lead: string, items: [string, string][] = []): string =>
  `<span class="hb">${lead ? `<span class="hb-lead">${lead}</span>` : ''}${items.length ? `<span class="hb-list">${items.map(([t, d]) => `<span class="hb-i"><b>${esc(t)}</b><span>${d}</span></span>`).join('')}</span>` : ''}</span>`;
