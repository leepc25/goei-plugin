// 상황판 요원 칸 (2026-10-20 사용자 시안): 모니터 벽 또는 근무 현황 목록. 누르면 요원 사원증 창, 마우스를 올리면 머리 위 말풍선

import { ICONS } from './icons';
import { headSeg } from './evcard';

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
const line = (a: AgentItem) => a.situation || (a.side === 'op' ? a.deployed : '') || '대기 중';
const tip = (a: AgentItem) => `data-agtip="${esc(`${a.name} · ${a.st}`)}" data-agtip-text="${esc(line(a))}"`;

/** 전광판 글: 넘치면 같은 글을 한 번 더 붙여 왼쪽으로만 끊김 없이 흐른다 */
const flow = (tag: string, text: string, cls = '') => `<${tag} class="${cls ? `${cls} ` : ''}gx-flow"><span data-t="${esc(text)}">${esc(text)}</span></${tag}>`;

// 오른쪽 위 화면 표시는 지금 상태 그대로 (2026-10-21 사용자: 모니터에서도 상태가 보여야)
function tile(a: AgentItem, i: number): string {
  return `<li class="gx-agmon ${a.side}" data-action="agent-info" data-value="${esc(a.id)}" ${tip(a)}><span class="gx-agmon-scr">${a.face}
    <span class="gx-agmon-osd"><span>CH-${String(i + 1).padStart(2, '0')}</span><span class="st">${esc(a.st)}</span></span>
    <span class="gx-agmon-cap"><b>${esc(a.name)}</b>${flow('small', a.side === 'op' && a.deployed ? a.deployed : line(a))}</span></span></li>`;
}

function row(a: AgentItem): string {
  const tools = a.wiki !== null
    ? `<span class="gx-agrow-tools"><button class="gx-acard-tool" data-action="agent-talk" data-value="${esc(a.id)}" title="괴담톡" aria-label="${esc(a.name)}에게 톡">${ICONS.phone}</button><button class="gx-acard-tool" data-action="wiki-goto" data-value="${esc(a.wiki)}" title="위키" aria-label="${esc(a.name)} 위키">${ICONS.wiki}</button></span>`
    : '';
  return `<li class="gx-agrow ${a.side}" data-action="agent-info" data-value="${esc(a.id)}" ${tip(a)}>${a.face}<b>${esc(a.name)}</b><span class="gx-agrow-st"><i></i>${esc(a.st)}</span>${flow('span', line(a), 'gx-agrow-msg')}${tools}</li>`;
}

/** 요원 칸 본문. 작전 중 → 편성 가능 → 불가 순서. total: 명단 인원 */
export function agentPanel(items: AgentItem[], view: AgentView, o: { total: number; org: string; extra: string; empty: string }): string {
  last = items;
  lastOrg = o.org;
  const list = [...items].sort((a, b) => ORDER[a.side] - ORDER[b.side]);
  const op = items.filter((a) => a.side === 'op').length;
  // 제목 글자 대신 모양 전환 아이콘 (설정 → 화면 「요원 칸」과 같은 값)
  const head = `<h2>${headSeg('agents-view', view, [['wall', '요원 모니터', ICONS.grid], ['list', '요원 목록', ICONS.list]])}<span class="gx-opcnt"><em class="op">작전<i>${op}</i><u>/${o.total}</u></em></span></h2>`;
  const body = !list.length
    ? `<p class="gx-none">${esc(o.empty)}</p>`
    : view === 'list'
      ? `<ul class="gx-agrows">${list.map(row).join('')}</ul>`
      : `<ul class="gx-agwall">${list.map(tile).join('')}</ul>`;
  return `<section class="gx-sec gx-agbox ${view}" id="gx-sec-ag">${head}${o.extra}${body}</section>`;
}

/** 요원 사원증 창 (가로 명함 비율): 사진 · 이름·영문명·소속·직급·투입·상황 · 번호와 톡·위키·기록.
 *  hasRecord: 그 이름의 인물 기록(ui/people.ts)이 있으면 「기록」 단추 */
export function agentPopup(hasRecord?: (name: string) => boolean): string {
  const org = lastOrg;
  const a = last.find((x) => x.id === agUi.pop);
  if (!a) {
    agUi.pop = '';
    return '';
  }
  const btns = (a.wiki !== null
    ? `<button data-action="agent-talk" data-value="${esc(a.id)}">${ICONS.phone}괴담톡</button><button data-action="wiki-goto" data-value="${esc(a.wiki)}">${ICONS.wiki}위키</button>`
    : '') + (hasRecord?.(a.name) ? `<button data-action="people-goto" data-value="${esc(a.name)}">${ICONS.group}기록</button>` : '');
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
  // 잘리는 상황 글은 전광판처럼 흐르게 (2026-10-21 사용자). 창을 다시 그릴 때마다 넘치는 칸만 골라 거리·시간을 정한다
  let queued = 0;
  const measure = () => {
    queued = 0;
    // PC 요원 칸은 상자 높이를 꼭 채운다 (2026-10-21 사용자: 아래가 남았다). 모니터 두 줄 · 목록 여섯 줄, 넘치면 그 크기로 스크롤
    // CSS 퍼센트 줄 높이는 브라우저에 따라 안 먹어서 실제 높이를 재서 넣는다
    const pc = matchMedia('(min-width: 761px)').matches;
    for (const ul of root.querySelectorAll<HTMLElement>('.gx-agwall, .gx-agrows')) {
      if (!pc) ul.style.removeProperty('--agrow');
      else if (ul.classList.contains('gx-agwall')) ul.style.setProperty('--agrow', `${Math.max(140, Math.floor((ul.clientHeight - 24) / 2))}px`);
      else ul.style.setProperty('--agrow', `${Math.max(48, Math.floor(ul.clientHeight / 6))}px`);
    }
    for (const box of root.querySelectorAll<HTMLElement>('.gx-flow')) {
      const inner = box.firstElementChild as HTMLElement | null;
      if (!inner) continue;
      // 이미 잰 칸(같은 폭·같은 글)은 건드리지 않는다. 말풍선이 붙을 때마다 다시 재면서 흐르던 글이 처음으로 돌아갔다 (2026-10-21 사용자)
      const key = `${box.clientWidth}|${inner.dataset.t ?? ''}`;
      if (box.dataset.fk === key) continue;
      box.dataset.fk = key;
      // 목록의 상황 글은 두 줄까지 그대로 보이고, 그래도 넘칠 때만 한 줄 전광판 (2026-10-21 사용자)
      if (box.classList.contains('gx-agrow-msg')) {
        box.classList.remove('on');
        box.classList.add('two');
        if (box.scrollHeight <= box.clientHeight + 1) continue;
        box.classList.remove('two');
      }
      // 켜져 있으면 뒤에 붙은 글(간격 3em 포함)까지 재므로 반으로 되돌려 잰다
      const gap = 3 * parseFloat(getComputedStyle(inner).fontSize);
      const on = box.classList.contains('on');
      const w = on ? (inner.scrollWidth - gap) / 2 : inner.scrollWidth;
      const over = w - box.clientWidth > 2;
      box.classList.toggle('on', over);
      if (over) {
        const d = w + gap;
        box.style.setProperty('--fd', `${-d}px`);
        // 초당 18px로 쉬지 않고 돈다. 시작 자리는 공용 시계로 맞춰서, 창을 다시 그려도(무엇을 눌러도) 처음으로 돌아가지 않고 이어 흐른다
        // (2026-10-21 사용자: 처음에 한참 멈춰 있고, 누를 때마다 맨 앞으로 돌아가 멈춰 보였다)
        const ft = d / 18;
        box.style.setProperty('--ft', `${ft.toFixed(2)}s`);
        box.style.setProperty('--fdl', `${(-((performance.now() / 1000) % ft)).toFixed(2)}s`);
      }
    }
  };
  const schedule = () => {
    if (!queued) queued = requestAnimationFrame(measure);
  };
  new MutationObserver(schedule).observe(root, { childList: true, subtree: true });
  window.addEventListener('resize', schedule);
  if (typeof ResizeObserver === 'function') new ResizeObserver(schedule).observe(root);
  root.addEventListener('scroll', hide, true);
}
