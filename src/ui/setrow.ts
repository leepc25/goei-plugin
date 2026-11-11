// 설정 줄 그리기 (2026-11-11 설정 개편 2단계). 설정 줄·묶음의 모양은 여기 한 곳에서만 만든다.
// 페이지는 정의표(core/setdef)와 「선」(Wire: 지금 값 읽기·버튼 이름)을 주고, 줄 HTML 을 직접 쓰지 않는다.
import { onOffSwitch } from './controls';
import type { SetDef, SetGroup, SetPage } from '../core/setdef/types';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작. label·help·control 은 HTML */
export const setRow = (label: string, control: string, help = '', cls = ''): string =>
  `<div class="ps-row${cls ? ` ${cls}` : ''}"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
/** 설정 묶음 */
export const setGroup = (title: string, rows: string, note = ''): string =>
  `<section class="ps-group">${title ? `<h3>${title}</h3>` : ''}${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${rows}</div></section>`;

/** 고르기 조작: ON/OFF 둘뿐이면 스위치. 버튼 값은 「열쇠=값」 */
export function setSeg(action: string, key: string, cur: string, items: [string, string][]): string {
  const sw = onOffSwitch(items, cur, action, (v) => `${key}=${v}`);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${key}=${v}" aria-pressed="${cur === v}">${label}</button>`)
    .join('')}</div>`;
}

/** 페이지와 정의표를 잇는 선 */
export interface Wire {
  /** 지금 저장된 값 (없으면 기본값) */
  cur(key: string): string;
  /** 최소·최대 줄의 지금 값 */
  minmax?(key: string): [number, number];
  /** custom 줄의 조작 HTML 과, 값에 따라 달라지는 설명 */
  custom?: Record<string, () => { ctl: string; help?: string }>;
  /** 페이지 이름 (묶음 이름 '@page' 자리) */
  pageTitle?: string;
}

/** 버튼 이름: 기능 열쇠가 머리 (gn-cfg·gn-text·gn-count) */
const act = (page: SetPage, kind: 'cfg' | 'text' | 'count') => `${page.id}-${kind}`;

function control(page: SetPage, d: SetDef, w: Wire): { ctl: string; cur: string } {
  const c = d.ctl;
  if (c.t === 'seg') {
    const raw = w.cur(d.key);
    const cur = c.fb !== undefined && !c.opts.some(([v]) => v === raw) ? c.fb : raw;
    return { ctl: setSeg(act(page, 'cfg'), d.key, cur, c.opts), cur };
  }
  if (c.t === 'text') {
    const v = w.cur(d.key);
    return { ctl: `<input class="gx-search ps-text" data-change="${act(page, 'text')}" data-key="${d.key}" value="${esc(v === '-' ? '' : v)}" placeholder="${esc(c.ph)}">`, cur: v };
  }
  if (c.t === 'minmax') {
    const [a, b] = w.minmax!(d.key);
    const box = (side: 'min' | 'max', n: number, name: string) =>
      `<input class="gx-search ph-pct" type="number" min="${c.lo}" max="${c.hi}" data-change="${act(page, 'count')}" data-key="${d.key}_${side}" value="${n}" aria-label="${d.label} ${name}"><span>${c.unit}</span>`;
    return { ctl: `<span class="ph-inline"><span>최소</span>${box('min', a, '최소')}<span>최대</span>${box('max', b, '최대')}</span>`, cur: `${a}~${b}` };
  }
  return { ctl: '', cur: '' };
}

/** 정의표의 줄 하나 */
export function defRow(page: SetPage, d: SetDef, w: Wire): string {
  if (d.ctl.t === 'custom') {
    const c = w.custom?.[d.key]?.();
    if (!c) return '';
    return setRow(d.label, c.ctl, c.help ?? (typeof d.help === 'string' ? d.help : ''));
  }
  const { ctl, cur } = control(page, d, w);
  const help = typeof d.help === 'string' ? d.help : d.help ? (d.help[cur] ?? '') : '';
  return setRow(d.label, ctl, help);
}
/** 정의표의 묶음 하나 */
export const defGroup = (page: SetPage, g: SetGroup, w: Wire): string =>
  setGroup(g.title === '@page' ? (w.pageTitle ?? '') : g.title, g.rows.map((d) => defRow(page, d, w)).join(''));
/** 정의표 전체 */
export const defGroups = (page: SetPage, w: Wire): string => page.groups.map((g) => defGroup(page, g, w)).join('\n      ');
