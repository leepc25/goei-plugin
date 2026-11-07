// 「설정」 탭: 원본 설정 창의 동작·요원창·캐릭터 이미지 항목. 값은 이 채팅의 $st_* 변수에 두고,
// 범위: 이 채팅($st_*·$wg_*) / 새 채팅 기본값(플러그인 저장소) / 카드 명부(directory.ts, 카드 로어북).
import { onOffSwitch } from './controls';
import { repaintTheme } from './theme';
import {
  AGENT_MAX, basicDefaults, DIM_DEFAULT, basicSettings, basicVars, type BasicSettings, getPrefs, isChatSettingVar, type Prefs, type StatusStyle, type Theme, WORLD_SPEC, type WorldField, wgKey, worldDefaults, worldSettings,
} from '../core/settings';
import type { WorldSettings } from '../core/world/engine';
import { loadVarDefaults, savePrefs, saveVarDefaults } from '../host/prefs';
import { advSections } from './advanced';
import { loreCheckBox } from './lorecheck';
import { ASSET_NOTE } from '../core/asset';
import { IMG_FOLD, IMG_RECENT, IMG_SIZE, imgFold, imgRecent, imgSize, setImgHidden } from '../core/imgtag';
import type { Chat, ScriptState } from '../core/types';
import { parseCatalog, readWorld, startWorldVars, WORLD_KEY, worldOn, worldVars } from '../core/world';
import { COL_LOG_VAR, colConfig, colVar, STATUS_COLS, usedCols, withColLog, type ColConfig, type ColId, type ColMode } from '../core/world/statuscols';
import { invOn, ITEM_AUTO_VAR, ITEM_DETAIL_VAR, ITEM_LOGTURNS_MAX, ITEM_LOGTURNS_VAR, ITEM_RESUMED_VAR, ITEM_SPENT_VAR, ITEM_START_VAR, ITEM_STATE_VAR, ITEM_USE_AT_VAR, ITEM_USE_VAR, itemDetail, itemLogTurns, itemStartOn, itemStateOn, ITEM_LIMIT_DEFAULT, ITEM_LIMIT_VAR, ITEM_ON_VAR, ITEM_PUSH_VAR, ITEM_SLOTS_MAX, ITEM_SLOTS_MIN, ITEM_SLOTS_VAR, itemAutoOn, itemLimit, itemPushOn, itemSlots } from '../core/items';
import { SHOP_COUNT_VAR, SHOP_CTX_VAR, SHOP_FEATURE_VAR, SHOP_MAX_VAR, SHOP_MIN_VAR, SHOP_SIZE_HI, SHOP_SIZE_LO, SHOP_DIVERSE_VAR, SHOP_KICK_VAR, SHOP_MODEL_VAR, SHOP_ON_VAR, SHOP_PREV_VAR, SHOP_PRICE_VAR, SHOP_REFS_VAR, SHOP_THOUGHTS_VAR, SHOP_TURNS_VAR, SHOP_VAR, SHOP_WHERE_VAR, hasShopTag, shopBlocked, shopSettings, stripShopTags } from '../core/shop';
import { aliveAnchors, formatWon, parseWon, readWallet, WALLET_EDIT_VAR, WALLET_LOOSE_VAR, WALLET_MAX, WALLET_RECENT_MAX, WALLET_RECENT_VAR, WALLET_SYNC_VAR, walletBalance, walletEditable, walletLoose, walletRecentN, walletStarted, walletSyncOn, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { updateChat, type ChatContext } from '../host/risu';
import { barButtons, directoryBar, directoryDone, directoryDoneClear, directorySearch, directoryView } from './directory';
import { drawerBox } from './drawer';
import { toast } from './toast';
import { ICONS } from './icons';
import { resetShop } from './shop';

export interface SettingsEnv {
  render: () => void;
  refresh: () => Promise<void>;
}

/** 원본 테마 변수. 카드 배경 CSS가 이 값으로 갈림 (없으면 라이트) */
export const THEME_KEY = '$st_fixed_theme';

export const settingsUi = {
  page: '' as '' | 'phone' | 'gnet' | 'wiki' | 'people' | 'journal' | 'factions',
  confirmOff: false,
  busy: false,
  notice: '',
  info: '',
  scope: 'chat' as SettingsScope,
  confirm: '' as '' | 'save' | 'load' | 'reset',
  /** 「기본값 불러오기」 직전에 보관해 둔 이 채팅의 값 (2026-11-06 사용자 승인, 전수점검 9-7). 불러온 뒤 「되돌리기」 한 번. 없던 키는 undefined */
  undo: null as null | { charIndex: number; chatIndex: number; before: Record<string, string | number | boolean | undefined> },
};

export function resetSettings(): void {
  settingsUi.confirmOff = false;
  settingsUi.page = '';
  settingsUi.notice = '';
  settingsUi.scope = 'chat';
  settingsUi.confirm = '';
}

import { updateGroup } from './update';
import { ALL_PREFIXES } from './defaults';
import { PP, ppValue } from '../core/people/settings';
import { phoneSettingsPane } from './phone';
import { gnetSettingsPane } from './gnet';
import { wikiSettingsPane } from './wiki';
import { peopleSettingsPane, peopleFactionPane } from './people';
import { journalSettingsPane } from './records';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function seg(action: string, cur: string, items: [string, string][], disabled = false): string {
  const sw = onOffSwitch(items, cur, action, (v) => v, disabled);
  if (sw) return sw;
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${v}" aria-pressed="${cur === v}" ${disabled ? 'disabled' : ''}>${label}</button>`)
    .join('')}</div>`;
}

/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작 (괴담톡 설정과 같은 모양) */
/** scope 'device' = 이 기기 공통 값(채팅·기본값 구분 없음). 줄 이름 옆에 배지로 보인다 (2026-10-27 리수폿식 범위 표시) */
/** scope 'chat'·'defaults' = 화면 페이지처럼 범위 전환이 없는 곳에서 그 줄만 다른 범위일 때 (테마) */
const SCOPE_BADGE = { device: '이 기기', chat: '이 채팅', defaults: '새 채팅 기본값' } as const;
function field(label: string, control: string, help: string, scope?: keyof typeof SCOPE_BADGE): string {
  return `<div class="ps-row"><div class="ps-label"><b>${label}${scope ? `<i class="gx-scope${scope === 'device' ? '' : ` ${scope}`}">${SCOPE_BADGE[scope]}</i>` : ''}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
}

/** 0–100% 막대. 끄는 동안은 창 바깥만 바로 바꾸고(app.ts), 놓으면 저장 */
const dimSlider = (n: number, busy: boolean) =>
  `<label class="st-range"><input type="range" min="0" max="100" step="5" value="${n}" data-input="dim" data-change="set-dim" aria-label="창 바깥 불투명도"${busy ? ' disabled' : ''}><output>${n}%</output></label>`;

/** 퍼센트 막대 (이미지 크기·접힌 높이). 끄는 동안은 숫자만 바꾸고(app.ts), 놓으면 저장 */
const pctSlider = (action: string, n: number, r: { min: number; max: number; step: number }, label: string, busy: boolean) =>
  `<label class="st-range"><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${n}" data-input="pct" data-change="${action}" aria-label="${label}"${busy ? ' disabled' : ''}><output>${n}%</output></label>`;

/** 최근만/전부 + 개수 막대. 값: 없음=기본 6, 0=전부 */
function recentControl(key: string, v: number | undefined, label: string, busy: boolean): string {
  const n = v ?? IMG_RECENT.def;
  const all = n === 0;
  return `<div class="st-recent">${seg(`set-${key}-mode`, all ? 'all' : 'recent', [['recent', '최근만'], ['all', '전부']], busy)}`
    + (all ? '' : `<label class="st-range"><input type="range" min="${IMG_RECENT.min}" max="${IMG_RECENT.max}" step="1" value="${n}" data-input="count" data-change="set-${key}" aria-label="${label}"${busy ? ' disabled' : ''}><output>${n}개</output></label>`)
    + '</div>';
}

const group = (title: string, body: string, note = '') =>
  `<section class="ps-group"><h3>${title}</h3>${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${body}</div></section>`;

/** 상태창 칸 표 (설계안 7절): 칸마다 사용·표시. 날짜·시각·위치는 사용을 끌 수 없다. 플러그인이 쓰는 칸은 끄면 그 기능도 꺼진다고 알린다 */
function statusColsTable(cfg: ColConfig, busy: boolean): string {
  const rows = STATUS_COLS.map((c) => {
    const m = cfg[c.id];
    const use = seg('set-col', m === 'off' ? '0' : '1', [['1', '사용'], ['0', '안 씀']], busy || c.locked).replace(/data-value="(\d)"/g, `data-value="${c.id}:use:$1"`);
    const show = seg('set-col', m === 'on' ? '1' : '0', [['1', '표시'], ['0', '숨김']], busy || m === 'off').replace(/data-value="(\d)"/g, `data-value="${c.id}:show:$1"`);
    const hint = c.locked ? '늘 사용' : c.feature ? `끄면 ${c.feature}도 꺼져요` : '';
    return `<div class="st-col-row${m === 'off' ? ' off' : ''}"><div class="st-col-name"><b>${c.label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${use}${show}</div>`;
  });
  return `<div class="st-cols ps-row-block">${rows.join('')}</div>`;
}

/** 시작 잔고 입력 (원). 숫자 또는 「120만 원」. locked = 이야기가 시작됐고 잔고 직접 수정이 꺼짐 */
const wonInput = (n: number, busy: boolean, locked = false) =>
  `<input class="st-won" type="text" inputmode="numeric" value="${n.toLocaleString('en-US')}" data-change="set-wallet-start" aria-label="시작 잔고"${busy || locked ? ' disabled' : ''}>`;

/** 상황판을 끈다: 상태와 보고를 비운다 (원본 clearIntegratedControlState. 다시 켜도 복원하지 않음) */
function worldOffVars(): ScriptState {
  return { $st_anomaly_on: '0', [WORLD_KEY]: '', $an_report: '', $in_report: '', $ms_report: '', $ag_report: '' };
}

export type SettingsScope = 'chat' | 'defaults' | 'card';

interface View {
  basic: BasicSettings;
  world: WorldSettings;
  theme: Theme;
}

function current(ctx: ChatContext, scope: SettingsScope): View {
  const lore = ctx.char.globalLore;
  if (scope !== 'chat') return { basic: basicDefaults(lore), world: worldDefaults(lore), theme: getPrefs().theme ?? 'dark' };
  const cur = String(ctx.chat.scriptstate?.[THEME_KEY] ?? '');
  return {
    basic: basicSettings(lore, ctx.chat.scriptstate),
    world: worldSettings(lore, ctx.chat.scriptstate),
    theme: cur === 'dark' || cur === 'paper' ? cur : 'light',
  };
}

function stepper(action: string, key: string, shown: string, canDown: boolean, canUp: boolean, label: string, busy: boolean): string {
  return `<div class="st-step"><button class="gx-step" data-action="${action}" data-value="${key}:-" ${!canDown || busy ? 'disabled' : ''} aria-label="${esc(label)} 줄이기">−</button>
    <b>${esc(shown)}</b><button class="gx-step" data-action="${action}" data-value="${key}:+" ${!canUp || busy ? 'disabled' : ''} aria-label="${esc(label)} 늘리기">+</button></div>`;
}

/** 괴이 생성 수치 한 칸의 증감 폭 */
function worldStep(key: WorldField['key']): number {
  if (key.endsWith('_p') || key === 'landmark_share') return 10;
  if (key.endsWith('_ttl')) return 6;
  return 1;
}

function worldRow(w: WorldSettings, key: WorldField['key'], label: string, unit: string, busy: boolean): string {
  const f = WORLD_SPEC.find((x) => x.key === key)!;
  const v = w[key];
  const max = f.max ?? 99;
  const HINT: Partial<Record<string, string>> = {
    cap: '같은 때에 살아 있을 수 있는 최대 개수예요. 이 수가 차면 더 생기지 않아요',
    p: '응답 하나를 처리할 때 새로 생길 확률이에요',
    ttl: '생긴 뒤 이야기 속 시간으로 이만큼 지나면 자동으로 끝나요. 모델이 먼저 끝내면 그때 끝나요',
    landmark_share: '사건이 생길 때 등록된 거점(본부·지사 같은 장소)에서 생길 비율이에요. 나머지는 지도의 아무 곳',
  };
  const kind = key === 'landmark_share' ? 'landmark_share' : key.replace(/^(preset|random|incident|mystic)_/, '');
  return field(esc(label), stepper('set-world', key, `${v}${unit}`, v > 0, v < max, label, busy), HINT[kind] ?? '');
}

function worldKind(w: WorldSettings, k: 'preset' | 'random' | 'incident' | 'mystic', name: string, busy: boolean): string {
  const expire = w[`${k}_expire`] === 1;
  return `<div class="ps-card"><h4>${name}</h4><div class="ps-rows">
    ${worldRow(w, `${k}_cap`, '동시 최대', '개', busy)}
    ${worldRow(w, `${k}_p`, '발생 확률', '%', busy)}
    ${field('자동 종료', seg('set-world', expire ? `${k}_expire:1` : `${k}_expire:0`, [[`${k}_expire:1`, 'ON'], [`${k}_expire:0`, 'OFF']], busy), '켜면 아래 유지 시간이 지났을 때 플러그인이 끝내요. 끄면 모델이 끝낼 때까지 남아요')}
    ${expire ? worldRow(w, `${k}_ttl`, 'RP 유지 시간', '시간', busy) : ''}
    ${k === 'incident' ? worldRow(w, 'landmark_share', '거점 비율', '%', busy) : ''}
  </div></div>`;
}

// v0.16.23 (사용자 설계): 「이 채팅 / 새 채팅 기본값」으로 같은 설정을 두 벌 두지 않는다. 설정은 하나(지금 채팅)이고,
// 「기본값으로 저장」을 누르면 지금 값이 새 채팅 기본값이 된다. 채팅을 시작하기 전에는 기본값을 바로 고친다.

// 위쪽 줄 하나 (v0.16.25, 사용자 설계): [설정|명부] 전환 + 「덮어쓰기」「불러오기」 (전환보다 한 단계 작게). 설정에서는 새 채팅 기본값을,
// 명부에서는 카드 로어북을 저장하고 불러온다. 누르면 확인을 한 번 더 받는다.
const CONFIRM: Record<'chat' | 'card', Record<'save' | 'load' | 'reset', [string, string]>> = {
  chat: {
    save: ['이 채팅의 설정 전부(캐릭터 이미지·상황판·괴담넷·괴담톡·위키·필드·인물 기록·고급)를 새 채팅 기본값으로 저장할까요? 앞으로 새로 시작하는 채팅이 이 값으로 시작해요.', '저장'],
    load: ['저장해 둔 새 채팅 기본값 전부를 이 채팅에 불러올까요? 상황판 켜기·끄기는 그대로 둬요.', '불러오기'],
    reset: ['이 채팅의 설정 전부와 저장해 둔 새 채팅 기본값을 버리고 플러그인 초기값으로 되돌릴까요? 상황판 켜기·끄기는 그대로 둬요. 되돌리기 띠로 한 번 되돌릴 수 있어요.', '초기값으로'],
  },
  card: {
    save: ['고친 명부로 카드에 저장된 명부를 덮어쓸까요? 이 카드의 모든 채팅에 적용돼요.', '덮어쓰기'],
    load: ['고친 내용을 버리고 카드에 저장된 명부로 되돌릴까요?', '되돌리기'],
    reset: ['고친 내용을 버리고 카드에 저장된 명부로 되돌릴까요?', '되돌리기'],
  },
};

function scopeBar(scope: SettingsScope, canChat: boolean, ctx?: ChatContext): string {
  // 명부는 세계 편집 창으로 옮겼다 (2026-10-27). 설정 탭에는 옵션만
  const items: [SettingsScope, string][] = [[canChat ? 'chat' : 'defaults', '설정']];
  const tabs = `<div class="gx-segs st-scope">${items
    .map(([k, label]) => `<button class="gx-seg${scope === k ? ' on' : ''}" data-action="set-scope" data-value="${k}" aria-pressed="${scope === k}">${label}</button>`)
    .join('')}</div>`;
  // 명부는 입력할 때마다 버튼만 다시 그린다 (directoryInput → .dir-bar)
  const btns = scope === 'card' ? `<span class="st-barbtns dir-bar">${directoryBar()}</span>` : scope === 'chat' ? `<span class="st-barbtns">${barButtons(settingsUi.busy)}</span>` : '';
  const kind = scope === 'card' ? 'card' : 'chat';
  const c = settingsUi.confirm && scope !== 'defaults' ? CONFIRM[kind][settingsUi.confirm] : null;
  const yes = kind === 'card' ? (settingsUi.confirm === 'save' ? 'dir-save' : 'dir-reset') : 'set-bar-yes';
  const confirm = c
    ? `<div class="st-confirm st-barconfirm"><p>${c[0]}</p><div class="gx-row-btns"><button class="gx-mini${settingsUi.confirm === 'load' ? ' danger' : ' ps-save'}" data-action="${yes}" data-value="${settingsUi.confirm}">${c[1]}</button><button class="gx-mini" data-action="set-bar-no">취소</button></div></div>`
    : scope === 'chat' && ctx ? undoBar(ctx) : '';
  return `<div class="st-scopebar">${tabs}${btns}</div>${confirm}`;
}

/** 설정 창 모든 채팅 설정 페이지 머리의 「기본값으로 저장」「기본값 불러오기」 (가3 → 2026-10-29 사용자 1번 결정: 범위 칩 없음, 값은 늘 이 채팅,
 *  저장 = 이 채팅의 설정 전부(이미지·상황판·괴이 발생·테마·기능 페이지 변수·고급)를 한 번에 새 채팅 기본값으로, 불러오기 = 그 반대 한 번에).
 *  처리는 set-bar / set-bar-yes / set-bar-no */
export const mainDefaultsButtons = (): string => {
  const off = settingsUi.busy ? 'disabled' : '';
  return `<span class="ps-defaults"><button class="st-act save" data-action="set-bar" data-value="save" title="기본값으로 저장" aria-label="기본값으로 저장" ${off}>${ICONS.pen}<span>기본값으로 저장</span></button><button class="st-act" data-action="set-bar" data-value="load" title="기본값 불러오기" aria-label="기본값 불러오기" ${off}>${ICONS.refresh}<span>기본값 불러오기</span></button><button class="st-act" data-action="set-bar" data-value="reset" title="플러그인 초기값으로" aria-label="플러그인 초기값으로" ${off}>${ICONS.back}<span>초기값으로</span></button></span>`;
};
/** 불러오기 뒤의 「되돌리기」 띠: 보관해 둔 값이 이 채팅 것일 때만 */
export function undoBar(ctx: ChatContext): string {
  const u = settingsUi.undo;
  if (!u || u.charIndex !== ctx.charIndex || u.chatIndex !== ctx.chatIndex || settingsUi.confirm) return '';
  return `<div class="st-confirm st-undobar ps-defconfirm"><p>기본값을 불러오기 전 설정을 보관해 뒀어요. 되돌리면 그때 값으로 돌아가요.</p><div class="gx-row-btns"><button class="gx-mini ps-save" data-action="set-bar-undo" ${settingsUi.busy ? 'disabled' : ''}>${ICONS.back}불러오기 전으로 되돌리기</button><button class="gx-mini" data-action="set-bar-undo-drop">보관한 것 버리기</button></div></div>`;
}
/** 페이지 안: 되돌리기 띠만. 확인은 팝업(mainDefaultsPopup) — 11-07 사용자: 전체 설정에 관한 확인이 괴담넷 같은 한 페이지 안에 뜨면 안 된다 */
export function mainDefaultsConfirm(ctx?: ChatContext): string {
  return ctx ? undoBar(ctx) : '';
}
/** 설정 창 전체 위에 뜨는 확인 팝업 (닫기 확인과 같은 모양) */
export function mainDefaultsPopup(): string {
  const c = settingsUi.confirm ? CONFIRM.chat[settingsUi.confirm] : null;
  if (!c) return '';
  return `<div class="gw-confirm"><div class="gw-confirm-box"><p>${c[0]}</p><div class="gx-row-btns"><button class="gx-mini${settingsUi.confirm === 'load' || settingsUi.confirm === 'reset' ? ' danger' : ' ps-save'}" data-action="set-bar-yes" data-value="${settingsUi.confirm}">${c[1]}</button><button class="gx-mini" data-action="set-bar-no">취소</button></div></div></div>`;
}

const BACK = `<button class="ph-tool ph-back" data-action="set-feat-back" aria-label="설정으로">${ICONS.back}</button>`;
/** 기능별 설정을 설정창 안에서 (각 기능의 설정 화면을 그대로 쓰고, 뒤로가기만 설정으로) */
function featurePage(ctx: ChatContext, page: NonNullable<typeof settingsUi.page>, canChat: boolean): string {
  const raw = page === 'phone' ? phoneSettingsPane(ctx) : page === 'gnet' ? gnetSettingsPane(ctx) : page === 'people' ? peopleSettingsPane(ctx, canChat) : page === 'factions' ? peopleFactionPane(ctx, canChat) : page === 'journal' ? journalSettingsPane(ctx, canChat) : wikiSettingsPane(ctx);
  // 첫 머리의 뒤로 단추를 설정으로 돌아가는 단추로 (없으면 넣는다)
  let pane = raw.replace(/<header class="ph-room-head[^"]*">(\s*<button class="ph-tool ph-back"[^>]*>[\s\S]*?<\/button>)?/, `<header class="ph-room-head">${BACK}`);
  // 시작 전(시작 패널): 설정 값은 이 채팅에 바로 적히고, 갱신·열기 같은 동작은 시작 뒤에 된다
  if (!canChat) pane = pane.replace(/<\/header>/, '</header><p class="gx-hint st-prehint">채팅을 시작하기 전이에요. 여기서 바꾼 값은 이 채팅에 그대로 적용되고, 갱신·열기 같은 동작은 시작한 뒤에 할 수 있어요.</p>');
  return `<main class="gx-body gx-settings st-featpage">${pane}</main>`;
}

/** 설정 묶음 하나 (편집 창의 「설정」 페이지가 묶음별로 가져다 쓴다, 2026-10-27) */
export type SettingsSection = 'screen' | 'image' | 'board' | 'status' | 'wallet' | 'items' | 'shop' | 'lore' | 'adv' | 'update';
export function settingsSection(ctx: ChatContext, scope: SettingsScope, canChat: boolean, section: SettingsSection): string {
  return settingsTab(ctx, scope, canChat, section);
}

/** 설정 머리: 알림·토스트 (편집 창용) */
export function settingsNotices(): string {
  return `${settingsUi.notice ? `<div class="gx-err" role="alert">${esc(settingsUi.notice)}</div>` : ''}${toast('st', settingsUi.info, (t) => {
    if (settingsUi.info === t) settingsUi.info = '';
  })}`;
}

/** 기능별 설정 화면의 본문 (편집 창용: 뒤로 단추·main 없이) */
export function featurePane(ctx: ChatContext, page: NonNullable<typeof settingsUi.page>, canChat: boolean): { body: string; act: string } {
  let html = featurePage(ctx, page, canChat)
    .replace(/^<main class="gx-body gx-settings st-featpage">/, '')
    .replace(/<\/main>$/, '')
    .replace(/<p class="gx-hint st-prehint">[\s\S]*?<\/p>/, '');
  // 안쪽 머리(뒤로·제목·단추)는 떼고, 단추(덮어쓰기·불러오기 등)만 창 머리 오른쪽으로 (2026-10-27: 모든 설정 페이지가 같은 머리)
  let act = '';
  html = html.replace(/<header class="ph-room-head[^"]*">([\s\S]*?)<\/header>/, (_m, inner: string) => {
    act = inner
      .replace(/<button class="ph-tool ph-back"[^>]*>[\s\S]*?<\/button>/, '')
      .replace(/<div class="ph-room-title">[\s\S]*?<\/div>/, '')
      .replace(/^<span class="ph-act">([\s\S]*)<\/span>$/, '$1')
      .trim();
    return '';
  });
  return { body: html, act };
}

export function settingsTab(ctx: ChatContext, scope: SettingsScope = 'chat', canChat = true, only?: SettingsSection): string {
  // 명부: 모바일은 검색을 하단 서랍에 (괴이·특수·요원·조직 탭은 위에 고정)
  if (scope === 'card') {
    return `<main class="gx-body gx-settings">${scopeBar(scope, canChat, ctx)}${directoryView(ctx)}${toast('dir', directoryDone(), directoryDoneClear)}</main>${drawerBox(directorySearch(), 'gx-dirdrawer')}`;
  }
  // 기능별 설정 → 본부 대화: 괴담톡·괴담넷·위키처럼 따로 된 화면 (2026-10-23 사용자)
  // 시작 전(시작 패널의 「새 채팅 기본 설정」)에도 chat 객체·scriptstate 가 있어 같은 페이지를 연다 (2026-10-26 사용자)
  // only(편집 창의 묶음 하나)를 달라고 하면 기능 페이지 대신 그 묶음만 (2026-11-05: 기록 페이지의 가계부 묶음이 기록 설정 전체로 두 번 그려졌다)
  if (settingsUi.page && !only) return featurePage(ctx, settingsUi.page, canChat);
  const { basic: s, world, theme } = current(ctx, scope);
  // 인물 기록 켬/끔: 채팅은 $pp_on, 새 채팅 기본값은 플러그인 저장소의 같은 변수
  const peopleOn = ppValue(scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars, 'on') === '1';
  const on = scope === 'chat' ? worldOn(ctx.chat) : s.anomalyOn;
  const busy = settingsUi.busy;
  const anomaly = settingsUi.confirmOff && scope === 'chat'
    ? `<div class="st-confirm"><p>끄면 지금 상황판의 괴이·사건·특수·요원 상태를 비워요. 다시 켜도 이전 상태는 돌아오지 않아요.</p>
        <div class="gx-row-btns"><button class="gx-mini danger" data-action="set-anomaly" data-value="off-yes" ${busy ? 'disabled' : ''}>끄기</button>
        <button class="gx-mini" data-action="set-anomaly" data-value="off-no">취소</button></div></div>`
    : seg('set-anomaly', on ? 'on' : 'off', [['on', 'ON'], ['off', 'OFF']], busy);
  const note = String(ctx.chat.scriptstate?.[ASSET_NOTE] ?? '');
  // 상태창 칸 구성·시작 잔고 (채팅 변수 또는 새 채팅 기본값)
  const colCfg = colConfig(scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars);
  const wallet = readWallet(scope === 'chat' ? ctx.chat.scriptstate : undefined, getPrefs().walletStart ?? WALLET_START_DEFAULT);
  const walletStart = wallet.start;
  const walletNow = scope === 'chat' ? walletBalance(wallet, aliveAnchors(ctx.chat)) : walletStart;
  // 잔고 직접 수정 (기본 끔): 가계부 잔고 고치기·거래 지우기, 진행 중 시작 잔고 바꾸기를 한꺼번에
  const walletEdit = walletEditable(scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars);
  const itVars = scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars;
  const startLocked = scope === 'chat' && !walletEdit && walletStarted(ctx.chat);
  const S: Record<SettingsSection, string> = {
    screen: `${group('화면', [
      // 테마는 채팅마다 ($st_fixed_theme, 원본 ensureDefaults) — 시작 뒤엔 이 채팅, 시작 전엔 새 채팅 기본값 (2026-10-28 QC: 「이 기기」 배지가 붙어 있었지만 실제로는 채팅에 저장됐다)
      field('테마', seg('set-theme', theme, [['light', '라이트'], ['dark', '다크'], ['paper', '페이퍼']], busy), `채팅 화면의 캐릭터 이미지 배경과 상태창(「테마」를 골랐을 때) 배색이에요. ${scope === 'chat' ? '이 채팅에 저장돼요. 새 채팅의 기본값은 시작 화면의 설정에서 정해요.' : '새 채팅이 시작할 때 쓸 배색이에요.'}`, scope === 'chat' ? 'chat' : 'defaults'),
      field('메뉴 위치', seg('set-nav', getPrefs().nav ?? 'left', [['left', '왼쪽'], ['right', '오른쪽']], busy), 'PC 창에서 메뉴 목록을 놓을 쪽이에요.', 'device'),
      field('위키 목록 위치', seg('set-wiki-side', getPrefs().wikiSide ?? 'right', [['left', '왼쪽'], ['right', '오른쪽']], busy), '위키의 세로바와 숨은 목록 서랍을 놓을 쪽이에요. 폰의 「목록」 책갈피도 같은 쪽으로 가요.', 'device'),
      field('요원 칸', seg('set-agents', getPrefs().agents ?? 'wall', [['wall', '모니터'], ['list', '목록']], busy), '상황판 요원 칸 모양이에요.', 'device'),
      field('창 바깥 불투명도', dimSlider(getPrefs().dim ?? DIM_DEFAULT, busy), '창 뒤 채팅 화면을 가리는 정도예요. 0%면 그대로 보이고 100%면 다 가려요.', 'device'),
      // 창 둘레 기기 틀 (2026-10-29 사용자, ui/frame.ts). 좁아서 숨긴 상태는 app.ts 가 .gx 에 data-frame-hidden 으로 적는다
      field('외부 프레임', seg('set-frame', getPrefs().frame ?? 'tablet', [['none', '없음'], ['tablet', '일반 태블릿'], ['tactical', '전술 태블릿']], busy), `PC에서 상황판 창 둘레에 그리는 기기 틀로, 폰이나 필드 전체화면에서는 그리지 않고 창 폭이 모자라면 자동으로 숨겨요.${document.querySelector<HTMLElement>('.gx')?.dataset.frameHidden === '1' ? '<br><span class="st-frame-note">지금 창 폭이 좁아 프레임을 숨겼어요</span>' : ''}`, 'device'),
      field('설정 창 폭', seg('set-editor-width', String(getPrefs().editorWidth ?? 90), [['60', '60%'], ['70', '70%'], ['80', '80%'], ['90', '90%'], ['100', '100%']], busy), '이 설정 창이 화면 가로의 몇 %를 쓸지예요. 높이는 늘 화면의 92%. 폰에서는 늘 전체 화면이에요.', 'device'),
    ].join(''))}`,
    image: `${group('캐릭터 이미지', [
      field('에셋 출력', seg('set-asset', s.assetOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '본문에 등장하는 캐릭터의 등록 이미지를 표시하도록 이미지 태그를 적어요. 이미지와 태그 목록은 봇 카드에 들어 있어요.'),
      s.assetOn ? field('이미지 크기', pctSlider('set-img-size', getPrefs().imgSize ?? IMG_SIZE.def, IMG_SIZE, '이미지 크기', busy), '채팅 속 캐릭터 이미지 칸의 크기예요. 100%가 원래 크기이고, 채팅 폭보다 커지지는 않아요.', 'device') : '',
      s.assetOn ? field('이미지 접기', seg('set-img-foldon', getPrefs().imgFoldOn === false ? '0' : '1', [['1', '접기'], ['0', '펼침']], busy), '이미지를 위쪽만 보이게 접어 두고 누르거나 마우스를 올리면 펼칠지, 늘 펼쳐 둘지예요.', 'device') : '',
      s.assetOn && getPrefs().imgFoldOn !== false ? field('접힌 그림 펼치기', seg('set-img-foldlock', getPrefs().imgFoldLock ? '0' : '1', [['1', '펼쳐짐'], ['0', '늘 접힘']], busy), '접힌 그림을 누르거나 마우스를 올렸을 때 펼칠지, 늘 접힌 채 둘지예요.', 'device') : '',
      s.assetOn && getPrefs().imgFoldOn !== false ? field('접힌 높이', pctSlider('set-img-fold', getPrefs().imgFold ?? IMG_FOLD.def, IMG_FOLD, '접힌 높이', busy), '접혔을 때 그림 높이의 몇 %를 보여 줄지예요. 원래는 68%(정사각형)예요.', 'device') : '',
      s.assetOn ? field('이미지 표시 범위', recentControl('img-show', getPrefs().imgShow, '이미지 표시 메시지 수', busy), '이미지를 띄울 메시지예요. 「최근만」이면 마지막 메시지부터 정한 개수까지만 띄워요(원래 6개). 바꾼 값은 메시지를 다시 그릴 때 반영돼요.', 'device') : '',
      s.assetOn ? field('요청 속 이미지 태그', recentControl('img-send', getPrefs().imgSend, '태그를 남길 메시지 수', busy), '모델에 보내는 대화 기록에서 이미지 태그를 남길 메시지예요. 오래된 태그를 빼면 토큰이 줄어요. 최근 태그는 모델이 태그 쓰는 법을 따라 하도록 남겨요(원래 6개).', 'device') : '',
      s.assetOn ? field('출력 모델', seg('set-asset-model', s.assetModel, [['main', '메인모델'], ['aux', '보조모델']], busy), '메인모델은 본문과 함께 적고, 보조모델은 응답이 끝난 뒤 한 번 더 불러 태그를 보충해요.') : '',
      s.assetOn ? field('주인공 이미지', seg('set-asset-player', s.assetPlayer ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '「캐릭터로 플레이」로 고른 요원(내가 연기하는 주인공)에게도 이미지 태그를 붙일지예요. 끄면 페르소나처럼 주인공 이미지는 띄우지 않아요.') : '',
      s.assetOn && s.assetModel === 'aux' ? field('캐릭터당 이미지 수', seg('set-asset-limit', String(s.assetLimit), [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], busy), '보조모델이 한 응답에서 캐릭터 한 명에게 붙일 이미지 태그의 최대 개수') : '',
    ].join(''))}
    ${scope === 'chat' && s.assetOn && s.assetModel === 'aux' && note ? `<p class="gx-hint">최근 보충: ${esc(note)}</p>` : ''}`,
    board: `${group('상황판', [
      field('괴이 발생 · 요원 시스템', anomaly, scope === 'chat' ? 'ON이면 괴이·사건·특수가 자동으로 발생하고 응답마다 지도와 요원 상태를 갱신해요. OFF로 바꾸면 현재 상황판을 비워요. 커스텀 임무는 OFF에서도 쓸 수 있어요.' : '새 채팅을 상황판을 켠 채로 시작할지 정해요.'),
      field('요원 표시 인원', stepper('set-agent', 'n', `${s.agentLimit}명`, s.agentLimit > 0, s.agentLimit < AGENT_MAX, '요원 표시 인원', busy), `상황판과 편성에 보일 등록 요원 수 (0~${AGENT_MAX}명, 0이면 숨김)`),
      field('지원 투입', seg('set-support', s.supportOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '편성에서 등록 요원 외의 일반 지원 인원을 더할 수 있어요.'),
      field('인물 기록', seg('set-people', peopleOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), scope === 'chat' ? '응답마다 보조 모델이 한 번 읽어 인물의 상태·관계·호감을 기록하고, 본편 요청이 그 기록을 읽어요. 세부는 「기능별 설정 → 인물 기록」에서.' : '새 채팅을 인물 기록을 켠 채로 시작할지 정해요.'),
    ].join(''))}
    <section class="ps-group"><h3>괴이 발생</h3><p class="ps-note">응답을 처리할 때마다 판정해요. 상한을 0으로 하면 그 종류는 자동으로 생기지 않아요.</p>
      <div class="ps-cards">
        ${worldKind(world, 'preset', '프리셋 괴이', busy)}${worldKind(world, 'random', '랜덤 괴이', busy)}
        ${worldKind(world, 'incident', '사건', busy)}${worldKind(world, 'mystic', '특수', busy)}
        <div class="ps-card"><h4>추가 발생 여유분</h4><div class="ps-rows">
          ${worldRow(world, 'extra_cap', '괴이', '개', busy)}${worldRow(world, 'extra_in_cap', '사건', '개', busy)}${worldRow(world, 'extra_ms_cap', '특수', '개', busy)}</div>
          <p class="ps-note">직접 고르거나 RP 중에 새로 등장한 것을 상한과 따로 기록할 수 있는 개수예요.</p></div>
      </div>
    </section>`,
    // 상태창: 배색(이 기기)과 칸 구성(이 채팅). 2026-10-29 사용자: 상황판 페이지에 섞여 있던 것을 따로 뺌
    status: `${group('상태창', [
      field('상태창', seg('set-status', getPrefs().status ?? 'auto', [['auto', '테마'], ['dark', '다크'], ['light', '라이트'], ['paper', '페이퍼'], ['off', '미표시']], busy), '채팅 속 상태창의 배색이에요. 「테마」는 위 테마를 따라가요. 미표시를 고르면 상자만 숨기고, 모델은 상태 태그를 계속 써요.', 'device'),
    ].join(''))}
    ${group(`상태창 칸 <small>${usedCols(colCfg).length}칸 사용</small>`, statusColsTable(colCfg, busy),
      `응답 끝의 상태 태그 <code>[▣|…]</code>에 들어가는 칸이에요. 「안 씀」으로 하면 태그에서 그 칸이 빠지고(모델에 모양을 알려 줘요), 「숨김」은 태그에는 두고 채팅 속 상태창 상자에서만 가려요.${scope === 'chat' ? ' 바꾼 구성은 이 채팅에 바로 적용되고 바뀐 시점이 기록돼요.' : ' 새 채팅의 기본 구성이에요.'}`)}
`,
    // 가계부(시작 잔고·잔고 직접 수정): 설정 「기록」 페이지 안의 묶음 (2026-11-05 사용자: 가계부가 기록 하위 탭이니 상태창에는 잔고 칸 표시만)
    // 2026-11-07 사용자: 가계부·소지품·상점 설정을 「소지품」 한 페이지로, 켜고 끄기는 따로 (가계부 = 상태창 잔고 칸 $st_col_wallet)
    wallet: group('가계부', [
      field('가계부', seg('set-wallet-on', colCfg.wallet === 'off' ? '0' : '1', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 상태창에 잔고 칸을 두고, 본문에 금액이 적힌 거래를 인물 기록 갱신기가 뽑아 가계부에 더하고 빼요. 끄면 잔고 칸과 거래 기록이 빠져요. 소지품·상점과 따로 켜고 꺼요.'),
      ...(colCfg.wallet === 'off' ? [] : [
        field('시작 잔고', wonInput(walletStart, busy, startLocked), scope === 'chat' ? `이 채팅 가계부의 시작 잔고예요. 지금 잔고 ${esc(formatWon(walletNow))}. 거래 내역은 소지품 → 가계부에서.${startLocked ? ' 이야기가 시작돼서 잠겼어요(아래 「잔고 직접 수정」을 켜면 바꿀 수 있어요).' : ''}` : '새 채팅 가계부의 시작 잔고예요. 거래는 인물 기록 갱신기가 본문에서 금액이 적힌 것만 뽑아 더하고 빼요.'),
        field('잔고 직접 수정', seg('set-wallet-edit', walletEdit ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 가계부에서 잔고를 고치고 거래를 지울 수 있고, 진행 중인 채팅의 시작 잔고도 바꿀 수 있어요. 이야기 밖에서 바뀐 잔고는 모델이 이유를 몰라 대화가 길어질수록 앞뒤가 꼬이기 쉬워서 기본은 꺼 둬요.'),
        field('상태창 잔고 따르기', seg('set-wallet-sync', walletSyncOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 모델이 상태창 잔고 칸을 바꿨을 때 가계부를 그 값에 맞춰요(차이를 「상태창 잔고」 한 줄로). 끄면 가계부 값만 믿고, 다음 요청에 넘기는 지난 상태창의 잔고를 가계부 값으로 덮어 모델이 고치게 해요.'),
        field('거래 읽는 기준', seg('set-wallet-loose', walletLoose(itVars) ? '1' : '0', [['0', '금액이 적힌 것만'], ['1', '어림도 받기']], busy), '금액이 적힌 것만이면 「3만 원을 냈다」처럼 금액이 글에 있는 거래만 적어요. 어림도 받기면 「밥을 사 먹었다」처럼 금액이 없는 거래도 보조 모델이 서울 물가로 어림해 메모에 「(어림)」을 붙여 적어요.'),
        field('최근 거래 넘기기', stepper('set-wallet-recent', 'n', `${walletRecentN(itVars)}줄`, walletRecentN(itVars) > 0, walletRecentN(itVars) < WALLET_RECENT_MAX, '최근 거래 줄 수', busy), `본편 요청의 지난 상태창 아래에 최근 거래를 몇 줄 붙일지예요(0~${WALLET_RECENT_MAX}, 0이면 안 붙여요). 모델이 돈이 어디로 갔는지 알고 이어 써요.`),
      ]),
    ].join('')),
    // 소지품 (2026-11-07): 본편에 넘기기·보조 모델 읽기·칸 수·한계 문장. 채팅 변수 $it_* 또는 새 채팅 기본값
    items: group('소지품', [
      field('소지품', seg('set-inv-on', invOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '끄면 소지품 화면·[Inventory] 글·보조 모델 읽기·「다음 메시지에 사용」이 다 빠지고, 소지품에 딸린 상점도 같이 꺼져요. 가계부는 그대로예요.'),
      ...(!invOn(itVars) ? [] : [
      field('본편에 넘기기', seg('set-items-push', itemPushOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 매 요청에 지금 가진 물건·한계·이번 턴 사건(사용·새로 산 것·넘침)을 [Inventory] 글로 넣어요. 모델이 상황을 알고 응답에 반영해요. 플러그인은 막거나 경고하지 않아요.'),
      field('보조 모델이 읽기', seg('set-items-auto', itemAutoOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 인물 기록 갱신기가 응답을 읽어 본문에서 얻은·잃은 물건을 목록에 맞춰요(근거 문장이 있는 것만). 끄면 직접 넣기·상점으로만 바뀌어요.'),
      field('칸 수', stepper('set-items-slots', 'n', `${itemSlots(itVars)}칸`, itemSlots(itVars) > ITEM_SLOTS_MIN, itemSlots(itVars) < ITEM_SLOTS_MAX, '칸 수', busy), `소지품 칸이에요(${ITEM_SLOTS_MIN}~${ITEM_SLOTS_MAX}). 넘치면 「17/16」처럼 보이고 그대로 본편에 넘겨요. 푸는 건 이야기 쪽이에요.`),
      field('지닐 수 있는 한계', `<input class="st-text" type="text" maxlength="60" value="${esc(itemLimit(itVars))}" data-change="set-items-limit" placeholder="${esc(ITEM_LIMIT_DEFAULT)}" aria-label="지닐 수 있는 한계"${busy ? ' disabled' : ''}>`, '모델에 알려 주는 한 줄이에요(Carry limit). 비우면 기본 문장으로 돌아가요.'),
      field('본편에 넘길 내용', seg('set-items-detail', itemDetail(itVars), [['full', '전부'], ['state', '이름·판정'], ['name', '이름만']], busy), '[Inventory] 한 줄에 무엇을 넣을지예요. 전부 = 이름·설명·효과·장착·남은 횟수·상태, 이름·판정 = 설명·효과를 빼고, 이름만 = 이름뿐. 물건이 많을 때 줄이면 토큰이 덜 들어요.'),
      field('상태 바꾸기', seg('set-items-state', itemStateOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '켜면 보조 모델이 본문을 보고 물건을 손상·고장·파괴로 바꿔요. 끄면 손상·고장은 받지 않고, 부서진 물건은 「없어짐」으로만 빠져요.'),
      field('다 쓴 물건', seg('set-items-spent', itemsUiSpent(itVars), [['remove', '목록에서 빼기'], ['keep', '남겨 두기']], busy), '남은 횟수가 0이 된 소모품을 어떻게 할지예요. 남겨 두면 「다 씀」으로 칸에 남고 본편에도 used up 으로 넘어가요(빈 병·다 쓴 탄창처럼).'),
      field('사용·처분 기록 넘기기', stepper('set-items-logturns', 'n', `${itemLogTurns(itVars)}턴`, itemLogTurns(itVars) > 0, itemLogTurns(itVars) < ITEM_LOGTURNS_MAX, '기록 턴 수', busy), `최근 몇 턴 동안 얻고·쓰고·버리고·잃은 기록을 [Inventory] 에 「Recently」 한 줄로 붙일지예요(0~${ITEM_LOGTURNS_MAX}, 0이면 안 붙여요).`),
      field('시작 소지품', seg('set-items-start', itemStartOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '고유 인물로 시작할 때 명부의 「시작 소지품」을 넣고 무기·장비를 장착할지예요. 새 채팅을 시작할 때만 쓰여요.'),
      ]),
    ].join('')),
    // 상점 (2026-11-07 사용자): 표식 `[shop: 가게|주인]` 으로 열리는 상점 팝업의 생성 방식. 채팅 변수 $sh_* 또는 새 채팅 기본값
    shop: (() => {
      const sh = shopSettings(itVars);
      const blocked = shopBlocked(itVars);
      const onoff = (action: string, cur: boolean) => seg(action, cur ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy);
      return group('상점', [
        // 상점은 소지품·가계부에 딸림 (2026-11-07 사용자): 둘 중 하나가 꺼지면 꺼지고 스위치도 잠긴다
        blocked ? field('상점', seg('set-shop-on', '0', [['1', 'ON'], ['0', 'OFF']], true), `${blocked === 'both' ? '소지품과 가계부가' : blocked === 'items' ? '소지품이' : '가계부가'} 꺼져 있어 상점도 꺼져 있어요. 상점은 물건을 소지품에 넣고 돈을 가계부로 주고받아서 둘 다 켜져 있어야 써요.`) :
        field('상점', onoff('set-shop-on', sh.on), '켜면 본편 모델에 「거래가 가능한 자리에서 응답 끝에 [shop: 가게|주인] 표식을 쓰라」고 알려 주고, 표식이 온 응답 아래에 「상점 열기」가 붙어요. 물건은 열 때 보조 모델이 맥락대로 지어요. 잔고·소지품은 모델에 넘기지 않아요.'),
        ...(sh.on ? [
          field('모델', seg('set-shop-model', sh.model, [['main', '메인모델'], ['aux', '보조모델']], busy), '진열대와 주인 대사를 지을 모델이에요.'),
          field('진열대 분량', `<div class="st-range"><span>최소</span>${stepper('set-shop-min', 'n', `${sh.size[0]}개`, sh.size[0] > SHOP_SIZE_LO, sh.size[0] < SHOP_SIZE_HI, '최소', busy)}<span>최대</span>${stepper('set-shop-max', 'n', `${sh.size[1]}개`, sh.size[1] > SHOP_SIZE_LO, sh.size[1] < SHOP_SIZE_HI, '최대', busy)}</div>`, `한 번에 받을 물건 수예요(${SHOP_SIZE_LO}~${SHOP_SIZE_HI}). 모델에 「최소~최대 개」로 넘기고, 같게 두면 늘 그 수만큼 나와요. 새로고침·전체 다시 짜기에도 같은 범위예요.`),
          field('희귀·특가 구획', onoff('set-shop-feature', sh.feature), '켜면 진열대마다 희귀 물건 단 하나와 특가 물건 1~3개를 따로 받아, 희귀는 진열장에, 특가는 원래 값에 줄을 긋고 할인율을 붙여 따로 보여 줘요. 끄면 한 격자에 늘어놓아요.'),
          field('맥락 반영', seg('set-shop-ctx', sh.context ? '1' : '0', [['1', '맥락'], ['0', '가게만']], busy), '맥락이면 최근 본문·상태창(시각·장소)·진행 중 괴이·신분을 같이 넘겨 지금 상황에 맞는 물건이 나와요. 가게만이면 가게 정체와 참고 자료만 넘겨요.'),
          field('값 기준', `<input class="st-text" type="text" maxlength="80" value="${esc(sh.price)}" data-change="set-shop-price" placeholder="예: 동네 가게 값, 괴이 관련 물건은 비싸게" aria-label="값 기준"${busy ? ' disabled' : ''}>`, '모델에 알려 주는 값 기준 한 줄이에요. 비우면 그 가게에 어울리는 실제 물가로 지어요.'),
          field('다양성', onoff('set-shop-diverse', sh.diverse), '켜면 뻔한 물건만 늘어놓지 않고 싼 것·비싼 것·흔한 것·특이한 것을 섞어요.'),
          field('생각 단계', seg('set-shop-thoughts', sh.thoughts, [['off', '없음'], ['inner', '속으로만'], ['note', '적고 지움']], busy), '물건을 짓기 전에 가게·장면·주인을 먼저 정리하게 해요. 적고 지움은 응답이 길어져요.'),
          field('지난 진열대 피하기', onoff('set-shop-prev', sh.avoidPrev), '새로고침할 때 이번 방문에 이미 보였던 물건을 피해요.'),
          field('거래 끊음', onoff('set-shop-kick', sh.kick), '켜면 주인이 모욕·끝없는 흥정 같은 일에 거래를 끊을 수 있어요. 끊기면 진열대가 잠기고 다음 턴 본편에 넘어가요. 끄면 주인이 아무리 화나도 가게는 열려 있어요.'),
          // 숫자는 고르는 단추 말고 −/+ 한 칸씩 (2026-11-07 사용자)
          field('상점이 열리는 자리', seg('set-shop-where', sh.where, [['any', '어디서든'], ['shop', '가게 장면만']], busy), '어디서든이면 판매자가 있는 가게뿐 아니라 온라인몰·홈쇼핑·카탈로그·자판기·이면의 쇼핑몰처럼 주인이 없는 곳에서도 「상점 열기」가 붙어요. 가게 장면만이면 판매자가 그 자리에 있는 가게·노점에서만 붙어요.'),
          field('최근 본문 턴 수', stepper('set-shop-turns', 'n', `${sh.turns}턴`, sh.turns > 1, sh.turns < 8, '최근 본문 턴 수', busy), '진열대·주인 대사를 지을 때 넘기는 최근 본문 턴 수예요(1~8, 맥락 반영이 「맥락」일 때).'),
          field('참고 로어북 수', stepper('set-shop-refs', 'n', `${sh.refs}개`, sh.refs > 0, sh.refs < 12, '참고 로어북 수', busy), '봇 설명·지금 켜진 로어북·가게 이름과 주인 이름이 걸리는 로어북(주인 인물 포함)·위키의 가게 문서 가운데 최대 몇 개를 넘길지예요(0~12).'),
          field('넘기는 것·남는 것', '', '모델에 가는 것: 가게 이름·주인, 가게 정체(첫 호출 뒤 고정), 위의 참고 로어북, 맥락이면 주인공 신분·상태창 마지막 줄·진행 중 괴이·최근 본문, 이번 방문 진열대·대화 전부. 안 가는 것: 잔고·소지품·페르소나·작가 노트. 본편에는 다음 턴 [Inventory] 글의 This turn 으로 「새로 산 것」·「판 것」·「주인과 나눈 대화 전부」·「쫓겨남」이 넘어가고, 산 물건은 소지품에, 돈은 가계부에 남아요. 조립된 요청 원문은 점검 → 호출 기록에서 봐요.'),
        ] : []),
      ].join(''));
    })(),
    // 로어북 호출: 고급에서 따로 뺀 페이지 (2026-11-05 사용자)
    lore: `${advSections('gen', scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars, scope === 'chat' && canChat ? { 1: loreCheckBox(ctx) } : {}, [1])}`,
    adv: `${advSections('gen', scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars, {}, [0])}`,
    update: `${updateGroup(ctx)}`,
  };
  if (only) return S[only];
  return `<main class="gx-body gx-settings">
    ${scopeBar(scope, canChat, ctx)}
    ${settingsUi.notice ? `<div class="gx-err" role="alert">${esc(settingsUi.notice)}</div>` : ''}
    ${S.screen}${S.image}${S.board}${S.lore}${S.adv}${S.update}
    ${toast('st', settingsUi.info, (t) => {
      if (settingsUi.info === t) settingsUi.info = '';
    })}
  </main>`;
}

/** 상점이 꺼질 때(상점·소지품·가계부 끔): 채팅에 남은 표식을 지워 「상점 열기」 카드가 남지 않게 (core/shop.ts stripShopTags) */
async function dropShopTags(ctx: ChatContext): Promise<void> {
  await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
    const list = chat.message ?? [];
    if (!list.some((m) => m.role === 'char' && hasShopTag(String(m.data ?? '')))) return null;
    return { ...chat, message: list.map((m) => (m.role === 'char' && hasShopTag(String(m.data ?? '')) ? { ...m, data: stripShopTags(String(m.data)) } : m)) };
  }).catch(() => null);
}

const itemsUiSpent = (vars: Record<string, unknown> | undefined) => (vars?.[ITEM_SPENT_VAR] === 'keep' ? 'keep' : 'remove');
/** 소지품·가계부 단순 옵션: 켬/끔·고르기(values) 또는 −/+ 숫자(max·num) */
const INV_OPTS: Record<string, { key: string; values: string[]; max?: number; num?: (vars: Record<string, unknown> | undefined) => number }> = {
  'set-items-start': { key: ITEM_START_VAR, values: ['1', '0'] },
  'set-items-detail': { key: ITEM_DETAIL_VAR, values: ['full', 'state', 'name'] },
  'set-items-state': { key: ITEM_STATE_VAR, values: ['1', '0'] },
  'set-items-spent': { key: ITEM_SPENT_VAR, values: ['remove', 'keep'] },
  'set-items-logturns': { key: ITEM_LOGTURNS_VAR, values: [], max: ITEM_LOGTURNS_MAX, num: itemLogTurns },
  'set-wallet-sync': { key: WALLET_SYNC_VAR, values: ['1', '0'] },
  'set-wallet-loose': { key: WALLET_LOOSE_VAR, values: ['1', '0'] },
  'set-wallet-recent': { key: WALLET_RECENT_VAR, values: [], max: WALLET_RECENT_MAX, num: walletRecentN },
};

async function save(ctx: ChatContext, env: SettingsEnv, change: (chat: Chat) => ScriptState | null): Promise<void> {
  settingsUi.busy = true;
  settingsUi.notice = '';
  env.render();
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (latest) => {
      const vars = change(latest);
      return vars ? { ...latest, scriptstate: { ...(latest.scriptstate ?? {}), ...vars } } : null;
    });
  } catch (error) {
    settingsUi.notice = error instanceof Error ? error.message : String(error);
  }
  settingsUi.busy = false;
  await env.refresh();
}

function withBasic(ctx: ChatContext, chat: Chat, patch: Partial<BasicSettings>): ScriptState {
  return basicVars({ ...basicSettings(ctx.char.globalLore, chat.scriptstate), ...patch });
}

async function saveDefaults(env: SettingsEnv, change: (p: Prefs) => Prefs): Promise<void> {
  settingsUi.busy = true;
  settingsUi.notice = '';
  env.render();
  try {
    await savePrefs(change);
  } catch (error) {
    settingsUi.notice = `기본값을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
  }
  settingsUi.busy = false;
  env.render();
}

const basicPatch = (env: SettingsEnv, patch: Partial<BasicSettings>) => saveDefaults(env, (p) => ({ ...p, basic: { ...p.basic, ...patch } }));

/** "칸:use:1|0" / "칸:show:1|0" → [칸, 새 모드]. 바뀌는 게 없거나 잠긴 칸을 끄려 하면 null */
function nextColMode(cfg: ColConfig, v: string): [ColId, ColMode] | null {
  const [id, what, val] = v.split(':');
  const def = STATUS_COLS.find((c) => c.id === id);
  if (!def || (what !== 'use' && what !== 'show') || (val !== '1' && val !== '0')) return null;
  const cur = cfg[def.id];
  let next: ColMode = cur;
  if (what === 'use') next = val === '1' ? (cur === 'off' ? 'on' : cur) : def.locked ? cur : 'off';
  else next = cur === 'off' ? cur : val === '1' ? 'on' : 'hide';
  return next === cur ? null : [def.id, next];
}

/** "키:+" / "키:-" / "키:값" → 새 값 (범위 밖이면 null) */
function nextWorld(w: WorldSettings, v: string): [WorldField['key'], number] | null {
  const [key, op] = v.split(':');
  const f = WORLD_SPEC.find((x) => x.key === key);
  if (!f || op === undefined) return null;
  const cur = w[f.key];
  const step = worldStep(f.key);
  const n = op === '+' ? cur + step : op === '-' ? cur - step : Number(op);
  if (!Number.isFinite(n)) return null;
  const clamped = Math.min(f.max ?? 99, Math.max(0, f.fraction ? n : Math.round(n)));
  return clamped === cur ? null : [f.key, clamped];
}

export async function handleSettings(action: string, value: string | undefined, ctx: ChatContext, env: SettingsEnv, scope: SettingsScope = 'chat'): Promise<boolean> {
  const v = value ?? '';
  const lore = ctx.char.globalLore;
  if (action === 'set-feat-back') {
    settingsUi.page = '';
    env.render();
    return true;
  }
  if (action === 'set-bar') {
    settingsUi.confirm = v === 'save' || v === 'load' || v === 'reset' ? v : '';
    env.render();
    return true;
  }
  if (action === 'set-bar-no') {
    settingsUi.confirm = '';
    env.render();
    return true;
  }
  if (action === 'set-bar-undo-drop') {
    settingsUi.undo = null;
    env.render();
    return true;
  }
  if (action === 'set-bar-undo') {
    // 불러오기 전에 보관한 값으로. 그때 없던 키는 지운다
    const u = settingsUi.undo;
    if (!u || u.charIndex !== ctx.charIndex || u.chatIndex !== ctx.chatIndex) return true;
    settingsUi.undo = null;
    await save(ctx, env, (chat) => {
      const vars: ScriptState = {};
      const drop: string[] = [];
      for (const [k, val] of Object.entries(u.before)) {
        if (val === undefined) drop.push(k);
        else vars[k] = val;
      }
      if (drop.length) {
        const ss = { ...(chat.scriptstate ?? {}) };
        for (const k of drop) delete ss[k];
        chat.scriptstate = ss;
      }
      return vars;
    });
    if (!settingsUi.notice) settingsUi.info = '기본값을 불러오기 전 설정으로 되돌렸어요.';
    env.render();
    return true;
  }
  if (action === 'set-bar-yes') {
    const what = settingsUi.confirm;
    settingsUi.confirm = '';
    if (what === 'save') {
      // 이 채팅의 설정 전부(캐릭터 이미지·상황판·괴이 발생·테마 + 기능 페이지·고급 변수)를 새 채팅 기본값으로 (2026-10-29: 한 번에)
      const cur = current(ctx, 'chat');
      await saveDefaults(env, (p) => ({ ...p, basic: { ...cur.basic }, world: { ...cur.world }, theme: cur.theme }));
      if (!settingsUi.notice) await saveVarDefaults(ALL_PREFIXES, ctx.chat.scriptstate).catch((error) => (settingsUi.notice = `기본값을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`));
      if (!settingsUi.notice) settingsUi.info = '지금 설정을 새 채팅 기본값으로 저장했어요.';
      env.render();
    } else if (what === 'load') {
      // 새 채팅 기본값을 지금 채팅에. 상황판 켜기·끄기는 상태를 비우거나 새로 만들기 때문에 그대로 둔다
      const d = current(ctx, 'defaults');
      // 덮어쓰기 직전에 바뀔 키의 지금 값을 보관한다 (2026-11-06 사용자 승인, 전수점검 9-7): 불러온 뒤 「되돌리기」 한 번
      let before: Record<string, string | number | boolean | undefined> | null = null;
      await save(ctx, env, (chat) => {
        const vars: ScriptState = { ...basicVars(d.basic), [THEME_KEY]: d.theme, ...loadVarDefaults(ALL_PREFIXES, chat.scriptstate) };
        for (const f of WORLD_SPEC) vars[wgKey(f.key)] = String(d.world[f.key]);
        if (worldOn(chat)) {
          const ss = { ...(chat.scriptstate ?? {}), ...vars };
          Object.assign(vars, worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? '')));
        }
        before = {};
        for (const k of Object.keys(vars)) before[k] = chat.scriptstate?.[k];
        return vars;
      });
      if (!settingsUi.notice && before) settingsUi.undo = { charIndex: ctx.charIndex, chatIndex: ctx.chatIndex, before };
      if (!settingsUi.notice) settingsUi.info = '새 채팅 기본값을 지금 채팅에 불러왔어요.';
      env.render();
    } else if (what === 'reset') {
      // 플러그인 초기값으로 (11-07 사용자: 「기본값으로 저장·불러오기」만 있고 초기값 롤백이 없다): 이 채팅의 설정 변수를 전부 지워 코드 기본값으로,
      // 저장해 둔 새 채팅 기본값(prefs basic·world·theme·vars)도 비운다. 상황판 켜기·끄기는 그대로. 불러오기와 같은 「되돌리기」 띠 한 번
      let before: Record<string, string | number | boolean | undefined> | null = null;
      await save(ctx, env, (chat) => {
        const ss = { ...(chat.scriptstate ?? {}) };
        before = {};
        for (const k of Object.keys(ss)) {
          if (k === '$st_anomaly_on' || !(isChatSettingVar(k) || k === THEME_KEY)) continue;
          before[k] = ss[k] as string | number | boolean | undefined;
          delete ss[k];
        }
        chat.scriptstate = ss;
        const vars: ScriptState = {};
        if (worldOn(chat)) {
          const wv = worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? ''));
          for (const k of Object.keys(wv)) if (!(k in before)) before[k] = ss[k] as string | number | boolean | undefined;
          Object.assign(vars, wv);
        }
        return vars;
      });
      if (!settingsUi.notice) await saveDefaults(env, (p) => ({ ...p, basic: {}, world: {}, theme: undefined, vars: {} }));
      if (!settingsUi.notice && before) settingsUi.undo = { charIndex: ctx.charIndex, chatIndex: ctx.chatIndex, before };
      if (!settingsUi.notice) settingsUi.info = '이 채팅 설정과 새 채팅 기본값을 플러그인 초기값으로 되돌렸어요.';
      env.render();
    } else env.render();
    return true;
  }
  // 창 모양은 채팅·기본값 구분 없이 이 기기 설정으로
  if (action === 'set-status' && ['auto', 'dark', 'light', 'paper', 'off'].includes(v ?? '')) {
    await saveDefaults(env, (p) => ({ ...p, status: v === 'auto' ? undefined : (v as StatusStyle) }));
    repaintTheme();
    return true;
  }
  if (action === 'set-img-foldon') {
    await saveDefaults(env, (p) => ({ ...p, imgFoldOn: v === '0' ? false : undefined }));
    repaintTheme();
    return true;
  }
  if (action === 'set-img-foldlock') {
    await saveDefaults(env, (p) => ({ ...p, imgFoldLock: v === '0' ? true : undefined }));
    repaintTheme();
    return true;
  }
  if (action === 'set-img-size' || action === 'set-img-fold') {
    const size = imgSize(v);
    const fold = imgFold(v);
    if (action === 'set-img-size' && size !== null) await saveDefaults(env, (p) => ({ ...p, imgSize: size === IMG_SIZE.def ? undefined : size }));
    else if (action === 'set-img-fold' && fold !== null) await saveDefaults(env, (p) => ({ ...p, imgFold: fold === IMG_FOLD.def ? undefined : fold }));
    repaintTheme();
    return true;
  }
  if (/^set-img-(show|send)(-mode)?$/.test(action)) {
    const key = action.includes('show') ? 'imgShow' : 'imgSend';
    const cur = getPrefs()[key];
    const n = action.endsWith('-mode') ? (v === 'all' ? 0 : cur === 0 || cur === undefined ? IMG_RECENT.def : cur) : imgRecent(v);
    if (n !== null) await saveDefaults(env, (p) => ({ ...p, [key]: n === IMG_RECENT.def ? undefined : n }));
    return true;
  }
  if (action === 'set-agents') {
    await saveDefaults(env, (p) => ({ ...p, agents: v === 'list' ? 'list' : undefined }));
    return true;
  }
  if (action === 'set-wiki-side') {
    if (v === 'left' || v === 'right') await saveDefaults(env, (p) => ({ ...p, wikiSide: v }));
    return true;
  }
  if (action === 'set-frame') {
    if (v === 'none' || v === 'tablet' || v === 'tactical') await saveDefaults(env, (p) => ({ ...p, frame: v === 'tablet' ? undefined : v }));
    return true;
  }
  if (action === 'set-nav' || action === 'set-dim') {
    const n = Number(v);
    if (action === 'set-nav' && (v === 'left' || v === 'right')) await saveDefaults(env, (p) => ({ ...p, nav: v === 'right' ? 'right' : undefined }));
    else if (action === 'set-dim' && Number.isInteger(n) && n >= 0 && n <= 100) await saveDefaults(env, (p) => ({ ...p, dim: n }));
    return true;
  }
  if (action === 'set-scope') {
    settingsUi.scope = v === 'defaults' || v === 'card' ? v : 'chat';
    settingsUi.confirmOff = false;
    settingsUi.confirm = '';
    env.render();
    return true;
  }
  // 상점 설정 (set-shop-<키>): 두 범위 같은 처리. 값 검사는 변수마다
  // 소지품·가계부 옵션 (2026-11-07 사용자): 켬/끔·고르기는 값 그대로, 숫자는 −/+ 한 칸씩. 두 범위 같은 처리
  const simple = INV_OPTS[action];
  if (simple) {
    const vars = scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate;
    let next: string | null = null;
    if (simple.max !== undefined) {
      if (/^n:[+-]$/.test(v)) next = String(Math.max(0, Math.min(simple.max, simple.num!(vars) + (v.endsWith('+') ? 1 : -1))));
    } else if (simple.values.includes(v)) next = v;
    if (next === null) return true;
    const key = simple.key;
    const val = next;
    if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [key]: val } }));
    else await save(ctx, env, (chat) => (String(chat.scriptstate?.[key] ?? '') === val ? null : { [key]: val }));
    return true;
  }
  if (action.startsWith('set-shop-')) {
    // 최소·최대: −/+ 한 칸씩, 서로 넘으면 다른 쪽도 같이 민다
    if (action === 'set-shop-min' || action === 'set-shop-max') {
      const vars = scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate;
      let [lo, hi] = shopSettings(vars).size;
      const d = v.endsWith('+') ? 1 : -1;
      if (action === 'set-shop-min') lo = Math.max(SHOP_SIZE_LO, Math.min(SHOP_SIZE_HI, lo + d));
      else hi = Math.max(SHOP_SIZE_LO, Math.min(SHOP_SIZE_HI, hi + d));
      if (lo > hi) action === 'set-shop-min' ? (hi = lo) : (lo = hi);
      const patch = { [SHOP_MIN_VAR]: String(lo), [SHOP_MAX_VAR]: String(hi) };
      if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), ...patch } }));
      else await save(ctx, env, (chat) => (String(chat.scriptstate?.[SHOP_MIN_VAR] ?? '') === patch[SHOP_MIN_VAR] && String(chat.scriptstate?.[SHOP_MAX_VAR] ?? '') === patch[SHOP_MAX_VAR] ? null : patch));
      return true;
    }
    const KEY: Record<string, string> = { on: SHOP_ON_VAR, model: SHOP_MODEL_VAR, count: SHOP_COUNT_VAR, ctx: SHOP_CTX_VAR, price: SHOP_PRICE_VAR, diverse: SHOP_DIVERSE_VAR, thoughts: SHOP_THOUGHTS_VAR, prev: SHOP_PREV_VAR, kick: SHOP_KICK_VAR, feature: SHOP_FEATURE_VAR, turns: SHOP_TURNS_VAR, refs: SHOP_REFS_VAR, where: SHOP_WHERE_VAR };
    const k = action.slice(9);
    const key = KEY[k];
    if (!key) return true;
    // 턴 수·로어북 수: −/+ 한 칸씩
    if ((k === 'turns' || k === 'refs') && /^n:[+-]$/.test(v)) {
      const cur = shopSettings(scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate)[k];
      const [lo, hi] = k === 'turns' ? [1, 8] : [0, 12];
      const nv = String(Math.max(lo, Math.min(hi, cur + (v.endsWith('+') ? 1 : -1))));
      if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [key]: nv } }));
      else await save(ctx, env, (chat) => (String(chat.scriptstate?.[key] ?? '') === nv ? null : { [key]: nv }));
      return true;
    }
    const ok = k === 'price' ? true : k === 'model' ? v === 'main' || v === 'aux' : k === 'count' ? ['0', '1', '2'].includes(v) : k === 'thoughts' ? ['off', 'inner', 'note'].includes(v) : k === 'where' ? v === 'any' || v === 'shop' : k === 'turns' ? /^[1-8]$/.test(v) : k === 'refs' ? /^([0-9]|1[0-2])$/.test(v) : v === '1' || v === '0';
    if (!ok) return true;
    const next = k === 'price' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : v;
    if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [key]: next } }));
    else {
      // 진행 중 상점을 끄면 이번 방문을 닫고 남은 표식을 지운다
      await save(ctx, env, (chat) => (String(chat.scriptstate?.[key] ?? '') === next ? null : { [key]: next, ...(k === 'on' && next === '0' ? { [SHOP_VAR]: '' } : {}) }));
      if (k === 'on' && next === '0') {
        resetShop();
        await dropShopTags(ctx);
      }
    }
    return true;
  }
  if (scope === 'defaults') {
    const d = current(ctx, 'defaults');
    switch (action) {
      case 'set-anomaly':
        if (v === 'on' || v === 'off') await basicPatch(env, { anomalyOn: v === 'on' });
        return true;
      case 'set-people':
        // 새 채팅 기본값의 $pp_on (시작할 때 chat.scriptstate 로 들어간다)
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [PP('on')]: v } }));
        return true;
      case 'set-col': {
        // 새 채팅 기본값의 상태창 칸 구성 ($st_col_<id>)
        const hit = nextColMode(colConfig(getPrefs().vars), v);
        if (hit) await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [colVar(hit[0])]: hit[1] } }));
        return true;
      }
      case 'set-wallet-start': {
        const n = parseWon(v);
        if (n !== null && n >= 0 && n <= WALLET_MAX) await saveDefaults(env, (p) => ({ ...p, walletStart: n }));
        else env.render();
        return true;
      }
      case 'set-wallet-edit':
        // 새 채팅 기본값의 잔고 직접 수정 ($st_wallet_edit)
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [WALLET_EDIT_VAR]: v } }));
        return true;
      case 'set-wallet-on':
        // 가계부 켬/끔 = 새 채팅 기본값의 상태창 잔고 칸 (2026-11-07 사용자: 가계부·소지품·상점 켜고 끄기는 따로)
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [colVar('wallet')]: v === '1' ? 'on' : 'off' } }));
        return true;
      case 'set-inv-on':
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_ON_VAR]: v } }));
        return true;
      case 'set-items-push':
      case 'set-items-auto':
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [action === 'set-items-push' ? ITEM_PUSH_VAR : ITEM_AUTO_VAR]: v } }));
        return true;
      case 'set-items-slots': {
        const next = Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, itemSlots(getPrefs().vars) + (v.endsWith('+') ? 1 : -1)));
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_SLOTS_VAR]: String(next) } }));
        return true;
      }
      case 'set-items-limit':
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_LIMIT_VAR]: v.replace(/\s+/g, ' ').trim().slice(0, 60) } }));
        return true;
      case 'set-agent': {
        const next = Math.min(AGENT_MAX, Math.max(0, d.basic.agentLimit + (v.endsWith('+') ? 1 : -1)));
        if (next !== d.basic.agentLimit) await basicPatch(env, { agentLimit: next });
        return true;
      }
      case 'set-theme':
        if (v === 'light' || v === 'dark' || v === 'paper') await saveDefaults(env, (p) => ({ ...p, theme: v }));
        return true;
      case 'set-support':
        await basicPatch(env, { supportOn: v === '1' });
        return true;
      case 'set-asset':
        await basicPatch(env, { assetOn: v === '1' });
        return true;
      case 'set-asset-model':
        if (v === 'main' || v === 'aux') await basicPatch(env, { assetModel: v });
        return true;
      case 'set-asset-player':
        await basicPatch(env, { assetPlayer: v === '1' });
        return true;
      case 'set-asset-limit': {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 1 && n <= 4) await basicPatch(env, { assetLimit: n });
        return true;
      }
      case 'set-world': {
        const hit = nextWorld(d.world, v);
        if (hit) await saveDefaults(env, (p) => ({ ...p, world: { ...p.world, [hit[0]]: hit[1] } }));
        return true;
      }
    }
    return false;
  }
  switch (action) {
    case 'set-world':
      await save(ctx, env, (chat) => {
        const hit = nextWorld(worldSettings(lore, chat.scriptstate), v);
        return hit ? { [wgKey(hit[0])]: String(hit[1]) } : null;
      });
      return true;
    case 'set-people':
      // 인물 기록 켬/끔 (기능 페이지의 같은 줄과 같은 변수, 바로 저장)
      if (v !== '1' && v !== '0') return true;
      await save(ctx, env, (chat) => (ppValue(chat.scriptstate, 'on') === v ? null : { [PP('on')]: v }));
      return true;
    case 'set-col':
      // 상태창 칸 사용·표시: 채팅 변수 + 바뀐 시점 기록 (파서가 옛 응답을 옛 구성으로 읽게)
      await save(ctx, env, (chat) => {
        const cfg = colConfig(chat.scriptstate);
        const hit = nextColMode(cfg, v);
        if (!hit) return null;
        const next = { ...cfg, [hit[0]]: hit[1] };
        return { [colVar(hit[0])]: hit[1], [COL_LOG_VAR]: withColLog(chat.scriptstate, (chat.message ?? []).length, usedCols(next)) };
      });
      return true;
    case 'set-wallet-start': {
      const n = parseWon(v);
      if (n === null || n < 0 || n > WALLET_MAX) {
        env.render();
        return true;
      }
      await save(ctx, env, (chat) => {
        // 이야기가 시작된 뒤에는 잔고 직접 수정이 켜져 있을 때만
        if (walletStarted(chat) && !walletEditable(chat.scriptstate)) return null;
        const w = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
        return w.start === n ? null : walletVars({ ...w, start: n });
      });
      return true;
    }
    case 'set-wallet-edit':
      if (v !== '1' && v !== '0') return true;
      await save(ctx, env, (chat) => (walletEditable(chat.scriptstate) === (v === '1') ? null : { [WALLET_EDIT_VAR]: v }));
      return true;
    case 'set-wallet-on':
      // 진행 중 가계부 켬/끔 (2026-11-07 사용자): 장부는 그대로 두고 상태창 잔고 칸만 그 시점부터 빼거나 되돌린다(칸 구성 기록에 남겨 옛 응답은 옛 구성으로 읽음).
      // 끄면 상점도 꺼지므로 이번 방문을 닫는다. 다시 켜면 끈 때 장부 잔고에서 이어 간다
      if (v !== '1' && v !== '0') return true;
      await save(ctx, env, (chat) => {
        const cfg = colConfig(chat.scriptstate);
        const mode: ColMode = v === '1' ? (cfg.wallet === 'off' ? 'on' : cfg.wallet) : 'off';
        if (mode === cfg.wallet) return null;
        const next = { ...cfg, wallet: mode };
        return { [colVar('wallet')]: mode, [COL_LOG_VAR]: withColLog(chat.scriptstate, (chat.message ?? []).length, usedCols(next)), ...(v === '0' ? { [SHOP_VAR]: '' } : {}) };
      });
      if (v === '0') {
        resetShop();
        await dropShopTags(ctx);
      }
      return true;
    case 'set-inv-on':
      // 진행 중 소지품 켬/끔 (2026-11-07 사용자): 물건 목록·기록은 지우지 않는다(다시 켜면 끈 때 그대로).
      // 끄면 「다음 메시지에 사용」을 비우고 상점 방문을 닫는다. 다시 켜면 첫 응답 전까지 [Inventory] 에 「그 사이 변화는 목록에 없다」를 붙인다
      if (v !== '1' && v !== '0') return true;
      await save(ctx, env, (chat): ScriptState | null => {
        if (invOn(chat.scriptstate) === (v === '1')) return null;
        return v === '0'
          ? { [ITEM_ON_VAR]: '0', [ITEM_USE_VAR]: '', [ITEM_USE_AT_VAR]: '', [SHOP_VAR]: '', [ITEM_RESUMED_VAR]: '' }
          : { [ITEM_ON_VAR]: '1', [ITEM_RESUMED_VAR]: (chat.message ?? []).length ? String((chat.message ?? []).length) : '' };
      });
      if (v === '0') {
        resetShop();
        await dropShopTags(ctx);
      }
      return true;
    case 'set-items-push':
    case 'set-items-auto': {
      if (v !== '1' && v !== '0') return true;
      const key = action === 'set-items-push' ? ITEM_PUSH_VAR : ITEM_AUTO_VAR;
      await save(ctx, env, (chat) => ((action === 'set-items-push' ? itemPushOn(chat.scriptstate) : itemAutoOn(chat.scriptstate)) === (v === '1') ? null : { [key]: v }));
      return true;
    }
    case 'set-items-slots':
      await save(ctx, env, (chat) => {
        const cur = itemSlots(chat.scriptstate);
        const next = Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, cur + (v.endsWith('+') ? 1 : -1)));
        return next === cur ? null : { [ITEM_SLOTS_VAR]: String(next) };
      });
      return true;
    case 'set-items-limit':
      await save(ctx, env, (chat) => {
        const next = v.replace(/\s+/g, ' ').trim().slice(0, 60);
        return next === String(chat.scriptstate?.[ITEM_LIMIT_VAR] ?? '') ? null : { [ITEM_LIMIT_VAR]: next };
      });
      return true;
    case 'set-anomaly':
      if (v === 'off') {
        if (!worldOn(ctx.chat)) return true;
        settingsUi.confirmOff = true;
        env.render();
        return true;
      }
      if (v === 'off-no') {
        settingsUi.confirmOff = false;
        env.render();
        return true;
      }
      settingsUi.confirmOff = false;
      if (v === 'off-yes') {
        await save(ctx, env, (chat) => (worldOn(chat) ? worldOffVars() : null));
        return true;
      }
      if (v === 'on') {
        await save(ctx, env, (chat) => {
          if (worldOn(chat)) return null;
          const faction = String(chat.scriptstate?.['$st_faction'] ?? '');
          return startWorldVars(parseCatalog(lore), worldSettings(lore, chat.scriptstate), faction, Math.random, String(chat.scriptstate?.['$st_player'] ?? ''));
        });
      }
      return true;
    case 'set-agent':
      await save(ctx, env, (chat) => {
        const cur = basicSettings(lore, chat.scriptstate).agentLimit;
        const next = Math.min(AGENT_MAX, Math.max(0, cur + (v.endsWith('+') ? 1 : -1)));
        if (next === cur) return null;
        const vars = withBasic(ctx, chat, { agentLimit: next });
        // 요원 보고(로어북이 읽는 $ag_report)도 새 인원으로 다시 만든다
        if (worldOn(chat)) {
          const ss = { ...(chat.scriptstate ?? {}), ...vars };
          Object.assign(vars, worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? '')));
        }
        return vars;
      });
      return true;
    case 'set-theme':
      if (v !== 'light' && v !== 'dark' && v !== 'paper') return true;
      await save(ctx, env, (chat) => (chat.scriptstate?.[THEME_KEY] === v ? null : { [THEME_KEY]: v }));
      return true;
    case 'set-support':
      await save(ctx, env, (chat) => withBasic(ctx, chat, { supportOn: v === '1' }));
      return true;
    case 'set-asset':
      await save(ctx, env, (chat) => withBasic(ctx, chat, { assetOn: v === '1' }));
      // 끄면 채팅 속 그림 칸도 바로 숨긴다
      if (setImgHidden(v !== '1')) repaintTheme();
      return true;
    case 'set-asset-model':
      if (v !== 'main' && v !== 'aux') return true;
      await save(ctx, env, (chat) => withBasic(ctx, chat, { assetModel: v }));
      return true;
    case 'set-asset-player':
      await save(ctx, env, (chat) => withBasic(ctx, chat, { assetPlayer: v === '1' }));
      return true;
    case 'set-asset-limit': {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 4) return true;
      await save(ctx, env, (chat) => withBasic(ctx, chat, { assetLimit: n }));
      return true;
    }
  }
  return false;
}
