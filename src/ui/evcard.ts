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
  /** 지도 아이콘 */
  mapAction?: string;
  selected?: boolean;
  confirmEnd?: boolean;
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

export function evCard(c: EvCard): string {
  const grade = c.kind === 'an' && c.grade && /^[A-Za-z]+$/.test(c.grade) ? c.grade : '';
  const mark = `<i class="gx-gmark ${c.kind}${grade ? ` g-${grade.toLowerCase()}` : ''}" title="${KIND[c.kind]}${grade ? ` ${esc(grade)}등급` : ''}">${grade ? esc(grade) : MARK[c.kind]}</i>`;
  const title = `<span class="gx-evc-name"><b>${esc(c.name)}</b></span>`;
  if (!c.key) {
    return `<li class="gx-evc">${mark}<span class="gx-evc-main"><span class="gx-evc-top">${title}<span class="gx-evc-tags">${c.badge}</span></span><small>${c.loc}</small>${c.extra ?? ''}</span></li>`;
  }
  const key = esc(c.key);
  const acts = `<span class="gx-evc-act">
      <button class="gx-icon" data-action="${c.mapAction ?? 'board-map'}" data-value="${key}" title="지도" aria-label="${esc(c.name)} 지도">${ICONS.map}</button>
      ${c.name !== '이름 미확인' ? `<button class="gx-icon" data-action="wiki-goto" data-value="${esc(c.name)}" title="위키" aria-label="${esc(c.name)} 위키">${ICONS.wiki}</button>` : ''}
      ${c.confirmEnd
        ? `<button class="gx-mini danger" data-action="end-event" data-value="${key}">정말 종료</button>`
        : `<button class="gx-icon" data-action="end-event" data-value="${key}" title="상황 종료" aria-label="${esc(c.name)} 상황 종료">${ICONS.close}</button>`}</span>`;
  const open = c.open ? ` data-action="${c.open}" data-value="${key}"` : '';
  return `<li class="gx-evc go${c.selected ? ' sel' : ''}"${open}>${mark}<span class="gx-evc-main"><span class="gx-evc-top">${title}${acts}</span>
    <small>${c.loc}</small><span class="gx-evc-who">${c.badge}${c.chips ?? ''}</span>${c.extra ?? ''}</span></li>`;
}
