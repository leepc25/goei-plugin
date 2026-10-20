// 즐겨찾기 (2026-10-20 사용자): 탭이 아니라 그 안의 화면(위키 문서, 괴담톡 방, 괴담넷 글…)을 최대 5개 모아 두고 바로 간다.
// 이 기기의 모든 채팅에 같이 쓴다(채팅마다 따로 두지 않음). PC는 메뉴 맨 아래 ‹ ★ ›의 ★ 창,
// 모바일은 상황판 아래 서랍 다섯 칸. 넣고 빼기는 ★ 창에서. 화면 상태와 이동은 app.ts가 맡는다.
import { getPrefs, MARK_MAX, type Mark } from '../core/settings';
import { savePrefs } from '../host/prefs';
import { ICONS } from './icons';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const key = (m: Mark) => JSON.stringify(m.s);
const icon = (m: Mark) => ICONS[m.s.tab as keyof typeof ICONS] ?? ICONS.board;

export const markUi = { pop: false };

export const marks = (): Mark[] => getPrefs().marks ?? [];
export const isMarked = (m: Mark) => marks().some((x) => key(x) === key(m));

export async function addMark(m: Mark): Promise<boolean> {
  if (isMarked(m) || marks().length >= MARK_MAX) return false;
  await savePrefs((p) => ({ ...p, marks: [...(p.marks ?? []), m] }));
  return true;
}

export async function removeMarkAt(i: number): Promise<void> {
  await savePrefs((p) => ({ ...p, marks: (p.marks ?? []).filter((_, j) => j !== i) }));
}

/** 즐겨찾기 창에서 넣을 수 있는 최근 화면 (mk-add의 번호가 이 목록 기준) */
export const markCandidates = (recent: Mark[], current: Mark | null) =>
  recent.filter((m) => !isMarked(m) && (!current || key(m) !== key(current))).slice(0, 5);

/** ★ 창 (PC·모바일 같은 창, 2026-10-20 사용자: 설정 말고 이 창에서 바로 넣고 뺀다) */
export function markPop(current: Mark | null, recent: Mark[]): string {
  if (!markUi.pop) return '';
  const list = marks();
  const full = list.length >= MARK_MAX;
  const mine = list.length
    ? `<ul class="mk-rows">${list.map((m, i) => `<li class="mk-row"><button class="mk-go" data-action="mk-go" data-value="${i}">${icon(m)}<span>${esc(m.name)}</span></button>
        <button class="ph-tool sm" data-action="mk-del" data-value="${i}" aria-label="${esc(m.name)} 빼기" title="빼기">${ICONS.close}</button></li>`).join('')}</ul>`
    : '<p class="mk-empty">아직 없어요.</p>';
  const here = current && !isMarked(current)
    ? `<button class="mk-here" data-action="mk-here" ${full ? 'disabled' : ''}>${ICONS.plus}<span>지금 화면 · ${esc(current.name)}</span></button>`
    : '';
  const cand = markCandidates(recent, current);
  const more = cand.length
    ? `<h4>최근 본 화면</h4><ul class="mk-rows">${cand.map((m, i) => `<li class="mk-row"><span class="mk-go">${icon(m)}<span>${esc(m.name)}</span></span>
        <button class="ph-tool sm" data-action="mk-add" data-value="${i}" aria-label="${esc(m.name)} 추가" title="추가" ${full ? 'disabled' : ''}>${ICONS.plus}</button></li>`).join('')}</ul>`
    : '';
  return `<button class="mk-scrim" data-action="mk-pop" aria-label="즐겨찾기 닫기"></button>
    <div class="mk-pop" role="dialog" aria-label="즐겨찾기">
      <div class="mk-head"><b>즐겨찾기</b><small>${list.length}/${MARK_MAX}</small><button class="ph-tool sm" data-action="mk-pop" aria-label="닫기">${ICONS.close}</button></div>
      ${mine}${here}${full ? '<p class="mk-empty">5개까지 넣을 수 있어요. 하나를 빼면 더 넣을 수 있어요.</p>' : ''}${more}
    </div>`;
}

/** PC 메뉴 맨 아래: ‹ 뒤로 · ★ 즐겨찾기 · 앞으로 › (모바일 쓸기와 같은 기록) */
export function navHistBar(current: Mark | null): string {
  return `<div class="gx-navhist">
    <button class="gx-nh" data-action="nav-back" aria-label="뒤로" title="뒤로">${ICONS.back}</button>
    <button class="gx-nh mk-star${markUi.pop ? ' on' : ''}${current && isMarked(current) ? ' marked' : ''}" data-action="mk-pop" aria-label="즐겨찾기" title="즐겨찾기" aria-expanded="${markUi.pop}">${ICONS.star}</button>
    <button class="gx-nh fwd" data-action="nav-fwd" aria-label="앞으로" title="앞으로">${ICONS.back}</button></div>`;
}

/** 모바일 상황판 서랍: 즐겨찾기 다섯 칸. 빈 칸을 누르거나 펼친 서랍을 좌우로 밀면 ★ 창 (사용자 2026-10-20) */
export function markSlots(): string {
  const list = marks();
  // 하나도 없으면 칸 대신 안내 한 줄 (사용자 2026-10-20). 눌러도 같은 창
  if (!list.length) return `<button class="mk-hint" data-action="mk-pop">${ICONS.star}<span>좌우로 밀어 즐겨찾기를 추가하세요</span></button>`;
  return Array.from({ length: MARK_MAX }, (_, i) => {
    const m = list[i];
    return m
      ? `<button class="ph-tool mk-slot" data-action="mk-go" data-value="${i}" aria-label="${esc(m.name)}" title="${esc(m.name)}">${icon(m)}<span class="ph-tool-l">${esc(m.name)}</span></button>`
      : `<button class="ph-tool mk-slot empty" data-action="mk-pop" aria-label="즐겨찾기 추가">${ICONS.plus}</button>`;
  }).join('');
}
