import { findFaction, findScenario, defaultScenario, SCENARIOS } from '../core/scenarios';
import { factionList } from '../core/factions';
import { applyStart, chatPhase, currentChoice, planStart, readManifest, StartError } from '../core/start';
import type { FactionCode, LangCode, Manifest } from '../core/types';
import {
  type Catalog, codesToNames, factionNames, lastStatusFields, locName, parseCatalog, readWorld, rosterFor, startWorldVars, type WorldState, worldOn,
} from '../core/world';
import { loadContext, updateChat, type ChatContext } from '../host/risu';
import css from './style.css';
import { GHOST_ICON, ICONS } from './icons';
import { agentInner, avatar, imageUrl, setImageRedraw } from './images';
import { bindMapZoom } from './mapzoom';
import { BRAND, CARD_FILE } from './brand';
import { checkLatest, handleUpdate, hasUpdate, updateBanner } from './update';
import { setCurrentTheme, themeName } from './theme';
import { handleWiki, resetWiki, wiki, wikiSuggest, wikiTab, type WikiEnv } from './wiki';
import { gnet, gnetTab, handleGnet, resetGnet, type GnetEnv } from './gnet';
import { addPhoto, attachInput, hydratePhotos, zoomPhoto } from './attach';
import { ATTACH_MAX } from '../core/attach';
import { readPhone } from '../core/phone';
import { savePhoto } from '../host/photo';
import { rememberPanel } from './panels';
import { agentContact, handlePhone, openAgentDm, phone, phoneContent, phoneInput, phonePickList, phoneTab, phoneUnread, resetPhone, type PhoneEnv } from './phone';
import { field, handleField, mapTab, missionList, missionTab, newMessage, resetField, type FieldEnv } from './field';
import { SEND_FALLBACK, sendNow } from '../host/send';
import { handleSettings, resetSettings, settingsTab, settingsUi, type SettingsEnv } from './settings';
import { directoryExtList, directoryInput, directoryList, dirUi, handleDirectory, resetDirectory } from './directory';
import { basicDefaults, basicVars, getPrefs, worldDefaults, worldSettings, worldVarsOf } from '../core/settings';

interface Draft {
  faction?: FactionCode;
  lang: LangCode;
  fm?: number;
  /** 직접 입력 첫 장면: 출발과 함께 보낼 상황 */
  situation?: string;
}

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'not-lite'; name: string }
  | { kind: 'started'; ctx: ChatContext }
  /** 커스텀 임무로 시작을 골랐고 첫 지시문을 아직 안 보냄 */
  | { kind: 'opening'; ctx: ChatContext }
  | { kind: 'picker'; ctx: ChatContext; manifest: Manifest; staged: boolean };

let root: HTMLElement | null = null;
let view: View = { kind: 'loading' };
let draft: Draft = { lang: 'ko' };
let busy = false;
let notice = '';
/** 괴담넷 탭 (완성 전까지 숨김) */
const GNET_ON = true;
type Tab = 'board' | 'map' | 'mission' | 'gnet' | 'phone' | 'wiki' | 'settings';
const TABS: Tab[] = ['board', 'map', 'mission', ...(GNET_ON ? (['gnet'] as Tab[]) : []), 'phone', 'wiki', 'settings'];
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

/** 창이 떠 있는지 (괴담톡이 받은 말풍선을 바로 읽음 처리할지) */
let shown = false;
const phoneEnv: PhoneEnv = {
  render: () => render(),
  refresh: () => refresh(),
  visible: () => shown && tab === 'phone' && view.kind === 'started',
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
  setImageRedraw(() => (view.kind === 'picker' ? renderPicker() : render()));
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
      if (downOutside) void handle('close');
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
    const el = t.closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    // data-take: 같은 창의 입력칸 값을 넘긴다 (form 제출은 플러그인 iframe에서 막혀 있음)
    const take = el.dataset.take ? root?.querySelector<HTMLInputElement>(`[name="${el.dataset.take}"]`)?.value : undefined;
    void handle(el.dataset.action!, take ?? el.dataset.value);
  });
  // 작성칸에 사진 붙여넣기·끌어놓기 (원본처럼)
  const photoTarget = (el: EventTarget | null) => {
    const box = (el as HTMLElement | null)?.closest?.('.gn-compose, .ph-room');
    return box ? (box.classList.contains('gn-compose') ? 'gn' : 'ph') : '';
  };
  const imageFiles = (list: FileList | DataTransferItemList | undefined) =>
    [...(list ?? [])].map((x) => (x instanceof File ? x : (x as DataTransferItem).kind === 'file' ? (x as DataTransferItem).getAsFile() : null)).filter((f): f is File => !!f && f.type.startsWith('image/'));
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
      if (send && !send.disabled) void handle('ph-send', send.dataset.value);
      return;
    }
    if (ev.key !== 'Enter' || ev.isComposing || !el?.dataset?.enter) return;
    ev.preventDefault();
    void handle(el.dataset.enter, el.value);
  });
  root.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const input = form.querySelector('input');
    if (form.dataset.submit) void handle(form.dataset.submit, input?.value ?? '');
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target as HTMLSelectElement;
    if (el?.dataset?.change) void handle(el.dataset.change, el.dataset.key ? `${el.dataset.key}=${el.value}` : el.value);
  });
  // 검색어는 목록만 다시 그린다 (입력창 포커스 유지)
  root.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (el?.dataset?.input === 'wiki-query' && view.kind === 'started') {
      wiki.query = el.value;
      const box = root?.querySelector('.nw-suggest');
      if (box) box.innerHTML = wikiSuggest(view.ctx, el.value);
      return;
    }
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
    if (el?.dataset?.input === 'dir-ext-q' && (view.kind === 'started' || view.kind === 'picker')) {
      dirUi.addQ = el.value;
      const box = root?.querySelector('.dir-ext-list');
      if (box) box.innerHTML = directoryExtList(view.ctx);
      return;
    }
    if (el?.dataset?.input === 'dir') return void directoryInput(el.dataset.key ?? '', el.value, root?.querySelector('.dir-bar') ?? null);
    if (el?.dataset?.input && phoneInput(el.dataset.input, el.value, el.dataset.key)) return;
    if (el?.dataset?.input === 'field-note') return void (field.note = el.value);
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
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') void close();
  });
  return root;
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
export async function openApp(opts: { quietIfNotLite?: boolean } = {}): Promise<void> {
  ensureRoot();
  if (opts.quietIfNotLite) {
    const ctx = await loadContext().catch(() => null);
    if (!ctx || !readManifest(ctx.char.globalLore)) return;
  }
  view = { kind: 'loading' };
  notice = '';
  render();
  shown = true;
  await risuai.showContainer('fullscreen');
  await refresh();
  void checkLatest(settingsEnv); // 새 버전이 있으면 설정 → 업데이트에 표시 (세션에 한 번)
}

async function refresh(): Promise<void> {
  try {
    const ctx = await loadContext();
    if (!ctx) {
      view = { kind: 'error', message: `선택된 채팅이 없어요. ${BRAND.name} 채팅을 연 뒤 다시 눌러 주세요.` };
    } else {
      const manifest = readManifest(ctx.char.globalLore);
      const phase = chatPhase(ctx.chat);
      const chatKey = `${ctx.charIndex}:${ctx.chatIndex}`;
      if (chatKey !== lastChat) {
        lastChat = chatKey;
        resetField(true);
        resetWiki();
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
      if (!manifest) view = { kind: 'not-lite', name: String(ctx.char.name ?? '') };
      else if (phase === 'started') view = { kind: 'started', ctx };
      else if (presetStaged && !repick) view = { kind: 'opening', ctx };
      else {
        view = { kind: 'picker', ctx, manifest, staged: phase === 'staged' };
        draft = { faction: cur.faction ?? draft.faction, lang: cur.lang ?? draft.lang, fm: cur.fm ?? draft.fm };
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

async function handle(action: string, value?: string): Promise<void> {
  if (busy) return;
  if (view.kind === 'started' && action.startsWith('wiki-') && (await handleWiki(action, value, view.ctx, wikiEnv))) return;
  if (view.kind === 'started' && action.startsWith('gn-') && (await handleGnet(action, value, view.ctx, gnetEnv))) return;
  if (view.kind === 'started' && action.startsWith('ph-') && (await handlePhone(action, value, view.ctx, phoneEnv))) return;
  if (action === 'prefs-open' || action === 'prefs-close') {
    pickerPrefs = action === 'prefs-open';
    resetSettings();
    resetDirectory();
    settingsUi.scope = 'defaults';
    return render();
  }
  if ((view.kind === 'started' || (view.kind === 'picker' && pickerPrefs)) && action.startsWith('dir-')) {
    await handleDirectory(action, value, view.ctx, settingsEnv);
    return;
  }
  if (view.kind === 'picker' && pickerPrefs && action.startsWith('set-')) {
    if (settingsUi.busy) return;
    await handleSettings(action, value, view.ctx, settingsEnv, settingsUi.scope === 'chat' ? 'defaults' : settingsUi.scope);
    if (action === 'set-theme' && view.kind === 'picker' && view.staged) await stagedTheme(view.ctx, value);
    return;
  }
  if (view.kind === 'started' && action.startsWith('set-')) {
    if (!settingsUi.busy) await handleSettings(action, value, view.ctx, settingsEnv, settingsUi.scope);
    return;
  }
  if (action === 'upd-go') {
    // 설정 → 업데이트로 (시작 전 화면은 기본 설정 화면에 같은 칸이 있다)
    if (view.kind === 'started') (tab = 'settings'), (settingsUi.scope = 'chat');
    else if (view.kind === 'picker') pickerPrefs = true;
    render();
    root?.querySelector('.upd-ver')?.closest('.ps-group')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (action.startsWith('upd-') && (view.kind === 'started' || view.kind === 'picker') && (await handleUpdate(action, view.ctx, settingsEnv))) return;
  if ((view.kind === 'started' || view.kind === 'opening') && (await handleField(action, value, view.ctx, env, view.kind === 'opening'))) return;
  switch (action) {
    case 'close':
      return close();
    case 'faction': {
      const facs = view.kind === 'picker' ? factionList(view.ctx.char.globalLore) : SCENARIOS.factions;
      const f = findFaction(value ?? '', facs);
      if (!f) return;
      if (draft.faction !== f.code) draft.fm = defaultScenario(f.code, facs);
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
    case 'start':
      return start();
    case 'tab':
      tab = TABS.includes(value as Tab) ? (value as Tab) : 'board';
      notice = '';
      // 지도·커스텀 임무에서 고른 목표·편성은 다른 탭에 다녀와도 그대로 둔다
      field.confirmEnd = null;
      resetSettings();
      return render();
    case 'agent-talk':
      // 상황판 요원 카드의 톡: 괴담톡 탭으로 넘어가 그 요원과의 1:1 방을 연다
      if (view.kind !== 'started') return;
      tab = 'phone';
      notice = '';
      resetField();
      if (!(await openAgentDm(view.ctx, phoneEnv, value ?? ''))) render();
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
    case 'repick':
      repick = true;
      notice = '';
      return refresh();
    case 'world-on':
      return turnWorldOn();
    case 'board-jump':
      root?.querySelector(`#gx-sec-${value}`)?.scrollIntoView({ block: 'start' });
      return;
  }
}

async function start(): Promise<void> {
  if (view.kind !== 'picker' || !draft.faction || !draft.fm) return;
  const { ctx, manifest } = view;
  busy = true;
  notice = '';
  render();
  try {
    const choice = { faction: draft.faction, lang: draft.lang, fm: draft.fm };
    const lore = ctx.char.globalLore ?? [];
    let world = null;
    try {
      // 기본값에서 상황판을 꺼 두었으면 상황판 없이 시작 (나중에 설정 탭에서 켤 수 있음)
      if (basicDefaults(lore).anomalyOn) world = startWorldVars(parseCatalog(lore), worldDefaults(lore), choice.faction, Math.random);
    } catch (error) {
      // 목록 로어북이 없으면 상황판 없이 시작한다 (대화는 그대로 가능)
      console.log(`[goei] 상황판 준비 실패: ${error instanceof Error ? error.message : String(error)}`);
    }
    const plan = planStart(choice, manifest, lore, ctx.char.alternateGreetings?.length ?? 0, world);
    // 직접 입력: 적어 둔 상황을 첫 메시지로 놓고 바로 보낸다
    const situation = plan.kind === 'direct' ? (draft.situation ?? '').trim() : '';
    if (plan.kind === 'direct' && !situation) throw new StartError('시작할 상황을 적어 주세요.');
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
      if (chatPhase(chat) === 'started') throw new StartError('그새 대화가 시작됐어요. 새 채팅에서 다시 골라 주세요.');
      const next = applyStart(chat, plan);
      if (situation) next.message = [...(next.message ?? []), newMessage(situation)];
      // 새 채팅 기본값(설정 창)을 이 채팅에 적어 둔다. 나중에 기본값을 바꿔도 이 채팅은 그대로 (원본 ensureDefaults)
      const theme = getPrefs().theme ?? 'dark';
      return {
        ...next,
        scriptstate: { ...basicVars(basicDefaults(lore)), ...worldVarsOf(worldDefaults(lore)), $st_fixed_theme: theme, ...(next.scriptstate ?? {}) },
      };
    });
    if (!saved) throw new StartError('저장하지 못했어요.');
    if (plan.seedMissing.length) console.log(`[goei] 시작 자료 누락: ${plan.seedMissing.join(', ')}`);
    busy = false;
    repick = false;
    if (plan.kind === 'preset') {
      // 커스텀 임무: 창을 닫지 않고 바로 목표·동행 고르기로
      resetField(true);
      return refresh();
    }
    draft.situation = '';
    if (situation && !(await sendNow())) {
      notice = SEND_FALLBACK;
      return refresh();
    }
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
      return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...startWorldVars(catalog, worldSettings(ctx.char.globalLore, chat.scriptstate), faction, Math.random) } };
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
  board: '상황판', map: '지도', mission: '커스텀 임무', gnet: '괴담넷', phone: '괴담톡', wiki: '위키', settings: '설정',
};

function header(sub: string, extra = ''): string {
  return `<header class="gx-head">
    <div class="gx-brand"><span class="gx-logo">${GHOST_ICON}</span><div><b>${BRAND.name}</b><small>${esc(sub)}</small></div></div>
    <div class="gx-head-act">${extra}<button class="gx-x" data-action="close" aria-label="닫기">${ICONS.close}</button></div>
  </header>`;
}

/** 진행 중 화면의 머리: 지금 탭 이름 + 상태창 시각 + 위협도 */
function startedHeader(ctx: ChatContext): string {
  const w = worldOn(ctx.chat) ? readWorld(ctx.chat) : null;
  const t = w ? threat(w) : null;
  const pill = t ? `<span class="gx-threat${t.level ? '' : ' calm'}" title="위협도 ${t.level} · ${t.label}">${t.level ? '<span class="gx-live"></span>' : ''}<span class="w">위협도 </span>${t.level}<span class="t"> · ${t.label}</span></span>` : '';
  return `<header class="gx-head">
    <div class="gx-brand"><span class="gx-logo mob">${GHOST_ICON}</span><div><b>${TAB_TITLE[tab]}</b></div></div>
    <div class="gx-head-act">${pill}
      <button class="gx-x${tab === 'settings' ? ' on' : ''}" data-action="tab" data-value="settings" aria-label="설정">${ICONS.settings}${hasUpdate(ctx) ? '<span class="gx-xdot" aria-label="새 버전"></span>' : ''}</button>
      <button class="gx-x" data-action="close" aria-label="닫기">${ICONS.close}</button></div>
  </header>`;
}

/** 위협도: 진행 중인 괴이 등급과 사건 수로 0~5 */
function threat(w: WorldState): { level: number; label: string } {
  const weight: Record<string, number> = { S: 3, A: 2, B: 1 };
  let n = 0;
  for (const e of w.an) if (e.state !== '발생대기') n += 1 + (weight[e.grade ?? ''] ?? 0);
  for (const e of w.inc) if (e.state !== '발생대기') n += 1;
  const level = n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : n <= 7 ? 4 : 5;
  return { level, label: ['평온', '주의', '경계', '심각', '위험', '재난'][level] };
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

function render(): void {
  if (!root) return;
  const nav = view.kind === 'started';
  // 다시 그려도 읽던 자리를 지킨다
  const scroller = root.querySelector('.gx-body');
  const keep = scroller && root.dataset.tab === tab ? scroller.scrollTop : 0;
  // 괴담톡 대화: 맨 아래를 보고 있었으면(또는 방을 새로 열면) 다시 그린 뒤에도 맨 아래로
  const log = root.querySelector<HTMLElement>('.ph-log');
  const logRoom = root.dataset.room ?? '';
  const logKeep = log && logRoom === (phone.room ?? '') ? (log.scrollHeight - log.scrollTop - log.clientHeight < 60 ? -1 : log.scrollTop) : -1;
  root.dataset.theme = themeOf();
  // 시작 전(고르기·첫 장면) 화면은 PC에서 설정 화면 폭만큼만 (너무 넓으면 가운데만 차고 양옆이 빈다)
  root.innerHTML = `<div class="gx-panel${nav ? ' has-nav' : ' pre'}">${body()}</div>`;
  root.dataset.tab = tab;
  const next = root.querySelector('.gx-body');
  if (next && keep) next.scrollTop = keep;
  const nlog = root.querySelector<HTMLElement>('.ph-log');
  root.dataset.room = phone.room ?? '';
  if (nlog) {
    nlog.scrollTop = logKeep < 0 ? nlog.scrollHeight : logKeep;
    // 사진이 늦게 뜨면 높이가 바뀌므로 맨 아래를 보던 중이면 한 번 더
    if (logKeep < 0) nlog.querySelectorAll('img').forEach((img) => img.addEventListener('load', () => (nlog.scrollTop = nlog.scrollHeight), { once: true }));
  }
  hydratePhotos(root);
  bindMapZoom(root);
  setCurrentTheme(themeName(root.dataset.theme));
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
    case 'settings':
      return settingsTab(ctx, settingsUi.scope);
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
        <p><b>${esc(view.name || '이 캐릭터')}</b>는 ${BRAND.name} 카드가 아니에요.</p>
        <p>플러그인은 ${BRAND.name} 전용 카드(${CARD_FILE})에서만 동작해요. 원본 괴이봇 카드는 기존 Lua로 그대로 돌아가요.</p>
      </div>`;
    case 'started':
      return `${tabs()}${startedHeader(view.ctx)}<div class="gx-content">${tab === 'settings' ? '' : updateBanner(view.ctx)}${notice && tab !== 'map' && tab !== 'mission' ? `<div class="gx-err gx-notice" role="alert">${esc(notice)}</div>` : ''}${subnav()}${startedBody(view.ctx)}</div>`;
    case 'opening':
      return `${header('커스텀 임무 · 첫 장면 고르기', '<button class="gx-x" data-action="repick" aria-label="시작 설정 다시 고르기">' + ICONS.back + '</button>')}<div class="gx-content">${missionTab(view.ctx, true, notice, busy)}</div>`;
    case 'picker':
      if (pickerPrefs)
        return `${header('새 채팅 기본 설정', `<button class="gx-x" data-action="prefs-close" aria-label="시작 화면으로">${ICONS.back}</button>`)}<div class="gx-content">${settingsTab(view.ctx, settingsUi.scope === 'chat' ? 'defaults' : settingsUi.scope, false)}</div>`;
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
        const img = view.kind === 'picker' ? imageUrl(view.ctx.char, x.photo) : null;
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
  const scenarios = f
    ? f.scenarios
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
  const ready = !!(f && sc) && (sc.kind !== 'direct' || !!(draft.situation ?? '').trim());
  return `<main class="gx-body">
    <section><h2><i>1</i>어느 쪽에 설까요?</h2><div class="gx-facs">${factions}</div></section>
    <section><h2><i>2</i>첫 장면${f ? `<small class="gx-h2-sub">${esc(f.name)} · ${f.scenarios.length}개</small>` : ''}</h2><div class="gx-scs">${scenarios}</div>${hint}</section>
    <section><h2><i>3</i>언어</h2><div class="gx-segs">${langs}</div></section>
  </main>
  <footer class="gx-foot">
    ${f && sc ? `<div class="gx-foot-sum">${esc(f.name)} · ${String(sc.fm).padStart(2, '0')} ${esc(sc.label)}</div>` : ''}
    ${notice ? `<div class="gx-err" role="alert">${esc(notice)}</div>` : ''}
    <button class="gx-start" data-action="start" ${ready && !busy ? '' : 'disabled'}>${busy ? '시작하는 중…' : '출 발'}</button>
  </footer>`;
}

function tabs(): string {
  const unreadPhone = view.kind === 'started' && phoneUnread(view.ctx);
  const cur: Tab = tab === 'mission' ? 'map' : tab;
  const item = (id: Tab, label: string, icon: string, cls = '', badge = '') =>
    `<button class="gx-nb${cls ? ` ${cls}` : ''}${cur === id || tab === id ? ' on' : ''}" data-action="tab" data-value="${id}" aria-current="${tab === id ? 'page' : 'false'}">${icon}<span>${label}</span>${badge}</button>`;
  const ctx = view.kind === 'started' ? view.ctx : null;
  return `<nav class="gx-nav" aria-label="주요 화면">
    ${ctx ? brand(ctx) : ''}
    ${item('board', '상황판', ICONS.board)}
    ${item('map', '지도', ICONS.map, 'desk')}
    ${item('map', '임무', ICONS.map, 'mob')}
    ${item('mission', '커스텀 임무', ICONS.mission, 'desk')}
    ${item('phone', '괴담톡', ICONS.phone, '', unreadPhone ? '<span class="gx-nbadge dot" aria-label="새 메시지"></span>' : '')}
    ${GNET_ON ? item('gnet', '괴담넷', ICONS.gnet) : ''}
    ${item('wiki', '위키', ICONS.wiki)}
    <span class="gx-nav-gap"></span>
    ${item('settings', '설정', ICONS.settings, 'desk', ctx && hasUpdate(ctx) ? '<span class="gx-nbadge dot" aria-label="새 버전"></span>' : '')}
  </nav>`;
}

/** 왼쪽 위: 표지 + 소속 사진 패널 (안에 위치·목표·시각·날씨). 첫 장면 선택은 시작 뒤엔 쓸모없어 뺐다 */
function brand(ctx: ChatContext): string {
  const facs = factionList(ctx.char.globalLore);
  const code = String(ctx.chat.scriptstate?.['$st_faction'] ?? '') || currentChoice(ctx.chat).faction || '';
  const f = code ? findFaction(code, facs) : undefined;
  const img = f ? imageUrl(ctx.char, f.photo) : null;
  const w = worldOn(ctx.chat) ? readWorld(ctx.chat) : null;
  const st = lastStatusFields((ctx.chat.message ?? []).filter((m) => m.role === 'char').slice(-6).map((m) => m.data));
  const time = (w ? clock(w.minute) : '') || [st?.date, st?.time].filter(Boolean).join(' ');
  const weather = [st?.weather, st?.temp].filter(Boolean).join(' ');
  // 상태는 소속 사진 패널 안에: 위치·목표는 한 줄씩, 시각·날씨는 한 줄에 작게
  const line = (label: string, value: string) => (value ? `<span class="gx-op-ln"><i>${label}</i><em>${value}</em></span>` : '');
  const meta = [time, esc(weather)].filter(Boolean).join('<span class="gx-op-dot">·</span>');
  const status = line('위치', esc(st?.place ?? '')) + line('목표', esc(st?.target ?? '')) + (meta ? `<span class="gx-op-meta">${meta}</span>` : '');
  return `<div class="gx-nav-brand">
      <div class="gx-mark"><span class="gx-logo">${GHOST_ICON}</span><span class="gx-mark-txt"><b>${BRAND.name}</b><small>${BRAND.sub}</small></span></div>
      <div class="gx-op${img ? ' has-img' : ''}">${img ? `<span class="gx-op-img" style="background-image:url('${esc(img)}')"></span>` : ''}
        <span class="gx-op-txt"><small>소속</small><b>${esc(f ? selfName(ctx, f.code, f.name) : '소속 없음')}</b>${status ? `<span class="gx-op-st">${status}</span>` : ''}</span></div>
    </div>`;
}

/** 내 소속은 내 시점의 이름으로 (가짜 관리국을 고르면 나에게는 그냥 관리국). 명부에서 이름을 바꿨으면 그 이름 */
function selfName(ctx: ChatContext, code: string, name: string): string {
  const c = parseCatalog(ctx.char.globalLore);
  const outside = factionNames(c, undefined)[code];
  return outside && name === outside ? factionNames(c, code)[code] ?? name : name;
}

/** 지도와 커스텀 임무 사이 전환 (모바일 하단 바는 한 칸이라 화면 위에 둔다) */
function subnav(): string {
  if (tab !== 'map' && tab !== 'mission') return '';
  const seg = (id: Tab, label: string) => `<button class="gx-seg${tab === id ? ' on' : ''}" data-action="tab" data-value="${id}" aria-pressed="${tab === id}">${label}</button>`;
  return `<div class="gx-subwrap"><div class="gx-subnav">${seg('map', '지도')}${seg('mission', '커스텀 임무')}</div></div>`;
}

function elapsed(w: WorldState, since: number | null): string {
  if (w.minute === null || since === null) return '';
  const m = Math.max(0, w.minute - since);
  const h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분째` : `${m % 60}분째`;
}

function clock(minute: number | null): string {
  if (minute === null) return '';
  const d = new Date(minute * 60000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `<span class="y">${d.getUTCFullYear()}.</span>${p(d.getUTCMonth() + 1)}.${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}


function board(ctx: ChatContext): string {
  if (!worldOn(ctx.chat)) {
    return `<div class="gx-empty"><p>이 채팅은 상황판 없이 시작했어요.</p>
      <p class="gx-muted">켜면 괴이·사건·특수가 발생하고, 다음 응답부터 모델이 상황판 태그를 함께 적어요.</p>
      ${notice ? `<div class="gx-err" role="alert">${esc(notice)}</div>` : ''}
      <button class="gx-start" data-action="world-on" ${busy ? 'disabled' : ''}>${busy ? '켜는 중…' : '상황판 켜기'}</button></div>`;
  }
  let catalog: Catalog;
  try {
    catalog = parseCatalog(ctx.char.globalLore);
  } catch (error) {
    return `<div class="gx-empty">${esc(error instanceof Error ? error.message : String(error))}</div>`;
  }
  const w = readWorld(ctx.chat);
  const faction = String(ctx.chat.scriptstate?.['$st_faction'] ?? '');
  const names = (s: string) => esc(codesToNames(s, catalog, faction));
  const pending = '<span class="gx-badge wait">발생 예정</span>';
  const section = (id: string, title: string, count: number, rows: string, empty: string) =>
    `<section class="gx-sec" id="gx-sec-${id}"><h2>${title}<small>${count}</small></h2>${count ? `<ul class="gx-list">${rows}</ul>` : `<p class="gx-none">${empty}</p>`}</section>`;
  const roster = rosterFor(w, catalog, faction, worldSettings(ctx.char.globalLore, ctx.chat.scriptstate).agent_limit);
  const byName = new Map(roster.map((p) => [p.name, p]));
  // 배치·방문자 줄: 요원은 사진+이름 칩, 세력·조직·그 밖의 이름은 이름표 (v0.14.0. 예전엔 「관리국」에도 글자 사진 「관」을 그렸다)
  const people = (codes: string, label: string) => {
    const list = codesToNames(codes, catalog, faction).split(/\s*,\s*/).map((n) => n.trim()).filter((n) => n && n !== '없음');
    const chips = list
      .map((n) => (byName.has(n) ? `<span class="gx-pchip">${avatar(ctx.char, byName.get(n)!.english, n, 'xs')}${esc(n)}</span>` : `<span class="gx-badge">${esc(n)}</span>`))
      .join('');
    return `<p class="gx-people"><span class="gx-people-l">${label}</span>${chips || '<span class="gx-muted">없음</span>'}</p>`;
  };
  const card = (kind: 'an' | 'in' | 'ms', mark: string, name: string, loc: string, meta: string, sub: string) =>
    `<li class="gx-ev-card"><span class="gx-gmark ${kind}">${mark}</span><span class="gx-ev-name">${name}</span><span>${meta}</span>
      <span class="gx-loc gx-ev-sub">${loc}</span>${sub ? `<div class="gx-ev-sub">${sub}</div>` : ''}</li>`;

  const an = w.an
    .map((e) => {
      const wait = e.state === '발생대기';
      const meta = wait ? pending : `${e.exploring ? '<span class="gx-badge op">탐사 중</span>' : `<span class="gx-badge live">${esc(e.state)}</span>`}`;
      const since = elapsed(w, e.since);
      const sub = wait ? '' : people(e.deploy, '배치');
      return card(wait ? 'an' : 'an', e.grade ? esc(e.grade) : '?', esc(e.name || '이름 미확인'), `${esc(locName(e.loc))}${since ? ` · ${since}` : ''}`, meta, sub);
    })
    .join('');
  const inc = w.inc
    .map((e) => {
      const wait = e.state === '발생대기';
      const since = elapsed(w, e.since);
      return card('in', '!', esc(e.name || '이름 미확인'), `${esc(locName(e.loc))}${since ? ` · ${since}` : ''}`, wait ? pending : '<span class="gx-badge hot">진행</span>', e.situation ? `<p>${esc(e.situation)}</p>` : '');
    })
    .join('');
  const ms = w.ms
    .map((e) => {
      const wait = e.state === '발생대기';
      return card('ms', '◇', esc(e.name), esc(locName(e.loc)), wait ? pending : '<span class="gx-badge live">출현</span>', wait ? '' : people(e.visitors, '방문자'));
    })
    .join('');
  const ag = roster
    .map((p) => {
      const rec = w.agents[p.id];
      const st = rec?.st ?? '미정';
      const c = agentContact(ctx, p.id);
      const act = c
        ? `<span class="gx-acard-act"><button class="gx-acard-tool" data-action="agent-talk" data-value="${esc(p.id)}" title="괴담톡" aria-label="${esc(p.name)}에게 톡">${ICONS.phone}</button>`
          + `<button class="gx-acard-tool" data-action="wiki-goto" data-value="${esc(c.wiki)}" title="위키" aria-label="${esc(p.name)} 위키">${ICONS.wiki}</button></span>`
        : '';
      return `<li class="gx-acard${st === '작전투입' ? ' op' : ''}" title="${esc(p.id)}">${agentInner(ctx.char, p, st, rec?.situation ?? '')}${act}</li>`;
    })
    .join('');
  const promo = w.promoted.length ? `<p class="gx-hint">결번 충원: ${esc(w.promoted.join(', '))}</p>` : '';
  const t = threat(w);
  const live = (list: { state: string }[]) => list.filter((e) => e.state !== '발생대기').length;
  const onOp = roster.filter((p) => w.agents[p.id]?.st === '작전투입');
  // 작전 현황: 진행 중인 괴이마다 배치된 우리 요원, 어디에도 안 잡힌 작전 요원은 따로 (아래 목록과 겹치지 않게 「누가 어디에」만)
  const placed = new Set<string>();
  const ops = w.an
    .filter((e) => e.state !== '발생대기')
    .map((e) => {
      const who = codesToNames(e.deploy, catalog, faction).split(/\s*,\s*/).map((n) => n.trim()).filter((n) => byName.has(n));
      who.forEach((n) => placed.add(n));
      return who.length
        ? `<li><span class="gx-ops-where"><i class="gx-gmark an">${esc(e.grade || '?')}</i><b>${esc(e.name)}</b><small>${esc(locName(e.loc))}</small></span><span class="gx-ops-who">${who.map((n) => `<span class="gx-pchip">${avatar(ctx.char, byName.get(n)!.english, n, 'xs')}${esc(n)}</span>`).join('')}</span></li>`
        : '';
    })
    .join('');
  const loose = onOp.filter((p) => !placed.has(p.name));
  const looseRow = loose.length
    ? `<li><span class="gx-ops-where"><i class="gx-gmark op">·</i><b>그 밖의 작전</b><small>배치 기록 없음</small></span><span class="gx-ops-who">${loose.map((p) => `<span class="gx-pchip" title="${esc(w.agents[p.id]?.situation ?? '')}">${avatar(ctx.char, p.english, p.name, 'xs')}${esc(p.name)}</span>`).join('')}</span></li>`
    : '';
  // 작전 현황 (v0.16.13 다시 설계): 왼쪽 위협도(무엇으로 매기는지 한 줄), 오른쪽 종류별 개수(누르면 그 목록으로), 아래 투입 현황
  const waiting = (list: { state: string }[]) => list.length - live(list);
  const stat = (id: string, label: string, n: number, sub: string, cls: string) =>
    `<button class="gx-ops-stat ${cls}" data-action="board-jump" data-value="${id}"><span>${label}</span><b>${n}</b><small>${sub}</small></button>`;
  const quiet = w.minute === null ? '첫 응답이 오면 시각과 상태가 채워져요.' : '지금 작전 중인 요원은 없어요.';
  return `<main class="gx-body gx-board">
    <section class="gx-ops lv${t.level}">
      <div class="gx-ops-top">
        <div class="gx-ops-lv">
          <small>위협도</small>
          <div class="gx-ops-num"><b>${t.level}</b><span>/ 5</span><em>${t.label}</em>${t.level ? '<span class="gx-live"></span>' : ''}</div>
          <span class="gx-meter">${[1, 2, 3, 4, 5].map((i) => `<i class="${i <= t.level ? `l${i}` : ''}"></i>`).join('')}</span>
          <p>진행 중인 괴이 등급과 사건 수로 매겨요.</p>
        </div>
        <div class="gx-ops-stats">
          ${stat('an', '괴이', live(w.an), waiting(w.an) ? `예정 ${waiting(w.an)}` : '진행 중', 'an')}
          ${stat('in', '사건', live(w.inc), waiting(w.inc) ? `예정 ${waiting(w.inc)}` : '진행 중', 'in')}
          ${stat('ms', '특수', live(w.ms), waiting(w.ms) ? `예정 ${waiting(w.ms)}` : '출현', 'ms')}
          ${stat('ag', '요원', onOp.length, `작전 중 / ${roster.length}명`, 'op')}
        </div>
      </div>
      <div class="gx-ops-deploy"><h3>투입 현황</h3>
        ${ops || looseRow ? `<ul class="gx-ops-list">${ops}${looseRow}</ul>` : `<p class="gx-ops-quiet">${quiet}</p>`}</div>
    </section>
    ${section('an', '괴이', w.an.length, an, '발생한 괴이가 없어요.')}
    ${section('in', '사건', w.inc.length, inc, '진행 중인 사건이 없어요.')}
    ${section('ms', '특수', w.ms.length, ms, '출현한 특수가 없어요.')}
    <section class="gx-sec" id="gx-sec-ag"><h2>요원<small>${roster.length}명${onOp.length ? ` · ${onOp.length}명 작전 중` : ''}</small></h2>${promo}${roster.length ? `<ul class="gx-acards">${ag}</ul>` : `<p class="gx-none">${worldSettings(ctx.char.globalLore, ctx.chat.scriptstate).agent_limit === 0 ? '설정에서 요원 표시 인원을 0명으로 해 두었어요.' : '이 소속에는 요원 명단이 없어요.'}</p>`}</section>
  </main>`;
}
