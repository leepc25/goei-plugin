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
import { directoryDraft, directoryInput, directoryView, dirUi, dirty as dirDirty, handleDirectory, resetDirectory } from '../directory';
import { handleImgPrompt, imgInput, imgPromptPane } from '../imgprompt';
import { ICONS } from '../icons';
import editorCss from './style.css';
import { recordList, recordPage, recordAction, recordInput, recUi } from './record';
import { relationsPage, relationsAction, relationsInput } from './relations';
import { guidePage, guideAction, guideInput, guideUi } from './guides';

export type EditorNode = WorldKind | 'directory' | 'relations' | 'rules' | `guide:${GuideName}` | 'guide:Image' | 'install';

export interface EditorHost {
  ctx: () => ChatContext | null;
  /** 앱 쪽 화면 다시 그리기 + 컨텍스트 다시 읽기 (저장 뒤) */
  refresh: () => Promise<void>;
  theme: () => string;
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
  ensureRoot();
  render();
}

export function closeEditor(): void {
  edUi.open = false;
  edUi.confirm = '';
  if (root) root.hidden = true;
}

export const editorOpen = () => edUi.open;

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
    if (ctx && recordInput(name, el.dataset.key ?? '', el.value, ctx)) return void touched();
    if (ctx && relationsInput(name, el.dataset.key ?? '', el.value, ctx)) return void touched();
    if (guideInput(name, el.dataset.key ?? '', el.value)) return void touched();
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

const TREE: { title: string; items: [EditorNode, string, string][] }[] = [
  { title: '기록', items: [['agent', '요원', ICONS.person], ['org', '조직', ICONS.org], ['anomaly', '괴이', ICONS.spook], ['site', '파밍', ICONS.star], ['appendix', '부록', ICONS.book], ['directory', '명부 · 거점 · 호칭 · 탭', ICONS.list]] },
  { title: '세력', items: [['relations', '세력 관계', ICONS.grid], ['rules', '공통 규칙', ICONS.pen]] },
  { title: '지침', items: [...GUIDE_NAMES.map((g) => [`guide:${g}`, GUIDE_LABEL[g], ICONS.book] as [EditorNode, string, string]), ['guide:Image', '이미지', ICONS.cctv]] },
  { title: '설치', items: [['install', '설치 · 점검', ICONS.refresh]] },
];

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

function tree(): string {
  return TREE.map(
    (g) => `<div class="gw-tree-group"><h4>${g.title}</h4>${g.items
      .map(([id, label, icon]) => `<button class="gw-tree-item${edUi.node === id ? ' on' : ''}" data-action="ed-node" data-value="${id}">${icon}<span>${esc(label)}</span></button>`)
      .join('')}</div>`,
  ).join('');
}

function body(ctx: ChatContext): string {
  const n = edUi.node;
  if (isKind(n)) return recordPage(ctx, n, overridesOf(ctx), edUi.q, edUi.sel[n] ?? '');
  if (n === 'directory') return `<div class="gw-page"><header class="gw-head"><h2>명부 · 거점 · 호칭 · 괴담톡 탭</h2><p class="gx-muted">예전 「설정 → 명부」 화면 그대로예요. 요원·괴이·파밍·조직의 로어 칸은 왼쪽 「기록」에서 고쳐요.</p></header>${directoryView(ctx)}</div>`;
  if (n === 'relations' || n === 'rules') return relationsPage(ctx, overridesOf(ctx), n === 'rules');
  if (n === 'guide:Image') return `<div class="gw-page"><header class="gw-head"><h2>이미지 지침</h2><p class="gx-muted">이 기기 공통. 설정 → 캐릭터 이미지의 「지침 편집」과 같은 화면이에요.</p></header>${imgPromptPane(ctx)}</div>`;
  if (n.startsWith('guide:')) return guidePage(n.slice(6) as GuideName);
  return `<div class="gw-page"><header class="gw-head"><h2>설치 · 점검</h2></header><p class="gx-hint">깡통봇 설치(폴더·매니페스트·명부 심기, 그림 받기, 인사말 심기)와 점검은 다음 단계(5단계)에서 들어와요.</p></div>`;
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
      <b>세계 편집</b>
      ${saveBar()}
      ${edUi.notice ? `<span class="gw-notice err">${esc(edUi.notice)}</span>` : edUi.info ? `<span class="gw-notice">${esc(edUi.info)}</span>` : ''}
      <button class="gx-x" data-action="ed-close" aria-label="닫기">${ICONS.close}</button>
    </header>
    <nav class="gw-tree">${tree()}</nav>
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
      if (edUi.node === 'directory') resetDirectory();
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
  if (isKind(edUi.node) && (await recordAction(action, value, ctx, edUi.node))) render();
}

export { guideUi };
