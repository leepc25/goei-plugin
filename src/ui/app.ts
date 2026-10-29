import { findFaction, findScenario, defaultScenario, SCENARIOS } from '../core/scenarios';
import { anchorOf } from '../core/visit';
import { showWindow } from '../host/container';
import { factionList } from '../core/factions';
import { setOpeningHint } from '../host/openinghint';
import { legacyWikiNav, NavHistory, type RecordsNav } from '../core/navhist';
import { applyStart, chatPhase, currentChoice, planStart, readManifest, StartError } from '../core/start';
import { isGoeiLore } from '../core/install';
import { refreshInstall } from './editor/install';
import type { FactionCode, LangCode, LoreEntry, Manifest } from '../core/types';
import {
  activeEvents, type Catalog, endedShown, codesToNames, factionNames, lastStatusFields, locName, parseCatalog, readWorld, rosterFor, startWorldVars, agentLocked, readDirectory, worldOn,
} from '../core/world';
import { loadContext, updateChat, type ChatContext } from '../host/risu';
import { prepareBaseDocs } from '../core/wiki';
import { facePic, loadModuleAssets, mainPic } from '../host/assets';
import { playableAgents, playerAgent } from '../core/player';
import { savePrefs } from '../host/prefs';
import { editorOnSettings, editorOpen, openEditor, render as editorRender, type EditorNode } from './editor/index';
import { agentPanel, agentPopup, agUi, bindAgentTips, type AgentItem } from './agents';
import css from './style.css';
import { frameHtml, frameState } from './frame';
import { GHOST_ICON, ICONS } from './icons';
import { labelSwitches } from './controls';
import { bindMbar, mbarHtml } from './mbar';
import { bindDrawer, closeDrawer, drawerHtml } from './drawer';
import { addMark, markCandidates, markPop, marks, markSlots, markUi, navHistBar, removeMarkAt } from './marks';
import { bindSwipeBack } from './swipeback';
import { avatar, factionPic, imageUrl, picAvatar, setImageRedraw, showIdCard, stLabel } from './images';
import { bindMapZoom } from './mapzoom';
import { closeGame, gameOpen, hideGame, openGame, reattachGame } from './game';
import { BRAND, brandHtml } from './brand';
import { checkLatest, handleUpdate, hasUpdate, updateBanner } from './update';
import { setCurrentTheme, themeName } from './theme';
import { bindFootnotes, bindWikiSide, handleWiki, resetWiki, wiki, wikiHomeResults, wikiInput, wikiList, wikiTab, type WikiEnv } from './wiki';
import { gnet, gnetOpenCheck, gnetTab, handleGnet, resetGnet, type GnetEnv } from './gnet';
import { addPhoto, attachInput, hydratePhotos, zoomPhoto } from './attach';
import { ATTACH_MAX } from '../core/attach';
import { readPhone, roomLabel } from '../core/phone';
import { findPost, gnetLabel, readGnet } from '../core/gnet';
import { savePhoto } from '../host/photo';
import { readPersona, readUser, userInfo } from '../host/user';
import { applyAdvanced } from '../core/advanced';
import { handleAdvanced } from './advanced';
import { rememberPanel } from './panels';
import { startCctvFx, stopCctvFx } from './cctvfx';
import { elapsedText, evPopup, evSeenReset, evUi, opsBoard, opsUi, peopleChips, type EvCard, type EvKind, type OpsCard } from './evcard';
import { evArt } from './evpic';
import { agentContact, handlePhone, openAgentDm, openCheck, phone, phoneContent, phoneInput, phonePickList, phoneTab, phoneUnread, resetPhone, type PhoneEnv } from './phone';
import { boardMapUrl, field, handleField, mapTab, mapSuggestFor, missionList, missionTab, newMessage, resetField, showOnMap, type FieldEnv } from './field';
import { noticeClass, sendNow } from '../host/send';
import { markUnsent } from '../host/unsent';
import { startRecord } from '../core/dispatch';
import { handleSettings, resetSettings, settingsTab, settingsUi, type SettingsEnv } from './settings';
import { bindPeopleHold, bindPeopleStatus, handlePeople, hasPersonRecord, peopleInput, type PeopleEnv } from './people';
import { handleImgPrompt, imgInput } from './imgprompt';
import { cropValue, setCrop, directoryExtList, directoryInput, directoryPhotoList, directoryList, dirUi, handleDirectory, resetDirectory } from './directory';
import { basicDefaults, basicVars, DIM_DEFAULT, getPrefs, worldDefaults, worldSettings, worldVarsOf, type Mark } from '../core/settings';
import { colConfig } from '../core/world/statuscols';
import { adjustWallet, walletEditable, aliveAnchors, formatWon, parseWon, readWallet, removeWalletEntry, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { walletHeadButton, walletList, walletTab, walletUi as walletTabUi } from './wallet';
import { applyRecordsNav, closeToastHtml, endedReport, holdToast, releaseToast, syncCloseToast, fieldSheet, handleRecords, journalList, rec, recordsInput, recordsMarkName, recordsNav, recordsTab, resetRecords, type RecordsEnv } from './records';
import { onReport } from '../core/journal';

/** ID카드 잔고 칩 → 장부 창 (열림·입력 알림) */

interface Draft {
  faction?: FactionCode;
  lang: LangCode;
  fm?: number;
  /** 직접 입력 첫 장면: 출발과 함께 보낼 상황 */
  situation?: string;
  /** 캐릭터로 플레이: 유저가 연기할 요원 코드 ('' = 내 페르소나) */
  player?: string;
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not-lite'; name: string; goei?: boolean }
  | { kind: 'started'; ctx: ChatContext }
  /** 커스텀 임무로 시작을 골랐고 첫 지시문을 아직 안 보냄 */
  | { kind: 'opening'; ctx: ChatContext }
  | { kind: 'picker'; ctx: ChatContext; manifest: Manifest; staged: boolean };

/** 창 바깥 막 색 (테마별, 투명도는 설정 → 화면) */
const VEIL = { dark: '3, 7, 9', light: '20, 30, 28', paper: '40, 30, 15' };
/** 창 바깥 막 (설정 → 화면 「창 바깥 불투명도」). 0이면 투명 */
function paintVeil(el: HTMLElement, dim: number): void {
  const veil = VEIL[el.dataset.theme as keyof typeof VEIL] ?? VEIL.dark;
  el.style.background = `rgba(${veil}, ${dim / 100})`;
}
let root: HTMLElement | null = null;
let view: View = { kind: 'loading' };
let draft: Draft = { lang: 'ko' };
let busy = false;
let notice = '';
/** 괴담넷 탭 (완성 전까지 숨김) */
const GNET_ON = true;
/** records = 「기록」(일지·보고서·인물·세력, 2026-10-29 가계부 메뉴 자리). wallet 은 메뉴에서 빠졌지만 사원증 잔고 줄·폰 머리 칩이 연다 */
type Tab = 'board' | 'map' | 'mission' | 'gnet' | 'phone' | 'wiki' | 'field' | 'records' | 'wallet' | 'settings';
const TABS: Tab[] = ['board', 'map', 'mission', ...(GNET_ON ? (['gnet'] as Tab[]) : []), 'phone', 'wiki', 'field', 'records', 'wallet'];
let tab: Tab = 'board';
/** 커스텀 임무 시작 화면에서 "다시 고르기"를 눌렀을 때 */
let repick = false;
/** 시작 화면에서 연 새 채팅 기본 설정 */
let pickerPrefs = false;
let lastChat = '';

const env: FieldEnv = {
  render: () => render(),
  refresh: () => refresh(),
  close: () => close(),
  setNotice: (text) => {
    notice = text;
  },
  setBusy: (on) => {
    busy = on;
  },
};

const wikiEnv: WikiEnv = {
  render: () => render(),
  refresh: () => refresh(),
  current: () => (view.kind === 'started' ? view.ctx : null),
};

const gnetEnv: GnetEnv = wikiEnv;
const settingsEnv: SettingsEnv = { render: () => render(), refresh: () => refresh() };
const peopleEnv: PeopleEnv = settingsEnv;
const recordsEnv: RecordsEnv = settingsEnv;

/** 창이 떠 있는지 (괴담톡이 받은 말풍선을 바로 읽음 처리할지) */
let shown = false;
const phoneEnv: PhoneEnv = {
  render: () => render(),
  refresh: () => refresh(),
  visible: () => shown && tab === 'phone' && view.kind === 'started',
  current: () => (view.kind === 'started' ? view.ctx : null),
  close: async () => {
    await close();
    await refresh();
  },
};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function ensureRoot(): HTMLElement {
  if (root) return root;
  // 이미지가 도착하면: 시작 화면은 그 카드만, 나머지 화면은 다시 그린다
  // 사진이 다 읽히면 패널과, 떠 있으면 세계 편집 창도 다시 그린다 (2026-10-27: 편집 창의 괴이·요원 사진이 안 뜨던 문제 — 창은 패널과 따로 그린다)
  setImageRedraw(() => {
    if (view.kind === 'picker') renderPicker();
    else render();
    if (editorOpen()) editorRender();
  });
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.className = 'gx';
  document.body.appendChild(root);
  root.addEventListener('toggle', (ev) => rememberPanel(ev.target as HTMLDetailsElement), true);
  // 실제 사진: 파일 고르기 창은 클릭 안에서 바로 열어야 해서 handle()을 거치지 않는다
  const picker = document.createElement('input');
  picker.type = 'file';
  picker.accept = 'image/*';
  picker.multiple = true;
  picker.hidden = true;
  document.body.appendChild(picker);
  let pickFor = '';
  picker.addEventListener('change', () => {
    const files = [...(picker.files ?? [])];
    picker.value = '';
    if (files.length) void addPhotos(pickFor, files);
  });
  // 창 바깥(어두운 막)을 눌렀다 떼면 닫기. 창 안에서 끌다가 바깥에서 놓은 건 무시
  let downOutside = false;
  root.addEventListener('pointerdown', (ev) => (downOutside = ev.target === root));
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === root) {
      if (downOutside) void run('close');
      downOutside = false;
      return;
    }
    const pick = t.closest<HTMLElement>('[data-pick-photo]');
    if (pick) {
      if (pick.hasAttribute('disabled') || busy) return;
      pickFor = pick.dataset.pickPhoto ?? '';
      picker.click();
      return;
    }
    const zoom = t.closest<HTMLElement>('[data-zoom-photo]')?.querySelector('img');
    if (zoom?.getAttribute('src')) return zoomPhoto(zoom.src, zoom.alt);
    // 명부 거점: 지역 지도를 누른 자리가 거점 위치 (%)
    const pickMap = t.closest<HTMLElement>('[data-base-pick]');
    if (pickMap) {
      const img = pickMap.querySelector('img')?.getBoundingClientRect();
      if (!img || !img.width || !img.height) return;
      const x = ((ev as MouseEvent).clientX - img.left) / img.width * 100;
      const y = ((ev as MouseEvent).clientY - img.top) / img.height * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;
      return void run('dir-base-xy', `${x.toFixed(1)}|${y.toFixed(1)}|${pickMap.dataset.basePick}`);
    }
    const el = t.closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    // data-take: 같은 창의 입력칸 값을 넘긴다 (form 제출은 플러그인 iframe에서 막혀 있음)
    // 이름을 쉼표로 여럿 주면 값들을 JSON 배열로 (가계부 거래 추가: 금액·메모)
    const names = el.dataset.take?.split(',') ?? [];
    const val = (n: string) => root?.querySelector<HTMLInputElement>(`[name="${n}"]`)?.value ?? '';
    const take = !names.length ? undefined : names.length > 1 ? JSON.stringify(names.map(val)) : root?.querySelector<HTMLInputElement>(`[name="${names[0]}"]`)?.value;
    void run(el.dataset.action!, take ?? el.dataset.value);
  });
  // 명부 얼굴 틀: 대표 사진을 누르거나 끌면 그 자리가 틀 가운데 (틀이 사진 밖으로 나가지 않게)
  root.addEventListener('pointerdown', (ev) => {
    const box = (ev.target as HTMLElement).closest?.<HTMLElement>('[data-crop]');
    const img = box?.querySelector('img');
    if (!box || !img) return;
    ev.preventDefault();
    const key = box.dataset.crop ?? '';
    const frame = box.querySelector<HTMLElement>('.dir-crop-frame');
    const move = (e: PointerEvent) => {
      const r = img.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const w = cropValue(key)[2];
      const half = ((w / 100) * r.width) / 2;
      const px = Math.max(Math.min(half, r.width / 2), Math.min(r.width - half, e.clientX - r.left));
      const py = Math.max(Math.min(half, r.height / 2), Math.min(r.height - half, e.clientY - r.top));
      const c: [number, number, number] = [(px / r.width) * 100, (py / r.height) * 100, w];
      setCrop(key, c);
      if (frame) Object.assign(frame.style, { left: `${c[0]}%`, top: `${c[1]}%` });
    };
    move(ev);
    box.setPointerCapture?.(ev.pointerId);
    const up = () => {
      box.removeEventListener('pointermove', move);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', up);
      render();
    };
    box.addEventListener('pointermove', move);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  });
  // 명부 요원 순서 (PC): 손잡이를 끌어 같은 소속 요원 위·아래에 놓는다. 놓으면 dir-move before/after
  root.addEventListener('pointerdown', (ev) => {
    const grip = (ev.target as HTMLElement).closest?.<HTMLElement>('[data-drag-agent]');
    const row = grip?.closest<HTMLElement>('[data-agent-row]');
    if (!grip || !row || !root) return;
    ev.preventDefault();
    const box = root;
    const group = row.dataset.agentGroup ?? '';
    const rows = [...box.querySelectorAll<HTMLElement>('[data-agent-row]')].filter((r) => r !== row && r.dataset.agentGroup === group);
    let drop: { el: HTMLElement; after: boolean } | null = null;
    const mark = (next: typeof drop) => {
      drop?.el.classList.remove('drop-before', 'drop-after');
      drop = next;
      drop?.el.classList.add(drop.after ? 'drop-after' : 'drop-before');
    };
    const move = (e: PointerEvent) => {
      let best: typeof drop = null;
      let gap = Infinity;
      for (const r of rows) {
        const b = r.getBoundingClientRect();
        const d = Math.abs(e.clientY - (b.top + b.height / 2));
        if (d < gap) [gap, best] = [d, { el: r, after: e.clientY > b.top + b.height / 2 }];
      }
      if (best?.el !== drop?.el || best?.after !== drop?.after) mark(best);
    };
    row.classList.add('dragging');
    box.classList.add('dir-dragging');
    grip.setPointerCapture?.(ev.pointerId);
    const up = () => {
      grip.removeEventListener('pointermove', move);
      grip.removeEventListener('pointerup', up);
      grip.removeEventListener('pointercancel', up);
      row.classList.remove('dragging');
      box.classList.remove('dir-dragging');
      const target = drop;
      mark(null);
      if (target) void run('dir-move', `${target.after ? 'after' : 'before'}|${grip.dataset.dragAgent}|${target.el.dataset.agentRow}`);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
  // 틀 크기 막대: 끄는 동안은 틀만 바꾸고, 놓으면 다시 그려 얼굴 사진을 새로 자른다
  root.addEventListener('change', (ev) => {
    if ((ev.target as HTMLElement).dataset?.input === 'dir-crop-size') render();
  });
  // 작성칸에 사진 붙여넣기·끌어놓기 (원본처럼)
  const photoTarget = (el: EventTarget | null) => {
    const box = (el as HTMLElement | null)?.closest?.('.gn-pane, .gn-cpane, .gn-inline, .gn-composer, .ph-room');
    return box ? (box.matches('.gn-pane, .gn-cpane, .gn-inline, .gn-composer') ? 'gn' : 'ph') : '';
  };
  const imageFiles = (list: FileList | DataTransferItemList | undefined) =>
    [...(list ?? [])].map((x) => (x instanceof File ? x : (x as DataTransferItem).kind === 'file' ? (x as DataTransferItem).getAsFile() : null)).filter((f): f is File => !!f && f.type.startsWith('image/'));
  // PC↔모바일 폭이 바뀌면 다시 그린다 (괴담넷은 모바일에서 목록 안 펼침, PC는 두 칸)
  if (!widthWatch) {
    widthWatch = true;
    matchMedia('(max-width: 760px)').addEventListener?.('change', () => root && render());
    // 창 둘레 기기 틀: 뷰포트 폭·필드 전체화면이 바뀌어 그릴지 말지가 달라질 때만 다시 그린다 (ui/frame.ts)
    const frameWatch = () => {
      if (!root || root.style.display === 'none') return;
      const fr = frameState(getPrefs().frame, view.kind === 'started');
      if (root.dataset.frame !== fr.kind || (root.dataset.frameHidden === '1') !== fr.hidden) render();
    };
    window.addEventListener('resize', frameWatch);
    document.addEventListener('fullscreenchange', frameWatch);
  }
  root.addEventListener('paste', (ev) => {
    const prefix = photoTarget(ev.target);
    const files = imageFiles(ev.clipboardData?.items);
    if (!prefix || !files.length) return;
    ev.preventDefault();
    void addPhotos(prefix, files);
  });
  root.addEventListener('dragover', (ev) => {
    if (photoTarget(ev.target) && ev.dataTransfer?.types.includes('Files')) ev.preventDefault();
  });
  root.addEventListener('drop', (ev) => {
    const prefix = photoTarget(ev.target);
    if (!prefix || !ev.dataTransfer?.files.length) return;
    ev.preventDefault();
    const files = imageFiles(ev.dataTransfer.files);
    if (files.length) void addPhotos(prefix, files);
    else if (prefix === 'gn') (gnet.notice = '사진 파일만 끌어놓을 수 있어요.'), render();
    else (phone.notice = '사진 파일만 끌어놓을 수 있어요.'), render();
  });
  root.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLInputElement;
    // 괴담톡: PC는 Enter로 보내고 Shift+Enter로 줄바꿈 (모바일 자판의 Enter는 줄바꿈)
    if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && el?.dataset?.input === 'ph-draft' && matchMedia('(pointer: fine)').matches) {
      const send = root?.querySelector<HTMLButtonElement>('.ph-send');
      ev.preventDefault();
      if (send && !send.disabled) void run('ph-send', send.dataset.value);
      return;
    }
    if (ev.key !== 'Enter' || ev.isComposing || !el?.dataset?.enter) return;
    ev.preventDefault();
    void run(el.dataset.enter, el.value);
  });
  root.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const input = form.querySelector('input');
    if (form.dataset.submit) void run(form.dataset.submit, input?.value ?? '');
  });
  root.addEventListener('change', (ev) => panelChange(ev.target as HTMLSelectElement));
  // 검색어는 목록만 다시 그린다 (입력창 포커스 유지)
  // 검색어는 목록만 다시 그린다 (입력창 포커스 유지). 편집 창의 설정 페이지도 같은 처리기를 쓴다 (panelInput)
  root.addEventListener('input', (ev) => panelInput(ev.target as HTMLInputElement));
  bindAgentTips(root);
  // 인물 기록: 갱신 중·끝남 알림으로 다시 그리기 (입력 중이면 건너뜀), 호감 막대 길게 누르기
  bindPeopleStatus(() => {
    if (shown && view.kind === 'started') render();
  });
  bindPeopleHold(root);
  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    // 설정·세계 편집 창이 떠 있으면 그 창이 닫힌다 (editor/index.ts). 뒤의 패널까지 같이 닫지 않는다
    if (editorOpen()) return;
    // 필드에서 Esc는 게임 일시정지 메뉴 (창을 닫지 않는다, 2026-10-23 사용자)
    if (tab === 'field' && view.kind === 'started') return;
    if (evUi.pop || agUi.pop) {
      evUi.pop = agUi.pop = '';
      render();
      return;
    }
    void close();
  });
  return root;
}

/** 패널의 change 이벤트 (편집 창의 설정 페이지에서도 같은 함수를 부른다) */
function panelChange(el: HTMLSelectElement): void {
  if (el?.dataset?.change) void run(el.dataset.change, el.dataset.key ? `${el.dataset.key}=${el.value}` : el.value);
}

/** 패널의 input 이벤트 (편집 창의 설정 페이지에서도 같은 함수를 부른다) */
function panelInput(el: HTMLInputElement): void {
  if (el?.dataset?.input === 'dim' && root) {
    paintVeil(root, Number(el.value));
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = `${el.value}%`;
    return;
  }
  if (el?.dataset?.input === 'pp-cap') {
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = Number(el.value) === 0 ? '한도 없음' : `±${el.value}`;
    return;
  }
  if (el?.dataset?.input === 'pct' || el?.dataset?.input === 'count') {
    const out = el.parentElement?.querySelector('output');
    if (out) out.textContent = `${el.value}${el.dataset.input === 'pct' ? '%' : '개'}`;
    return;
  }
  if (el?.dataset?.input === 'wallet-q' && view.kind === 'started') {
    // 가계부 찾기: 목록만 다시 그린다 (입력칸 포커스 유지)
    walletTabUi.q = el.value;
    const box = root?.querySelector('.gx-wt-list');
    if (box) box.innerHTML = walletList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'rec-q' && view.kind === 'started') {
    // 기록 › 일지 찾기: 목록만 다시 그린다 (입력칸 포커스 유지)
    recordsInput('rec-q', el.value);
    const box = root?.querySelector('.gx-jr-list');
    if (box) box.innerHTML = journalList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'wiki-query' && view.kind === 'started') {
    wiki.query = el.value;
    const box = root?.querySelector('.nw .ph-content');
    if (box) box.innerHTML = wikiList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'wiki-home-query' && view.kind === 'started') {
    wiki.homeQuery = el.value;
    const box = root?.querySelector('.nw-hero-res');
    if (box) box.innerHTML = wikiHomeResults(view.ctx);
    return;
  }
  if (el?.dataset?.input && wikiInput(el.dataset.input, el.value)) return;
  if (el?.dataset?.input && peopleInput(el.dataset.input, el.value)) return;
  if (el?.dataset?.input && imgInput(el.dataset.input, el.value)) return;
  if (el?.dataset?.input === 'gn-draft') return void (gnet.draft = el.value);
  if (el?.dataset?.input === 'gn-to') return void (gnet.to = el.value);
  if (el?.dataset?.input === 'gn-att') return void attachInput(gnet.attach, el.dataset.key, el.value);
  if (el?.dataset?.input === 'ph-query' && view.kind === 'started') {
    const box = root?.querySelector('.ph-content');
    if (box) box.innerHTML = phoneContent(view.ctx, el.value);
    return;
  }
  if (el?.dataset?.input === 'ph-pick-q' && view.kind === 'started') {
    phoneInput('ph-pick-q', el.value);
    const box = root?.querySelector('.ph-pick');
    if (box) box.innerHTML = phonePickList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'dir-q' && (view.kind === 'started' || view.kind === 'picker')) {
    dirUi.q = el.value;
    const box = root?.querySelector('.dir-list');
    if (box) box.innerHTML = directoryList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'dir-crop-size') {
    const key = el.dataset.key ?? '';
    const [x, y] = cropValue(key);
    setCrop(key, [x, y, Number(el.value)]);
    const frame = root?.querySelector<HTMLElement>('[data-crop] .dir-crop-frame');
    if (frame) frame.style.width = `${el.value}%`;
    return;
  }
  if (el?.dataset?.input === 'dir-photo-q' && (view.kind === 'started' || view.kind === 'picker')) {
    dirUi.pickQ = el.value;
    const box = root?.querySelector('.dir-pics');
    if (box) box.innerHTML = directoryPhotoList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'dir-ext-q' && (view.kind === 'started' || view.kind === 'picker')) {
    dirUi.addQ = el.value;
    const box = root?.querySelector('.dir-ext-list');
    if (box) box.innerHTML = directoryExtList(view.ctx);
    return;
  }
  if (el?.dataset?.input === 'dir') return void directoryInput(el.dataset.key ?? '', el.value, root?.querySelector('.dir-bar') ?? null);
  if (el?.dataset?.input && phoneInput(el.dataset.input, el.value, el.dataset.key)) return;
  if (el?.dataset?.input === 'field-note') return void (field.note = el.value);
  if (el?.dataset?.input === 'map-query' && view.kind === 'started') {
    const box = root?.querySelector('.gx-mapsug');
    if (box) box.innerHTML = mapSuggestFor(view.ctx, el.value);
    return;
  }
  if (el?.dataset?.input === 'start-note') {
    const had = !!(draft.situation ?? '').trim();
    draft.situation = el.value;
    // 비었다/채워졌다가 바뀔 때만 출발 버튼을 다시 그린다 (입력 중인 칸은 그대로)
    if (had !== !!el.value.trim()) root?.querySelector<HTMLButtonElement>('.gx-foot .gx-start')?.toggleAttribute('disabled', !el.value.trim() || busy);
    return;
  }
  if (el?.dataset?.input !== 'mission-query') return;
  field.query = el.value;
  const box = root?.querySelector('.gx-mbox');
  if (box && (view.kind === 'started' || view.kind === 'opening')) box.innerHTML = missionList(view.ctx, view.kind === 'opening');
}

/** 고른 사진을 줄여 저장하고 작성 중인 첨부에 넣는다 (괴담넷 gn · 괴담톡 ph) */
async function addPhotos(prefix: string, files: File[]): Promise<void> {
  if (view.kind !== 'started') return;
  const ui = prefix === 'gn' ? gnet : prefix === 'ph' ? phone : null;
  if (!ui) return;
  if (prefix === 'gn' && !gnet.compose) return;
  if (prefix === 'ph') {
    const r = readPhone(view.ctx.chat).rooms[phone.room ?? ''];
    if (!r || !r.members.length || r.pending) return;
  }
  for (const file of files) {
    if (ui.attach.length >= ATTACH_MAX) {
      ui.notice = `첨부는 ${ATTACH_MAX}개까지예요.`;
      break;
    }
    try {
      const { asset, preview } = await savePhoto(file);
      addPhoto(ui.attach, asset, preview);
      ui.notice = '';
    } catch (error) {
      ui.notice = error instanceof Error ? error.message : String(error);
      break;
    }
  }
  render();
}

/** quietIfNotLite: 플로팅 버튼에서 열 때는 괴이봇 Lite가 아니면 아무것도 띄우지 않는다. */
let widthWatch = false;
export async function openApp(opts: { quietIfNotLite?: boolean } = {}): Promise<void> {
  ensureRoot();
  if (opts.quietIfNotLite) {
    const ctx = await loadContext().catch(() => null);
    if (!ctx || !isGoeiLore(ctx.char.globalLore)) return;
  }
  view = { kind: 'loading' };
  notice = '';
  render();
  shown = true;
  if (root) startCctvFx(root);
  await showWindow();
  await refresh();
  // 에셋 모듈의 표정 세트(위키 인물 사진). 목록이 바뀌었으면 한 번 다시 그린다
  void loadModuleAssets().then((changed) => {
    if (shown && changed) render();
  });
  // 유저 사진·이름 (ID카드). 읽히면 한 번 다시 그린다
  void readUser().then((u) => {
    if (shown && (u.name || u.photo)) render();
  });
  void checkLatest(settingsEnv); // 새 버전이 있으면 설정 → 업데이트에 표시 (세션에 한 번)
}

/** 채팅 속 상태창의 위키 이름을 눌렀을 때: 창을 그 위키 문서로 연다 */
/** 설치 · 점검 (설계안 9절): 괴이 카드가 아닌 봇에서도 연다. 편집 창이 채팅 정보를 직접 읽는다 */
let installCtx: ChatContext | null = null;
export async function openInstall(): Promise<void> {
  // 플러그인 칸(iframe)이 안 떠 있으면 패널부터 띄운다: 편집 창도 같은 칸 안에 그려져서, 안 띄우면 눌러도 아무것도 안 보인다 (2026-10-27 깡통봇)
  if (!shown) await openApp();
  installCtx = await loadContext().catch(() => null);
  if (!installCtx) {
    ensureRoot();
    view = { kind: 'error', message: '선택된 채팅이 없어요. 설치할 봇의 채팅을 연 뒤 다시 눌러 주세요.' };
    render();
    shown = true;
    await showWindow();
    return;
  }
  const host = {
    ctx: () => installCtx,
    refresh: async () => {
      installCtx = (await loadContext().catch(() => null)) ?? installCtx;
      if (shown) await refresh();
    },
    theme: () => root?.dataset.theme ?? getPrefs().theme ?? 'dark',
  };
  await refreshInstall(installCtx);
  openEditor(host, 'install');
}

export async function openWiki(title: string): Promise<void> {
  await openApp({ quietIfNotLite: true });
  if (view.kind === 'started') await handle('wiki-goto', title);
}

/** 채팅 속 보고서 카드의 「기록에서 보기」: 창을 열고 기록 › 보고서 페이지로 */
export async function openRecords(id: string): Promise<void> {
  await openApp({ quietIfNotLite: true });
  if (view.kind === 'started') await handle('rec-open', id);
}

// 필드 출동이 끝나 보고서가 생기면 (host/game/field.ts → core/journal/notify) 필드 탭 위에 시트를 띄운다. 창이 닫혀 있으면 다음에 열 때 보인다
onReport((n) => {
  if (n.cause !== 'field') return;
  rec.fieldReport = n.id;
  if (shown && view.kind === 'started') void refresh();
});

async function refresh(): Promise<void> {
  try {
    const ctx = await loadContext();
    if (ctx) await prepareBaseDocs(ctx.char.globalLore).catch(() => undefined);
    if (!ctx) {
      view = { kind: 'error', message: `선택된 채팅이 없어요. ${BRAND.name} 채팅을 연 뒤 다시 눌러 주세요.` };
    } else {
      const manifest = readManifest(ctx.char.globalLore);
      const phase = chatPhase(ctx.chat);
      if (manifest) {
        applyAdvanced(ctx.chat.scriptstate);
        void readPersona();
      }
      const chatKey = `${ctx.charIndex}:${ctx.chatIndex}`;
      if (chatKey !== lastChat) {
        lastChat = chatKey;
        navHist.clear();
        resetField(true);
        resetWiki();
        resetRecords();
        resetGnet();
        resetPhone();
        resetSettings();
        resetDirectory();
        pickerPrefs = false;
        repick = false;
      }
      const cur = currentChoice(ctx.chat);
      const facs = factionList(ctx.char.globalLore);
      const presetStaged = phase === 'staged' && !!cur.faction && !!cur.fm && findScenario(cur.faction, cur.fm, facs)?.kind === 'preset';
      if (!manifest) view = { kind: 'not-lite', name: String(ctx.char.name ?? ''), goei: isGoeiLore(ctx.char.globalLore) };
      else if (phase === 'started') view = { kind: 'started', ctx };
      else if (presetStaged && !repick) view = { kind: 'opening', ctx };
      else {
        view = { kind: 'picker', ctx, manifest, staged: phase === 'staged' };
        draft = { faction: cur.faction ?? draft.faction, lang: cur.lang ?? draft.lang, fm: cur.fm ?? draft.fm, player: cur.player ?? draft.player ?? '' };
        if (draft.faction && !facs.some((f) => f.code === draft.faction && !f.hidden)) draft = { lang: draft.lang };
        if (draft.faction && !findScenario(draft.faction, draft.fm ?? 0, facs)) draft.fm = defaultScenario(draft.faction, facs);
      }
    }
  } catch (error) {
    view = { kind: 'error', message: `채팅 정보를 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}` };
  }
  render();
}

async function close(): Promise<void> {
  shown = false;
  stopCctvFx();
  // 창을 닫아도 필드는 유지한다 (멈추고 떼어 둠). 끝나는 때는 「필드 나가기」·채팅 전송(본편이 한 턴 진행)·채팅 바꿈뿐 (2026-10-23 사용자)
  fieldShown = false;
  hideGame();
  await risuai.hideContainer();
}

/**
 * 출발은 눌렀지만 첫 전송 전인 채팅: 테마가 이미 채팅에 적혀 있어서 기본값만 바꾸면 창·시작 카드가 그대로였다.
 * 아직 시작 전이니 이 채팅에도 같이 적는다.
 */
async function stagedTheme(ctx: ChatContext, value: string | undefined): Promise<void> {
  if (value !== 'light' && value !== 'dark' && value !== 'paper') return;
  try {
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) =>
      (chat.message ?? []).length || chat.scriptstate?.['$st_fixed_theme'] === value ? null : { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), $st_fixed_theme: value } },
    );
    if (saved) ctx.chat = saved;
  } catch (error) {
    console.log(`[goei] 테마 저장 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
  render();
}

/** 리스너(클릭·Enter)에서 부를 때: 버린 Promise 의 실패를 기록한다 (아무 흔적 없이 조작이 안 먹는 것을 막는다. QC 2026-10-28) */
const run = (action: string, value?: string): Promise<void> =>
  handle(action, value).catch((error: unknown) => console.log(`[goei] 조작 실패(${action}): ${error instanceof Error ? error.message : String(error)}`));

async function handle(action: string, value?: string): Promise<void> {
  if (busy) return;
  // 상황 상세 창 안의 버튼(위키·지도·목표)이나 다른 조작을 하면 창은 닫는다. 종료는 두 번 눌러야 해서 그대로 둔다
  if (evUi.pop && action !== 'ev-pop' && action !== 'end-event') evUi.pop = '';
  if (agUi.pop && action !== 'agent-info') agUi.pop = '';
  if (action.startsWith('adv-') && (view.kind === 'started' || (view.kind === 'picker' && pickerPrefs))) {
    // 범위: 시작 뒤엔 설정 창 범위(이 채팅/새 채팅 기본값). 시작 전엔 「고급」(gen)은 새 채팅 기본값, 기능 페이지(괴담넷·괴담톡·위키·필드)의
    // 고급 칸은 그 페이지의 다른 값처럼 이 채팅 (2026-10-28 QC: 시작 전 기능 페이지에서 고급 칩을 누르면 기본값에만 적혀 화면이 안 바뀌었다)
    const feat = (value ?? '').split(/[:=]/)[0];
    // 기능 페이지(gn·ph·wk·hq·pp)는 범위 전환이 없고 늘 이 채팅 값을 보여 준다: 시작 뒤 범위가 「새 채팅 기본값」이어도 이 채팅에
    // (2026-10-28 QC: 고급 페이지에서 기본값으로 바꿔 두고 괴담넷 고급 칩을 누르면 기본값에만 적혀 화면이 안 바뀌었다)
    const scope = feat !== 'gen' ? 'chat' : view.kind === 'started' ? (settingsUi.scope === 'defaults' ? 'defaults' : 'chat') : 'defaults';
    await handleAdvanced(action, value, view.ctx, { render, refresh }, scope);
    return;
  }
  // 시작 전(시작 패널 → 설정)에도 기능별 설정 페이지가 열려 있으면 그 기능의 단추를 받는다 (2026-10-26 사용자). chat 객체·scriptstate 는 있다
  const featCtx = view.kind === 'started' || (view.kind === 'picker' && pickerPrefs && settingsUi.page) ? view.ctx : null;
  if (action === 'wiki-back' && view.kind === 'started' && !wiki.history.some((h) => h.view !== 'home') && navHist.can(-1)) {
    // 위키 안에서 옮겨 다닌 길이 없으면 뒤로가기는 무조건 이전 화면 (다른 탭·사원증 창 포함, 사용자 2026-10-26)
    const run = navStep(-1);
    return run ? run() : render();
  }
  if (featCtx && action.startsWith('wiki-') && (await handleWiki(action, value, featCtx, wikiEnv))) return;
  if (featCtx && action.startsWith('pp-') && (await handlePeople(action, value, featCtx, peopleEnv))) return;
  // 기록 메뉴(일지·보고서·인물·세력)와 설정 「기록」 묶음. 상황판 종료 줄·알림의 보고서 지름길(rec-open)·「기록에서 전부 보기」(rec-journal)는 기록 탭으로 넘어간다
  if (featCtx && (action.startsWith('rec-') || action.startsWith('jr-'))) {
    if (action === 'rec-back' && !(await handleRecords(action, value, featCtx, recordsEnv))) {
      // 하위 탭 뿌리에서 뒤로 = 이전 화면 (위키의 뒤로와 같은 규칙)
      const go = navStep(-1);
      return go ? go() : render();
    }
    const switching = (action === 'rec-open' || action === 'rec-journal' || action === 'rec-person' || action === 'rec-people') && tab !== 'records';
    if (switching) {
      tab = 'records';
      notice = '';
      field.confirmEnd = null;
      resetSettings();
    }
    if (action !== 'rec-back' && !(await handleRecords(action, value, featCtx, recordsEnv)) && switching) render();
    return;
  }
  if (action.startsWith('ip-') && (await handleImgPrompt(action, value, { render }))) return;
  if (featCtx && action.startsWith('gn-') && (await handleGnet(action, value, featCtx, gnetEnv))) return;
  if (featCtx && action.startsWith('ph-') && (await handlePhone(action, value, featCtx, phoneEnv))) return;
  if (action === 'ed-open') {
    // 설정·세계 편집 창 (별도 창 하나, 2026-10-27: 모든 설정은 이 창). 시작 전(시작 패널)에도 열 수 있다: ctx 가 있으면
    if (!(view.kind === 'started' || view.kind === 'picker' || view.kind === 'opening')) return;
    if (view.kind === 'picker') pickerPrefs = true; // 시작 전: 설정 단추가 기본값 범위로 가게
    settingsUi.scope = view.kind === 'started' ? (settingsUi.scope === 'defaults' ? 'defaults' : 'chat') : 'defaults';
    openEditor({
      ctx: () => (view.kind === 'started' || view.kind === 'picker' || view.kind === 'opening' ? view.ctx : null),
      refresh: () => refresh(),
      theme: () => root?.dataset.theme ?? 'dark',
      handle: (a, v) => handle(a, v),
      input: panelInput,
      change: panelChange,
      canChat: () => view.kind === 'started',
    }, (value as EditorNode) || undefined);
    return;
  }
  if (action === 'install-open') {
    await openInstall();
    return;
  }
  if (action === 'set-editor-width') {
    await savePrefs((p) => ({ ...p, editorWidth: Math.max(50, Math.min(100, Number(value) || 90)) }));
    return render();
  }
  // 어디서 「설정」을 누르든 설정 창 하나 (2026-10-27 사용자): 괴담넷·괴담톡·위키 판의 설정 단추는 그 기능 페이지로
  const FEAT_SET: Record<string, string> = { 'gn-settings': 'set:gnet', 'ph-settings': 'set:phone', 'wiki-settings': 'set:wiki' };
  if (FEAT_SET[action]) return handle('ed-open', FEAT_SET[action]);
  if (action === 'prefs-open' || action === 'prefs-close') {
    // 시작 전 「새 채팅 기본 설정」: 설정 창을 연다 (패널 안 설정 탭은 없앴다)
    resetSettings();
    resetDirectory();
    settingsUi.scope = 'defaults';
    if (action === 'prefs-open') return handle('ed-open', 'set:screen');
    pickerPrefs = false;
    return render();
  }
  if ((view.kind === 'started' || (view.kind === 'picker' && pickerPrefs)) && action.startsWith('dir-')) {
    if (action === 'dir-save' || action === 'dir-reset') settingsUi.confirm = '';
    await handleDirectory(action, value, view.ctx, settingsEnv);
    return;
  }
  if (view.kind === 'picker' && pickerPrefs && (action.startsWith('set-') || action.startsWith('visit-'))) {
    if (settingsUi.busy) return;
    await handleSettings(action, value, view.ctx, settingsEnv, settingsUi.scope === 'chat' ? 'defaults' : settingsUi.scope);
    if (action === 'set-theme' && view.kind === 'picker' && view.staged) await stagedTheme(view.ctx, value);
    return;
  }
  // visit-*: 필드 설정 화면 (2026-10-23: 이 경로가 없어 뒤로가기·기록 지우기가 안 먹었다)
  if (view.kind === 'started' && (action.startsWith('set-') || action.startsWith('visit-'))) {
    // 설정 창의 범위(이 채팅 / 새 채팅 기본값)를 그대로 따른다. 2026-10-28 QC: 「새 채팅 기본값」을 골라도 'chat' 으로 바꿔 보내서
    // 화면은 기본값을 보여 주는데 값은 이 채팅에 적히던 문제. 테마만은 화면 페이지(범위 전환 없음)에 있어 시작 뒤엔 늘 이 채팅에
    const scope = action === 'set-theme' ? 'chat' : settingsUi.scope === 'defaults' ? 'defaults' : 'chat';
    if (!settingsUi.busy) await handleSettings(action, value, view.ctx, settingsEnv, scope);
    return;
  }
  if (action === 'upd-go') {
    // 설정 창의 업데이트 페이지로
    return handle('ed-open', 'set:update');
  }
  if (action.startsWith('upd-') && (view.kind === 'started' || view.kind === 'picker') && (await handleUpdate(action, view.ctx, settingsEnv))) return;
  // 상황판(CCTV·일지·상세 창)에서 「선택」: 목표로 고르고 바로 임무 지도로, 그 자리를 고른 채로 (2026-10-21 사용자)
  if (action === 'pick-event' && view.kind === 'started' && tab !== 'map') {
    await handleField(action, value, view.ctx, env, false);
    if (field.target?.type === 'event' && field.target.key === value && showOnMap(view.ctx, value ?? '')) {
      tab = 'map';
      evUi.pop = '';
      // 모바일은 지도(목표) 단계를 먼저 보여 준다. 편성은 위 「편성」으로
      field.step = 'goal';
      notice = '';
      render();
    }
    return;
  }
  if ((view.kind === 'started' || view.kind === 'opening') && (await handleField(action, value, view.ctx, env, view.kind === 'opening'))) return;
  switch (action) {
    case 'close':
      return close();
    case 'game-open':
      return handle('tab', 'field');
    case 'game-close':
      // 필드에서 나눈 대화가 상황판·설정(필드)에 바로 보이게 채팅을 다시 읽는다
      closeGame();
      if (tab === 'field') tab = 'board';
      return refresh();
    case 'faction': {
      const facs = view.kind === 'picker' ? factionList(view.ctx.char.globalLore) : SCENARIOS.factions;
      const f = findFaction(value ?? '', facs);
      if (!f) return;
      if (draft.faction !== f.code) {
        draft.fm = defaultScenario(f.code, facs);
        draft.player = '';
      }
      draft.faction = f.code;
      notice = '';
      return renderPicker();
    }
    case 'lang':
      if (value === 'ko' || value === 'en') draft.lang = value;
      return renderPicker();
    case 'fm':
      draft.fm = Number(value);
      notice = '';
      return renderPicker();
    case 'player': {
      draft.player = value ?? '';
      // 준비된 첫 장면은 신입 시점이라 캐릭터로 시작하면 직접 입력·커스텀 임무만 고를 수 있다
      if (draft.player && draft.faction && view.kind === 'picker') {
        const f = findFaction(draft.faction, factionList(view.ctx.char.globalLore));
        if (f && findScenario(f.code, draft.fm ?? 0, factionList(view.ctx.char.globalLore))?.kind === 'opening') draft.fm = f.scenarios.find((x) => x.kind !== 'opening')?.fm;
      }
      notice = '';
      return renderPicker();
    }
    case 'start':
      return start();
    case 'nav-tab':
    case 'tab':
      // PC 왼쪽 메뉴(nav-tab): 이미 보고 있는 탭을 한 번 더 누르면 상황판으로 (2026-10-21 사용자, 모바일 아래 줄(tab)은 그대로)
      if (action === 'nav-tab' && value === tab && value !== 'board' && !matchMedia('(max-width: 760px)').matches) value = 'board';
      if (value === 'settings') return handle('ed-open', 'set:screen');
      tab = TABS.includes(value as Tab) ? (value as Tab) : 'board';
      notice = '';
      // 지도·커스텀 임무에서 고른 목표·편성은 다른 탭에 다녀와도 그대로 둔다
      field.confirmEnd = null;
      resetSettings();
      render();
      // 「창을 열 때」 확인: 본편이 진행됐으면 이 탭을 열 때 한 번
      if (view.kind === 'started' && tab === 'phone') openCheck(view.ctx, phoneEnv);
      if (view.kind === 'started' && tab === 'gnet') gnetOpenCheck(view.ctx, gnetEnv);
      return;
    case 'nav-back':
    case 'nav-fwd': {
      markUi.pop = false;
      const run = navStep(action === 'nav-back' ? -1 : 1);
      return run ? run() : render();
    }
    case 'mk-pop':
      markUi.pop = !markUi.pop;
      return render();
    case 'mk-go': {
      const m = marks()[Number(value)];
      if (!m || view.kind !== 'started') return;
      markUi.pop = false;
      closeDrawer();
      if (gameOpen()) closeGame();
      return applyNav(openable(view.ctx, m.s as unknown as NavState));
    }
    case 'mk-here':
    case 'mk-add': {
      if (view.kind !== 'started') return;
      const m = action === 'mk-here' ? markOf(navState()) : markCandidates(recentMarks(), markOf(navState()))[Number(value)];
      if (m) await addMark(m);
      return render();
    }
    case 'mk-del':
      await removeMarkAt(Number(value));
      return render();
    case 'feature-set':
      // 기능 설정은 설정 창의 그 페이지로 (2026-10-27)
      if (value === 'phone' || value === 'wiki' || value === 'visit' || value === 'people' || value === 'image' || (value === 'gnet' && GNET_ON)) return handle('ed-open', `set:${value}`);
      return;
    case 'ops-sel':
      // 관제실 상황판: 일지 줄·지도 표시 → 왼쪽 큰 보기가 그 상황으로. 보던 화면(CCTV·위성)은 그대로 (2026-10-21 사용자). 모바일은 큰 보기로 올라간다
      opsUi.sel = value ?? '';
      field.confirmEnd = null;
      render();
      if (matchMedia('(max-width: 760px)').matches) root?.querySelector('.gx-opview')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    case 'ops-mode':
      opsUi.mode = value === 'map' ? 'map' : 'feed';
      return render();
    case 'ev-pop':
      // 그림 카드 상세 창: 카드를 누르면 열고, 바깥·×·Esc·뒤로 밀기로 닫는다
      evUi.pop = evUi.pop === value ? '' : value ?? '';
      return render();
    case 'board-map':
      // 상황판 행: 지도 탭에서 그 자리를 연다
      if (view.kind !== 'started' || !showOnMap(view.ctx, value ?? '')) return;
      tab = 'map';
      notice = '';
      return render();
    case 'id-card': {
      // 모바일: 머리의 ID카드 버튼 → 왼쪽 패널과 같은 카드를 작은 창으로
      if (view.kind !== 'started') return;
      showIdCard(idCard(view.ctx), (a, v) => void run(a, v));
      return;
    }
    case 'wallet-pop':
      // 옛 잔고 칩 → 가계부 탭
      return handle('tab', 'wallet');
    case 'wallet-filter':
      walletTabUi.filter = value === 'in' || value === 'out' ? value : 'all';
      return render();
    case 'wallet-open':
      walletTabUi.open = walletTabUi.open === value ? null : value ?? null;
      return render();
    case 'wallet-edit':
      // 잔고 칸 ✎: 그 자리에 잔고 고치기 칸 (잔고 직접 수정이 켜져 있을 때만)
      if (view.kind !== 'started' || !walletEditable(view.ctx.chat.scriptstate)) return;
      walletTabUi.edit = !walletTabUi.edit;
      walletTabUi.notice = '';
      render();
      if (walletTabUi.edit) root?.querySelector<HTMLInputElement>('[name="wt-adj"]')?.focus();
      return;
    case 'wallet-del': {
      if (view.kind !== 'started' || !value || !walletEditable(view.ctx.chat.scriptstate)) return;
      const ctx = view.ctx;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const w = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(removeWalletEntry(w, value ?? '')) } };
      });
      return refresh();
    }
    case 'wallet-adj': {
      if (view.kind !== 'started' || !walletEditable(view.ctx.chat.scriptstate)) return;
      const n = parseWon(value ?? '');
      if (n === null) {
        walletTabUi.notice = '금액을 읽을 수 없어요. 숫자 또는 「120만」처럼 적어 주세요.';
        return render();
      }
      const ctx = view.ctx;
      await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
        const w = readWallet(chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
        return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...walletVars(adjustWallet(w, aliveAnchors(chat), n)) } };
      });
      walletTabUi.notice = '';
      walletTabUi.edit = false;
      return refresh();
    }
    case 'agents-view':
      // 상황판 요원 칸 제목줄의 모니터·목록 아이콘 (설정 「요원 칸」과 같은 기기 공통 값)
      if (value !== 'wall' && value !== 'list') return;
      await savePrefs((p) => ({ ...p, agents: value === 'list' ? 'list' : undefined }));
      return render();
    case 'agent-info':
      // 상황판 요원 칸: 사원증 창을 열고, 바깥·×·Esc·뒤로 밀기로 닫는다
      agUi.pop = agUi.pop === value ? '' : value ?? '';
      return render();
    case 'agent-talk':
      // 상황판 요원 카드의 톡: 괴담톡 탭으로 넘어가 그 요원과의 1:1 방을 연다
      if (view.kind !== 'started') return;
      tab = 'phone';
      notice = '';
      resetField();
      if (!(await openAgentDm(view.ctx, phoneEnv, value ?? ''))) render();
      if (view.kind === 'started') openCheck(view.ctx, phoneEnv);
      return;
    case 'wiki-goto':
      // 지도·커스텀 임무 목록의 「위키」: 위키 탭으로 넘어가 그 제목을 연다 (없으면 작성 화면)
      if (view.kind !== 'started') return;
      tab = 'wiki';
      resetWiki();
      gnet.compose = null;
      phone.view = phone.view === 'room' ? 'room' : 'list';
      resetField();
      await handleWiki('wiki-write', value, view.ctx, wikiEnv);
      return;
    case 'people-goto':
      // 사원증 창의 「기록」: 기록 탭 › 인물 › 그 사람 (2026-10-29: 위키에서 기록 메뉴로 옮김)
      if (view.kind !== 'started' || !value || !hasPersonRecord(view.ctx, value)) return;
      tab = 'records';
      gnet.compose = null;
      phone.view = phone.view === 'room' ? 'room' : 'list';
      resetField();
      await handleRecords('rec-person', value, view.ctx, recordsEnv);
      return;
    case 'repick':
      repick = true;
      notice = '';
      return refresh();
    case 'world-on':
      return turnWorldOn();
  }
}

async function start(): Promise<void> {
  if (view.kind !== 'picker' || !draft.faction || !draft.fm) return;
  const { ctx, manifest } = view;
  busy = true;
  notice = '';
  render();
  try {
    const choice = { faction: draft.faction, lang: draft.lang, fm: draft.fm, ...(draft.player ? { player: draft.player } : {}) };
    const lore = ctx.char.globalLore ?? [];
    let world = null;
    try {
      // 기본값에서 상황판을 꺼 두었으면 상황판 없이 시작 (나중에 설정 탭에서 켤 수 있음)
      if (basicDefaults(lore).anomalyOn) world = startWorldVars(parseCatalog(lore), worldDefaults(lore), choice.faction, Math.random, draft.player ?? '');
    } catch (error) {
      // 목록 로어북이 없으면 상황판 없이 시작한다 (대화는 그대로 가능)
      console.log(`[goei] 상황판 준비 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
    const plan = planStart(choice, manifest, lore, ctx.char.alternateGreetings?.length ?? 0, world);
    // 직접 입력: 적어 둔 상황을 첫 메시지로 놓고 바로 보낸다
    const situation = plan.kind === 'direct' ? (draft.situation ?? '').trim() : '';
    if (plan.kind === 'direct' && !situation) throw new StartError('시작할 상황을 적어 주세요.');
    // 시작 메시지: 자동 전송 없이 첫 장면 아래에 「적고 전송」 안내 (Risu가 첫 장면을 다시 그리기 전에 켠다)
    setOpeningHint(plan.kind === 'opening' ? (ctx.char.alternateGreetings?.[plan.fmIndex] ?? null) : null);
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (chatPhase(chat) === 'started') throw new StartError('그새 대화가 시작됐어요. 새 채팅에서 다시 골라 주세요.');
      const next = applyStart(chat, plan);
      if (situation) next.message = [...(next.message ?? []), newMessage(startRecord(situation))];
      // 새 채팅 기본값(설정 창)을 이 채팅에 적어 둔다. 나중에 기본값을 바꿔도 이 채팅은 그대로 (원본 ensureDefaults)
      const theme = getPrefs().theme ?? 'dark';
      return {
        ...next,
        scriptstate: { ...basicVars(basicDefaults(lore)), ...worldVarsOf(worldDefaults(lore)), $st_fixed_theme: theme, ...(getPrefs().vars ?? {}), ...(next.scriptstate ?? {}) },
      };
    });
    if (!saved) throw new StartError('저장하지 못했어요.');
    if (plan.seedMissing.length) console.log(`[goei] 시작 자료 누락: ${plan.seedMissing.join(', ')}`);
    busy = false;
    repick = false;
    // 시작 전 설정 창은 「새 채팅 기본값」 범위였다. 시작한 뒤 처음 여는 설정 창은 이 채팅부터 (2026-10-28 QC)
    settingsUi.scope = 'chat';
    pickerPrefs = false;
    if (plan.kind === 'preset') {
      // 커스텀 임무: 창을 닫지 않고 바로 목표·동행 고르기로
      resetField(true);
      return refresh();
    }
    draft.situation = '';
    // 자동 전송이 막혀도 창은 닫고, 채팅 속 메시지 아래에 「전송 대기」와 취소를 붙인다 (임무 요청과 같이)
    if (situation && !(await sendNow())) await markUnsent(ctx.charIndex, ctx.chatIndex).catch(() => {});
    await close();
    await refresh();
  } catch (error) {
    busy = false;
    notice = error instanceof Error ? error.message : String(error);
    render();
  }
}

/** 상황판 없이 시작한 채팅(이전 버전)에서 상황판을 켠다 */
async function turnWorldOn(): Promise<void> {
  if (view.kind !== 'started') return;
  const { ctx } = view;
  busy = true;
  notice = '';
  render();
  try {
    const catalog = parseCatalog(ctx.char.globalLore);
    await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (worldOn(chat)) return null;
      const faction = String(chat.scriptstate?.['$st_faction'] ?? '');
      return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...startWorldVars(catalog, worldSettings(ctx.char.globalLore, chat.scriptstate), faction, Math.random, String(chat.scriptstate?.['$st_player'] ?? '')) } };
    });
    busy = false;
    await refresh();
  } catch (error) {
    busy = false;
    notice = error instanceof Error ? error.message : String(error);
    render();
  }
}

const TAB_TITLE: Record<Tab, string> = {
  board: '상황판', map: '임무', mission: '커스텀', gnet: '괴담넷', phone: '괴담톡', wiki: '위키', field: '필드', records: '기록', wallet: '가계부', settings: '설정',
};

function header(sub: string, extra = ''): string {
  return `<header class="gx-head">
    <div class="gx-brand"><span class="gx-logo">${GHOST_ICON}</span><div><b aria-label="${BRAND.name}">${brandHtml('var(--text)', 'var(--signal)')}</b><small>${esc(sub)}</small></div></div>
    <div class="gx-head-act">${extra}<button class="gx-x" data-action="close" aria-label="닫기">${ICONS.close}</button></div>
  </header>`;
}

// 필드: PC는 옆 메뉴, 모바일은 머리 버튼 (2026-10-23 사용자)
const gameShown = (): boolean => true;

/** 진행 중 화면의 머리: 지금 탭 이름 (위협도는 기준이 헷갈리기만 해서 아예 뺐다, 사용자 결정) */
function startedHeader(ctx: ChatContext): string {
  return `<header class="gx-head">
    <div class="gx-brand gx-tabhead"><span class="gx-hmark"><span class="gx-logo">${GHOST_ICON}</span><span class="gx-mark-txt"><b aria-label="${BRAND.name}">${brandHtml('var(--text)', 'var(--signal)')}</b></span></span><span class="gx-hsep" aria-hidden="true">›</span><span class="gx-tabicon">${tab === 'field' ? ICONS.game : ICONS[tab]}</span><div><b>${tab === 'gnet' ? gnetLabel(ctx.chat.scriptstate) : TAB_TITLE[tab]}</b></div></div>
    <div class="gx-head-act">
      ${walletHeadButton(ctx, tab === 'wallet')}
      ${gameShown() ? `<button class="gx-x gx-fieldbtn${tab === 'field' ? ' on' : ''}" data-action="tab" data-value="field" aria-label="필드" title="필드">${ICONS.game}</button>` : ''}
      <button class="gx-x gx-recbtn${tab === 'records' ? ' on' : ''}" data-action="tab" data-value="records" aria-label="기록" title="기록">${ICONS.records}</button>
      <button class="gx-x gx-idbtn" data-action="id-card" aria-label="내 ID카드">${userInfo().photo ? `<img src="${esc(userInfo().photo!)}" alt="">` : ICONS.idcard}</button>
      <button class="gx-x" data-action="ed-open" data-value="set:screen" aria-label="설정">${ICONS.settings}${hasUpdate(ctx) ? '<span class="gx-xdot" aria-label="새 버전"></span>' : ''}</button>
      <button class="gx-x" data-action="close" aria-label="닫기">${ICONS.close}</button></div>
  </header>`;
}

/**
 * 시작 화면에서 세력·장면·언어를 고를 때: 세력 카드(큰 사진)는 그대로 두고 표시만 바꾸고, 나머지 칸만 새로 넣는다.
 * 창 전체를 다시 그리면 세력 사진 다섯 장을 매번 새로 풀어서 그려 버벅였다 (v0.10.1).
 */
function renderPicker(): void {
  const facs = root?.querySelectorAll<HTMLElement>('.gx-facs .gx-fac');
  const main = root?.querySelector('.gx-body');
  if (!root || view.kind !== 'picker' || !facs?.length || !main || root.querySelector('.gx-settings')) return render();
  const tpl = document.createElement('template');
  tpl.innerHTML = body();
  const next = tpl.content.querySelectorAll<HTMLElement>('.gx-facs .gx-fac');
  if (next.length !== facs.length) return render();
  next.forEach((b, i) => {
    // 사진이 막 도착한 카드만 통째로 바꾸고, 나머지는 표시만 바꾼다
    if (b.classList.contains('has-img') !== facs[i].classList.contains('has-img')) return void facs[i].replaceWith(b);
    facs[i].className = b.className;
    facs[i].setAttribute('aria-pressed', b.getAttribute('aria-pressed') ?? 'false');
  });
  const sections = main.querySelectorAll(':scope > section');
  const fresh = tpl.content.querySelectorAll('.gx-body > section');
  if (sections.length !== fresh.length) return render();
  for (let i = 1; i < sections.length; i++) sections[i].replaceWith(fresh[i]);
  const foot = root.querySelector('.gx-foot');
  const nfoot = tpl.content.querySelector('.gx-foot');
  if (foot && nfoot) foot.replaceWith(nfoot);
  else return render();
}

const INNER_SCROLL = '.gx-acards, .gx-sidecol, .gx-mbox, .gx-sits, .gx-bd-col > .gx-evcs, .nw-groups';
/** 설정 기능 페이지(인물 기록 설정 등)·위키 문서 칸(인물 상세·기록 문서): .gx-body 가 아니라 이 칸이 실제로 스크롤된다.
 *  같은 페이지(pageKey)를 다시 그릴 때만 자리를 지킨다 (다른 문서로 넘어가면 맨 위부터) */
const PAGE_SCROLL = '.st-featpage .ph-form-body, .nw-pane .nw-doc';
const pageKey = () => `${tab}|${settingsUi.page}|${wiki.view}|${wiki.title}|${rec.sub}|${rec.view}|${rec.id}`;

function render(): void {
  if (!root) return;
  // 설정 창의 설정 페이지는 패널 상태를 그대로 보여 주므로 패널을 다시 그릴 때 같이 그린다 (2026-10-27)
  if (editorOpen() && editorOnSettings()) queueMicrotask(() => editorRender());
  const nav = view.kind === 'started';
  // 종료 알림 오버레이: 새 보고서가 있으면 한 번 띄운다 (창이 닫혀 있었으면 지금, 이 그리기에서)
  if (view.kind === 'started') syncCloseToast(view.ctx.chat, render);
  // 다시 그려도 읽던 자리를 지킨다
  const scroller = root.querySelector('.gx-body');
  const keep = scroller && root.dataset.tab === tab ? scroller.scrollTop : 0;
  // 안쪽 스크롤 칸(편성 요원 목록·사이드 칸 등)도 같은 탭이면 자리를 지킨다
  const inner = root.dataset.tab === tab ? [...root.querySelectorAll<HTMLElement>(INNER_SCROLL)].map((el) => el.scrollTop) : [];
  // 설정 기능 페이지·위키 문서 칸: 진단 행 펼치기·📌·취소처럼 전체를 다시 그려도 그 칸의 자리를 지킨다 (맨 위로 튀던 문제, 2026-10-26)
  const pageKeep = root.dataset.pk === pageKey() ? [...root.querySelectorAll<HTMLElement>(PAGE_SCROLL)].map((el) => el.scrollTop) : [];
  // 괴담톡 대화: 맨 아래를 보고 있었으면(또는 방을 새로 열면) 다시 그린 뒤에도 맨 아래로
  const log = root.querySelector<HTMLElement>('.ph-log');
  const logRoom = root.dataset.room ?? '';
  const logKeep = log && logRoom === (phone.room ?? '') ? (log.scrollHeight - log.scrollTop - log.clientHeight < 60 ? -1 : log.scrollTop) : -1;
  // 괴담넷: 같은 글·쪽지를 보고 있으면 목록과 본문의 스크롤 자리를 지킨다 (답글을 누르면 맨 위로 튀던 문제)
  const gnKey = `${gnet.sub}:${gnet.open}:${gnet.openDm}`;
  const gnKeep = tab === 'gnet' && root.dataset.tab === 'gnet' && root.dataset.gn === gnKey
    ? ['.gn .ph-content', '.gn-pane .gn-doc'].map((q) => root!.querySelector<HTMLElement>(q)?.scrollTop ?? 0)
    : null;
  // 글을 치는 중에 다시 그려도(사진이 늦게 도착하는 등) 그 칸에 커서를 돌려준다
  const act = document.activeElement as HTMLInputElement | null;
  const focusSel = act && root.contains(act) && act.dataset?.input
    ? `[data-input="${CSS.escape(act.dataset.input)}"]${act.dataset.key ? `[data-key="${CSS.escape(act.dataset.key)}"]` : ''}`
    : '';
  const caret = focusSel && typeof act!.selectionStart === 'number' ? [act!.selectionStart, act!.selectionEnd ?? act!.selectionStart] : null;
  root.dataset.theme = themeOf();
  // 창 모양 (설정 → 화면): 메뉴 위치, 창 바깥 어둡기
  const pf = getPrefs();
  root.dataset.nav = pf.nav ?? 'left';
  root.dataset.wikiSide = pf.wikiSide ?? 'left';
  // --dim은 글자색 변수라 겹치면 안 된다. 테마별 막 색에 투명도만 바꿔 바로 칠함
  paintVeil(root, pf.dim ?? DIM_DEFAULT);
  // 창 둘레 기기 틀 (설정 → 화면 「외부 프레임」, PC만, ui/frame.ts). 창 크기는 그대로, 틀만 바깥으로. 좁으면 틀만 숨긴다
  const fr = frameState(pf.frame, nav);
  root.dataset.frame = fr.kind;
  if (fr.hidden) root.dataset.frameHidden = '1';
  else delete root.dataset.frameHidden;
  // 시작 전(고르기·첫 장면) 화면은 PC에서 설정 화면 폭만큼만 (너무 넓으면 가운데만 차고 양옆이 빈다)
  const panel = `<div class="gx-panel${nav ? ' has-nav' : ' pre'}">${body()}</div>`;
  root.innerHTML = fr.kind === 'none' ? panel : frameHtml(fr.kind, !nav, panel);
  // 명부 통합 검색에서 고른 줄로 (위쪽 고정 줄에 가리지 않게 가운데로)
  if (dirUi.scrollTo) {
    dirUi.scrollTo = '';
    root.querySelector('.dir-row.open')?.scrollIntoView({ block: 'center' });
  }
  root.dataset.tab = tab;
  const toastEl = root.querySelector<HTMLElement>('.gx-rectoast');
  if (toastEl) {
    toastEl.addEventListener('pointerenter', holdToast);
    toastEl.addEventListener('pointerleave', () => releaseToast(render));
  }
  if (focusSel) {
    const el = [...root.querySelectorAll<HTMLInputElement>(focusSel)].find((x) => x.offsetParent);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* 커서를 못 두는 칸 */ }
    }
  }
  syncField();
  const next = root.querySelector('.gx-body');
  if (next && keep) next.scrollTop = keep;
  if (inner.length) root.querySelectorAll<HTMLElement>(INNER_SCROLL).forEach((el, i) => inner[i] && (el.scrollTop = inner[i]));
  root.dataset.pk = pageKey();
  if (pageKeep.length) root.querySelectorAll<HTMLElement>(PAGE_SCROLL).forEach((el, i) => pageKeep[i] && (el.scrollTop = pageKeep[i]));
  const nlog = root.querySelector<HTMLElement>('.ph-log');
  root.dataset.room = phone.room ?? '';
  if (nlog) {
    nlog.scrollTop = logKeep < 0 ? nlog.scrollHeight : logKeep;
    // 사진이 늦게 뜨면 높이가 바뀌므로 맨 아래를 보던 중이면 한 번 더
    if (logKeep < 0) nlog.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => (nlog.scrollTop = nlog.scrollHeight), { once: true }));
  }
  root.dataset.gn = gnKey;
  if (gnKeep) ['.gn .ph-content', '.gn-pane .gn-doc'].forEach((q, i) => {
    const el = root!.querySelector<HTMLElement>(q);
    if (el && gnKeep[i]) el.scrollTop = gnKeep[i];
  });
  hydratePhotos(root);
  labelSwitches(root);
  bindMapZoom(root);
  bindMbar(root, () => void run('close'));
  bindDrawer(root, () => void run('mk-pop'));
  bindWikiSide(root, (v) => void run('wiki-list', v));
  bindFootnotes(root);
  const stBar = root.querySelector<HTMLElement>('.gx-settings > .st-scopebar');
  if (stBar) stBar.parentElement!.style.setProperty('--stbar', `${stBar.offsetHeight}px`);
  bindSwipeBack(root, navStep);
  if (view.kind === 'started') navHist.record(navState());
  // PC ‹ › : 기록은 그린 뒤에 적으니 단추 상태는 여기서
  root.querySelectorAll<HTMLButtonElement>('.gx-nh[data-action^="nav-"]').forEach((b) => (b.disabled = !navHist.can(b.dataset.action === 'nav-back' ? -1 : 1)));
  setCurrentTheme(themeName(root.dataset.theme));
}

/** 모바일 상황판 하단 서랍: 즐겨찾기 다섯 칸 (2026-10-20 사용자: 순찰·설정 두 버튼 자리를 즐겨찾기로. 설정은 위 머리에 있다) */
function boardDrawer(): string {
  if (!matchMedia('(max-width: 760px)').matches) return '';
  return drawerHtml(markSlots(), '', 'gx-bdrawer');
}

/** 앞뒤 이동 기록에 적는 화면 상태: 지금 탭과 그 탭 안에서 어디를 보고 있는지 (입력 중인 글·고른 값은 넣지 않는다) */
interface NavState {
  tab: Tab;
  w?: { view: string; title: string; list: boolean };
  /** 기록 탭: 하위 탭·화면·대상 */
  r?: RecordsNav;
  p?: { sub: string; tab: string; view: string; room: string | null; n: number | null };
  g?: { sub: string; open: number | null; dm: string | null; s: boolean; c: unknown };
  f?: 'goal' | 'team';
  d?: string;
  /** 상황판 사원증 창 (열려 있으면 요원 이름) */
  a?: string;
}
const navHist = new NavHistory<NavState>();

function navState(): NavState {
  const s: NavState = { tab };
  if (tab === 'wiki') s.w = { view: wiki.view, title: wiki.title, list: wiki.listOpen };
  if (tab === 'records') s.r = recordsNav();
  if (tab === 'phone') s.p = { sub: phone.sub, tab: phone.tab, view: phone.view, room: phone.room, n: phone.openNotice };
  // 괴담넷 글쓰기·새 쪽지 화면만 기록 (댓글 답글 칸은 화면 이동이 아니다)
  if (tab === 'gnet') s.g = { sub: gnet.sub, open: gnet.open, dm: gnet.openDm, s: gnet.settings, c: gnet.compose?.kind === 'post' || gnet.compose?.kind === 'newdm' ? gnet.compose : null };
  if (tab === 'map' || tab === 'mission') s.f = field.step;
  if (tab === 'settings') s.d = dirUi.open;
  if (tab === 'board' && agUi.pop) s.a = agUi.pop;
  return s;
}

/** 즐겨찾기로 적을 화면 상태: 쓰던 글·펼친 목록은 빼고 화면만 */
function markState(s: NavState): NavState {
  const o: NavState = JSON.parse(JSON.stringify(s));
  if (o.w) o.w.list = false;
  if (o.g) o.g.c = null;
  if (o.p && o.p.view !== 'room' && o.p.view !== 'settings' && o.p.view !== 'notice') Object.assign(o.p, { view: 'list', room: null, n: null });
  return o;
}

const PH_SUB: Record<string, string> = { contacts: '연락처', chats: '대화', notices: '공지' };

/** 화면 상태 → 즐겨찾기 이름 (위키 문서 제목, 괴담톡 방 이름, 괴담넷 글 제목…) */
function markOf(raw: NavState): Mark {
  const s = markState(raw);
  const ctx = view.kind === 'started' ? view.ctx : null;
  let name = s.tab === 'gnet' ? gnetLabel(ctx?.chat.scriptstate) : TAB_TITLE[s.tab];
  if (s.w) name = s.w.view === 'doc' || s.w.view === 'compose' ? s.w.title || '위키' : s.w.view === 'settings' ? '위키 설정' : s.w.view === 'new' ? '위키 새 문서' : '위키 메인';
  if (s.r) name = recordsMarkName(s.r, ctx?.chat ?? null);
  if (s.p) {
    const r = s.p.view === 'room' && s.p.room && ctx ? readPhone(ctx.chat).rooms[s.p.room] : undefined;
    name = r ? roomLabel(r) : s.p.view === 'settings' ? '괴담톡 설정' : `괴담톡 ${PH_SUB[s.p.sub] ?? ''}`.trim();
  }
  if (s.g) {
    const post = s.g.open !== null && ctx ? findPost(readGnet(ctx.chat), s.g.open) : undefined;
    name = s.g.s ? `${gnetLabel(ctx?.chat.scriptstate)} 설정` : post ? post.title || `${gnetLabel(ctx?.chat.scriptstate)} 글` : s.g.dm ? `${s.g.dm} 쪽지` : s.g.sub === 'dm' ? '괴담넷 쪽지' : '괴담넷';
  }
  if (s.f === 'team') name = `${name} 편성`;
  if (s.tab === 'settings' && s.d) name = '명부';
  return { s: s as unknown as Mark['s'], name };
}

/** 최근 본 화면 (설정은 빼고) */
function recentMarks(): Mark[] {
  const seen = new Set<string>();
  return navHist.recent().filter((s) => s.tab !== 'settings').map(markOf).filter((m) => {
    const k = JSON.stringify(m.s);
    return !seen.has(k) && (seen.add(k), true);
  });
}

/** 다른 채팅에서 넣은 즐겨찾기: 이 채팅에 없는 괴담톡 방은 목록으로 */
function openable(ctx: ChatContext, s: NavState): NavState {
  const o: NavState = JSON.parse(JSON.stringify(s));
  // 옛 즐겨찾기: 위키 안 인물·개인 기록·기록 문서·세력 화면은 기록 탭으로 (2026-10-29)
  const legacy = o.tab === 'wiki' && o.w ? legacyWikiNav(o.w.view, o.w.title) : null;
  if (legacy) {
    o.tab = 'records';
    o.r = legacy;
    delete o.w;
  }
  if (!TABS.includes(o.tab)) o.tab = 'board';
  if (o.p?.room && !readPhone(ctx.chat).rooms[o.p.room]) Object.assign(o.p, { view: 'list', room: null });
  return o;
}

function applyNav(s: NavState): void {
  tab = s.tab;
  notice = '';
  field.confirmEnd = null;
  if (s.w) Object.assign(wiki, { view: s.w.view, title: s.w.title, listOpen: s.w.list });
  if (s.r) applyRecordsNav(s.r);
  if (s.p) Object.assign(phone, { sub: s.p.sub, tab: s.p.tab, view: s.p.view, room: s.p.room, openNotice: s.p.n });
  if (s.g) Object.assign(gnet, { sub: s.g.sub, open: s.g.open, openDm: s.g.dm, settings: s.g.s, compose: s.g.c });
  if (s.d !== undefined) dirUi.open = s.d;
  agUi.pop = s.a ?? '';
  // 편성 단계는 목표를 골라야 갈 수 있으니 버튼과 같은 길로 (못 가면 목표 단계에 머문다)
  if (s.f && s.f !== field.step) return void run('field-step', s.f);
  render();
}

let fieldShown = false;
let fieldAnchor = '';
/** 필드 탭이면 게임을 본문 자리에 붙이고(없으면 연다), 다른 탭이면 닫는다 */
function syncField(): void {
  const host = view.kind === 'started' && tab === 'field' ? root?.querySelector('.gx-fieldhost') ?? null : null;
  if (!host) {
    // 다른 탭: 게임은 닫지 않고 떼어 둔다(멈춤·소리 끔). 창을 닫거나 「필드 나가기」 때만 끝난다
    if (gameOpen() && fieldShown) {
      fieldShown = false;
      hideGame();
      // 필드에서 나눈 대화가 바로 보이게
      void refresh();
    }
    return;
  }
  fieldShown = true;
  // 본편이 한 턴 진행됐으면(마지막 메시지가 바뀜) 요원 배치·막간이 새로 정해지니 처음부터
  const anchor = view.kind === 'started' ? `${view.ctx.chat.id ?? ''}:${anchorOf(view.ctx.chat)}` : '';
  if (gameOpen() && anchor !== fieldAnchor) closeGame();
  fieldAnchor = anchor;
  if (gameOpen()) reattachGame(host);
  else openGame(host, () => void run('game-close'));
}

/** 모바일 쓸기가 할 일 (브라우저 ←·→ 처럼): dir -1 뒤로, 1 앞으로. 갈 곳이 없으면 null */
function navStep(dir: -1 | 1): (() => void) | null {
  const go = (action: string, value?: string) => () => void run(action, value);
  if (view.kind === 'picker') return dir < 0 && pickerPrefs ? go('prefs-close') : null;
  if (view.kind === 'opening') return dir < 0 ? go('repick') : null;
  if (view.kind !== 'started') return null;
  if (gameOpen()) return dir < 0 ? () => void run('game-close') : null;
  if (evUi.pop && dir < 0) return () => void run('ev-pop', evUi.pop);
  if (agUi.pop && dir < 0) return () => void run('agent-info', agUi.pop);
  if (!navHist.can(dir)) return null;
  return () => {
    const s = navHist.go(dir);
    if (s) applyNav(s);
  };
}

/** 창 배색: 채팅의 테마 변수, 채팅이 없으면 새 채팅 기본값 */
function themeOf(): string {
  const ctx = view.kind === 'started' || view.kind === 'opening' || view.kind === 'picker' ? view.ctx : null;
  const v = String(ctx?.chat.scriptstate?.['$st_fixed_theme'] ?? '');
  if (v === 'light' || v === 'paper' || v === 'dark') return v;
  if (view.kind === 'picker') return getPrefs().theme ?? 'dark';
  return 'light';
}

function startedBody(ctx: ChatContext): string {
  switch (tab) {
    case 'map':
      return mapTab(ctx, env, notice, busy);
    case 'mission':
      return missionTab(ctx, false, notice, busy);
    case 'wiki':
      return wikiTab(ctx);
    case 'gnet':
      return gnetTab(ctx, gnetEnv);
    case 'phone':
      return phoneTab(ctx, phoneEnv);
    case 'wallet':
      return walletTab(ctx);
    case 'records':
      return recordsTab(ctx);
    case 'field':
      // 게임은 그린 뒤 이 자리에 붙인다 (afterRender → syncField). 출동이 막 끝났으면 그 위에 보고서 시트 (ui/records fieldSheet)
      return `<main class="gx-body gx-fieldhost">${fieldSheet(ctx)}</main>`;
    case 'settings':
    {
      // 설정은 상황판 위에서 여는 화면이라 상황판 서랍(즐겨찾기)도 그대로 둔다 (2026-10-20 사용자: 설정을 열면 서랍이 가려진 것처럼 보임).
      // 명부는 자기 검색 서랍이 있어 그대로
      const html = settingsTab(ctx, settingsUi.scope === 'defaults' ? 'chat' : settingsUi.scope);
      return html.includes('ph-drawer') ? html : html + boardDrawer();
    }
    default:
      return board(ctx);
  }
}

function body(): string {
  switch (view.kind) {
    case 'loading':
      return `${header('불러오는 중')}<div class="gx-empty">채팅 정보를 읽는 중이에요…</div>`;
    case 'error':
      return `${header('오류')}<div class="gx-empty">${esc(view.message)}</div>`;
    case 'not-lite':
      return `${header('연결 안 됨')}<div class="gx-empty">
        <p><b>${esc(view.name || '이 캐릭터')}</b>는 ${view.goei ? `${BRAND.name} 카드지만 Plugin manifest 가 없어요.` : `${BRAND.name} 카드가 아니에요.`}</p>
        <p>${view.goei ? '설치 · 점검에서 매니페스트와 인사말을 다시 심으면 시작 화면이 열려요.' : `이 봇에 ${BRAND.name}를 설치하면(설정 폴더·명부·인사말·사진·아이콘을 심어요) 여기서 바로 쓸 수 있어요. 기존 로어북·인사말·에셋은 그대로 둬요.`}</p>
        <button class="gx-start" data-action="install-open">${view.goei ? '설치 · 점검 열기' : `이 봇에 ${BRAND.name} 설치`}</button>
      </div>`;
    case 'started':
      evSeenReset();
      return `${tabs()}${startedHeader(view.ctx)}<div class="gx-content">${tab === 'settings' ? '' : updateBanner(view.ctx)}${notice && tab !== 'map' && tab !== 'mission' ? `<div class="${noticeClass(notice)} gx-notice" role="alert">${esc(notice)}</div>` : ''}${startedBody(view.ctx)}</div>${evPopup(boardClock(view.ctx))}${tab === 'board' ? agentPopup((n) => view.kind === 'started' && hasPersonRecord(view.ctx, n)) : ''}${markPop(markOf(navState()), recentMarks())}${closeToastHtml()}`;
    case 'opening':
      return `${header('커스텀 임무 · 첫 장면 고르기', '<button class="gx-x" data-action="repick" aria-label="시작 설정 다시 고르기">' + ICONS.back + '</button>')}<div class="gx-content">${missionTab(view.ctx, true, notice, busy)}</div>`;
    case 'picker':
      return `${header(view.staged ? '첫 전송 전까지 다시 고를 수 있어요' : '새 작전 준비', `<button class="gx-x" data-action="prefs-open" aria-label="설정">${ICONS.settings}${hasUpdate(view.ctx) ? '<span class="gx-xdot" aria-label="새 버전"></span>' : ''}</button>`)}<div class="gx-content">${updateBanner(view.ctx)}${picker()}</div>`;
  }
}

function picker(): string {
  const facs = view.kind === 'picker' ? factionList(view.ctx.char.globalLore) : SCENARIOS.factions;
  const f = draft.faction ? findFaction(draft.faction, facs) : undefined;
  const sc = f && draft.fm ? findScenario(f.code, draft.fm, facs) : undefined;
  const factions = facs
    .filter((x) => !x.hidden)
    .map(
      (x) => {
        const img = view.kind === 'picker' ? imageUrl(view.ctx.char, factionPic(view.ctx.char, x)) : null;
        return `<button class="gx-fac${x.code === draft.faction ? ' on' : ''}${img ? ' has-img' : ''}" data-action="faction" data-value="${x.code}" aria-pressed="${x.code === draft.faction}">
        ${img ? `<span class="gx-fac-img" style="background-image:url('${esc(img)}')"></span>` : ''}<span class="gx-fac-txt"><b>${esc(x.name)}</b><span>${esc(x.blurb)}</span></span></button>`;
      },
    )
    .join('');
  const langs = SCENARIOS.languages
    .map(
      (l) =>
        `<button class="gx-seg${l.code === draft.lang ? ' on' : ''}" data-action="lang" data-value="${l.code}" aria-pressed="${l.code === draft.lang}">${esc(l.label)}</button>`,
    )
    .join('');
  const playing = !!draft.player;
  const scenarios = f
    ? f.scenarios
        .filter((s) => !playing || s.kind !== 'opening')
        .map((s) => {
          return `<button class="gx-sc${s.fm === draft.fm ? ' on' : ''}" data-action="fm" data-value="${s.fm}" aria-pressed="${s.fm === draft.fm}">
            <b>${String(s.fm).padStart(2, '0')}</b><span>${esc(s.label)}</span></button>`;
        })
        .join('')
    : '<div class="gx-hint">소속을 고르면 상황이 표시돼요.</div>';
  const hint =
    sc?.kind === 'direct'
      ? `<label class="gx-note"><span>시작할 상황</span>
          <textarea rows="4" data-input="start-note" placeholder="어디서 어떤 장면으로 시작할지 적어 주세요. 적은 내용으로 첫 장면이 시작돼요.">${esc(draft.situation ?? '')}</textarea></label>`
      : sc?.kind === 'preset'
        ? '<div class="gx-hint">출발을 누르면 이어서 목표와 동행을 골라요.</div>'
        : '';
  // 직접 입력은 상황을 적어야 출발
  const ready = !!(f && sc) && (sc.kind !== 'direct' || !!(draft.situation ?? '').trim()) && !(playing && sc.kind === 'opening');
  // 주인공: 내 페르소나 또는 그 소속 명단의 요원 한 명 (캐릭터로 플레이)
  const ctxP = view.kind === 'picker' ? view.ctx : null;
  const people = f && ctxP ? playableAgents(ctxP.char.globalLore, f.code) : [];
  const me = userInfo();
  const who = f
    ? `<div class="gx-who">${[
        `<button class="gx-whoc${!playing ? ' on' : ''}" data-action="player" data-value="" aria-pressed="${!playing}">${me.photo ? `<span class="gx-ava"><img src="${esc(me.photo)}" alt=""></span>` : `<span class="gx-ava"><span>${ICONS.idcard}</span></span>`}<span class="gx-whot"><b>내 페르소나</b></span></button>`,
        ...people.map((a) => `<button class="gx-whoc${draft.player === a.id ? ' on' : ''}" data-action="player" data-value="${esc(a.id)}" aria-pressed="${draft.player === a.id}">${ctxP ? picAvatar(ctxP.char, facePic(ctxP.char, a, true), a.name) : ''}<span class="gx-whot"><b>${esc(a.name)}</b>${a.rank ? `<small>${esc(a.rank)}</small>` : ''}</span></button>`),
      ].join('')}</div>${playing ? '<div class="gx-hint">고른 요원이 주인공이 돼요. 첫 장면은 직접 입력이나 커스텀 임무로 시작해요.</div>' : ''}`
    : '<div class="gx-hint">소속을 고르면 고를 수 있는 요원이 표시돼요.</div>';
  const shown = f ? f.scenarios.filter((s) => !playing || s.kind !== 'opening').length : 0;
  return `<main class="gx-body">
    <section><h2><i>1</i>어느 쪽에 설까요?</h2><div class="gx-facs">${factions}</div></section>
    <section><h2><i>2</i>주인공</h2>${who}</section>
    <section><h2><i>3</i>첫 장면${f ? `<small class="gx-h2-sub">${esc(f.name)} · ${shown}개</small>` : ''}</h2><div class="gx-scs">${scenarios}</div>${hint}</section>
    <section><h2><i>4</i>언어</h2><div class="gx-segs">${langs}</div></section>
  </main>
  <footer class="gx-foot">
    ${f && sc ? `<div class="gx-foot-sum">${esc(f.name)}${playing ? ` · ${esc(people.find((a) => a.id === draft.player)?.name ?? '')}` : ''} · ${String(sc.fm).padStart(2, '0')} ${esc(sc.label)}</div>` : ''}
    ${notice ? `<div class="${noticeClass(notice)}" role="alert">${esc(notice)}</div>` : ''}
    <button class="gx-start" data-action="start" ${ready && !busy ? '' : 'disabled'}>${busy ? '시작하는 중…' : '출 발'}</button>
  </footer>`;
}

function tabs(): string {
  const unreadPhone = view.kind === 'started' && phoneUnread(view.ctx);
  const cur: Tab = tab === 'mission' ? 'map' : tab;
  const item = (id: Tab, label: string, icon: string, cls = '', badge = '') =>
    `<button class="gx-nb${cls ? ` ${cls}` : ''}${(cls === 'mob' ? cur === id : tab === id) ? ' on' : ''}" data-action="${cls === 'mob' ? 'tab' : 'nav-tab'}" data-value="${id}" aria-current="${tab === id ? 'page' : 'false'}">${icon}<span>${label}</span>${badge}</button>`;
  const ctx = view.kind === 'started' ? view.ctx : null;
  return `<nav class="gx-nav" aria-label="주요 화면">
    ${ctx ? brand(ctx) : ''}
    ${item('board', '상황판', ICONS.board)}
    ${item('map', '임무', ICONS.map, 'desk')}
    ${item('map', '임무', ICONS.map, 'mob')}
    ${item('mission', '커스텀', ICONS.mission, 'desk')}
    ${item('phone', '괴담톡', ICONS.phone, '', unreadPhone ? '<span class="gx-nbadge dot" aria-label="새 메시지"></span>' : '')}
    ${GNET_ON ? item('gnet', gnetLabel(ctx?.chat.scriptstate), ICONS.gnet) : ''}
    ${item('wiki', '위키', ICONS.wiki)}
    ${gameShown() ? item('field', '필드', ICONS.game, 'desk') : ''}
    ${item('records', '기록', ICONS.records, 'desk')}
    <button class="gx-nb desk" data-action="ed-open" data-value="set:screen">${ICONS.settings}<span>설정</span>${ctx && hasUpdate(ctx) ? '<span class="gx-nbadge dot" aria-label="새 버전"></span>' : ''}</button>
    <span class="gx-nav-gap"></span>
    ${ctx ? navHistBar(markOf(navState())) : ''}
    ${mbarHtml([
      item('wiki', '위키', ICONS.wiki),
      item('map', '임무', ICONS.map, 'mob'),
      item('board', '상황판', ICONS.board, 'home'),
      item('phone', '괴담톡', ICONS.phone, '', unreadPhone ? '<span class="gx-nbadge dot" aria-label="새 메시지"></span>' : ''),
      ...(GNET_ON ? [item('gnet', gnetLabel(ctx?.chat.scriptstate), ICONS.gnet)] : []),
    ])}
  </nav>`;
}

/** 왼쪽 위: 표지 + 세로 ID카드 */
function brand(ctx: ChatContext): string {
  return `<div class="gx-nav-brand">
      ${idCard(ctx)}
    </div>`;
}

/** 세로 ID카드 (v0.16.22, 사용자 설계): 맨 위 유저 사진({{source::user}})·이름({{user}}), 아래 소속과 위치·목표·시각·날씨.
 *  배경엔 소속 사진이 아래에서 위로 옅어지며 은은하게 비친다. PC 왼쪽 위, 모바일은 머리 버튼으로 작은 창 */
function idCard(ctx: ChatContext): string {
  const facs = factionList(ctx.char.globalLore);
  const code = String(ctx.chat.scriptstate?.['$st_faction'] ?? '') || currentChoice(ctx.chat).faction || '';
  const f = code ? findFaction(code, facs) : undefined;
  const img = f ? imageUrl(ctx.char, factionPic(ctx.char, f)) : null;
  const w = worldOn(ctx.chat) ? readWorld(ctx.chat) : null;
  const st = lastStatusFields((ctx.chat.message ?? []).filter((m) => m.role === 'char').slice(-6).map((m) => m.data));
  const time = (w ? clock(w.minute) : '') || [st?.date, st?.time].filter(Boolean).join(' ');
  const weather = [st?.weather, st?.temp].filter(Boolean).join(' ');
  // 2026-10-29 정리 (시안 Main.dc.html): 사진 → 「이름 + 소속 칩」 → 잔고 줄(누르면 가계부 ›) → 「위치  시각 · 날씨」 → 「목표」
  const u = userInfo();
  // 캐릭터로 플레이: 신분증도 그 요원 사진·이름·직급
  const pa = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  const paPic = pa ? imageUrl(ctx.char, facePic(ctx.char, pa, true)) : null;
  const name = pa?.name || u.name || '나';
  const photoUrl = pa ? paPic : u.photo;
  const photo = photoUrl
    ? `<span class="gx-id-photo"><img src="${esc(photoUrl)}" alt=""></span>`
    : `<span class="gx-id-photo none">${ICONS.idcard}</span>`;
  const chips = `<span class="gx-badge own gx-id-fac">${esc(f ? selfName(ctx, f.code, f.name) : '소속 없음')}</span>${pa?.rank ? `<span class="gx-badge gx-id-fac">${esc(pa.rank)}</span>` : ''}`;
  const line = (label: string, value: string, extra = '') => (value || extra ? `<span class="gx-id-row"><i>${label}</i><em>${esc(value)}</em>${extra}</span>` : '');
  const meta = time || weather ? `<small>${esc([time.replace(/^\d{4}\./, ''), weather].filter(Boolean).join(' · '))}</small>` : '';
  // 첫 응답 전: 상황판 칸 배치는 그대로 두고, 비어 있는 이 자리에만 안내 (v0.16.31)
  const status = line('위치', st?.place ?? '', meta) + line('목표', st?.target ?? '') || (w && w.minute === null ? '<span class="gx-op-wait">첫 응답 뒤에 위치·시각이 채워져요.</span>' : '');
  return `<div class="gx-id">${img ? `<span class="gx-id-bg" style="background-image:url('${esc(img)}')"></span>` : ''}
      ${photo}
      <span class="gx-id-who"><b>${esc(name)}</b>${chips}</span>
      ${status || walletChip(ctx) ? `<span class="gx-op-st gx-id-rows">${walletChip(ctx)}${status}</span>` : ''}
    </div>`;
}

/** 사원증 잔고 줄 (상태창 잔고 칸을 쓸 때): 장부 잔고. 누르면 가계부 화면 (2026-10-29: 가계부가 왼쪽 메뉴에서 빠져 이 줄이 PC 의 입구) */
function walletChip(ctx: ChatContext): string {
  if (colConfig(ctx.chat.scriptstate).wallet === 'off') return '';
  const w = readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT);
  return `<button class="gx-id-row gx-id-wallet gx-wallet" data-action="tab" data-value="wallet" aria-label="잔고·가계부" title="가계부"><i>잔고</i><em>${esc(formatWon(walletBalance(w, aliveAnchors(ctx.chat))))}</em><span class="gx-id-go" aria-hidden="true">›</span></button>`;
}

/** 내 소속은 내 시점의 이름으로 (가짜 관리국을 고르면 나에게는 그냥 관리국). 명부에서 이름을 바꿨으면 그 이름 */
function selfName(ctx: ChatContext, code: string, name: string): string {
  const c = parseCatalog(ctx.char.globalLore);
  const outside = factionNames(c, undefined)[code];
  return outside && name === outside ? factionNames(c, code)[code] ?? name : name;
}

function clock(minute: number | null): string {
  if (minute === null) return '';
  const d = new Date(minute * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}.${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}


function board(ctx: ChatContext): string {
  if (!worldOn(ctx.chat)) {
    return `<div class="gx-empty"><p>이 채팅은 상황판 없이 시작했어요.</p>
      <p class="gx-muted">켜면 괴이·사건·특수가 발생하고, 다음 응답부터 모델이 상황판 태그를 함께 적어요.</p>
      ${notice ? `<div class="${noticeClass(notice)}" role="alert">${esc(notice)}</div>` : ''}
      <button class="gx-start" data-action="world-on" ${busy ? 'disabled' : ''}>${busy ? '켜는 중…' : '상황판 켜기'}</button></div>${boardDrawer()}`;
    // ↑ 상황판을 끈 채팅도 폰 하단 즐겨찾기 서랍은 그대로 (2026-10-28 QC: 꺼 두면 서랍째 사라졌다)
  }
  let catalog: Catalog;
  try {
    catalog = parseCatalog(ctx.char.globalLore);
  } catch (error) {
    return `<div class="gx-empty">${esc(error instanceof Error ? error.message : String(error))}</div>`;
  }
  const w = readWorld(ctx.chat);
  const faction = String(ctx.chat.scriptstate?.['$st_faction'] ?? '');
  const roster = rosterFor(w, catalog, faction, worldSettings(ctx.char.globalLore, ctx.chat.scriptstate).agent_limit);
  const byName = new Map(roster.map((p) => [p.name, p]));
  // 괴이·사건·특수는 한 줄짜리 행 (v0.16.15: 큰 카드를 늘어놓으니 한 화면에 안 들어왔다)
  // 괴이·사건·특수 카드는 임무 탭과 같은 모양 (ui/evcard.ts). 진행 중인 카드는 누르면 지도로
  const keys = new Map(activeEvents(w).map((e) => [`${e.kind}${e.index}`, e.key]));
  const display = factionNames(catalog, faction);
  const ownName = display[faction] ?? '';
  const names = (codes: string) => codesToNames(codes, catalog, faction).split(/\s*,\s*/).map((n) => n.trim());
  const chips = (codes: string) => peopleChips(ctx.char, names(codes), byName, ownName);
  // 관제실 상황판 (2026-10-20 사용자): 진행 중인 것만 일지에. 발생 예정은 띄우지 않는다 (누를 것도 없고 다음 상황을 미리 알려 버린다)
  const cards: OpsCard[] = [];
  const add = (kind: EvKind, i: number, locCode: string, c: Omit<EvCard, 'kind' | 'key'>) => {
    const key = keys.get(`${kind}${i}`);
    if (!key) return;
    cards.push({ ...c, kind, key, id: key, locCode, open: 'board-map', confirmEnd: field.confirmEnd === key, selected: field.target?.type === 'event' && field.target.key === key, art: evArt(ctx, c.name, kind, `${locName(locCode)} ${String(c.extra ?? '').replace(/<[^>]*>/g, ' ')}`) });
  };
  const since = (m: number | null) => elapsedText(w.minute, m);
  // 상황 글: 바깥 띠엔 상황 글(없으면 위키 요약), 상세 창·CCTV엔 상황 글과 위키 요약을 함께 (2026-10-21 사용자)
  const sit = (t?: string) => (t ? `<span class="gx-evc-sit">${esc(t)}</span>` : '');
  const locText = (loc: string, m: number | null) => `${esc(locName(loc))}${since(m) ? ` · ${since(m)}` : ''}`;
  w.an.forEach((e, i) => add('an', i, e.loc, { name: e.name || '이름 미확인', grade: e.grade, loc: locText(e.loc, e.since), badge: e.exploring ? '<span class="gx-badge op">탐사 중</span>' : '<span class="gx-badge live">활성</span>', chips: chips(e.deploy), extra: sit(e.situation) }));
  w.inc.forEach((e, i) => add('in', i, e.loc, { name: e.name || '이름 미확인', loc: locText(e.loc, e.since), badge: '<span class="gx-badge hot">진행</span>', chips: chips(e.deploy ?? ''), extra: sit(e.situation) }));
  w.ms.forEach((e, i) => add('ms', i, e.loc, { name: e.name, loc: esc(locName(e.loc)), badge: '<span class="gx-badge live">출현</span>', chips: chips(e.visitors), extra: sit(e.situation) }));
  // 막 끝난 상황은 이름 막기와 같은 동안 일지 맨 아래에 흐리게 (2026-10-20 사용자)
  for (const e of endedShown(w)) {
    const name = e.name || '이름 미확인';
    // 종료 줄 → 보고서 지름길 (기록 메뉴, 2026-10-29): 같은 종류·이름·장소의 일지 줄이 가리키는 보고서
    const rp = endedReport(ctx.chat, e.kind, e.name, e.loc);
    cards.push({ kind: e.kind, name, grade: e.grade, loc: esc(locName(e.loc)), badge: '<span class="gx-badge end">종료</span>', ended: true, id: `end:${e.kind}:${e.name}:${e.loc}`, locCode: e.loc, art: evArt(ctx, name, e.kind), ...(rp?.rpt ? { rpt: rp.rpt } : {}), ...(rp?.mine ? { mine: true } : {}) });
  }
  // 요원 칸 (2026-10-20 사용자): 모니터 벽 또는 근무 현황 목록. 편성 기준으로 밝기를 나눈다
  // 괴이와 사건(2026-10-21 배치 칸 추가)에서 찾는다
  const sentTo = (codes: string | undefined, id: string) => (codes ?? '').split(',').map((x) => x.trim()).includes(id);
  const deployedAt = (id: string) => w.an.find((e) => e.state === '활성' && sentTo(e.deploy, id))?.name ?? w.inc.find((e) => e.state === '진행' && sentTo(e.deploy, id))?.name ?? '';
  const dir = readDirectory((ctx.char.globalLore ?? []) as LoreEntry[]).agents;
  const agents: AgentItem[] = roster.map((p) => {
    const rec = w.agents[p.id];
    const st = rec?.st ?? '미정';
    const c = agentContact(ctx, p.id);
    const big = p.english ? mainPic(ctx.char, dir.find((x) => x.english === p.english) ?? { english: p.english }) : '';
    return {
      id: p.id, name: p.name, english: p.english ?? '', st: stLabel(st),
      side: st === '작전투입' ? 'op' : agentLocked(rec) ? 'lock' : 'ok',
      situation: rec?.situation ?? '', dept: p.department ?? '', rank: p.rank ?? '',
      face: avatar(ctx.char, p.english, p.name, 'sq'), photo: big ? imageUrl(ctx.char, big) : null,
      deployed: st === '작전투입' ? deployedAt(p.id) : '', wiki: c ? c.wiki : null,
    };
  });
  const promo = w.promoted.length ? `<p class="gx-hint">결번 충원: ${esc(w.promoted.join(', '))}</p>` : '';
  const live = (list: { state: string }[]) => list.filter((e) => e.state !== '발생대기').length;
  // 일지 제목줄 숫자: 괴이·사건·특수 (투입 수는 요원 칸 제목줄로 옮김, 2026-10-20 사용자)
  const cnt = (cls: string, label: string, n: number) => `<em class="${cls}">${label}<i>${n}</i></em>`;
  const limit = worldSettings(ctx.char.globalLore, ctx.chat.scriptstate).agent_limit;
  const counts = cnt('an', '괴이', live(w.an)) + cnt('in', '사건', live(w.inc)) + cnt('ms', '특수', live(w.ms));
  const clock = boardClock(ctx);
  return `<main class="gx-body gx-board">
    ${opsBoard(cards, { mapUrl: boardMapUrl(ctx, env), clock, counts, empty: '지금 발생한 상황이 없어요.' })}
    ${agentPanel(agents, getPrefs().agents ?? 'wall', { total: roster.length, org: findFaction(faction, factionList(ctx.char.globalLore))?.affiliation ?? '', extra: promo, empty: limit === 0 ? '설정에서 요원 표시 인원을 0명으로 해 두었어요.' : '이 소속에는 요원 명단이 없어요.' })}
  </main>${boardDrawer()}`;
}

/** 상황판 CCTV·상세 창 시각: 최근 상태 줄의 날짜·시각 */
function boardClock(ctx: ChatContext): string {
  const st = lastStatusFields((ctx.chat.message ?? []).filter((m) => m.role === 'char').slice(-6).map((m) => m.data));
  return [st?.date, st?.time].filter(Boolean).join(' ');
}
