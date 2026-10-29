// 세계 편집 창 (docs/설계안_세계편집.md 5장): 패널과 별도의 창. 왼쪽 트리 + 오른쪽 편집기.
// 저장은 전부 카드 명부(Directory)로: 명부 줄(기존 dirUi 초안)과 세계 덧쓰기(edUi.over)를 한 번에 쓴다.
import { directoryData, withDirectory, readDirectoryData, type Directory } from '../../core/world/directory';
import { overrideCount } from '../../core/world/draft';
import type { WorldOverrides } from '../../core/world/records';
import type { WorldKind } from '../../core/world/schema';
import { GUIDE_LABEL, type GuideName } from '../../core/guides';
import { LEGACY_DATA } from '../../core/lorebooks';
import { getPrefs } from '../../core/settings';
import { updateCharacterLore, type ChatContext } from '../../host/risu';
import { savePrefs } from '../../host/prefs';
import { cropValue, directoryDraft, directoryExtList, directoryInput, directoryPhotoList, directoryView, dirUi, dirty as dirDirty, handleDirectory, resetDirectory, setCrop } from '../directory';
import { handleImgPrompt, imgInput, imgPromptPane } from '../imgprompt';
import { GHOST_ICON, ICONS } from '../icons';
import { labelSwitches } from '../controls';
import { rememberPanel } from '../panels';
import editorCss from './style.css';
import { recordCount, recordList, recordPage, recordAction, recordInput, recUi } from './record';
import { relationsPage, relationsAction, relationsInput } from './relations';
import { guidePage, guideAction, guideBarSync, guideInput, guideUi } from './guides';
import { isRuleNode, ruleAction, ruleInput, rulePage, ruleTreeItems } from './rules';
import { ensureManage, isManageNode, manageAction, manageInput, managePage, manUi, type ManageNode } from './manage';
import { installAction, installPage, instUi, refreshInstall } from './install';
import { featurePane, mainDefaultsButtons, mainDefaultsConfirm, settingsNotices, settingsSection, settingsUi, type SettingsSection } from '../settings';
import { CFG, GN_DEFAULTS, gnetLabel } from '../../core/gnet';
import { basicSettings } from '../../core/settings';
import { worldOn } from '../../core/world';
import { ppValue } from '../../core/people/settings';

/** 설정 페이지 (2026-10-27: 모든 설정은 이 창 하나로. 지침은 그 기능 페이지 아래에) */
export type SetPage = 'screen' | 'image' | 'board' | 'status' | 'gnet' | 'phone' | 'wiki' | 'visit' | 'people' | 'journal' | 'adv' | 'update';
export type GuideNode = `guide:${GuideName | 'Image'}`;
export type EditorNode = WorldKind | 'base' | 'relations' | `set:${SetPage}` | 'install' | GuideNode | ManageNode | `rule:${string}`;
const SET_PAGES: SetPage[] = ['screen', 'image', 'board', 'status', 'gnet', 'phone', 'wiki', 'visit', 'people', 'journal', 'adv', 'update'];
export const isSetNode = (n: string): n is `set:${SetPage}` => n.startsWith('set:') && SET_PAGES.includes(n.slice(4) as SetPage);
export const isGuideNode = (n: string): n is GuideNode => n.startsWith('guide:');
/* 상단 탭 (2026-10-27 리수폿식): 설정(기능) · 세계 · 지침 · 관리. 왼쪽 목록은 탭마다 다르다 */
export type Tab = 'set' | 'world' | 'guide' | 'manage';
const TABS: [Tab, string, string][] = [['set', '기능', ICONS.settings], ['world', '세계', ICONS.map], ['guide', '지침', ICONS.book], ['manage', '점검', ICONS.refresh]];
export const tabOf = (n: EditorNode): Tab => (isKind(n) || n === 'base' || n === 'relations' ? 'world' : isGuideNode(n) || isRuleNode(n) ? 'guide' : n === 'install' || n === 'set:update' || n.startsWith('manage:') ? 'manage' : 'set');
/** 옛 노드 이름 → 지금 (설정 페이지 아래 있던 지침은 지침 탭으로) */
const legacyNode = (n: string): EditorNode => (n === 'set:guides' ? 'guide:RP' : (n as EditorNode));

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
  /** 탭마다 마지막으로 보던 페이지 */
  last: {} as Partial<Record<Tab, EditorNode>>,
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
  syncSettingsPage();
  ensureRoot();
  render();
}

/** 설정 페이지에 맞춰 패널의 기능 설정 상태를 맞춘다 (괴담넷·괴담톡·위키·필드·인물 기록 단추가 그 기능 처리기로 가게) */
function syncSettingsPage(): void {
  const n = edUi.node;
  const page = isSetNode(n) ? n.slice(4) : '';
  settingsUi.page = page === 'gnet' || page === 'phone' || page === 'wiki' || page === 'visit' || page === 'people' || page === 'journal' ? page : '';
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
  // 접는 칸(details data-keep)의 펼침을 기억한다: 조작 뒤 창을 다시 그려도 접히지 않게 (2026-10-28 QC: 패널만 기억하고 편집 창은 안 했다)
  root.addEventListener('toggle', (ev) => rememberPanel(ev.target as HTMLDetailsElement), true);
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
    const el = t.closest<HTMLElement>('[data-action]');
    if (!el || el.hasAttribute('disabled')) return;
    const take = el.dataset.take ? root?.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[name="${el.dataset.take}"]`)?.value : undefined;
    void run(el.dataset.action!, take ?? el.dataset.value);
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
    if (guideInput(name, el.dataset.key ?? '', el.value)) {
      touched();
      // 지침 페이지의 「지침 저장」·「기본으로」는 그릴 때 disabled 가 정해져서, 글칸에 적어도 다시 그리기 전엔 눌리지 않았다 (QC 2026-10-28: 키보드로 고친 지침을 저장할 길이 없었다)
      const key = el.dataset.key ?? '';
      const g = key.includes('|') ? key.slice(0, key.lastIndexOf('|')) : key;
      root?.querySelectorAll<HTMLButtonElement>(`[data-action="ed-guide-save"][data-value="${g}"], [data-action="ed-guide-reset"][data-value="${g}"]`).forEach((b) => (b.disabled = false));
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
    if (el?.dataset?.input === 'dir-crop-size') return render();
    if (el?.dataset?.change?.startsWith('ed-')) return void run(el.dataset.change, el.value);
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
  root.addEventListener('dragend', () => root?.querySelectorAll('.drop-before, .dragging').forEach((x) => x.classList.remove('drop-before', 'dragging')));
  return root;
}

/** 입력이 있었다: 저장 상태 줄만 다시 그린다 (글칸을 다시 그리면 커서가 날아간다) */
function touched(): void {
  const bar = root?.querySelector('.gw-save');
  if (bar) bar.outerHTML = saveBar();
  if (root && isGuideNode(edUi.node)) guideBarSync(root, edUi.node.slice(6));

  const tok = root?.querySelector('.gw-tokens');
  const ctx = host?.ctx();
  if (tok && ctx && isKind(edUi.node)) tok.outerHTML = recUi.tokensHtml(ctx, edUi.node, overridesOf(ctx));
}

export const isKind = (n: string): n is WorldKind => ['agent', 'org', 'anomaly', 'site', 'appendix'].includes(n);

const SET_LABEL: Record<SetPage, string> = { screen: '화면', image: '캐릭터 이미지', board: '상황판', status: '상태창', gnet: '괴담넷', phone: '괴담톡', wiki: '위키', visit: '필드', people: '인물 기록', journal: '기록', adv: '고급', update: '업데이트' };
const SET_ICON: Record<SetPage, string> = { screen: ICONS.settings, image: ICONS.cctv, board: ICONS.grid, status: ICONS.list, gnet: ICONS.gnet, phone: ICONS.phone, wiki: ICONS.wiki, visit: ICONS.game, people: ICONS.group, journal: ICONS.records, adv: ICONS.pen, update: ICONS.refresh };
type TreeItem = [EditorNode, string, string, string?];
const setItem = (p: SetPage): TreeItem => [`set:${p}`, SET_LABEL[p], SET_ICON[p]];
const guideItem = (g: GuideName | 'Image'): TreeItem => [`guide:${g}`, g === 'Image' ? '이미지' : GUIDE_LABEL[g], ICONS.book];
/** 탭마다 왼쪽 목록 (제목 + 항목). 설정 탭 항목에는 켬/끔 배지, 세계 탭에는 개수 */
function treeOf(tab: Tab): { title: string; items: TreeItem[] }[] {
  switch (tab) {
    case 'set': return [{ title: '기능', items: (['screen', 'image', 'board', 'status', 'gnet', 'phone', 'wiki', 'visit', 'people', 'journal', 'adv'] as SetPage[]).map(setItem) }];
    case 'world': return [{ title: '세계', items: [['agent', '요원', ICONS.person], ['org', '조직', ICONS.org], ['anomaly', '괴이', ICONS.spook], ['site', '파밍', ICONS.star], ['appendix', '부록', ICONS.book], ['base', '거점', ICONS.pin], ['relations', '세력 관계', ICONS.grid]] }];
    case 'guide': return [
      { title: '추가 규칙', items: ruleTreeItems().map(([id, label, badge]) => [id as EditorNode, label, id === 'rule:new' ? ICONS.plus : ICONS.pen, badge] as TreeItem) },
      { title: '기본 지침', items: (['RP', 'Directive', 'Tag'] as GuideName[]).map(guideItem) },
      { title: '기능별 지침', items: (['GNet', 'Phone', 'Wiki', 'Visit', 'Image'] as (GuideName | 'Image')[]).map(guideItem) },
    ];
    case 'manage': return [{ title: '점검', items: [['install', '설치', ICONS.refresh], setItem('update'), ['manage:diag', '상태 점검', ICONS.list], ['manage:log', '요청 기록', ICONS.mail], ['manage:backup', '설정 내보내기', ICONS.swap]] }];
  }
}
const firstOf = (tab: Tab): EditorNode => (tab === 'guide' ? 'guide:RP' : treeOf(tab)[0].items[0][0]);
/** 기능 켬/끔 배지 (설정 탭 목록) */
function featureState(ctx: ChatContext | null): Partial<Record<EditorNode, boolean>> {
  if (!ctx) return {};
  const ss = ctx.chat.scriptstate;
  const basic = basicSettings(ctx.char.globalLore, ss);
  return {
    'set:board': host?.canChat?.() ? worldOn(ctx.chat) : basic.anomalyOn,
    'set:image': basic.assetOn,
    'set:gnet': String(ss?.[CFG('power')] ?? GN_DEFAULTS.power) === '1',
    'set:people': ppValue(ss, 'on') === '1',
  };
}

/* 기능 페이지 머리 (2026-10-27 리수폿식): 설명 한 줄 · 켬/끔 배지 · 「기본」 예시 · 끄면 빠지는 것 */
const FEATURE_INFO: Partial<Record<SetPage, { desc: string; example: string; off?: string }>> = {
  // 2026-10-29 사용자: 응답 태그 형식 같은 안쪽 사정은 예시로 보이지 않는다 (상황판·이미지는 설명만)
  board: { desc: '응답마다 괴이·사건·특수 발생을 판정하고 상황판·지도·요원 상태를 갱신해요.', example: '', off: '끄면 괴이가 자동으로 생기지 않고 상황판이 비어요. 커스텀 임무는 계속 쓸 수 있어요.' },
  image: { desc: '본문에 등장한 캐릭터의 등록 이미지를 채팅 속에 띄워요. 이미지 목록은 봇 카드에 있어요.', example: '', off: '끄면 캐릭터 이미지를 띄우지 않고 이미지 지침도 요청에 넣지 않아요.' },
  gnet: { desc: '괴담넷 게시판 글·댓글·쪽지를 보조 모델이 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '「[목격담] 중림 지하상가 3번 출구에서 또 봤음 · 댓글 7」 — 게시판 글 한 줄. 장면과 관련된 글은 본편 요청에 참고로 붙어요.', off: '끄면 게시판 생성과 채팅 반영을 멈춰요. 저장된 글과 쪽지는 남아요.' },
  phone: { desc: '괴담톡 연락처와 문자방의 답장·선톡·단톡방 초대를 보조 모델이 만들어요. 아래 값은 이 채팅에 저장돼요.', example: '「스팡달: 부장님 지금 어디세요? 본부 4층 비었어요」 — 장면과 관련된 대화는 본편 요청에 참고로 붙어요.' },
  wiki: { desc: '위키 문서를 생성·갱신해요. 채팅에 나온 문서는 본편 요청에 참고로 붙일 수 있어요.', example: '「미술관」 문서: 소재 · 접근 · 규칙 · 목격 기록 — 분량·작성 모드대로 써요.' },
  visit: { desc: '본부 방문(필드)에서 만난 사람과 나눈 말이 다음 본편 요청에 막간으로 들어가요. 게임 화면·소리·조작도 여기서.', example: '「막간: 로비에서 큐라스와 — 어젯밤 순찰 얘기」 — 대화한 자리(마지막 답 바로 뒤)에 끼워져요.' },
  people: { desc: '본편 응답이 끝날 때마다 보조 모델이 한 번 읽어 인물별 기록(기본정보·성격·현재 상태·인간관계·호감·호칭)을 쌓고, 다음 본편 요청과 필드가 그 기록을 읽어요.', example: '「쟈알디 · 호감 +8 → 신뢰 — 함께 임무를 치른 뒤」 — 기록이 이야기에 따라 바뀌어요.', off: '끄면 응답을 읽지 않고, 본편에도 기록을 넣지 않아요.' },
  // 기록(일지·보고서)은 모델을 부르지 않아 켬/끔 배지가 없다 (featureState 에 넣지 않음)
  journal: { desc: '상황이 종료될 때마다 일지 한 줄과 그 순간의 보고서를 상황판·인물 기록·가계부에서 만들어요(모델 호출 없음). 채팅에 카드를 띄울지, 일지를 본편 요청에 넣을지, 소감 자동, 상한을 여기서.', example: '「RPT-0510-03 · 거울 속 사람 · 내가 출동 · 1시간 24분」 — 왼쪽 메뉴 「기록」에 쌓여요.' },
};

/** 설정 페이지: 패널 설정의 묶음을 그대로 (지침은 지침 탭) */
function settingsPage(ctx: ChatContext, page: SetPage): string {
  const canChat = host?.canChat?.() ?? true;
  // 범위 칩(이 채팅 / 새 채팅 기본값)은 없다 (2026-10-29 사용자 결정, v0.16.23 설계로 복귀): 값은 늘 이 채팅, 시작 전에는 새 채팅 기본값을 바로 고친다.
  // 머리의 「기본값으로 저장」「기본값 불러오기」가 설정 전부를 한 번에 옮긴다
  const scope: 'chat' | 'defaults' = canChat ? 'chat' : 'defaults';
  if (canChat) settingsUi.scope = 'chat';
  const title = page === 'gnet' ? gnetLabel(ctx.chat.scriptstate) : SET_LABEL[page];
  const sec = (s: SettingsSection) => settingsSection(ctx, scope, canChat, s);
  let body = '';
  let act = '';
  const feat = (p: 'gnet' | 'phone' | 'wiki' | 'visit' | 'people' | 'journal') => {
    const r = featurePane(ctx, p, canChat);
    act = r.act;
    return r.body;
  };
  switch (page) {
    case 'screen': body = sec('screen'); break;
    case 'image': body = sec('image') + `<section class="ps-group"><h3>이미지 지침</h3><div class="ps-rows">${imgPromptPane(ctx)}</div></section>`; break;
    case 'board': body = sec('board'); break;
    case 'status': body = sec('status'); break;
    case 'gnet': body = feat('gnet'); break;
    case 'phone': body = feat('phone'); break;
    case 'wiki': body = feat('wiki'); break;
    case 'visit': body = feat('visit'); break;
    case 'people': body = feat('people'); break;
    case 'journal': body = feat('journal'); break;
    case 'adv': body = sec('adv'); break;
    case 'update': body = sec('update'); break;
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
  const lead = info
    ? `<p class="gx-muted">${esc(info.desc)}${info.example ? ` <span class="gw-eg">예) ${esc(info.example)}</span>` : ''}${on === false && info.off ? ` <span class="gw-off-note">${esc(info.off)}</span>` : ''}</p></header>`
    : '</header>';
  return `<div class="gw-page gw-set"><header class="gw-head"><h2>${esc(title)}${badge}</h2>${right ? `<div class="gw-head-act">${right}</div>` : ''}${lead}
    ${canChat ? mainDefaultsConfirm() : ''}
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
  const on = featureState(ctx);
  return treeOf(tabOf(edUi.node)).map(
    (g) => `<div class="gw-tree-group"><h4>${g.title}</h4>${g.items
      .map(([id, label, icon, badge]) => `<button class="gw-tree-item${edUi.node === id ? ' on' : ''}" data-action="ed-node" data-value="${id}">${icon}<span>${esc(label)}</span>${badge ?? (counts[id] !== undefined ? `<em>${counts[id]}</em>` : on[id] !== undefined ? `<i class="gw-tree-badge${on[id] ? '' : ' off'}">${on[id] ? '켬' : '끔'}</i>` : '')}</button>`)
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
  const tab = tabOf(edUi.node);
  edUi.last[tab] = edUi.node;
  const tabs = TABS.map(([id, label, icon]) => `<button class="gw-tab${tab === id ? ' on' : ''}" role="tab" aria-selected="${tab === id}" data-action="ed-tab" data-value="${id}">${icon}<span>${label}</span></button>`).join('');
  const dirty = anyDirty();
  // 머리는 유령 아이콘 + 「설정」만 (2026-10-29 사용자: 봇 이름·현재 채팅·「바꾸면 바로 저장」 글귀는 지저분함)
  root.innerHTML = `<div class="gw-win${edUi.drawer ? ' drawer' : ''}">
    <header class="gw-top">
      <button class="gx-x gw-menu" data-action="ed-drawer" aria-label="메뉴">${ICONS.list}</button>
      <span class="gw-brand">${GHOST_ICON}</span><b>설정</b>
      ${edUi.notice ? `<span class="gw-notice err">${esc(edUi.notice)}</span>` : edUi.info ? `<span class="gw-notice">${esc(edUi.info)}</span>` : ''}
      <div class="gw-top-right">${tab === 'set' && (host?.canChat?.() ?? true) ? mainDefaultsButtons() : ''}${tab === 'world' || dirty ? saveBar() : ''}<button class="gx-x" data-action="ed-close" aria-label="닫기">${ICONS.close}</button></div>
    </header>
    <nav class="gw-tree"><div class="gw-tabs" role="tablist">${tabs}</div>${tree(ctx)}</nav>
    <main class="gw-body">${ctx ? body(ctx) : '<p class="gx-err">채팅 정보를 읽지 못했어요. 창을 닫고 다시 열어 주세요.</p>'}</main>
    ${confirm}
  </div>`;
  labelSwitches(root);
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

/** 리스너(클릭·Enter·Esc)에서 부를 때: 버린 Promise 의 실패를 기록한다 (QC 2026-10-28) */
const run = (action: string, value?: string): Promise<void> =>
  handle(action, value).catch((error: unknown) => console.log(`[goei] 편집 창 조작 실패(${action}): ${error instanceof Error ? error.message : String(error)}`));

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
    case 'ed-tab': {
      const t = (value ?? 'set') as Tab;
      return handle('ed-node', edUi.last[t] ?? firstOf(t));
    }
    case 'ed-node':
      edUi.node = legacyNode(value ?? 'agent');
      if (edUi.node === 'manage:backup') manUi.sizes = null;
      edUi.q = '';
      edUi.drawer = false;
      edUi.notice = '';
      dirUi.adding = false;
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
    if (await manageAction(action, root)) render();
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
    await host.handle(action, value);
    render();
  }
}

export { guideUi };
