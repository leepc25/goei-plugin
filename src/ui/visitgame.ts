// 설정 → 기능별 설정 → 필드: 게임 안 설정(화면·소리·조작)을 여기서도 고친다 (2026-10-25 사용자).
// 값은 이 채팅 변수 $hq_ui(JSON)에 있고, 게임은 bridge.uiPrefs로 같은 값을 읽고 쓴다. 덮어쓰기·불러오기(새 채팅 기본값)는 $hq_ 묶음 전체.
import { DEFAULT_SETTINGS, parseSettings, type UiSettings } from '../game/action/ui/settings';
import { updateChat, type ChatContext } from '../host/risu';
import { HQ_UI } from '../host/game/uiprefs';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Item =
  | { key: keyof UiSettings; label: string; type: 'pick'; opts: [string, string][] }
  | { key: keyof UiSettings; label: string; type: 'on' }
  | { key: keyof UiSettings; label: string; type: 'pct'; min: number; max: number; step: number }
  | { key: keyof UiSettings; label: string; type: 'min'; min: number; max: number; step: number };

const GROUPS: [string, Item[]][] = [
  ['화면', [
    { key: 'crt', label: 'CRT 모니터', type: 'pick', opts: [['off', '끄기'], ['screen', '화면 효과'], ['curved', '곡면까지']] },
    { key: 'charSize', label: '화면 확대', type: 'pct', min: 1, max: 1.6, step: 0.05 },
    { key: 'bright', label: '밝기', type: 'pct', min: 0.7, max: 1.4, step: 0.05 },
    { key: 'shake', label: '화면 흔들림', type: 'pct', min: 0, max: 1, step: 0.25 },
    { key: 'pixel', label: '도트 선명하게', type: 'on' },
    { key: 'flash', label: '피격 섬광', type: 'on' },
    { key: 'numbers', label: '피해 숫자', type: 'on' },
  ]],
  ['소리', [
    { key: 'master', label: '전체', type: 'pct', min: 0, max: 1, step: 0.1 },
    { key: 'music', label: '음악', type: 'pct', min: 0, max: 1, step: 0.1 },
    { key: 'sfx', label: '효과음', type: 'pct', min: 0, max: 1, step: 0.1 },
  ]],
  ['조작', [
    { key: 'touch', label: '터치 버튼', type: 'pick', opts: [['auto', '자동'], ['on', '항상'], ['off', '끄기']] },
    { key: 'touchSize', label: '버튼 크기', type: 'pct', min: 0.7, max: 1.4, step: 0.05 },
    { key: 'touchAlpha', label: '버튼 진하기', type: 'pct', min: 0.3, max: 1, step: 0.05 },
    { key: 'stickRun', label: '스틱 끝까지 밀면 달리기', type: 'on' },
    { key: 'lefty', label: '왼손 배치', type: 'on' },
    { key: 'vibrate', label: '진동', type: 'on' },
  ]],
  // 필드 시계 (docs/필드_세계_NPC_설계.md 16-2, 사용자 확정 2026-10-26): 0분 = 그 행동으로는 시간이 안 감
  ['필드 시간', [
    { key: 'tScene', label: '장면 넘어가기', type: 'min', min: 0, max: 60, step: 5 },
    { key: 'tRegion', label: '지역 이동', type: 'min', min: 0, max: 180, step: 5 },
    { key: 'tTalk', label: '대화 한 번', type: 'min', min: 0, max: 60, step: 5 },
    { key: 'tFight', label: '싸움 (장면당 한 번)', type: 'min', min: 0, max: 60, step: 5 },
    { key: 'tWaitShort', label: '시간 보내기 · 짧게', type: 'min', min: 0, max: 240, step: 5 },
    { key: 'tWaitLong', label: '시간 보내기 · 길게', type: 'min', min: 0, max: 480, step: 5 },
  ]],
];
const ITEMS = GROUPS.flatMap(([, g]) => g);

export function gameUiOf(state: Record<string, unknown> | undefined): UiSettings {
  const raw = state?.[HQ_UI];
  return parseSettings(typeof raw === 'string' && raw ? raw : null);
}

function control(it: Item, s: UiSettings): string {
  const cur = s[it.key];
  const seg = (v: string, label: string, on: boolean) => `<button class="gx-seg${on ? ' on' : ''}" data-action="visit-ui" data-value="${it.key}=${v}" aria-pressed="${on}">${esc(label)}</button>`;
  if (it.type === 'pick') return `<div class="gx-segs gx-segs-sm">${it.opts.map(([v, l]) => seg(v, l, cur === v)).join('')}</div>`;
  if (it.type === 'on') return `<div class="gx-segs gx-segs-sm">${seg('1', '켜기', cur === true)}${seg('0', '끄기', cur === false)}</div>`;
  if (it.type === 'min') return `<span class="adv-num"><input class="gx-search" type="number" inputmode="numeric" min="${it.min}" max="${it.max}" step="${it.step}" data-change="visit-ui" data-key="${it.key}" value="${Math.round(Number(cur))}" aria-label="${esc(it.label)}"><span>분</span></span>`;
  return `<span class="adv-num"><input class="gx-search" type="number" inputmode="numeric" min="${Math.round(it.min * 100)}" max="${Math.round(it.max * 100)}" step="${Math.round(it.step * 100)}" data-change="visit-ui" data-key="${it.key}" value="${Math.round(Number(cur) * 100)}" aria-label="${esc(it.label)}"><span>%</span></span>`;
}

export function gameUiSections(state: Record<string, unknown> | undefined): string {
  const s = gameUiOf(state);
  return GROUPS.map(([title, items]) => `<section class="ps-group"><h3>게임 ${esc(title)}</h3><div class="ps-rows">${items
    .map((it) => {
      const changed = s[it.key] !== DEFAULT_SETTINGS[it.key];
      return `<div class="ps-row adv-row${it.type === 'pct' || it.type === 'min' ? ' adv-numrow' : ''}${changed ? ' changed' : ''}"><div class="ps-label"><b>${esc(it.label)}</b></div><div class="ps-ctl">${control(it, s)}</div></div>`;
    })
    .join('')}</div></section>`).join('')
    + `<section class="ps-group"><p class="ps-note">게임 안 설정(Esc → 설정)과 같은 값이에요. 게임을 열어 둔 채 바꿨다면 다시 들어가면 적용돼요.</p></section>`;
}

/** visit-ui: key=값 (켜기·끄기는 1/0, 퍼센트 칸은 숫자 그대로) */
export async function setGameUi(ctx: ChatContext, value: string): Promise<boolean> {
  const i = value.indexOf('=');
  const key = value.slice(0, i) as keyof UiSettings, raw = value.slice(i + 1);
  const it = ITEMS.find((x) => x.key === key);
  if (!it) return false;
  const s = gameUiOf(ctx.chat.scriptstate) as unknown as Record<string, unknown>;
  if (it.type === 'pick') { if (!it.opts.some(([v]) => v === raw)) return false; s[key] = raw; }
  else if (it.type === 'on') s[key] = raw === '1';
  else if (it.type === 'min') {
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    s[key] = Math.min(it.max, Math.max(it.min, Math.round(n)));
  } else {
    const n = Number(raw);
    if (!Number.isFinite(n)) return false;
    s[key] = Math.min(it.max, Math.max(it.min, Math.round(n / (it.step * 100)) * it.step));
  }
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => ({ ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [HQ_UI]: JSON.stringify(s) } }));
  return true;
}
