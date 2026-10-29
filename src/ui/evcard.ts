// 괴이·사건·특수 카드 한 장. 상황판과 임무 탭이 같은 모양을 쓴다 (v0.16.17, 사용자 요청: 두 곳 모양 통일).
// 차이는 카드를 눌렀을 때 하는 일뿐이다. 종류(괴이·사건·특수)는 두 곳 모두 상태 딱지 왼쪽에 같은 모양 딱지로 (v0.16.18).
import type { CharacterSnapshot } from '../host/risu';
import { locName, NATION_PINS, type EndedEntry } from '../core/world';
import { ensureClouds } from './clouds';
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
  /** 지역 코드 (상세 창 CCTV의 카메라 번호·지역) */
  locCode?: string;
  /** 막 끝난 상황 (다음 응답까지 흐리게) */
  ended?: boolean;
  /** 종료된 상황의 보고서 id (기록 메뉴, 2026-10-29). 있으면 줄 끝·큰 보기에 보고서 지름길 */
  rpt?: string;
  /** 내가 출동한 상황 (보고서 배지) */
  mine?: boolean;
}

/** 배치·방문자 이름 칩: 요원은 사진+이름, 그 밖의 이름은 이름표 */
/** own: 우리 세력 이름 (이 이름이 적히면 요원이 아니어도 우리 편으로 친다).
 *  display: 세력 코드 → 표시 이름. 주면 요원 아닌 이름도 조직 사진을 붙인다 (2026-10-20 사용자) */
export function peopleChips(char: CharacterSnapshot, names: string[], agents: Map<string, { english?: string }>, own = ''): string {
  return names
    .filter((n, i, all) => n && n !== '없음' && all.indexOf(n) === i)
    .map((n) => {
      if (agents.has(n)) return `<span class="gx-pchip">${avatar(char, agents.get(n)!.english, n, 'xs')}${esc(n)}</span>`;
      return `<span class="gx-badge${own && n === own ? ' own' : ''}">${esc(n)}</span>`;
    })
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
/** 칩 html을 칩 하나씩 (칩 안에 사진 span이 있어 정규식 한 번으로는 못 자른다) */
function chipItems(html = ''): string[] {
  const out: string[] = [];
  const re = /<span class="gx-(?:pchip|badge[^"]*)">/g;
  const starts: number[] = [];
  for (let m = re.exec(html); m; m = re.exec(html)) {
    // 칩 안쪽 사진의 gx-ava는 gx-pchip/gx-badge가 아니라 걸리지 않는다
    starts.push(m.index);
  }
  starts.forEach((st, i) => out.push(html.slice(st, starts[i + 1] ?? html.length)));
  return out;
}

/** 투입 표시 (2026-10-20 사용자): 누가·몇 명이 아니라 어느 편이 들어갔는지만. 이름 줄 끝 사람 아이콘,
 *  초록 = 우리 요원·우리 세력, 노랑 = 다른 세력·외부인만, 회색 = 아무도 없음. 우리와 다른 세력이 함께면 초록 + 노랑 점.
 *  누가 갔는지는 상세 창에 */
function depMark(c: EvCard): string {
  // 사건은 투입 기록이 없다 (상황판 태그에 투입 칸이 없음). 늘 「미투입」으로 보이면 틀린 말이라 표시하지 않는다
  if (!c.key || c.kind === 'in') return '';
  const items = chipItems(c.chips);
  const strip = (h: string) => h.replace(/<[^>]+>/g, '').trim();
  const ours = items.filter((h) => h.startsWith('<span class="gx-pchip"') || h.startsWith('<span class="gx-badge own"')).map(strip);
  const others = items.filter((h) => h.startsWith('<span class="gx-badge">')).map(strip);
  const verb = c.kind === 'ms' ? '방문' : '투입';
  const cls = ours.length ? 'on' : others.length ? 'other' : '';
  const title = [ours.length ? `우리: ${ours.join(', ')}` : '', others.length ? `다른 세력: ${others.join(', ')}` : ''].filter(Boolean).join(' / ') || `미${verb}`;
  return `<i class="gx-evdep${cls ? ` ${cls}` : ''}${ours.length && others.length ? ' mix' : ''}" title="${esc(title)}" aria-label="${esc(title)}">${ICONS.person}</i>`;
}

/** 그림 카드 (2026-10-20 사용자): 상황판·임무 탭 모두 같은 띠. 누르면 상세 창.
 *  1줄 등급·이름·상태, 2줄 장소·경과, 3줄 설명(사건은 상황 글, 그 밖은 문서 요약, 길면 줄임). 투입은 사람 수 표시만 */
function artCard(c: EvCard): string {
  const key = c.key ? esc(c.key) : '';
  // 이름 미확인도 창을 띄운다: 종료·지도 버튼이 창에만 있어서 (2026-10-20 사용자: 띠에 남은 ×가 어색했다)
  if (c.pop) seen.set(c.pop, c);
  const act = c.pop ? ` data-action="ev-pop" data-value="${esc(c.pop)}"` : c.open && c.key ? ` data-action="${c.open}" data-value="${key}"` : '';
  // 한 줄 상황 글은 넘치면 전광판처럼 흐른다 (2026-10-21 사용자, 요원 칸과 같은 .gx-flow)
  const line3 = (c.extra || (c.art?.desc ? `<span class="gx-evc-sit">${esc(c.art.desc)}</span>` : ''))
    .replace(/^<span class="gx-evc-sit"([^>]*)>([^<]*)<\/span>$/, (_m, attr: string, t: string) => `<span class="gx-evc-sit gx-flow"${attr}><span data-t="${t}">${t}</span></span>`);
  return `<li class="gx-evc art${act ? ' go' : ''}${c.selected ? ' sel' : ''}${c.ended ? ' wait ended' : c.key ? ' live' : ' wait'}"${act}>
    <div class="gx-evart k-${c.kind}${c.art?.pic ? '' : ' none'}"${artBg(c)}>${artIco(c)}
      <span class="gx-evart-cap"><span class="gx-evart-l1">${gradeMark(c)}<b>${esc(c.name)}</b>${c.selected ? '<span class="gx-badge gx-goaltag">목표</span>' : ''}${depMark(c)}</span><span class="gx-evart-l2"><small>${c.loc}</small>${statusNote(c)}</span>${line3}</span>
    </div></li>`;
}

const TGT = '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="8" cy="8" r="5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/><circle class="dot" cx="8" cy="8" r="1.8" fill="currentColor" stroke="none"/></svg>';
/** 목표 표식 (2026-10-21 사용자: 제목 바로 오른쪽, 단추처럼 튀지 않게). 상태 딱지와 같은 기록지 도장 모양.
 *  안 고른 때는 흐린 점선 「목표 지정」, 고르면 민트색 「목표」. 다시 누르면 해제 */
export function targetMark(on: boolean, action: string, value: string, btn = false): string {
  return `<button class="${btn ? 'gx-evbtn ' : ''}gx-tgt${on ? ' on' : ''}" data-action="${action}" data-value="${esc(value)}" aria-pressed="${on}" title="${on ? '목표 해제' : '목표로 지정'}" aria-label="${on ? '목표 해제' : '목표로 지정'}">${TGT}${btn ? '' : `<span>${on ? '해제' : '선택'}</span>`}</button>`;
}

/** 카드 가운데 선택 과녁 (2026-10-29 사용자: 제목 옆 작은 표식은 누르기 어렵고 눈에 안 띈다 → FPS 조준점처럼 크고 반투명하게, 누르면 잠금 효과).
 *  상황판 CCTV·임무 상세·커스텀 임무 카드가 같은 것을 쓴다. 안 고름: 흐린 조준점 「목표 지정」 / 고름: 민트 잠금 「목표」. 다시 누르면 해제 */
export function aimMark(on: boolean, action: string, value: string): string {
  const label = on ? '목표 해제' : '목표로 지정';
  return `<button class="gx-aim${on ? ' on' : ''}" data-action="${action}" data-value="${esc(value)}" aria-pressed="${on}" title="${label}" aria-label="${label}">
    <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="r1" cx="50" cy="50" r="42"/><circle class="r2" cx="50" cy="50" r="24"/><path class="tk" d="M50 2v16M50 82v16M2 50h16M82 50h16"/><circle class="dot" cx="50" cy="50" r="4"/></svg>
    <span class="gx-aim-l">${on ? '목표' : '목표 지정'}</span></button>`;
}

/** 상세 창 (상황판·임무 탭 공통, 창 맨 위에 하나): 상황판 CCTV와 같은 화면·효과 (2026-10-21 사용자). 가로 600px, 세로는 상황판 CCTV 비율.
 *  종료는 오른쪽 위 한 곳에만. 닫기는 바깥 누르기·Esc·뒤로 */
export function evPopup(clock = ''): string {
  const c = evUi.pop ? seen.get(evUi.pop) : undefined;
  if (!c) {
    evUi.pop = '';
    return '';
  }
  return `<button class="ev-scrim" data-action="ev-pop" aria-label="닫기"></button>
    ${feedView(c, clock, ' ev-pop" role="dialog" aria-label="' + esc(c.name))}`;
}

/** 막 끝난 상황 카드 (상황판·임무 탭 공통). 버튼은 위키만 */
export function endedCard(e: EndedEntry, art: (name: string, kind: EvKind) => { pic: string | null; desc: string } | undefined): string {
  const name = e.name || '이름 미확인';
  return artCard({ kind: e.kind, name, grade: e.grade, loc: esc(locName(e.loc)), badge: '<span class="gx-badge end">종료</span>', ended: true, art: art(name, e.kind) ?? { pic: null, desc: '' }, pop: `end:${e.kind}:${e.name}:${e.loc}`, locCode: e.loc });
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

// ── 관제실 상황판 (2026-10-20 사용자 시안 「주요 상황 + 일지」) ──
// 왼쪽 큰 보기(CCTV 화면 ↔ 위성 지도), 오른쪽 상황 일지. 일지 줄이나 지도 표시를 누르면 왼쪽이 그 상황으로 바뀐다.

export const opsUi = { sel: '', mode: 'feed' as 'feed' | 'map' };

export interface OpsCard extends EvCard {
  /** 일지 줄 id (진행 중이면 상황 key, 끝났으면 end:…) */
  id: string;
  /** 지역 코드 (지도 표시 자리) */
  locCode: string;
}

const GRADE_RANK: Record<string, number> = { S: 0, A: 1, B: 2, C: 3, D: 4 };
/** 처음 띄울 상황: 우리 편이 들어간 것 → 등급 높은 것 → 먼저 난 것 */
function firstPick(cards: OpsCard[]): string {
  const live = cards.filter((c) => !c.ended);
  const ours = (c: OpsCard) => /class="gx-(?:pchip|badge own)"/.test(c.chips ?? '');
  const rank = (c: OpsCard) => (ours(c) ? 0 : 10) + (GRADE_RANK[(c.grade ?? '').toUpperCase()] ?? 6);
  return [...live].sort((a, b) => rank(a) - rank(b))[0]?.id ?? cards[0]?.id ?? '';
}

function opsRow(c: OpsCard, on: boolean): string {
  const thumb = c.art?.pic ? `<img src="${esc(c.art.pic)}" alt="" loading="lazy">` : `<span class="gx-oprow-ico">${MARK[c.kind]}</span>`;
  return `<li class="gx-oprow k-${c.kind}${on ? ' sel' : ''}${c.ended ? ' ended' : ''}" data-action="ops-sel" data-value="${esc(c.id)}" aria-current="${on}">
    <span class="gx-oprow-pic">${thumb}</span>
    <span class="gx-oprow-t"><b>${gradeMark(c)}<span>${esc(c.name)}</span>${c.selected ? '<span class="gx-badge gx-goaltag">목표</span>' : ''}${c.ended && c.mine ? '<span class="gx-badge live gx-minetag">내가 출동</span>' : ''}</b><small><span>${c.loc}</span>${statusNote(c)}</small></span>${c.ended && c.rpt ? `<button class="gx-oprpt" data-action="rec-open" data-value="${esc(c.rpt)}" title="보고서" aria-label="${esc(c.name)} 보고서">${ICONS.records}</button>` : depMark(c)}</li>`;
}

const camNo = (loc: string) => String((Array.from(loc).reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 97, 7) % 89) + 10).padStart(2, '0');

/** 칸 제목 자리의 아이콘 전환 (일지: CCTV ↔ 위성 지도, 요원: 모니터 ↔ 목록). 2026-10-21 사용자: 제목 글자 대신 */
export function headSeg(action: string, cur: string, items: [string, string, string][]): string {
  return `<span class="gx-hseg" role="tablist">${items
    .map(([v, label, icon]) => `<button role="tab" class="${cur === v ? 'on' : ''}" data-action="${action}" data-value="${v}" aria-selected="${cur === v}" title="${label}" aria-label="${label}">${icon}</button>`)
    .join('')}</span>`;
}

/** CCTV 큰 보기의 투입 줄: 사진 칩 대신 글자만. 우리 편 녹색, 다른 세력 노란색 */
function whoLine(chips = ''): string {
  const items = chipItems(chips).map((h) => {
    const ours = /^<span class="gx-(?:pchip|badge own)"/.test(h);
    const text = h.replace(/<[^>]*>/g, '').trim();
    return text ? `<span class="${ours ? 'on' : 'other'}">${text}</span>` : '';
  }).filter(Boolean);
  return items.length ? `<span class="gx-opwho"><em>투입</em>${items.join('<i>·</i>')}</span>` : '';
}

/** 큰 보기 왼쪽 위 화면 표시: 첫 줄 신호(REC·LIVE)와 카메라 이름, 둘째 줄 날짜·시각 (2026-10-21 사용자) */
function osd(sig: string, cam: string, clock: string): string {
  return `<div class="gx-oposd"><span class="l1">${sig}<span class="cam">${cam}</span></span>${clock ? `<span class="ts">${esc(clock)}</span>` : ''}</div>`;
}

/** 큰 보기 오른쪽 위 버튼: 위키 · 종료 (CCTV·위성 공통). 임무 지도로 가는 단추는 위성 지도가 생겨 뺐다 (2026-10-21 사용자) */
function evBtns(c: EvCard): string {
  const key = c.key ? esc(c.key) : '';
  const name = esc(c.name);
  return `${c.rpt ? `<button class="gx-evbtn" data-action="rec-open" data-value="${esc(c.rpt)}" title="보고서" aria-label="${name} 보고서">${ICONS.records}</button>` : ''}
    ${c.name === '이름 미확인' ? '' : `<button class="gx-evbtn" data-action="wiki-goto" data-value="${name}" title="위키" aria-label="${name} 위키">${ICONS.wiki}</button>`}
    ${c.key ? `<button class="gx-evbtn end${c.confirmEnd ? ' danger' : ''}" data-action="end-event" data-value="${key}" title="${c.confirmEnd ? '한 번 더 누르면 종료' : '상황 종료'}" aria-label="${name} ${c.confirmEnd ? '정말 종료' : '상황 종료'}">${ICONS.trash}</button>` : ''}`;
}

/** 위성 보기: 제목이 없어 오른쪽 위 단추 줄 맨 앞에 같은 표식 */
/** CCTV·위성 잡음: 무늬는 한 번만 그리고 위치만 옮긴다 (transform만 움직여 다시 그리기 없음) */
const STATIC = '<i class="gx-opfx" aria-hidden="true"><i class="n"></i><i class="r"></i></i>';
/** 위성: 먼 구름, 그림자, 가까운 구름이 왼쪽에서 오른쪽으로 흐른다 */
const SKY = '<i class="gx-opfx sky" aria-hidden="true"><i class="c2"></i><i class="c0"></i><i class="c1"></i></i>';

/** 괴이 효과 자리 (ui/cctvfx.ts가 클래스를 붙였다 뗄 때만 보임): 신호 끊김 화면, 렌즈 앞을 스치는 형체 */
const SHADE = '<svg viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true"><path d="M50 2c17 0 27 14 27 33 0 14-5 25-12 31 20 6 35 22 35 50v24H0v-24c0-28 15-44 35-50-7-6-12-17-12-31C23 16 33 2 50 2z"/></svg>';
const FX = `<i class="gx-oplost" aria-hidden="true"><b>SIGNAL LOST</b></i><i class="gx-opshade" aria-hidden="true">${SHADE}</i>`;

function opsPick(_c: OpsCard | undefined): string {
  // 상세 창 단추줄의 목표 단추는 카드 가운데 과녁(aimMark)으로 옮겼다
  return '';
}

function opsFeed(c: OpsCard | undefined, clock: string, empty: string): string {
  if (!c) {
    return `<div class="gx-opview feed nosig">${STATIC}<div class="gx-opnosig"><b>NO SIGNAL</b><small>${esc(empty)}</small></div></div>`;
  }
  return feedView(c, clock);
}

/** CCTV 큰 보기 한 장 (상황판 왼쪽, 상세 창 공통). cls: 바깥 div에 덧붙일 클래스(와 속성) */
function feedView(c: EvCard, clock: string, cls = ''): string {
  const name = esc(c.name);
  const btns = evBtns(c);
  const pic = c.art?.pic ? `<img class="gx-opfeed" src="${esc(c.art.pic)}" alt="">` : `<span class="gx-evart-ico">${MARK[c.kind]}</span>`;
  const desc = c.art?.desc ? `<span class="gx-evc-desc">${esc(c.art.desc)}</span>` : '';
  const loc = c.locCode ?? '';
  const region = locName(loc).split(' ').slice(0, 2).join(' ');
  const cam = loc ? `CAM-${camNo(loc)} · ${esc(region)}` : 'CAM-00';
  const grade = c.kind === 'an' && c.grade && /^[A-Za-z]+$/.test(c.grade) ? ` data-grade="${c.grade.toLowerCase()}"` : '';
  // 찢김 띠는 같은 그림을 배경으로 깔아 잘라 쓴다
  const tear = c.art?.pic && !c.ended ? `<i class="gx-optear" aria-hidden="true" style="--pic:url('${esc(c.art.pic)}')"><i></i><i></i></i>` : '';
  const fxkey = ` data-fxkey="${esc(`${cls ? 'pop' : 'board'}:${c.key ?? c.name}`)}"`;
  return `<div class="gx-opview feed k-${c.kind}${c.ended ? ' ended' : ''}${cls}"${grade}${fxkey}>${pic}${tear}${STATIC}${c.ended ? '' : FX}
    ${c.key && !c.ended ? aimMark(!!c.selected, 'pick-event', c.key) : ''}
    <div class="gx-opbar">${osd(`<span class="rec"><i></i>${c.ended ? 'END' : 'REC'}</span>`, cam, clock)}<span class="gx-evart-act">${btns}</span></div>
    <div class="gx-opcap"><span class="gx-evart-l1">${gradeMark(c)}<b>${name}</b>${c.ended && c.mine ? '<span class="gx-badge live gx-minetag">내가 출동</span>' : ''}</span>${whoLine(c.chips)}<span class="gx-evart-l2"><small>${c.loc}</small>${statusNote(c)}</span>${c.extra ?? ''}${desc}</div>
  </div>`;
}

/** 지도 위 자리(%)를 대략의 위경도로 (화면 표시용) */
const track = (px: number, py: number) => `N${(38.7 - py * 0.058).toFixed(2)} E${(124.6 + px * 0.056).toFixed(2)}`;

function opsMap(cards: OpsCard[], sel: string, url: string | null, clock: string): string {
  if (url) ensureClouds();
  const per = new Map<string, number>();
  const pins = cards
    .filter((c) => !c.ended)
    .map((c) => {
      const sido = c.locCode.split('-')[0];
      const at = NATION_PINS.find((p) => p[0] === sido);
      if (!at) return '';
      const n = per.get(sido) ?? 0;
      per.set(sido, n + 1);
      return `<button class="gx-oppin k-${c.kind}${c.id === sel ? ' sel' : ''}" style="left:${at[2]}%;top:${at[3] + n * 4.2}%" data-action="ops-sel" data-value="${esc(c.id)}" aria-label="${esc(c.name)}"><i></i><em>${esc(c.name)}</em></button>`;
    })
    .join('');
  const s = cards.find((c) => c.id === sel && !c.ended);
  const sAt = s ? NATION_PINS.find((p) => p[0] === s.locCode.split('-')[0]) : undefined;
  const sN = s ? cards.filter((c) => !c.ended && c.locCode.split('-')[0] === s.locCode.split('-')[0]).findIndex((c) => c.id === s.id) : 0;
  const cross = sAt ? `<span class="gx-opcross" style="left:${sAt[2]}%;top:${sAt[3] + sN * 4.2}%"></span>` : '';
  // 고른 상황을 가운데로 (지도가 보기보다 넓거나 길어 잘릴 때만 움직인다)
  const focus = sAt ? `--px:${sAt[2]};--py:${sAt[3] + sN * 4.2}` : '--px:55;--py:50';
  return `<div class="gx-opview map"><div class="gx-opmap">${url ? `<div class="gx-opmapi" style="${focus}"><img src="${esc(url)}" alt="전국 지도">${cross}${pins}</div>` : ''}</div>${url ? SKY : ''}
    <div class="gx-opbar">${osd('<span class="rec sat"><i></i>LIVE</span>', `SAT-02 · TRK ${track(sAt ? sAt[2] : 55, sAt ? sAt[3] + sN * 4.2 : 50)}`, clock)}${s ? `<span class="gx-evart-act">${opsPick(s)}${evBtns(s)}</span>` : ''}</div></div>`;
}

/** 관제실 상황판 본문. counts: 일지 제목줄 숫자 (html) */
export function opsBoard(cards: OpsCard[], o: { mapUrl: string | null; clock: string; counts: string; empty: string }): string {
  if (!cards.some((c) => c.id === opsUi.sel)) opsUi.sel = firstPick(cards);
  const sel = cards.find((c) => c.id === opsUi.sel);
  const view = opsUi.mode === 'map' ? opsMap(cards, opsUi.sel, o.mapUrl, o.clock) : opsFeed(sel, o.clock, o.empty);
  const rows = cards.map((c) => opsRow(c, c.id === opsUi.sel)).join('');
  // 목록 바닥 (2026-10-29 기록 메뉴): 종료 줄은 다음 응답에 빠지고, 전부는 기록 › 일지에
  const foot = '<footer class="gx-oplog-foot"><small>종료 줄은 다음 응답에 빠져요.</small><button data-action="rec-journal">기록에서 전부 보기 ›</button></footer>';
  return `<div class="gx-ops">${view}<section class="gx-oplog"><h2>${headSeg('ops-mode', opsUi.mode, [['feed', 'CCTV', ICONS.cctv], ['map', '위성 지도', ICONS.pin]])}<span class="gx-opcnt">${o.counts}</span></h2>${rows ? `<ul>${rows}</ul>` : `<p class="gx-none">${esc(o.empty)}</p>`}${foot}</section></div>`;
}
