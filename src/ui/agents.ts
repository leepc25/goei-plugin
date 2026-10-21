// 상황판 요원 칸 (2026-10-20 사용자 시안): 모니터 벽 또는 근무 현황 목록. 누르면 요원 사원증 창, 마우스를 올리면 머리 위 말풍선

import { ICONS } from './icons';

export type AgentView = 'wall' | 'list';
/** 편성 기준: 작전 중(op) · 편성 가능(ok) · 작전 중은 아니지만 편성 불가(lock: 실종·사망 등) */
export type AgentSide = 'op' | 'ok' | 'lock';

export interface AgentItem {
  id: string;
  name: string;
  english: string;
  /** 상태 이름 그대로 (작전투입은 「작전」) */
  st: string;
  side: AgentSide;
  /** 상태창의 요원 상황 글 */
  situation: string;
  dept: string;
  rank: string;
  /** 작은 얼굴 (avatar html) */
  face: string;
  /** 사원증 창의 큰 사진 주소 */
  photo: string | null;
  /** 투입된 상황 이름 */
  deployed: string;
  /** 괴담톡 연락처가 있으면 위키 문서 이름 (없으면 톡·위키 단추를 숨긴다) */
  wiki: string | null;
}

/** 열린 사원증 창의 요원 id */
export const agUi = { pop: '' };
let last: AgentItem[] = [];
let lastOrg = '';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const ORDER: Record<AgentSide, number> = { op: 0, ok: 1, lock: 2 };
const OSD: Record<AgentSide, string> = { op: 'LIVE', ok: 'STANDBY', lock: 'OFFLINE' };
const line = (a: AgentItem) => a.situation || (a.side === 'op' ? a.deployed : '') || '대기 중';
const tip = (a: AgentItem) => `data-agtip="${esc(`${a.name} · ${a.st}`)}" data-agtip-text="${esc(line(a))}"`;

function tile(a: AgentItem, i: number): string {
  return `<li class="gx-agmon ${a.side}" data-action="agent-info" data-value="${esc(a.id)}" ${tip(a)}><span class="gx-agmon-scr">${a.face}
    <span class="gx-agmon-osd"><span>CH-${String(i + 1).padStart(2, '0')}</span><span class="st"><i></i>${OSD[a.side]}</span></span>
    <span class="gx-agmon-cap"><b>${esc(a.name)}</b><small>${esc(a.side === 'op' && a.deployed ? a.deployed : line(a))}</small></span></span></li>`;
}

function row(a: AgentItem): string {
  const tools = a.wiki !== null
    ? `<span class="gx-agrow-tools"><button class="gx-acard-tool" data-action="agent-talk" data-value="${esc(a.id)}" title="괴담톡" aria-label="${esc(a.name)}에게 톡">${ICONS.phone}</button><button class="gx-acard-tool" data-action="wiki-goto" data-value="${esc(a.wiki)}" title="위키" aria-label="${esc(a.name)} 위키">${ICONS.wiki}</button></span>`
    : '';
  return `<li class="gx-agrow ${a.side}" data-action="agent-info" data-value="${esc(a.id)}" ${tip(a)}>${a.face}<b>${esc(a.name)}</b><span class="gx-agrow-st"><i></i>${esc(a.st)}</span><span class="gx-agrow-msg">${esc(line(a))}</span>${tools}</li>`;
}

/** 요원 칸 본문. 작전 중 → 편성 가능 → 불가 순서. total: 명단 인원 */
export function agentPanel(items: AgentItem[], view: AgentView, o: { total: number; org: string; extra: string; empty: string }): string {
  last = items;
  lastOrg = o.org;
  const list = [...items].sort((a, b) => ORDER[a.side] - ORDER[b.side]);
  const op = items.filter((a) => a.side === 'op').length;
  // 모양 바꾸기: 제목 옆 작은 아이콘 두 개 (설정 → 화면 「요원 칸」과 같은 값)
  const seg = `<span class="gx-agseg" role="tablist" aria-label="요원 칸 모양">${(['wall', 'list'] as const)
    .map((v) => `<button role="tab" class="${view === v ? 'on' : ''}" data-action="agents-view" data-value="${v}" aria-selected="${view === v}" title="${v === 'wall' ? '모니터' : '목록'}" aria-label="${v === 'wall' ? '모니터' : '목록'}">${v === 'wall' ? ICONS.grid : ICONS.list}</button>`)
    .join('')}</span>`;
  const head = `<h2><b>요원</b>${seg}<span class="gx-opcnt"><em class="op">작전<i>${op}</i><u>/${o.total}</u></em></span></h2>`;
  const body = !list.length
    ? `<p class="gx-none">${esc(o.empty)}</p>`
    : view === 'list'
      ? `<ul class="gx-agrows">${list.map(row).join('')}</ul>`
      : `<ul class="gx-agwall">${list.map(tile).join('')}</ul>`;
  return `<section class="gx-sec gx-agbox ${view}" id="gx-sec-ag">${head}${o.extra}${body}</section>`;
}

/** 요원 사원증 창 (가로 명함 비율): 사진 · 이름·영문명·소속·직급·투입·상황 · 번호와 톡·위키 */
export function agentPopup(): string {
  const org = lastOrg;
  const a = last.find((x) => x.id === agUi.pop);
  if (!a) {
    agUi.pop = '';
    return '';
  }
  const btns = a.wiki !== null
    ? `<button data-action="agent-talk" data-value="${esc(a.id)}">${ICONS.phone}괴담톡</button><button data-action="wiki-goto" data-value="${esc(a.wiki)}">${ICONS.wiki}위키</button>`
    : '';
  const rows = [['소속', a.dept], ['직급', a.rank], ['투입', a.deployed], ['상황', a.situation || '대기 중']]
    .filter(([, v]) => v)
    .map(([k, v]) => `<dt>${k}</dt><dd${k === '투입' ? ' class="dep"' : ''}>${esc(v)}</dd>`)
    .join('');
  return `<button class="ev-scrim" data-action="agent-info" data-value="${esc(a.id)}" aria-label="닫기"></button>
    <div class="gx-agcard ${a.side}" role="dialog" aria-label="${esc(a.name)}">
      <div class="gx-agcard-band">AGENT ID<b>${esc(org)}</b><button class="gx-agcard-x" data-action="agent-info" data-value="${esc(a.id)}" aria-label="닫기">✕</button></div>
      <div class="gx-agcard-main"><span class="gx-agcard-ph">${a.photo ? `<img src="${esc(a.photo)}" alt="">` : a.face}</span>
        <span class="gx-agcard-t"><span class="nm">${esc(a.name)}</span>${a.english ? `<span class="en">${esc(a.english)}</span>` : ''}<dl>${rows}</dl></span></div>
      <div class="gx-agcard-foot"><span class="code">NO. ${esc(a.id.replace(/^([A-Z]+)(\d)/, '$1-$2'))}<u></u></span>${btns}</div>
    </div>`;
}

/** 마우스를 올리면 그 칸 머리 위에 상황 말풍선 (꼬리는 아래로). 손가락 기기는 눌러서 사원증 창을 본다 */
export function bindAgentTips(root: HTMLElement): void {
  let bub: HTMLElement | null = null;
  const hide = () => {
    bub?.remove();
    bub = null;
  };
  root.addEventListener('mouseover', (ev) => {
    if (!matchMedia('(hover: hover)').matches) return;
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-agtip]');
    if (!el || el.contains(ev.relatedTarget as Node | null)) return;
    hide();
    bub = document.createElement('div');
    bub.className = 'gx-agtip';
    bub.innerHTML = `<b>${esc(el.dataset.agtip ?? '')}</b>${esc(el.dataset.agtipText ?? '')}`;
    root.appendChild(bub);
    const r = el.getBoundingClientRect();
    const w = bub.offsetWidth;
    const x = Math.min(window.innerWidth - w - 8, Math.max(8, r.left + r.width / 2 - w / 2));
    bub.style.left = `${x}px`;
    bub.style.top = `${r.top - bub.offsetHeight - 10}px`;
    // 꼬리는 칸 가운데를 가리킨다 (말풍선이 화면 끝에서 밀려도)
    bub.style.setProperty('--tail', `${r.left + r.width / 2 - x}px`);
  });
  root.addEventListener('mouseout', (ev) => {
    const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-agtip]');
    if (el && !el.contains(ev.relatedTarget as Node | null)) hide();
  });
  root.addEventListener('click', hide, true);
  root.addEventListener('scroll', hide, true);
}
