// 「지도」·「커스텀 임무」 탭: 목표를 고르고, 요원·지원 인원을 편성해 채팅에 이동 지시문 카드를 놓는다.
// 원본 Lua의 지도 작업 공간(WG.map)과 커스텀 임무 창(preparePreset/commitPreset)을 옮겼다.
import {
  destination, DirectiveError, hasSceneCard, parseDirective, sceneDirective, sceneRecord, TEAM_MAX, validTeam,
} from '../core/dispatch';
import type { Chat } from '../core/types';
import { basicSettings, worldSettings } from '../core/settings';
import {
  activeEvents, agentLocked, cancelMission, type Catalog, endEvent, type EventKind, locName, MAP_CODES,
  type MissionKind, NATION_PINS, parseCatalog, readWorld, REGION_PINS, regionName, requestMission, rosterFor, SEALED_LOC, SIDO_NAME,
  SIGUN, type WorldEvent, worldOn, worldVars, type WorldSettings, type WorldState, codesToNames, landmarkLoc,
} from '../core/world';
import { assetUrl } from '../host/assets';
import { updateChat, type CharacterSnapshot, type ChatContext } from '../host/risu';
import { SEND_FALLBACK, sendNow } from '../host/send';
import { ICONS } from './icons';
import { elapsedText, evCard, peopleChips } from './evcard';
import { agentInner, stLabel } from './images';
import { agentContact } from './phone';
import { mapZoomControls } from './mapzoom';
import { drawerBox } from './drawer';

export type Target =
  | { type: 'event'; key: string; kind: EventKind; name: string; loc: string }
  | { type: 'place'; loc: string }
  | { type: 'facility'; name: string };

type Filter = 'all' | EventKind;

interface FieldState {
  region: string;
  filter: Filter;
  /** 목록을 한 장소로 좁힘: loc 또는 "fac:시설 이름" */
  place: string | null;
  target: Target | null;
  team: string[];
  support: number;
  mkind: MissionKind;
  mname: string | null;
  /** mname을 고른 종류 (위 종류 버튼을 바꿔도 고른 목표는 그대로) */
  mpick: MissionKind;
  /** 지시문 뒤에 붙여 함께 보낼 말 */
  note: string;
  /** 모바일: 목표 고르기와 편성을 한 화면씩 (PC는 두 칸이라 상관없음) */
  step: 'goal' | 'team';
  query: string;
  /** 임무 탭 지도 장소 검색 */
  mapq: string;
  /** 두 번 눌러 확인하는 상황 종료 */
  confirmEnd: string | null;
}

export const field: FieldState = {
  region: '01', filter: 'all', place: null, target: null, team: [], support: 0,
  mkind: 'an', mname: null, mpick: 'an', note: '', step: 'goal', query: '', mapq: '', confirmEnd: null,
};

export interface FieldEnv {
  render(): void;
  refresh(): Promise<void>;
  close(): Promise<void>;
  setNotice(text: string): void;
  setBusy(on: boolean): void;
}

const mapUrls: Record<string, string | null | 'loading'> = {};

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const KIND_LABEL: Record<EventKind, string> = { an: '괴이', in: '사건', ms: '특수' };
const MISSION_LABEL: Record<MissionKind, string> = { an: '괴이', ms: '특수', lm: '거점' };

/** 탭을 바꾸거나 새 채팅을 열 때 고른 것을 비운다 */
export function resetField(all = false) {
  field.target = null;
  field.team = [];
  field.support = 0;
  field.mname = null;
  field.note = '';
  field.step = 'goal';
  field.confirmEnd = null;
  field.place = null;
  if (all) {
    field.region = '01';
    field.filter = 'all';
    field.query = '';
    field.mkind = 'an';
  }
}

interface Ctx {
  catalog: Catalog;
  world: WorldState;
  faction: string;
  on: boolean;
  settings: WorldSettings;
  /** 설정 탭의 지원 투입 */
  supportOn: boolean;
  char: CharacterSnapshot;
}

function ctxOf(ctx: ChatContext, chat: Chat): Ctx {
  const lore = ctx.char.globalLore;
  return {
    catalog: parseCatalog(lore),
    world: readWorld(chat),
    faction: String(chat.scriptstate?.['$st_faction'] ?? ''),
    on: worldOn(chat),
    settings: worldSettings(lore, chat.scriptstate),
    supportOn: basicSettings(lore, chat.scriptstate).supportOn,
    char: ctx.char,
  };
}

function readCtx(ctx: ChatContext): Ctx | string {
  try {
    return ctxOf(ctx, ctx.chat);
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

// ── 장소 ──

function sidoOf(loc: string): string {
  return loc.split('-')[0];
}

/** 사건이 랜드마크에서 났으면 그 시설 자리, 아니면 시군구 자리 */
function placeKey(ev: WorldEvent, c: Catalog): string {
  if (ev.kind === 'in') {
    const lm = c.landmarks.find((l) => l.name === ev.name && landmarkLoc(l.sido, l.gu) === ev.loc);
    if (lm) return `fac:${lm.name}`;
  }
  return ev.loc;
}

function placeName(key: string, c: Catalog): string {
  if (key.startsWith('fac:')) {
    const lm = c.landmarks.find((l) => l.name === key.slice(4));
    return lm ? `${lm.name} · ${lm.gu}` : key.slice(4);
  }
  return locName(key);
}

function placeTarget(key: string): Target {
  return key.startsWith('fac:') ? { type: 'facility', name: key.slice(4) } : { type: 'place', loc: key };
}

function targetName(t: Target): string {
  if (t.type === 'event') return t.name;
  if (t.type === 'facility') return t.name;
  return locName(t.loc);
}

/** PC에서는 고른 것을 한 번 더 누르면 풀린다 (모바일은 누르면 편성으로 넘어가서 취소 칩으로 푼다) */
const isPC = () => !matchMedia('(max-width: 760px)').matches;

function sameTarget(a: Target | null, key: string): boolean {
  if (!a) return false;
  if (a.type === 'event') return a.key === key;
  return (a.type === 'facility' ? `fac:${a.name}` : a.loc) === key;
}

// ── 지도 ──

function mapImage(ctx: ChatContext, code: string, env: FieldEnv): string | null {
  const hit = mapUrls[code];
  if (hit === undefined) {
    mapUrls[code] = 'loading';
    void assetUrl(ctx.char, `map${code}`).then((url) => {
      mapUrls[code] = url;
      env.render();
    });
    return null;
  }
  return hit === 'loading' ? null : hit;
}

function pin(action: string, value: string, label: string, x: number, y: number, cls: string, count = 0): string {
  return `<button class="gx-pin ${cls}" style="left:${x}%;top:${y}%" data-action="${action}" data-value="${esc(value)}" aria-label="${esc(label)}">
    <span class="gx-dot"></span><span class="gx-pname">${esc(label)}${count ? `<b>${count}</b>` : ''}</span></button>`;
}

function hotClass(list: WorldEvent[]): string {
  if (!list.length) return '';
  const kinds = new Set(list.map((e) => e.kind));
  return ` hot hot-${kinds.size === 1 ? [...kinds][0] : 'all'}`;
}

const narrow = () => matchMedia('(max-width: 760px)').matches;

/** 지역 고르기·장소 검색 줄 (PC는 지도 위, 모바일은 하단 서랍) */
function mapBar(x: Ctx): string {
  const code = field.region;
  const options = ['01', ...MAP_CODES]
    .map((c) => `<option value="${c}"${c === code ? ' selected' : ''}>${c === '01' ? '전국' : esc(regionName(c))}</option>`)
    .join('');
  const bar = `<div class="gx-mapbar">
      <select class="gx-select" data-change="map-region" aria-label="지역">${options}</select>
      <div class="gx-mapfind"><input class="gx-search" type="search" placeholder="장소 검색" value="${esc(field.mapq)}" data-input="map-query" aria-label="장소 검색" autocomplete="off">
        <div class="gx-mapsug">${mapSuggest(x.catalog)}</div></div>
    </div>`;
  return bar;
}

function mapCanvas(ctx: ChatContext, x: Ctx, events: WorldEvent[], env: FieldEnv): string {
  const code = field.region;
  const url = mapImage(ctx, code, env);
  const byPlace = new Map<string, WorldEvent[]>();
  for (const e of events) {
    const k = placeKey(e, x.catalog);
    byPlace.set(k, [...(byPlace.get(k) ?? []), e]);
  }
  let pins = '';
  if (code === '01') {
    for (const [nn, label, px, py] of NATION_PINS) {
      const here = events.filter((e) => sidoOf(e.loc) === nn);
      pins += pin('map-region', nn, label, px, py, `nation${hotClass(here)}`, here.length);
    }
  } else {
    (SIGUN[code] ?? []).forEach((gu, i) => {
      const xy = REGION_PINS[code]?.[i];
      const loc = `${code}-${i}`;
      if (!xy) return;
      const here = byPlace.get(loc) ?? [];
      const sel = field.place === loc || sameTarget(field.target, loc) ? ' sel' : '';
      pins += pin('map-place', loc, gu, xy[0], xy[1], `${loc === SEALED_LOC ? 'sealed' : ''}${hotClass(here)}${sel}`, here.length > 1 ? here.length : 0);
    });
    for (const lm of x.catalog.landmarks) {
      if (lm.sido !== code) continue;
      const key = `fac:${lm.name}`;
      const here = byPlace.get(key) ?? [];
      const sel = field.place === key || sameTarget(field.target, key) ? ' sel' : '';
      pins += pin('map-place', key, lm.label || lm.name, lm.x, lm.y, `fac${hotClass(here)}${sel}`);
    }
  }
  const img = url
    ? `<img class="gx-mapimg" src="${esc(url)}" alt="${esc(code === '01' ? '전국' : regionName(code))} 지도">`
    : `<div class="gx-mapph">${mapUrls[code] === null ? '지도 이미지를 찾지 못했어요' : '지도 불러오는 중…'}</div>`;
  // 모바일: 지역·장소 검색은 하단 바 위 서랍으로 (v0.16.24, 사용자 설계. 필터 줄은 숫자 때문에 위에 그대로)
  return `${narrow() ? '' : mapBar(x)}
    <div class="gx-canvas${url ? '' : ' ph'}"${url ? ` data-map="${code}"` : ''}><div class="gx-mapzoom">${img}${pins}</div>${url ? mapZoomControls(code !== '01') : ''}</div>`;
}

/** 지도 장소 검색: 시군구·거점 이름으로 찾아 그 지도로 바로 간다 (v0.16.21) */
function mapSuggest(c: Catalog): string {
  const q = field.mapq.trim().toLowerCase();
  if (!q) return '';
  const hits: { value: string; name: string; sub: string }[] = [];
  for (const code of MAP_CODES) {
    (SIGUN[code] ?? []).forEach((gu, i) => {
      if (`${regionName(code)} ${gu}`.toLowerCase().includes(q)) hits.push({ value: `${code}|${code}-${i}`, name: gu, sub: regionName(code) });
    });
  }
  for (const lm of c.landmarks) {
    if (!MAP_CODES.includes(lm.sido)) continue;
    if (`${lm.name} ${lm.label ?? ''}`.toLowerCase().includes(q)) hits.push({ value: `${lm.sido}|fac:${lm.name}`, name: lm.label || lm.name, sub: `${regionName(lm.sido)} ${lm.gu}` });
  }
  if (!hits.length) return '<p class="gx-sugnone">일치하는 장소가 없어요.</p>';
  return hits
    .slice(0, 8)
    .map((h) => `<button class="gx-sugi" data-action="map-jump" data-value="${esc(h.value)}"><b>${esc(h.name)}</b><small>${esc(h.sub)}</small></button>`)
    .join('');
}

/** 입력할 때마다 검색 결과만 다시 그린다 (입력 칸은 그대로) */
export function mapSuggestFor(ctx: ChatContext, q: string): string {
  field.mapq = q;
  const x = readCtx(ctx);
  return typeof x === 'string' ? '' : mapSuggest(x.catalog);
}

// ── 상황 목록 ──

function eventRow(e: WorldEvent, x: Ctx, agents: Map<string, { english?: string }>): string {
  // 상황판과 같은 카드 (ui/evcard.ts). 누르면 목표로 고르고 그 지역 지도를 연다 (v0.16.22: 지도 아이콘은 뺐다)
  const w = x.world;
  const src = e.kind === 'an' ? w.an[e.index] : e.kind === 'in' ? w.inc[e.index] : w.ms[e.index];
  const since = src && 'since' in src ? elapsedText(w.minute, src.since) : '';
  const an = e.kind === 'an' ? w.an[e.index] : undefined;
  const badge = e.kind === 'an'
    ? an?.exploring ? '<span class="gx-badge op">탐사 중</span>' : '<span class="gx-badge live">활성</span>'
    : e.kind === 'in' ? '<span class="gx-badge hot">진행</span>' : '<span class="gx-badge live">출현</span>';
  const names = e.kind === 'in' ? [] : codesToNames(e.people || '없음', x.catalog, x.faction).split(/\s*,\s*/).map((n) => n.trim());
  return evCard({
    kind: e.kind, name: e.name, grade: e.grade,
    loc: `${esc(locName(e.loc))}${since ? ` · ${since}` : ''}`, badge, chips: peopleChips(x.char, names, agents),
    extra: e.report ? `<span class="gx-evc-sit">${esc(e.report)}</span>` : '',
    key: e.key, open: 'pick-event',
    selected: field.target?.type === 'event' && field.target.key === e.key, confirmEnd: field.confirmEnd === e.key,
  });
}

/** 고른 장소 카드: 상황 카드와 같은 모양, 오른쪽 위엔 위키만. 누르면 이 장소가 목표 */
function placeCard(key: string, c: Catalog, on: boolean): string {
  let name: string;
  let sub: string;
  let wiki: string;
  if (key.startsWith('fac:')) {
    const lm = c.landmarks.find((l) => l.name === key.slice(4));
    name = lm?.label || lm?.name || key.slice(4);
    sub = lm ? `${SIDO_NAME[lm.sido] ?? ''} ${lm.gu}`.trim() : '거점';
    wiki = lm?.name ?? name;
  } else {
    const full = locName(key);
    const cut = full.lastIndexOf(' ');
    name = cut > 0 ? full.slice(cut + 1) : full;
    sub = cut > 0 ? full.slice(0, cut) : '';
    wiki = full;
  }
  const tag = on ? '<span class="gx-badge gx-goaltag">목표</span>' : '';
  return `<li class="gx-evc go gx-placecard${on ? ' sel' : ''}" data-action="pick-place" data-value="${esc(key)}"><i class="gx-gmark pl">${ICONS.pin}</i><span class="gx-evc-main"><span class="gx-evc-top"><span class="gx-evc-name"><b>${esc(name)}</b>${tag}</span>
    <span class="gx-evc-act"><button class="gx-icon" data-action="wiki-goto" data-value="${esc(wiki)}" title="위키" aria-label="${esc(name)} 위키">${ICONS.wiki}</button></span></span>
    <small>${esc(sub || '장소')}</small></span></li>`;
}

function situations(x: Ctx, events: WorldEvent[]): string {
  const counts: Record<Filter, number> = { all: events.length, an: 0, in: 0, ms: 0 };
  for (const e of events) counts[e.kind]++;
  const chips = (['all', 'an', 'in', 'ms'] as Filter[])
    .map((f) => `<button class="gx-chip${field.filter === f ? ' on' : ''}" data-action="map-filter" data-value="${f}">${f === 'all' ? '전체' : KIND_LABEL[f]}<b>${counts[f]}</b></button>`)
    .join('');
  const agents = new Map(rosterFor(x.world, x.catalog, x.faction, x.settings.agent_limit).map((p) => [p.name, p]));
  const shown = events.filter((e) => (field.filter === 'all' || e.kind === field.filter) && (!field.place || placeKey(e, x.catalog) === field.place));
  // 장소를 고르면 목록 맨 앞에 그 장소 카드(누르면 목표). 필터 줄 오른쪽 끝 취소는 장소나 목표를 골랐을 때만 눌리고,
  // 누르면 장소와 목표가 함께 풀린다 (v0.16.22, 사용자 요청)
  const place = field.place ? placeCard(field.place, x.catalog, sameTarget(field.target, field.place)) : '';
  const cancel = cancelChip('map-unplace', !!(field.place || field.target));
  const empty = !x.on
    ? '상황판이 꺼져 있어 발생한 상황이 없어요. 지도에서 장소를 골라 이동할 수 있어요.'
    : field.place || field.filter !== 'all'
      ? '조건에 맞는 상황이 없어요.'
      : '지금 발생한 상황이 없어요. 지도에서 장소를 골라 이동할 수 있어요.';
  return `<div class="gx-chips gx-sitbar">${chips}${cancel}</div>
    ${shown.length || place ? `<ul class="gx-evcs">${place}${shown.map((e) => eventRow(e, x, agents)).join('')}</ul>` : `<p class="gx-none">${empty}</p>`}`;
}

/** 선택 취소 칩: 고른 것이 없으면 꺼져 있다 */
function cancelChip(action: string, on: boolean): string {
  return `<button class="gx-chip gx-unplace" data-action="${action}" ${on ? 'title="선택 풀기"' : 'disabled'}>취소</button>`;
}

// ── 편성 ──

function lockedState(x: Ctx, id: string): string | null {
  const rec = x.world.agents[id];
  return agentLocked(rec) ? rec!.st : null;
}

function teamPanel(x: Ctx, goal: string | null, action: string, label: string, busy: boolean, ctx?: ChatContext): string {
  const roster = rosterFor(x.world, x.catalog, x.faction, x.settings.agent_limit);
  if (!x.supportOn) field.support = 0;
  const used = field.team.length + field.support;
  const chips = roster
    .map((p) => {
      const on = field.team.includes(p.id);
      const lock = lockedState(x, p.id);
      const full = !on && used >= TEAM_MAX;
      const st = x.world.agents[p.id]?.st ?? '미정';
      const sit = x.world.agents[p.id]?.situation ?? '';
      // 상황판 요원 카드와 같은 모양(큰 사진·설명·톡·위키), 한 줄에 한 명. 커스텀·첫 장면 편성도 같다
      {
        const c = ctx ? agentContact(ctx, p.id) : null;
        const act = c
          ? `<span class="gx-acard-act"><button class="gx-acard-tool" data-action="agent-talk" data-value="${esc(p.id)}" title="괴담톡" aria-label="${esc(p.name)}에게 톡">${ICONS.phone}</button>`
            + `<button class="gx-acard-tool" data-action="wiki-goto" data-value="${esc(c.wiki)}" title="위키" aria-label="${esc(p.name)} 위키">${ICONS.wiki}</button></span>`
          : '';
        const off = !!lock || full;
        return `<div class="gx-acard pick wide${on ? ' on' : ''}${off ? ' off' : ''}" role="button" tabindex="${off ? -1 : 0}" data-action="team-toggle" data-value="${esc(p.id)}" aria-pressed="${on}" aria-disabled="${off}"
          ${lock ? `title="${esc(`${stLabel(lock)} 상태라 편성할 수 없어요`)}"` : ''}>${agentInner(x.char, p, st, sit, act)}<span class="gx-acard-check" aria-hidden="true">✓</span></div>`;
      }
    })
    .join('');
  // 지원 인원도 요원과 같은 카드 모양으로 (인원은 카드 안에서 −/+)
  const support = x.supportOn
    ? `<div class="gx-acard pick gx-scard${field.support > 0 ? ' on' : ''}">
      <span class="gx-ava sq">${ICONS.group}</span>
      <span class="gx-acard-txt"><span class="gx-acard-top"><b>지원 인원</b></span><small>등록 요원 외 일반 인원</small></span>
      <span class="gx-scard-step">
        <button class="gx-step" data-action="support" data-value="-1" ${field.support <= 0 ? 'disabled' : ''} aria-label="지원 인원 줄이기">−</button>
        <b>${field.support}</b>
        <button class="gx-step" data-action="support" data-value="1" ${used >= TEAM_MAX ? 'disabled' : ''} aria-label="지원 인원 늘리기">+</button>
      </span>
    </div>`
    : '';
  const ready = !!goal && validTeam(field.team.length, field.support) && !busy;
  return `<section class="gx-team">
    <div class="gx-goal"><span>목표</span><b${goal ? '' : ' class="none"'}>${goal ? esc(goal) : '미정'}</b><em>${used + 1} / 4</em></div>
    ${roster.length || support ? `<div class="gx-acards pick">${chips}${support}</div>` : '<p class="gx-none">편성할 수 있는 요원이 없어요.</p>'}
    ${roster.length ? '' : support ? '<p class="gx-none">편성할 수 있는 요원이 없어요.</p>' : ''}
    ${narrow() ? '' : noteBox()}
    <button class="gx-start" data-action="${action}" ${ready ? '' : 'disabled'}>${busy ? '보내는 중…' : esc(label)}</button>
  </section>`;
}

/** 작전 메모 (PC는 편성 칸 안, 모바일은 하단 서랍. 출발·요청 버튼은 서랍에 넣지 않는다) */
function noteBox(): string {
  return `<label class="gx-note">
      <textarea rows="2" aria-label="작전 메모"${field.note.trim() ? ' class="filled"' : ''} data-input="field-note" placeholder="이번 작전에서 원하는 전개나 행동이 있으면 적어 주세요.">${esc(field.note)}</textarea></label>`;
}

/** 모바일 하단 서랍: 목표 단계는 지역·검색(임무 탭만), 편성 단계는 작전 메모 */
function fieldDrawer(x: Ctx, withMap: boolean): string {
  if (!narrow()) return '';
  if (field.step === 'team') return drawerBox(noteBox(), 'gx-notedrawer');
  return withMap ? drawerBox(mapBar(x), 'gx-mapdrawer') : '';
}

// ── 탭 화면 ──

/** 모바일 단계 바: ① 목표 → ② 편성 (CSS로 모바일에서만 보이고, 고른 단계만 보인다).
 *  swap: 오른쪽 끝 임무↔커스텀 전환 (v0.16.18: 위에 따로 있던 전환 줄은 자리만 차지했다) */
function stepBar(goal: string | null, swap?: 'map' | 'mission'): string {
  const used = field.team.length + field.support + 1;
  const b = (k: 'goal' | 'team', n: string, label: string, sub: string) =>
    `<button class="gx-stepb${field.step === k ? ' on' : ''}" data-action="field-step" data-value="${k}" aria-pressed="${field.step === k}"><i>${n}</i><span><b>${label}</b><small>${esc(sub)}</small></span></button>`;
  const sw = swap
    ? `<button class="gx-stepswap" data-action="tab" data-value="${swap}" aria-label="${swap === 'map' ? '임무로 전환' : '커스텀으로 전환'}">${ICONS.swap}<span>${swap === 'map' ? '임무' : '커스텀'}</span></button>`
    : '';
  return `<div class="gx-stepbar${sw ? ' has-swap' : ''}">${b('goal', '1', '목표', goal ?? '고르기')}${b('team', '2', '편성', `${used} / 4`)}${sw}</div>`;
}

/** 단계를 바꾸면 맨 위부터 보이게 */
function toStep(step: 'goal' | 'team', env: FieldEnv): void {
  field.step = step;
  env.render();
  const body = document.querySelector('.gx .gx-body');
  if (body && matchMedia('(max-width: 760px)').matches) body.scrollTop = 0;
}

export function mapTab(ctx: ChatContext, env: FieldEnv, notice: string, busy: boolean): string {
  const x = readCtx(ctx);
  if (typeof x === 'string') return `<div class="gx-empty">${esc(x)}</div>`;
  const events = x.on ? activeEvents(x.world) : [];
  // 고른 상황이 그사이 끝났으면 풀어 준다
  const t = field.target;
  if (t?.type === 'event' && !events.some((e) => e.key === t.key)) field.target = null;
  const goal = field.target ? targetName(field.target) : null;
  // v0.16.17: 왼쪽은 지도 + 그 아래 상황 목록, 오른쪽 위에 편성 (예전엔 왼쪽 지도 아래가 비고 오른쪽만 길었다)
  return `<main class="gx-body gx-field gx-map" data-step="${field.step}">
    ${stepBar(goal, 'mission')}
    <div class="gx-mapcol">${mapCanvas(ctx, x, events, env)}
      <section class="gx-sec gx-sits" aria-label="상황">${situations(x, events)}</section></div>
    <div class="gx-sidecol">
      ${notice ? `<div class="gx-err" role="alert">${esc(notice)}</div>` : ''}
      ${teamPanel(x, goal, 'depart', '출발', busy, ctx)}
    </div>
  </main>${fieldDrawer(x, true)}`;
}

function missionCatalog(c: Catalog, kind: MissionKind): { name: string; sub: string }[] {
  if (kind === 'an') return c.anomalies.map((a) => ({ name: a.name, sub: a.english }));
  if (kind === 'ms') return c.mysticSites.map((m) => ({ name: m.name, sub: m.english }));
  return c.landmarks.map((l) => ({ name: l.name, sub: `${SIDO_NAME[l.sido] ?? ''} ${l.gu}` }));
}

function missionStatus(x: Ctx, kind: MissionKind, name: string): string {
  const w = x.world;
  if (kind === 'an') {
    if (w.pending.an === name) return '<span class="gx-badge wait">요청 대기</span>';
    const e = w.an.find((a) => a.presetName === name || a.name === name);
    if (e) return `<span class="gx-badge ${e.state === '활성' ? 'live' : 'wait'}">${e.state === '활성' ? '발생 중' : '발생 예정'}</span>`;
  } else if (kind === 'ms') {
    if (w.pending.ms === name) return '<span class="gx-badge wait">요청 대기</span>';
    if (w.ms.some((m) => m.name === name)) return '<span class="gx-badge live">출현</span>';
  } else {
    if (w.pending.in === name) return '<span class="gx-badge wait">요청 대기</span>';
    if (w.inc.some((i) => i.name === name)) return '<span class="gx-badge hot">사건 진행</span>';
  }
  return '';
}

export function missionList(ctx: ChatContext, opening = false): string {
  const x = readCtx(ctx);
  if (typeof x === 'string') return '';
  const q = field.query.trim().toLowerCase();
  const row = (kind: MissionKind, r: { name: string; sub: string }) =>
    `<li class="gx-ev${field.mname === r.name && field.mpick === kind ? ' sel' : ''}"><button class="gx-evmain" data-action="mission-pick" data-value="${kind}:${esc(r.name)}">
      <span class="gx-row"><b>${esc(r.name)}</b>${missionStatus(x, kind, r.name)}</span>${r.sub ? `<span class="gx-loc">${esc(r.sub)}</span>` : ''}</button>
      ${opening ? '' : `<div class="gx-evact"><button class="gx-icon" data-action="wiki-goto" data-value="${esc(r.name)}" title="위키" aria-label="${esc(r.name)} 위키">${ICONS.wiki}</button></div>`}</li>`;
  const hit = (r: { name: string; sub: string }) => `${r.name} ${r.sub}`.toLowerCase().includes(q);
  if (!q) {
    const rows = missionCatalog(x.catalog, field.mkind);
    if (!rows.length) return '<p class="gx-none">일치하는 대상이 없어요.</p>';
    return `<ul class="gx-list gx-mlist">${rows.map((r) => row(field.mkind, r)).join('')}</ul>`;
  }
  // 검색은 괴이·특수·거점을 한꺼번에 (고른 종류부터), 종류마다 작은 제목 아래로 묶는다
  const order = [field.mkind, ...(['an', 'ms', 'lm'] as MissionKind[]).filter((k) => k !== field.mkind)];
  const groups = order
    .map((k) => ({ k, rows: missionCatalog(x.catalog, k).filter(hit) }))
    .filter((g) => g.rows.length)
    .map((g) => `<li class="gx-mgrp">${MISSION_LABEL[g.k]}<small>${g.rows.length}</small></li>${g.rows.map((r) => row(g.k, r)).join('')}`)
    .join('');
  return groups ? `<ul class="gx-list gx-mlist">${groups}</ul>` : '<p class="gx-none">일치하는 대상이 없어요.</p>';
}

export function missionTab(ctx: ChatContext, opening: boolean, notice: string, busy: boolean): string {
  const x = readCtx(ctx);
  if (typeof x === 'string') return `<div class="gx-empty">${esc(x)}</div>`;
  const segs = (['an', 'ms', 'lm'] as MissionKind[])
    .map((k) => `<button class="gx-chip${field.mkind === k ? ' on' : ''}" data-action="mission-kind" data-value="${k}" aria-pressed="${field.mkind === k}">${MISSION_LABEL[k]}</button>`)
    .join('');
  const p = x.world.pending;
  const pend = (['an', 'ms', 'in'] as EventKind[])
    .filter((k) => p[k])
    .map((k) => `<div class="gx-ctxbar"><span>요청 대기 · ${esc(p[k])}</span><button class="gx-mini" data-action="mission-cancel" data-value="${k}">요청 취소</button></div>`)
    .join('');
  const intro = opening
    ? '<p class="gx-hint">커스텀 임무로 시작해요. 목표와 동행을 고르고 작전 개시를 누르면 바로 첫 장면이 시작돼요.</p>'
    : '';
  return `<main class="gx-body gx-field gx-mission" data-step="${field.step}">
    ${stepBar(field.mname, opening ? undefined : 'map')}
    <div class="gx-mapcol">
      ${intro}
      <div class="gx-mfilter">${segs}<input class="gx-search" type="search" placeholder="검색" value="${esc(field.query)}" data-input="mission-query" aria-label="검색">${cancelChip('mission-unpick', !!field.mname)}</div>
      <div class="gx-mbox">${missionList(ctx, opening)}</div>
    </div>
    <div class="gx-sidecol">
      ${notice ? `<div class="gx-err" role="alert">${esc(notice)}</div>` : ''}
      ${x.world.notice && x.on ? `<div class="gx-hint">${esc(x.world.notice)}</div>` : ''}
      ${pend}
      ${teamPanel(x, field.mname, 'mission-send', opening ? '작전 개시' : '임무 요청', busy, opening ? undefined : ctx)}
    </div>
  </main>${fieldDrawer(x, false)}`;
}

// ── 동작 ──

export function newMessage(data: string) {
  const id = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return { role: 'user', data, time: Date.now(), chatId: id };
}

/** 아직 보내지 않은 지시문 카드가 마지막에 있으면 바꿔 끼우고, 아니면 덧붙인다. 추가 요청은 카드 아래에 */
function placeRecord(chat: Chat, card: string, note: string): Chat {
  const record = note.trim() ? `${card}\n\n${note.trim()}` : card;
  const message = (chat.message ?? []).slice();
  const last = message[message.length - 1];
  if (last?.role === 'user' && hasSceneCard(last.data)) message[message.length - 1] = { ...last, data: record };
  else message.push(newMessage(record));
  return { ...chat, message };
}

function partyNames(x: Ctx, team: string[]): string[] {
  const roster = rosterFor(x.world, x.catalog, x.faction, x.settings.agent_limit);
  return team.map((id) => {
    const p = roster.find((r) => r.id === id);
    if (!p || lockedState(x, id)) throw new DirectiveError('편성할 수 없게 된 요원이 있어요. 편성을 다시 확인해 주세요.');
    return p.name || p.english;
  });
}

function partyLabel(names: string[], support: number): string {
  return ['나', ...names, ...(support > 0 ? [`지원 ×${support}`] : [])].join(', ');
}

async function compose(ctx: ChatContext, env: FieldEnv, build: (latest: Chat, x: Ctx) => { chat: Chat }): Promise<void> {
  env.setBusy(true);
  env.setNotice('');
  env.render();
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (latest) => {
      const x = ctxOf(ctx, latest);
      return build(latest, x).chat;
    });
    resetField();
    // 놓은 메시지를 바로 보낸다. 안 되면 창을 연 채로 안내 (채팅창 전송 버튼으로 보내면 된다)
    const sent = await sendNow();
    env.setBusy(false);
    if (!sent) {
      env.setNotice(SEND_FALLBACK);
      await env.refresh();
      return;
    }
    await env.close();
    await env.refresh();
  } catch (error) {
    env.setBusy(false);
    env.setNotice(error instanceof Error ? error.message : String(error));
    env.render();
  }
}

export function depart(ctx: ChatContext, env: FieldEnv): Promise<void> {
  const target = field.target;
  const note = field.note;
  const team = [...field.team];
  const support = field.support;
  return compose(ctx, env, (latest, x) => {
    if (!target) throw new DirectiveError('목표가 정해지지 않았어요.');
    if (!validTeam(team.length, support)) throw new DirectiveError('요원과 지원 인원을 다시 확인해 주세요.');
    if (support > 0 && !x.supportOn) throw new DirectiveError('지원 투입이 꺼져 있어요. 설정 탭에서 켜거나 지원 인원을 빼 주세요.');
    const d = parseDirective(ctx.char.globalLore);
    let dest: string;
    if (target.type === 'event') {
      const ev = activeEvents(x.world).find((e) => e.key === target.key);
      if (!x.on || !ev) throw new DirectiveError('선택한 상황이 끝났거나 바뀌었어요. 다시 골라 주세요.');
      dest = destination(d, ev.name, locName(ev.loc));
    } else if (target.type === 'facility') {
      const lm = x.catalog.landmarks.find((l) => l.name === target.name);
      if (!lm) throw new DirectiveError('시설 목록이 바뀌었어요. 다시 골라 주세요.');
      dest = destination(d, lm.name, `${regionName(lm.sido)} ${lm.gu}`);
    } else {
      dest = destination(d, locName(target.loc));
    }
    const names = partyNames(x, team);
    const body = sceneDirective(d, dest, names, support, false);
    return { chat: placeRecord(latest, sceneRecord({ target: targetName(target), party: partyLabel(names, support) }, body), note) };
  });
}

export function sendMission(ctx: ChatContext, env: FieldEnv, opening: boolean): Promise<void> {
  const kind = field.mpick;
  const name = field.mname;
  const note = field.note;
  const team = [...field.team];
  const support = field.support;
  return compose(ctx, env, (latest, x) => {
    if (!name) throw new DirectiveError('목표가 정해지지 않았어요.');
    if (!validTeam(team.length, support)) throw new DirectiveError('요원과 지원 인원을 다시 확인해 주세요.');
    if (support > 0 && !x.supportOn) throw new DirectiveError('지원 투입이 꺼져 있어요. 설정 탭에서 켜거나 지원 인원을 빼 주세요.');
    const d = parseDirective(ctx.char.globalLore);
    let dest = destination(d, name);
    if (kind === 'lm') {
      const lm = x.catalog.landmarks.find((l) => l.name === name);
      if (lm) dest = destination(d, name, `${SIDO_NAME[lm.sido] ?? ''} ${lm.gu}`);
    } else if (kind === 'ms') {
      const site = x.world.ms.find((m) => m.name === name);
      if (site) dest = destination(d, name, locName(site.loc));
    }
    const names = partyNames(x, team);
    let chat = latest;
    if (x.on) {
      const w = structuredClone(x.world);
      // 보내지 않은 지시문을 바꿔 끼우면 그 요청도 새 것으로 (예전 대상이 같이 발생하지 않게)
      const last = (latest.message ?? []).at(-1);
      if (last?.role === 'user' && hasSceneCard(String(last.data ?? ''))) for (const k of ['an', 'ms', 'in'] as EventKind[]) cancelMission(w, k);
      const err = requestMission(w, x.catalog, x.settings, kind, name);
      if (err) throw new DirectiveError(err);
      chat = { ...chat, scriptstate: { ...(chat.scriptstate ?? {}), ...worldVars(w, x.catalog, x.settings, x.faction) } };
    }
    const body = sceneDirective(d, dest, names, support, opening);
    return { chat: placeRecord(chat, sceneRecord({ target: name, party: partyLabel(names, support) }, body), note) };
  });
}

async function saveWorld(ctx: ChatContext, env: FieldEnv, change: (w: WorldState, x: Ctx) => string | null): Promise<void> {
  env.setBusy(true);
  env.setNotice('');
  try {
    await updateChat(ctx.charIndex, ctx.chatIndex, (latest) => {
      const x = ctxOf(ctx, latest);
      const w = structuredClone(x.world);
      const err = change(w, x);
      if (err) throw new Error(err);
      return { ...latest, scriptstate: { ...(latest.scriptstate ?? {}), ...worldVars(w, x.catalog, x.settings, x.faction) } };
    });
    env.setBusy(false);
    await env.refresh();
  } catch (error) {
    env.setBusy(false);
    env.setNotice(error instanceof Error ? error.message : String(error));
    env.render();
  }
}

/** 상황판 행을 누르면 지도에서 그 자리를 연다 (v0.16.16). key는 activeEvents의 key */
export function showOnMap(ctx: ChatContext, key: string): boolean {
  const x = readCtx(ctx);
  if (typeof x === 'string' || !x.on) return false;
  const ev = activeEvents(x.world).find((e) => e.key === key);
  if (!ev) return false;
  field.region = sidoOf(ev.loc);
  field.place = placeKey(ev, x.catalog);
  field.filter = 'all';
  field.confirmEnd = null;
  return true;
}

/** 지도·커스텀 임무 탭의 버튼. 처리했으면 true */
export async function handleField(action: string, value: string | undefined, ctx: ChatContext, env: FieldEnv, opening: boolean): Promise<boolean> {
  const v = value ?? '';
  switch (action) {
    case 'map-region':
      field.region = v === '01' || MAP_CODES.includes(v) ? v : '01';
      field.place = null;
      field.confirmEnd = null;
      env.render();
      return true;
    case 'map-jump':
    case 'map-place': {
      let v = value ?? '';
      if (action === 'map-jump') {
        const [code, key] = v.split('|');
        if (!MAP_CODES.includes(code) || !key) return true;
        field.region = code;
        field.mapq = '';
        v = key;
      }
      field.confirmEnd = null;
      if (action === 'map-place' && isPC() && field.place === v && sameTarget(field.target, v)) {
        field.place = null;
        field.target = null;
        env.render();
        return true;
      }
      field.place = v;
      const x = readCtx(ctx);
      const here = typeof x === 'string' || !x.on ? [] : activeEvents(x.world).filter((e) => placeKey(e, x.catalog) === v);
      if (!here.length) field.target = placeTarget(v);
      env.render();
      return true;
    }
    case 'map-unplace':
      field.place = null;
      field.target = null;
      field.confirmEnd = null;
      toStep('goal', env);
      return true;
    case 'map-filter':
      field.filter = (['all', 'an', 'in', 'ms'] as Filter[]).includes(v as Filter) ? (v as Filter) : 'all';
      env.render();
      return true;
    case 'pick-place':
      if (isPC() && sameTarget(field.target, v)) {
        field.target = null;
        env.render();
        return true;
      }
      field.target = placeTarget(v);
      toStep('team', env);
      return true;
    case 'field-step':
      toStep(v === 'team' ? 'team' : 'goal', env);
      return true;
    case 'pick-event': {
      const x = readCtx(ctx);
      if (typeof x === 'string') return true;
      const ev = activeEvents(x.world).find((e) => e.key === v);
      if (!ev) return true;
      if (isPC() && sameTarget(field.target, ev.key)) {
        field.target = null;
        field.confirmEnd = null;
        env.render();
        return true;
      }
      field.target = { type: 'event', key: ev.key, kind: ev.kind, name: ev.name, loc: ev.loc };
      field.region = sidoOf(ev.loc);
      field.confirmEnd = null;
      toStep('team', env);
      return true;
    }
    case 'end-event':
      if (field.confirmEnd !== v) {
        field.confirmEnd = v;
        env.render();
        return true;
      }
      field.confirmEnd = null;
      if (field.target?.type === 'event' && field.target.key === v) field.target = null;
      await saveWorld(ctx, env, (w) => (endEvent(w, v) ? null : '이미 끝났거나 바뀐 상황이에요.'));
      return true;
    case 'team-toggle': {
      // 임무 탭 카드는 button이 아니라서(안에 톡·위키 버튼) 못 고르는 요원도 눌린다
      const tx = readCtx(ctx);
      if (typeof tx !== 'string' && lockedState(tx, v)) return true;
      const i = field.team.indexOf(v);
      if (i >= 0) field.team.splice(i, 1);
      else if (field.team.length + field.support < TEAM_MAX) field.team.push(v);
      env.render();
      return true;
    }
    case 'support': {
      const next = field.support + (Number(v) > 0 ? 1 : -1);
      if (next >= 0 && validTeam(field.team.length, next)) field.support = next;
      env.render();
      return true;
    }
    case 'depart':
      await depart(ctx, env);
      return true;
    case 'mission-kind':
      // 종류만 바꿔 본다. 고른 목표(mname·mpick)는 그대로 둔다
      if (v === 'an' || v === 'ms' || v === 'lm') {
        field.mkind = v;
        field.query = '';
      }
      env.render();
      return true;
    case 'mission-pick': {
      // 값은 "종류:이름" (검색 결과엔 여러 종류가 섞여 있다)
      const m = v.match(/^(an|ms|lm):([\s\S]*)$/);
      const kind = (m?.[1] as MissionKind | undefined) ?? field.mkind;
      const name = m ? m[2] : v;
      if (isPC() && field.mname === name && field.mpick === kind) {
        field.mname = null;
        env.render();
        return true;
      }
      field.mname = name;
      field.mpick = kind;
      toStep('team', env);
      return true;
    }
    case 'mission-cancel':
      if (v === 'an' || v === 'ms' || v === 'in') await saveWorld(ctx, env, (w) => (cancelMission(w, v), null));
      return true;
    case 'mission-unpick':
      field.mname = null;
      toStep('goal', env);
      return true;
    case 'mission-send':
      await sendMission(ctx, env, opening);
      return true;
  }
  return false;
}
