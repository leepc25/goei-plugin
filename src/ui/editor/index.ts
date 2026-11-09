// 세계 편집 창 (docs/설계안_세계편집.md 5장): 패널과 별도의 창. 왼쪽 트리 + 오른쪽 편집기.
// 저장은 전부 카드 명부(Directory)로: 명부 줄(기존 dirUi 초안)과 세계 덧쓰기(edUi.over)를 한 번에 쓴다.
import { bindNeedFill } from '../needfill';
import { directoryData, withDirectory, readDirectoryData, type Directory } from '../../core/world/directory';
import type { WorldOverrides } from '../../core/world/records';
import { WORLD_KIND_LABEL, type WorldKind } from '../../core/world/schema';
import { GUIDE_LABEL, type GuideName } from '../../core/guides';
import { LEGACY_DATA } from '../../core/lorebooks';
import { getPrefs } from '../../core/settings';
import { updateCharacterLore, type ChatContext } from '../../host/risu';
import { savePrefs } from '../../host/prefs';
import { bindCropDrag, cropValue, directoryDraft, directoryExtList, directoryInput, directoryPhotoList, directoryView, dirUi, dirty as dirDirty, handleDirectory, resetDirectory, setCrop } from '../directory';
import { handleImgPrompt, imgInput, imgPromptPane } from '../imgprompt';
import { GHOST_ICON, ICONS } from '../icons';
import { labelSwitches } from '../controls';
import { bindDrawer, drawerHtml } from '../drawer';
import { bindMbar } from '../mbar';
import { rememberPanel } from '../panels';
import editorCss from './style.css';
import { recordCount, recordList, recordPage, recordAction, recordInput, recUi, rowsOf } from './record';
import { relationsPage, relationsAction, relationsInput } from './relations';
import { startPage } from './start';
import { guidePage, guideAction, guideBarSync, guideInput, guideUi } from './guides';
import { isRuleNode, ruleAction, ruleInput, rulePage, ruleTreeItems } from './rules';
import { callSummary } from './flow';
import { ensureManage, isManageNode, manageAction, manageInput, managePage, manageConfirmPopup, manUi, type ManageNode, manageFile } from './manage';
import { installAction, installPage, instUi, refreshInstall } from './install';
import { featurePane, mainDefaultsPopup, resetHooks, settingsNotices, settingsSection, settingsUi, type SettingsSection } from '../settings';
import { siteLogo } from '../browser';
import { basicSettings } from '../../core/settings';
import { worldOn } from '../../core/world';
import { ppValue } from '../../core/people/settings';
import { isPhone } from '../media';
import { markCommitted, morph } from '../morph';

/** 설정 페이지 (2026-10-27: 모든 설정은 이 창 하나로. 지침은 그 기능 페이지 아래에) */
export type SetPage = 'screen' | 'image' | 'board' | 'status' | 'gnet' | 'gal' | 'wpf' | 'sm' | 'cos' | 'bm' | 'phone' | 'wiki' | 'journal' | 'wallet' | 'items' | 'shop' | 'people' | 'factions' | 'lore' | 'adv' | 'update' | 'versus';
export type GuideNode = `guide:${GuideName | 'Image'}`;
export type EditorNode = WorldKind | 'base' | 'start' | 'relations' | `set:${SetPage}` | 'install' | GuideNode | ManageNode | `rule:${string}`;
const SET_PAGES: SetPage[] = ['screen', 'image', 'board', 'status', 'gnet', 'gal', 'wpf', 'sm', 'cos', 'bm', 'phone', 'wiki', 'journal', 'wallet', 'items', 'shop', 'people', 'factions', 'lore', 'adv', 'update', 'versus'];
/** 패널 기능 설정 화면을 그대로 쓰는 페이지 (게시판 사이트·괴담톡·위키·기록) */
const isFeatPage = (p: string): p is NonNullable<typeof settingsUi.page> & string => ['gnet', 'gal', 'wpf', 'sm', 'cos', 'bm', 'phone', 'wiki', 'people', 'journal', 'factions'].includes(p);
export const isSetNode = (n: string): n is `set:${SetPage}` => n.startsWith('set:') && SET_PAGES.includes(n.slice(4) as SetPage);
export const isGuideNode = (n: string): n is GuideNode => n.startsWith('guide:');
/* 상단 탭 (2026-10-27 리수폿식): 설정(기능) · 세계 · 지침 · 관리. 왼쪽 목록은 탭마다 다르다 */
export type Tab = 'set' | 'world' | 'guide' | 'manage';
const TABS: [Tab, string, string][] = [['set', '기능', ICONS.settings], ['world', '세계', ICONS.map], ['guide', '지침', ICONS.book], ['manage', '점검', ICONS.refresh]];
export const tabOf = (n: EditorNode): Tab => (isKind(n) || n === 'base' || n === 'start' || n === 'relations' ? 'world' : isGuideNode(n) || isRuleNode(n) ? 'guide' : n === 'install' || n === 'set:update' || (n.startsWith('manage:') && n !== 'manage:flow') ? 'manage' : 'set');
// 「호출 흐름」(manage:flow) 은 점검이 아니라 기능 탭 맨 위 (2026-11-07 사용자: 설정된 흐름을 보는 페이지니 기능에 있어야)
/** 옛 노드 이름 → 지금 (설정 페이지 아래 있던 지침은 지침 탭으로) */
const legacyNode = (n: string): EditorNode => (n === 'set:guides' ? 'guide:RP' : n === 'set:update' ? 'install' : n.startsWith('rule:') ? 'rule:all' : (n as EditorNode));

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
  /** 폰: 본 창과 같은 하단 바(<nav class="gx-nav">…) — 설정도 본 창의 한 화면처럼 보이게 (2026-10-29 사용자) */
  mobileNav?: () => string;
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
  confirm: '' as '' | 'close',
  /** 탭마다 마지막으로 보던 페이지 */
  last: {} as Partial<Record<Tab, EditorNode>>,
  /** 기능 탭 「설정 찾기」 칸에 적은 말 (2026-11-06 사용자 승인, 전수점검 8-10) */
  sq: '',
  /** 세계 통합 검색 (2026-11-07 사용자: 종류마다 검색 말고 요원·조직·괴이·파밍·부록을 한 칸에서) */
  wq: '',
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
  if (node) edUi.node = legacyNode(node);
  edUi.notice = '';
  // 저장소 사용량은 창을 열 때마다 다시 읽는다 (2026-10-28 QC: 처음 한 번만 읽어 설정을 바꿔도 크기가 그대로였다)
  manUi.sizes = null;
  findIndex = null; // 찾기 목록은 창을 열 때마다 새로 만든다 (기능을 켜고 끄면 줄이 바뀐다)
  syncSettingsPage();
  ensureRoot();
  render();
}

/** 설정 페이지에 맞춰 패널의 기능 설정 상태를 맞춘다 (괴담넷·괴담톡·위키·필드·인물 기록 단추가 그 기능 처리기로 가게) */
function syncSettingsPage(): void {
  const n = edUi.node;
  const page = isSetNode(n) ? n.slice(4) : '';
  settingsUi.page = isFeatPage(page) ? page : '';
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
  bindNeedFill();
  // 접는 칸(details data-keep)의 펼침을 기억한다: 조작 뒤 창을 다시 그려도 접히지 않게 (2026-10-28 QC: 패널만 기억하고 편집 창은 안 했다)
  root.addEventListener('toggle', (ev) => rememberPanel(ev.target as HTMLDetailsElement), true);
  // 명부 얼굴 틀 끌기: 본 창과 같은 처리기 (2026-11-05: 설정 창에선 크기만 바뀌고 위치를 못 옮기던 문제)
  bindCropDrag(root, () => render());
  root.addEventListener('click', (ev) => {
    const t = ev.target as HTMLElement;
    if (t === root) return void run('ed-close');
    // 거점: 지역 지도를 누른 자리가 거점 위치 (%) — 패널(app.ts)과 같은 처리
    const pickMap = t.closest<HTMLElement>('[data-base-pick]');
    if (pickMap) {
      const img = pickMap.querySelector('img')?.getBoundingClientRect();
      if (!img || !img.width || !img.height) return;
      const x = ((ev as MouseEvent).clientX - img.left) / img.width * 100;
      const y = ((ev as MouseEvent).clientY - img.top) / img.height * 100;
      if (x < 0 || x > 100 || y < 0 || y > 100) return;
      return void run('dir-base-xy', `${x.toFixed(1)}|${y.toFixed(1)}|${pickMap.dataset.basePick}`);
    }
    if (slotDropped) return; // 손잡이를 놓은 직후의 click 은 칸 펼치기가 아니다
    const el = t.closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    if (el.dataset.action === 'ed-hint') return hintFor === el ? hideHint() : showHint(el); // 폰: 누르면 열고 닫는다
    const take = el.dataset.take ? root?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${el.dataset.take}"]`)?.value : undefined;
    void run(el.dataset.action!, take ?? el.dataset.value);
  });
  root.addEventListener('mouseover', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('.gw-fhint');
    if (b) showHint(b);
  });
  root.addEventListener('mouseout', (ev) => {
    const b = (ev.target as HTMLElement).closest<HTMLElement>('.gw-fhint');
    if (b && b === hintFor && !(ev.relatedTarget instanceof Node && b.contains(ev.relatedTarget))) hideHint();
  });
  root.addEventListener('scroll', (ev) => {
    if ((ev.target as HTMLElement)?.classList?.contains('gw-body')) syncTop();
    if (Date.now() - hintAt > 400) hideHint();
  }, true); // 막 띄운 직후의 스크롤(scrollIntoView)로는 안 닫는다
  root.addEventListener('input', (ev) => {
    const el = ev.target as HTMLInputElement | HTMLTextAreaElement;
    // 글칸 바로 저장 (2026-11-08 사용자): data-autosave 동작을 손을 뗀 뒤 그 칸 값으로 부른다 (예전 [저장] 단추가 하던 일)
    const auto = el?.dataset?.autosave;
    if (auto) {
      const field = el.getAttribute('name') ?? auto;
      later(`auto:${field}`, () => {
        const cur = root?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${CSS.escape(field)}"]`);
        void run(auto, cur?.value ?? el.value);
      });
    }
    const name = el?.dataset?.input;
    if (!name) return;
    const ctx = host?.ctx();
    if (name === 'dir') {
      directoryInput(el.dataset.key ?? '', el.value, null);
      touched();
      return;
    }
    if (name === 'ed-sq') {
      edUi.sq = el.value;
      const box = root?.querySelector('.gw-find-out');
      if (box) box.innerHTML = edUi.sq.trim() ? findResults(ctx ?? null) : treeGroups(treeCounts(ctx ?? null), featureState(ctx ?? null));
      return;
    }
    if (name === 'ed-wq') {
      edUi.wq = el.value;
      const box = root?.querySelector('.gw-find-out');
      if (box) box.innerHTML = edUi.wq.trim() ? worldFindResults(ctx ?? null) : treeGroups(treeCounts(ctx ?? null), featureState(ctx ?? null));
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
    if (guideInput(name, el.dataset.key ?? '', el.value)) {
      touched();
      // 바로 저장 (2026-11-08 사용자: 지침도). 손을 뗀 뒤 한 번
      const key = el.dataset.key ?? '';
      const g = key.includes('|') ? key.slice(0, key.lastIndexOf('|')) : key;
      later(`guide:${g}`, () => void guideAction('ed-guide-save', g).then(() => guideUi.info && render()));
      return;
    }
    if (ruleInput(name, el.dataset.key ?? '', el.value)) return;
    if (manageInput(name, el.value)) {
      // 가져오기 「적용」 단추는 글칸이 비었을 때 잠겨 그려진다: 다시 그리지 않으니 여기서 풀어 준다 (2026-10-28 QC: 붙여 넣어도 계속 잠겨 있던 문제)
      const btn = root?.querySelector<HTMLButtonElement>('[data-action="man-import"]');
      if (btn) btn.disabled = !el.value.trim();
      return;
    }
    // 설정 페이지의 입력(슬라이더·검색·규칙 글칸 등)은 패널과 같은 처리기로
    host?.input?.(el as HTMLInputElement);
  });
  root.addEventListener('change', (ev) => {
    const el = ev.target as HTMLSelectElement;
    markCommitted(el);
    if (el?.dataset?.input === 'dir-crop-size') return render();
    if (el?.dataset?.change?.startsWith('ed-')) return void run(el.dataset.change, el.value);
    if (el?.dataset?.change === 'man-import-file') return void manageFile(el as unknown as HTMLInputElement).then(() => render());
    if (el?.dataset?.change === 'man-with-chat') return void manageAction('man-with-chat', root, host?.ctx() ?? null, host?.canChat?.() ?? true).then(() => render());
    // 명부 드롭다운(거점 지역·시군구)·이미지 지침 체크는 이 창의 처리기로: 패널 처리기로 보내면 패널만 다시 그려 지도·시군구 목록·체크 표시가 그대로였다 (2026-10-28 QC)
    if (el?.dataset?.change?.startsWith('dir-') || el?.dataset?.change?.startsWith('ip-')) return void run(el.dataset.change, el.dataset.key ? `${el.dataset.key}=${el.value}` : el.value);
    host?.change?.(el);
  });
  root.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const form = ev.target as HTMLFormElement;
    const input = form.querySelector('input');
    if (form.dataset.submit) void run(form.dataset.submit, input?.value ?? '');
  });
  root.addEventListener('keydown', (ev) => {
    const el = ev.target as HTMLInputElement;
    if (ev.key === 'Enter' && el?.dataset?.enter && !(el instanceof HTMLTextAreaElement)) {
      ev.preventDefault();
      void run(el.dataset.enter, el.value);
    }
  });
  // Esc 는 문서 전체에서 받는다: 단추를 누르면 창을 다시 그려 포커스가 body 로 가므로 창 요소의 keydown 만으론 한 번 누른 뒤엔 안 먹었다 (2026-10-28 QC).
  // 패널(app.ts)의 Esc 처리기는 편집 창이 떠 있으면 비켜 준다
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && edUi.open && !edUi.confirm) void run('ed-close');
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
    if (from && to && from !== to) void run('ed-field-drop', `${from}|${to}`);
  });
  let slotDropped = false;
  // 시작 화면 칸 순서 (ui/editor/start.ts): 손잡이를 끌어 다른 칸 위·아래에 놓는다. 명부 요원 순서(app.ts)와 같은 방식
  root.addEventListener('pointerdown', (ev) => {
    const grip = (ev.target as HTMLElement).closest?.<HTMLElement>('[data-drag-slot]');
    const row = grip?.closest<HTMLElement>('[data-slot-row]');
    if (!grip || !row || !root) return;
    ev.preventDefault();
    const box = root;
    const rows = [...box.querySelectorAll<HTMLElement>('[data-slot-row]')].filter((r) => r !== row);
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
      if (target) {
        slotDropped = true;
        setTimeout(() => (slotDropped = false), 0);
      }
      if (target) void run('dir-start-drop', `${target.after ? 'after' : 'before'}|${grip.dataset.dragSlot}|${target.el.dataset.slotRow}`);
    };
    grip.addEventListener('pointermove', move);
    grip.addEventListener('pointerup', up);
    grip.addEventListener('pointercancel', up);
  });
  root.addEventListener('dragend', () => root?.querySelectorAll('.drop-before, .dragging').forEach((x) => x.classList.remove('drop-before', 'dragging')));
  return root;
}

/** 입력이 있었다: 저장 상태 줄만 다시 그린다 (글칸을 다시 그리면 커서가 날아간다) */
function touched(): void {
  if (edUi.notice.startsWith('저장하지 못했어요')) edUi.notice = '';
  autoSaveWorld();
  root?.toggleAttribute('data-dirty', anyDirty());
  if (root && isGuideNode(edUi.node)) guideBarSync(root, edUi.node.slice(6));

  const tok = root?.querySelector('.gw-tokens');
  const ctx = host?.ctx();
  if (tok && ctx && isKind(edUi.node)) tok.outerHTML = recUi.tokensHtml(ctx, edUi.node, overridesOf(ctx));
}

export const isKind = (n: string): n is WorldKind => ['agent', 'org', 'anomaly', 'site', 'appendix'].includes(n);

const SET_LABEL: Record<SetPage, string> = { screen: '화면', image: '캐릭터 이미지', board: '상황판', status: '상태창', gnet: '괴담넷', gal: '괴담갤', wpf: '세정게', sm: '연어 마켓', cos: '우주 쇼핑몰', bm: '백일몽 포인트몰', phone: '괴담톡', wiki: '위키', journal: '일지', wallet: '가계부', items: '소지품', shop: '상점', people: '인물', factions: '세력', lore: '로어북 호출', adv: '생성 공통', update: '업데이트', versus: '대전' };
const SET_ICON: Record<SetPage, string> = { screen: ICONS.settings, image: ICONS.cctv, board: ICONS.grid, status: ICONS.list, gnet: siteLogo('gn'), gal: siteLogo('gal'), wpf: siteLogo('wpf'), sm: siteLogo('sm'), cos: siteLogo('cos'), bm: siteLogo('bm'), phone: ICONS.phone, wiki: ICONS.wiki, journal: ICONS.records, wallet: ICONS.wallet, items: ICONS.bag, shop: ICONS.swap, people: ICONS.group, factions: ICONS.org, lore: ICONS.book, adv: ICONS.pen, update: ICONS.refresh, versus: ICONS.pad };
/** [노드, 이름, 아이콘, 배지?, 하위 항목?]. 노드가 `label:…` 이면 누를 수 없는 소제목 줄 (설정 「기록」 아래 하위 메뉴, 2026-11-05 사용자) */
type TreeItem = [EditorNode | `label:${string}`, string, string, string?, boolean?];
const setItem = (p: SetPage): TreeItem => [`set:${p}`, SET_LABEL[p], SET_ICON[p]];
const guideItem = (g: GuideName | 'Image'): TreeItem => [`guide:${g}`, g === 'Image' ? '이미지' : GUIDE_LABEL[g], ICONS.book];
/** 탭마다 왼쪽 목록 (제목 + 항목). 설정 탭 항목에는 켬/끔 배지, 세계 탭에는 개수 */
function treeOf(tab: Tab): { title: string; items: TreeItem[] }[] {
  switch (tab) {
    case 'set': return [{ title: '기능', items: [
      ['manage:flow', '호출 흐름', ICONS.swap],
      ...(['screen', 'image', 'board', 'status', 'gnet', 'gal', 'wpf', 'sm', 'cos', 'bm', 'phone', 'wiki'] as SetPage[]).map(setItem),
      // 가계부·소지품·상점은 한 페이지 「소지품」 (2026-11-07 사용자: 각자 설정이 적어 합침, 켜고 끄기는 따로)
      setItem('items'),
      ['label:records', '기록', ICONS.records],
      ...(['journal', 'people', 'factions'] as SetPage[]).map((p): TreeItem => [`set:${p}`, SET_LABEL[p], SET_ICON[p], undefined, true]),
      ...(['lore', 'adv'] as SetPage[]).map(setItem),
      setItem('versus'),
    ] }];
    case 'world': return [{ title: '세계', items: [['agent', '요원', ICONS.person], ['org', '조직', ICONS.org], ['start', '시작 화면', ICONS.idcard], ['anomaly', '괴이', ICONS.spook], ['site', '파밍', ICONS.star], ['appendix', '부록', ICONS.book], ['base', '거점', ICONS.pin], ['relations', '세력 관계', ICONS.grid]] }];
    case 'guide': return [
      { title: '추가 규칙', items: ruleTreeItems().map(([id, label, badge]) => [id as EditorNode, label, ICONS.pen, badge] as TreeItem) },
      { title: '기본 지침', items: (['RP', 'Directive', 'Tag'] as GuideName[]).map(guideItem) },
      { title: '기능별 지침', items: (['GNet', 'Gal', 'Wpf', 'Salmon', 'Cos', 'Bm', 'Wiki', 'Shop', 'Phone', 'Image'] as (GuideName | 'Image')[]).map(guideItem) },
      { title: '인물 기록 지침', items: (['Updater', 'UpdaterCompact', 'Director', 'Router'] as GuideName[]).map(guideItem) },
    ];
    // 11-09 사용자: 설치·업데이트는 하나로, 아이콘은 서로 다르게, 다음 호출 로어북은 따로(펼친 채), 이름은 무엇을 보는지 바로 알게
    case 'manage': return [{ title: '점검', items: [['install', '설치·업데이트', ICONS.refresh], ['manage:diag', '상태 점검', ICONS.info], ['manage:lore', '다음 호출 로어북', ICONS.book], ['manage:trace', '호출 기록', ICONS.records], ['manage:log', '실패 기록', ICONS.siren], ['manage:people', '인물 기록 점검', ICONS.group], ['manage:backup', '저장·불러오기', ICONS.swap]] }];
  }
}
const firstOf = (tab: Tab): EditorNode => (tab === 'guide' ? 'guide:RP' : (treeOf(tab)[0].items.find((i) => !i[0].startsWith('label:'))![0] as EditorNode));
/** 기능 켬/끔 배지 (설정 탭 목록) */
function featureState(ctx: ChatContext | null): Partial<Record<EditorNode, boolean>> {
  if (!ctx) return {};
  const ss = ctx.chat.scriptstate;
  const basic = basicSettings(ctx.char.globalLore, ss);
  return {
    'set:board': host?.canChat?.() ? worldOn(ctx.chat) : basic.anomalyOn,
    'set:image': basic.assetOn,
    'set:people': ppValue(ss, 'on') === '1',
  };
}

/* 기능 페이지 머리 (2026-10-27 리수폿식): 설명 한 줄 · 켬/끔 배지 · 「기본」 예시 · 끄면 빠지는 것 */
const FEATURE_INFO: Partial<Record<SetPage, { desc: string; example: string; off?: string }>> = {
  // 2026-10-29 사용자: 응답 태그 형식 같은 안쪽 사정은 예시로 보이지 않는다 (상황판·이미지는 설명만)
  board: { desc: '응답마다 괴이·사건·특수 발생을 판정하고 상황판·지도·요원 상태를 갱신해요.', example: '', off: '끄면 괴이가 자동으로 생기지 않고 상황판이 비어요. 커스텀 임무는 계속 쓸 수 있어요.' },
  image: { desc: '본문에 등장한 캐릭터의 등록 이미지를 채팅 속에 띄워요. 이미지 목록은 봇 카드에 있어요.', example: '', off: '끄면 캐릭터 이미지를 띄우지 않고 이미지 지침도 요청에 넣지 않아요.' },
  gnet: { desc: '괴담넷 게시판 글·댓글·쪽지를 보조 모델이 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '「[목격담] 중림 지하상가 3번 출구에서 또 봤음 · 댓글 7」 — 게시판 글 한 줄. 장면과 관련된 글은 본편 요청에 참고로 붙어요.' },
  gal: { desc: '괴담갤 게시판 글·댓글·쪽지를 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '' },
  wpf: { desc: '세정게 게시판 글·댓글·쪽지를 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '' },
  sm: { desc: '연어 마켓 거래 글·댓글·쪽지를 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '' },
  cos: { desc: '우주 쇼핑몰의 물건 목록과 운영자 답을 만들어요. 산 물건은 소지품에, 돈은 가계부에 남고 다음 턴 본편에 넘어가요. 아래 값은 이 채팅에 저장돼요.', example: '' },
  bm: { desc: '백일몽 포인트몰의 상품 목록을 만들어요. 포인트로 산 물건은 소지품에 남고 다음 턴 본편에 넘어가요. 아래 값은 이 채팅에 저장돼요.', example: '' },
  phone: { desc: '괴담톡 연락처와 문자방의 답장·선톡·단톡방 초대를 보조 모델이 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '「스팡달: 부장님 지금 어디세요? 본부 4층 비었어요」 — 장면과 관련된 대화는 본편 요청에 참고로 붙어요.' },
  wiki: { desc: '위키 문서를 생성·갱신해요. 채팅에 나온 문서는 본편 요청에 참고로 붙일 수 있어요.', example: '「미술관」 문서: 소재 · 접근 · 규칙 · 목격 기록 — 분량·작성 모드대로 써요.' },
  people: { desc: '본편 응답이 끝날 때마다 보조 모델이 한 번 읽어 인물별 기록(기본정보·성격·현재 상태·인간관계·호감·호칭)을 쌓고, 다음 본편 요청이 그 기록을 읽어요.', example: '「쟈알디 · 호감 +8 → 신뢰 — 함께 임무를 치른 뒤」 — 기록이 이야기에 따라 바뀌어요.', off: '끄면 응답을 읽지 않고, 본편에도 기록을 넣지 않아요.' },
  // 기록(일지·보고서)은 모델을 부르지 않아 켬/끔 배지가 없다 (featureState 에 넣지 않음)
  journal: { desc: '사건이 끝날 때마다 일지 한 줄과 그때의 보고서를 상황판·인물·가계부 기록에서 만들어요(모델을 부르지 않아요). 채팅에 보고서 카드를 띄울지와 보관 상한을 여기서 정해요.', example: '「RPT-0510-03 · 거울 속 사람 · 내가 출동 · 1시간 24분」 — 왼쪽 메뉴 「기록 → 일지」에 쌓여요.' },
  // 2026-11-08 사용자: 안 읽히고, 요청 글 모양(내부 로직)을 예로 보일 까닭이 없다 → 짧게, 예 없음
  items: { desc: '가계부·소지품·상점을 여기서 정해요. 상점은 가계부와 소지품을 둘 다 켜야 쓸 수 있어요.', example: '' },
  factions: { desc: '세력(관리국·백일몽·협회…)이 주인공을 어떻게 보는지를 인물 기록 갱신기가 −100~100 값으로 매겨요. 켤지와 본편에 넣을지를 여기서 정해요.', example: '' },
  lore: { desc: '세력·괴이·파밍·요원·부록 로어북을 요청에 넣을지 누가 고를지 정해요. 점검 → 「다음 호출 로어북」에서 다음 요청에 어떤 로어북이 들어가는지 볼 수 있어요.', example: '' },
  adv: { desc: '괴담넷·괴담톡·위키 생성에 공통으로 쓰는 값이에요. 생성 언어, 형식이 틀렸을 때 다시 부르는 횟수, 요청 하나의 토큰 상한.', example: '' },
};

/** 설정 페이지: 패널 설정의 묶음을 그대로 (지침은 지침 탭) */
function settingsPage(ctx: ChatContext, page: SetPage): string {
  // 옛 자리(set:wallet · set:shop)는 합친 「소지품」 페이지로
  if (page === 'wallet' || page === 'shop') page = 'items';
  const canChat = host?.canChat?.() ?? true;
  // 범위 칩(이 채팅 / 새 채팅 기본값)은 없다 (2026-10-29 사용자 결정, v0.16.23 설계로 복귀): 값은 늘 이 채팅, 시작 전에는 새 채팅 기본값을 바로 고친다.
  // 머리의 「기본값으로 저장」「기본값 불러오기」가 설정 전부를 한 번에 옮긴다
  const scope: 'chat' | 'defaults' = canChat ? 'chat' : 'defaults';
  if (canChat) settingsUi.scope = 'chat';
  const title = SET_LABEL[page];
  const sec = (s: SettingsSection) => settingsSection(ctx, scope, canChat, s);
  let body = '';
  let act = '';
  const feat = (p: NonNullable<typeof settingsUi.page> & string) => {
    const r = featurePane(ctx, p, canChat);
    act = r.act;
    return r.body;
  };
  switch (page) {
    case 'screen': body = sec('screen'); break;
    case 'image': body = sec('image'); break; // 2026-11-05 사용자: 이미지 지침은 「지침 → 이미지」 한 곳에만 (여기 이중으로 띄우지 않는다)
    case 'board': body = sec('board'); break;
    case 'status': body = sec('status'); break;
    case 'gnet': case 'gal': case 'wpf': case 'sm': case 'cos': case 'bm': body = feat(page); break;
    case 'phone': body = feat('phone'); break;
    case 'wiki': body = feat('wiki'); break;
    case 'people': body = feat('people'); break;
    // 기록 하위 메뉴 넷 (2026-11-05 사용자): 일지 · 가계부 · 인물 · 세력
    case 'journal': body = feat('journal'); break;
    case 'items': body = sec('wallet') + sec('items') + sec('shop'); break;
    case 'factions': body = feat('factions'); break;
    case 'lore': body = sec('lore'); break;
    case 'adv': body = sec('adv'); break;
    case 'update': body = sec('update'); break;
    case 'versus': body = sec('versus'); break;
  }
  // 머리는 모든 페이지가 같다: 제목 왼쪽, 오른쪽에 범위(이 채팅/새 채팅 기본값) 또는 그 기능의 단추(덮어쓰기·불러오기). 시작 전이면 같은 글귀
  // 채팅 설정 페이지는 모두 같은 머리: 시작 뒤 「기본값으로 저장」「기본값 불러오기」(설정 전부 한 번에), 시작 전 「새 채팅 기본값 (시작 전)」.
  // 기능 페이지가 자기 머리에 두던 칸별 단추(ps-defaults)는 창 안에서는 빼고 그 밖의 단추만 남긴다
  // 「기본값으로 저장」「기본값 불러오기」는 설정 전부를 한 번에 다루므로 페이지마다 두지 않고 창 머리(render)에 한 번만 둔다 (2026-10-29 사용자). 확인 띠는 어느 페이지에서든 그 자리에
  const chatPage = page !== 'screen' && page !== 'update';
  act = act.replace(/<span class="ps-defaults">[\s\S]*?<\/span>/, '').trim();
  const right = chatPage && !canChat ? `<span class="gw-tokens">새 채팅 기본값 (시작 전)</span>${act}` : act;
  const info = FEATURE_INFO[page];
  const on = featureState(ctx)[`set:${page}`];
  const badge = on === undefined ? '' : `<span class="gw-state${on ? '' : ' off'}">${on ? '켬' : '끔'}</span>`;
  // 기능 판 안의 머리 설명은 여기 설명과 겹치니 뺀다 (인물 기록 소개, 필드 안내)
  if (info) body = body.replace(/<p class="ps-note">본편 응답이 끝날 때마다[\s\S]*?<\/p>/, '').replace(/<section class="ps-group"><p class="ps-note">필드에서 만난 사람과[\s\S]*?<\/section>/, '');
  // 인물 페이지는 맨 위에 자기 도식이 있으니 「호출 흐름 →」 단추만 (callSummary 안에서)
  const calls = callSummary(ctx, page);
  const lead = info
    ? `<p class="gx-muted">${esc(info.desc)}${info.example ? ` <span class="gw-eg">예) ${esc(info.example)}</span>` : ''}${on === false && info.off ? ` <span class="gw-off-note">${esc(info.off)}</span>` : ''}</p>${calls}</header>`
    : `${calls}</header>`;
  return `<div class="gw-page gw-set"><header class="gw-head"><h2>${esc(title)}${badge}</h2>${right ? `<div class="gw-head-act">${right}</div>` : ''}${lead}
    ${settingsNotices()}
    <div class="gx-settings gw-setbody">${body}</div></div>`;
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

/* 설정 찾기 (2026-11-06 사용자 승인, 전수점검 8-10·9-3): 기능 탭 왼쪽 목록 위의 칸 하나.
   각 설정 페이지를 그린 HTML에서 줄 이름·설명·묶음 제목을 모아 두고, 적은 말이 들어간 줄을 목록 자리에 보여 준다. 누르면 그 페이지로 가서 그 줄을 비춘다 */
type FindHit = { page: SetPage; label: string; group: string; help: string };
let findIndex: FindHit[] | null = null;
const FIND_PAGES: SetPage[] = ['screen', 'image', 'board', 'status', 'gnet', 'gal', 'wpf', 'sm', 'cos', 'bm', 'phone', 'wiki', 'journal', 'items', 'people', 'factions', 'lore', 'adv'];
const findNorm = (s: string) => s.toLowerCase().replace(/\s+/g, '');
function buildFindIndex(ctx: ChatContext): FindHit[] {
  const out: FindHit[] = [];
  const keepPage = settingsUi.page;
  for (const page of FIND_PAGES) {
    let html = '';
    try {
      settingsUi.page = isFeatPage(page) ? page : '';
      html = settingsPage(ctx, page);
    } catch {
      continue;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll<HTMLElement>('.ps-row').forEach((row) => {
      const b = row.querySelector<HTMLElement>('.ps-label > b');
      if (!b) return;
      const label = [...b.childNodes].filter((n) => !(n instanceof HTMLElement && n.tagName === 'I')).map((n) => n.textContent ?? '').join('').trim();
      if (!label) return;
      const group = row.closest('.ps-group, .ps-card, details')?.querySelector('h3, h4, summary')?.textContent?.trim() ?? '';
      const help = row.querySelector('.ps-label > small')?.textContent?.trim() ?? '';
      out.push({ page, label, group, help });
    });
  }
  settingsUi.page = keepPage;
  return out;
}
function findResults(ctx: ChatContext | null): string {
  const q = findNorm(edUi.sq);
  if (!ctx) return '<p class="gw-find-none">채팅 정보를 읽지 못했어요.</p>';
  findIndex ??= buildFindIndex(ctx);
  const score = (h: FindHit) => (findNorm(h.label).includes(q) ? 0 : findNorm(SET_LABEL[h.page] + h.group).includes(q) ? 1 : findNorm(h.help).includes(q) ? 2 : -1);
  const hits = findIndex.map((h, i) => ({ h, i, s: score(h) })).filter((x) => x.s >= 0).sort((a, b) => a.s - b.s || a.i - b.i).slice(0, 40);
  if (!hits.length) return '<p class="gw-find-none">찾는 설정이 없어요.</p>';
  return `<div class="gw-tree-group gw-find-res"><h4>찾은 설정 ${hits.length}개</h4>${hits
    .map(({ h, i }) => `<button class="gw-tree-item gw-find-hit" data-action="ed-find-go" data-value="${i}">${SET_ICON[h.page]}<span><b>${esc(h.label)}</b><small>${esc(SET_LABEL[h.page])}${h.group && h.group !== h.label && h.group !== SET_LABEL[h.page] ? ` · ${esc(h.group)}` : ''}</small></span></button>`)
    .join('')}</div>`;
}
/** 찾은 줄로 간 뒤: 그 줄을 화면 가운데로 옮기고 잠깐 비춘다 */
/** 찾은 자리로 가서 잠깐 밝힌다 (통합 검색과 같은 효과). 줄이면 그 줄, 블록이면 그 블록 상자 */
function flashEl(el: HTMLElement, block: ScrollLogicalPosition): void {
  const box = el.closest('details');
  if (box && !box.open) box.open = true;
  el.scrollIntoView({ block });
  el.classList.remove('gw-find-flash');
  void el.offsetWidth; // 같은 자리를 다시 눌러도 효과가 처음부터
  el.classList.add('gw-find-flash');
  setTimeout(() => el.classList.remove('gw-find-flash'), 2200);
}

/** 호출 흐름 「설정 →」의 갈 줄 (flow.ts Node.to): 'r:줄 이름'. 블록 전체가 아니라 그 줄에만 강조 (2026-11-08 사용자) */
export function flashSpot(to: string): void {
  const body = root?.querySelector<HTMLElement>('.gw-body');
  if (!body || !to.startsWith('r:')) return;
  // 'r:줄 이름@묶음 제목': 같은 이름의 줄이 여럿이면 그 묶음 안의 줄 (괴담톡 「자동 호출」·보기 전용 방 「자동 호출」)
  const [label, grp] = to.slice(2).split('@');
  const head = (h: Element | null) => (h ? [...h.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent ?? '').join('').trim() : '');
  const row = [...body.querySelectorAll<HTMLElement>('.ps-row')].find((r) => head(r.querySelector('.ps-label > b')) === label && (!grp || r.closest('.ps-group')?.querySelector('h3')?.textContent?.trim() === grp));
  if (row) flashEl(row, 'center');
}

function flashFound(hit: FindHit): void {
  const rows = [...(root?.querySelectorAll<HTMLElement>('.gw-body .ps-row') ?? [])];
  const row = rows.find((r) => {
    const b = r.querySelector<HTMLElement>('.ps-label > b');
    return b && [...b.childNodes].filter((n) => !(n instanceof HTMLElement && n.tagName === 'I')).map((n) => n.textContent ?? '').join('').trim() === hit.label;
  });
  if (row) flashEl(row, 'center');
}

/* 세계 통합 검색 (2026-11-07 사용자): 세계 탭 왼쪽 목록 위 칸 하나. 요원·조직·괴이·파밍·부록 이름·부제를 한꺼번에 찾고, 누르면 그 종류 화면에서 그 기록을 연다 */
const WORLD_FIND_KINDS: WorldKind[] = ['agent', 'org', 'anomaly', 'site', 'appendix'];
const WORLD_FIND_ICON: Record<WorldKind, string> = { agent: ICONS.person, org: ICONS.org, anomaly: ICONS.spook, site: ICONS.star, appendix: ICONS.book };
function worldFindResults(ctx: ChatContext | null): string {
  const q = findNorm(edUi.wq);
  if (!ctx) return '<p class="gw-find-none">채팅 정보를 읽지 못했어요.</p>';
  const over = overridesOf(ctx);
  const d = directoryDraft(ctx);
  // 요원은 소속·부서·직급으로도 찾는다 (「협회」로 그 소속 요원까지)
  const more = (kind: WorldKind, name: string) => {
    if (kind !== 'agent') return '';
    const a = d.agents.find((x) => x.lore === name);
    return a ? [a.affiliation, a.department, a.rank].filter(Boolean).join(' · ') : '';
  };
  const hits: { kind: WorldKind; name: string; sub: string; state: string; s: number }[] = [];
  for (const kind of WORLD_FIND_KINDS) {
    for (const r of rowsOf(ctx, kind, over)) {
      const extra = more(kind, r.name);
      const s = findNorm(r.name).includes(q) ? 0 : findNorm(r.sub).includes(q) ? 1 : extra && findNorm(extra).includes(q) ? 2 : -1;
      if (s === 2) { hits.push({ kind, name: r.name, sub: extra, state: r.state, s }); continue; }
      if (s >= 0) hits.push({ kind, name: r.name, sub: r.sub, state: r.state, s });
    }
  }
  hits.sort((a, b) => a.s - b.s);
  const top = hits.slice(0, 60);
  if (!top.length) return '<p class="gw-find-none">맞는 기록이 없어요.</p>';
  const st = (x: string) => (x === 'deleted' ? ' (지움)' : x === 'new' ? ' (추가)' : x === 'edited' ? ' (고침)' : '');
  return `<div class="gw-tree-group gw-find-res"><h4>찾은 기록 ${hits.length}개${hits.length > top.length ? ` (앞 ${top.length}개)` : ''}</h4>${top
    .map((h) => `<button class="gw-tree-item gw-find-hit" data-action="ed-goto" data-value="${esc(`${h.kind}|${h.name}`)}">${WORLD_FIND_ICON[h.kind]}<span><b>${esc(h.name)}</b><small>${esc(WORLD_KIND_LABEL[h.kind])}${h.sub ? ` · ${esc(h.sub)}` : ''}${st(h.state)}</small></span></button>`)
    .join('')}</div>`;
}

function tree(ctx: ChatContext | null): string {
  const counts = treeCounts(ctx);
  const on = featureState(ctx);
  const tab = tabOf(edUi.node);
  const find = tab === 'set'
    ? `<input class="gw-find" type="search" data-input="ed-sq" value="${esc(edUi.sq)}" placeholder="설정 찾기 (예: 테마, 새로고침)" aria-label="설정 찾기" autocomplete="off">`
    : tab === 'world'
      ? `<input class="gw-find" type="search" data-input="ed-wq" value="${esc(edUi.wq)}" placeholder="세계 검색 (요원·조직·괴이·파밍·부록)" aria-label="세계 검색" autocomplete="off">`
      : '';
  if (tab === 'set' && edUi.sq.trim()) return `${find}<div class="gw-find-out">${findResults(ctx)}</div>`;
  if (tab === 'world' && edUi.wq.trim()) return `${find}<div class="gw-find-out">${worldFindResults(ctx)}</div>`;
  const wrap = tab === 'set' || tab === 'world';
  return find + (wrap ? '<div class="gw-find-out">' : '') + treeGroups(counts, on) + (wrap ? '</div>' : '');
}

function treeGroups(counts: Partial<Record<EditorNode, number>>, on: Partial<Record<EditorNode, boolean>>): string {
  return treeOf(tabOf(edUi.node)).map(
    (g) => `<div class="gw-tree-group"><h4>${g.title}</h4>${g.items
      .map(([id, label, icon, badge, sub]) => id.startsWith('label:')
        ? `<div class="gw-tree-label">${icon}<span>${esc(label)}</span></div>`
        : `<button class="gw-tree-item${sub ? ' sub' : ''}${edUi.node === id ? ' on' : ''}" data-action="ed-node" data-value="${id}">${icon}<span>${esc(label)}</span>${badge ?? (counts[id as EditorNode] !== undefined ? `<em>${counts[id as EditorNode]}</em>` : on[id as EditorNode] !== undefined ? `<i class="gw-tree-badge${on[id as EditorNode] ? '' : ' off'}">${on[id as EditorNode] ? '켬' : '끔'}</i>` : '')}</button>`)
      .join('')}</div>`,
  ).join('');
}

/** 지침 탭의 페이지: 절 단위 글칸 (guides.ts) 또는 이미지 지침 설정 */
function guideNodePage(ctx: ChatContext, n: GuideNode): string {
  const g = n.slice(6) as GuideName | 'Image';
  const crumb = `지침 / ${g === 'RP' || g === 'Directive' || g === 'Tag' ? '기본 지침' : '기능별 지침'}`;
  if (g === 'Image') return `<div class="gw-page gw-set"><header class="gw-head"><h2>이미지 지침</h2><p class="gx-muted">카드 로어북 대신 플러그인이 만드는 이미지 태그 지침이에요. 지침 틀, 출력 대상 캐릭터(명부에서 자동), 표정 세트를 여기서 관리해요.</p></header><div class="gx-settings gw-setbody gw-imgp">${imgPromptPane(ctx)}</div></div>`;
  return guidePage(g, crumb);
}

function body(ctx: ChatContext): string {
  const n = edUi.node;
  if (isKind(n)) {
    // 기본 정보 칸은 명부 판(directory.ts)의 dir-* 동작을 쓰고, 그 처리기는 dirUi.kind 로 줄을 찾는다.
    // 거점 페이지를 다녀오면 kind 가 'base' 로 남아 괴이 「발생 ON/OFF」 등이 요원 줄에서 찾다 아무 일도 안 했다 (2026-10-28 QC)
    dirUi.kind = n;
    return recordPage(ctx, n, overridesOf(ctx), edUi.q, edUi.sel[n] ?? '');
  }
  if (n === 'base') {
    // 거점: 지도에 찍히는 장소. 명부 패널의 거점 탭을 그대로 (종류 탭·사용법은 CSS 로 숨김). 호칭·괴담톡 탭은 조직 기록의 기본 정보에
    dirUi.kind = 'base';
    return `<div class="gw-page gw-basepage"><header class="gw-head"><h2>거점</h2><p class="gx-muted">지도에 찍히는 장소예요. 조직마다 거점을 두고 지도를 눌러 위치를 정해요. 조직의 호칭·괴담톡 탭은 조직 기록의 「기본 정보」에서 고쳐요.</p></header>${directoryView(ctx)}</div>`;
  }
  if (n === 'start') {
    // 시작 화면: 명부 초안의 조직·묶음·첫 장면을 고친다. 사진 고르기(dir-photo-*)는 조직 줄 기준이라 kind 를 조직으로
    dirUi.kind = 'org';
    return startPage(ctx);
  }
  if (n === 'relations') return relationsPage(ctx, overridesOf(ctx), false);
  if (isGuideNode(n)) return guideNodePage(ctx, n);
  if (isRuleNode(n)) return rulePage(n);
  if (isManageNode(n)) {
    ensureManage(render);
    return managePage(ctx, n, host?.canChat?.() ?? true);
  }
  if (isSetNode(n)) return settingsPage(ctx, n.slice(4) as SetPage);
  // 설치 · 점검: 이 캐릭터를 아직 점검하지 않았으면 점검하고 다시 그린다 (어느 길로 열어도)
  if (instUi.forChar !== ctx.charIndex && !instUi.pending) {
    instUi.pending = true;
    void refreshInstall(ctx, render).finally(() => {
      instUi.pending = false;
      render();
    });
  }
  return installPage(ctx);
}

let lastDrawn = '';

export function render(): void {
  if (!root || !edUi.open || !host) return;
  const ctx = host.ctx();
  if (ctx) overridesOf(ctx); // 저장·새로 읽기 뒤 덧쓰기 초안을 카드 값으로 맞춘다 (지침 화면처럼 초안을 안 쓰는 화면에서도)
  root.hidden = false;
  root.dataset.theme = host.theme();
  root.toggleAttribute('data-dirty', anyDirty());
  const width = getPrefs().editorWidth ?? 90;
  root.style.setProperty('--gw-width', `${width}%`);
  const confirm = edUi.confirm
    ? `<div class="gw-confirm"><div class="gw-confirm-box"><p>고친 것을 카드에 저장하지 못했어요${edUi.notice ? ` (${esc(edUi.notice)})` : ''}. 저장하지 않고 닫을까요?</p>
        <div class="gx-row-btns"><button class="gx-mini danger" data-action="ed-close-force">저장 안 하고 닫기</button><button class="gx-mini" data-action="ed-confirm-no">취소</button></div></div></div>`
    : tabOf(edUi.node) === 'set' || tabOf(edUi.node) === 'manage' ? mainDefaultsPopup() || manageConfirmPopup() : '';
  const tab = tabOf(edUi.node);
  edUi.last[tab] = edUi.node;
  const tabs = TABS.map(([id, label, icon]) => `<button class="gw-tab${tab === id ? ' on' : ''}" role="tab" aria-selected="${tab === id}" data-action="ed-tab" data-value="${id}">${icon}<span>${label}</span></button>`).join('');
  autoSaveWorld();
  // 머리는 유령 아이콘 + 「설정」만 (2026-10-29 사용자: 봇 이름·현재 채팅·「바꾸면 바로 저장」 글귀는 지저분함)
  // 다시 그려도 보던 자리를 지킨다 (2026-10-29 사용자: 값 하나 바꿀 때마다 맨 위로 튕겼다). 같은 화면(노드)일 때만 — 다른 화면으로 가면 맨 위부터
  const KEEP = ['.gw-body', '.gw-tree', '.gw-list', '.nw-groups'];
  const sameNode = lastDrawn === edUi.node;
  const keep = sameNode ? KEEP.map((q) => root!.querySelector<HTMLElement>(q)?.scrollTop ?? 0) : [];
  const act = document.activeElement as HTMLInputElement | null;
  const focusSel = sameNode && act && root.contains(act) && (act.dataset?.input || act.dataset?.change || act.getAttribute('name'))
    ? `${act.tagName.toLowerCase()}${act.dataset?.input ? `[data-input="${CSS.escape(act.dataset.input)}"]` : act.dataset?.change ? `[data-change="${CSS.escape(act.dataset.change)}"]` : `[name="${CSS.escape(act.getAttribute('name')!)}"]`}${act.dataset?.key ? `[data-key="${CSS.escape(act.dataset.key)}"]` : ''}`
    : '';
  const caret = focusSel && typeof act!.selectionStart === 'number' ? [act!.selectionStart, act!.selectionEnd ?? act!.selectionStart] : null;
  lastDrawn = edUi.node;
  // 폰(2026-10-29 사용자): 설정도 본 창의 한 화면처럼 — 머리는 본 창과 같은 모양(제목 「설정」만), 아래에 숨은 서랍(기능·세계·지침·점검)과 본 창의 하단 바
  const phone = isPhone();
  const noticeHtml = edUi.notice ? `<span class="gw-notice err">${esc(edUi.notice)}</span>` : edUi.info ? `<span class="gw-notice">${esc(edUi.info)}</span>` : '';
  // 상단바에는 저장 단추를 두지 않는다 (2026-11-08 사용자: 모든 메뉴·항목은 바로 저장. 기본값 저장·불러오기·초기화·내보내기는 점검 → 저장·불러오기 한 곳)
  const right = `${edUi.busy ? '<span class="gw-save-state">저장하는 중…</span>' : ''}<button class="gx-x" data-action="ed-close" aria-label="닫기">${ICONS.close}</button>`;
  const top = phone
    ? `<header class="gw-top gx-head gw-phead">
      <button class="gx-x gw-menu" data-action="ed-drawer" aria-label="메뉴">${ICONS.list}</button>
      <div class="gx-brand gx-tabhead"><div><b>설정</b></div></div>${noticeHtml}
      <div class="gx-head-act gw-top-right">${right}</div>
    </header>`
    : `<header class="gw-top">
      <button class="gx-x gw-menu" data-action="ed-drawer" aria-label="메뉴">${ICONS.list}</button>
      <span class="gw-brand">${GHOST_ICON}</span><b>설정</b>
      ${noticeHtml}
      <div class="gw-top-right">${right}</div>
    </header>`;
  const tabTools = TABS.map(([id, label, icon]) => `<button class="ph-tool" data-action="ed-tab" data-value="${id}" aria-pressed="${tab === id}" aria-label="${label}" title="${label}">${icon}<span class="ph-tool-l">${label}</span></button>`).join('');
  const foot = phone ? `${drawerHtml(tabTools, '', 'gw-tabdrawer')}${host.mobileNav?.() ?? ''}` : '';
  const html = `<div class="gw-win${edUi.drawer ? ' drawer' : ''}${phone ? ' phone' : ''}">
    ${top}
    <nav class="gw-tree"><div class="gw-tabs" role="tablist">${tabs}</div>${tree(ctx)}</nav>
    <main class="gw-body">${ctx ? body(ctx) : '<p class="gx-err">채팅 정보를 읽지 못했어요. 창을 닫고 다시 열어 주세요.</p>'}</main>
    ${tab === 'set' ? `<button class="gw-totop" data-action="ed-top" aria-label="맨 위로" title="맨 위로">${ICONS.up}</button>` : ''}
    ${foot}
    ${confirm}
  </div>`;
  // 같은 화면을 다시 그릴 때는 바뀐 곳만 (2026-11-06 사용자, 전수점검 남은 것 6). 다른 화면으로 갈 때·처음 열 때는 통째로
  if (sameNode && root.querySelector('.gw-win')) morph(root, html);
  else root.innerHTML = html;
  labelSwitches(root);
  if (phone) {
    // 바뀐 곳만 그리면 서랍·하단 바 요소가 그대로 남으니 한 번만 묶는다
    const box = root.querySelector<HTMLElement>('.ph-drawer');
    const bar = root.querySelector<HTMLElement>('.gx-mbar');
    if (box && !boundOnce.has(box)) { boundOnce.add(box); bindDrawer(root); }
    if (bar && !boundOnce.has(bar)) { boundOnce.add(bar); bindMbar(root, () => void run('ed-close')); }
  }
  if (keep.length) KEEP.forEach((q, i) => { const el = root!.querySelector<HTMLElement>(q); if (el && keep[i]) el.scrollTop = keep[i]; });
  syncTop();
  if (focusSel) {
    const el = [...root.querySelectorAll<HTMLInputElement>(focusSel)].find((x) => x.offsetParent);
    if (el) {
      el.focus({ preventScroll: true });
      if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch { /* 커서를 못 두는 칸 */ }
    }
  }
}

/** 기능 설정 우하단 「맨 위로」 (2026-11-08 사용자): 조금 내려갔을 때만 보인다 */
function syncTop(): void {
  const b = root?.querySelector<HTMLElement>('.gw-totop');
  if (b) b.classList.toggle('show', (root?.querySelector<HTMLElement>('.gw-body')?.scrollTop ?? 0) > 240);
}

const boundOnce = new WeakSet<HTMLElement>();

const env = { render: () => render(), refresh: async () => { await host?.refresh(); render(); } };

/** 바로 저장 (2026-11-08 사용자: 모든 메뉴·항목의 기본은 바로 저장, 지침이든 뭐든). 글을 치는 동안은 손을 뗀 뒤 한 번만 적는다 */
const AUTO_MS = 700;
const laters = new Map<string, { t: ReturnType<typeof setTimeout>; fn: () => unknown }>();
function later(key: string, fn: () => unknown, ms = AUTO_MS): void {
  const old = laters.get(key);
  if (old) clearTimeout(old.t);
  const t = setTimeout(() => {
    laters.delete(key);
    fn();
  }, ms);
  laters.set(key, { t, fn });
}
/** 기다리던 저장을 지금 바로 (창을 닫을 때) */
async function flushLater(): Promise<void> {
  const all = [...laters.values()];
  laters.clear();
  for (const l of all) clearTimeout(l.t);
  await Promise.all(all.map((l) => Promise.resolve(l.fn()).catch(() => undefined)));
}
// 점검 「초기화」: 고친 세계도 버리고 플러그인 원래 값으로 (2026-11-08 사용자: 초기화는 전체 초기화)
resetHooks.push(() => {
  const ctx = host?.ctx();
  if (ctx) overridesOf(ctx);
  setOverrides({});
  autoSaveWorld();
});

/** 세계(카드 명부) 고친 것을 카드에 바로 적는다 */
function autoSaveWorld(): void {
  // 저장이 실패해 알림이 떠 있으면 되풀이하지 않는다 (다음 입력 때 다시)
  if (!anyDirty() || (edUi.notice && edUi.notice.startsWith('저장하지 못했어요'))) return;
  later('world', () => {
    const ctx = host?.ctx();
    return ctx && anyDirty() ? save(ctx) : undefined;
  });
}

async function save(ctx: ChatContext): Promise<void> {
  if (edUi.busy) return;
  edUi.busy = true;
  edUi.notice = '';
  try {
    const d: Directory = directoryDraft(ctx);
    const over = overridesOf(ctx);
    const data = { ...directoryData(d), 세계: over as unknown as Record<string, unknown> };
    await updateCharacterLore(ctx.charIndex, (lore) => withDirectory(lore, data).filter((e) => !d.folders || !LEGACY_DATA.includes(String(e.comment ?? ''))));
    dirUi.draft = null;
    edUi.from = null;
    await host?.refresh();
  } catch (error) {
    edUi.notice = `저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
  }
  edUi.busy = false;
  render();
}

/** 리스너(클릭·Enter·Esc)에서 부를 때: 버린 Promise 의 실패를 기록한다 (QC 2026-10-28) */
/** 물음표 설명 풍선: 마우스를 올리거나(폰은 누르면) 단추 아래에 띄운다. 브라우저 기본 title 은 Risu 창에서 안 떠서(2026-11-05 사용자) 직접 그린다.
 *  카드(overflow hidden) 안에서 잘리지 않게 화면 기준(fixed)으로 설정 창 뿌리에 붙인다 */
let hintEl: HTMLElement | null = null;
let hintFor: HTMLElement | null = null;
let hintAt = 0;
function hideHint(): void {
  hintEl?.remove();
  hintEl = null;
  hintFor = null;
}
function showHint(btn: HTMLElement): void {
  if (hintFor === btn) return;
  hideHint();
  const text = btn.dataset.hint ?? '';
  if (!text || !root) return;
  const p = document.createElement('div');
  p.className = 'gw-tip';
  p.setAttribute('role', 'tooltip');
  p.textContent = text;
  root.appendChild(p);
  const r = btn.getBoundingClientRect();
  const w = Math.min(320, window.innerWidth - 24);
  p.style.width = `${w}px`;
  p.style.left = `${Math.max(12, Math.min(r.left, window.innerWidth - w - 12))}px`;
  p.style.top = `${r.bottom + 6}px`;
  // 아래가 모자라면 위로
  const h = p.getBoundingClientRect().height;
  if (r.bottom + 6 + h > window.innerHeight - 8) p.style.top = `${Math.max(8, r.top - 6 - h)}px`;
  hintEl = p;
  hintFor = btn;
  hintAt = Date.now();
}

const run = (action: string, value?: string): Promise<void> =>
  handle(action, value).catch((error: unknown) => console.log(`[goei] 편집 창 조작 실패(${action}): ${error instanceof Error ? error.message : String(error)}`));

export async function handle(action: string, value?: string): Promise<void> {
  const ctx = host?.ctx() ?? null;
  switch (action) {
    case 'ed-close':
      // 바로 저장 (2026-11-08 사용자): 아직 안 적힌 것이 있으면 적고 닫는다
      await flushLater();
      if (anyDirty() && ctx) await save(ctx);
      // 저장이 실패했을 때만 묻는다
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
    case 'ed-drawer':
      edUi.drawer = !edUi.drawer;
      return render();
    case 'ed-tab': {
      const t = (value ?? 'set') as Tab;
      return handle('ed-node', edUi.last[t] ?? firstOf(t));
    }
    case 'ed-goto': {
      // 다른 종류의 기록으로 바로 가기 (조직 → 소속 요원). 값 「종류|이름」
      const [k, ...rest] = (value ?? '').split('|');
      const name = rest.join('|');
      if (!k || !name) return;
      edUi.sel[k as WorldKind] = name;
      return handle('ed-node', k);
    }
    case 'ed-node':
      edUi.node = legacyNode(value ?? 'agent');
      if (edUi.node === 'manage:backup') manUi.sizes = null;
      edUi.q = '';
      edUi.drawer = false;
      edUi.notice = '';
      guideUi.info = ''; // 다른 지침으로 옮기면 앞 지침의 「저장했어요」 알림은 지운다 (2026-11-05 QC: 지시문 페이지에 RP 저장 알림이 남아 있었다)
      dirUi.adding = false;
      if (edUi.node === 'base') resetDirectory();
      syncSettingsPage();
      if (edUi.node === 'install') {
        instUi.notice = '';
        instUi.info = '';
        instUi.forChar = -1; // 열 때마다 다시 점검
      }
      return render();
    case 'ed-flow-go': {
      // 호출 흐름 「설정 →」: 그 페이지의 그 블록으로 가서 밝힌다 (2026-11-08 사용자)
      const [pg, to = ''] = (value ?? '').split('|');
      if (!pg) return;
      await handle('ed-node', pg);
      flashSpot(to);
      return;
    }
    case 'ed-top':
      root?.querySelector('.gw-body')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    case 'ed-find-go': {
      const hit = findIndex?.[Number(value)];
      if (!hit) return;
      await handle('ed-node', `set:${hit.page}`);
      flashFound(hit);
      return;
    }
    case 'ed-width': {
      const w = Math.max(50, Math.min(100, Number(value) || 90));
      await savePrefs((p) => ({ ...p, editorWidth: w }));
      return render();
    }
  }
  if (!ctx) return;
  if (action.startsWith('dir-')) {
    await handleDirectory(action, value, ctx, env);
    // 다른 폴더에서 넣은 후보는 바로 골라 기본 정보(발생 후보·빼기)를 보여 준다
    if (action === 'dir-ext-add' && value && isKind(edUi.node) && directoryDraft(ctx)[edUi.node === 'site' ? 'sites' : 'anomalies'].some((p) => p.lore === value)) {
      edUi.sel[edUi.node] = value;
      render();
    }
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
  if (action.startsWith('man-')) {
    if (await manageAction(action, root, ctx, host?.canChat?.() ?? true, value)) render();
    return;
  }
  if (action.startsWith('ed-rule-')) {
    const r = await ruleAction(action, value);
    if (typeof r === 'string') edUi.node = r;
    if (r) render();
    return;
  }
  if (await installAction(action, ctx, env)) return;
  if (isKind(edUi.node) && (await recordAction(action, value, ctx, edUi.node))) render();
  // 그 밖의 동작(설정 단추·기능 설정)은 패널과 같은 처리기로. 패널이 다시 그려질 때 설정 페이지도 같이 그린다 (app.ts render)
  else if (host?.handle && !action.startsWith('ed-')) {
    // 폰 하단 바의 탭 단추: 설정을 닫고 본 창의 그 화면으로
    if ((action === 'tab' || action === 'nav-tab') && isPhone()) {
      closeEditor();
      await host.handle(action, value);
      return;
    }
    await host.handle(action, value);
    render();
  }
}

export { guideUi };
