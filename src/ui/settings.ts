// 「설정」 탭: 원본 설정 창의 동작·요원창·캐릭터 이미지 항목. 값은 이 채팅의 $st_* 변수에 두고,
// 범위: 이 채팅($st_*·$wg_*) / 새 채팅 기본값(플러그인 저장소) / 카드 명부(directory.ts, 카드 로어북).
import { repaintTheme } from './theme';
import {
  AGENT_MAX, basicDefaults, DIM_DEFAULT, basicSettings, basicVars, type BasicSettings, getPrefs, type Prefs, type StatusStyle, type Theme, WORLD_SPEC, type WorldField, wgKey, worldDefaults, worldSettings,
} from '../core/settings';
import type { WorldSettings } from '../core/world/engine';
import { loadVarDefaults, savePrefs, saveVarDefaults } from '../host/prefs';
import { advSections } from './advanced';
import { loreCheckBox } from './lorecheck';
import { ASSET_NOTE } from '../core/asset';
import { IMG_FOLD, IMG_RECENT, IMG_SIZE, imgFold, imgRecent, imgSize, setImgHidden } from '../core/imgtag';
import type { Chat, ScriptState } from '../core/types';
import { parseCatalog, readWorld, startWorldVars, WORLD_KEY, worldOn, worldVars } from '../core/world';
import { updateChat, type ChatContext } from '../host/risu';
import { barButtons, directoryBar, directoryDone, directoryDoneClear, directorySearch, directoryView } from './directory';
import { drawerBox } from './drawer';
import { toast } from './toast';
import { ICONS } from './icons';
import { imgPromptPane } from './imgprompt';
import { keepOpen } from './panels';

export interface SettingsEnv {
  render: () => void;
  refresh: () => Promise<void>;
}

/** 원본 테마 변수. 카드 배경 CSS가 이 값으로 갈림 (없으면 라이트) */
export const THEME_KEY = '$st_fixed_theme';

export const settingsUi = { page: '' as '' | 'visit' | 'phone' | 'gnet' | 'wiki' | 'people' | 'image', confirmOff: false, busy: false, notice: '', info: '', scope: 'chat' as SettingsScope, confirm: '' as '' | 'save' | 'load' };

export function resetSettings(): void {
  settingsUi.confirmOff = false;
  settingsUi.page = '';
  settingsUi.notice = '';
  settingsUi.scope = 'chat';
  settingsUi.confirm = '';
}

import { updateGroup } from './update';
import { handleVisitSettings, visitSettings, visitUi } from './visitset';
import { defaultsButtons, defaultsConfirm, MAIN_PREFIXES } from './defaults';
import { PP, ppValue } from '../core/people/settings';
import { phoneSettingsPane } from './phone';
import { gnetSettingsPane } from './gnet';
import { wikiSettingsPane } from './wiki';
import { peopleSettingsPane } from './people';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function seg(action: string, cur: string, items: [string, string][], disabled = false): string {
  return `<div class="gx-segs gx-segs-sm">${items
    .map(([v, label]) => `<button class="gx-seg${cur === v ? ' on' : ''}" data-action="${action}" data-value="${v}" aria-pressed="${cur === v}" ${disabled ? 'disabled' : ''}>${label}</button>`)
    .join('')}</div>`;
}

/** 설정 한 줄: 왼쪽 이름·설명, 오른쪽 조작 (괴담톡 설정과 같은 모양) */
function field(label: string, control: string, help: string): string {
  return `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
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
  return field(esc(label), stepper('set-world', key, `${v}${unit}`, v > 0, v < max, label, busy), '');
}

function worldKind(w: WorldSettings, k: 'preset' | 'random' | 'incident' | 'mystic', name: string, busy: boolean): string {
  const expire = w[`${k}_expire`] === 1;
  return `<div class="ps-card"><h4>${name}</h4><div class="ps-rows">
    ${worldRow(w, `${k}_cap`, '동시 최대', '개', busy)}
    ${worldRow(w, `${k}_p`, '발생 확률', '%', busy)}
    ${field('자동 종료', seg('set-world', expire ? `${k}_expire:1` : `${k}_expire:0`, [[`${k}_expire:1`, 'ON'], [`${k}_expire:0`, 'OFF']], busy), '')}
    ${expire ? worldRow(w, `${k}_ttl`, 'RP 유지 시간', '시간', busy) : ''}
    ${k === 'incident' ? worldRow(w, 'landmark_share', '거점 비율', '%', busy) : ''}
  </div></div>`;
}

// v0.16.23 (사용자 설계): 「이 채팅 / 새 채팅 기본값」으로 같은 설정을 두 벌 두지 않는다. 설정은 하나(지금 채팅)이고,
// 「기본값으로 저장」을 누르면 지금 값이 새 채팅 기본값이 된다. 채팅을 시작하기 전에는 기본값을 바로 고친다.

// 위쪽 줄 하나 (v0.16.25, 사용자 설계): [설정|명부] 전환 + 「덮어쓰기」「불러오기」 (전환보다 한 단계 작게). 설정에서는 새 채팅 기본값을,
// 명부에서는 카드 로어북을 저장하고 불러온다. 누르면 확인을 한 번 더 받는다.
const CONFIRM: Record<'chat' | 'card', Record<'save' | 'load', [string, string]>> = {
  chat: {
    save: ['지금 설정으로 새 채팅 기본값을 덮어쓸까요?', '덮어쓰기'],
    load: ['저장해 둔 기본값을 지금 채팅에 불러올까요? 상황판 켜기·끄기는 그대로 둬요.', '불러오기'],
  },
  card: {
    save: ['고친 명부로 카드에 저장된 명부를 덮어쓸까요? 이 카드의 모든 채팅에 적용돼요.', '덮어쓰기'],
    load: ['고친 내용을 버리고 카드에 저장된 명부로 되돌릴까요?', '되돌리기'],
  },
};

function scopeBar(scope: SettingsScope, canChat: boolean): string {
  const items: [SettingsScope, string][] = [[canChat ? 'chat' : 'defaults', '설정'], ['card', '명부']];
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
    : '';
  return `<div class="st-scopebar">${tabs}${btns}</div>${confirm}`;
}

const BACK = `<button class="ph-tool ph-back" data-action="set-feat-back" aria-label="설정으로">${ICONS.back}</button>`;
/** 기능별 설정을 설정창 안에서 (각 기능의 설정 화면을 그대로 쓰고, 뒤로가기만 설정으로) */
function featurePage(ctx: ChatContext, page: NonNullable<typeof settingsUi.page>, canChat: boolean): string {
  let pane = '';
  if (page === 'visit') pane = `<header class="ph-room-head">${BACK}<div class="ph-room-title"><b>필드 설정</b></div><span class="ph-act">${defaultsButtons('visit')}</span></header>${defaultsConfirm('visit')}${visitUi.notice ? `<div class="gx-err" role="status">${esc(visitUi.notice)}</div>` : ''}${visitSettings(ctx, ctx.chat.scriptstate)}`;
  else if (page === 'image') pane = `<header class="ph-room-head">${BACK}<div class="ph-room-title"><b>이미지 지침</b><small>이 기기 공통</small></div></header>${imgPromptPane(ctx)}`;
  else {
    const raw = page === 'phone' ? phoneSettingsPane(ctx) : page === 'gnet' ? gnetSettingsPane(ctx) : page === 'people' ? peopleSettingsPane(ctx, canChat) : wikiSettingsPane(ctx);
    // 첫 머리의 뒤로 단추를 설정으로 돌아가는 단추로 (없으면 넣는다)
    pane = raw.replace(/<header class="ph-room-head[^"]*">(\s*<button class="ph-tool ph-back"[^>]*>[\s\S]*?<\/button>)?/, `<header class="ph-room-head">${BACK}`);
  }
  // 시작 전(시작 패널): 설정 값은 이 채팅에 바로 적히고, 갱신·열기 같은 동작은 시작 뒤에 된다
  if (!canChat) pane = pane.replace(/<\/header>/, '</header><p class="gx-hint st-prehint">채팅을 시작하기 전이에요. 여기서 바꾼 값은 이 채팅에 그대로 적용되고, 갱신·열기 같은 동작은 시작한 뒤에 할 수 있어요.</p>');
  return `<main class="gx-body gx-settings st-featpage">${pane}</main>`;
}

export function settingsTab(ctx: ChatContext, scope: SettingsScope = 'chat', canChat = true): string {
  // 명부: 모바일은 검색을 하단 서랍에 (괴이·특수·요원·조직 탭은 위에 고정)
  if (scope === 'card') {
    return `<main class="gx-body gx-settings">${scopeBar(scope, canChat)}${directoryView(ctx)}${toast('dir', directoryDone(), directoryDoneClear)}</main>${drawerBox(directorySearch(), 'gx-dirdrawer')}`;
  }
  // 기능별 설정 → 본부 대화: 괴담톡·괴담넷·위키처럼 따로 된 화면 (2026-10-23 사용자)
  // 시작 전(시작 패널의 「새 채팅 기본 설정」)에도 chat 객체·scriptstate 가 있어 같은 페이지를 연다 (2026-10-26 사용자)
  if (settingsUi.page) return featurePage(ctx, settingsUi.page, canChat);
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
  return `<main class="gx-body gx-settings">
    ${scopeBar(scope, canChat)}
    ${settingsUi.notice ? `<div class="gx-err" role="alert">${esc(settingsUi.notice)}</div>` : ''}
    ${group('기능별 설정', `<div class="st-feats">${[['gnet', '괴담넷', ICONS.gnet], ['phone', '괴담톡', ICONS.phone], ['wiki', '위키', ICONS.wiki], ['visit', '필드', ICONS.game], ['people', '인물 기록', ICONS.group]]
      .map(([k, label, icon]) => `<button class="gx-mini st-feat" data-action="feature-set" data-value="${k}" aria-label="${label} 설정">${icon}${label}</button>`)
      .join('')}</div>`, canChat ? '' : '시작 전에도 각 기능의 설정을 미리 바꿀 수 있어요. 바꾼 값은 이 채팅에 적용돼요.')}
    ${group('화면', [
      field('테마', seg('set-theme', theme, [['light', '라이트'], ['dark', '다크'], ['paper', '페이퍼']], busy), '채팅 화면의 캐릭터 이미지 배경과 상태창(「테마」를 골랐을 때) 배색이에요.'),
      field('상태창', seg('set-status', getPrefs().status ?? 'auto', [['auto', '테마'], ['dark', '다크'], ['light', '라이트'], ['paper', '페이퍼'], ['off', '미표시']], busy), '채팅 속 상태창의 배색이에요. 「테마」는 위 테마를 따라가요. 미표시를 고르면 상자만 숨기고, 모델은 상태 태그를 계속 써요.'),
      field('메뉴 위치', seg('set-nav', getPrefs().nav ?? 'left', [['left', '왼쪽'], ['right', '오른쪽']], busy), 'PC 창에서 메뉴 목록을 놓을 쪽이에요. 이 기기의 모든 채팅에 같이 적용돼요.'),
      field('요원 칸', seg('set-agents', getPrefs().agents ?? 'wall', [['wall', '모니터'], ['list', '목록']], busy), '상황판 요원 칸 모양이에요. 이 기기의 모든 채팅에 같이 적용돼요.'),
      field('창 바깥 불투명도', dimSlider(getPrefs().dim ?? DIM_DEFAULT, busy), '창 뒤 채팅 화면을 가리는 정도예요. 0%면 그대로 보이고 100%면 다 가려요.'),
    ].join(''))}
    ${group('캐릭터 이미지', [
      field('에셋 출력', seg('set-asset', s.assetOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '본문에 등장하는 캐릭터의 등록 이미지를 표시하도록 이미지 태그를 적어요. 이미지와 태그 목록은 봇 카드에 들어 있어요.'),
      s.assetOn ? field('이미지 크기', pctSlider('set-img-size', getPrefs().imgSize ?? IMG_SIZE.def, IMG_SIZE, '이미지 크기', busy), '채팅 속 캐릭터 이미지 칸의 크기예요. 100%가 원래 크기이고, 채팅 폭보다 커지지는 않아요. 이 기기의 모든 채팅에 같이 적용돼요.') : '',
      s.assetOn ? field('접힌 높이', pctSlider('set-img-fold', getPrefs().imgFold ?? IMG_FOLD.def, IMG_FOLD, '접힌 높이', busy), '이미지는 위쪽만 보이게 접혀 있다가 누르거나 마우스를 올리면 펼쳐져요. 접혔을 때 그림 높이의 몇 %를 보여 줄지예요. 원래는 68%(정사각형)이고 100%면 접지 않아요.') : '',
      s.assetOn ? field('이미지 표시 범위', recentControl('img-show', getPrefs().imgShow, '이미지 표시 메시지 수', busy), '이미지를 띄울 메시지예요. 「최근만」이면 마지막 메시지부터 정한 개수까지만 띄워요(원래 6개). 바꾼 값은 메시지를 다시 그릴 때 반영돼요.') : '',
      s.assetOn ? field('요청 속 이미지 태그', recentControl('img-send', getPrefs().imgSend, '태그를 남길 메시지 수', busy), '모델에 보내는 대화 기록에서 이미지 태그를 남길 메시지예요. 오래된 태그를 빼면 토큰이 줄어요. 최근 태그는 모델이 태그 쓰는 법을 따라 하도록 남겨요(원래 6개).') : '',
      s.assetOn ? field('출력 모델', seg('set-asset-model', s.assetModel, [['main', '메인모델'], ['aux', '보조모델']], busy), '메인모델은 본문과 함께 적고, 보조모델은 응답이 끝난 뒤 한 번 더 불러 태그를 보충해요.') : '',
      s.assetOn ? field('이미지 지침', `<button class="gx-mini" data-action="feature-set" data-value="image">${ICONS.pen}지침 편집</button>`, '카드 로어북 대신 플러그인이 만드는 이미지 태그 지침이에요. 지침 틀, 출력 대상 캐릭터(명부에서 자동), 표정 세트를 여기서 관리해요.') : '',
      s.assetOn ? field('주인공 이미지', seg('set-asset-player', s.assetPlayer ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '「캐릭터로 플레이」로 고른 요원(내가 연기하는 주인공)에게도 이미지 태그를 붙일지예요. 끄면 페르소나처럼 주인공 이미지는 띄우지 않아요.') : '',
      s.assetOn && s.assetModel === 'aux' ? field('캐릭터당 이미지 수', seg('set-asset-limit', String(s.assetLimit), [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], busy), '보조모델이 한 응답에서 캐릭터 한 명에게 붙일 이미지 태그의 최대 개수') : '',
    ].join(''))}
    ${scope === 'chat' && s.assetOn && s.assetModel === 'aux' && note ? `<p class="gx-hint">최근 보충: ${esc(note)}</p>` : ''}
    ${group('상황판', [
      field('괴이 발생 · 요원 시스템', anomaly, scope === 'chat' ? 'ON이면 괴이·사건·특수가 자동으로 발생하고 응답마다 지도와 요원 상태를 갱신해요. OFF로 바꾸면 현재 상황판을 비워요. 커스텀 임무는 OFF에서도 쓸 수 있어요.' : '새 채팅을 상황판을 켠 채로 시작할지 정해요.'),
      field('요원 표시 인원', stepper('set-agent', 'n', `${s.agentLimit}명`, s.agentLimit > 0, s.agentLimit < AGENT_MAX, '요원 표시 인원', busy), `상황판과 편성에 보일 등록 요원 수 (0~${AGENT_MAX}명, 0이면 숨김)`),
      field('지원 투입', seg('set-support', s.supportOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), '편성에서 등록 요원 외의 일반 지원 인원을 더할 수 있어요.'),
      field('인물 기록', seg('set-people', peopleOn ? '1' : '0', [['1', 'ON'], ['0', 'OFF']], busy), scope === 'chat' ? '응답마다 보조 모델이 한 번 읽어 인물의 상태·관계·호감을 기록하고, 본편 요청이 그 기록을 읽어요. 세부는 「기능별 설정 → 인물 기록」에서.' : '새 채팅을 인물 기록을 켠 채로 시작할지 정해요.'),
    ].join(''))}
    <details class="ps-adv st-world" data-keep="world-gen"${keepOpen('world-gen')}><summary class="ps-adv-sum"><b>괴이 발생</b></summary><div class="ps-adv-body"><p class="ps-note">응답을 처리할 때마다 판정해요. 상한을 0으로 하면 그 종류는 자동으로 생기지 않아요.</p>
      <div class="ps-cards">
        ${worldKind(world, 'preset', '프리셋 괴이', busy)}${worldKind(world, 'random', '랜덤 괴이', busy)}
        ${worldKind(world, 'incident', '사건', busy)}${worldKind(world, 'mystic', '특수', busy)}
        <div class="ps-card"><h4>추가 발생 여유분</h4><div class="ps-rows">
          ${worldRow(world, 'extra_cap', '괴이', '개', busy)}${worldRow(world, 'extra_in_cap', '사건', '개', busy)}${worldRow(world, 'extra_ms_cap', '특수', '개', busy)}</div>
          <p class="ps-note">직접 고르거나 RP 중에 새로 등장한 것을 상한과 따로 기록할 수 있는 개수예요.</p></div>
      </div>
    </div></details>
    ${advSections('gen', scope === 'chat' ? ctx.chat.scriptstate : getPrefs().vars, scope === 'chat' && canChat ? { 1: loreCheckBox(ctx) } : {})}
    ${updateGroup(ctx)}
    ${toast('st', settingsUi.info, (t) => {
      if (settingsUi.info === t) settingsUi.info = '';
    })}
  </main>`;
}

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
  if (action.startsWith('visit-') && (await handleVisitSettings(action, ctx, env.render, env.refresh, v))) return true;
  if (action === 'set-bar') {
    settingsUi.confirm = v === 'save' || v === 'load' ? v : '';
    env.render();
    return true;
  }
  if (action === 'set-bar-no') {
    settingsUi.confirm = '';
    env.render();
    return true;
  }
  if (action === 'set-bar-yes') {
    const what = settingsUi.confirm;
    settingsUi.confirm = '';
    if (what === 'save') {
      // 지금 채팅의 화면·상황판·괴이 발생·캐릭터 이미지 설정을 새 채팅 기본값으로
      const cur = current(ctx, 'chat');
      await saveDefaults(env, (p) => ({ ...p, basic: { ...cur.basic }, world: { ...cur.world }, theme: cur.theme }));
      if (!settingsUi.notice) await saveVarDefaults(MAIN_PREFIXES, ctx.chat.scriptstate).catch((error) => (settingsUi.notice = `기본값을 저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`));
      if (!settingsUi.notice) settingsUi.info = '지금 설정을 새 채팅 기본값으로 저장했어요.';
      env.render();
    } else if (what === 'load') {
      // 새 채팅 기본값을 지금 채팅에. 상황판 켜기·끄기는 상태를 비우거나 새로 만들기 때문에 그대로 둔다
      const d = current(ctx, 'defaults');
      await save(ctx, env, (chat) => {
        const vars: ScriptState = { ...basicVars(d.basic), [THEME_KEY]: d.theme, ...loadVarDefaults(MAIN_PREFIXES, chat.scriptstate) };
        for (const f of WORLD_SPEC) vars[wgKey(f.key)] = String(d.world[f.key]);
        if (worldOn(chat)) {
          const ss = { ...(chat.scriptstate ?? {}), ...vars };
          Object.assign(vars, worldVars(readWorld(chat), parseCatalog(lore), worldSettings(lore, ss), String(ss['$st_faction'] ?? '')));
        }
        return vars;
      });
      if (!settingsUi.notice) settingsUi.info = '새 채팅 기본값을 지금 채팅에 불러왔어요.';
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
