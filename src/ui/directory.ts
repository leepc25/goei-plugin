// 설정 → 「카드 명부」: 로어북 폴더에서 모은 괴이·미스틱 사이트·요원의 세부값 편집.
// 고친 값은 카드 로어북 「Directory」에 저장되어 카드와 함께 공유되고, 이 카드의 모든 채팅에 바로 적용된다.
import {
  agentGroup, assignOrg, directoryData, moveAgent, type Directory, factionDisplayNames, orgAffiliation, orgOf, type OrgRow, phoneTabs, readDirectory, type AgentRow,
  type BaseRow, type PlaceRow, withDirectory, agentGender, loreGender, type AppendixRow,
} from '../core/world/directory';
import { tokens } from '../core/gnet';
import { readUnlocked, unlockedValue, UNLOCK_VAR } from '../core/lore';
import { MAP_CODES, placeWhere, regionName, SIDO_NAME, SIGUN } from '../core/world/geo';
import { assetNames, assetUrl, DEFAULT_CROP, facePic, mainPic, parseCrop, personCrop, splitPic, type PicSource } from '../host/assets';
import { LEGACY_DATA } from '../core/lorebooks';
import { SCENARIOS } from '../core/scenarios';
import { BUILTIN, extraTabId, FACTION_TYPES, nextCode, placeholdersReady, staleFactionVars, withFactionPlaceholders } from '../core/factions';
import { updateCharacterLore, updateChat, type ChatContext } from '../host/risu';
import { imageUrl, picAvatar } from './images';
import { ICONS } from './icons';

export interface DirectoryEnv {
  render: () => void;
  refresh: () => Promise<void>;
}

type Kind = 'anomaly' | 'site' | 'agent' | 'org' | 'base' | 'appendix';
const KINDS: Kind[] = ['anomaly', 'site', 'agent', 'org', 'base', 'appendix'];
const isKind = (v: string): v is Kind => (KINDS as string[]).includes(v);

export const dirUi = {
  kind: 'anomaly' as Kind,
  q: '',
  open: '',
  /** 통합 검색에서 고른 항목: 다시 그린 뒤 그 줄로 스크롤 */
  scrollTo: '',
  draft: null as Directory | null,
  base: '',
  /** 초안을 만든 로어북 (카드가 바뀌면 새로 만든다) */
  from: null as unknown,
  busy: false,
  notice: '',
  done: '',
  /** 다른 폴더 로어북을 발생 후보로 고르는 칸 */
  adding: false,
  addQ: '',
  /** 명부 사용법 펼침 */
  help: false,
  /** 사진을 고르는 칸 「main>열쇠」·「face>열쇠」 */
  pick: '',
  pickQ: '',
  /** 얼굴 틀을 맞추는 항목 (열쇠) */
  crop: '',
};

export function resetDirectory(): void {
  Object.assign(dirUi, { kind: 'anomaly', q: '', open: '', draft: null, base: '', from: null, busy: false, notice: '', done: '', adding: false, addQ: '', help: false, pick: '', pickQ: '', crop: '' });
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const snapshot = (d: Directory) => JSON.stringify(directoryData(d));

function draftOf(ctx: ChatContext): Directory {
  const lore = ctx.char.globalLore ?? [];
  if (!dirUi.draft || (dirUi.from !== lore && !dirty())) {
    dirUi.draft = structuredClone(readDirectory(lore));
    dirUi.base = snapshot(dirUi.draft);
    dirUi.from = lore;
  } else if (dirUi.from !== lore) {
    // 고친 값이 있는 채로 로어북이 바뀌었다(폴더에 새 항목 등): 고친 값은 두고 새로 생긴 줄만 끼워 넣는다
    const fresh = readDirectory(lore);
    const d = dirUi.draft;
    const add = <T>(have: T[], next: T[], key: (r: T) => string) => {
      const known = new Set(have.map(key));
      for (const r of next) if (!known.has(key(r))) have.push(structuredClone(r));
    };
    add(d.anomalies, fresh.anomalies, (r) => r.lore);
    add(d.sites, fresh.sites, (r) => r.lore);
    add(d.agents, fresh.agents, (r) => r.lore);
    add(d.orgs, fresh.orgs, (r) => r.name);
    add(d.appendices, fresh.appendices, (r) => r.lore);
    dirUi.from = lore;
  }
  return dirUi.draft;
}

export const dirty = () => !!dirUi.draft && snapshot(dirUi.draft) !== dirUi.base;

/** 덮어쓰기 전이라도 명부에서 고친 거점은 임무 지도에 바로 보이게 */
export const draftBases = (): BaseRow[] | null => (dirty() ? dirUi.draft!.bases : null);

function rowsOf(d: Directory, kind: Kind): (PlaceRow | AgentRow)[] {
  return kind === 'anomaly' ? d.anomalies : kind === 'site' ? d.sites : d.agents;
}

const orgName = (d: Directory, names: Record<string, string>, aff: string) => orgOf(d.orgs, aff)?.name ?? names[aff] ?? aff;

function findRow(d: Directory, lore: string): PlaceRow | AgentRow | undefined {
  return rowsOf(d, dirUi.kind).find((r) => r.lore === lore);
}

function matches(r: PlaceRow | AgentRow, q: string): boolean {
  if (!q) return true;
  const a = r as AgentRow & PlaceRow;
  return [a.lore, a.label, a.name, a.english, a.rank, a.department, ...(a.aliases ?? [])].some((t) => t && t.toLowerCase().includes(q));
}

const input = (key: string, value: string, label: string, help = '') =>
  `<label class="dir-in"><span>${label}</span><input data-input="dir" data-key="${esc(key)}" value="${esc(value)}" autocomplete="off">${help ? `<small>${help}</small>` : ''}</label>`;

const chip = (action: string, value: string, label: string, on: boolean) =>
  `<button class="gx-chip${on ? ' on' : ''}" data-action="${action}" data-value="${esc(value)}" aria-pressed="${on}">${esc(label)}</button>`;

/** 초안 기준 플레이 세력 코드·이름·탭 (저장 전 새 세력 포함) */
const draftExtras = (d: Directory) => d.orgs.filter((o) => !o.faction && o.spec.playable && o.spec.code);
const codesOf = (d: Directory) => [...BUILTIN, ...draftExtras(d).map((o) => o.spec.code!)];
function namesOf(d: Directory, lore: ChatContext['char']['globalLore']): Record<string, string> {
  const out = factionDisplayNames(lore ?? []);
  for (const f of BUILTIN) if (d.display.none?.[f]) out[f] = d.display.none[f];
  for (const o of draftExtras(d)) out[o.spec.code!] = o.name;
  return out;
}
const tabName = (o: OrgRow) => o.spec.tab || Array.from(o.name).slice(0, 2).join('');
function tabsOf(d: Directory, lore: ChatContext['char']['globalLore']) {
  const tabs = d.phoneTabs.tabs.length
    ? d.phoneTabs.tabs.map((t) => ({ id: t.id, name: t.name, visibleFor: [...t.visible_for] }))
    : phoneTabs(lore ?? []).filter((t) => !/^T1\d\d$/.test(t.id));
  for (const o of draftExtras(d)) tabs.push({ id: extraTabId(o.spec.code!), name: tabName(o), visibleFor: [o.spec.code!] });
  return tabs;
}

const area = (key: string, value: string, label: string, help = '') =>
  `<label class="dir-in"><span>${label}</span><textarea data-input="dir" data-key="${esc(key)}" rows="3">${esc(value)}</textarea>${help ? `<small>${help}</small>` : ''}</label>`;

/** 로어북 이름 → 들어 있는 폴더(이모지 포함)와, 요원 폴더면 구분선 이름 (예: 🙂요원 · 개체) */
const SEP = /^\s*-{2,}\s*(.*?)\s*-{2,}\s*$/;
const sourceCache = new WeakMap<object, Map<string, string>>();
function loreSources(lore: ChatContext['char']['globalLore']): Map<string, string> {
  const books = lore ?? [];
  const hit = sourceCache.get(books);
  if (hit) return hit;
  const folders = new Map(books.filter((e) => e.mode === 'folder' && typeof e.key === 'string').map((e) => [e.key as string, String(e.comment ?? '')]));
  const out = new Map<string, string>();
  const divider = new Map<string, string>();
  for (const e of books) {
    if (e.mode === 'folder') continue;
    const name = String(e.comment ?? '').trim();
    const folder = folders.get(String(e.folder ?? '')) ?? '';
    const sep = SEP.exec(name);
    if (sep) {
      divider.set(folder, sep[1]);
      continue;
    }
    if (name) out.set(name, [folder, divider.get(folder)].filter(Boolean).join(' · '));
  }
  sourceCache.set(books, out);
  return out;
}

/** 다른 폴더에서 발생 후보로 고를 수 있는 로어북 (설정 폴더·폴더 없는 것·이미 있는 것 제외) */
export function directoryExtList(ctx: ChatContext): string {
  const d = draftOf(ctx);
  const rows = dirUi.kind === 'anomaly' ? d.anomalies : d.sites;
  const have = new Set(rows.map((r) => r.lore));
  const own = dirUi.kind === 'anomaly' ? '괴이' : '파밍';
  const q = dirUi.addQ.trim().toLowerCase();
  const list = [...loreSources(ctx.char.globalLore)]
    .filter(([name, src]) => src && !have.has(name) && !/설정|부록/.test(src) && src.replace(/[^\p{L}\p{N}]/gu, '') !== own && (!q || name.toLowerCase().includes(q) || src.toLowerCase().includes(q)))
    .slice(0, 60);
  if (!list.length) return '<p class="gx-muted dir-empty">고를 수 있는 로어북이 없어요.</p>';
  return list
    .map(([name, src]) => `<button class="dir-ext-item" data-action="dir-ext-add" data-value="${esc(name)}"><b>${esc(name)}</b><small>${esc(src)}</small><span>＋ 후보로</span></button>`)
    .join('');
}

/** 사진을 고를 대상: 괴이·특수·요원은 로어북 이름, 조직은 「org:이름」 */
type Slot = 'main' | 'face' | 'crop';
interface PicOf extends PicSource {
  english: string;
  /** 사람(요원)이면 얼굴 틀을 따로 안 맞춰도 기본 틀로 자른다 */
  person: boolean;
  set: (slot: Slot, v: string) => void;
}

function picOf(d: Directory, key: string): PicOf | null {
  const put = (o: { photo?: string; face?: string; crop?: string }) => (slot: Slot, v: string) => {
    const f = slot === 'main' ? 'photo' : slot;
    if (v) o[f] = v;
    else delete o[f];
  };
  if (key.startsWith('org:')) {
    const o = d.orgs.find((x) => x.name === key.slice(4));
    if (!o) return null;
    return { english: o.spec.english ?? '', photo: o.spec.photo, face: o.spec.face, crop: o.spec.crop, person: false, set: put(o.spec) };
  }
  const r = findRow(d, key);
  if (!r) return null;
  return { english: r.english, photo: r.photo, face: r.face, crop: r.crop, person: 'rank' in r, set: put(r) };
}

/** dirUi.pick 「main>열쇠」·「face>열쇠」 */
const pickOf = (v: string): { slot: Slot; key: string } => {
  const at = v.indexOf('>');
  return { slot: v.slice(0, at) === 'face' ? 'face' : 'main', key: v.slice(at + 1) };
};

/** 얼굴 틀 「가로,세로,크기」 (맞춘 값, 없으면 기본 틀) */
export function cropValue(key: string): [number, number, number] {
  const p = dirUi.draft ? picOf(dirUi.draft, key) : null;
  return p ? personCrop(p) : parseCrop(DEFAULT_CROP)!;
}

/** 얼굴 틀 바꾸기 (창의 틀 맞추기 칸에서 끌거나 크기를 바꿀 때) */
export function setCrop(key: string, crop: [number, number, number]): void {
  const p = dirUi.draft ? picOf(dirUi.draft, key) : null;
  if (!p) return;
  p.set('crop', crop.map((n) => Math.round(n)).join(','));
  dirUi.done = '';
}

/** 사진 칸 (괴이·특수·요원·조직 공통): 대표(큰 사진)·얼굴(작은 사진) 두 줄 + 고르기 + 얼굴 틀 맞추기 */
function photoBlock(key: string, ctx: ChatContext): string {
  const p = dirUi.draft ? picOf(dirUi.draft, key) : null;
  if (!p) return '';
  const main = mainPic(ctx.char, p);
  const face = facePic(ctx.char, p, p.person);
  const cut = !!main && splitPic(face).crop !== null;
  const line = (slot: 'main' | 'face', label: string, pic: string, picked: string | undefined, why: string, extra = '') => {
    const url = pic ? imageUrl(ctx.char, pic) : null;
    const picking = dirUi.pick === `${slot}>${key}`;
    return `<div class="dir-photo">
      <span class="dir-pic-img">${url ? `<img src="${esc(url)}" alt="">` : ICONS.spook}</span>
      <span class="dir-photo-name"><b>${label} · ${esc(picked || '자동')}</b><small>${why}</small></span>
      ${picked ? `<button class="gx-mini" data-action="dir-photo-set" data-value="${esc(`|${slot}>${key}`)}">자동으로</button>` : ''}${extra}
      <button class="gx-mini" data-action="dir-photo-pick" data-value="${esc(`${slot}>${key}`)}">${picking ? '닫기' : '고르기'}</button>
    </div>`;
  };
  const mainWhy = p.photo ? '직접 고름' : main ? `자동: ${esc(main)}` : '「영문명_default」·「영문명」 이미지가 없어요';
  const faceWhy = p.face ? '직접 고름' : cut ? '대표 사진에서 잘라요' : face ? `자동: ${esc(splitPic(face).name)}` : '「영문명」 이미지가 없어요';
  const cropping = cut && dirUi.crop === key;
  const cropBtn = cut ? `<button class="gx-mini" data-action="dir-crop" data-value="${esc(key)}">${cropping ? '완료' : '틀 맞추기'}</button>` : '';
  const picking = dirUi.pick ? pickOf(dirUi.pick) : null;
  const list = picking?.key === key ? `<div class="dir-ext"><input class="gx-search" data-input="dir-photo-q" value="${esc(dirUi.pickQ)}" placeholder="이미지 이름 검색" aria-label="이미지 이름 검색" autocomplete="off"><div class="dir-pics">${directoryPhotoList(ctx)}</div></div>` : '';
  return `<div class="dir-in"><span>사진</span>
    ${line('main', '대표', main, p.photo, mainWhy)}
    ${line('face', '얼굴', face, p.face, faceWhy, cropBtn)}
    ${cropping ? cropBox(ctx, key, main) : ''}
    ${list}
  </div>`;
}

/** 얼굴 틀 맞추기: 대표 사진 위 네모 틀을 끌어 옮기고, 아래 막대로 크기를 바꾼다 */
function cropBox(ctx: ChatContext, key: string, main: string): string {
  const url = imageUrl(ctx.char, main);
  const [x, y, w] = cropValue(key);
  return `<div class="dir-crop">
    <div class="dir-crop-img" data-crop="${esc(key)}">${url ? `<img src="${esc(url)}" alt="" draggable="false"><span class="dir-crop-frame" style="left:${x}%;top:${y}%;width:${w}%"></span>` : ''}</div>
    <label class="dir-crop-size"><span>크기</span><input type="range" min="10" max="100" step="1" value="${w}" data-input="dir-crop-size" data-key="${esc(key)}" aria-label="얼굴 틀 크기"></label>
    <button class="gx-mini" data-action="dir-crop-reset" data-value="${esc(key)}">기본 틀로</button>
  </div>`;
}

/** 사진 고르기 목록 (검색어로 거르고, 영문명과 닮은 이름 먼저) */
export function directoryPhotoList(ctx: ChatContext): string {
  const at = dirUi.pick ? pickOf(dirUi.pick) : null;
  const p = at && dirUi.draft ? picOf(dirUi.draft, at.key) : null;
  if (!at || !p) return '';
  const cur = at.slot === 'face' ? p.face : p.photo;
  const q = dirUi.pickQ.trim().toLowerCase();
  const near = p.english.toLowerCase();
  // 모듈까지 수천 장이라 한 번에 30장만 그린다. 검색어가 없으면 영문명으로 시작하는 것(표정 세트)만
  const all = assetNames(ctx.char);
  const hits = q ? all.filter((n) => n.toLowerCase().includes(q)) : near ? all.filter((n) => n.toLowerCase().startsWith(near)) : [];
  const list = [...hits.filter((n) => near && n.toLowerCase().startsWith(near)), ...hits.filter((n) => !near || !n.toLowerCase().startsWith(near))];
  if (!list.length) return `<p class="gx-muted dir-empty">${q ? '찾는 이름의 이미지가 없어요.' : `이미지 ${all.length}장 중에서 이름으로 검색해 주세요.`}</p>`;
  const more = list.length > 30 ? `<p class="gx-muted dir-empty">${list.length}장 중 30장만 보여요. 검색어를 더 적어 주세요.</p>` : '';
  return list.slice(0, 30)
    .map((n) => {
      const url = imageUrl(ctx.char, n);
      return `<button class="dir-pic${cur === n ? ' on' : ''}" data-action="dir-photo-set" data-value="${esc(`${n}|${dirUi.pick}`)}" title="${esc(n)}"><span class="dir-pic-img">${url ? `<img src="${esc(url)}" alt="" loading="lazy">` : ''}</span><small>${esc(n)}</small></button>`;
    })
    .join('') + more;
}

function placePanel(p: PlaceRow, ctx: ChatContext): string {
  const k = (f: string) => `${f}|${p.lore}`;
  return `<div class="dir-panel">
    <div class="dir-line"><span>무작위 발생 후보</span><div class="gx-segs gx-segs-sm">
      <button class="gx-seg${p.preset ? ' on' : ''}" data-action="dir-set" data-value="${esc(`preset|1|${p.lore}`)}">ON</button>
      <button class="gx-seg${!p.preset ? ' on' : ''}" data-action="dir-set" data-value="${esc(`preset|0|${p.lore}`)}">OFF</button></div></div>
    <p class="gx-muted">OFF여도 직접 고르거나 대화에 나오면 상황판에 기록돼요.</p>
    ${input(k('label'), p.label, '표시 이름', '상황판과 지도에 보이는 이름')}
    ${input(k('english'), p.english, '영문명', '영어 응답에서도 이 이름을 알아봐요')}
    ${input(k('aliases'), p.aliases.join(', '), '별칭', '쉼표로 나눠 적어요')}
    ${photoBlock(p.lore, ctx)}
    <p class="gx-muted">로어북: ${esc(p.lore)}${p.inFolder ? '' : ' (폴더 밖)'}</p>
    ${p.inFolder ? '' : `<button class="gx-mini danger" data-action="dir-ext-del" data-value="${esc(p.lore)}">후보 목록에서 빼기</button>`}
  </div>`;
}

function agentPanel(a: AgentRow, ctx: ChatContext, d: Directory): string {
  const lore = ctx.char.globalLore ?? [];
  const names = namesOf(d, lore);
  const tabs = tabsOf(d, lore);
  const k = (f: string) => `${f}|${a.lore}`;
  const cur = orgOf(d.orgs, a.affiliation);
  return `<div class="dir-panel">
    <div class="dir-line"><span>소속 조직</span><div class="dir-chips">${d.orgs.map((o) => chip('dir-org-pick', `${o.name}|${a.lore}`, o.name, cur === o)).join('')}${chip('dir-org-pick', `|${a.lore}`, '미정', !a.affiliation)}</div></div>
    <p class="gx-muted">조직을 고르면 아래 두 값이 그 조직 기준으로 채워져요. 새 조직은 「조직」 탭에서 만들어요.</p>
    <div class="dir-line"><span>성별</span><div class="dir-chips">${(['F', 'M', 'X'] as const).map((x) => chip('dir-gender', `${x}|${a.lore}`, { F: '여', M: '남', X: '미정' }[x], (agentGender(a, lore) || 'X') === x)).join('')}</div></div>
    <div class="dir-line"><span>요원 목록에 보일 세력</span><div class="dir-chips">${codesOf(d).map((f) => chip('dir-toggle', `rosterFor|${f}|${a.lore}`, names[f], a.rosterFor.includes(f))).join('')}</div></div>
    <div class="dir-line"><span>괴담톡 연락처 탭</span><div class="dir-chips">${tabs.map((t) => chip('dir-toggle', `phoneTabs|${t.id}|${a.lore}`, t.name || t.id, a.phoneTabs.includes(t.id))).join('')}</div></div>
    <div class="dir-grid">
      ${input(k('rank'), a.rank, '직급')}
      ${input(k('department'), a.department, '부서')}
    </div>
    ${input(k('english'), a.english, '영문명', '영어 응답에서도 이 이름을 알아봐요')}
    ${photoBlock(a.lore, ctx)}
    ${input(k('aliases'), a.aliases.join(', '), '별칭', '쉼표로 나눠 적어요')}
    <p class="gx-muted">로어북: ${esc(a.lore)} · ID ${esc(a.id)}${a.inFolder ? '' : ' (폴더 밖)'}</p>
  </div>`;
}

/** 시작 화면에 보일 세력 값: 기본 세력은 이름·설명·사진·숨김, 다른 조직은 플레이 세력으로 켜고 끄기 */
function factionBlock(o: OrgRow, ctx: ChatContext): string {
  const lore = ctx.char.globalLore ?? [];
  const k = (f: string) => `org:${f}|${o.name}`;
  const seg = (action: string, on: boolean, a: string, b: string) =>
    `<div class="gx-segs gx-segs-sm"><button class="gx-seg${on ? ' on' : ''}" data-action="${action}" data-value="${esc(`1|${o.name}`)}">${a}</button><button class="gx-seg${!on ? ' on' : ''}" data-action="${action}" data-value="${esc(`0|${o.name}`)}">${b}</button></div>`;
  const start = `${input(k('title'), o.spec.title ?? '', '시작 화면 이름', o.faction ? '비우면 원래 이름' : '비우면 조직 이름')}
    ${area(k('blurb'), o.spec.blurb ?? '', '시작 화면 설명')}`;
  if (o.faction) {
    return `<div class="dir-fac"><div class="dir-line"><span>시작 화면에 보이기</span>${seg('dir-fac-hide', !o.spec.hidden, '보임', '숨김')}</div>${start}${builtinBlock(o.faction, dirUi.draft!)}</div>`;
  }
  const on = !!o.spec.playable;
  const ready = placeholdersReady(lore);
  const head = `<div class="dir-line"><span>플레이 세력${on && o.spec.code ? ` <b class="dir-code">${esc(o.spec.code)}</b>` : ''}</span>${seg('dir-fac-play', on, 'ON', 'OFF')}</div>`;
  if (!on) return `<div class="dir-fac">${head}<p class="gx-muted">켜면 이 조직으로 시작할 수 있어요. 첫 장면은 직접 입력과 커스텀 임무로 시작해요.</p></div>`;
  const patch = ready
    ? ''
    : `<div class="gx-hint">이 카드의 🏷️Tag 로어북에 새 세력 자리가 없어서 아직 시작 화면에 안 보여요. <button class="gx-mini" data-action="dir-fac-patch">로어북에 자리 넣기</button></div>`;
  return `<div class="dir-fac">${head}${patch}
    <div class="dir-line"><span>유형</span><div class="dir-chips">${FACTION_TYPES.map((x) => chip('dir-fac-type', `${x.id}|${o.name}`, x.label, (o.spec.type ?? 'org') === x.id)).join('')}</div></div>
    <p class="gx-muted">${esc(FACTION_TYPES.find((x) => x.id === (o.spec.type ?? 'org'))!.help)}</p>
    ${start}
    ${input(k('gm_name'), o.spec.gm_name ?? '', '모델용 영어 이름', '소속 변경 태그 목록과 세력 설명 제목에 써요. 비우면 조직 이름')}
    ${area(k('gm_desc'), o.spec.gm_desc ?? '', '모델용 세력 설명', '📜Faction 로어북 끝에 붙어요. 영어로 적으면 다른 세력 설명과 어울려요')}
    ${input(k('seed'), (o.spec.seed ?? [o.name]).join(', '), '시작 때 함께 넣을 로어북', '쉼표로 나눠 적어요. 첫 응답에 이 로어북들이 꼭 들어가요')}
    ${input(k('tab'), o.spec.tab ?? '', '괴담톡 전용 탭 이름', `비우면 「${esc(tabName(o))}」`)}
  </div>`;
}

/** 기본 세력: 다른 세력이 부르는 이름, 괴담톡 전용 탭 이름, 첫 장면마다 함께 넣을 로어북 */
function builtinBlock(code: string, d: Directory): string {
  const viewers = [['none', '기본'], ...BUILTIN.map((f) => [f, `${d.display.none?.[f] || f} 소속`])];
  const fallback = d.display.none?.[code] ?? '';
  const names = viewers
    .map(([v, label]) => `<label class="dir-in"><span>${esc(label)}</span><input data-input="dir" data-key="${esc(`disp:${v}|${code}`)}" value="${esc(d.display[v]?.[code] ?? '')}" placeholder="${esc(fallback)}" autocomplete="off"></label>`)
    .join('');
  const own = d.phoneTabs.tabs.find((t) => t.visible_for.length === 1 && t.visible_for[0] === code);
  const tab = own ? input(`ptab:${own.id}`, own.name, '괴담톡 전용 탭 이름') : '';
  const scenes = (SCENARIOS.factions.find((f) => f.code === code)?.scenarios ?? [])
    .map((sc) => input(`seed:${code}-${sc.fm}`, (d.seeds[`${code}-${sc.fm}`] ?? []).join(', '), `${sc.fm}. ${esc(sc.label)}`))
    .join('');
  return `<div class="dir-line"><span>부르는 이름</span></div><div class="dir-grid names">${names}</div>
    ${tab}
    <div class="dir-line"><span>첫 장면에 함께 넣을 로어북</span></div><div class="dir-grid">${scenes}</div>`;
}

function orgPanel(o: OrgRow, ctx: ChatContext, d: Directory): string {
  const lore = ctx.char.globalLore ?? [];
  const names = namesOf(d, lore);
  const tabs = tabsOf(d, lore);
  const members = d.agents.filter((a) => a.affiliation === orgAffiliation(o));
  return `<div class="dir-panel">
    ${input(`org:english|${o.name}`, o.spec.english ?? '', '영문명')}
    ${photoBlock(`org:${o.name}`, ctx)}
    ${factionBlock(o, ctx)}
    <div class="dir-line"><span>요원 목록에 보일 세력</span><div class="dir-chips">${codesOf(d).map((f) => chip('dir-org-toggle', `rosterFor|${f}|${o.name}`, names[f], o.rosterFor.includes(f))).join('')}</div></div>
    <div class="dir-line"><span>괴담톡 연락처 탭</span><div class="dir-chips">${tabs.map((t) => chip('dir-org-toggle', `phoneTabs|${t.id}|${o.name}`, t.name || t.id, o.phoneTabs.includes(t.id))).join('')}</div></div>
    <p class="gx-muted">바꾸면 이 조직 요원 ${members.length}명 모두에게 적용돼요. 한 사람만 다르게 하려면 요원 탭에서 바꿔요.</p>
    ${o.faction ? '' : `<div class="dir-rename"><label class="dir-in"><span>조직 이름</span><input name="dir-org-name" value="${esc(o.name)}" autocomplete="off" data-enter="dir-org-rename"></label>
      <button class="gx-mini" data-action="dir-org-rename" data-take="dir-org-name">이름 바꾸기</button>
      <button class="gx-mini danger" data-action="dir-org-del" data-value="${esc(o.name)}" ${members.length ? 'disabled title="소속 요원이 있으면 지울 수 없어요"' : ''}>지우기</button></div>`}
    ${members.length ? `<p class="gx-muted">소속: ${members.map((m) => esc(m.name)).join(', ')}</p>` : ''}
    <div class="dir-line"><span>거점</span><div class="dir-chips">${d.bases
      .filter((b) => b.org === o.name)
      .map((b) => chip('dir-base-goto', b.name, b.name, false))
      .join('')}<button class="gx-chip" data-action="dir-base-new" data-value="${esc(o.name)}">＋ 거점 추가</button></div></div>
  </div>`;
}

function orgRow(o: OrgRow, ctx: ChatContext, d: Directory, names: Record<string, string>): string {
  const open = dirUi.open === o.name;
  const n = d.agents.filter((a) => a.affiliation === orgAffiliation(o)).length;
  const sub = o.rosterFor.length ? `${o.rosterFor.map((f) => names[f] ?? f).join('·')} 플레이 때 보임` : '요원 목록에 안 보임';
  const play = o.faction || (o.spec.playable && o.spec.code);
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(o.name)}" aria-expanded="${open}">
      <span class="dir-name"><b>${esc(o.name)}</b><small>${esc(sub)}</small></span>
      ${play ? `<span class="gx-badge live">플레이 ${esc(o.faction || o.spec.code)}</span>` : ''}${o.spec.hidden ? '<span class="gx-badge">시작 화면 숨김</span>' : ''}<span class="gx-badge">${n}명</span>
    </button>${open ? orgPanel(o, ctx, d) : ''}</div>`;
}

// ── 거점 ──
// 지도에 찍히는 장소. 조직의 본거지면 조직을 고르고, 아니면 「조직 없음」. 위치는 지역 지도를 눌러 정한다.

const REGIONS = MAP_CODES.filter((c) => c !== '01');
const baseMaps: Record<string, string | null | 'loading'> = {};

function baseMap(ctx: ChatContext, code: string, env: DirectoryEnv | null): string | null {
  const hit = baseMaps[code];
  if (hit === undefined && env) {
    baseMaps[code] = 'loading';
    void assetUrl(ctx.char, `map${code}`).then((url) => {
      baseMaps[code] = url;
      env.render();
    });
    return null;
  }
  return hit === 'loading' || hit === undefined ? null : hit;
}

let mapEnv: DirectoryEnv | null = null;

const baseWhere = (b: BaseRow) => placeWhere(b.sido, b.gu) || '위치 미정';

function basePanel(b: BaseRow, ctx: ChatContext, d: Directory): string {
  const k = (f: string) => `base:${f}|${b.name}`;
  const url = baseMap(ctx, b.sido, mapEnv);
  const sido = REGIONS.map((c) => `<option value="${c}"${c === b.sido ? ' selected' : ''}>${esc(regionName(c))}</option>`).join('');
  const gus = `<option value=""${b.gu ? '' : ' selected'}>시군구 선택 안 함</option>` + (SIGUN[b.sido] ?? []).map((g) => `<option value="${esc(g)}"${g === b.gu ? ' selected' : ''}>${esc(g)}</option>`).join('');
  const map = url
    ? `<div class="dir-map" data-base-pick="${esc(b.name)}"><img src="${esc(url)}" alt="${esc(regionName(b.sido))} 지도" draggable="false"><span class="dir-mappin" style="left:${b.x}%;top:${b.y}%"></span></div>`
    : `<div class="dir-map ph">지도 불러오는 중…</div>`;
  return `<div class="dir-panel">
    <div class="dir-line"><span>지도에 보이기</span><div class="gx-segs gx-segs-sm">
      <button class="gx-seg${b.show ? ' on' : ''}" data-action="dir-base-show" data-value="${esc(`1|${b.name}`)}">보임</button>
      <button class="gx-seg${!b.show ? ' on' : ''}" data-action="dir-base-show" data-value="${esc(`0|${b.name}`)}">숨김</button></div></div>
    <div class="dir-line"><span>조직</span><div class="dir-chips">${d.orgs.map((o) => chip('dir-base-org', `${o.name}|${b.name}`, o.name, b.org === o.name)).join('')}${chip('dir-base-org', `|${b.name}`, '조직 없음', !b.org)}</div></div>
    <div class="dir-grid">
      <label class="dir-in"><span>지역</span><select class="gx-select" data-change="dir-base-sido" data-key="${esc(b.name)}">${sido}</select></label>
      <label class="dir-in"><span>시군구</span><select class="gx-select" data-change="dir-base-gu" data-key="${esc(b.name)}">${gus}</select></label>
    </div>
    ${map}
    ${input(k('label'), b.label, '지도 표시명', '비우면 거점 이름')}
    ${input(k('lore'), b.lore, '위키 로어북', '이 거점을 설명하는 로어북 이름')}
    ${input(k('english'), b.english, '영문명', '영어 응답에서도 이 이름을 알아봐요')}
    ${input(k('aliases'), b.aliases.join(', '), '별칭', '쉼표로 나눠 적어요')}
    <div class="dir-rename"><label class="dir-in"><span>거점 이름</span><input name="dir-base-name" value="${esc(b.name)}" autocomplete="off" data-enter="dir-base-rename"></label>
      <button class="gx-mini" data-action="dir-base-rename" data-take="dir-base-name">이름 바꾸기</button>
      <button class="gx-mini danger" data-action="dir-base-del" data-value="${esc(b.name)}">지우기</button></div>
  </div>`;
}

function baseRow(b: BaseRow, ctx: ChatContext, d: Directory): string {
  const open = dirUi.open === b.name;
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(b.name)}" aria-expanded="${open}">
      <span class="dir-name"><b>${esc(b.name)}</b><small>${esc([b.org || '조직 없음', baseWhere(b)].join(' · '))}</small></span>
      ${b.show ? '' : '<span class="gx-badge">숨김</span>'}
    </button>${open ? basePanel(b, ctx, d) : ''}</div>`;
}

function baseList(ctx: ChatContext, d: Directory, q: string): string {
  const rows = d.bases.filter((b) => !q || [b.name, b.label, b.english, b.org, b.gu, ...b.aliases].some((t) => t && t.toLowerCase().includes(q)));
  const order = [...d.orgs.map((o) => o.name), ''];
  // 조직마다 거점이 하나뿐이라 조직 제목을 따로 달지 않고, 조직 순서로 한 목록에 (조직은 줄 아래 작은 글씨)
  const rank = (b: BaseRow) => (b.org ? order.indexOf(b.org) : order.length);
  const sorted = [...rows].sort((x, y) => rank(x) - rank(y));
  return `    ${sorted.length ? sorted.map((b) => baseRow(b, ctx, d)).join('') : '<p class="gx-muted dir-empty">맞는 거점이 없어요.</p>'}`;
}

/** 새 거점 이름: 겹치면 뒤에 번호 */
function freeBaseName(d: Directory, want: string): string {
  let name = want;
  for (let i = 2; d.bases.some((b) => b.name === name); i++) name = `${want} ${i}`;
  return name;
}

function placeRow(p: PlaceRow, ctx: ChatContext, src = ''): string {
  const open = dirUi.open === p.lore;
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(p.lore)}" aria-expanded="${open}">
      <span class="dir-name"><b>${esc(p.label)}</b><small>${esc(p.english || '영문명 없음')}</small></span>
      ${p.inFolder ? '' : `<span class="gx-badge wait">${esc(src || '폴더 밖')}</span>`}
      <span class="gx-badge${p.preset ? ' live' : ''}">${p.preset ? '발생 후보' : '숨김'}</span>
    </button>${open ? placePanel(p, ctx) : ''}</div>`;
}

function agentRow(a: AgentRow, ctx: ChatContext, d: Directory, names: Record<string, string>, order?: { first: boolean; last: boolean }): string {
  const open = dirUi.open === a.lore;
  const sub = [a.affiliation ? orgName(d, names, a.affiliation) : '', a.rank, a.department].filter(Boolean).join(' · ');
  // 순서 바꾸기 (검색 중에는 없음): PC는 손잡이를 끌고, 모바일은 ▲▼. 같은 조직 안에서만 움직인다
  const move = order
    ? `<span class="dir-move"><span class="dir-grip" data-drag-agent="${esc(a.lore)}" title="끌어서 순서 바꾸기" aria-hidden="true">${ICONS.grip}</span>`
      + `<button class="dir-step" data-action="dir-move" data-value="up|${esc(a.lore)}" aria-label="${esc(a.name)} 위로" ${order.first ? 'disabled' : ''}>${ICONS.up}</button>`
      + `<button class="dir-step" data-action="dir-move" data-value="down|${esc(a.lore)}" aria-label="${esc(a.name)} 아래로" ${order.last ? 'disabled' : ''}>${ICONS.down}</button></span>`
    : '';
  return `<div class="dir-row${open ? ' open' : ''}"${order ? ` data-agent-row="${esc(a.lore)}" data-agent-group="${esc(agentGroup(a))}"` : ''}><div class="dir-headrow">
    <button class="dir-head" data-action="dir-open" data-value="${esc(a.lore)}" aria-expanded="${open}">
      ${picAvatar(ctx.char, facePic(ctx.char, a, true), a.name)}
      <span class="dir-name"><b>${esc(a.name)}</b><small>${esc(sub || '소속 미정')}</small></span>
      ${!a.affiliation ? '<span class="gx-badge hot">소속 미정</span>' : a.rosterFor.length ? '' : '<span class="gx-badge">목록 숨김</span>'}
    </button>${move}</div>${open ? agentPanel(a, ctx, d) : ''}</div>`;
}


// ── 부록 ──
// 📎부록 폴더 항목. 본 항목(이름 앞부분으로 짐작, 고칠 수 있음)과 켜지는 조건을 정한다. 해금은 채팅마다

const FOLDER_LABEL: Record<string, string> = { 세력: '세력', 조직: '세력', 파밍: '특수', 괴이: '괴이', 요원: '요원' };

/** 본 항목이 들어 있는 폴더의 자리 이름 (못 찾으면 '') */
function parentSlot(r: AppendixRow, ctx: ChatContext): string {
  const src = loreSources(ctx.char.globalLore).get(r.parent) ?? '';
  return r.parent ? FOLDER_LABEL[src.split(' · ')[0].replace(/[^\p{L}\p{N}]/gu, '')] ?? '' : '';
}

const unlockedHere = (ctx: ChatContext) => new Set(readUnlocked(ctx.chat.scriptstate));

function appendixWhen(r: AppendixRow): string {
  return [r.keys ? '키' : '', r.withParent ? '본 항목과 같이' : '', r.target ? '목표' : '', r.places.length ? `위치 ${r.places.length}` : '', r.agents.length ? `요원 ${r.agents.length}` : '']
    .filter(Boolean).join(' · ') || '켜질 조건 없음';
}

function appendixRow(r: AppendixRow, ctx: ChatContext, d: Directory): string {
  const open = dirUi.open === r.lore;
  const slot = parentSlot(r, ctx);
  const lock = r.unlock ? (unlockedHere(ctx).has(r.lore) ? '<span class="gx-badge live">해금됨</span>' : '<span class="gx-badge wait">잠김</span>') : '';
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(r.lore)}" aria-expanded="${open}">
      <span class="dir-name"><b>${esc(r.lore)}</b><small>${esc(appendixWhen(r))}</small></span>
      ${slot ? '' : '<span class="gx-badge hot">본 항목 없음</span>'}${lock}
    </button>${open ? appendixPanel(r, ctx, d) : ''}</div>`;
}

function appendixPanel(r: AppendixRow, ctx: ChatContext, d: Directory): string {
  const k = (f: string) => `app:${f}|${r.lore}`;
  const e = (ctx.char.globalLore ?? []).find((x) => x.mode !== 'folder' && String(x.comment ?? '') === r.lore);
  const keys = String(e?.key ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  const slot = parentSlot(r, ctx);
  const toggle = (f: string, label: string, on: boolean) => chip('dir-app-toggle', `${f}|${r.lore}`, label, on);
  const bases = d.bases.map((b) => b.name).filter((n) => !r.places.includes(n));
  const unlocked = unlockedHere(ctx).has(r.lore);
  return `<div class="dir-panel">
    ${input(k('parent'), r.parent, '본 항목', r.guess ? `이름 앞부분으로 찾은 본 항목: ${esc(r.guess)}` : '본 항목 로어북 이름을 그대로 적어요')}
    <p class="${slot ? 'gx-muted' : 'gx-hint'}">${slot ? `본 항목과 같은 ${slot} 자리, 본 항목 바로 뒤에 들어가요.` : '본 항목을 찾지 못했어요. 세력 자리에 들어가요.'}</p>
    <div class="dir-line"><span>켜지는 조건</span><div class="dir-chips">
      ${toggle('keys', '키가 걸리면', r.keys)}${toggle('withParent', '본 항목과 같이', r.withParent)}${toggle('target', '상태창 목표가 본 항목이면', r.target)}
    </div></div>
    <p class="gx-muted">키: ${keys.length ? esc(keys.join(', ')) : '없음'} · 키는 로어북에서 고쳐요.</p>
    ${input(k('places'), r.places.join(', '), '위치', '상태창 위치 칸에 이 말이 들어 있으면 켜요. 쉼표로 나눠 적어요')}
    ${bases.length ? `<div class="dir-line"><span>거점에서 넣기</span><div class="dir-chips">${bases.slice(0, 24).map((n) => chip('dir-app-place', `${n}|${r.lore}`, `＋ ${n}`, false)).join('')}</div></div>` : ''}
    ${input(k('agents'), r.agents.join(', '), '동행·투입 요원', '이 요원이 동행하거나 작전에 투입 중이면 켜요. 쉼표로 나눠 적어요')}
    <div class="dir-line"><span>끄는 조건</span><div class="dir-chips">${toggle('needParent', '본 항목이 꺼져 있으면 끄기', r.needParent)}</div></div>
    ${area(k('unlock'), r.unlock, '해금 조건', '비우면 해금 없이 켜져요. 적으면 해금 전에는 어떤 조건으로도 켜지지 않고, 본 항목이 켜졌을 때 모델에게 이 조건만 알려요. 조건이 맞으면 모델이 해금 표시를 남겨요')}
    ${r.unlock ? `<div class="dir-line"><span>이 채팅</span><div class="dir-chips">${chip('dir-app-unlock', r.lore, unlocked ? '해금됨 · 누르면 다시 잠금' : '잠김 · 누르면 해금', unlocked)}</div></div>` : ''}
    <p class="gx-muted">로어북: ${esc(r.lore)} · 약 ${tokens(String(e?.content ?? '')).toLocaleString()}토큰</p>
  </div>`;
}

function appendixList(ctx: ChatContext, d: Directory, q: string): string {
  const rows = d.appendices.filter((r) => !q || [r.lore, r.parent, ...r.places, ...r.agents].some((t) => t.toLowerCase().includes(q)));
  if (!rows.length) {
    return q ? '<p class="gx-muted dir-empty">맞는 부록이 없어요.</p>'
      : '<p class="gx-muted dir-empty">부록이 없어요. 로어북에 <code>📎부록</code> 폴더를 만들고 「본 항목 이름 · 설명」으로 항목을 넣으면 여기 들어와요.</p>';
  }
  const lost = rows.filter((r) => !parentSlot(r, ctx));
  const parents = [...new Set(rows.filter((r) => parentSlot(r, ctx)).map((r) => r.parent))];
  return `${lost.length ? `<h3 class="dir-group warn">본 항목 없음<small>${lost.length}</small></h3>${lost.map((r) => appendixRow(r, ctx, d)).join('')}` : ''}
    ${parents.map((p) => {
      const list = rows.filter((r) => r.parent === p && parentSlot(r, ctx));
      return `<h3 class="dir-group">${esc(p)}<small>${list.length}</small></h3>${list.map((r) => appendixRow(r, ctx, d)).join('')}`;
    }).join('')}`;
}

/** 통합 검색: 검색어가 있으면 다섯 탭을 한꺼번에 찾아 탭별로 묶고, 고르면 그 탭으로 가서 연다 */
function searchAll(ctx: ChatContext, d: Directory, q: string, names: Record<string, string>): string {
  const jump = (kind: Kind, html: string) => html.replace(/data-action="dir-open" data-value="([^"]*)" aria-expanded="[^"]*"/, (_m, key: string) => `data-action="dir-jump" data-value="${kind}|${key}"`);
  const groups: [Kind, string, string[]][] = [
    ['anomaly', '괴이', d.anomalies.filter((r) => matches(r, q)).map((r) => jump('anomaly', placeRow(r, ctx)))],
    ['site', '특수', d.sites.filter((r) => matches(r, q)).map((r) => jump('site', placeRow(r, ctx)))],
    ['agent', '요원', d.agents.filter((r) => matches(r, q)).map((r) => jump('agent', agentRow(r, ctx, d, names)))],
    ['org', '조직', d.orgs.filter((o) => [o.name, o.spec.english].some((t) => t && t.toLowerCase().includes(q))).map((o) => jump('org', orgRow(o, ctx, d, names)))],
    ['base', '거점', d.bases.filter((b) => [b.name, b.label, b.english, b.org, b.gu, ...b.aliases].some((t) => t && t.toLowerCase().includes(q))).map((b) => jump('base', baseRow(b, ctx, d)))],
    ['appendix', '부록', d.appendices.filter((r) => [r.lore, r.parent].some((t) => t.toLowerCase().includes(q))).map((r) => jump('appendix', appendixRow(r, ctx, d)))],
  ];
  const hit = groups.filter(([, , rows]) => rows.length);
  if (!hit.length) return '<p class="gx-muted dir-empty">맞는 항목이 없어요.</p>';
  return hit.map(([, label, rows]) => `<h3 class="dir-group">${label}<small>${rows.length}</small></h3>${rows.join('')}`).join('');
}

export function directoryList(ctx: ChatContext): string {
  const d = draftOf(ctx);
  const q = dirUi.q.trim().toLowerCase();
  const names = namesOf(d, ctx.char.globalLore);
  if (q) return searchAll(ctx, d, q, names);
  if (dirUi.kind === 'base') return baseList(ctx, d, q);
  if (dirUi.kind === 'appendix') return appendixList(ctx, d, q);
  if (dirUi.kind === 'org') {
    const rows = d.orgs.filter((o) => !q || o.name.toLowerCase().includes(q));
    return `${rows.map((o) => orgRow(o, ctx, d, names)).join('') || '<p class="gx-muted dir-empty">맞는 조직이 없어요.</p>'}`;
  }
  if (dirUi.kind !== 'agent') {
    // 폴더 안 항목 → 다른 폴더에서 끌어온 후보(조직·개체 등, 원본 World catalog에서 온 것 포함) → 후보 추가
    const rows = (dirUi.kind === 'anomaly' ? d.anomalies : d.sites).filter((r) => matches(r, q));
    const src = loreSources(ctx.char.globalLore);
    const inside = rows.filter((r) => r.inFolder);
    const outside = rows.filter((r) => !r.inFolder);
    const folder = dirUi.kind === 'anomaly' ? '🚧괴이' : '🎁파밍';
    return `${inside.length ? `<h3 class="dir-group">${folder} 폴더<small>${inside.length}</small></h3>${inside.map((r) => placeRow(r, ctx)).join('')}` : ''}
      ${outside.length ? `<h3 class="dir-group">다른 폴더에서 온 후보<small>${outside.length}</small></h3><p class="gx-muted dir-group-help">조직·개체처럼 괴이 폴더 밖의 로어북이에요. 「발생 후보」로 두면 괴이처럼 발생해요.</p>${outside.map((r) => placeRow(r, ctx, src.get(r.lore))).join('')}` : ''}
      ${!rows.length ? '<p class="gx-muted dir-empty">맞는 항목이 없어요.</p>' : ''}`;
  }
  const rows = d.agents.filter((r) => matches(r, q));
  if (!rows.length) return '<p class="gx-muted dir-empty">맞는 사람이 없어요.</p>';
  // 조직별로 묶는다. 소속 미정이 맨 위
  const key = (a: AgentRow) => (a.affiliation ? orgName(d, names, a.affiliation) : '');
  const order = ['', ...d.orgs.map((o) => o.name)];
  const groups = [...new Set(rows.map(key))].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  return groups
    .map((g) => {
      const list = rows.filter((r) => key(r) === g);
      // 검색어가 없을 때만 순서를 바꿀 수 있다 (걸러진 목록에서 옮기면 사이에 숨은 사람이 헷갈린다)
      const body = list.map((r, i) => agentRow(r, ctx, d, names, q ? undefined : { first: i === 0, last: i === list.length - 1 })).join('');
      return `<h3 class="dir-group${g ? '' : ' warn'}">${esc(g || '소속 미정')}<small>${list.length}</small></h3>${body}`;
    })
    .join('');
}

/** 저장 결과 한 줄 (설정 위쪽 안내 자리) */
export const directoryDone = (): string => dirUi.done;
export const directoryDoneClear = (text: string): void => {
  if (dirUi.done === text) dirUi.done = '';
};


export const directorySearch = (): string =>
  `<input class="dir-search" type="search" data-input="dir-q" value="${esc(dirUi.q)}" placeholder="명부 전체 검색 (괴이·특수·요원·조직·거점·부록)" aria-label="명부 전체 검색" autocomplete="off">`;

/** 설정 위쪽 줄의 「덮어쓰기」「불러오기」 (설정·명부 공통, 누르면 확인) */
export const barButtons = (off: boolean): string =>
  `<button class="st-act save" data-action="set-bar" data-value="save" ${off ? 'disabled' : ''}>${ICONS.pen}덮어쓰기</button><button class="st-act" data-action="set-bar" data-value="load" ${off ? 'disabled' : ''}>${ICONS.refresh}불러오기</button>`;

export function directoryBar(): string {
  return barButtons(!dirty() || dirUi.busy);
}

export function directoryView(ctx: ChatContext): string {
  const d = draftOf(ctx);
  const kinds: [Kind, string, number][] = [
    ['anomaly', '괴이', d.anomalies.length],
    ['site', '특수', d.sites.length],
    ['agent', '요원', d.agents.length],
    ['org', '조직', d.orgs.length],
    ['base', '거점', d.bases.length],
    ['appendix', '부록', d.appendices.length],
  ];
  // 탭이 맨 위 (모바일은 고정), 사용법은 그 아래 접어 둔다
  return `<div class="dir">
    <div class="gx-segs dir-kinds">${kinds
      .map(([k, label, n]) => `<button class="gx-seg${dirUi.kind === k ? ' on' : ''}" data-action="dir-kind" data-value="${k}" aria-pressed="${dirUi.kind === k}">${label} <small>${n}</small></button>`)
      .join('')}</div>
    <div class="dir-tools">
      <div class="dir-qbox">${directorySearch()}</div>
      ${ADD_LABEL[dirUi.kind] ? `<button class="dir-tool${dirUi.adding ? ' on' : ''}" data-action="dir-add-toggle" aria-expanded="${dirUi.adding}">${ICONS.plus}<span>${ADD_LABEL[dirUi.kind]}</span></button>` : ''}
      <button class="dir-tool icon" data-action="dir-reload" aria-label="로어북 다시 읽기" title="로어북 다시 읽기">${ICONS.refresh}</button>
      <button class="dir-tool icon${dirUi.help ? ' on' : ''}" data-action="dir-help" aria-expanded="${dirUi.help}" aria-label="명부 사용법" title="명부 사용법">?</button>
    </div>
    ${dirUi.adding ? addPanel(ctx) : ''}
    ${dirUi.help ? `<div class="dir-help">
      <ul>
        <li>로어북 폴더 <code>🚧괴이</code> <code>🎁파밍</code> <code>🙂요원</code>에 넣은 항목이 각각 괴이·특수·요원 탭에 자동으로 들어와요.</li>
        <li>새 요원은 「요원」 탭에서 소속 조직을 골라 주세요.</li>
        <li>거점은 지도에 찍히는 장소예요. 「거점」 탭에서 추가하고 지도를 눌러 위치를 정해요.</li>
        <li>긴 로어북의 세부는 <code>📎부록</code> 폴더에 「본 항목 이름 · 설명」으로 따로 넣어요. 본 항목과 같은 자리에 들어가고, 켜지는 조건(키·위치·동행·해금)은 「부록」 탭에서 정해요.</li>
        <li>고친 값은 위의 「덮어쓰기」를 눌러야 카드에 남아요. 이 카드의 모든 채팅에 바로 적용되고, 카드를 공유하면 같이 가요.</li>
      </ul>
      ${d.folders ? '' : '<p class="gx-hint">이 카드에는 명부 폴더가 없어서 옛 목록(World catalog·Agent roster)을 보여 줘요.</p>'}
    </div>` : ''}
    ${dirUi.notice ? `<div class="gx-err" role="alert">${esc(dirUi.notice)}</div>` : ''}
    ${unassigned(d) ? `<button class="dir-alert" data-action="dir-kind" data-value="agent">소속을 정하지 않은 요원이 ${unassigned(d)}명 있어요</button>` : ''}
    <div class="dir-list">${directoryList(ctx)}</div>
  </div>`;
}

// 명부 위 한 줄 도구: 검색 · 추가 · 사용법 (요원은 로어북 폴더에서 들어오므로 추가 없음)
const ADD_LABEL: Record<Kind, string> = { anomaly: '후보 추가', site: '후보 추가', agent: '', org: '조직 추가', base: '거점 추가', appendix: '' };

/** 「추가」를 눌렀을 때만 펼치는 칸 */
function addPanel(ctx: ChatContext): string {
  if (dirUi.kind === 'org' || dirUi.kind === 'base') {
    const [name, act, hint] = dirUi.kind === 'org' ? ['dir-org-new', 'dir-org-add', '새 조직 이름'] : ['dir-base-new', 'dir-base-new', '새 거점 이름'];
    return `<div class="dir-ext"><div class="dir-add"><input name="${name}" placeholder="${hint}" aria-label="${hint}" autocomplete="off" data-enter="${act}">
      <button class="gx-mini" data-action="${act}" data-take="${name}">추가</button></div></div>`;
  }
  return `<div class="dir-ext"><input class="gx-search" data-input="dir-ext-q" value="${esc(dirUi.addQ)}" placeholder="다른 폴더의 로어북 이름·폴더 검색" aria-label="후보로 넣을 로어북 검색" autocomplete="off">
    <div class="dir-ext-list">${directoryExtList(ctx)}</div></div>`;
}

const unassigned = (d: Directory) => d.agents.filter((a) => !a.affiliation).length;

const splitList = (v: string) => v.split(',').map((t) => t.trim()).filter(Boolean);

/** 글자 입력: 다시 그리지 않고 초안만 고친다 (입력 포커스 유지). 저장 막대만 새로 그림 */
export function directoryInput(key: string, value: string, bar: Element | null): void {
  const d = dirUi.draft;
  if (!d) return;
  if (key.startsWith('base:')) {
    const at = key.indexOf('|');
    const field = key.slice(5, at);
    const b = d.bases.find((x) => x.name === key.slice(at + 1));
    if (!b) return;
    if (field === 'aliases') b.aliases = splitList(value);
    else if (field === 'label' || field === 'lore' || field === 'english') b[field] = value.trim();
    else return;
    dirUi.done = '';
    if (bar) bar.innerHTML = directoryBar();
    return;
  }
  if (key.startsWith('disp:') || key.startsWith('ptab:') || key.startsWith('seed:')) {
    const [kind, rest] = [key.slice(0, 4), key.slice(5)];
    if (kind === 'disp') {
      const [viewer, code] = rest.split('|');
      const m = (d.display[viewer] ??= {});
      if (value.trim()) m[code] = value.trim();
      else delete m[code];
    } else if (kind === 'ptab') {
      const t = d.phoneTabs.tabs.find((x) => x.id === rest);
      if (t) t.name = value.trim() || t.id;
    } else {
      const names = splitList(value);
      if (names.length) d.seeds[rest] = names;
      else delete d.seeds[rest];
    }
    dirUi.done = '';
    if (bar) bar.innerHTML = directoryBar();
    return;
  }
  if (key.startsWith('app:')) {
    const at = key.indexOf('|');
    const field = key.slice(4, at);
    const r = d.appendices.find((x) => x.lore === key.slice(at + 1));
    if (!r) return;
    if (field === 'parent') r.parent = value.trim();
    else if (field === 'places' || field === 'agents') r[field] = splitList(value);
    else if (field === 'unlock') r.unlock = value.trim();
    else return;
    dirUi.done = '';
    if (bar) bar.innerHTML = directoryBar();
    return;
  }
  if (key.startsWith('org:')) {
    const at = key.indexOf('|');
    const field = key.slice(4, at);
    const o = d.orgs.find((x) => x.name === key.slice(at + 1));
    if (!o) return;
    if (field === 'seed') o.spec.seed = splitList(value);
    else if (field === 'title' || field === 'blurb' || field === 'photo' || field === 'english' || field === 'gm_name' || field === 'gm_desc' || field === 'tab') o.spec[field] = value.trim();
    else return;
    dirUi.done = '';
    if (bar) bar.innerHTML = directoryBar();
    return;
  }
  const at = key.indexOf('|');
  const field = key.slice(0, at);
  const row = findRow(d, key.slice(at + 1)) as (PlaceRow & AgentRow) | undefined;
  if (!row) return;
  if (field === 'aliases') row.aliases = splitList(value);
  else if (field === 'label') row.label = value.trim() || row.lore;
  else if (field === 'english' || field === 'rank' || field === 'department' || field === 'affiliation') row[field] = value.trim();
  else return;
  dirUi.done = '';
  if (bar) bar.innerHTML = directoryBar();
}

/** 새 세력 켜고 끄기: 코드를 주고, 조직과 그 요원의 요원 목록 공개 대상·괴담톡 탭에 넣거나 뺀다 */
function setPlayable(d: Directory, o: OrgRow, on: boolean): void {
  if (on === !!o.spec.playable) return;
  if (on && !o.spec.code) {
    const code = nextCode([...d.usedCodes, ...d.orgs.map((x) => x.spec.code ?? '')]);
    if (!code) {
      dirUi.notice = '더 줄 수 있는 세력 코드가 없어요 (F00~Z00).';
      return;
    }
    o.spec.code = code;
    d.usedCodes = [...d.usedCodes, code];
  }
  const code = o.spec.code!;
  const tab = extraTabId(code);
  o.spec.playable = on;
  const edit = (xs: string[], x: string) => (on ? (xs.includes(x) ? xs : [...xs, x]) : xs.filter((y) => y !== x));
  o.rosterFor = edit(o.rosterFor, code);
  o.phoneTabs = edit(o.phoneTabs, tab);
  for (const a of d.agents) {
    if (a.affiliation !== orgAffiliation(o)) continue;
    a.rosterFor = edit(a.rosterFor, code);
    a.phoneTabs = edit(a.phoneTabs, tab);
  }
  dirUi.notice = '';
}

export async function handleDirectory(action: string, value: string | undefined, ctx: ChatContext, env: DirectoryEnv): Promise<boolean> {
  if (!action.startsWith('dir-')) return false;
  const v = value ?? '';
  const d = draftOf(ctx);
  mapEnv = env;
  const baseOf = (name: string) => d.bases.find((b) => b.name === name);
  switch (action) {
    case 'dir-kind':
      if (isKind(v)) {
        dirUi.kind = v;
        dirUi.open = '';
        dirUi.q = '';
        dirUi.adding = false;
      }
      break;
    case 'dir-open':
      dirUi.open = dirUi.open === v ? '' : v;
      break;
    case 'dir-move': {
      // up|로어 · down|로어 · before|로어|대상 · after|로어|대상
      const [how, lore, target] = v.split('|');
      if ((how === 'up' || how === 'down' || how === 'before' || how === 'after') && moveAgent(d, lore ?? '', how, target ?? '')) dirUi.done = '';
      break;
    }
    case 'dir-jump': {
      // 통합 검색 결과: 그 탭으로 가서 펼친다
      const cut = v.indexOf('|');
      const kind = v.slice(0, cut);
      if (isKind(kind)) {
        Object.assign(dirUi, { kind, open: v.slice(cut + 1), q: '', adding: false });
        dirUi.scrollTo = v.slice(cut + 1);
      }
      break;
    }
    case 'dir-set':
    case 'dir-toggle': {
      const [field, arg] = v.split('|', 2);
      const row = findRow(d, v.slice(field.length + arg.length + 2)) as (PlaceRow & AgentRow) | undefined;
      if (!row) break;
      if (field === 'preset') row.preset = arg === '1';
      else if (field === 'affiliation') row.affiliation = arg;
      else if (field === 'rosterFor' || field === 'phoneTabs') {
        const cur = row[field];
        row[field] = cur.includes(arg) ? cur.filter((x) => x !== arg) : [...cur, arg];
      }
      dirUi.done = '';
      break;
    }
    case 'dir-app-toggle': {
      const at = v.indexOf('|');
      const field = v.slice(0, at);
      const r = d.appendices.find((x) => x.lore === v.slice(at + 1));
      if (!r || (field !== 'keys' && field !== 'withParent' && field !== 'needParent' && field !== 'target')) break;
      r[field] = !r[field];
      dirUi.done = '';
      break;
    }
    case 'dir-app-place': {
      const at = v.lastIndexOf('|');
      const r = d.appendices.find((x) => x.lore === v.slice(at + 1));
      const name = v.slice(0, at);
      if (!r || !name || r.places.includes(name)) break;
      r.places = [...r.places, name];
      dirUi.done = '';
      break;
    }
    case 'dir-app-unlock': {
      // 해금은 채팅마다라 명부가 아니라 지금 채팅에 바로 적는다
      if (!d.appendices.some((x) => x.lore === v)) break;
      try {
        await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
          const cur = readUnlocked(chat.scriptstate);
          const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
          return { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), [UNLOCK_VAR]: unlockedValue(next) } };
        });
        dirUi.done = '이 채팅의 해금 상태를 바꿨어요';
      } catch (error) {
        dirUi.notice = `해금 상태를 바꾸지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      await env.refresh();
      return true;
    }
    case 'dir-org-pick': {
      const at = v.indexOf('|');
      const row = d.agents.find((a) => a.lore === v.slice(at + 1));
      if (!row) break;
      assignOrg(row, d.orgs.find((o) => o.name === v.slice(0, at)));
      dirUi.done = '';
      break;
    }
    case 'dir-gender': {
      const at = v.indexOf('|');
      const row = d.agents.find((a) => a.lore === v.slice(at + 1));
      const g = v.slice(0, at);
      if (!row || (g !== 'F' && g !== 'M' && g !== 'X')) break;
      // 로어북 성별 줄과 같으면 따로 적지 않는다 (로어북을 고치면 따라가게)
      if (g === loreGender(ctx.char.globalLore ?? [], row.lore) || (g === 'X' && !loreGender(ctx.char.globalLore ?? [], row.lore))) delete row.gender;
      else row.gender = g;
      dirUi.done = '';
      break;
    }
    case 'dir-org-toggle': {
      const [field, arg] = v.split('|', 2);
      const o = d.orgs.find((x) => x.name === v.slice(field.length + arg.length + 2));
      if (!o || (field !== 'rosterFor' && field !== 'phoneTabs')) break;
      o[field] = o[field].includes(arg) ? o[field].filter((x) => x !== arg) : [...o[field], arg];
      for (const a of d.agents) if (a.affiliation === orgAffiliation(o)) a[field] = [...o[field]];
      dirUi.done = '';
      break;
    }
    case 'dir-org-add': {
      const name = v.trim();
      dirUi.kind = 'org';
      if (!name) break;
      if (d.orgs.some((o) => o.name === name || o.faction === name)) {
        dirUi.notice = `「${name}」 조직이 이미 있어요.`;
        break;
      }
      d.orgs.push({ name, faction: '', rosterFor: ['D00', 'E00'], phoneTabs: [], spec: {} });
      dirUi.open = name;
      dirUi.adding = false;
      dirUi.notice = '';
      dirUi.done = '';
      break;
    }
    case 'dir-org-rename': {
      const o = d.orgs.find((x) => x.name === dirUi.open && !x.faction);
      const name = v.trim();
      if (!o || !name || name === o.name) break;
      if (d.orgs.some((x) => x.name === name || x.faction === name)) {
        dirUi.notice = `「${name}」 조직이 이미 있어요.`;
        break;
      }
      for (const a of d.agents) if (a.affiliation === o.name) a.affiliation = name;
      for (const b of d.bases) if (b.org === o.name) b.org = name;
      o.name = name;
      dirUi.open = name;
      dirUi.notice = '';
      dirUi.done = '';
      break;
    }
    case 'dir-org-del': {
      const o = d.orgs.find((x) => x.name === v && !x.faction);
      if (!o || d.agents.some((a) => a.affiliation === o.name)) break;
      d.orgs = d.orgs.filter((x) => x !== o);
      for (const b of d.bases) if (b.org === o.name) b.org = '';
      dirUi.open = '';
      dirUi.done = '';
      break;
    }
    case 'dir-base-goto':
      if (!baseOf(v)) break;
      dirUi.kind = 'base';
      dirUi.open = v;
      dirUi.q = '';
      break;
    case 'dir-base-new': {
      // 거점 탭에서는 적은 이름으로, 조직 칸에서는 그 조직 거점으로 만든다
      const org = dirUi.kind === 'org' ? d.orgs.find((o) => o.name === v) : undefined;
      const want = org ? `${org.name} 거점` : v.trim();
      if (!want) break;
      if (!org && baseOf(want)) {
        dirUi.notice = `「${want}」 거점이 이미 있어요.`;
        break;
      }
      const name = freeBaseName(d, want);
      const near = d.bases.find((b) => b.org && b.org === org?.name) ?? d.bases[0];
      const sido = near?.sido && REGIONS.includes(near.sido) ? near.sido : '02';
      d.bases.push({ name, label: '', lore: org ? org.name : '', english: '', aliases: [], org: org?.name ?? '', sido, gu: '', x: 50, y: 50, show: true });
      dirUi.kind = 'base';
      dirUi.open = name;
      dirUi.q = '';
      dirUi.adding = false;
      dirUi.notice = '';
      dirUi.done = '';
      break;
    }
    case 'dir-base-show':
    case 'dir-base-org': {
      const at = v.indexOf('|');
      const b = baseOf(v.slice(at + 1));
      if (!b) break;
      if (action === 'dir-base-show') b.show = v.slice(0, at) === '1';
      else b.org = d.orgs.some((o) => o.name === v.slice(0, at)) ? v.slice(0, at) : '';
      dirUi.done = '';
      break;
    }
    case 'dir-base-sido':
    case 'dir-base-gu': {
      const at = v.lastIndexOf('=');
      const b = baseOf(v.slice(0, at));
      const val = v.slice(at + 1);
      if (!b) break;
      if (action === 'dir-base-sido' && REGIONS.includes(val) && val !== b.sido) {
        b.sido = val;
        b.gu = '';
        b.x = 50;
        b.y = 50;
      } else if (action === 'dir-base-gu' && (!val || SIGUN[b.sido]?.includes(val))) b.gu = val;
      dirUi.done = '';
      break;
    }
    case 'dir-base-xy': {
      const [x, y, ...rest] = v.split('|');
      const b = baseOf(rest.join('|'));
      if (!b) break;
      b.x = Math.round(Math.min(100, Math.max(0, Number(x))) * 10) / 10;
      b.y = Math.round(Math.min(100, Math.max(0, Number(y))) * 10) / 10;
      dirUi.done = '';
      break;
    }
    case 'dir-base-rename': {
      const b = baseOf(dirUi.open);
      const name = v.trim();
      if (!b || !name || name === b.name) break;
      if (baseOf(name)) {
        dirUi.notice = `「${name}」 거점이 이미 있어요.`;
        break;
      }
      b.name = name;
      dirUi.open = name;
      dirUi.notice = '';
      dirUi.done = '';
      break;
    }
    case 'dir-base-del':
      d.bases = d.bases.filter((b) => b.name !== v);
      dirUi.open = '';
      dirUi.done = '';
      break;
    case 'dir-fac-play':
    case 'dir-fac-hide':
    case 'dir-fac-type': {
      const at = v.indexOf('|');
      const arg = v.slice(0, at);
      const o = d.orgs.find((x) => x.name === v.slice(at + 1));
      if (!o) break;
      if (action === 'dir-fac-hide') o.spec.hidden = arg === '0';
      else if (action === 'dir-fac-type') o.spec.type = arg as (typeof FACTION_TYPES)[number]['id'];
      else if (!o.faction) setPlayable(d, o, arg === '1');
      dirUi.done = '';
      break;
    }
    case 'dir-fac-patch': {
      dirUi.busy = true;
      env.render();
      try {
        let missing: string[] = [];
        await updateCharacterLore(ctx.charIndex, (lore) => {
          const r = withFactionPlaceholders(lore);
          missing = r.missing;
          return r.changed ? r.lore : null;
        });
        dirUi.notice = missing.length ? `로어북에서 자리를 못 찾은 부분이 있어요: ${missing.join(', ')}` : '';
        dirUi.done = missing.length ? '' : '🏷️Tag·📜Faction 로어북에 새 세력 자리를 넣었어요';
      } catch (error) {
        dirUi.notice = `로어북을 고치지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      dirUi.busy = false;
      await env.refresh();
      return true;
    }
    case 'dir-ext-open':
      dirUi.adding = true;
      dirUi.addQ = '';
      break;
    case 'dir-add-toggle':
      dirUi.adding = !dirUi.adding;
      dirUi.addQ = '';
      break;
    case 'dir-help':
      dirUi.help = !dirUi.help;
      break;
    case 'dir-photo-pick':
      dirUi.pick = dirUi.pick === v ? '' : v;
      dirUi.pickQ = '';
      break;
    case 'dir-photo-set': {
      const at = v.indexOf('|');
      const { slot, key } = pickOf(v.slice(at + 1));
      const p = picOf(d, key);
      if (!p) break;
      p.set(slot, at > 0 ? v.slice(0, at) : '');
      dirUi.pick = '';
      dirUi.done = '';
      break;
    }
    case 'dir-crop':
      dirUi.crop = dirUi.crop === v ? '' : v;
      dirUi.pick = '';
      break;
    case 'dir-crop-reset':
      picOf(d, v)?.set('crop', '');
      dirUi.done = '';
      break;
    case 'dir-ext-close':
      dirUi.adding = false;
      break;
    case 'dir-ext-add': {
      const rows = dirUi.kind === 'anomaly' ? d.anomalies : dirUi.kind === 'site' ? d.sites : null;
      if (!rows || !v || rows.some((r) => r.lore === v) || !loreSources(ctx.char.globalLore).has(v)) break;
      rows.push({ lore: v, label: v, english: '', aliases: [], preset: true, inFolder: false });
      dirUi.open = v;
      dirUi.adding = false;
      dirUi.done = '';
      break;
    }
    case 'dir-ext-del': {
      const rows = dirUi.kind === 'anomaly' ? d.anomalies : dirUi.kind === 'site' ? d.sites : null;
      const i = rows ? rows.findIndex((r) => r.lore === v && !r.inFolder) : -1;
      if (!rows || i < 0) break;
      rows.splice(i, 1);
      dirUi.open = '';
      dirUi.done = '';
      break;
    }
    case 'dir-reset':
      dirUi.draft = null;
      dirUi.notice = '';
      break;
    case 'dir-reload':
      // 리수를 새로고침하지 않아도 로어북에 새로 넣은 항목을 읽는다 (고친 값은 그대로)
      await env.refresh();
      dirUi.done = '로어북을 다시 읽었어요.';
      env.render();
      return true;
    case 'dir-save': {
      if (!dirty() || dirUi.busy) return true;
      dirUi.busy = true;
      dirUi.notice = '';
      env.render();
      try {
        const data = directoryData(d);
        let saved: ChatContext['char']['globalLore'] = undefined;
        // 거점·호칭·괴담톡 탭·첫 턴 로어북이 명부로 옮겨졌으니 옛 데이터 로어북은 뺀다
        await updateCharacterLore(ctx.charIndex, (lore) => (saved = withDirectory(lore, data).filter((e) => !d.folders || !LEGACY_DATA.includes(String(e.comment ?? '')))));
        dirUi.draft = null;
        dirUi.done = '카드 로어북에 저장했어요';
        // 지금 채팅의 새 세력 변수(태그·세력 로어북 자리표시자)를 바로 맞춘다. 다른 채팅은 다음 응답 때 맞춰진다
        if (saved && (ctx.chat.message ?? []).length) {
          const lore = saved;
          await updateChat(ctx.charIndex, ctx.chatIndex, (chat) => {
            const vars = staleFactionVars(lore, chat.scriptstate);
            return vars ? { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...vars } } : null;
          }).catch(() => null);
        }
      } catch (error) {
        dirUi.notice = `저장하지 못했어요: ${error instanceof Error ? error.message : String(error)}`;
      }
      dirUi.busy = false;
      await env.refresh();
      return true;
    }
    default:
      return false;
  }
  env.render();
  return true;
}
