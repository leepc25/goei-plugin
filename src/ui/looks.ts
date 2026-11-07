// 아바타 고르기 (2026-11-07~08 사용자): 시작 패널(내 페르소나)과 시작한 뒤가 같은 팝업을 쓴다.
// 남·여를 고르면 그 성별 일반 NPC 프리셋 + 고른 세력 전용 프리셋이 정면 대기 동작으로 움직이는 격자에서 하나를 꼭 고른다.
// 대기 동작은 1배(픽셀 그대로)로 CSS steps 로 돌린다. 고른 것은 이 채팅 변수 $st_look 에 둔다 (core/looks.ts).
import { LOOK_GENDERS, LOOK_KEY, lookId, looksOf, type LookGender, type LookRow } from '../core/looks';
import { playerAgent } from '../core/player';
import { idleOf, looksStatus, lookRows, ensureLooks, type IdleLook } from '../host/looks';
import { updateChat, type ChatContext } from '../host/risu';
import { ICONS } from './icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 아바타 팝업 (시작 패널·시작한 뒤 같은 창) */
export const lookUi: { open: boolean; g: LookGender | ''; notice: string } = { open: false, g: '', notice: '' };

let rerender: () => void = () => {};
/** 창을 다시 그리는 함수 (ui/app.ts 가 둔다) */
export function setLookRender(fn: () => void): void {
  rerender = fn;
}

/** 아바타 고르기 팝업을 연다 (시작 패널의 아바타 칸, 장착 상자 인물 자리 등에서 부른다) */
export function openLookPicker(): void {
  lookUi.open = true;
  lookUi.notice = '';
  lookUi.g = '';
  rerender();
}

export function closeLookPicker(): void {
  lookUi.open = false;
  rerender();
}

/** 정면 대기 동작 한 칸 (1배, steps 반복). cls 로 크기 칸을 덧붙인다 */
export function lookSprite(look: IdleLook, cls = ''): string {
  const style = `--lw:${look.w}px;--lh:${look.h}px;--ln:${look.frames};--ld:${(look.frames * look.sec).toFixed(2)}s;background-image:url('${look.url}')`;
  return `<span class="gx-look${cls ? ` ${cls}` : ''}" style="${style}" aria-hidden="true"></span>`;
}

const genderOf = (rows: LookRow[] | null, id: string): LookGender | '' => rows?.find((r) => r.id === id)?.g ?? '';

/**
 * 성별 단추 + 아바타 격자. sel = 고른 번호, g = 보고 있는 성별('' 이면 고른 것의 성별), faction = 시작 세력(전용 프리셋 거르기).
 * 단추: look-g(성별) · look(아바타) · look-retry(팩 다시 받기)
 */
function chooser(sel: string, g: LookGender | '', faction: string, withSegs: boolean): string {
  const rows = lookRows();
  const shown = g || genderOf(rows, sel);
  const segs = !withSegs ? '' : `<div class="gx-segs">${LOOK_GENDERS.map((x) => `<button class="gx-seg${x === shown ? ' on' : ''}" data-action="look-g" data-value="${x}" aria-pressed="${x === shown}">${x}</button>`).join('')}</div>`;
  if (!rows) {
    const st = looksStatus();
    const msg = st.failed
      ? `아바타 그림을 받지 못했어요. ${esc(st.failed)} <button class="gx-chip" data-action="look-retry">다시 받기</button>`
      : `아바타 그림을 받는 중…${st.progress ? ` ${esc(st.progress)}` : ''}`;
    return `${segs}<div class="gx-hint">${msg}</div>`;
  }
  if (!shown) return `${segs}<div class="gx-hint">성별을 고르면 고를 수 있는 아바타가 보여요.</div>`;
  const cells = looksOf(rows, shown, faction)
    .map((r) => `<button class="gx-whoc gx-lookc${r.id === sel ? ' on' : ''}" data-action="look" data-value="${esc(r.id)}" aria-pressed="${r.id === sel}" aria-label="아바타 ${esc(r.id)}">${lookSprite(idleOf(r))}</button>`)
    .join('');
  return `${segs}<div class="gx-lookg">${cells}</div>`;
}

/** 아바타 팝업. sel = 지금 고른 번호, faction = 시작 세력, lockedName = 고유 인물로 플레이 중이면 그 이름(고를 수 없음).
 *  g 를 주면(시작 패널에서 성별을 고른 뒤) 그 성별만, 안 주면(시작한 뒤) 팝업 안에 성별 단추 */
export function lookPopup(sel: string, faction: string, lockedName = '', g: LookGender | '' = ''): string {
  if (!lookUi.open) return '';
  const inner = lockedName ? `<p class="gx-hint">${esc(lockedName)}(으)로 플레이 중이라 그 인물 모습을 써요.</p>` : chooser(sel, g || lookUi.g, faction, !g);
  return `<div class="gx-agpop gx-lookpop" data-action="look-close" role="dialog" aria-label="아바타"><div class="gx-agpop-card gx-lookpop-card" data-action="look-keep">
    <div class="gx-lookpop-head"><b>아바타</b><button class="gx-x" data-action="look-close" aria-label="닫기">${ICONS.close}</button></div>
    ${inner}${lookUi.notice ? `<div class="gx-err" role="alert">${esc(lookUi.notice)}</div>` : ''}
  </div></div>`;
}

/** 시작한 뒤의 아바타 팝업 (이 채팅 값) */
export function chatLookPopup(ctx: ChatContext): string {
  if (!lookUi.open) return '';
  const s = ctx.chat.scriptstate;
  return lookPopup(lookId(s), String(s?.['$st_faction'] ?? ''), playerAgent(ctx.char.globalLore, s)?.name ?? '');
}

/** 팝업 공통 단추 (닫기·성별·다시 받기). 처리했으면 true. 아바타를 고르는 「look」은 부르는 쪽이 따로 */
export function lookCommon(action: string, value: string | undefined): boolean {
  switch (action) {
    case 'look-open':
      openLookPicker();
      return true;
    case 'look-close':
      closeLookPicker();
      return true;
    case 'look-keep':
      return true;
    case 'look-retry':
      void ensureLooks();
      rerender();
      return true;
    case 'look-g':
      if (value === '남' || value === '여') lookUi.g = value;
      rerender();
      return true;
  }
  return false;
}

/** 시작한 뒤 팝업의 단추: 고르면 이 채팅에 바로 적고 닫는다. 처리했으면 true */
export async function lookAction(action: string, value: string | undefined, ctx: ChatContext, refresh: () => Promise<void>): Promise<boolean> {
  if (lookCommon(action, value)) return true;
  if (action !== 'look' || !lookUi.open || !value) return false;
  const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (String(chat.scriptstate?.[LOOK_KEY] ?? '') === value ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [LOOK_KEY]: value } })).catch((error) => {
    lookUi.notice = error instanceof Error ? error.message : String(error);
    return null;
  });
  if (saved !== null || !lookUi.notice) lookUi.open = false;
  await refresh();
  return true;
}

/** 시작 패널 「아바타」 단계 안: 성별 단추(look-sex) + 고른 아바타 칸(1배로 움직임, 누르면 그 성별 격자 팝업). 성별 → 아바타 순서로 꼭 고른다 */
export function lookStep(sel: string, g: LookGender | ''): string {
  const rows = lookRows();
  const r = sel && rows ? rows.find((x) => x.id === sel) : undefined;
  const segs = `<div class="gx-segs">${LOOK_GENDERS.map((x) => `<button class="gx-seg${x === g ? ' on' : ''}" data-action="look-sex" data-value="${x}" aria-pressed="${x === g}">${x}</button>`).join('')}</div>`;
  const card = r
    ? `<button class="gx-whoc gx-lookc gx-lookcur on" data-action="look-open" aria-label="아바타 바꾸기">${lookSprite(idleOf(r))}<span class="gx-lookcur-t">바꾸기</span></button>`
    : `<button class="gx-whoc gx-lookc gx-lookcur empty" data-action="look-open" ${g ? '' : 'disabled'} aria-label="아바타 고르기"><span class="gx-lookcur-none">${ICONS.person}<b>${g ? '눌러서 고르기' : '성별을 먼저'}</b></span></button>`;
  const hint = !g ? '<div class="gx-hint">성별을 고른 뒤 아바타를 골라요. 둘 다 골라야 출발할 수 있어요.</div>' : !r ? '<div class="gx-hint">아바타 칸을 눌러 골라 주세요.</div>' : '';
  return `<div class="gx-lookstep">${segs}${card}</div>${hint}`;
}

/** 고른 아바타의 성별 */
export const lookGender = (id: string): LookGender | '' => genderOf(lookRows(), id);

/** 이 채팅의 대기 동작 (host/looks.ts idleLook). 화면 쪽에서 한 곳에서 가져다 쓰게 */
export { idleLook } from '../host/looks';

/** 아바타 CSS (ui/app.ts 가 style.css 뒤에 붙인다) */
export const LOOK_CSS = `
.gx-look { display: block; flex: none; width: var(--lw); height: var(--lh); background-repeat: no-repeat; background-position: 0 0; image-rendering: pixelated; animation: gx-look var(--ld) steps(var(--ln)) infinite; }
@keyframes gx-look { to { background-position: calc(var(--lw) * var(--ln) * -1) 0; } }
.gx-lookg { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; max-height: min(560px, calc(100vh - 200px)); overflow: auto; padding: 2px; }
.gx-lookc { position: relative; justify-content: center; align-items: flex-end; height: 268px; padding: 6px 4px; overflow: hidden; }
.gx-lookpop-card { width: min(720px, calc(100vw - 40px)); min-width: 0; align-items: stretch; }
.gx-lookpop-card .gx-segs { align-self: flex-start; }
.gx-lookpop-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.gx-lookpop-head b { font-size: 16px; }
.gx-lookstep { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.gx-lookcur { width: 120px; flex: none; }
.gx-lookcur.empty { align-items: center; border-style: dashed; }
.gx-lookcur:disabled { opacity: .5; cursor: default; }
.gx-lookcur-none { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--dim); font-size: 14px; text-align: center; }
.gx-lookcur-none svg { width: 28px; height: 28px; }
.gx-lookcur-t { position: absolute; left: 0; right: 0; bottom: 0; padding: 4px 0 6px; background: linear-gradient(transparent, var(--panel)); color: var(--dim); font-size: 12px; text-align: center; }
@media (max-width: 760px), (max-height: 499px) and (pointer: coarse) {
  .gx-lookstep > .gx-segs { align-self: stretch; }
  .gx-lookg { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; }
  .gx-lookc { height: 262px; padding: 4px 2px; }
}
@media (prefers-reduced-motion: reduce) { .gx-look { animation: none; } }
`;
