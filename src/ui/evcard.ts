// 괴이·사건·특수 카드 한 장. 상황판과 임무 탭이 같은 모양을 쓴다 (v0.16.17, 사용자 요청: 두 곳 모양 통일).
// 차이는 카드를 눌렀을 때 하는 일뿐이다. 종류(괴이·사건·특수)는 두 곳 모두 상태 딱지 왼쪽에 같은 모양 딱지로 (v0.16.18).
import type { CharacterSnapshot } from '../host/risu';
import { ICONS } from './icons';
import { avatar } from './images';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type EvKind = 'an' | 'in' | 'ms';
const KIND: Record<EvKind, string> = { an: '괴이', in: '사건', ms: '특수' };
const MARK: Record<EvKind, string> = { an: '?', in: ICONS.siren, ms: ICONS.spook };

export interface EvCard {
  kind: EvKind;
  name: string;
  /** 괴이 등급 (S·A·B·C·D) */
  grade?: string;
  /** 위치 줄 (이미 이스케이프된 글) */
  loc: string;
  /** 상태 딱지 (html) */
  badge: string;
  /** 배치·방문자 칩 (html) */
  chips?: string;
  /** 사건 상황 등 아래 줄 (html) */
  extra?: string;
  /** 진행 중인 상황의 key. 없으면(발생 예정) 아이콘 없이 보기만 */
  key?: string;
  /** 카드를 눌렀을 때 */
  open?: string;
  selected?: boolean;
  confirmEnd?: boolean;
  /** 그림 카드 (2026-10-20 시안): 그림(없으면 null → 종류별 공용 그림 자리)과 짧은 설명 */
  art?: { pic: string | null; desc: string };
  /** 그림 카드를 눌렀을 때 뜨는 상세 창의 id (상황판·임무 탭이 같은 id라 어느 쪽에서 열어도 같은 창) */
  pop?: string;
}

/** 배치·방문자 이름 칩: 요원은 사진+이름, 그 밖의 이름은 이름표 */
export function peopleChips(char: CharacterSnapshot, names: string[], agents: Map<string, { english?: string }>): string {
  return names
    .filter((n, i, all) => n && n !== '없음' && all.indexOf(n) === i)
    .map((n) => (agents.has(n) ? `<span class="gx-pchip">${avatar(char, agents.get(n)!.english, n, 'xs')}${esc(n)}</span>` : `<span class="gx-badge">${esc(n)}</span>`))
    .join('');
}

/** 발생한 지 얼마나 됐는지 (분 단위 세계 시각) */
export function elapsedText(minute: number | null, since: number | null): string {
  if (minute === null || since === null) return '';
  const m = Math.max(0, minute - since);
  const h = Math.floor(m / 60);
  if (!m) return '방금 발생';
  return `발생 ${h ? `${h}시간 ` : ''}${m % 60 || !h ? `${m % 60}분 ` : ''}경과`;
}

/** 그림 카드 상세 창: 열린 카드 id. 그리는 동안 본 카드를 모아 두었다가 창은 화면 맨 위에 한 번 그린다 */
export const evUi = { pop: '' };
const seen = new Map<string, EvCard>();
export const evSeenReset = () => seen.clear();

function gradeMark(c: EvCard): string {
  const grade = c.kind === 'an' && c.grade && /^[A-Za-z]+$/.test(c.grade) ? c.grade : '';
  return `<i class="gx-gmark ${c.kind}${grade ? ` g-${grade.toLowerCase()}` : ''}" title="${KIND[c.kind]}${grade ? ` ${esc(grade)}등급` : ''}">${grade ? esc(grade) : MARK[c.kind]}</i>`;
}
const artBg = (c: EvCard) => (c.art?.pic ? ` style="background-image:url('${esc(c.art.pic)}')"` : '');
const artIco = (c: EvCard) => (c.art?.pic ? '' : `<span class="gx-evart-ico">${MARK[c.kind]}</span>`);
/** 상태 글 상자는 두지 않는다 (2026-10-20 사용자: 상자 때문에 상황판 같지 않다).
 *  진행 중이면 카드 색과 경과 시간이 곧 상태라 글이 없고, 예정·대기·탐사 중처럼 다를 때만 둘째 줄에 짧게 */
function statusNote(c: EvCard): string {
  const text = c.badge.replace(/<[^>]+>/g, '').trim();
  if (!c.key) return text ? `<em class="gx-evc-note wait">${esc(text)}</em>` : '';
  return /class="gx-badge op"/.test(c.badge) ? `<em class="gx-evc-note op">${esc(text)}</em>` : '';
}
/** 투입 표시: 오른쪽에 동그란 얼굴을 겹쳐 세운다. 요원 아닌 이름(조직·외부인)은 조직 동그라미, 아무도 없으면 빈 점선 동그라미 */
function faces(c: EvCard): string {
  if (!c.key) return '';
  const items = (c.chips ?? '').match(/<span class="gx-(?:pchip|badge)">[\s\S]*?<\/span>(?=<span class="gx-(?:pchip|badge)">|$)/g) ?? [];
  const verb = c.kind === 'ms' ? '방문' : '투입';
  if (!items.length) return `<span class="gx-evfaces"><span class="gx-evface none" title="${c.kind === 'ms' ? '미방문' : '미투입'}">${ICONS.person}</span></span>`;
  // 조직·외부인은 몇이든 동그라미 하나 (사람 수처럼 세면 관리국 + 관리국 요원이 겹친다)
  const strip = (h: string) => h.replace(/<[^>]+>/g, '').trim();
  const people = items.filter((h) => h.startsWith('<span class="gx-pchip">'));
  const orgs = items.filter((h) => !h.startsWith('<span class="gx-pchip">')).map(strip);
  const shown = people.map((h) => `<span class="gx-evface" title="${esc(strip(h))}">${h.replace(/^<span class="gx-pchip">/, '').replace(/[^>]*<\/span>$/, '')}</span>`);
  if (orgs.length) shown.push(`<span class="gx-evface org" title="${esc(orgs.join(', '))}">${ICONS.org}</span>`);
  const list = shown.length > 3 ? [...shown.slice(0, 2), `<span class="gx-evface more">+${shown.length - 2}</span>`] : shown;
  return `<span class="gx-evfaces" title="${verb}: ${esc(items.map(strip).join(', '))}">${list.join('')}</span>`;
}

/** 그림 카드 (2026-10-20 사용자): 상황판·임무 탭 모두 같은 띠. 누르면 상세 창.
 *  1줄 등급·이름·상태, 2줄 장소·경과, 3줄 설명(사건은 상황 글, 그 밖은 문서 요약, 길면 줄임). 투입은 사람 수 표시만 */
function artCard(c: EvCard): string {
  const key = c.key ? esc(c.key) : '';
  // 이름 미확인도 창을 띄운다: 종료·지도 버튼이 창에만 있어서 (2026-10-20 사용자: 띠에 남은 ×가 어색했다)
  if (c.pop) seen.set(c.pop, c);
  const act = c.pop ? ` data-action="ev-pop" data-value="${esc(c.pop)}"` : c.open && c.key ? ` data-action="${c.open}" data-value="${key}"` : '';
  const line3 = c.extra || (c.art?.desc ? `<span class="gx-evc-sit">${esc(c.art.desc)}</span>` : '');
  return `<li class="gx-evc art${act ? ' go' : ''}${c.selected ? ' sel' : ''}${c.key ? ' live' : ' wait'}"${act}>
    <div class="gx-evart k-${c.kind}${c.art?.pic ? '' : ' none'}"${artBg(c)}>${artIco(c)}
      ${faces(c)}<span class="gx-evart-cap"><span class="gx-evart-l1">${gradeMark(c)}<b>${esc(c.name)}</b></span><span class="gx-evart-l2"><small>${c.loc}</small>${statusNote(c)}</span>${line3}</span>
    </div></li>`;
}

/** 상세 창 (상황판·임무 탭 공통, 창 맨 위에 하나): 정사각 그림 안에 버튼·요원·상황 글·문서 요약 전부.
 *  종료는 오른쪽 위 한 곳에만 (2026-10-20 사용자: 위·아래 두 곳이 헷갈림). 닫기는 바깥 누르기·Esc·뒤로 */
export function evPopup(): string {
  const c = evUi.pop ? seen.get(evUi.pop) : undefined;
  if (!c) {
    evUi.pop = '';
    return '';
  }
  const key = c.key ? esc(c.key) : '';
  const pick = c.open === 'pick-event';
  const name = esc(c.name);
  // 버튼 셋은 같은 크기 아이콘 (2026-10-20 사용자). 종료는 휴지통, 한 번 누르면 빨개지고 한 번 더 누르면 종료
  const btns = `${c.name === '이름 미확인' ? '' : `<button class="gx-evbtn" data-action="wiki-goto" data-value="${name}" title="위키" aria-label="${name} 위키">${ICONS.wiki}</button>`}
    ${c.key && c.open ? `<button class="gx-evbtn" data-action="${c.open}" data-value="${key}" title="${pick ? '목표로 고르기' : '지도'}" aria-label="${name} ${pick ? '목표로 고르기' : '지도에서 보기'}">${pick ? ICONS.pin : ICONS.map}</button>` : ''}
    ${c.key ? `<button class="gx-evbtn end${c.confirmEnd ? ' danger' : ''}" data-action="end-event" data-value="${key}" title="${c.confirmEnd ? '한 번 더 누르면 종료' : '상황 종료'}" aria-label="${name} ${c.confirmEnd ? '정말 종료' : '상황 종료'}">${ICONS.trash}</button>` : ''}`;
  const desc = c.art?.desc ? `<span class="gx-evc-desc">${esc(c.art.desc)}</span>` : '';
  return `<button class="ev-scrim" data-action="ev-pop" aria-label="닫기"></button>
    <div class="gx-evc art open ev-pop${c.key ? ' live' : ' wait'}" role="dialog" aria-label="${esc(c.name)}">
      <div class="gx-evart k-${c.kind}${c.art?.pic ? '' : ' none'}"${artBg(c)}>${artIco(c)}
        <span class="gx-evart-top"><span class="gx-evart-act">${btns}</span></span>
        <span class="gx-evart-cap"><span class="gx-evart-l1">${gradeMark(c)}<b>${name}</b></span><span class="gx-evart-l2"><small>${c.loc}</small>${statusNote(c)}${c.key && !c.chips ? `<em class="gx-evc-note">${c.kind === 'ms' ? '미방문' : '미투입'}</em>` : ''}</span>${c.chips ? `<span class="gx-evc-who">${c.chips}</span>` : ''}${c.extra ?? ''}${desc}</span>
      </div></div>`;
}

export function evCard(c: EvCard): string {
  if (c.art) return artCard(c);
  const grade = c.kind === 'an' && c.grade && /^[A-Za-z]+$/.test(c.grade) ? c.grade : '';
  const mark = `<i class="gx-gmark ${c.kind}${grade ? ` g-${grade.toLowerCase()}` : ''}" title="${KIND[c.kind]}${grade ? ` ${esc(grade)}등급` : ''}">${grade ? esc(grade) : MARK[c.kind]}</i>`;
  const title = `<span class="gx-evc-name"><b>${esc(c.name)}</b></span>`;
  if (!c.key) {
    return `<li class="gx-evc">${mark}<span class="gx-evc-main"><span class="gx-evc-top">${title}<span class="gx-evc-tags">${c.badge}</span></span><small>${c.loc}</small>${c.extra ?? ''}</span></li>`;
  }
  const key = esc(c.key);
  const acts = `<span class="gx-evc-act">
      ${c.name !== '이름 미확인' ? `<button class="gx-icon" data-action="wiki-goto" data-value="${esc(c.name)}" title="위키" aria-label="${esc(c.name)} 위키">${ICONS.wiki}</button>` : ''}
      ${c.confirmEnd
        ? `<button class="gx-mini danger" data-action="end-event" data-value="${key}">정말 종료</button>`
        : `<button class="gx-icon" data-action="end-event" data-value="${key}" title="상황 종료" aria-label="${esc(c.name)} 상황 종료">${ICONS.close}</button>`}</span>`;
  const open = c.open ? ` data-action="${c.open}" data-value="${key}"` : '';
  return `<li class="gx-evc go${c.selected ? ' sel' : ''}"${open}>${mark}<span class="gx-evc-main"><span class="gx-evc-top">${title}${acts}</span>
    <small>${c.loc}</small><span class="gx-evc-who">${c.badge}${c.chips ?? ''}</span>${c.extra ?? ''}</span></li>`;
}
