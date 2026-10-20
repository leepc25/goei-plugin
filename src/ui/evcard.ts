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
  /** 상황판: 누르면 접고 펴기. 펼치면 정사각 그림과 설명 전부, 지도 버튼 */
  fold?: { id: string; open: boolean };
}

/** 배치·방문자 이름 칩: 요원은 사진+이름, 그 밖의 이름은 이름표 */
export function peopleChips(char: CharacterSnapshot, names: string[], agents: Map<string, { english?: string }>): string {
  return names
    .filter((n) => n && n !== '없음')
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

/** 그림 카드 (2026-10-20 사용자): 모든 정보가 그림 안에. 접으면 같은 높이의 띠(등급·상태·이름·위치·요원 얼굴),
 *  펴면 정사각 그림 안에 버튼·요원·설명까지. 그림 아래 칸은 없다 */
function artCard(c: EvCard): string {
  const grade = c.kind === 'an' && c.grade && /^[A-Za-z]+$/.test(c.grade) ? c.grade : '';
  const mark = `<i class="gx-gmark ${c.kind}${grade ? ` g-${grade.toLowerCase()}` : ''}" title="${KIND[c.kind]}${grade ? ` ${esc(grade)}등급` : ''}">${grade ? esc(grade) : MARK[c.kind]}</i>`;
  // 이름 미확인 괴이는 보여 줄 그림·설명이 없어 펴지 않는다 (2026-10-20 사용자). 펴지 않는 카드(이름 미확인, 임무 탭)는 띠에 바로 위키·종료 버튼
  const unknown = c.name === '이름 미확인';
  const fold = unknown ? undefined : c.fold;
  const open = !!fold?.open;
  const key = c.key ? esc(c.key) : '';
  const acts = c.key && (open || !fold)
    ? `<span class="gx-evart-act">${c.name !== '이름 미확인' ? `<button class="gx-evbtn" data-action="wiki-goto" data-value="${esc(c.name)}" title="위키" aria-label="${esc(c.name)} 위키">${ICONS.wiki}</button>` : ''}
      ${fold ? `<button class="gx-evbtn" data-action="board-map" data-value="${key}" title="지도" aria-label="${esc(c.name)} 지도에서 보기">${ICONS.map}</button>` : ''}
      ${c.confirmEnd
        ? `<button class="gx-mini danger" data-action="end-event" data-value="${key}">정말 종료</button>`
        : `<button class="gx-evbtn" data-action="end-event" data-value="${key}" title="상황 종료" aria-label="${esc(c.name)} 상황 종료">${ICONS.close}</button>`}</span>`
    : '';
  const act = fold ? ` data-action="ev-fold" data-value="${esc(fold.id)}"` : c.open && c.key ? ` data-action="${c.open}" data-value="${key}"` : '';
  const pic = c.art?.pic;
  const desc = c.art?.desc ?? '';
  // 펴지 않는 임무 탭 띠는 예전 카드만큼 정보를 그대로 보인다 (2026-10-20 사용자): 요원 이름, 사건 상황
  const flat = !c.fold;
  const more = open ? `${c.extra ?? ''}${desc ? `<span class="gx-evc-desc">${esc(desc)}</span>` : ''}` : flat ? c.extra ?? '' : '';
  return `<li class="gx-evc art${act ? ' go' : ''}${open ? ' open' : ''}${c.selected ? ' sel' : ''}${c.key ? ' live' : ' wait'}${flat ? ' flat' : ''}"${act}>
    <div class="gx-evart k-${c.kind}${pic ? '' : ' none'}"${pic ? ` style="background-image:url('${esc(pic)}')"` : ''}>
      ${pic ? '' : `<span class="gx-evart-ico">${MARK[c.kind]}</span>`}
      <span class="gx-evart-top">${mark}<span class="gx-evc-tags">${c.badge}</span>${acts}</span>
      <span class="gx-evart-cap"><span class="gx-evart-line"><span class="gx-evart-name"><b>${esc(c.name)}</b><small>${c.loc}</small></span>${c.chips ? `<span class="gx-evc-who">${c.chips}</span>` : ''}</span>${more}</span>
    </div></li>`;
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
