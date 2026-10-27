// 세계 편집 창 (docs/설계안_세계편집.md 5장): 패널과 별도의 창. 왼쪽 트리 + 오른쪽 편집기.
// 저장은 전부 카드 명부(Directory)로: 명부 줄(기존 dirUi 초안)과 세계 덧쓰기(edUi.over)를 한 번에 쓴다.
import { directoryData, withDirectory, readDirectoryData, type Directory } from '../../core/world/directory';
import { overrideCount } from '../../core/world/draft';
import type { WorldOverrides } from '../../core/world/records';
import { WORLD_KIND_LABEL, type WorldKind } from '../../core/world/schema';
import { GUIDE_LABEL, GUIDE_NAMES, type GuideName } from '../../core/guides';
import { LEGACY_DATA } from '../../core/lorebooks';
import { getPrefs } from '../../core/settings';
import { updateCharacterLore, type ChatContext } from '../../host/risu';
import { savePrefs } from '../../host/prefs';
import { cropValue, directoryDraft, directoryExtList, directoryInput, directoryPhotoList, directoryView, dirUi, dirty as dirDirty, handleDirectory, resetDirectory, setCrop } from '../directory';
import { handleImgPrompt, imgInput, imgPromptPane } from '../imgprompt';
import { ICONS } from '../icons';
import editorCss from './style.css';
import { recordCount, recordList, recordPage, recordAction, recordInput, recUi } from './record';
import { relationsPage, relationsAction, relationsInput } from './relations';
import { guidePage, guideAction, guideInput, guideUi } from './guides';
import { installAction, installPage, instUi, refreshInstall } from './install';
import { featurePane, settingsNotices, settingsSection, settingsUi, type SettingsSection } from '../settings';
import { gnetLabel } from '../../core/gnet';

/** 설정 페이지 (2026-10-27: 모든 설정은 이 창 하나로. 지침은 그 기능 페이지 아래에) */
export type SetPage = 'screen' | 'image' | 'board' | 'gnet' | 'phone' | 'wiki' | 'visit' | 'people' | 'guides' | 'adv' | 'update';
export type EditorNode = WorldKind | 'base' | 'relations' | `set:${SetPage}` | 'install';
const SET_PAGES: SetPage[] = ['screen', 'image', 'board', 'gnet', 'phone', 'wiki', 'visit', 'people', 'guides', 'adv', 'update'];
export const isSetNode = (n: string): n is `set:${SetPage}` => n.startsWith('set:') && SET_PAGES.includes(n.slice(4) as SetPage);

export interface EditorHost {
  ctx: () => ChatContext | null;
  /** 앱 쪽 화면 다시 그리기 + 컨텍스트 다시 읽기 (저장 뒤) */
  refresh: () => Promise<void>;
  theme: () => string;
  /** 패널의 동작·입력 처리기 (설정 페이지의 단추·입력은 패널과 같은 코드로) */
  handle?: (action: string, value?: string) => Promise<void>;
  input?: (el: HTMLInputElement) => void;
  change?: (el: HTMLSelectElement) => void;
  /** 채팅이 시작됐나 (설정의 「이 채팅」 범위를 쓸 수 있나) */
  canChat?: () => boolean;
}

export const edUi = {
  open: false,
  node: 'agent' as EditorNode,
  /** 기록 종류별로 고른 이름 */
  sel: {} as Partial<Record<WorldKind, string>>,
  q: '',
  over: {} as WorldOverrides,
  /** 덧쓰기 초안을 만든 로어북 */
  from: null as unknown,
  base: '',
  busy: false,
  notice: '',
  info: '',
  drawer: false,
  confirm: '' as '' | 'close' | 'reset',
};

let root: HTMLElement | null = null;
let host: EditorHost | null = null;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** 세계 덧쓰기 초안: 카드 명부의 세계 칸에서 시작. 카드가 바뀌었고 고친 게 없으면 새로 읽는다 */
export function overridesOf(ctx: ChatContext): WorldOverrides {
  const lore = ctx.char.globalLore ?? [];
  if (edUi.from !== lore && (!edUi.from || !worldDirty())) {
    const d = readDirectoryData(lore) as unknown as { 세계?: WorldOverrides } | null;
    edUi.over = structuredClone(d?.세계 ?? {});
    edUi.base = JSON.stringify(edUi.over);
    edUi.from = lore;
  }
  return edUi.over;
}
export const worldDirty = () => JSON.stringify(edUi.over) !== edUi.base;
export const anyDirty = () => worldDirty() || dirDirty();
export function setOverrides(next: WorldOverrides): void {
  edUi.over = next;
}

export function openEditor(h: EditorHost, node?: EditorNode): void {
  host = h;
  edUi.open = true;
  if (node) edUi.node = node;
  edUi.notice = '';
  syncSettingsPage();
  ensureRoot();
  render();
}

/** 설정 페이지에 맞춰 패널의 기능 설정 상태를 맞춘다 (괴담넷·괴담톡·위키·필드·인물 기록 단추가 그 기능 처리기로 가게) */
function syncSettingsPage(): void {
  const n = edUi.node;
  const page = isSetNode(n) ? n.slice(4) : '';
  settingsUi.page = page === 'gnet' || page === 'phone' || page === 'wiki' || page === 'visit' || page === 'people' ? page : '';
}

export function closeEditor(): void {
  edUi.open = false;
  edUi.confirm = '';
  if (root) root.hidden = true;
}

export const editorOpen = () => edUi.open;
/** 설정 페이지가 떠 있나 (패널이 다시 그려질 때 같이 그린다) */
export const editorOnSettings = () => edUi.open && isSetNode(edUi.node);

function ensureRoot(): HTMLElement {
  if (root) {
    root.hidden = false;
    return root;
  }
  const style = document.createElement('style');
  style.textContent = editorCss;
  document.head.appendChild(style);
  root = document.createElement('div');
  root.className = 'gw';
  document.body.appendChild(root);
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === root) return void handle('ed-close');
    // 거점: 지역 지도를 누른 자리가 거점 위치 (%) — 패널(app.ts)과 같은 처리
    const pickMap = t.closest<HTMLElement>('[data-base-pick]');
    if (pickMap) {
      const img = pickMap.querySelector('img')?.getBoundingClientRect();
      if (!img || !img.width || !img.height) return;
      const x = ((ev as MouseEvent).clientX - img.left) / img.width * 100;
      const y = ((ev as MouseEvent).clientY - img.top) / img.height * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;
      return void handle('dir-base-xy', `${x.toFixed(1)}|${y.toFixed(1)}|${pickMap.dataset.basePick}`);
    }
    const el = t.closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    const take = el.dataset.take ? root?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${el.dataset.take}"]`)?.value : undefined;
    void handle(el.dataset.action!, take ?? el.dataset.value);
  });
  root.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement | HTMLTextAreaElement;
    const name = el?.dataset?.input;
    if (!name) return;
    const ctx = host?.ctx();
    if (name === 'dir') {
      directoryInput(el.dataset.key ?? '', el.value, null);
      touched();
      return;
    }
    if (name === 'ed-q') {
      edUi.q = el.value;
      const box = root?.querySelector('.gw-list');
      if (box && ctx && isKind(edUi.node)) box.innerHTML = recordList(ctx, edUi.node, overridesOf(ctx), edUi.q);
      return;
    }
    if (imgInput(name, el.value)) return;
    // 명부 패널 재사용 부분의 입력 (사진 고르기 검색·얼굴 틀 크기·후보 검색): 패널(app.ts)과 같은 처리 (2026-10-27: 편집 창에서 안 먹던 문제)
    if (name === 'dir-photo-q' && ctx) {
      dirUi.pickQ = el.value;
      const box = root?.querySelector('.dir-pics');
      if (box) box.innerHTML = directoryPhotoList(ctx);
      return;
    }
    if (name === 'dir-crop-size') {
      const key = el.dataset.key ?? '';
      const [x, y] = cropValue(key);
      setCrop(key, [x, y, Number(el.value)]);
      const frame = root?.querySelector<HTMLElement>('[data-crop] .dir-crop-frame');
      if (frame) frame.style.width = `${el.value}%`;
      return;
    }
    if (name === 'dir-ext-q' && ctx) {
      dirUi.addQ = el.value;
      const box = root?.querySelector('.dir-ext-list');
      if (box) box.innerHTML = directoryExtList(ctx);
      return;
    }
    if (ctx && recordInput(name, el.dataset.key ?? '', el.value, ctx)) return void touched();
    if (ctx && relationsInput(name, el.dataset.key ?? '', el.value, ctx)) return void touched();
    if (guideInput(name, el.dataset.key ?? '', el.value)) return void touched();
    // 설정 페이지의 입력(슬라이더·검색·규칙 글칸 등)은 패널과 같은 처리기로
    host?.input?.(el as HTMLInputElement);
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target as HTMLSelectElement;
    if (el?.dataset?.input === 'dir-crop-size') return render();
    if (el?.dataset?.change) return void handle(el.dataset.change, el.value);
    host?.change?.(el);
  });
  root.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const input = form.querySelector('input');
    if (form.dataset.submit) void handle(form.dataset.submit, input?.value ?? '');
  });
  root.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (ev.key === 'Enter' && el?.dataset?.enter && !(el instanceof HTMLTextAreaElement)) {
      ev.preventDefault();
      void handle(el.dataset.enter, el.value);
    }
    if (ev.key === 'Escape' && !edUi.confirm) void handle('ed-close');
  });
  // 칸 순서 끌기 (손잡이)
  let drag: string | null = null;
  root.addEventListener('dragstart', (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-field-row]');
    drag = row?.dataset.fieldRow ?? null;
    if (row) row.classList.add('dragging');
    ev.dataTransfer?.setData('text/plain', drag ?? '');
  });
  root.addEventListener('dragover', (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-field-row]');
    if (!row || !drag) return;
    ev.preventDefault();
    root?.querySelectorAll('.drop-before').forEach((x) => x.classList.remove('drop-before'));
    row.classList.add('drop-before');
  });
  root.addEventListener('drop', (ev) => {
    const row = (ev.target as HTMLElement).closest<HTMLElement>('[data-field-row]');
    root?.querySelectorAll('.drop-before, .dragging').forEach((x) => x.classList.remove('drop-before', 'dragging'));
    if (!row || !drag) return;
    ev.preventDefault();
    const to = row.dataset.fieldRow ?? '';
    const from = drag;
    drag = null;
    if (from && to && from !== to) void handle('ed-field-drop', `${from}|${to}`);
  });
  root.addEventListener('dragend', () => root?.querySelectorAll('.drop-before, .dragging').forEach((x) => x.classList.remove('drop-before', 'dragging')));
  return root;
}

/** 입력이 있었다: 저장 상태 줄만 다시 그린다 (글칸을 다시 그리면 커서가 날아간다) */
function touched(): void {
  const bar = root?.querySelector('.gw-save');
  if (bar) bar.outerHTML = saveBar();
  const tok = root?.querySelector('.gw-tokens');
  const ctx = host?.ctx();
  if (tok && ctx && isKind(edUi.node)) tok.outerHTML = recUi.tokensHtml(ctx, edUi.node, overridesOf(ctx));
}

export const isKind = (n: string): n is WorldKind => ['agent', 'org', 'anomaly', 'site', 'appendix'].includes(n);

const SET_LABEL: Record<SetPage, string> = { screen: '화면', image: '캐릭터 이미지', board: '상황판', gnet: '괴담넷', phone: '괴담톡', wiki: '위키', visit: '필드', people: '인물 기록', guides: '본편 지침', adv: '고급', update: '업데이트' };
const SET_ICON: Record<SetPage, string> = { screen: ICONS.settings, image: ICONS.cctv, board: ICONS.grid, gnet: ICONS.gnet, phone: ICONS.phone, wiki: ICONS.wiki, visit: ICONS.game, people: ICONS.group, guides: ICONS.book, adv: ICONS.pen, update: ICONS.refresh };
const TREE: { title: string; items: [EditorNode, string, string][] }[] = [
  { title: '설정', items: SET_PAGES.map((p) => [`set:${p}`, SET_LABEL[p], SET_ICON[p]] as [EditorNode, string, string]) },
  { title: '세계', items: [['agent', '요원', ICONS.person], ['org', '조직', ICONS.org], ['anomaly', '괴이', ICONS.spook], ['site', '파밍', ICONS.star], ['appendix', '부록', ICONS.book], ['base', '거점', ICONS.pin], ['relations', '세력 관계', ICONS.grid]] },
  { title: '카드', items: [['install', '설치 · 점검', ICONS.refresh]] },
];
void GUIDE_NAMES;
void GUIDE_LABEL;

/** 설정 페이지: 패널 설정의 묶음을 그대로 + 그 기능의 지침 */
function settingsPage(ctx: ChatContext, page: SetPage): string {
  const canChat = host?.canChat?.() ?? true;
  const scope = canChat ? (settingsUi.scope === 'defaults' ? 'defaults' : 'chat') : 'defaults';
  const scopeSeg = canChat
    ? `<div class="gx-segs gx-segs-sm gw-scope"><button class="gx-seg${scope === 'chat' ? ' on' : ''}" data-action="set-scope" data-value="chat" aria-pressed="${scope === 'chat'}">이 채팅</button><button class="gx-seg${scope === 'defaults' ? ' on' : ''}" data-action="set-scope" data-value="defaults" aria-pressed="${scope === 'defaults'}">새 채팅 기본값</button></div>`
    : '<span class="gw-tokens">새 채팅 기본값 (시작 전)</span>';
  const title = page === 'gnet' ? gnetLabel(ctx.chat.scriptstate) : SET_LABEL[page];
  const sec = (s: SettingsSection) => settingsSection(ctx, scope, canChat, s);
  const guide = (g: GuideName) => `<div class="gw-set-guide">${guidePage(g).replace(/^<div class="gw-page">/, '<div class="gw-page gw-page-inner">')}</div>`;
  let body = '';
  let act = '';
  const feat = (p: 'gnet' | 'phone' | 'wiki' | 'visit' | 'people', g?: GuideName) => {
    const r = featurePane(ctx, p, canChat);
    act = r.act;
    return r.body + (g ? guide(g) : '');
  };
  switch (page) {
    case 'screen': body = sec('screen'); break;
    case 'image': body = sec('image') + `<section class="ps-group"><h3>이미지 지침</h3><div class="ps-rows">${imgPromptPane(ctx)}</div></section>`; break;
    case 'board': body = sec('board') + guide('Tag'); break;
    case 'gnet': body = feat('gnet', 'GNet'); break;
    case 'phone': body = feat('phone', 'Phone'); break;
    case 'wiki': body = feat('wiki', 'Wiki'); break;
    case 'visit': body = feat('visit', 'Visit'); break;
    case 'people': body = feat('people'); break;
    case 'guides': body = guide('RP') + guide('Directive'); break;
    case 'adv': body = sec('adv'); break;
    case 'update': body = sec('update'); break;
  }
  // 머리는 모든 페이지가 같다: 제목 왼쪽, 오른쪽에 범위(이 채팅/새 채팅 기본값) 또는 그 기능의 단추(덮어쓰기·불러오기). 시작 전이면 같은 글귀
  const showScope = ['screen', 'image', 'board', 'adv'].includes(page);
  const right = showScope ? scopeSeg : `${canChat ? '' : '<span class="gw-tokens">새 채팅 기본값 (시작 전)</span>'}${act}`;
  return `<div class="gw-page gw-set"><header class="gw-head"><h2>${esc(title)}</h2>${right ? `<div class="gw-head-act">${right}</div>` : ''}</header>
    ${settingsNotices()}
    <div class="gx-settings gw-setbody">${body}</div></div>`;
}

function saveBar(): string {
  const n = (() => {
    try {
      return overrideCount(edUi.over);
    } catch {
      return 0;
    }
  })();
  const dirty = anyDirty();
  return `<div class="gw-save${dirty ? ' dirty' : ''}">
    <span class="gw-save-state">${edUi.busy ? '저장하는 중…' : dirty ? `고친 것 있음 · 덧쓰기 ${n}건` : `저장됨 · 덧쓰기 ${n}건`}</span>
    <button class="gx-mini" data-action="ed-save" ${dirty && !edUi.busy ? '' : 'disabled'}>${ICONS.pen}저장</button>
    <button class="gx-mini" data-action="ed-revert" ${dirty && !edUi.busy ? '' : 'disabled'}>되돌리기</button>
  </div>`;
}

/** 왼쪽 메뉴의 개수: 기록 종류마다 지금 기록 수(지운 것 제외), 거점 수 */
function treeCounts(ctx: ChatContext | null): Partial<Record<EditorNode, number>> {
  if (!ctx) return {};
  const over = overridesOf(ctx);
  const out: Partial<Record<EditorNode, number>> = {};
  for (const k of ['agent', 'org', 'anomaly', 'site', 'appendix'] as WorldKind[]) out[k] = recordCount(ctx, k, over);
  out.base = directoryDraft(ctx).bases.length;
  return out;
}

function tree(ctx: ChatContext | null): string {
  const counts = treeCounts(ctx);
  return TREE.map(
    (g) => `<div class="gw-tree-group"><h4>${g.title}</h4>${g.items
      .map(([id, label, icon]) => `<button class="gw-tree-item${edUi.node === id ? ' on' : ''}" data-action="ed-node" data-value="${id}">${icon}<span>${esc(label)}</span>${counts[id] !== undefined ? `<em>${counts[id]}</em>` : ''}</button>`)
      .join('')}</div>`,
  ).join('');
}

function body(ctx: ChatContext): string {
  const n = edUi.node;
  if (isKind(n)) return recordPage(ctx, n, overridesOf(ctx), edUi.q, edUi.sel[n] ?? '');
  if (n === 'base') {
    // 거점: 지도에 찍히는 장소. 명부 패널의 거점 탭을 그대로 (종류 탭·사용법은 CSS 로 숨김). 호칭·괴담톡 탭은 조직 기록의 기본 정보에
    dirUi.kind = 'base';
    return `<div class="gw-page gw-basepage"><header class="gw-head"><h2>거점</h2><p class="gx-muted">지도에 찍히는 장소예요. 조직마다 거점을 두고 지도를 눌러 위치를 정해요. 조직의 호칭·괴담톡 탭은 조직 기록의 「기본 정보」에서 고쳐요.</p></header>${directoryView(ctx)}</div>`;
  }
  if (n === 'relations') return relationsPage(ctx, overridesOf(ctx), false);
  if (isSetNode(n)) return settingsPage(ctx, n.slice(4) as SetPage);
  // 설치 · 점검: 이 캐릭터를 아직 점검하지 않았으면 점검하고 다시 그린다 (어느 길로 열어도)
  if (instUi.forChar !== ctx.charIndex && !instUi.pending) {
    instUi.pending = true;
    void refreshInstall(ctx).finally(() => {
      instUi.pending = false;
      render();
    });
  }
  return installPage(ctx);
}

export function render(): void {
  if (!root || !edUi.open || !host) return;
  const ctx = host.ctx();
  if (ctx) overridesOf(ctx); // 저장·새로 읽기 뒤 덧쓰기 초안을 카드 값으로 맞춘다 (지침 화면처럼 초안을 안 쓰는 화면에서도)
  root.hidden = false;
  root.dataset.theme = host.theme();
  const width = getPrefs().editorWidth ?? 90;
  root.style.setProperty('--gw-width', `${width}%`);
  const confirm = edUi.confirm
    ? `<div class="gw-confirm"><div class="gw-confirm-box"><p>${edUi.confirm === 'close' ? '고친 것이 저장되지 않았어요. 저장하지 않고 닫을까요?' : '고친 것을 전부 버리고 카드에 저장된 값으로 되돌릴까요?'}</p>
        <div class="gx-row-btns"><button class="gx-mini danger" data-action="${edUi.confirm === 'close' ? 'ed-close-force' : 'ed-revert-force'}">${edUi.confirm === 'close' ? '저장 안 하고 닫기' : '되돌리기'}</button><button class="gx-mini" data-action="ed-confirm-no">취소</button></div></div></div>`
    : '';
  root.innerHTML = `<div class="gw-win${edUi.drawer ? ' drawer' : ''}">
    <header class="gw-top">
      <button class="gx-x gw-menu" data-action="ed-drawer" aria-label="메뉴">${ICONS.list}</button>
      <b>설정</b>
      ${(isSetNode(edUi.node) || edUi.node === 'install') && !anyDirty() ? '' : saveBar()}
      ${edUi.notice ? `<span class="gw-notice err">${esc(edUi.notice)}</span>` : edUi.info ? `<span class="gw-notice">${esc(edUi.info)}</span>` : ''}
      <button class="gx-x" data-action="ed-close" aria-label="닫기">${ICONS.close}</button>
    </header>
    <nav class="gw-tree">${tree(ctx)}</nav>
    <main class="gw-body">${ctx ? body(ctx) : '<p class="gx-err">채팅 정보를 읽지 못했어요. 창을 닫고 다시 열어 주세요.</p>'}</main>
    ${confirm}
  </div>`;
}

const env = { render: () => render(), refresh: async () => { await host?.refresh(); render(); } };

async function save(ctx: ChatContext): Promise<void> {
  if (edUi.busy) return;
  edUi.busy = true;
  edUi.notice = '';
  render();
  try {
    const d: Directory = directoryDraft(ctx);
    const over = overridesOf(ctx);
    const data = { ...directoryData(d), 세계: over as unknown as Record<string, unknown> };
    await updateCharacterLore(ctx.charIndex, (lore) => withDirectory(lore, data).filter((e) => !d.folders || !LEGACY_DATA.includes(String(e.comment ?? ''))));
    dirUi.draft = null;
    edUi.from = null;
    edUi.info = '카드에 저장했어요';
    await host?.refresh();
  } catch (error) {
    edUi.notice = `저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
  }
  edUi.busy = false;
  render();
}

export async function handle(action: string, value?: string): Promise<void> {
  const ctx = host?.ctx() ?? null;
  switch (action) {
    case 'ed-close':
      if (anyDirty()) {
        edUi.confirm = 'close';
        return render();
      }
      return closeEditor();
    case 'ed-close-force':
      dirUi.draft = null;
      edUi.from = null;
      return closeEditor();
    case 'ed-confirm-no':
      edUi.confirm = '';
      return render();
    case 'ed-revert':
      edUi.confirm = 'reset';
      return render();
    case 'ed-revert-force':
      edUi.confirm = '';
      dirUi.draft = null;
      edUi.from = null;
      edUi.info = '카드 값으로 되돌렸어요';
      return render();
    case 'ed-save':
      if (ctx) await save(ctx);
      return;
    case 'ed-drawer':
      edUi.drawer = !edUi.drawer;
      return render();
    case 'ed-node':
      edUi.node = (value ?? 'agent') as EditorNode;
      edUi.q = '';
      edUi.drawer = false;
      edUi.notice = '';
      if (edUi.node === 'base') resetDirectory();
      syncSettingsPage();
      if (edUi.node === 'install') {
        instUi.notice = '';
        instUi.info = '';
        instUi.forChar = -1; // 열 때마다 다시 점검
      }
      return render();
    case 'ed-width': {
      const w = Math.max(50, Math.min(100, Number(value) || 90));
      await savePrefs((p) => ({ ...p, editorWidth: w }));
      return render();
    }
  }
  if (!ctx) return;
  if (action.startsWith('dir-')) {
    await handleDirectory(action, value, ctx, env);
    return;
  }
  if (action.startsWith('ip-')) {
    await handleImgPrompt(action, value, { render });
    return;
  }
  if (action.startsWith('ed-rel-') || action.startsWith('ed-rules')) {
    if (await relationsAction(action, value, ctx)) render();
    return;
  }
  if (action.startsWith('ed-guide-')) {
    if (await guideAction(action, value)) render();
    return;
  }
  if (await installAction(action, ctx, env)) return;
  if (isKind(edUi.node) && (await recordAction(action, value, ctx, edUi.node))) render();
  // 그 밖의 동작(설정 단추·기능 설정)은 패널과 같은 처리기로. 패널이 다시 그려질 때 설정 페이지도 같이 그린다 (app.ts render)
  else if (host?.handle && !action.startsWith('ed-')) {
    await host.handle(action, value);
    render();
  }
}

export { guideUi };
