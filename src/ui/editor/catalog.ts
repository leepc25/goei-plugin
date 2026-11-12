// AI 상담이 아는 설정 목록 (2026-11-12 사용자: 호출 흐름만이 아니라 모든 설정).
// 목록을 손으로 적지 않는다. 설정 탭의 메뉴 화면(정의표 core/setdef·세부 값 표 core/advanced·격자 ui/famtable 이 그린 것)을 그대로 읽는다:
//   줄 = 화면의 줄(.ps-row · 격자 줄 · 표 줄 · 상태창 칸 줄), 이름·묶음·설명 = 그 줄에 적힌 글,
//   지금 값·고를 수 있는 값·범위·글자 수 상한 = 그 조작이 지닌 값, 바꾸는 동작 = 그 조작을 누르거나 쳤을 때 보내는 것(data-action · data-change) 그대로.
// 그래서 화면에 보이는 값과 상담이 아는 값이 다를 수 없고, 줄을 새로 만들면 목록에 저절로 들어온다.
// 조작이 아닌 단추(지우기·추가·되돌리기·지금 실행·다른 화면으로 가기)는 눌린 상태(aria-pressed · role=switch)가 없어 목록에 동작이 생기지 않는다.
// 이름 없는 표 칸(고유 상점 표·시그니처 상품 표)도 줄 이름이 없어 들어오지 않는다.
import { consultValue, type ConsultItem } from '../../core/consult';

export type CatCtl =
  /** 고르기: 값 → 그 단추가 보내는 값 */
  | { t: 'pick'; action: string; send: Record<string, string> }
  /** 켬·끔 하나: 누르면 반대 값이 간다 */
  | { t: 'toggle'; action: string; send: string }
  /** 수 칸·글 칸: 「열쇠=값」(열쇠가 없으면 값만) */
  | { t: 'input'; action: string; key: string }
  /** − + 단추만 있는 수: 한 번에 한 칸 */
  | { t: 'rel'; action: string; minus: string; plus: string };

export interface CatRow extends ConsultItem {
  page: string;
  /** 「설정으로 가기 →」: [노드, 갈 줄] */
  go: [string, string];
  /** 메뉴의 줄 이름 목록·사용자 글 대조에 쓰는 이름들 (줄 이름, 격자면 열 묶음 이름) */
  keys: string[];
  ctl?: CatCtl;
}
export interface CatMenu { page: string; menu: string; intro: string; rows: CatRow[] }

/** 요소의 글 (딸린 요소 사이는 빈칸으로 띄운다: 항목 목록 「이름 뜻」이 붙어 나오지 않게) */
function txt(el: Element | null | undefined): string {
  if (!el) return '';
  const parts: string[] = [];
  const walk = (n: Node): void => n.childNodes.forEach((c) => {
    if (c.nodeType === 3) parts.push(c.textContent ?? '');
    else if (c.nodeType === 1) { parts.push(' '); walk(c); parts.push(' '); }
  });
  walk(el);
  return parts.join('').replace(/\s+/g, ' ').trim();
}
/** 그 요소가 직접 지닌 글 (배지·딸린 요소 빼고) */
const own = (el: Element | null | undefined) => (el ? [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent ?? '').join('').replace(/\s+/g, ' ').trim() : '');
const ROW = '.ps-row, .ck-row, .mx-row, .st-col-row';
/** 설정 줄이 아닌 줄: 다음 요청에 들어갈 로어북 목록 (채팅에서 나온 글이 적힌다) */
const NOT_SETTING = '.lc-row';
/** 폰용으로 한 벌 더 그린 것 (같은 조작) */
const TWIN = '.ck-ph, .fl-ph';
const CTL = 'button[data-action], input[data-change], textarea[data-change]';
/** 「열쇠=값」「열쇠:값」에서 열쇠 */
const keyOf = (v: string) => (v.includes('=') ? v.slice(0, v.lastIndexOf('=')) : v.includes(':') ? v.slice(0, v.lastIndexOf(':')) : '');

/** 격자 머리: 칸 번호 → [열 묶음 이름, 열 이름] */
function gridCols(section: Element | null): [string, string][] {
  if (!section) return [];
  const opts = [...section.querySelectorAll(':scope > .ps-rows > .ck-h2 > span')].slice(1).map(txt);
  const groups: string[] = [];
  section.querySelectorAll<HTMLElement>(':scope > .ps-rows > .ck-h1 > b').forEach((b) => {
    const n = Number(/span\s+(\d+)/.exec(b.getAttribute('style') ?? '')?.[1] ?? 1);
    for (let i = 0; i < n; i++) groups.push(txt(b));
  });
  return opts.map((o, i) => [groups[i] ?? '', o]);
}

/** 조작 옆에 붙은 이름 (최소·최대, 묶음 안 이름, 표의 사이트 이름, 읽어 주기 이름) */
function subOf(el: Element, rowLabel: string): string {
  const set1 = el.closest('.fam-set1');
  if (set1) { const l = txt(set1.querySelector(':scope > span')); if (l) return l; }
  const box = el.closest('.st-step') ?? el.closest('.gx-switch-wrap') ?? el.closest('.gx-segs') ?? el;
  const prev = box.previousElementSibling;
  if (prev && prev.tagName === 'SPAN' && !prev.querySelector(CTL) && !prev.matches('.gx-switch-wrap, .ph-inline')) { const l = txt(prev); if (l && l.length <= 12) return l; }
  const site = txt(el.closest('.mx-cell')?.querySelector(':scope > .mx-site'));
  if (site) return site;
  const aria = (el.getAttribute('aria-label') ?? '').replace(/\s+/g, ' ').trim();
  const rest = aria.startsWith(rowLabel) ? aria.slice(rowLabel.length).trim() : aria;
  return rest === rowLabel ? '' : rest;
}

/** 메뉴 화면 한 장(HTML)에서 줄을 읽는다 */
export function pageRows(html: string, page: string, menu: string): CatRow[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out: CatRow[] = [];
  const seen = new Set<string>();
  let infoN = 0;
  const cols = new Map<Element, [string, string][]>();
  const colsOf = (s: Element | null) => { if (!s) return []; if (!cols.has(s)) cols.set(s, gridCols(s)); return cols.get(s)!; };

  doc.querySelectorAll<HTMLElement>(ROW).forEach((row) => {
    if (row.closest(TWIN) || row.matches(NOT_SETTING)) return;
    const section = row.closest('.ps-group, .ps-card, details');
    const headEl = section?.querySelector('h3, h4, summary') ?? null;
    const group = own(headEl) || txt(headEl);
    const isPs = row.matches('.ps-row');
    const isGrid = row.matches('.ck-row');
    const labelEl = row.querySelector(isPs ? ':scope > .ps-label > b' : isGrid ? ':scope > .ck-name' : row.matches('.mx-row') ? ':scope > .mx-label' : ':scope > .st-col-name > b');
    const label = isPs ? own(labelEl) : txt(labelEl);
    if (!label) return;
    const help = txt(row.querySelector(isPs ? ':scope > .ps-label > small' : row.matches('.mx-row') ? ':scope > .mx-help' : ':scope > .st-col-name > small'));
    const badge = isPs ? txt(labelEl?.querySelector('i.gx-scope')) : '';
    const scope = badge && badge !== '이 채팅' ? badge : undefined;
    const grp = txt(section?.querySelector('h3'));
    const spot = (colGroup = ''): [string, string] => [`set:${page}`, isPs ? `r:${label}${grp ? `@${grp}` : ''}` : colGroup ? `r:${colGroup}` : ''];
    const els = [...row.querySelectorAll<HTMLElement>(CTL)].filter((e) => e.closest(ROW) === row);
    const gcols = isGrid ? colsOf(section) : [];
    const cellAt = (e: Element): [string, string] => {
      const cell = e.closest('.ck-cell');
      const i = cell ? [...row.querySelectorAll(':scope > .ck-cell')].indexOf(cell) : -1;
      return gcols[i] ?? ['', ''];
    };
    const made: CatRow[] = [];
    const used = new Set<Element>();
    const push = (r: Omit<CatRow, 'page' | 'menu' | 'group' | 'help' | 'go' | 'keys'> & { colGroup?: string }) => {
      if (seen.has(r.id)) return;
      seen.add(r.id);
      const { colGroup, ...rest } = r;
      made.push({ ...rest, page, menu, group, help, scope, go: spot(colGroup), keys: colGroup ? [label, colGroup] : [label] });
    };
    for (const e of els) {
      if (used.has(e)) continue;
      used.add(e);
      const locked = e.hasAttribute('disabled') || e.hasAttribute('readonly');
      if (e.tagName !== 'BUTTON') {
        const input = e as HTMLInputElement;
        const type = (input.getAttribute('type') ?? 'text').toLowerCase();
        if (['hidden', 'file', 'checkbox', 'radio', 'color'].includes(type)) continue;
        const action = input.dataset.change ?? '';
        const key = input.dataset.key ?? '';
        const [cg, co] = cellAt(e);
        // 격자의 수 칸: 열 묶음에 열이 하나뿐이면 그 열 이름은 단위다 (「동시 최대」 아래 「개」)
        const lone = isGrid && !!cg && gcols.filter(([g]) => g === cg).length === 1;
        const sub = isGrid ? (lone ? cg : [cg, co].filter(Boolean).join(' ')) : subOf(e, label);
        const value = (e.tagName === 'TEXTAREA' ? e.textContent ?? '' : input.getAttribute('value') ?? '').replace(/\r/g, '');
        const lo = Number(input.getAttribute('min'));
        const hi = Number(input.getAttribute('max'));
        const isNum = (type === 'number' || type === 'range') && input.hasAttribute('min') && input.hasAttribute('max') && Number.isFinite(lo) && Number.isFinite(hi);
        const unit = (lone ? co : '') || txt(e.closest('.st-step')?.querySelector(':scope > span')) || txt(e.parentElement?.querySelector(':scope > output')).replace(/^-?[\d,.\s]+/, '') || undefined;
        const max = Number(input.getAttribute('maxlength')) || undefined;
        push({ id: key ? `${action}.${key}` : action, name: sub, kind: isNum ? 'num' : 'text', cur: isNum ? value.trim() : value.trim(), ...(isNum ? { lo, hi, unit } : { max, multi: e.tagName === 'TEXTAREA' }), locked, colGroup: cg || undefined, ctl: { t: 'input', action, key } });
        continue;
      }
      const action = e.dataset.action ?? '';
      const value = e.dataset.value ?? '';
      if (e.getAttribute('role') === 'switch') {
        const on = e.getAttribute('aria-checked') === 'true';
        push({ id: `${action}${keyOf(value) ? `.${keyOf(value)}` : ''}`, name: subOf(e, label), kind: 'pick', cur: on ? '1' : '0', opts: [['1', 'ON'], ['0', 'OFF']], locked, ctl: { t: 'toggle', action, send: value } });
        continue;
      }
      if (e.classList.contains('gx-step')) {
        // − + 단추: 같은 상자에 수 칸이 있으면 그 칸이 조작이다. 없으면 한 칸씩 움직이는 수
        const box = e.closest('.st-step');
        if (!box || box.querySelector('input[data-change]')) continue;
        const btns = [...box.querySelectorAll<HTMLElement>('button.gx-step[data-action]')];
        btns.forEach((b) => used.add(b));
        const minus = btns.find((b) => (b.dataset.value ?? '').endsWith('-'));
        const plus = btns.find((b) => (b.dataset.value ?? '').endsWith('+'));
        if (!minus || !plus) continue;
        const shown = txt(box.querySelector(':scope > b'));
        const m = /-?\d[\d,]*/.exec(shown);
        const n = m ? Number(m[0].replace(/,/g, '')) : 0;
        const key = (minus.dataset.value ?? '').slice(0, -1).replace(/:$/, '');
        push({ id: key ? `${action}.${key}` : action, name: subOf(e, label), kind: 'step', cur: String(n), unit: m ? shown.slice((m.index ?? 0) + m[0].length).trim() || undefined : undefined, zero: m ? undefined : shown || undefined,
          ...(minus.hasAttribute('disabled') ? { lo: n } : {}), ...(plus.hasAttribute('disabled') ? { hi: n } : {}), locked: false, ctl: { t: 'rel', action, minus: minus.dataset.value ?? '', plus: plus.dataset.value ?? '' } });
        continue;
      }
      if (!e.hasAttribute('aria-pressed')) continue; // 조작이 아닌 단추 (지우기·추가·가기·지금 실행)
      const key = keyOf(value);
      const mates = els.filter((x) => x.tagName === 'BUTTON' && x.hasAttribute('aria-pressed') && x.dataset.action === action && keyOf(x.dataset.value ?? '') === key && !x.classList.contains('gx-step') && x.getAttribute('role') !== 'switch');
      const round = e.classList.contains('round');
      const [cg, co] = cellAt(e);
      if (mates.length < 2 && !round) {
        // 켬·끔 하나 (네모 칸·칩): 누르면 반대 값
        const on = e.getAttribute('aria-pressed') === 'true';
        const name = isGrid ? [cg, co === '켬' ? '' : co].filter(Boolean).join(' ') : e.classList.contains('gx-chip') ? txt(e) : subOf(e, label);
        push({ id: `${action}${key ? `.${key}` : ''}`, name, kind: 'pick', cur: on ? '1' : '0', opts: [['1', 'ON'], ['0', 'OFF']], locked, colGroup: cg || undefined, ctl: { t: 'toggle', action, send: value } });
        continue;
      }
      mates.forEach((x) => used.add(x));
      const opts: [string, string][] = mates.map((x) => [x.dataset.value ?? '', (isGrid ? cellAt(x)[1] : '') || txt(x) || (x.getAttribute('aria-label') ?? '')]);
      const curEl = mates.find((x) => x.getAttribute('aria-pressed') === 'true');
      push({ id: `${action}${key ? `.${key}` : ''}`, name: isGrid ? cg : '', kind: 'pick', cur: curEl?.dataset.value ?? '', opts, locked: mates.every((x) => x.hasAttribute('disabled')), colGroup: cg || undefined, ctl: { t: 'pick', action, send: Object.fromEntries(opts.map(([v]) => [v, v])) } });
    }
    if (!made.length) {
      // 조작이 없는 줄: 설명만
      out.push({ id: `row.${page}.${++infoN}`, page, menu, group, name: label, kind: 'info', cur: '', help, go: spot(), keys: [label] });
      return;
    }
    // 이름: 조작이 하나면 줄 이름, 여럿이면 「줄 · 조작」 (딸린 이름이 없는 조작은 줄 이름 그대로: 값이 서로 달라 헷갈리지 않는다)
    for (const r of made) {
      r.name = r.name && (made.length > 1 || !isPs) ? `${label} · ${r.name}` : label;
      out.push(r);
    }
  });
  // 격자 아래 설명: 그 격자 이름으로 설명 줄 하나
  doc.querySelectorAll<HTMLElement>('.ps-group > .mx-foot').forEach((foot) => {
    if (foot.closest(TWIN)) return;
    const title = txt(foot.parentElement?.querySelector('h3'));
    const help = txt(foot);
    if (title && help) out.push({ id: `row.${page}.${++infoN}`, page, menu, group: title, name: title, kind: 'info', cur: '', help, go: [`set:${page}`, ''], keys: [title] });
  });
  return out;
}

/* ── 설정 창이 주는 것: 메뉴 목록·소개·화면 그리기 (editor/index.ts 가 건다) ── */
export interface CatalogHost {
  /** 설정 탭의 메뉴: [페이지, 이름, 소개] */
  pages(): [string, string, string][];
  /** 그 메뉴 화면의 HTML (지금 채팅 값으로) */
  render(page: string): string;
  /** 설정 탭 밖의 항목 이름 (안내만) */
  others(): string;
  /** 지금 보고 있는 메뉴 ('' = 설정 메뉴가 아님) */
  current(): string;
}
let host: CatalogHost | null = null;
export const setCatalogHost = (h: CatalogHost): void => { host = h; };

export function catalogPage(page: string): CatRow[] {
  const p = host?.pages().find(([id]) => id === page);
  if (!host || !p) return [];
  try { return pageRows(host.render(page), page, p[1]); } catch { return []; }
}
export function catalogAll(): CatMenu[] {
  return (host?.pages() ?? []).map(([page, menu, intro]) => ({ page, menu, intro, rows: catalogPage(page) }));
}
export const catalogOthers = (): string => host?.others() ?? '';
export const catalogCurrent = (): string => host?.current() ?? '';

/** 값 v 로 바꾸는 동작 (rel 은 한 칸: 지금 값에서 v 쪽으로) */
export function sendsFor(r: CatRow, v: string): [string, string][] {
  const c = r.ctl;
  if (!c || r.locked) return [];
  if (c.t === 'pick') return v in c.send ? [[c.action, c.send[v]]] : [];
  if (c.t === 'toggle') return v !== r.cur ? [[c.action, c.send]] : [];
  if (c.t === 'input') return [[c.action, c.key ? `${c.key}=${v}` : v]];
  const d = Number(v) - Number(r.cur);
  return d === 0 ? [] : [[c.action, d > 0 ? c.plus : c.minus]];
}

/** 상담이 절대 부르지 않는 동작 이름 (지우기·초기화·추가·저장·불러오기·업데이트·다른 화면) — 목록이 조작만 담는 것과 따로 한 번 더 막는다 */
const NEVER = /-(del|reset|clear|add|yes|no|import|export|save|load)$|^(upd|dir|rec|ed|man|guide|rule|ip|ai|fl)-/;
/** 상담 전용 통로(ai-do)가 받는 동작인가: 그 메뉴 화면에 지금 있는, 잠기지 않은 조작이 보내는 것과 같아야 한다 */
export function consultAllowed(page: string, action: string, value: string): boolean {
  if (NEVER.test(action)) return false;
  return catalogPage(page).some((r) => {
    const c = r.ctl;
    if (!c || r.locked || c.action !== action) return false;
    if (c.t === 'pick') return Object.values(c.send).includes(value);
    if (c.t === 'toggle') return c.send === value;
    if (c.t === 'rel') return value === c.minus || value === c.plus;
    if (c.key && !value.startsWith(`${c.key}=`)) return false;
    const v = c.key ? value.slice(c.key.length + 1) : value;
    // 수 칸·글 칸: 범위·글자 수·꺾쇠를 여기서도 본다 (여러 줄 글은 진짜 줄바꿈으로 온다)
    return consultValue(r.kind === 'text' ? { ...r, multi: true } : r, v.replace(/\n/g, '\\n')) !== null;
  });
}
