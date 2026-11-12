// 「설정」 탭: 원본 설정 창의 동작·요원창·캐릭터 이미지 항목. 값은 이 채팅의 $st_* 변수에 두고,
// 범위: 이 채팅($st_*·$wg_*) / 새 채팅 기본값(플러그인 저장소) / 카드 명부(directory.ts, 카드 로어북).
import { ckWide, defRow, helpBox, numCtl, numSet, setGroup, setRow, stepSizeText, type CkActs, type CkBand, type CkNum, type RowScope } from './setrow';
import { SETTINGS_SET } from '../core/setdef/settings';
import { findDef } from '../core/setdef/types';
import { mallSettingsPane } from './malls';
import { homeshopSettingsPane } from './homeshop';
import { HS_LOG_KINDS, HS_MAIN_KEY, HS_MAIN_SET, hsMainSettings, type HsLogKind } from '../core/hslog';
import { SHOP_MAIN_KINDS, SHOP_MAIN_LINES, SHOP_MAIN_LINES_VAR, isShopPlace, shopMainKey, type ShopMainKind } from '../core/shopctx';
import { GUIDE_NAMES, setGuideOverride } from '../core/guides';
import { onOffSwitch, switchHtml } from './controls';
import { repaintTheme } from './theme';
import {
  AGENT_MAX, basicDefaults, DIM_DEFAULT, basicSettings, basicVars, type BasicSettings, getPrefs, isChatSettingVar, type Prefs, type StatusStyle, type Theme, WORLD_SPEC, type WorldField, wgKey, worldDefaults, worldSettings,
} from '../core/settings';
import type { WorldSettings } from '../core/world/engine';
import { loadVarDefaults, savePrefs, saveVarDefaults } from '../host/prefs';
import { activeBooksRow, advSections } from './advanced';
import { ASSET_NOTE } from '../core/asset';
import { IMG_FOLD, IMG_RECENT, IMG_SIZE, imgFold, imgRecent, imgSize, setImgHidden } from '../core/imgtag';
import type { Chat, ScriptState } from '../core/types';
import { parseCatalog, readWorld, startWorldVars, WORLD_KEY, worldOn, worldVars } from '../core/world';
import { AUTO, AUTO_HIDE, COL_LOG_VAR, colConfig, colVar, isPointsOrg, POINTS_ON_VAR, pointsAuto, STATUS_COLS, usedCols, withColLog, type ColConfig, type ColId, type ColMode } from '../core/world/statuscols';
import { pointsFlagFor } from '../core/points';
import { readIconMisses } from '../core/iconmatch';
import { aliasCanAdd, aliasChanged, aliasEdit, aliasRowBad, aliasShown, ALIAS_WORD_MAX } from '../core/aliasrows';
import { pairTable } from '../core/pairrows';
import { defStored } from '../core/deftext';
import { ITEM_LEFT_WORDS_DEFAULT, ITEM_LEFT_WORDS_VAR, ITEM_OFF_WORDS_DEFAULT, ITEM_OFF_WORDS_VAR, ITEM_RULES_DEFAULT, ITEM_RULES_VAR, ITEM_WORDS_MAX, parseItemRules } from '../core/itemrules';
import { ICON_KIND_LABEL, normIcon } from '../core/iconmatch';
import { keepOpen } from './panels';
import { invOn, ITEM_SCOPE_VAR, ITEM_SKIP_MAX, ITEM_SKIP_VAR, itemScope, itemSkip, ITEM_ICON_POOL_VAR, itemIconPoolOn, ITEM_AUTO_VAR, ITEM_DETAIL_VAR, ITEM_LOGTURNS_MAX, ITEM_LOGTURNS_VAR, ITEM_RESUMED_VAR, ITEM_SPENT_VAR, ITEM_START_VAR, ITEM_STATE_VAR, ITEM_USE_AT_VAR, ITEM_USE_VAR, itemDetail, itemLogTurns, itemStartOn, itemStateOn, ITEM_LIMIT_DEFAULT, ITEM_LIMIT_VAR, ITEM_ICON_ALIAS_VAR, ITEM_ON_VAR, ITEM_SLOTS_MAX, ITEM_SLOTS_MIN, ITEM_SLOTS_VAR, itemAutoOn, itemLimit, itemSlots, ITEM_CARRY_MAX, ITEM_CARRY_MIN, ITEM_CARRY_PC_VAR, ITEM_CARRY_VAR, ITEM_EDIT_VAR, itemCarrySetting, itemEditOn, itemWeight } from '../core/items';
import { SHOP_AMOUNTS, isGiveKey, isGiveShop, isShopAmount, isShopFn, shopFnNone, shopFnVar, shopGiveVar } from '../core/shopfn';
import { SHOP_COUNT_VAR, SHOP_CTX_VAR, SHOP_FEATURE_VAR, SHOP_MAX_VAR, SHOP_MIN_VAR, SHOP_SIZE_HI, SHOP_SIZE_LO, SHOP_DIVERSE_VAR, SHOP_KICK_VAR, SHOP_MODEL_VAR, SHOP_ON_VAR, SHOP_PREV_VAR, SHOP_PRICE_VAR, SHOP_REFS_VAR, SHOP_THOUGHTS_VAR, SHOP_TURNS_VAR, SHOP_VAR, SHOP_WHERE_VAR, SHOP_JUDGE_VAR, SHOP_OWN_VAR, OWN_MAX, ownShops, type OwnShop, shopJudgeBy, hasShopTag, shopSettings, stripShopTags } from '../core/shop';
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
  page: '' as '' | 'phone' | 'gnet' | 'gal' | 'wpf' | 'sm' | 'cos' | 'bm' | 'hs' | 'wiki' | 'people' | 'journal' | 'factions',
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
import { imgUi } from './imgprompt';
import { PP, ppValue } from '../core/people/settings';
import { phoneSettingsPane } from './phone';
import { gnetSettingsPane } from './gnet';
import { mallAutoKey, mallKey, mallSettings, type MallSite } from '../core/malls';
import { HS_KEY, hsKey, hsSettings } from '../core/homeshop';
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
/** 고유 상점 표 (11-09 사용자: 로어 고유 상점은 설정에서 따로 정한다, 하드코딩 금지). 줄마다 사용·이름·다른 이름·인터넷 사이트·직접 갔을 때 창 */
const OWN_WEB: [string, string][] = [['none', '없음'], ['cos', '우주 쇼핑몰'], ['bm', '백일몽 포인트몰'], ['hs', '망상홈쇼핑']];
const OWN_VISIT: [string, string][] = [['shop', '기본 상점창'], ['none', '열지 않음']];
function ownShopsField(vars: Record<string, unknown> | undefined, busy: boolean): string {
  const list = ownShops(vars);
  const text = (o: OwnShop, key: 'name' | 'alias', ph: string, len: number) =>
    `<input class="st-text" type="text" maxlength="${len}" value="${esc(o[key])}" data-change="set-own" data-key="${esc(o.id)}:${key}" placeholder="${ph}" aria-label="${ph}"${busy ? ' disabled' : ''}>`;
  const rows = list.map((o) => `<div class="ms-fx${o.on ? '' : ' off'}">
      <div class="ms-fx-head">${text(o, 'name', '상점 이름 (로어 이름 그대로)', 30)}${switchHtml({ action: 'set-own-on', value: o.on ? `${o.id}:0` : `${o.id}:1`, on: o.on, disabled: busy, label: `${o.name || '고유 상점'} 켜고 끄기` })}<button class="gx-mini danger" data-action="set-own-del" data-value="${esc(o.id)}" aria-label="지우기"${busy ? ' disabled' : ''}>×</button></div>
      <div class="ms-fx-row"><span class="ph-inline ms-fx-wide"><span>다른 이름</span>${text(o, 'alias', '쉼표로 나눠서 (예: 포인트몰, 복지몰)', 120)}</span></div>
      <div class="ms-fx-row"><span class="ph-inline"><span>인터넷 접속</span>${seg('set-own-web', `${o.id}:${o.web || 'none'}`, OWN_WEB.map(([v, l]) => [`${o.id}:${v}`, l]), busy)}</span></div>
      <div class="ms-fx-row"><span class="ph-inline"><span>직접 가면</span>${seg('set-own-visit', `${o.id}:${o.visit || 'none'}`, OWN_VISIT.map(([v, l]) => [`${o.id}:${v}`, l]), busy)}</span></div>
    </div>`).join('');
  const foot = `<div class="ps-row gw-rel-foot"><button class="gx-mini primary" data-action="set-own-add"${list.length >= OWN_MAX || busy ? ' disabled' : ''}>고유 상점 추가</button><button class="gx-mini" data-action="set-own-reset"${busy ? ' disabled' : ''}>기본 표로 되돌리기</button></div>`;
  return field('고유 상점', '', `로어에 있는, 자기 창이 따로 있는 상점이에요. 켜진 줄은 상점 판단 기준에 들어가요. 주인공이 그 사이트·앱에 실제로 접속해 있으면 응답 아래 「접속하기」가 붙고, 누르면 상황판 없이 인터넷 창만 그 사이트로 열려요. 직접 매장에 가 있으면 「직접 가면」에 고른 창이 열려요(열지 않음이면 안 열림). 표에 없는 편의점 같은 곳은 그대로 기본 상점창이에요.`) + rows + foot;
}

const field = (label: string, control: string, help: string, scope?: RowScope): string => setRow(label, control, help, '', scope);

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

const group = setGroup;
const RULES_TABLE = pairTable(ITEM_RULES_DEFAULT);
/** 판정 표: 그림 대체 말과 같은 접는 양식·같은 칸 (「종류·물건말 → 판정」) */
function rulesBlock(stored: unknown, busy: boolean): string {
  const def = findDef(SETTINGS_SET, 'items-rules')!;
  const rows = RULES_TABLE.shown(stored);
  const dis = busy ? ' disabled' : '';
  const used = parseItemRules(rows.map((r) => `${r.a} → ${r.b}`).join('\n'));
  const head = '<div class="ms-tb-h"><span>종류·물건말</span><span></span><span>판정</span><span></span></div>';
  const body = rows.map((r, i) => {
    // 읽는 쪽(core/itemrules parseItemRules)이 안 쓰는 줄: 칸이 비었거나 오른쪽에 판정 말이 없다
    const key = normIcon(r.a).replace(/ /g, '');
    const kindKey = Object.entries(ICON_KIND_LABEL).find(([, v]) => v === r.a.trim())?.[0];
    const ok = kindKey ? used.kinds.has(kindKey) : used.words.has(key);
    const bad = (r.a || r.b) && !ok ? (!r.a ? '종류·물건말이 비어 있어 이 줄은 안 쓰여요.' : !r.b ? '판정이 비어 있어 이 줄은 안 쓰여요.' : '판정은 무기·장비·사용·소모N이나 - 로 적어요. 이 줄은 안 쓰여요.') : '';
    return `<div class="ms-tb-r${bad ? ' bad' : ''}">
      <label class="ms-tb-c n"><span>종류·물건말</span><input class="gx-search" data-change="set-items-rules-cell" data-key="${i}:a" value="${esc(r.a)}" maxlength="${ALIAS_WORD_MAX}" aria-label="종류·물건말"${dis}></label>
      <i class="ms-arrow" aria-hidden="true">→</i>
      <label class="ms-tb-c n"><span>판정</span><input class="gx-search" data-change="set-items-rules-cell" data-key="${i}:b" value="${esc(r.b)}" maxlength="${ALIAS_WORD_MAX}" aria-label="판정"${dis}></label>
      <button class="gx-mini danger ms-tb-x" data-action="set-items-rules-del" data-value="${i}" aria-label="지우기"${dis}>×</button>
      ${bad ? `<p class="ms-tb-err">${bad}</p>` : ''}
    </div>`;
  }).join('');
  const changed = RULES_TABLE.changed(stored);
  const foot = `<div class="ms-tb-foot"><button class="gx-mini primary" data-action="set-items-rules-add"${busy || !RULES_TABLE.canAdd(stored) ? ' disabled' : ''}>추가</button>${changed ? `<button class="gx-mini" data-action="set-items-rules-reset"${dis}>기본값으로</button>` : ''}</div>`;
  const help = typeof def.help === 'string' ? def.help : '';
  return `<details class="ps-adv${changed ? ' ps-changed' : ''}" data-keep="items-rules"${keepOpen('items-rules')}><summary class="ps-adv-sum"><b>${esc(def.label)}</b><span class="adv-count">${rows.length}줄</span></summary><div class="ps-adv-body"><div class="ms-tb ms-pairs"><div class="ms-pg">${head}${rows.length > 1 ? head : ''}${body}</div>${foot}</div>${help ? `<p class="ps-note">${help}</p>` : ''}</div></details>`;
}
const wordsText = (v: string): string => v.replace(/\s+/g, ' ').trim().slice(0, ITEM_WORDS_MAX);
/** 그림 대체 말 표: 접는 덩어리 안에 줄마다 「끝 말 → 바꿀 말」 칸. PC 는 한 줄에 두 쌍, 폰은 한 쌍 (배치는 CSS .ms-pairs) */
function aliasBlock(stored: unknown, busy: boolean): string {
  const def = findDef(SETTINGS_SET, 'items-alias')!;
  const rows = aliasShown(stored);
  const dis = busy ? ' disabled' : '';
  const head = '<div class="ms-tb-h"><span>이름의 끝 말</span><span></span><span>바꿔 찾을 말</span><span></span></div>';
  const body = rows.map((r, i) => {
    const bad = r.a || r.b ? aliasRowBad(r) : '';
    return `<div class="ms-tb-r${bad ? ' bad' : ''}">
      <label class="ms-tb-c n"><span>이름의 끝 말</span><input class="gx-search" data-change="set-items-alias-cell" data-key="${i}:a" value="${esc(r.a)}" maxlength="${ALIAS_WORD_MAX}" aria-label="이름의 끝 말"${dis}></label>
      <i class="ms-arrow" aria-hidden="true">→</i>
      <label class="ms-tb-c n"><span>바꿔 찾을 말</span><input class="gx-search" data-change="set-items-alias-cell" data-key="${i}:b" value="${esc(r.b)}" maxlength="${ALIAS_WORD_MAX}" aria-label="바꿔 찾을 말"${dis}></label>
      <button class="gx-mini danger ms-tb-x" data-action="set-items-alias-del" data-value="${i}" aria-label="지우기"${dis}>×</button>
      ${bad ? `<p class="ms-tb-err">${bad}</p>` : ''}
    </div>`;
  }).join('');
  const changed = aliasChanged(stored);
  const foot = `<div class="ms-tb-foot"><button class="gx-mini primary" data-action="set-items-alias-add"${busy || !aliasCanAdd(stored) ? ' disabled' : ''}>추가</button>${changed ? `<button class="gx-mini" data-action="set-items-alias-reset"${dis}>기본값으로</button>` : ''}</div>`;
  const help = typeof def.help === 'string' ? def.help : '';
  return `<details class="ps-adv${changed ? ' ps-changed' : ''}" data-keep="items-alias"${keepOpen('items-alias')}><summary class="ps-adv-sum"><b>${esc(def.label)}</b><span class="adv-count">${rows.length}줄</span></summary><div class="ps-adv-body"><div class="ms-tb ms-pairs"><div class="ms-pg">${head}${rows.length > 1 ? head : ''}${body}</div>${foot}</div>${help ? `<p class="ps-note">${help}</p>` : ''}</div></details>`;
}


/** 상태창 칸 표 (설계안 7절): 칸마다 사용·표시. 날짜·시각·위치는 사용을 끌 수 없다. 플러그인이 쓰는 칸은 끄면 그 기능도 꺼진다고 알린다 */
function statusColsTable(cfg: ColConfig, busy: boolean, vars: Record<string, unknown> | undefined): string {
  const rows = STATUS_COLS.map((c) => {
    const m = cfg[c.id];
    // 포인트 칸은 「자동」(기본): 신분이 백일몽일 때만 사용 (2026-11-08 사용자)
    const auto = c.id === 'points' && pointsAuto(vars);
    const useOpts: [string, string][] = c.id === 'points' ? [['a', '자동'], ['1', '사용'], ['0', '사용 안 함']] : [['1', '사용'], ['0', '사용 안 함']];
    const use = seg('set-col', auto ? 'a' : m === 'off' ? '0' : '1', useOpts, busy || c.locked).replace(/data-value="([a\d])"/g, `data-value="${c.id}:use:$1"`);
    const showOn = auto ? vars?.[colVar('points')] !== AUTO_HIDE : m === 'on';
    const show = seg('set-col', showOn ? '1' : '0', [['1', '표시'], ['0', '숨김']], busy || (m === 'off' && !auto)).replace(/data-value="(\d)"/g, `data-value="${c.id}:show:$1"`);
    const hint = c.locked ? '늘 사용' : c.id === 'points' ? '자동: 신분이 백일몽일 때만 사용' : c.feature ? `끄면 ${c.feature}도 꺼져요` : '';
    return `<div class="st-col-row${m === 'off' ? ' off' : ''}"><div class="st-col-name"><b>${c.label}</b>${hint ? `<small>${hint}</small>` : ''}</div>${use}${show}</div>`;
  });
  // 사용 중인 칸 전부 표시·숨김 (2026-11-08 사용자: 칸별 표시에 더해 일괄)
  const used = STATUS_COLS.filter((c) => cfg[c.id] !== 'off');
  const allCur = used.every((c) => cfg[c.id] === 'on') ? '1' : used.every((c) => cfg[c.id] === 'hide') ? '0' : '';
  const all = seg('set-col', allCur, [['1', '전부 표시'], ['0', '전부 숨김']], busy || !used.length).replace(/data-value="(\d)"/g, 'data-value="all:show:$1"');
  const head = `<div class="st-col-row st-col-all"><div class="st-col-name"><b>모든 칸</b><small>사용 중인 칸을 한 번에 표시하거나 숨겨요</small></div>${all}</div>`;
  return `<div class="st-cols ps-row-block">${head}${rows.join('')}</div>`;
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

function stepper(action: string, key: string, shown: string, canDown: boolean, canUp: boolean, label: string, busy: boolean, sizes: string[] = []): string {
  return `<div class="st-step${stepSizeText(shown, ...sizes)}"><button class="gx-step" data-action="${action}" data-value="${key}:-" ${!canDown || busy ? 'disabled' : ''} aria-label="${esc(label)} 줄이기">−</button>
    <b>${esc(shown)}</b><button class="gx-step" data-action="${action}" data-value="${key}:+" ${!canUp || busy ? 'disabled' : ''} aria-label="${esc(label)} 늘리기">+</button></div>`;
}

/** 괴이 생성 수치 한 칸의 증감 폭 */
function worldStep(key: WorldField['key']): number {
  if (key.endsWith('_p') || key === 'landmark_share') return 10;
  if (key.endsWith('_ttl')) return 6;
  return 1;
}

/** 괴이 발생: 종류 넷이 같은 값을 가지니 격자 하나로 (줄 = 종류, 열 = 값. 인터넷·상점 격자와 같은 틀).
 *  버튼은 set-world 에 「열쇠=값」(수) · 「열쇠:값」(켬·끔)을 보낸다 */
const WORLD_ACTS: CkActs = { set: 'set-world', num: 'set-world', rel: true };
const WORLD_KINDS: ['preset' | 'random' | 'incident' | 'mystic', string][] = [['preset', '프리셋 괴이'], ['random', '랜덤 괴이'], ['incident', '사건'], ['mystic', '특수']];
const worldNum = (w: WorldSettings, key: WorldField['key']): CkNum => ({ n: w[key], lo: 0, hi: WORLD_SPEC.find((x) => x.key === key)?.max ?? 99, step: worldStep(key) });
function worldGrid(w: WorldSettings, busy: boolean): string {
  const band: CkBand = {
    title: '괴이 발생',
    groups: [
      { name: '동시 최대', opts: ['개'], kind: 'num' },
      { name: '발생 확률', opts: ['%'], kind: 'num' },
      { name: '자동 종료', opts: ['켬'], kind: 'check' },
      { name: 'RP 유지 시간', opts: ['시간'], kind: 'num' },
    ],
    marks: WORLD_KINDS.map(([k]) => [worldNum(w, `${k}_cap`), worldNum(w, `${k}_p`), w[`${k}_expire`] === 1, w[`${k}_expire`] === 1 ? worldNum(w, `${k}_ttl`) : null]),
    acts: WORLD_KINDS.map(([k]) => [`${k}_cap`, `${k}_p`, `${k}_expire:${w[`${k}_expire`] === 1 ? 0 : 1}`, `${k}_ttl`]),
    foot: helpBox('응답을 처리할 때마다 판정해요.', [
      ['동시 최대', '같은 때에 살아 있을 수 있는 수예요. 0이면 그 종류는 저절로 생기지 않아요.'],
      ['발생 확률', '응답 하나를 처리할 때 새로 생길 확률이에요.'],
      ['자동 종료', '켜면 RP 유지 시간이 지났을 때 플러그인이 끝내요. 끄면 모델이 끝낼 때까지 남아요.'],
      ['RP 유지 시간', '생긴 뒤 이야기 속 시간으로 이만큼 지나면 끝나요. 모델이 먼저 끝내면 그때 끝나요. 자동 종료가 꺼져 있으면 쓰지 않아 「–」로 보여요.'],
    ]),
  };
  const n = (key: WorldField['key'], aria: string, unit: string) => numCtl(key, worldNum(w, key), aria, unit, busy, WORLD_ACTS);
  return `${ckWide([band], WORLD_KINDS.map(([, name]) => name), busy, WORLD_ACTS)}
    ${group('', [
      field('사건의 거점 비율', n('landmark_share', '사건의 거점 비율', '%'), '사건이 생길 때 등록된 거점(본부·지사 같은 장소)에서 생길 비율이에요. 나머지는 지도의 아무 곳에서 생겨요.'),
      field('추가 발생 여유분', numSet([['괴이', n('extra_cap', '괴이 여유분', '개')], ['사건', n('extra_in_cap', '사건 여유분', '개')], ['특수', n('extra_ms_cap', '특수 여유분', '개')]]), '직접 고르거나 RP 중에 새로 등장한 것을 동시 최대와 따로 기록할 수 있는 수예요.'),
    ].join(''))}`;
}

// v0.16.23 (사용자 설계): 「이 채팅 / 새 채팅 기본값」으로 같은 설정을 두 벌 두지 않는다. 설정은 하나(지금 채팅)이고,
// 「기본값으로 저장」을 누르면 지금 값이 새 채팅 기본값이 된다. 채팅을 시작하기 전에는 기본값을 바로 고친다.

// 위쪽 줄 하나 (v0.16.25, 사용자 설계): [설정|명부] 전환 + 「덮어쓰기」「불러오기」 (전환보다 한 단계 작게). 설정에서는 새 채팅 기본값을,
// 명부에서는 카드 로어북을 저장하고 불러온다. 누르면 확인을 한 번 더 받는다.
/** 점검 「초기화」 때 같이 되돌릴 것 (세계 편집기가 고친 세계를 비우고 카드에 적는다) */
export const resetHooks: (() => void)[] = [];

const CONFIRM: Record<'chat' | 'card', Record<'save' | 'load' | 'reset', [string, string]>> = {
  chat: {
    save: ['지금 설정을 기본값으로 저장할까요? 저장해 둔 기본값을 덮어써서, 앞으로 새로 시작하는 모든 채팅이 이 값으로 시작해요. 덮어쓴 기본값은 되돌릴 수 없어요.', '기본값으로 저장'],
    load: ['저장해 둔 기본값을 지금 채팅에 불러올까요? 지금 채팅의 설정이 기본값으로 바뀌어요. 상황판 켜기·끄기는 그대로 둬요.', '불러오기'],
    reset: ['지금 채팅의 설정과 저장해 둔 기본값, 고친 지침과 세계를 모두 버리고 플러그인 원래 값으로 초기화할까요? 상황판 켜기·끄기는 그대로 둬요.', '초기화'],
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

/** 불러오기 뒤의 「되돌리기」 띠: 보관해 둔 값이 이 채팅 것일 때만 */
export function undoBar(ctx: ChatContext): string {
  const u = settingsUi.undo;
  if (!u || u.charIndex !== ctx.charIndex || u.chatIndex !== ctx.chatIndex || settingsUi.confirm) return '';
  return `<div class="st-confirm st-undobar ps-defconfirm"><p>불러오기·초기화 전 채팅 설정을 보관해 뒀어요. 되돌리면 그때 값으로 돌아가요. (기본값·지침은 되돌아오지 않아요)</p><div class="gx-row-btns"><button class="gx-mini ps-save" data-action="set-bar-undo" ${settingsUi.busy ? 'disabled' : ''}>${ICONS.back}그 전으로 되돌리기</button><button class="gx-mini" data-action="set-bar-undo-drop">보관한 것 버리기</button></div></div>`;
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
  const raw = page === 'phone' ? phoneSettingsPane(ctx) : page === 'gnet' ? gnetSettingsPane(ctx, 'gn') : page === 'gal' || page === 'wpf' || page === 'sm' ? gnetSettingsPane(ctx, page) : page === 'cos' || page === 'bm' ? mallSettingsPane(ctx, page) : page === 'hs' ? homeshopSettingsPane(ctx) : page === 'people' ? peopleSettingsPane(ctx, canChat) : page === 'factions' ? peopleFactionPane(ctx, canChat) : page === 'journal' ? journalSettingsPane(ctx, canChat) : wikiSettingsPane(ctx);
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
  const on = scope === 'chat' ? worldOn(ctx.chat) : s.anomalyOn;
  const busy = settingsUi.busy;
  // 줄 이름·선택지·고정 설명은 정의표(core/setdef/settings.ts)에서 온다. 여기는 지금 값과, 값에 따라 달라지는 조작·설명만 넘긴다
  const D = (key: string, cur: string, o: { ctl?: string; help?: string; scope?: RowScope } = {}): string => {
    const def = findDef(SETTINGS_SET, key)!;
    return defRow(SETTINGS_SET, o.scope ? { ...def, scope: o.scope } : def, {
      cur: () => cur, busy,
      ...(o.ctl !== undefined ? { custom: { [key]: () => ({ ctl: o.ctl!, ...(o.help !== undefined ? { help: o.help } : {}) }) } } : {}),
      ...(o.help !== undefined ? { help: { [key]: () => o.help! } } : {}),
    });
  };
  const anomaly = settingsUi.confirmOff && scope === 'chat'
    ? `<div class="st-confirm"><p>끄면 지금 상황판의 괴이·사건·특수·요원 상태를 비워요. 다시 켜도 이전 상태는 돌아오지 않아요.</p>
        <div class="gx-row-btns"><button class="gx-mini danger" data-action="set-anomaly" data-value="off-yes" ${busy ? 'disabled' : ''}>끄기</button>
        <button class="gx-mini" data-action="set-anomaly" data-value="off-no">취소</button></div></div>`
    // 이 채팅에서 끄면 상황판 상태를 비우고(되돌릴 수 없음) 한 번 묻는다 → AI 상담은 이 조작을 누르지 않는다 (ui/editor/catalog.ts)
    : scope === 'chat' ? `<span data-consult="no" style="display:contents">${seg('set-anomaly', on ? 'on' : 'off', [['on', 'ON'], ['off', 'OFF']], busy)}</span>` : seg('set-anomaly', on ? 'on' : 'off', [['on', 'ON'], ['off', 'OFF']], busy);
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
    screen: `${group('', [
      // 테마는 채팅마다 ($st_fixed_theme, 원본 ensureDefaults) — 시작 뒤엔 이 채팅, 시작 전엔 새 채팅 기본값 (2026-10-28 QC: 「이 기기」 배지가 붙어 있었지만 실제로는 채팅에 저장됐다)
      D('theme', theme, { help: `채팅 화면의 캐릭터 이미지 배경과 상태창(「테마」를 골랐을 때) 배색이에요. ${scope === 'chat' ? '이 채팅에 저장돼요. 새 채팅의 기본값은 시작 화면의 설정에서 정해요.' : '새 채팅이 시작할 때 쓸 배색이에요.'}`, scope: scope === 'chat' ? 'chat' : 'defaults' }),
      D('nav', getPrefs().nav ?? 'left'),
      D('wiki-side', getPrefs().wikiSide ?? 'right'),
      D('agents', getPrefs().agents ?? 'wall'),
      D('dim', '', { ctl: dimSlider(getPrefs().dim ?? DIM_DEFAULT, busy) }),
      // 호출 진행 창 (11-09 사용자): 채팅을 보내면 라우터→디렉터→메인→갱신기→인터넷이 어디까지 돌았는지 (host/progwin.ts)
      D('progress', getPrefs().progress === false ? '0' : '1'),
      // 창 둘레 기기 틀 (2026-10-29 사용자, ui/frame.ts). 좁아서 숨긴 상태는 app.ts 가 .gx 에 data-frame-hidden 으로 적는다
      D('frame', getPrefs().frame ?? 'tablet', { help: `PC에서 상황판 창 둘레에 그리는 기기 틀로, 폰에서는 그리지 않고 창 폭이 모자라면 자동으로 숨겨요.${document.querySelector<HTMLElement>('.gx')?.dataset.frameHidden === '1' ? '<br><span class="st-frame-note">지금 창 폭이 좁아 프레임을 숨겼어요</span>' : ''}` }),
      D('editor-width', String(getPrefs().editorWidth ?? 90)),
    ].join(''))}`,
    image: `${group('', [
      D('asset', s.assetOn ? '1' : '0'),
      s.assetOn ? D('asset-model', s.assetModel) : '',
      s.assetOn && s.assetModel === 'aux' ? D('asset-limit', String(s.assetLimit)) : '',
      s.assetOn ? D('asset-player', s.assetPlayer ? '1' : '0') : '',
      s.assetOn ? D('img-send', '', { ctl: recentControl('img-send', getPrefs().imgSend, '태그를 남길 메시지 수', busy) }) : '',
    ].join(''))}
    ${scope === 'chat' && s.assetOn && s.assetModel === 'aux' && note ? `<p class="gx-hint">최근 보충: ${esc(note)}</p>` : ''}
    ${s.assetOn ? group('그림 표시', [
      D('img-size', '', { ctl: pctSlider('set-img-size', getPrefs().imgSize ?? IMG_SIZE.def, IMG_SIZE, '이미지 크기', busy) }),
      D('img-foldon', getPrefs().imgFoldOn === false ? '0' : '1'),
      getPrefs().imgFoldOn !== false ? D('img-foldlock', getPrefs().imgFoldLock ? '0' : '1') : '',
      getPrefs().imgFoldOn !== false ? D('img-fold', '', { ctl: pctSlider('set-img-fold', getPrefs().imgFold ?? IMG_FOLD.def, IMG_FOLD, '접힌 높이', busy) }) : '',
      D('img-show', '', { ctl: recentControl('img-show', getPrefs().imgShow, '이미지 표시 메시지 수', busy) }),
    ].join('')) : ''}`,
    board: `${group('', [
      D('anomaly', '', { ctl: anomaly, help: scope === 'chat' ? '켜면 괴이·사건·특수가 저절로 생기고 응답마다 지도와 요원 상태를 갱신해요. 끄면 지금 상황판을 비워요. 커스텀 임무는 꺼져 있어도 쓸 수 있어요.' : '새 채팅을 상황판을 켠 채로 시작할지 정해요.' }),
      D('agent', '', { ctl: stepper('set-agent', 'n', `${s.agentLimit}명`, s.agentLimit > 0, s.agentLimit < AGENT_MAX, '요원 표시 인원', busy, [`${AGENT_MAX}명`]), help: `상황판과 편성에 보일 등록 요원 수 (0~${AGENT_MAX}명, 0이면 숨김)` }),
      D('support', s.supportOn ? '1' : '0'),
    ].join(''))}
    ${worldGrid(world, busy)}`,
    // 상태창: 배색(이 기기)과 칸 구성(이 채팅). 2026-10-29 사용자: 상황판 페이지에 섞여 있던 것을 따로 뺌
    status: `${group('', [
      D('status', getPrefs().status ?? 'auto'),
    ].join(''))}
    ${group(`칸 <small>${usedCols(colCfg).length}칸 사용</small>`, statusColsTable(colCfg, busy, scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars),
      `응답 끝의 상태 태그 <code>[▣|…]</code>에 들어가는 칸이에요. 「안 씀」으로 하면 태그에서 그 칸이 빠지고(모델에 모양을 알려 줘요), 「숨김」은 태그에는 두고 채팅 속 상태창 상자에서만 가려요.${scope === 'chat' ? ' 바꾼 구성은 이 채팅에 바로 적용되고 바뀐 시점이 기록돼요.' : ' 새 채팅의 기본 구성이에요.'}`)}
`,
    // 가계부(시작 잔고·잔고 직접 수정): 설정 「기록」 페이지 안의 묶음 (2026-11-05 사용자: 가계부가 기록 하위 탭이니 상태창에는 잔고 칸 표시만)
    // 2026-11-07 사용자: 가계부·소지품·상점 설정을 「소지품」 한 페이지로, 켜고 끄기는 따로 (가계부 = 상태창 잔고 칸 $st_col_wallet)
    wallet: [
      group('가계부', [
        D('wallet-on', colCfg.wallet === 'off' ? '0' : '1'),
        ...(colCfg.wallet === 'off' ? [] : [
          D('wallet-loose', walletLoose(itVars) ? '1' : '0'),
          D('wallet-recent', '', { ctl: stepper('set-wallet-recent', 'n', `${walletRecentN(itVars)}줄`, walletRecentN(itVars) > 0, walletRecentN(itVars) < WALLET_RECENT_MAX, '최근 거래 줄 수', busy, [`${WALLET_RECENT_MAX}줄`]), help: `메인 요청의 지난 상태창 아래에 최근 거래를 몇 줄 붙일지예요(0~${WALLET_RECENT_MAX}, 0이면 안 붙여요). 모델이 돈이 어디로 갔는지 알고 이어 써요.` }),
        ]),
      ].join('')),
      colCfg.wallet === 'off' ? '' : group('잔고', [
        D('wallet-start', '', { ctl: wonInput(walletStart, busy, startLocked), help: scope === 'chat' ? `이 채팅 가계부의 시작 잔고예요. 지금 잔고 ${esc(formatWon(walletNow))}. 거래 내역은 소지품 → 가계부에서.${startLocked ? ' 이야기가 시작돼서 잠겼어요(아래 「잔고 직접 수정」을 켜면 바꿀 수 있어요).' : ''}` : '새 채팅 가계부의 시작 잔고예요. 거래는 인물 기록 갱신기가 본문에서 금액이 적힌 것만 뽑아 더하고 빼요.' }),
        D('wallet-edit', walletEdit ? '1' : '0'),
        D('wallet-sync', walletSyncOn(itVars) ? '1' : '0'),
      ].join('')),
    ].join(''),
    // 소지품 (2026-11-07): 메인 요청에 넘기기·보조 모델 읽기·칸 수·한계 문장. 채팅 변수 $it_* 또는 새 채팅 기본값
    items: [
      group('', [
        D('inv-on', invOn(itVars) ? '1' : '0'),
        ...(!invOn(itVars) ? [] : [
          D('items-auto', '', { ctl: `<span class="ph-inline">${seg('set-items-auto', itemAutoOn(itVars) ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy)}<button class="gx-mini" data-action="ed-node" data-value="set:people">갱신기 설정 →</button></span>` }),
          D('items-state', itemStateOn(itVars) ? '1' : '0'),
          ...(!itemAutoOn(itVars) ? [] : [
            D('items-scope', itemScope(itVars)),
            D('items-skip', '', { ctl: `<input class="st-text" type="text" maxlength="${ITEM_SKIP_MAX}" value="${esc(itemSkip(itVars))}" data-change="set-items-skip" aria-label="만들지 않을 것"${busy ? ' disabled' : ''}>` }),
          ]),
        ]),
      ].join('')),
      ...(!invOn(itVars) ? [] : [
        group('컨텍스트 포함', [
          D('items-detail', itemDetail(itVars)),
          D('items-logturns', '', { ctl: stepper('set-items-logturns', 'n', `${itemLogTurns(itVars)}턴`, itemLogTurns(itVars) > 0, itemLogTurns(itVars) < ITEM_LOGTURNS_MAX, '기록 턴 수', busy, [`${ITEM_LOGTURNS_MAX}턴`]), help: `최근 몇 턴 동안 얻고·쓰고·버리고·잃은 기록을 [Inventory] 에 「Recently」 한 줄로 붙일지예요(0~${ITEM_LOGTURNS_MAX}, 0이면 안 붙여요).` }),
          D('items-limit', '', { ctl: `<input class="st-text" type="text" maxlength="60" value="${esc(itemLimit(itVars))}" data-change="set-items-limit" placeholder="${esc(ITEM_LIMIT_DEFAULT)}" aria-label="지닐 수 있는 한계"${busy ? ' disabled' : ''}>` }),
        ].join('')),
        group('칸과 물건', [
          D('items-slots', '', { ctl: stepper('set-items-slots', 'n', `${itemSlots(itVars)}칸`, itemSlots(itVars) > ITEM_SLOTS_MIN, itemSlots(itVars) < ITEM_SLOTS_MAX, '칸 수', busy, [`${ITEM_SLOTS_MAX}칸`]), help: `소지품 칸이에요(${ITEM_SLOTS_MIN}~${ITEM_SLOTS_MAX}). 넘쳐도 막지 않고 「17/16」처럼 보여 주며 그대로 메인 요청에 넘겨요.` }),
          D('items-carry', '', { ctl: stepper('set-items-carry', 'n', `${itemCarrySetting(itVars)}kg`, itemCarrySetting(itVars) > ITEM_CARRY_MIN, itemCarrySetting(itVars) < ITEM_CARRY_MAX, '소지 한도', busy, [`${ITEM_CARRY_MAX}kg`]), help: `들 수 있는 무게예요(${ITEM_CARRY_MIN}~${ITEM_CARRY_MAX}kg). 장착한 것까지 모든 물건의 무게를 더해 보여 주고, 넘으면 넘은 만큼 색이 진해져요. 막지는 않고, 메인 요청에는 넘었는지·얼마나 넘었는지만 넘겨요. 고유 인물로 시작하면 명부의 「소지 한도」를 쓰고, 값이 없을 때만 이 값을 써요.${scope === 'chat' && itemWeight(itVars?.[ITEM_CARRY_PC_VAR]) ? ` 이 채팅은 명부 값 ${itemWeight(itVars?.[ITEM_CARRY_PC_VAR])}kg을 써요.` : ''}` }),
          D('items-edit', itemEditOn(itVars) ? '1' : '0'),
          D('items-spent', itemsUiSpent(itVars)),
          D('items-start', itemStartOn(itVars) ? '1' : '0'),
          D('items-left-words', String(itVars?.[ITEM_LEFT_WORDS_VAR] ?? '')),
          D('items-off-words', String(itVars?.[ITEM_OFF_WORDS_VAR] ?? '')),
        ].join('')).replace(/<\/section>\s*$/, `${rulesBlock(itVars?.[ITEM_RULES_VAR], busy)}</section>`),
        // 그림 대체 말은 줄이 많아(기본 32줄) 접어 둔다 (11-12 사용자). 묶음의 줄들 아래, 고급 설정과 같은 접는 양식
        `<section class="ps-group"><h3>물건 그림</h3><div class="ps-rows">${[
          D('items-pool', itemIconPoolOn(itVars) ? '1' : '0'),
          ...(scope === 'chat' ? [D('items-misses', '', { ctl: (() => { const m = readIconMisses(); return m.length ? `<div class="st-misses">${m.slice().reverse().map((x) => `<div>${esc(x.name)}${x.icon ? ` <small>(${esc(x.icon)})</small>` : ''} → 상자</div>`).join('')}</div>` : '<small>이번에 켠 뒤로 없어요.</small>'; })() })] : []),
        ].join('')}</div>${aliasBlock(itVars?.[ITEM_ICON_ALIAS_VAR], busy)}</section>`,
      ]),
    ].join(''),
    // 상점 (2026-11-07 사용자): 표식 `[shop: 가게|주인]` 으로 열리는 상점 팝업의 생성 방식. 채팅 변수 $sh_* 또는 새 채팅 기본값
    shop: (() => {
      const sh = shopSettings(itVars);
      return [
        ...(sh.on ? [
          group('열리는 조건', [
          (() => {
            // 상점 판단 (11-09 사용자): 누가 「지금 상점이 있나」를 정하나. 갱신기를 골랐는데 갱신기가 매 턴 돌지 않으면 메인 모델이 대신한다
            const j = shopJudgeBy(itVars);
            const now = j.fallback ? '지금은 갱신기가 안 돌아 메인 모델로 대신합니다.' : `지금은 ${j.by === 'updater' ? '갱신기' : '메인 모델'}가 판단해요.`;
            return D('shop-judge', sh.judge, { help: `지금 장면에 상점이 있는지 누가 볼지예요. 메인 모델은 본문을 쓰면서 응답 끝에 표식을 같이 써요(추가 호출 없음). 갱신기는 응답이 끝난 뒤 인물 기록 갱신 호출에서 따로 판단해요(카드가 조금 늦게 붙어요). 자동은 갱신기가 매 턴 돌면 갱신기, 아니면 메인 모델이에요. 판단 기준은 지침 「상점」의 SHOP_RULE 한 곳을 양쪽이 같이 읽어요. ${now}` });
          })(),
            D('shop-where', sh.where),
            ownShopsField(itVars, busy),
          ].join('')),
        ] : []),
      ].join('');
    })(),
    // 로어북 호출: 고급에서 따로 뺀 페이지 (2026-11-05 사용자)
    lore: (() => {
      const st = scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars;
      return advSections('gen', st, {}, [1], true, { 1: activeBooksRow({ char: ctx.char, chat: ctx.chat }, st) });
    })(),
    adv: `${advSections('gen', scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars, {}, [0], true)}`,
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

/** 설정을 한꺼번에 바꿀 때(기본값 불러오기·초기값으로·되돌리기, 11-08 전수점검): 한 칸씩 바꿀 때 하던 뒷정리를 같이 한다.
 *  상태창 칸 구성이 바뀌면 바뀐 시점 기록, 소지품이 꺼지면 「사용」 자리 비움, 다시 켜지면 「그 사이 변화는 목록에 없다」, 상점이 꺼지면 이번 방문 닫기.
 *  prev = 지금 채팅 변수, next = 바뀐 뒤 변수 전부. 돌려주는 값을 바꿀 변수에 더한다. shopOff 면 저장 뒤 resetShop·dropShopTags */
function bulkSideVars(chat: Chat, prev: ScriptState | undefined, next: ScriptState): { vars: ScriptState; shopOff: boolean } {
  const vars: ScriptState = {};
  const n = (chat.message ?? []).length;
  const before = usedCols(colConfig(prev));
  const after = usedCols(colConfig(next));
  if (before.join() !== after.join()) vars[COL_LOG_VAR] = withColLog(prev, n, after);
  if (invOn(prev) && !invOn(next)) Object.assign(vars, { [ITEM_USE_VAR]: '', [ITEM_USE_AT_VAR]: '', [ITEM_RESUMED_VAR]: '' });
  else if (!invOn(prev) && invOn(next)) vars[ITEM_RESUMED_VAR] = n ? String(n) : '';
  const shopOff = shopSettings(prev).on && !shopSettings(next).on;
  if (shopOff) vars[SHOP_VAR] = '';
  return { vars, shopOff };
}

const itemsUiSpent = (vars: Record<string, unknown> | undefined) => (vars?.[ITEM_SPENT_VAR] === 'keep' ? 'keep' : 'remove');
/** 소지품·가계부 단순 옵션: 켬/끔·고르기(values) 또는 −/+ 숫자(max·num) */
const INV_OPTS: Record<string, { key: string; values: string[]; max?: number; num?: (vars: Record<string, unknown> | undefined) => number }> = {
  'set-items-start': { key: ITEM_START_VAR, values: ['1', '0'] },
  'set-items-detail': { key: ITEM_DETAIL_VAR, values: ['full', 'state', 'name'] },
  'set-items-state': { key: ITEM_STATE_VAR, values: ['1', '0'] },
  'set-items-scope': { key: ITEM_SCOPE_VAR, values: ['narrow', 'mid', 'wide'] },
  'set-items-edit': { key: ITEM_EDIT_VAR, values: ['1', '0'] },
  'set-items-pool': { key: ITEM_ICON_POOL_VAR, values: ['1', '0'] },
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
/** 「모든 칸」 표시·숨김 (v = all:show:1|0): 사용 중인 칸 가운데 바뀌는 것만 {변수: 값}. 포인트 칸이 자동이면 자동은 그대로 두고 표시만 */
function allShowVars(cfg: ColConfig, v: string, vars?: Record<string, unknown>): Record<string, string> | null {
  if (v !== 'all:show:1' && v !== 'all:show:0') return null;
  const to: ColMode = v.endsWith('1') ? 'on' : 'hide';
  const out: Record<string, string> = Object.fromEntries(STATUS_COLS.filter((c) => !(c.id === 'points' && pointsAuto(vars)) && cfg[c.id] !== 'off' && cfg[c.id] !== to).map((c) => [colVar(c.id), to]));
  if (pointsAuto(vars)) {
    const want = to === 'on' ? AUTO : AUTO_HIDE;
    if ((vars?.[colVar('points')] === AUTO_HIDE ? AUTO_HIDE : AUTO) !== want) out[colVar('points')] = want;
  }
  return out;
}

/** 포인트 칸 (v = points:use:a|1|0 / points:show:1|0) → 새 변수 값. 자동이면 표시·숨김도 자동 안에서. 바뀔 게 없으면 null */
function pointsColVar(vars: Record<string, unknown> | undefined, v: string): string | null {
  const [id, what, val] = v.split(':');
  if (id !== 'points') return null;
  const raw = vars?.[colVar('points')];
  const auto = pointsAuto(vars);
  const hidden = auto ? raw === AUTO_HIDE : raw === 'hide';
  let next: string | null = null;
  if (what === 'use') next = val === 'a' ? (hidden ? AUTO_HIDE : AUTO) : val === '1' ? (hidden ? 'hide' : 'on') : val === '0' ? 'off' : null;
  else if (what === 'show' && (val === '1' || val === '0')) next = auto ? (val === '1' ? AUTO : AUTO_HIDE) : raw === 'off' ? null : val === '1' ? 'on' : 'hide';
  const cur = typeof raw === 'string' && raw ? raw : AUTO;
  return next === null || next === cur ? null : next;
}

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

/** 설정 → 상점의 격자와 그 아래 줄 (fam-* 의 상점 쪽). col = 기본 상점·쇼핑몰 둘·망상홈쇼핑.
 *  네 곳이 같이 쓰는 값(생각 단계·다양성 강화·지난 목록 피하기)과 거래 끊음은 기본 상점 자리($sh_*) 하나.
 *  넘길 내용·맥락 반영은 가게 표(가게마다)와 기능 표($sh_fn_*, 세 가게가 한 값), 챗로그·참조 로어북 수는 양 표 (core/shopfn.ts) */
export type ShopCol = 'shop' | MallSite | 'hs';
export async function shopFamSet(ctx: ChatContext, env: SettingsEnv, scope: 'chat' | 'defaults', col: ShopCol, key: string, raw: string): Promise<boolean> {
  const vars = scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate;
  const name = (sh: string) => (col === 'shop' ? sh : col === 'hs' ? hsKey(sh) : mallKey(sh, col));
  const cur = col === 'shop' ? shopSettings(vars) : col === 'hs' ? hsSettings(vars).shop : mallSettings(vars, col);
  const flag = raw === '1' || raw === '0';
  const int = (lo: number, hi: number): number | null => { const n = Math.round(Number(raw)); return raw.trim() !== '' && Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; };
  let patch: Record<string, string> | null = null;
  if (key === 'on') {
    // 기본 상점을 끄면 진행 중 방문을 닫아야 해서 원래 처리기로
    if (col === 'shop' && flag) return handleSettings('set-shop-on', raw, ctx, env, scope);
    if (col === 'hs' && flag) patch = { [HS_KEY.on]: raw };
  } else if (key === 'auto') {
    if ((col === 'cos' || col === 'bm') && ['manual', 'open', 'turn'].includes(raw)) patch = { [mallAutoKey(col)]: raw };
    else if (col === 'hs' && (raw === 'manual' || raw === 'open')) patch = { [HS_KEY.auto]: raw };
  } else if (key === 'model') {
    if (raw === 'main' || raw === 'aux') patch = { [name(SHOP_MODEL_VAR)]: raw };
  } else if (key === 'feature') {
    if (col !== 'hs' && flag) patch = { [name(SHOP_FEATURE_VAR)]: raw };
  } else if (key === 'main' || key.startsWith('main_')) {
    // 메인 요청에 붙이는 것 (core/shopctx.ts): 가게마다 「컨텍스트 포함」과 붙일 것, 세 곳이 같이 쓰는 「최대 양」
    const kind = key.slice(5) as ShopMainKind;
    if (col === 'hs') {
      // 망상홈쇼핑 줄 (core/hslog.ts): 전체 켬/끔, 붙일 것 넷(이름 목록 하나에 적는다), 토큰 상한
      const hk = key.slice(8) as HsLogKind;
      if (key === 'main' && flag) patch = { [HS_MAIN_KEY.on]: raw };
      else if (key === 'main_tokens') { const t = HS_MAIN_SET.tokens; const n = raw.trim() === '' ? 0 : int(t.lo, t.hi); if (n !== null) patch = { [HS_MAIN_KEY.tokens]: String(n) }; }
      else if (key.startsWith('main_hs_') && flag && HS_LOG_KINDS.includes(hk)) {
        const cur = hsMainSettings(scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate).kinds;
        const next = HS_LOG_KINDS.filter((k) => (k === hk ? raw === '1' : cur.includes(k)));
        patch = { [HS_MAIN_KEY.kinds]: next.length ? next.join(',') : 'none' };
      }
    } else if (key === 'main_lines') { /* 칸을 비우면 「제한 없음」(0) */ const n = col !== 'shop' ? null : raw.trim() === '' ? SHOP_MAIN_LINES.def : int(SHOP_MAIN_LINES.min, SHOP_MAIN_LINES.max); if (n !== null) patch = { [SHOP_MAIN_LINES_VAR]: String(n) }; }
    else if (isShopPlace(col) && flag && (key === 'main' || SHOP_MAIN_KINDS[col].includes(kind))) patch = { [shopMainKey(col, key === 'main' ? undefined : kind)]: raw };
  } else if (key === 'price') {
    patch = { [name(SHOP_PRICE_VAR)]: raw.replace(/\s+/g, ' ').trim().slice(0, 80) };
  } else if (key === 'min' || key === 'max') {
    // 최소·최대는 늘 둘 다 적는다. 서로 넘으면 다른 쪽도 같이 민다
    const n = int(SHOP_SIZE_LO, SHOP_SIZE_HI);
    if (n !== null) {
      let [lo, hi] = cur.size;
      if (key === 'min') { lo = n; if (lo > hi) hi = lo; } else { hi = n; if (hi < lo) lo = hi; }
      patch = { [name(SHOP_MIN_VAR)]: String(lo), [name(SHOP_MAX_VAR)]: String(hi) };
    }
  } else if (key === 'ctx' || key.startsWith('give_')) {
    // 가게 표 (넘길 내용 + 맥락 반영): 기본 상점·쇼핑몰 둘, 가게마다 제 값
    const k = key === 'ctx' ? 'ctx' : key.slice(5);
    if (isGiveShop(col) && isGiveKey(k) && flag) patch = { [shopGiveVar(col, k)]: raw };
  } else if (key.startsWith('fn_')) {
    // 기능 표·양 표: 세 가게가 한 값 (col 은 늘 shop)
    const m = /^fn_([a-z]+)_([a-z]+)$/.exec(key);
    if (col === 'shop' && m && isShopFn(m[1])) {
      if (isGiveKey(m[2]) && flag && !shopFnNone(m[1], m[2])) patch = { [shopFnVar(m[1], m[2])]: raw };
      else if (isShopAmount(m[2])) { const n = int(SHOP_AMOUNTS[m[2]].min, SHOP_AMOUNTS[m[2]].max); if (n !== null) patch = { [shopFnVar(m[1], m[2])]: String(n) }; }
    }
  } else if (col === 'shop') {
    const FLAGS: Record<string, string> = { diverse: SHOP_DIVERSE_VAR, prev: SHOP_PREV_VAR, kick: SHOP_KICK_VAR };
    if (FLAGS[key] && flag) patch = { [FLAGS[key]]: raw };
    else if (key === 'thoughts' && ['off', 'inner', 'note'].includes(raw)) patch = { [SHOP_THOUGHTS_VAR]: raw };
    else if (key === 'turns') { const n = int(1, 8); if (n !== null) patch = { [SHOP_TURNS_VAR]: String(n) }; }
    else if (key === 'refs') { const n = int(0, 12); if (n !== null) patch = { [SHOP_REFS_VAR]: String(n) }; }
  }
  if (!patch) return env.render(), true;
  const out = patch;
  if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), ...out } }));
  else await save(ctx, env, (chat) => (Object.entries(out).every(([k, v]) => String(chat.scriptstate?.[k] ?? '') === v) ? null : out));
  return true;
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
    let shopOff = false;
    await save(ctx, env, (chat) => {
      const prev = chat.scriptstate;
      const vars: ScriptState = {};
      const drop: string[] = [];
      for (const [k, val] of Object.entries(u.before)) {
        // 칸 구성 기록은 보관한 옛 값으로 덮거나 지우지 않고 이어 쓴다 (불러온 동안 쓰인 응답도 그 구성으로 읽게)
        if (k === COL_LOG_VAR) continue;
        if (val === undefined) drop.push(k);
        else vars[k] = val;
      }
      const ss = { ...(chat.scriptstate ?? {}) };
      for (const k of drop) delete ss[k];
      const side = bulkSideVars(chat, prev, { ...ss, ...vars });
      shopOff = side.shopOff;
      if (drop.length) chat.scriptstate = ss;
      return { ...vars, ...side.vars };
    });
    if (shopOff) {
      resetShop();
      await dropShopTags(ctx);
    }
    if (!settingsUi.notice) settingsUi.info = '기본값을 불러오기 전 설정으로 되돌렸어요.';
    env.render();
    return true;
  }
  if (action === 'set-bar-yes') {
    const what = settingsUi.confirm;
    settingsUi.confirm = '';
    if (what === 'save') {
      // 이 채팅의 설정 전부(캐릭터 이미지·상황판·괴이 발생·테마 + 기능 페이지·고급 변수)를 새 채팅 기본값으로 (2026-10-29: 한 번에)
      // 시작 전에는 기본 설정(이미지·상황판·테마)을 새 채팅 기본값에 바로 고치므로 그 값을 그대로 둔다
      const cur = current(ctx, settingsUi.scope === 'defaults' ? 'defaults' : 'chat');
      await saveDefaults(env, (p) => ({ ...p, basic: { ...cur.basic }, world: { ...cur.world }, theme: cur.theme }));
      if (!settingsUi.notice) await saveVarDefaults(ALL_PREFIXES, ctx.chat.scriptstate).catch((error) => (settingsUi.notice = `기본값을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`));
      if (!settingsUi.notice) settingsUi.info = '지금 설정을 기본값으로 저장했어요.';
      env.render();
    } else if (what === 'load') {
      // 새 채팅 기본값을 지금 채팅에. 상황판 켜기·끄기는 상태를 비우거나 새로 만들기 때문에 그대로 둔다
      const d = current(ctx, 'defaults');
      // 덮어쓰기 직전에 바뀔 키의 지금 값을 보관한다 (2026-11-06 사용자 승인, 전수점검 9-7): 불러온 뒤 「되돌리기」 한 번
      let before: Record<string, string | number | boolean | undefined> | null = null;
      let shopOff = false;
      await save(ctx, env, (chat) => {
        const vars: ScriptState = { ...basicVars(d.basic), [THEME_KEY]: d.theme, ...loadVarDefaults(ALL_PREFIXES, chat.scriptstate) };
        for (const f of WORLD_SPEC) vars[wgKey(f.key)] = String(d.world[f.key]);
        if (worldOn(chat)) {
          const ss = { ...(chat.scriptstate ?? {}), ...vars };
          Object.assign(vars, worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? '')));
        }
        const side = bulkSideVars(chat, chat.scriptstate, { ...(chat.scriptstate ?? {}), ...vars });
        shopOff = side.shopOff;
        Object.assign(vars, side.vars);
        before = {};
        for (const k of Object.keys(vars)) before[k] = chat.scriptstate?.[k];
        return vars;
      });
      if (shopOff) {
        resetShop();
        await dropShopTags(ctx);
      }
      if (!settingsUi.notice && before) settingsUi.undo = { charIndex: ctx.charIndex, chatIndex: ctx.chatIndex, before };
      if (!settingsUi.notice) settingsUi.info = '기본값을 지금 채팅에 불러왔어요.';
      env.render();
    } else if (what === 'reset') {
      // 플러그인 초기값으로 (11-07 사용자: 「기본값으로 저장·불러오기」만 있고 초기값 롤백이 없다): 이 채팅의 설정 변수를 전부 지워 코드 기본값으로,
      // 저장해 둔 새 채팅 기본값(prefs basic·world·theme·vars)도 비운다. 상황판 켜기·끄기는 그대로. 불러오기와 같은 「되돌리기」 띠 한 번
      let before: Record<string, string | number | boolean | undefined> | null = null;
      let shopOff = false;
      await save(ctx, env, (chat) => {
        const prev = chat.scriptstate;
        const ss = { ...(chat.scriptstate ?? {}) };
        before = {};
        for (const k of Object.keys(ss)) {
          if (k === '$st_anomaly_on' || !(isChatSettingVar(k) || k === THEME_KEY)) continue;
          before[k] = ss[k] as string | number | boolean | undefined;
          delete ss[k];
        }
        const side = bulkSideVars(chat, prev, ss);
        shopOff = side.shopOff;
        for (const k of Object.keys(side.vars)) if (!(k in before)) before[k] = prev?.[k] as string | number | boolean | undefined;
        chat.scriptstate = ss;
        const vars: ScriptState = { ...side.vars };
        if (worldOn(chat)) {
          const wv = worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? ''));
          for (const k of Object.keys(wv)) if (!(k in before)) before[k] = ss[k] as string | number | boolean | undefined;
          Object.assign(vars, wv);
        }
        return vars;
      });
      if (shopOff) {
        resetShop();
        await dropShopTags(ctx);
      }
      // 고친 지침도 원래 글로 (2026-11-08 사용자: 지침마다 있던 「기본으로」를 없애고 초기화 한 곳으로)
      if (!settingsUi.notice) {
        for (const g of GUIDE_NAMES) setGuideOverride(g, '');
        await saveDefaults(env, (p) => ({ ...p, basic: {}, world: {}, theme: undefined, vars: {}, guides: undefined, imgPrompt: undefined, imgKeywords: undefined }));
        imgUi.template = null;
        imgUi.keywords = null;
        for (const f of resetHooks) f();
      }
      if (!settingsUi.notice && before) settingsUi.undo = { charIndex: ctx.charIndex, chatIndex: ctx.chatIndex, before };
      if (!settingsUi.notice) settingsUi.info = '지금 채팅 설정·기본값·지침·세계를 플러그인 원래 값으로 초기화했어요.';
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
  if (action === 'set-progress') {
    if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, progress: v === '0' ? false : undefined }));
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
  // 고유 상점 표 (set-own*): 줄 고치기·켜고 끄기·사이트·직접 갔을 때 창·더하기·지우기·기본값
  if (action.startsWith('set-own')) {
    const vars = scope === 'defaults' ? getPrefs().vars : ctx.chat.scriptstate;
    const cur = ownShops(vars);
    // 줄 고치기는 「id:칸=글」, 나머지 고르기는 「id:값」
    const fm = action === 'set-own' ? /^([\w-]+):(name|alias)=([\s\S]*)$/.exec(v) : null;
    const [id, ...rest] = (fm ? fm[1] : v).split(':');
    const val = rest.join(':');
    let next: OwnShop[] | null = null;
    const edit = (f: (o: OwnShop) => OwnShop) => cur.map((o) => (o.id === id ? f(o) : o));
    if (fm) {
      const t = fm[3].replace(/\s+/g, ' ').trim();
      next = edit((o) => (fm[2] === 'name' ? { ...o, name: t.slice(0, 30) } : { ...o, alias: t.slice(0, 120) }));
    } else if (action === 'set-own-on' && (val === '1' || val === '0')) next = edit((o) => ({ ...o, on: val === '1' }));
    else if (action === 'set-own-web' && OWN_WEB.some(([w]) => w === val)) next = edit((o) => ({ ...o, web: val === 'none' ? '' : val }));
    else if (action === 'set-own-visit' && OWN_VISIT.some(([w]) => w === val)) next = edit((o) => ({ ...o, visit: val === 'none' ? '' : val }));
    else if (action === 'set-own-add' && cur.length < OWN_MAX) next = [...cur, { id: `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, on: true, name: '', alias: '', web: '', visit: 'shop' }];
    else if (action === 'set-own-del') next = cur.filter((o) => o.id !== v);
    else if (action === 'set-own-reset') next = null;
    if (!next && action !== 'set-own-reset') return true;
    const out = next ? JSON.stringify(next) : '';
    if (scope === 'defaults') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [SHOP_OWN_VAR]: out } }));
    else await save(ctx, env, (chat) => (String(chat.scriptstate?.[SHOP_OWN_VAR] ?? '') === out ? null : { [SHOP_OWN_VAR]: out }));
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
    const KEY: Record<string, string> = { on: SHOP_ON_VAR, model: SHOP_MODEL_VAR, count: SHOP_COUNT_VAR, ctx: SHOP_CTX_VAR, price: SHOP_PRICE_VAR, diverse: SHOP_DIVERSE_VAR, thoughts: SHOP_THOUGHTS_VAR, prev: SHOP_PREV_VAR, kick: SHOP_KICK_VAR, feature: SHOP_FEATURE_VAR, turns: SHOP_TURNS_VAR, refs: SHOP_REFS_VAR, where: SHOP_WHERE_VAR, judge: SHOP_JUDGE_VAR };
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
    const ok = k === 'price' ? true : k === 'model' ? v === 'main' || v === 'aux' : k === 'count' ? ['0', '1', '2'].includes(v) : k === 'thoughts' ? ['off', 'inner', 'note'].includes(v) : k === 'where' ? v === 'any' || v === 'shop' : k === 'judge' ? ['auto', 'main', 'updater'].includes(v) : k === 'turns' ? /^[1-8]$/.test(v) : k === 'refs' ? /^([0-9]|1[0-2])$/.test(v) : v === '1' || v === '0';
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
        const all = allShowVars(colConfig(getPrefs().vars), v, getPrefs().vars);
        if (all) {
          if (Object.keys(all).length) await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), ...all } }));
          return true;
        }
        if (v.startsWith('points:')) {
          const pv = pointsColVar(getPrefs().vars, v);
          if (pv) await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [colVar('points')]: pv } }));
          return true;
        }
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
      case 'set-items-auto':
        if (v === '1' || v === '0') await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_AUTO_VAR]: v } }));
        return true;
      case 'set-items-slots': {
        const next = Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, itemSlots(getPrefs().vars) + (v.endsWith('+') ? 1 : -1)));
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_SLOTS_VAR]: String(next) } }));
        return true;
      }
      case 'set-items-carry': {
        const next = Math.min(ITEM_CARRY_MAX, Math.max(ITEM_CARRY_MIN, itemCarrySetting(getPrefs().vars) + (v.endsWith('+') ? 1 : -1)));
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_CARRY_VAR]: String(next) } }));
        return true;
      }
      case 'set-items-alias-cell': case 'set-items-alias-del': case 'set-items-alias-add': case 'set-items-alias-reset': {
        const next = aliasEdit(getPrefs().vars?.[ITEM_ICON_ALIAS_VAR], action.slice(16) as 'cell' | 'del' | 'add' | 'reset', v);
        if (next !== null) await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_ICON_ALIAS_VAR]: next } }));
        return true;
      }
      case 'set-items-rules-cell': case 'set-items-rules-del': case 'set-items-rules-add': case 'set-items-rules-reset': {
        const next = RULES_TABLE.edit(getPrefs().vars?.[ITEM_RULES_VAR], action.slice(16) as 'cell' | 'del' | 'add' | 'reset', v);
        if (next !== null) await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_RULES_VAR]: next } }));
        return true;
      }
      case 'set-items-left-words':
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_LEFT_WORDS_VAR]: defStored(wordsText(v), ITEM_LEFT_WORDS_DEFAULT, undefined, ITEM_WORDS_MAX) } }));
        return true;
      case 'set-items-off-words':
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_OFF_WORDS_VAR]: defStored(wordsText(v), ITEM_OFF_WORDS_DEFAULT, undefined, ITEM_WORDS_MAX) } }));
        return true;
      case 'set-items-skip':
        await saveDefaults(env, (p) => ({ ...p, vars: { ...(p.vars ?? {}), [ITEM_SKIP_VAR]: v.replace(/\s+/g, ' ').trim().slice(0, ITEM_SKIP_MAX) } }));
        return true;
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
        const hit = nextWorld(d.world, v.replace('=', ':'));
        if (hit) await saveDefaults(env, (p) => ({ ...p, world: { ...p.world, [hit[0]]: hit[1] } }));
        return true;
      }
    }
    return false;
  }
  switch (action) {
    case 'set-world':
      await save(ctx, env, (chat) => {
        const hit = nextWorld(worldSettings(lore, chat.scriptstate), v.replace('=', ':'));
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
      // 잔고 칸을 「안 씀」으로 하면 가계부가 꺼진 것이라 상점도 꺼진다: 「가계부」 OFF(set-wallet-on 0)와 같이 이번 방문을 닫고 남은 표식을 지운다
      {
        let walletOff = false;
        await save(ctx, env, (chat) => {
          const cfg = colConfig(chat.scriptstate);
          const all = allShowVars(cfg, v, chat.scriptstate);
          if (all) return Object.keys(all).length ? all : null;
          if (v.startsWith('points:')) {
            const pv = pointsColVar(chat.scriptstate, v);
            if (!pv) return null;
            // 자동으로 돌리면 켜짐 표시를 지금 신분(없으면 시작 소속)에 바로 맞춘다
            const flag = pv === AUTO || pv === AUTO_HIDE ? pointsFlagFor(chat, isPointsOrg(String(chat.scriptstate?.['$ib_affiliation'] ?? ''))) : null;
            const vars = { ...(chat.scriptstate ?? {}), [colVar('points')]: pv, ...(flag ? { [POINTS_ON_VAR]: flag } : {}) };
            return { [colVar('points')]: pv, ...(flag ? { [POINTS_ON_VAR]: flag } : {}), [COL_LOG_VAR]: withColLog(chat.scriptstate, (chat.message ?? []).length, usedCols(colConfig(vars))) };
          }
          const hit = nextColMode(cfg, v);
          if (!hit) return null;
          const next = { ...cfg, [hit[0]]: hit[1] };
          walletOff = hit[0] === 'wallet' && hit[1] === 'off';
          return { [colVar(hit[0])]: hit[1], [COL_LOG_VAR]: withColLog(chat.scriptstate, (chat.message ?? []).length, usedCols(next)), ...(walletOff ? { [SHOP_VAR]: '' } : {}) };
        });
        if (walletOff) {
          resetShop();
          await dropShopTags(ctx);
        }
      }
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
    case 'set-items-auto': {
      if (v !== '1' && v !== '0') return true;
      await save(ctx, env, (chat) => (itemAutoOn(chat.scriptstate) === (v === '1') ? null : { [ITEM_AUTO_VAR]: v }));
      return true;
    }
    case 'set-items-slots':
      await save(ctx, env, (chat) => {
        const cur = itemSlots(chat.scriptstate);
        const next = Math.min(ITEM_SLOTS_MAX, Math.max(ITEM_SLOTS_MIN, cur + (v.endsWith('+') ? 1 : -1)));
        return next === cur ? null : { [ITEM_SLOTS_VAR]: String(next) };
      });
      return true;
    case 'set-items-carry':
      await save(ctx, env, (chat) => {
        const cur = itemCarrySetting(chat.scriptstate);
        const next = Math.min(ITEM_CARRY_MAX, Math.max(ITEM_CARRY_MIN, cur + (v.endsWith('+') ? 1 : -1)));
        return next === cur ? null : { [ITEM_CARRY_VAR]: String(next) };
      });
      return true;
    case 'set-items-skip':
      await save(ctx, env, (chat) => {
        const next = v.replace(/\s+/g, ' ').trim().slice(0, ITEM_SKIP_MAX);
        return next === String(chat.scriptstate?.[ITEM_SKIP_VAR] ?? '') ? null : { [ITEM_SKIP_VAR]: next };
      });
      return true;
    case 'set-items-limit':
      await save(ctx, env, (chat) => {
        const next = v.replace(/\s+/g, ' ').trim().slice(0, 60);
        return next === String(chat.scriptstate?.[ITEM_LIMIT_VAR] ?? '') ? null : { [ITEM_LIMIT_VAR]: next };
      });
      return true;
    case 'set-items-rules-cell': case 'set-items-rules-del': case 'set-items-rules-add': case 'set-items-rules-reset':
      await save(ctx, env, (chat) => {
        const next = RULES_TABLE.edit(chat.scriptstate?.[ITEM_RULES_VAR], action.slice(16) as 'cell' | 'del' | 'add' | 'reset', v);
        return next === null ? null : { [ITEM_RULES_VAR]: next };
      });
      return true;
    case 'set-items-left-words': case 'set-items-off-words':
      await save(ctx, env, (chat) => {
        const [key, def] = action === 'set-items-left-words' ? [ITEM_LEFT_WORDS_VAR, ITEM_LEFT_WORDS_DEFAULT] : [ITEM_OFF_WORDS_VAR, ITEM_OFF_WORDS_DEFAULT];
        const next = defStored(wordsText(v), def, undefined, ITEM_WORDS_MAX);
        return next === String(chat.scriptstate?.[key] ?? '') ? null : { [key]: next };
      });
      return true;
    case 'set-items-alias-cell': case 'set-items-alias-del': case 'set-items-alias-add': case 'set-items-alias-reset':
      await save(ctx, env, (chat) => {
        // 저장 글 꼴은 그대로 「끝 말 → 바꿀 말」. 기본 표 그대로면 빈 값(= 기본 표)으로 둔다
        const next = aliasEdit(chat.scriptstate?.[ITEM_ICON_ALIAS_VAR], action.slice(16) as 'cell' | 'del' | 'add' | 'reset', v);
        return next === null ? null : { [ITEM_ICON_ALIAS_VAR]: next };
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
