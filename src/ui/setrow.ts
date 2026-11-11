// 설정 줄 그리기 (2026-11-11 설정 개편 2단계). 설정 줄·묶음의 모양은 여기 한 곳에서만 만든다.
// 페이지는 정의표(core/setdef)와 「선」(Wire: 지금 값 읽기·버튼 이름)을 주고, 줄 HTML 을 직접 쓰지 않는다.
import { onOffSwitch } from './controls';
import type { SetDef, SetGroup, SetPage } from '../core/setdef/types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 범위 배지: 'device' = 이 기기 공통 값, 'chat'·'defaults' = 범위 전환이 없는 페이지에서 그 줄만 다른 범위일 때 */
export const SCOPE_BADGE = { device: '이 기기', chat: '이 채팅', defaults: '새 채팅 기본값' } as const;
export type RowScope = keyof typeof SCOPE_BADGE;
/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작. label·help·control 은 HTML */
export const setRow = (label: string, control: string, help = '', cls = '', scope?: RowScope): string =>
  `<div class="ps-row${cls ? ` ${cls}` : ''}"><div class="ps-label"><b>${label}${scope ? `<i class="gx-scope${scope === 'device' ? '' : ` ${scope}`}">${SCOPE_BADGE[scope]}</i>` : ''}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
/** 설정 묶음 */
export const setGroup = (title: string, rows: string, note = ''): string =>
  `<section class="ps-group">${title ? `<h3>${title}</h3>` : ''}${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${rows}</div></section>`;

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
}

/** 버튼 이름: 기능 열쇠가 머리 (gn-cfg·gn-text·gn-count) */
const act = (page: SetPage, kind: 'cfg' | 'text' | 'count' | 'num' | 'shnum' | 'step') => `${page.id}-${kind}`;

/** 수 한 칸 */
const sk = (w: Wire, key: string) => (w.scope ? `${w.scope}:${key}` : key);
const numBox = (page: SetPage, key: string, cur: string | number, lo: number, hi: number, unit: string, aria: string, kind: 'num' | 'shnum' | 'count' = 'num') =>
  `<input class="gx-search ph-pct" type="number" min="${lo}" max="${hi}" data-change="${act(page, kind)}" data-key="${key}" value="${esc(cur)}" aria-label="${esc(aria)}"><span>${unit}</span>`;

function control(page: SetPage, d: SetDef, w: Wire): { ctl: string; cur: string } {
  const c = d.ctl;
  if (c.t === 'seg') {
    const raw = w.cur(d.key);
    const cur = c.fb !== undefined && !c.opts.some(([v]) => v === raw) ? c.fb : raw;
    const seg = page.flat ? setSeg(`${page.id}-${d.key}`, '', cur, c.opts, w.busy) : setSeg(act(page, 'cfg'), sk(w, d.key), cur, c.opts, w.busy);
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
    return { ctl: `<input class="gx-search ps-text" data-change="${page.flat ? `${page.id}-${d.key}"` : `${act(page, 'text')}" data-key="${sk(w, d.key)}"`} value="${esc(v === '-' ? '' : v)}"${c.max ? ` maxlength="${c.max}"` : ''} placeholder="${esc(c.ph)}">`, cur: v };
  }
  if (c.t === 'minmax') {
    const [a, b] = w.minmax!(d.key);
    if (c.keys) {
      const one = (key: string, n: number, name: string) => numBox(page, sk(w, key), n, c.lo, c.hi, c.unit, `${d.aria ?? d.label} ${name}`, c.act ?? 'num');
      return { ctl: `<span class="ph-inline"><span>최소</span>${one(c.keys[0], a, '최소')}<span>최대</span>${one(c.keys[1], b, '최대')}</span>`, cur: `${a}~${b}` };
    }
    const box = (side: 'min' | 'max', n: number, name: string) =>
      `<input class="gx-search ph-pct" type="number" min="${c.lo}" max="${c.hi}" data-change="${act(page, c.act ?? 'count')}" data-key="${d.key}_${side}" value="${n}" aria-label="${d.label} ${name}"><span>${c.unit}</span>`;
    return { ctl: `<span class="ph-inline"><span>최소</span>${box('min', a, '최소')}<span>최대</span>${box('max', b, '최대')}</span>`, cur: `${a}~${b}` };
  }
  if (c.t === 'step') {
    const n = Number(w.cur(d.key));
    const b = (dir: '-' | '+', on: boolean, name: string) => `<button class="gx-step" data-action="${c.action ?? act(page, 'step')}" data-value="${sk(w, c.vkey ?? d.key)}:${dir}" ${on ? '' : 'disabled'} aria-label="${esc(d.label)} ${name}">${dir === '-' ? '−' : '+'}</button>`;
    return { ctl: `<div class="st-step">${b('-', n > c.lo, '줄이기')}<b>${esc(`${n}${c.unit}`)}</b>${b('+', n < c.hi, '늘리기')}</div>`, cur: String(n) };
  }
  return { ctl: '', cur: '' };
}

/** 정의표의 줄 하나 */
export function defRow(page: SetPage, d: SetDef, w: Wire): string {
  for (const c of d.show ? (Array.isArray(d.show) ? d.show : [d.show]) : []) {
    if ('eq' in c ? w.cur(c.key) !== c.eq : w.cur(c.key) === c.ne) return '';
  }
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
  return setRow(d.label, ctl, help, '', d.scope);
}
/** 정의표의 묶음 하나 */
export const defGroup = (page: SetPage, g: SetGroup, w: Wire): string =>
  setGroup(g.title === '@page' ? (w.pageTitle ?? '') : g.title, (g.note ? `<p class="ps-note">${g.note}</p>` : '') + (w.lead?.[g.title] ?? '') + g.rows.map((d) => defRow(page, d, w)).join(''));
/** 정의표 전체 */
export const defGroups = (page: SetPage, w: Wire): string => page.groups.map((g) => defGroup(page, g, w)).join('\n      ');
