// 설정 → 「카드 명부」: 로어북 폴더에서 모은 괴이·미스틱 사이트·요원의 세부값 편집.
// 고친 값은 카드 로어북 「Directory」에 저장되어 카드와 함께 공유되고, 이 카드의 모든 채팅에 바로 적용된다.
import {
  assignOrg, directoryData, type Directory, factionDisplayNames, orgAffiliation, orgOf, type OrgRow, phoneTabs, readDirectory, type AgentRow,
  type BaseRow, type PlaceRow, withDirectory,
} from '../core/world/directory';
import { MAP_CODES, regionName, SIDO_NAME, SIGUN } from '../core/world/geo';
import { assetUrl } from '../host/assets';
import { LEGACY_DATA } from '../core/lorebooks';
import { SCENARIOS } from '../core/scenarios';
import { BUILTIN, extraTabId, FACTION_TYPES, nextCode, placeholdersReady, staleFactionVars, withFactionPlaceholders } from '../core/factions';
import { updateCharacterLore, updateChat, type ChatContext } from '../host/risu';
import { avatar } from './images';
import { ICONS } from './icons';

export interface DirectoryEnv {
  render: () => void;
  refresh: () => Promise<void>;
}

type Kind = 'anomaly' | 'site' | 'agent' | 'org' | 'base';

export const dirUi = {
  kind: 'anomaly' as Kind,
  q: '',
  open: '',
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
};

export function resetDirectory(): void {
  Object.assign(dirUi, { kind: 'anomaly', q: '', open: '', draft: null, base: '', from: null, busy: false, notice: '', done: '', adding: false, addQ: '' });
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
    .filter(([name, src]) => src && !have.has(name) && !/설정/.test(src) && src.replace(/[^\p{L}\p{N}]/gu, '') !== own && (!q || name.toLowerCase().includes(q) || src.toLowerCase().includes(q)))
    .slice(0, 60);
  if (!list.length) return '<p class="gx-muted dir-empty">고를 수 있는 로어북이 없어요.</p>';
  return list
    .map(([name, src]) => `<button class="dir-ext-item" data-action="dir-ext-add" data-value="${esc(name)}"><b>${esc(name)}</b><small>${esc(src)}</small><span>＋ 후보로</span></button>`)
    .join('');
}

function placePanel(p: PlaceRow): string {
  const k = (f: string) => `${f}|${p.lore}`;
  return `<div class="dir-panel">
    <div class="dir-line"><span>무작위 발생 후보</span><div class="gx-segs gx-segs-sm">
      <button class="gx-seg${p.preset ? ' on' : ''}" data-action="dir-set" data-value="${esc(`preset|1|${p.lore}`)}">ON</button>
      <button class="gx-seg${!p.preset ? ' on' : ''}" data-action="dir-set" data-value="${esc(`preset|0|${p.lore}`)}">OFF</button></div></div>
    <p class="gx-muted">OFF여도 직접 고르거나 대화에 나오면 상황판에 기록돼요.</p>
    ${input(k('label'), p.label, '표시 이름', '상황판과 지도에 보이는 이름')}
    ${input(k('english'), p.english, '영문명', '영어 응답에서도 이 이름을 알아봐요')}
    ${input(k('aliases'), p.aliases.join(', '), '별칭', '쉼표로 나눠 적어요')}
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
    <div class="dir-line"><span>요원 목록에 보일 세력</span><div class="dir-chips">${codesOf(d).map((f) => chip('dir-toggle', `rosterFor|${f}|${a.lore}`, names[f], a.rosterFor.includes(f))).join('')}</div></div>
    <div class="dir-line"><span>괴담톡 연락처 탭</span><div class="dir-chips">${tabs.map((t) => chip('dir-toggle', `phoneTabs|${t.id}|${a.lore}`, t.name || t.id, a.phoneTabs.includes(t.id))).join('')}</div></div>
    <div class="dir-grid">
      ${input(k('rank'), a.rank, '직급')}
      ${input(k('department'), a.department, '부서')}
    </div>
    ${input(k('english'), a.english, '영문명', '사진 에셋 이름과 같아야 사진이 나와요')}
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
    ${area(k('blurb'), o.spec.blurb ?? '', '시작 화면 설명')}
    ${input(k('photo'), o.spec.photo ?? '', '사진 에셋 이름', o.faction ? '비우면 원래 사진(f01~f05)' : '카드 에셋 이름. 비우면 사진 없이')}`;
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

const baseWhere = (b: BaseRow) => [SIDO_NAME[b.sido] ?? '', b.gu].filter(Boolean).join(' ') || '위치 미정';

function basePanel(b: BaseRow, ctx: ChatContext, d: Directory): string {
  const k = (f: string) => `base:${f}|${b.name}`;
  const url = baseMap(ctx, b.sido, mapEnv);
  const sido = REGIONS.map((c) => `<option value="${c}"${c === b.sido ? ' selected' : ''}>${esc(regionName(c))}</option>`).join('');
  const gus = (SIGUN[b.sido] ?? []).map((g) => `<option value="${esc(g)}"${g === b.gu ? ' selected' : ''}>${esc(g)}</option>`).join('');
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
  return `<div class="dir-add"><input name="dir-base-new" placeholder="새 거점 이름" aria-label="새 거점 이름" autocomplete="off" data-enter="dir-base-new">
      <button class="gx-mini" data-action="dir-base-new" data-take="dir-base-new">거점 추가</button></div>
    ${sorted.length ? sorted.map((b) => baseRow(b, ctx, d)).join('') : '<p class="gx-muted dir-empty">맞는 거점이 없어요.</p>'}`;
}

/** 새 거점 이름: 겹치면 뒤에 번호 */
function freeBaseName(d: Directory, want: string): string {
  let name = want;
  for (let i = 2; d.bases.some((b) => b.name === name); i++) name = `${want} ${i}`;
  return name;
}

function placeRow(p: PlaceRow, src = ''): string {
  const open = dirUi.open === p.lore;
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(p.lore)}" aria-expanded="${open}">
      <span class="dir-name"><b>${esc(p.label)}</b><small>${esc(p.english || '영문명 없음')}</small></span>
      ${p.inFolder ? '' : `<span class="gx-badge wait">${esc(src || '폴더 밖')}</span>`}
      <span class="gx-badge${p.preset ? ' live' : ''}">${p.preset ? '발생 후보' : '숨김'}</span>
    </button>${open ? placePanel(p) : ''}</div>`;
}

function agentRow(a: AgentRow, ctx: ChatContext, d: Directory, names: Record<string, string>): string {
  const open = dirUi.open === a.lore;
  const sub = [a.affiliation ? orgName(d, names, a.affiliation) : '', a.rank, a.department].filter(Boolean).join(' · ');
  return `<div class="dir-row${open ? ' open' : ''}">
    <button class="dir-head" data-action="dir-open" data-value="${esc(a.lore)}" aria-expanded="${open}">
      ${avatar(ctx.char, a.english, a.name)}
      <span class="dir-name"><b>${esc(a.name)}</b><small>${esc(sub || '소속 미정')}</small></span>
      ${!a.affiliation ? '<span class="gx-badge hot">소속 미정</span>' : a.rosterFor.length ? '' : '<span class="gx-badge">목록 숨김</span>'}
    </button>${open ? agentPanel(a, ctx, d) : ''}</div>`;
}

export function directoryList(ctx: ChatContext): string {
  const d = draftOf(ctx);
  const q = dirUi.q.trim().toLowerCase();
  const names = namesOf(d, ctx.char.globalLore);
  if (dirUi.kind === 'base') return baseList(ctx, d, q);
  if (dirUi.kind === 'org') {
    const rows = d.orgs.filter((o) => !q || o.name.toLowerCase().includes(q));
    return `<div class="dir-add"><input name="dir-org-new" placeholder="새 조직 이름" aria-label="새 조직 이름" autocomplete="off" data-enter="dir-org-add">
      <button class="gx-mini" data-action="dir-org-add" data-take="dir-org-new">조직 추가</button></div>
      ${rows.map((o) => orgRow(o, ctx, d, names)).join('') || '<p class="gx-muted dir-empty">맞는 조직이 없어요.</p>'}`;
  }
  if (dirUi.kind !== 'agent') {
    // 폴더 안 항목 → 다른 폴더에서 끌어온 후보(조직·개체 등, 원본 World catalog에서 온 것 포함) → 후보 추가
    const rows = (dirUi.kind === 'anomaly' ? d.anomalies : d.sites).filter((r) => matches(r, q));
    const src = loreSources(ctx.char.globalLore);
    const inside = rows.filter((r) => r.inFolder);
    const outside = rows.filter((r) => !r.inFolder);
    const folder = dirUi.kind === 'anomaly' ? '🚧괴이' : '🎁파밍';
    const add = dirUi.adding
      ? `<div class="dir-ext"><div class="dir-ext-head"><input class="gx-search" data-input="dir-ext-q" value="${esc(dirUi.addQ)}" placeholder="로어북 이름·폴더 검색" aria-label="후보로 넣을 로어북 검색" autocomplete="off"><button class="gx-mini" data-action="dir-ext-close">닫기</button></div>
          <div class="dir-ext-list">${directoryExtList(ctx)}</div></div>`
      : `<button class="dir-ext-open" data-action="dir-ext-open">＋ 다른 폴더에서 후보 추가</button>`;
    return `${inside.length ? `<h3 class="dir-group">${folder} 폴더<small>${inside.length}</small></h3>${inside.map((r) => placeRow(r)).join('')}` : ''}
      ${outside.length ? `<h3 class="dir-group">다른 폴더에서 온 후보<small>${outside.length}</small></h3><p class="gx-muted dir-group-help">조직·개체처럼 괴이 폴더 밖의 로어북이에요. 「발생 후보」로 두면 괴이처럼 발생해요.</p>${outside.map((r) => placeRow(r, src.get(r.lore))).join('')}` : ''}
      ${!rows.length ? '<p class="gx-muted dir-empty">맞는 항목이 없어요.</p>' : ''}${q ? '' : add}`;
  }
  const rows = d.agents.filter((r) => matches(r, q));
  if (!rows.length) return '<p class="gx-muted dir-empty">맞는 사람이 없어요.</p>';
  // 조직별로 묶는다. 소속 미정이 맨 위
  const key = (a: AgentRow) => (a.affiliation ? orgName(d, names, a.affiliation) : '');
  const order = ['', ...d.orgs.map((o) => o.name)];
  const groups = [...new Set(rows.map(key))].sort((x, y) => order.indexOf(x) - order.indexOf(y));
  return groups
    .map((g) => `<h3 class="dir-group${g ? '' : ' warn'}">${esc(g || '소속 미정')}<small>${rows.filter((r) => key(r) === g).length}</small></h3>${rows.filter((r) => key(r) === g).map((r) => agentRow(r, ctx, d, names)).join('')}`)
    .join('');
}

/** 저장 결과 한 줄 (설정 위쪽 안내 자리) */
export const directoryDone = (): string => dirUi.done;
export const directoryDoneClear = (text: string): void => {
  if (dirUi.done === text) dirUi.done = '';
};

const SEARCH_HINT: Record<Kind, string> = { anomaly: '이름·영문명 검색', site: '이름·영문명 검색', agent: '이름·영문명·부서 검색', org: '조직 이름 검색', base: '이름·조직·지역 검색' };

export const directorySearch = (): string =>
  `<input class="dir-search" type="search" data-input="dir-q" value="${esc(dirUi.q)}" placeholder="${SEARCH_HINT[dirUi.kind]}" aria-label="명부 검색" autocomplete="off">`;

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
  ];
  // 탭이 맨 위 (모바일은 고정), 사용법은 그 아래 접어 둔다
  return `<div class="dir">
    <div class="gx-segs dir-kinds">${kinds
      .map(([k, label, n]) => `<button class="gx-seg${dirUi.kind === k ? ' on' : ''}" data-action="dir-kind" data-value="${k}" aria-pressed="${dirUi.kind === k}">${label} <small>${n}</small></button>`)
      .join('')}</div>
    <details class="dir-help">
      <summary>명부 사용법</summary>
      <ul>
        <li>로어북 폴더 <code>🚧괴이</code> <code>🎁파밍</code> <code>🙂요원</code>에 넣은 항목이 각각 괴이·특수·요원 탭에 자동으로 들어와요.</li>
        <li>새 요원은 「요원」 탭에서 소속 조직을 골라 주세요.</li>
        <li>거점은 지도에 찍히는 장소예요. 「거점」 탭에서 추가하고 지도를 눌러 위치를 정해요.</li>
        <li>고친 값은 위의 「덮어쓰기」를 눌러야 카드에 남아요. 이 카드의 모든 채팅에 바로 적용되고, 카드를 공유하면 같이 가요.</li>
      </ul>
      ${d.folders ? '' : '<p class="gx-hint">이 카드에는 명부 폴더가 없어서 옛 목록(World catalog·Agent roster)을 보여 줘요.</p>'}
    </details>
    ${dirUi.notice ? `<div class="gx-err" role="alert">${esc(dirUi.notice)}</div>` : ''}
    ${unassigned(d) ? `<button class="dir-alert" data-action="dir-kind" data-value="agent">소속을 정하지 않은 요원이 ${unassigned(d)}명 있어요</button>` : ''}
    <div class="dir-qbox">${directorySearch()}</div>
    <div class="dir-list">${directoryList(ctx)}</div>
  </div>`;
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
  if (key.startsWith('org:')) {
    const at = key.indexOf('|');
    const field = key.slice(4, at);
    const o = d.orgs.find((x) => x.name === key.slice(at + 1));
    if (!o) return;
    if (field === 'seed') o.spec.seed = splitList(value);
    else if (field === 'title' || field === 'blurb' || field === 'photo' || field === 'gm_name' || field === 'gm_desc' || field === 'tab') o.spec[field] = value.trim();
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
      if (v === 'anomaly' || v === 'site' || v === 'agent' || v === 'org' || v === 'base') {
        dirUi.kind = v;
        dirUi.open = '';
        dirUi.q = '';
        dirUi.adding = false;
      }
      break;
    case 'dir-open':
      dirUi.open = dirUi.open === v ? '' : v;
      break;
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
    case 'dir-org-pick': {
      const at = v.indexOf('|');
      const row = d.agents.find((a) => a.lore === v.slice(at + 1));
      if (!row) break;
      assignOrg(row, d.orgs.find((o) => o.name === v.slice(0, at)));
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
      d.bases.push({ name, label: '', lore: org ? org.name : '', english: '', aliases: [], org: org?.name ?? '', sido, gu: SIGUN[sido]?.[0] ?? '', x: 50, y: 50, show: true });
      dirUi.kind = 'base';
      dirUi.open = name;
      dirUi.q = '';
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
        b.gu = SIGUN[val]?.[0] ?? '';
        b.x = 50;
        b.y = 50;
      } else if (action === 'dir-base-gu' && SIGUN[b.sido]?.includes(val)) b.gu = val;
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
