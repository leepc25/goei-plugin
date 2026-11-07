// 내 모습 고르기 (2026-11-07 사용자): 시작 패널 「내 모습」 단계와, 시작한 뒤 다시 고르는 창이 같은 격자를 쓴다.
// 남·여를 고르면 그 성별 일반 NPC 프리셋 전부가 대기 동작으로 움직이는 격자에서 하나를 고른다. 고르지 않아도 된다.
// 대기 동작은 1배(픽셀 그대로)로 CSS steps 로 돌린다. 고른 것은 이 채팅 변수 $st_look 에 둔다 (core/looks.ts).
import { LOOK_GENDERS, LOOK_KEY, lookId, looksOf, type LookGender, type LookRow } from '../core/looks';
import { playerAgent } from '../core/player';
import { idleOf, looksStatus, lookRows, ensureLooks, type IdleLook } from '../host/looks';
import { updateChat, type ChatContext } from '../host/risu';
import { ICONS } from './icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 다시 고르는 창 (시작한 뒤) */
export const lookUi: { open: boolean; g: LookGender | ''; notice: string } = { open: false, g: '', notice: '' };

let rerender: () => void = () => {};
/** 창을 다시 그리는 함수 (ui/app.ts 가 둔다) */
export function setLookRender(fn: () => void): void {
  rerender = fn;
}

/** 내 모습 다시 고르기 창을 연다 (장착 상자 인물 자리 등에서 부른다). 고유 인물로 플레이 중이면 열지 않는다 */
export function openLookPicker(): void {
  lookUi.open = true;
  lookUi.notice = '';
  lookUi.g = '';
  rerender();
}

/** 대기 동작 한 칸 (1배, steps 반복). cls 로 크기 칸을 덧붙인다 */
export function lookSprite(look: IdleLook, cls = ''): string {
  const style = `--lw:${look.w}px;--lh:${look.h}px;--ln:${look.frames};--ld:${(look.frames * look.sec).toFixed(2)}s;background-image:url('${look.url}')`;
  return `<span class="gx-look${look.flip ? ' flip' : ''}${cls ? ` ${cls}` : ''}" style="${style}" aria-hidden="true"></span>`;
}

const genderOf = (rows: LookRow[] | null, id: string): LookGender | '' => rows?.find((r) => r.id === id)?.g ?? '';

/**
 * 성별 단추 + 모습 격자. sel = 고른 모습 번호('' = 고르지 않음), g = 보고 있는 성별('' 이면 고른 모습의 성별).
 * 단추: look-g(성별) · look(모습, '' = 고르지 않음) · look-retry(팩 다시 받기)
 */
export function lookChooser(sel: string, g: LookGender | ''): string {
  const rows = lookRows();
  const shown = g || genderOf(rows, sel);
  const segs = `<div class="gx-segs">${LOOK_GENDERS.map((x) => `<button class="gx-seg${x === shown ? ' on' : ''}" data-action="look-g" data-value="${x}" aria-pressed="${x === shown}">${x}</button>`).join('')}</div>`;
  if (!rows) {
    const st = looksStatus();
    const msg = st.failed
      ? `인물 모습을 받지 못했어요. ${esc(st.failed)} <button class="gx-chip" data-action="look-retry">다시 받기</button>`
      : `인물 모습을 받는 중…${st.progress ? ` ${esc(st.progress)}` : ''}`;
    return `${segs}<div class="gx-hint">${msg}</div>`;
  }
  if (!shown) return `${segs}<div class="gx-hint">성별을 고르면 고를 수 있는 모습이 보여요. 고르지 않아도 돼요.</div>`;
  const none = `<button class="gx-whoc gx-lookc none${!sel ? ' on' : ''}" data-action="look" data-value="" aria-pressed="${!sel}"><span class="gx-look-none">${ICONS.idcard}<b>고르지 않음</b></span></button>`;
  const cells = looksOf(rows, shown)
    .map((r) => `<button class="gx-whoc gx-lookc${r.id === sel ? ' on' : ''}" data-action="look" data-value="${esc(r.id)}" aria-pressed="${r.id === sel}" aria-label="모습 ${esc(r.id)}">${lookSprite(idleOf(r))}</button>`)
    .join('');
  return `${segs}<div class="gx-lookg">${none}${cells}</div>`;
}

/** 시작한 뒤 다시 고르는 창 */
export function lookPopup(ctx: ChatContext): string {
  if (!lookUi.open) return '';
  const pa = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const sel = lookId(ctx.chat.scriptstate);
  const inner = pa
    ? `<p class="gx-hint">${esc(pa.name)}(으)로 플레이 중이라 그 인물 모습을 써요.</p>`
    : lookChooser(sel, lookUi.g);
  return `<div class="gx-agpop gx-lookpop" data-action="look-close" role="dialog" aria-label="내 모습"><div class="gx-agpop-card gx-lookpop-card" data-action="look-keep">
    <div class="gx-lookpop-head"><b>내 모습</b><button class="gx-x" data-action="look-close" aria-label="닫기">${ICONS.close}</button></div>
    ${inner}${lookUi.notice ? `<div class="gx-err" role="alert">${esc(lookUi.notice)}</div>` : ''}
  </div></div>`;
}

/** 다시 고르는 창의 단추. 처리했으면 true */
export async function lookAction(action: string, value: string | undefined, ctx: ChatContext, refresh: () => Promise<void>): Promise<boolean> {
  switch (action) {
    case 'look-open':
      openLookPicker();
      return true;
    case 'look-close':
      lookUi.open = false;
      rerender();
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
    case 'look': {
      if (!lookUi.open) return false;
      const id = value ?? '';
      const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => (String(chat.scriptstate?.[LOOK_KEY] ?? '') === id ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [LOOK_KEY]: id } })).catch((error) => {
        lookUi.notice = error instanceof Error ? error.message : String(error);
        return null;
      });
      if (saved) lookUi.notice = '';
      await refresh();
      return true;
    }
  }
  return false;
}

/** 이 채팅의 대기 동작 (host/looks.ts idleLook). 화면 쪽에서 한 곳에서 가져다 쓰게 */
export { idleLook } from '../host/looks';

/** 내 모습 CSS (ui/app.ts 가 style.css 뒤에 붙인다) */
export const LOOK_CSS = `
.gx-look { display: block; flex: none; width: var(--lw); height: var(--lh); background-repeat: no-repeat; background-position: 0 0; image-rendering: pixelated; animation: gx-look var(--ld) steps(var(--ln)) infinite; }
.gx-look.flip { transform: scaleX(-1); }
@keyframes gx-look { to { background-position: calc(var(--lw) * var(--ln) * -1) 0; } }
.gx-lookg { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; max-height: 560px; overflow: auto; margin-top: 10px; padding: 2px; }
.gx-lookc { position: relative; justify-content: center; align-items: flex-end; height: 268px; padding: 6px 4px; overflow: hidden; }
.gx-lookc.none { align-items: center; }
.gx-look-none { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--dim); font-size: 14px; }
.gx-look-none b { font-weight: 600; }
.gx-look-none svg { width: 28px; height: 28px; }
.gx-lookc.on .gx-look-none { color: var(--text); }
.gx-lookpop-card { width: min(720px, calc(100vw - 40px)); min-width: 0; align-items: stretch; }
.gx-lookpop-card .gx-segs { align-self: flex-start; }
.gx-lookpop-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.gx-lookpop-head b { font-size: 16px; }
.gx-lookpop .gx-lookg { max-height: min(560px, calc(100vh - 200px)); }
@media (max-width: 640px) {
  .gx-lookg { grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 6px; max-height: 420px; }
  .gx-lookc { height: 262px; padding: 4px 2px; }
}
@media (prefers-reduced-motion: reduce) { .gx-look { animation: none; } }
`;
