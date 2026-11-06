// 점검 탭: 설정 내보내기(기기 설정 내보내기·가져오기, 저장소 사용량), 상태 점검, 요청 기록(최근 실패·인물 기록 갱신 기록).
// 설치·점검과 업데이트는 각각 install.ts / ui/update.ts.
import { getPrefs } from '../../core/settings';
import { savePrefs } from '../../host/prefs';
import { isGoeiLore } from '../../core/install';
import { cardVersion, compareVersions, PLUGIN_VERSION, UPDATE_BASE } from '../../core/update';
import { tokenizerName } from '../../core/tokenizer';
import { storedWikiPack } from '../../core/wiki';
import { advValue } from '../../core/advanced';
import { dropOldGame, dropTokenizer, dropWikiPack, installTokenizer, installWikiPack } from '../../host/install';
import { clearDiag, loadDiag, type DiagRun } from '../../host/people';
import { updateCharacterLore, type ChatContext } from '../../host/risu';
import { readDirectoryData, withDirectory, type DirectoryData } from '../../core/world/directory';
import { loreCheckBox } from '../lorecheck';
import { gnet } from '../gnet';
import { phone } from '../phone';
import { wiki } from '../wiki';
import { ICONS } from '../icons';

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const kb = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}MB` : n >= 1e3 ? `${Math.round(n / 1e3)}KB` : `${n}B`);

export type ManageNode = 'manage:backup' | 'manage:diag' | 'manage:log';
export const isManageNode = (n: string): n is ManageNode => n === 'manage:backup' || n === 'manage:diag' || n === 'manage:log';

/** 게임 자산 팩은 팩마다 키가 다르다 (goei:game:pack:<id>): 저장소 키 목록에서 모아 합산한다 */
const GAME_PACK_PREFIX = 'goei:game:pack:';
const GAME_PACKS = `${GAME_PACK_PREFIX}*`;

/** 저장소 항목: [키, 이름, 설명, 지우기 동작] */
const STORE: [string, string, string, string?][] = [
  ['goei:prefs', '기기 설정', '화면·이미지·지침 고친 글·추가 규칙·새 채팅 기본값'],
  ['goei:wikibase', '위키 기본 문서', '카드에서 뺀 기본 문서 묶음. 지우면 설치·점검에서 다시 받아요', 'man-drop-wiki'],
  ['goei:tok-o200k', '토크나이저', 'o200k_base 순위표. 지우면 토큰 수가 어림값이 돼요', 'man-drop-tok'],
  ['goei-people-diag', '인물 기록 실행 기록', '최근 갱신의 입력·출력 원문', 'man-drop-diag'],
  // 2026-10-28 QC: 옛 키(goei:game-pack:action-normal-v4)는 쓰는 곳이 없어 늘 「없음」이었다. 실제 키로 (src/main.ts·host/game/code.ts·host/game/packs.ts)
  ['goei:body', '플러그인 본체', '괴이 카드를 열 때 받아 둔 goei-body.js. 플러그인 판이 바뀌면 다시 받아요'],
  ['goei:data-world', '세계 자료', '요원·조직·괴이·파밍·부록 기본 기록과 세력 관계 기본값. 본체가 뜰 때 받아 두고, 플러그인 판이 바뀌면 다시 받아요'],
  ['goei:data-install', '설치 자료', '인사말·카드 사진 목록·기본 명부·아이콘 정보. 설치·점검을 처음 열 때 받아 두고, 플러그인 판이 바뀌면 다시 받아요'],
  // 필드(게임)는 2026-11-04 플러그인에서 뺐다. 예전에 받아 둔 것이 남아 있으면 크기만 보여 준다
  ['goei:game:code', '옛 게임 코드', '예전 필드 게임 코드. 지금 플러그인은 쓰지 않아요. 플러그인이 뜰 때 자동으로 지워요', 'man-drop-game'],
  [GAME_PACKS, '옛 게임 자산 팩', '예전 필드 게임 그림·소리 묶음. 지금 플러그인은 쓰지 않아요. 플러그인이 뜰 때 자동으로 지워요', 'man-drop-game'],
];

async function sizeOf(key: string): Promise<number> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(key);
    return typeof raw === 'string' ? raw.length : raw ? JSON.stringify(raw).length : 0;
  } catch {
    return 0;
  }
}

export const manUi = {
  sizes: null as Record<string, number> | null,
  /** 올린 파일 이름 (가져오기) */
  importName: '',
  pending: false,
  importText: '',
  confirm: '' as '' | 'import' | 'drop-wiki' | 'drop-tok' | 'drop-diag' | 'drop-game',
  info: '',
  notice: '',
  diag: null as DiagRun[] | null,
  /** 상태 점검의 「받기」 진행 중인 것과 진행 글 (2026-11-06 사용자 승인, 전수점검 9-9) */
  getting: '' as '' | 'tok' | 'wiki',
  progress: '',
};
/** 점검 페이지를 다시 그리는 손잡이 (받기 진행 글을 띄울 때) */
let rerender: (() => void) | null = null;

async function refresh(): Promise<void> {
  const sizes: Record<string, number> = {};
  for (const [key] of STORE) {
    if (key === GAME_PACKS) {
      let total = 0;
      try {
        const keys: unknown = await risuai.pluginStorage.keys();
        for (const k of Array.isArray(keys) ? keys : []) if (typeof k === 'string' && k.startsWith(GAME_PACK_PREFIX)) total += await sizeOf(k);
      } catch {
        // 키 목록을 못 읽는 판: 0
      }
      sizes[key] = total;
    } else sizes[key] = await sizeOf(key);
  }
  manUi.sizes = sizes;
  try {
    manUi.diag = await loadDiag();
  } catch {
    manUi.diag = [];
  }
}

/** 처음 열 때 저장소 크기·기록을 읽고 다시 그린다 */
export function ensureManage(render: () => void): void {
  rerender = render;
  if (manUi.sizes || manUi.pending) return;
  manUi.pending = true;
  void refresh().finally(() => {
    manUi.pending = false;
    render();
  });
}

const row = (label: string, ctl: string, help = '') => `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${ctl}</div></div>`;
const badge = (ok: boolean | null, text: string) => `<span class="gw-state${ok === null ? ' off' : ok ? '' : ' bad'}">${esc(text)}</span>`;
const head = (crumb: string, title: string, desc: string, act = '') =>
  `<header class="gw-head"><h2>${esc(title)}${crumb ? `<small>${esc(crumb)}</small>` : ''}</h2>${act ? `<div class="gw-head-act">${act}</div>` : ''}<p class="gx-muted">${esc(desc)}</p>${manUi.notice ? `<div class="gx-err" role="alert">${esc(manUi.notice)}</div>` : ''}${manUi.info ? `<p class="gx-hint">${esc(manUi.info)}</p>` : ''}</header>`;

/** 내보낼 글: 기기 설정 전부 + 카드 명부(세계 편집: 요원·조직·괴이·파밍·부록·세력 관계·명부)를 「directory」로 (2026-11-05 사용자) */
function exportJson(ctx: ChatContext): string {
  const directory = readDirectoryData(ctx.char.globalLore ?? []);
  return JSON.stringify(directory ? { ...getPrefs(), directory } : getPrefs(), null, 2);
}

function backupPage(ctx: ChatContext): string {
  const json = exportJson(ctx);
  const sizes = manUi.sizes;
  const store = STORE.map(([key, label, help, drop]) => {
    const n = sizes?.[key] ?? 0;
    const ctl = `<span class="gw-tokens">${sizes ? (n ? kb(n) : '없음') : '…'}</span>${drop && n ? (manUi.confirm === drop.slice(4) ? `<button class="gx-mini danger" data-action="${drop}-yes">정말 지우기</button><button class="gx-mini" data-action="man-no">취소</button>` : `<button class="gx-mini" data-action="${drop}">${ICONS.trash}지우기</button>`) : ''}`;
    return row(label, ctl, help);
  }).join('');
  const importRows = `<div class="ps-row"><div class="ps-label"><b>가져오기</b><small>내보낸 JSON을 붙여 넣거나 파일을 올리고 「적용」을 누르세요. 지금 기기 설정(과 세계 편집)을 통째로 바꿔요.</small></div>
      <div class="ps-ctl"><label class="gx-mini gw-file">${ICONS.refresh}파일 올리기<input type="file" accept=".json,application/json" data-change="man-import-file" hidden></label>${manUi.importName ? `<span class="gx-muted">${esc(manUi.importName)}</span>` : ''}</div>
      <textarea data-input="man-import-text" rows="4" placeholder="여기에 붙여 넣기 { … }">${esc(manUi.importText)}</textarea></div>
    <div class="ps-row gw-rel-foot">${manUi.confirm === 'import' ? `<span class="gx-muted">지금 설정을 덮어써요.</span><button class="gx-mini danger" data-action="man-import-yes">정말 적용</button><button class="gx-mini" data-action="man-no">취소</button>` : `<button class="gx-mini" data-action="man-import" ${manUi.importText.trim() ? '' : 'disabled'}>적용</button>`}</div>`;
  return `<div class="gw-page gw-set">${head('이 기기 공통', '설정 내보내기', '설정을 글(JSON) 하나로 내보내고 가져와요. 들어가는 것: 화면·이미지 설정, 「기본값으로 저장」으로 둔 새 채팅 기본값(상황판·괴이 발생·괴담넷·괴담톡·위키·인물·일지·가계부·상태창 칸·생성 공통), 고친 지침·추가 규칙·이미지 지침·즐겨찾기, 그리고 이 카드의 세계 편집(요원·조직·괴이·파밍·부록·세력 관계·명부). 한 번도 바꾸지 않아 기본값 그대로인 항목은 적지 않아요. 채팅 안에 든 기록(상황판·인물 기록·일지)은 Risu 채팅 백업에 들어 있어요.')}
    <div class="gx-settings gw-setbody">
    <section class="ps-group"><h3>기기 설정</h3><div class="ps-rows">
      <div class="ps-row"><div class="ps-label"><b>내보내기</b><small>위 범위의 설정 전부를 JSON 글 하나로. 복사해서 메모장 같은 곳에 두세요. 바꾸지 않은 항목은 기본값이라 적히지 않아요.</small></div>
        <div class="ps-ctl"><span class="gw-tokens">${kb(json.length)}</span><button class="gx-mini" data-action="man-copy">${ICONS.pen}복사</button><button class="gx-mini" data-action="man-download">내려받기</button></div></div>
      ${importRows}
    </div></section>
    <section class="ps-group"><h3>저장소 사용량 <small>이 기기 플러그인 저장소에 있는 것</small></h3><div class="ps-rows">${store}</div></section>
    </div></div>`;
}

/** 상태 점검 줄의 「받기」 단추: 이미 있으면 없음, 받는 중이면 진행 글 */
function getBtn(what: 'tok' | 'wiki', label: string, has: boolean): string {
  if (has) return '';
  if (manUi.getting === what) return `<span class="gx-muted gw-getting">${esc(manUi.progress || '받는 중…')}</span>`;
  return `<button class="gx-mini" data-action="man-get-${what}" ${manUi.getting ? 'disabled' : ''}>${ICONS.refresh}${esc(label)}</button>`;
}

function diagPage(ctx: ChatContext, canChat: boolean): string {
  const lore = ctx.char.globalLore;
  const goei = isGoeiLore(lore);
  const ver = cardVersion(lore);
  const mode = String(advValue(ctx.chat.scriptstate, 'gen', 'lore_mode') ?? 'plugin');
  const msgs = Array.isArray(ctx.chat.message) ? ctx.chat.message.length : 0;
  const tok = tokenizerName();
  const rows = [
    row('카드', badge(goei, goei ? '괴이 카드' : '괴이 카드 아님'), goei ? `카드 ${ver === '0' ? '이전 판' : `v${ver}`} · 명부·매니페스트 있음` : '설치 · 점검에서 심으면 괴이 카드가 돼요'),
    row('플러그인', badge(true, `v${PLUGIN_VERSION}`), UPDATE_BASE ? `업데이트 주소 ${UPDATE_BASE}` : '업데이트 주소가 없는 빌드'),
    // 카드 판 ≠ 플러그인 판이면 빨간 줄 (2026-11-06 사용자, 전수점검 남은 것 4): 카드가 낡았으면 업데이트 페이지로, 카드가 더 새면 플러그인을 받으라고
    ...(goei && compareVersions(ver, PLUGIN_VERSION) !== 0 ? [row('판 맞춤', badge(false, compareVersions(ver, PLUGIN_VERSION) < 0 ? '카드가 낡음' : '플러그인이 낡음'), compareVersions(ver, PLUGIN_VERSION) < 0
      ? `카드 ${ver === '0' ? '이전 판' : `v${ver}`}, 플러그인 v${PLUGIN_VERSION}. 새 기능·지침이 카드에 없을 수 있어요. 업데이트에서 카드를 플러그인 판으로 올리세요. <button class="gx-mini" data-action="ed-node" data-value="set:update">${ICONS.refresh}업데이트로</button>`
      : `카드 v${ver}, 플러그인 v${PLUGIN_VERSION}. 플러그인을 새 판으로 받으세요.`)] : []),
    row('채팅', badge(canChat, canChat ? '진행 중' : '시작 전'), canChat ? `메시지 ${msgs}개 · 이 채팅 값으로 동작해요` : '시작 화면이에요. 설정은 새 채팅 기본값으로 저장돼요'),
    // 없으면 빨간 배지 옆에 바로 받는 단추와, 안 받으면 뭐가 다른지 한 줄 (2026-11-06 사용자 승인, 전수점검 9-9)
    row('토크나이저', badge(!!tok, tok || '어림값') + getBtn('tok', '받기 (약 2MB)', !!tok), tok ? '토큰 수를 정확히 세요' : '안 받으면 토큰 수를 어림으로 세요. 받으면 정확해져요. 기능 차이는 없어요.'),
    row('위키 기본 문서', badge(!!storedWikiPack(), storedWikiPack() ? '있음' : '없음') + getBtn('wiki', '받기 (약 1MB)', !!storedWikiPack()), storedWikiPack() ? '카드에서 뺀 기본 문서 묶음 (이 기기 저장소)' : '안 받으면 위키 기본 문서(괴이·장소 설명)가 비어 있어요. 받으면 위키 탭에서 바로 읽을 수 있어요.'),
    row('로어북 보내기', badge(null, mode === 'risu' ? 'Risu가 직접' : '플러그인이 고름'), '설정 → 고급 → 로어북 보내기'),
  ].join('');
  const fails = [gnet.failure ? `괴담넷: ${gnet.failure.reason}` : '', phone.failure ? `괴담톡: ${phone.failure.reason}` : '', wiki.failure ? `위키: ${wiki.failure.reason}` : ''].filter(Boolean);
  return `<div class="gw-page gw-set">${head('', '상태 점검', '플러그인·카드·저장소가 지금 어떤 상태인지. 문제가 있으면 어디서 고치는지 적어 뒀어요.')}
    <div class="gx-settings gw-setbody">
    <section class="ps-group"><h3>현재 상태</h3><div class="ps-rows">${rows}${row('최근 실패', fails.length ? badge(false, `${fails.length}건`) : badge(true, '없음'), fails.length ? '요청 기록에서 원문을 볼 수 있어요' : '괴담넷·괴담톡·위키 요청이 실패한 적이 없어요')}</div></section>
    ${canChat ? loreCheckBox(ctx) : ''}
    </div></div>`;
}

function logPage(): string {
  const fail = (name: string, f: { reason: string; raw: string } | null) =>
    f ? `<div class="ps-row"><div class="ps-label"><b>${esc(name)}</b><small>${esc(f.reason)}</small></div><textarea readonly rows="4">${esc(f.raw)}</textarea></div>` : '';
  const fails = fail('괴담넷', gnet.failure) + fail('괴담톡', phone.failure) + fail('위키', wiki.failure);
  const diag = manUi.diag;
  const runs = diag
    ? diag.length
      ? diag.map((r) => row(`${esc(r.at)} · ${esc(r.reason)}`, badge(r.ok, r.ok ? '성공' : `실패${r.stage ? ` · ${r.stage}` : ''}`), `${r.model} · ${r.people.join(', ') || '대상 없음'} · ${Math.round(r.ms / 100) / 10}초${r.error ? ` · ${esc(r.error)}` : ''}`)).join('')
      : '<p class="ps-note">아직 갱신 기록이 없어요.</p>'
    : '<p class="ps-note">읽는 중…</p>';
  return `<div class="gw-page gw-set">${head('', '요청 기록', '괴담넷·괴담톡·위키 요청의 최근 실패 원문과 인물 기록 갱신 기록이에요.')}
    <div class="gx-settings gw-setbody">
    <section class="ps-group"><h3>최근 실패 <small>창을 닫아도 이 세션 동안 남아요</small></h3><div class="ps-rows">${fails || '<p class="ps-note">실패한 요청이 없어요.</p>'}${fails ? `<div class="ps-row gw-rel-foot"><button class="gx-mini" data-action="man-clear-fail">지우기</button></div>` : ''}</div></section>
    <section class="ps-group"><h3>인물 기록 갱신 <small>최근 ${diag?.length ?? 0}건</small></h3><div class="ps-rows">${runs}${diag?.length ? `<div class="ps-row gw-rel-foot">${manUi.confirm === 'drop-diag' ? `<button class="gx-mini danger" data-action="man-drop-diag-yes">정말 지우기</button><button class="gx-mini" data-action="man-no">취소</button>` : `<button class="gx-mini" data-action="man-drop-diag">${ICONS.trash}기록 지우기</button>`}</div>` : ''}</div></section>
    </div></div>`;
}

export function managePage(ctx: ChatContext, node: ManageNode, canChat: boolean): string {
  if (node === 'manage:backup') return backupPage(ctx);
  if (node === 'manage:diag') return diagPage(ctx, canChat);
  return logPage();
}

export function manageInput(name: string, value: string): boolean {
  if (name !== 'man-import-text') return false;
  manUi.importText = value;
  manUi.importName = '';
  return true;
}

/** 가져오기 「파일 올리기」: 고른 JSON 파일을 읽어 붙여넣기 글칸에 넣는다 (2026-11-05 사용자: 붙여넣기와 파일 둘 다) */
export async function manageFile(el: HTMLInputElement): Promise<boolean> {
  if (el.dataset.change !== 'man-import-file') return false;
  const f = el.files?.[0];
  if (!f) return true;
  try {
    manUi.importText = await f.text();
    manUi.importName = f.name;
    manUi.notice = '';
  } catch (error) {
    manUi.notice = `파일을 읽지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
  }
  el.value = '';
  return true;
}

export async function manageAction(action: string, root: HTMLElement | null, ctx: ChatContext | null = null): Promise<boolean> {
  if (!action.startsWith('man-')) return false;
  manUi.notice = '';
  manUi.info = '';
  switch (action) {
    case 'man-no':
      manUi.confirm = '';
      return true;
    case 'man-copy': {
      if (!ctx) return true;
      const json = exportJson(ctx);
      // Risu 안에서는 navigator.clipboard 가 막혀 있을 때가 있다 → 임시 글칸을 골라 execCommand('copy') 로 한 번 더 시도 (2026-11-05 사용자)
      let ok = false;
      try {
        await navigator.clipboard.writeText(json);
        ok = true;
      } catch { /* 아래 */ }
      if (!ok && root) {
        const ta = document.createElement('textarea');
        ta.value = json;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        root.appendChild(ta);
        ta.focus();
        ta.select();
        try { ok = document.execCommand('copy'); } catch { ok = false; }
        ta.remove();
      }
      manUi.info = ok ? `복사했어요 (${kb(json.length)}).` : '이 환경에서는 복사가 막혀 있어요. 「내려받기」로 파일로 받으세요.';
      return true;
    }
    case 'man-download': {
      try {
        const json = ctx ? exportJson(ctx) : JSON.stringify(getPrefs(), null, 2);
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `goei-settings-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        manUi.info = '내려받기를 시작했어요. 안 되면 「복사」로 글을 옮기세요.';
      } catch (error) {
        manUi.notice = `내려받지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      return true;
    }
    case 'man-import':
      manUi.confirm = 'import';
      return true;
    case 'man-import-yes': {
      manUi.confirm = '';
      try {
        const parsed = JSON.parse(manUi.importText) as unknown;
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('설정 JSON 이 아니에요.');
        // 세계 편집(명부)이 들어 있으면 카드 로어북 Directory 에 적는다 (2026-11-05 사용자)
        const { directory, ...prefs } = parsed as { directory?: unknown } & Record<string, unknown>;
        let wrote = '';
        if (directory && typeof directory === 'object' && !Array.isArray(directory)) {
          if (!ctx) throw new Error('세계 편집을 적을 카드가 없어요.');
          await updateCharacterLore(ctx.charIndex, (lore) => withDirectory(lore, directory as DirectoryData));
          wrote = ' 세계 편집(명부)도 카드에 적었어요.';
        }
        await savePrefs(() => prefs as unknown as ReturnType<typeof getPrefs>);
        manUi.importText = '';
        manUi.importName = '';
        manUi.sizes = null;
        manUi.info = `설정을 가져왔어요.${wrote} 창을 닫았다 열면 전부 반영돼요.`;
      } catch (error) {
        manUi.notice = `가져오지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      return true;
    }
    case 'man-get-tok':
    case 'man-get-wiki': {
      // 상태 점검에서 바로 받기 (설치 페이지와 같은 함수). 진행 글은 그 줄에 띄우고, 끝나면 배지가 바뀐다
      if (manUi.getting) return true;
      const what = action === 'man-get-tok' ? 'tok' : 'wiki';
      manUi.getting = what;
      manUi.progress = '';
      rerender?.();
      const progress = (t: string) => {
        manUi.progress = t;
        rerender?.();
      };
      try {
        if (what === 'tok') await installTokenizer(progress);
        else await installWikiPack(progress);
        manUi.info = what === 'tok' ? '토크나이저를 받았어요. 이제 토큰 수를 정확히 세요.' : '위키 기본 문서를 받았어요. 위키 탭에서 읽을 수 있어요.';
      } catch (error) {
        manUi.notice = `${what === 'tok' ? '토크나이저' : '위키 기본 문서'}를 받지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      manUi.getting = '';
      manUi.progress = '';
      manUi.sizes = null; // 저장소 사용량 다시 읽기
      return true;
    }
    case 'man-drop-wiki':
    case 'man-drop-tok':
    case 'man-drop-diag':
    case 'man-drop-game':
      manUi.confirm = action.slice(4) as typeof manUi.confirm;
      return true;
    case 'man-drop-game-yes': {
      manUi.confirm = '';
      const n = await dropOldGame();
      manUi.info = n ? `옛 게임 자료 ${n}개를 지웠어요.` : '지울 옛 게임 자료가 없어요.';
      manUi.sizes = null;
      return true;
    }
    case 'man-drop-wiki-yes':
      manUi.confirm = '';
      await dropWikiPack();
      manUi.info = '위키 기본 문서를 지웠어요.';
      manUi.sizes = null;
      return true;
    case 'man-drop-tok-yes':
      manUi.confirm = '';
      await dropTokenizer();
      manUi.info = '토크나이저를 지웠어요. 토큰 수는 어림값이에요.';
      manUi.sizes = null;
      return true;
    case 'man-drop-diag-yes':
      manUi.confirm = '';
      await clearDiag();
      manUi.info = '인물 기록 실행 기록을 지웠어요.';
      manUi.sizes = null;
      return true;
    case 'man-clear-fail':
      gnet.failure = null;
      phone.failure = null;
      wiki.failure = null;
      return true;
  }
  return true;
}
