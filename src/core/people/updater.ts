// 기록 갱신기 (리수폿 Writer 의 축소판): 본편 응답을 읽을 요청 자료를 만들고, 보조 모델의 JSON 답을 검사해 기록에 반영한다.
// 모델은 여기서 부르지 않는다 (host/people.ts). 모든 판정은 결정적이라 시험할 수 있다.
import type { Chat, ChatMessage } from '../types';
import { messageText } from '../refs';
import { scanAgents } from '../world/tags';
import { findStatusTags } from '../world/status';
import { addressOf, affinityView, opennessOf, tasteOf } from './affinity';
import { unknownTo } from './inject';
import { seedPerson } from './seed';
import { factionNow, knownFactionCodes, sceneFactionCodes, userFactionOf, factionName as factionNameOf } from './faction';
import { factionCode } from './identity';
import { nameMatcher, scenePeople, entriesOf, type NameEntry } from './select';
import { changeId, entryId, isAlive, liveChanges, liveEntries, liveness, markRead, messageKey, norm, plain, putChange, putDoc, putEntry, type Liveness } from './store';
import type { Feature, PeopleSettings } from './settings';
import { CUES, DOC_TYPES, FACTION_STAGES, OPENNESS_BASELINES, factionWho, OPENNESS_DELTAS, REGISTERS, RHYTHM_ENGAGEMENT, RHYTHM_HOOK_STAGES, RHYTHM_HOOK_TIERS, RHYTHM_PHASES, SLOTS, TASTE_MAX, TASTE_MIN, docFeature, opennessStage, type Change, type Cue, type DocType, type Entry, type PeopleStore, type Person, type Register, type SlotId } from './types';

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const msgs = (chat: Chat): ChatMessage[] => (Array.isArray(chat.message) ? chat.message : []);

// ── 묶음 계획 ──

/** 안 읽은 응답들을 6턴 또는 글자 상한 단위로 묶는다 (앞에서부터) */
export function planBatches(chat: Chat, unread: number[], spanCap: number, maxTurns = 6): number[][] {
  const list = msgs(chat);
  const out: number[][] = [];
  let cur: number[] = [];
  let chars = 0;
  for (const i of unread) {
    const n = str(list[i]?.data).length + str(list[i - 1]?.data).length;
    if (cur.length && (cur.length >= maxTurns || chars + n > spanCap)) {
      out.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(i);
    chars += n;
  }
  if (cur.length) out.push(cur);
  return out;
}

// ── 요청 자료 ──

export interface SpanItem { m: string; role: 'user' | 'assistant'; text: string; confirmed?: true; context_only?: true; index: number }
export interface Signal { who: string; tag: string; from: string; to: string; note: string }

export interface UpdateInput {
  system: string;
  data: Record<string, unknown>;
  /** 이번에 읽는 응답 위치들 (읽음 표시용) */
  indexes: number[];
  /** m 꼬리표 → 메시지 위치 */
  tags: Map<string, number>;
  people: string[];
  /** 확정 메시지 위치 (근거로 쓸 수 있는 것) */
  confirmed: Set<number>;
  /** 이름 표 (별명·호칭으로 인물 찾기) */
  names: NameEntry[];
  /** 저장 상한을 넘긴 인물 (같은 호출에 정리를 얹을 대상) */
  tidy: string[];
  /** 장면 세력 코드 (세력 평판 켜짐) */
  factions: string[];
  factionNames: Record<string, string>;
}

const CUE_MEANING: Record<Cue, string> = {
  작은친절: '실제로 전해지고 받아들여진 작은 배려', 도움: '의미 있는 도움, 약속을 지킴', 큰도움: '대가·위험을 감수한 도움, 관계 회복', 헌신: '결정적 헌신·희생·약속 완수',
  실망: '실제로 생긴 작은 실망', 무시: '분명한 무시·무례, 믿음에 금', 배신: '의미 있는 배신·굴욕', 파탄: '심각한 신뢰·관계 파괴', 중대위반: '설정상 용서받기 어려운 일',
};

/** 응답 본문 정리: 상태창·상황판 태그·플러그인 표식은 messageText 가 지운다. 길면 중간을 접는다 */
export function cleanSpan(raw: string, cap: number): string {
  let t = String(raw ?? '');
  for (const tag of findStatusTags(t)) t = t.replace(tag.raw, '');
  t = messageText(t).replace(/\n{3,}/g, '\n\n').trim();
  if (t.length <= cap) return t;
  const head = t.slice(0, Math.floor(cap * 0.6));
  const tail = t.slice(-Math.floor(cap * 0.35));
  return `${head}\n[…]\n${tail}`;
}

/** 인물 기록을 자료용으로 (칸별 id·본문, 상한을 넘으면 오래된 history·scene 부터 뺀다) */
/** 인물의 살아 있는 기록 글자 수 (저장 상한 판정) */
export function recordChars(p: Person, live: Liveness): number {
  return SLOTS.reduce((n, s) => n + liveEntries(p.slots[s], live).reduce((m, e) => m + e.text.length, 0), 0);
}

export function personPayload(p: Person, live: Liveness, changes: Change[], unknown?: string[], extra: { taste?: boolean; openness?: boolean } = {}) {
  const entries: Record<string, { id: string; text: string; target?: string; kind?: string }[]> = {};
  for (const s of SLOTS) {
    const list = liveEntries(p.slots[s], live);
    if (!list.length) continue;
    entries[s] = list.map((e) => ({ id: e.id, text: e.text, ...(e.target ? { target: e.target } : {}), ...(e.kind ? { kind: e.kind } : {}) }));
  }
  const aff = affinityView(p, changes);
  const addr = addressOf(p, changes);
  return {
    name: p.name,
    aliases: p.aliases,
    express: p.express,
    affinity_now: `${aff.stage.label}(${aff.stage.max})`,
    address_now: addr,
    ...(extra.taste ? { taste_now: tasteOf(p, changes) } : {}),
    ...(extra.openness ? { openness_now: (() => { const v = opennessOf(p, changes); return v === null ? null : { value: v, stage: opennessStage(v).en }; })() } : {}),
    entries,
    ...(unknown?.length ? { unknown_to: unknown } : {}),
  };
}

export interface BuildOpts {
  settings: PeopleSettings;
  /** 설정이 반영된 지침 본문 */
  system: string;
  /** 인물별 가치관(relations-base values) */
  values: Record<string, string>;
  names: NameEntry[];
  /** 기록하지 않는 이름 (유저가 연기하는 요원) */
  exclude?: string[];
  /** 세력 코드 → 이름 (명부). 세력 평판 자료용 */
  factionNames?: Record<string, string>;
}

const SUSP_WEIGHT: Record<string, number> = { 약: 10, 중: 25, 강: 40, '-약': -10, '-중': -25, '-강': -40 };
/** 의심 사례 요약: 같은 대상·종류의 살아 있는 항목을 한 사례로. score 는 코드가 단서 무게로 계산 */
export function suspicionCases(p: Person, live: Liveness) {
  const list = liveEntries(p.slots.suspicion, live);
  const by = new Map<string, typeof list>();
  for (const e of list) (by.get(`${e.target}|${e.kind}`) ?? by.set(`${e.target}|${e.kind}`, []).get(`${e.target}|${e.kind}`)!).push(e);
  return [...by.entries()].map(([k, es]) => {
    const [target, kind] = k.split('|');
    let score = 0;
    let stage = '';
    let closed = false;
    for (const e of es) {
      const m = /^\[(시작|단서|반응|해소)(?:·([^\]]+))?\]/.exec(e.text);
      if (!m) continue;
      if (m[1] === '시작') (score += 10), (closed = false);
      else if (m[1] === '단서') score += SUSP_WEIGHT[m[2] ?? ''] ?? 10;
      else if (m[1] === '반응') stage = m[2] ?? stage;
      else if (m[1] === '해소') closed = true;
    }
    return { who: p.name, target, kind, status: closed ? 'closed' : 'open', score: Math.max(0, Math.min(100, score)), stage, text: es.at(-1)?.text ?? '' };
  });
}

/** 이번 묶음의 요청 자료 */
export function buildUpdate(chat: Chat, store: PeopleStore, batch: number[], o: BuildOpts): UpdateInput {
  const list = msgs(chat);
  const live = liveness(chat);
  const changes = liveChanges(store, live);
  const first = Math.min(...batch);
  // 확정 구간: 묶음의 응답들과 각 앞의 유저 입력. 맥락: 그 앞 쌍들
  const confirmedIdx = new Set<number>();
  for (const i of batch) {
    confirmedIdx.add(i);
    if (list[i - 1]?.role === 'user') confirmedIdx.add(i - 1);
  }
  const ctxIdx: number[] = [];
  let i = Math.min(...confirmedIdx) - 1;
  let pairs = 0;
  while (i >= 0 && pairs < o.settings.prevPairs) {
    ctxIdx.unshift(i);
    if (list[i].role === 'user') pairs++;
    i--;
  }
  const span: SpanItem[] = [];
  const tags = new Map<string, number>();
  const all = [...ctxIdx, ...[...confirmedIdx].sort((a, b) => a - b)];
  all.forEach((idx, n) => {
    const m = `m${n + 1}`;
    tags.set(m, idx);
    const role = list[idx].role === 'user' ? 'user' : 'assistant';
    const item: SpanItem = { m, role, text: cleanSpan(str(list[idx].data), o.settings.spanCap), index: idx };
    if (confirmedIdx.has(idx)) item.confirmed = true;
    else item.context_only = true;
    span.push(item);
  });
  // 장면 인물: 확정 구간 글에 나온 사람 + 동행 + 태그가 바뀐 사람
  const match = nameMatcher(o.names);
  const texts = [...confirmedIdx].sort((a, b) => b - a).map((idx) => messageText(str(list[idx].data)));
  const people: string[] = [];
  const push = (n: string) => {
    if (store.people[n] && !people.includes(n) && !o.exclude?.includes(n)) people.push(n);
  };
  for (const t of texts) for (const n of match(t)) push(n);
  const scoped = { ...chat, message: list.slice(0, Math.max(...batch) + 1) } as Chat;
  for (const n of scenePeople(scoped, store, match, { recent: 2 })) push(n);
  // 태그 신호: 묶음 앞 응답과 묶음 마지막 응답의 요원 태그 비교
  const signals: Signal[] = [];
  const prevBot = [...list.slice(0, first)].reverse().find((m) => m.role === 'char');
  const lastBot = list[Math.max(...batch)];
  if (lastBot) {
    const before = new Map(prevBot ? scanAgents(str(prevBot.data)).map((a) => [a.who, a]) : []);
    for (const a of scanAgents(str(lastBot.data))) {
      const b = before.get(a.who);
      if (b && b.state !== a.state && store.people[a.who]) {
        signals.push({ who: a.who, tag: '상태', from: b.state, to: a.state, note: 'Record how and why in `state`; add one `history` line.' });
        push(a.who);
      }
    }
  }
  const chosen = people.slice(0, 6);
  const already = [
    ...changes.filter((c) => c.kind === 'cue' && chosen.includes(c.who) && [...confirmedIdx].some((idx) => live.at.get(c.anchor) === idx)).map((c) => ({ who: c.who, kind: 'cue', cue: c.cue })),
    ...chosen.flatMap((n) => SLOTS.flatMap((s) => liveEntries(store.people[n].slots[s], live).filter((e) => [...confirmedIdx].some((idx) => live.at.get(e.anchor) === idx)).map((e) => ({ who: n, kind: 'entry', slot: s, text: e.text })))),
  ];
  const wantNote = o.settings.director === 'facts';
  const over = chosen.filter((n) => recordChars(store.people[n], live) > o.settings.personCap);
  // 세력 평판: 장면 세력(인물 소속 ∪ 글에 나온 세력)의 현재값
  const factionCodes = o.settings.features.has('faction_rep') ? sceneFactionCodes(store, chosen, texts, o.factionNames) : [];
  const userFaction = userFactionOf(store, chat);
  const data = {
    request_ref: `pp_${Date.now().toString(36)}`,
    cues: o.settings.features.has('affinity') ? CUES.map((c) => ({ name: c, meaning: CUE_MEANING[c] })) : [],
    slots: SLOTS.filter((s) => s !== 'suspicion' || o.settings.features.has('suspicion')),
    doc_types: DOC_TYPES.filter((t) => o.settings.features.has(docFeature(t) as Feature)),
    people: chosen.map((n) => {
      const p = store.people[n];
      return { ...personPayload(p, live, changes, wantNote || o.settings.features.has('perception') ? unknownTo(p, store, live) : undefined, { taste: o.settings.features.has('taste'), openness: o.settings.features.has('openness') }), values: o.values[n] ?? '' };
    }),
    known_names: Object.keys(store.people),
    docs_now: DOC_TYPES.some((t) => o.settings.features.has(docFeature(t) as Feature))
      ? Object.values(store.docs).filter((d) => o.settings.features.has(docFeature(d.type) as Feature)).flatMap((d) => liveEntries(d.entries, live).map((e) => ({ type: d.type, key: d.key, id: e.id, text: e.text, ...(e.date ? { date: e.date } : {}), ...(e.place ? { place: e.place } : {}), ...(e.who?.length ? { who: e.who } : {}) })))
      : undefined,
    suspicion_now: o.settings.features.has('suspicion') ? chosen.flatMap((n) => suspicionCases(store.people[n], live)) : undefined,
    npc_relations: o.settings.features.has('npc_emotion') ? true : undefined,
    factions_now: o.settings.features.has('faction_rep')
      ? factionCodes.map((c) => { const f = factionNow(store, c, changes, userFaction, o.settings, o.factionNames); return { code: f.code, name: f.name, value: f.value, stage: f.stage.label, stage_en: f.stage.id }; })
      : undefined,
    faction_stages: o.settings.features.has('faction_rep') ? Object.values(FACTION_STAGES).map((st) => `${st.label} (${st.id})`).join(' · ') : undefined,
    // 저장 상한을 넘긴 인물: 같은 호출에 정리(merge)를 얹는다 (설정 tidy=same)
    tidy: o.settings.tidy === 'same' ? over.map((n) => ({ name: n, chars: recordChars(store.people[n], live), target: Math.round(o.settings.personCap * 0.8) })) : undefined,
    next_note: wantNote ? true : undefined,
    already_recorded: already,
    signals,
    span: span.map(({ index: _i, ...rest }) => rest),
    identity_known: store.identity ? { faction: store.identity.faction, rank: store.identity.rank } : null,
    want: { new_people: true, next_note: wantNote, address: o.settings.features.has('register'), identity: true },
  };
  return { system: o.system, data, indexes: batch, tags, people: chosen, confirmed: confirmedIdx, names: o.names, tidy: o.settings.tidy === 'same' ? over : [], factions: factionCodes, factionNames: o.factionNames ?? {} };
}

// ── 지침 조립 ──

/** `<<SECTION:x>> … <<END:x>>` 표식: 꺼진 기능의 절은 빼고 표식은 지운다 */
/** 기록 본문을 영어로 쓰게 하는 규칙 (설정 lang=en). 이름·인용·호칭·조직·직급은 원문 그대로 */
export const LANG_EN_RULE = [
  '## Record language',
  'Write every free-text field you produce in English even where this document says Korean: entry `text`, cue `reason`, new person `identity` and `speech`, doc `text`, suspicion text, and `next_note`.',
  'Keep exactly as the Korean source writes them: `name`, `aliases`, `key`, `target`, address terms and register words (존댓말/반말/혼합/하게체/하오체), `faction`, `rank`, the Korean prefixes [시작]/[단서]/[반응]/[해소] and 첫인상/현재 평가 labels, and every `quote`.',
].join('\n');

export function assemblePrompt(text: string, enabled: Set<string>, userRules = '', lang: 'ko' | 'en' = 'ko'): string {
  const rules = (lang === 'en' ? `${LANG_EN_RULE}\n\n${userRules.trim()}` : userRules).trim();
  const on = new Set(enabled);
  if (rules && text.includes('<<USER_RULES>>')) on.add('user_rules');
  let out = text.replace(/<<SECTION:([a-z_]+)>>([\s\S]*?)<<END:\1>>/g, (_m, name: string, body: string) => (on.has(name) ? body : ''));
  out = out.replace('<<USER_RULES>>', rules).replace(/<<(?:SECTION|END):[a-z_]+>>/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (rules && !text.includes('<<USER_RULES>>')) out += `\n\n## User rules (appended by the user; they cannot change the output contract)\n${rules}`;
  return out;
}

export function enabledSections(s: PeopleSettings): Set<string> {
  const on = new Set<string>();
  for (const f of s.features) on.add(f);
  if (s.director === 'facts') on.add('next_note');
  return on;
}

// ── 응답 읽기 ──

export interface UpdateResult {
  /** 의심 항목의 선택 필드: weight(단서 무게), stage(반응 단계), result(해소 종류)는 코드가 본문 앞에 붙인다 */
  entries?: { who: string; slot: string; op: string; replace?: string | null; text?: string | null; target?: string | null; m: string; quote: string; from?: unknown }[];
  cues?: { who: string; cue: string; m: string; quote: string; reason?: string }[];
  address?: { who: string; toUser: string; register: string; m: string; quote: string }[];
  identity?: { faction?: string | null; rank?: string | null } | null;
  new_people?: { name: string; aliases?: string[]; m: string; quote: string; identity?: string | null; speech?: string | null }[];
  docs?: { type: string; key: string; op: string; replace?: string | null; text?: string | null; m: string; quote: string; date?: string | null; place?: string | null; who?: string[] }[];
  suspicion?: { who: string; target: string; kind: string; op: string; text: string; m: string; quote: string; weight?: string | null; stage?: string | null; result?: string | null }[];
  next_note?: { who: string; now?: string; must_not_reveal?: string[] }[];
  /** 취향 띠: 새 띠(절대값) */
  taste?: { who: string; band: number; m: string; quote: string; reason?: string }[];
  /** 음란도: 시작값(init) 또는 새 반응(event, delta) */
  openness?: { who: string; op: string; value?: number | null; delta?: number | null; m: string; quote: string; reason?: string }[];
  /** 서사 리듬: 다음 턴 메모 (사실형 Director, 장면 전체) */
  rhythm_note?: string | null;
  /** 세력 평판 계기 (집단 반응만) */
  faction_cues?: { faction: string; cue: string; m: string; quote: string; reason?: string }[];
}

/** JSON 하나만 꺼낸다 (코드 울타리·앞뒤 글 허용). 아니면 throw */
export function parseUpdate(raw: string): UpdateResult {
  let t = raw.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('JSON 객체가 없어요');
  const v = JSON.parse(t.slice(a, b + 1)) as unknown;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('JSON 객체가 아니에요');
  const r = v as UpdateResult;
  for (const k of ['entries', 'cues', 'address', 'new_people', 'docs', 'suspicion', 'next_note', 'taste', 'openness', 'faction_cues'] as const) {
    if (r[k] !== undefined && !Array.isArray(r[k])) throw new Error(`${k}는 목록이어야 해요`);
  }
  return r;
}

// ── 반영 ──

export interface Dropped { kind: string; who?: string; reason: string; item: unknown }
export interface ApplyReport {
  applied: { entries: number; cues: number; address: number; docs: number; suspicion: number; newPeople: string[]; notes: number; identity: boolean; taste: number; openness: number; factions: number };
  dropped: Dropped[];
  /** 「확인 필요」로 보류한 것 */
  held: Dropped[];
}

export interface ApplyCtx {
  settings: PeopleSettings;
  /** 새 인물의 시트 (로어북에 있으면) */
  sheetOf?: (name: string) => string | null;
  /** 새 인물의 시작값 */
  baseOf?: (name: string) => { faction?: string; affinityBase?: number; express?: 0 | 1 | 2 | 3; aliases?: string[] };
  /** 역할 명사만인 이름 (새 인물 거부) */
  roleWords?: Set<string>;
  now?: string;
  /** 기록하지 않는 이름 (유저가 연기하는 요원): 새 인물로도 받지 않는다 */
  exclude?: string[];
}

const ROLE_WORDS = new Set(['택시 기사', '기사', '점원', '경비', '경비원', '간호사', '의사', '행인', '남자', '여자', '아저씨', '아주머니', '학생', '직원', '요원', '사원', '대리', '과장', '부장', '선배', '후배', '언니', '오빠', '형', '누나', '손님', '주인', '사장', '경찰', '시민']);

/** 두 문장이 거의 같은가 (정규화 뒤 포함 또는 2글자 조각 80% 일치) */
export function similar(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const grams = (s: string) => {
    const g = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) g.set(s.slice(i, i + 2), (g.get(s.slice(i, i + 2)) ?? 0) + 1);
    return g;
  };
  const ga = grams(x);
  const gb = grams(y);
  let hit = 0;
  for (const [k, n] of ga) hit += Math.min(n, gb.get(k) ?? 0);
  return (2 * hit) / (x.length - 1 + y.length - 1) >= 0.8;
}

const SUSP_KINDS = new Set(['정체', '배신', '거짓말', '오염', '범행']);

/** 이름·별명·유일한 호칭으로 기록의 인물을 찾는다. 겹치는 호칭(「부장」)은 못 찾음 */
export function resolveName(who: string, store: PeopleStore, names: NameEntry[] = []): string | null {
  const w = norm(String(who ?? ''));
  if (!w) return null;
  if (store.people[who]) return who;
  for (const p of Object.values(store.people)) if (norm(p.name) === w || p.aliases.some((a) => norm(a) === w)) return p.name;
  const owners = new Map<string, Set<string>>();
  for (const e of names) for (const t of e.titles) (owners.get(norm(t)) ?? owners.set(norm(t), new Set()).get(norm(t))!).add(e.name);
  for (const e of names) {
    if (!store.people[e.name]) continue;
    if (e.aliases.some((a) => norm(a) === w)) return e.name;
    if (e.titles.some((t) => norm(t) === w) && owners.get(w)?.size === 1) return e.name;
  }
  return null;
}

/** 응답을 검사해 기록에 반영한다. 어긋난 항목만 버리고 이유를 남긴다 */
export function applyUpdate(store: PeopleStore, chat: Chat, input: UpdateInput, r: UpdateResult, ctx: ApplyCtx): ApplyReport {
  const list = msgs(chat);
  const live = liveness(chat);
  const report: ApplyReport = { applied: { entries: 0, cues: 0, address: 0, docs: 0, suspicion: 0, newPeople: [], notes: 0, identity: false, taste: 0, openness: 0, factions: 0 }, dropped: [], held: [] };
  const drop = (kind: string, item: unknown, reason: string, who?: string) => report.dropped.push({ kind, who, reason, item });
  const roleWords = ctx.roleWords ?? ROLE_WORDS;
  const seqs = new Map<string, number>();
  const nextSeq = (anchor: string) => {
    const n = (seqs.get(anchor) ?? 0) + 1;
    seqs.set(anchor, n);
    return n;
  };
  /** m 꼬리표 → 확정 메시지. 인용이 그 메시지에 있어야 */
  const evidence = (m: string, quote: string): { anchor: string; index: number } | string => {
    const idx = input.tags.get(m);
    if (idx === undefined || !input.confirmed.has(idx)) return '확정 구간 밖 메시지';
    const q = norm(quote);
    if (!q || q.length < 3) return '인용 없음';
    if (!norm(messageText(str(list[idx].data))).includes(q)) return '인용이 원문에 없음';
    return { anchor: messageKey(list[idx], idx), index: idx };
  };
  /** 인용 없이 기준 메시지만 (문서용) */
  const evidenceLoose = (m: unknown): { anchor: string; index: number } | string => {
    const idx = input.tags.get(str(m));
    if (idx === undefined || !input.confirmed.has(idx)) return '확정 구간 밖 메시지';
    return { anchor: messageKey(list[idx], idx), index: idx };
  };
  const nameOf = (who: string): string | null => resolveName(who, store, input.names);

  // 1. 새 인물 먼저 (그래야 아래 항목이 이름을 찾는다)
  let newCount = 0;
  for (const n of r.new_people ?? []) {
    const name = plain(n?.name, 40);
    if (!name) {
      drop('new_people', n, '이름 없음');
      continue;
    }
    if (nameOf(name)) {
      drop('new_people', n, '이미 있는 인물(별명 포함)', name);
      continue;
    }
    if (ctx.exclude?.some((x) => norm(x) === norm(name) || (Array.isArray(n.aliases) && n.aliases.some((a) => norm(String(a)) === norm(x))))) {
      drop('new_people', n, '유저가 연기하는 요원', name);
      continue;
    }
    if (store.ignored.includes(name)) {
      drop('new_people', n, '사용자가 무시한 이름', name);
      continue;
    }
    if (roleWords.has(name) || /^[가-힣]{1,3}\s?(기사|점원|경비|행인|직원|손님)$/.test(name)) {
      drop('new_people', n, '역할 명사', name);
      continue;
    }
    const ev = evidence(n.m, n.quote);
    if (typeof ev === 'string') {
      drop('new_people', n, ev, name);
      continue;
    }
    if (newCount >= 2) {
      drop('new_people', n, '턴당 2명 상한', name);
      continue;
    }
    const aliases = Array.isArray(n.aliases) ? n.aliases.map((a) => plain(a, 40)).filter(Boolean) : [];
    // 2턴 규칙: 처음 본 이름은 대기, 다른 기준 메시지에서 다시 나오면 등록
    const pend = store.pending[name];
    if (ctx.settings.twoTurn && !pend) {
      store.pending[name] = { anchor: ev.anchor, aliases };
      report.held.push({ kind: 'new_people', who: name, reason: '2턴 규칙: 대기', item: n });
      continue;
    }
    if (ctx.settings.twoTurn && pend && pend.anchor === ev.anchor) {
      report.held.push({ kind: 'new_people', who: name, reason: '2턴 규칙: 같은 턴', item: n });
      continue;
    }
    if (ctx.settings.newPeople === 'confirm') {
      store.pending[name] = { anchor: ev.anchor, aliases: [...new Set([...(pend?.aliases ?? []), ...aliases])] };
      report.held.push({ kind: 'new_people', who: name, reason: '확인 뒤 등록', item: n });
      continue;
    }
    const sheet = ctx.sheetOf?.(name) ?? null;
    const base = ctx.baseOf?.(name) ?? {};
    const p = seedPerson(name, sheet, { ...base, aliases: [...new Set([...(base.aliases ?? []), ...(pend?.aliases ?? []), ...aliases])] }, ctx.now);
    store.people[name] = p;
    delete store.pending[name];
    const seq0 = nextSeq(ev.anchor);
    if (n.identity && !sheet) putEntry(store, name, 'identity', { id: entryId(name, 'identity', ev.anchor, seq0, n.identity), text: n.identity, src: 'story', anchor: ev.anchor, seq: seq0, quote: n.quote });
    if (n.speech) putEntry(store, name, 'speech', { id: entryId(name, 'speech', ev.anchor, seq0 + 1, n.speech), text: n.speech, src: 'story', anchor: ev.anchor, seq: seq0 + 1, quote: n.quote, target: '@user' });
    report.applied.newPeople.push(name);
    newCount++;
  }

  // 2. 칸 항목
  const perPerson = new Map<string, number>();
  for (const e of r.entries ?? []) {
    const who = nameOf(str(e?.who));
    if (!who) {
      drop('entry', e, '명단에 없는 이름', str(e?.who));
      continue;
    }
    const slot = e.slot as SlotId;
    if (!SLOTS.includes(slot) || (slot === 'suspicion')) {
      drop('entry', e, '없는 칸', who);
      continue;
    }
    // merge(정리)는 인용 없이 기준 메시지만, 그 밖은 인용이 원문에 있어야
    const ev = e.op === 'merge' ? evidenceLoose(e.m) : evidence(e.m, e.quote);
    if (typeof ev === 'string') {
      drop('entry', e, ev, who);
      continue;
    }
    const n = (perPerson.get(who) ?? 0) + 1;
    if (n > (input.tidy.includes(who) ? 24 : 8)) {
      drop('entry', e, input.tidy.includes(who) ? '정리 인물당 24개 상한' : '인물당 8개 상한', who);
      continue;
    }
    perPerson.set(who, n);
    const cur = liveEntries(store.people[who].slots[slot], live);
    const op = e.op;
    if (op === 'merge') {
      // 합치기 (저장 상한을 넘긴 인물만): 둘 이상의 살아 있는 비고정 항목을 한 줄로. 합친 항목이 죽으면 원본이 되살아난다
      if (!input.tidy.includes(who)) {
        drop('entry', e, '정리 대상이 아닌 인물의 merge', who);
        continue;
      }
      const from = Array.isArray(e.from) ? [...new Set(e.from.map((x) => String(x)))] : [];
      const srcs = from.map((id) => cur.find((x) => x.id === id)).filter((x): x is Entry => !!x);
      if (srcs.length < 2 || srcs.length !== from.length) {
        drop('entry', e, 'from 이 이 칸의 살아 있는 항목 2개 이상이 아님', who);
        continue;
      }
      if (srcs.some((x) => x.pin)) {
        drop('entry', e, '고정된 항목을 합치려 함', who);
        continue;
      }
      const text = plain(e.text, 300);
      if (!text) {
        drop('entry', e, '본문 없음', who);
        continue;
      }
      const seq = nextSeq(ev.anchor);
      const target = srcs[0].target;
      if (putEntry(store, who, slot, { id: entryId(who, slot, ev.anchor, seq, text), text, src: 'story', anchor: ev.anchor, seq, from, ...(target ? { target } : {}) })) report.applied.entries++;
      continue;
    }
    if (op === 'remove') {
      const target = cur.find((x) => x.id === e.replace);
      if (!target) {
        drop('entry', e, 'replace 가 실제 항목이 아님', who);
        continue;
      }
      if (target.pin) {
        drop('entry', e, '고정된 항목', who);
        continue;
      }
      if (!/끝|해소|풀|지켰|이행|완료|회복|나았|돌아|밝혀|밝혔|사라|아니었|아님|취소|resolved|done|no longer|healed|revealed/i.test(e.quote + ' ' + (e.text ?? ''))) {
        report.held.push({ kind: 'entry', who, reason: '삭제 근거가 분명하지 않음', item: e });
        continue;
      }
      // 삭제 = 빈 텍스트로 대체하는 항목 (대체 항목이 죽으면 이전 항목이 돌아온다)
      const seq = nextSeq(ev.anchor);
      putEntry(store, who, slot, { id: entryId(who, slot, ev.anchor, seq, `-${target.id}`), text: `(해소) ${target.text}`.slice(0, 200), src: 'story', anchor: ev.anchor, seq, quote: e.quote, replaces: target.id, ...(target.target ? { target: target.target } : {}) });
      report.applied.entries++;
      continue;
    }
    const text = plain(e.text, 200);
    if (!text) {
      drop('entry', e, '본문 없음', who);
      continue;
    }
    let replaces: string | undefined;
    if (op === 'upsert') {
      const target = cur.find((x) => x.id === e.replace);
      if (!target) {
        drop('entry', e, 'replace 가 실제 항목이 아님', who);
        continue;
      }
      if (target.pin) {
        drop('entry', e, '고정된 항목', who);
        continue;
      }
      if (similar(target.text, text)) {
        drop('entry', e, '바뀐 내용이 없음', who);
        continue;
      }
      replaces = target.id;
    } else if (op === 'add') {
      if (cur.some((x) => similar(x.text, text))) {
        drop('entry', e, '같은 뜻의 항목이 이미 있음', who);
        continue;
      }
    } else {
      drop('entry', e, '없는 연산', who);
      continue;
    }
    const seq = nextSeq(ev.anchor);
    const target = typeof e.target === 'string' && e.target ? (e.target === '@user' ? '@user' : nameOf(e.target) ?? plain(e.target, 40)) : undefined;
    if (putEntry(store, who, slot, { id: entryId(who, slot, ev.anchor, seq, text), text, src: 'story', anchor: ev.anchor, seq, quote: e.quote, ...(target ? { target } : {}), ...(replaces ? { replaces } : {}) })) report.applied.entries++;
  }

  // 3. 호감 계기
  if (ctx.settings.features.has('affinity')) {
    const perCue = new Map<string, number>();
    const changes = liveChanges(store, live);
    for (const c of r.cues ?? []) {
      const who = nameOf(str(c?.who));
      if (!who) {
        drop('cue', c, '명단에 없는 이름', str(c?.who));
        continue;
      }
      if (!CUES.includes(c.cue as Cue)) {
        drop('cue', c, '표에 없는 계기', who);
        continue;
      }
      const ev = evidence(c.m, c.quote);
      if (typeof ev === 'string') {
        drop('cue', c, ev, who);
        continue;
      }
      const n = (perCue.get(who) ?? 0) + 1;
      if (n > 2) {
        drop('cue', c, '인물당 2개 상한', who);
        continue;
      }
      perCue.set(who, n);
      if (changes.some((x) => x.kind === 'cue' && x.who === who && x.anchor === ev.anchor && x.cue === c.cue)) {
        drop('cue', c, '같은 메시지에 같은 계기가 이미 있음', who);
        continue;
      }
      const seq = nextSeq(ev.anchor);
      if (putChange(store, { id: changeId(who, 'cue', ev.anchor, seq, c.cue), anchor: ev.anchor, seq, src: 'story', who, kind: 'cue', cue: c.cue as Cue, quote: c.quote, reason: plain(c.reason, 40) || c.cue })) report.applied.cues++;
    }
  }

  // 3b. 취향 띠: 처음은 어떤 값이든(배경에서 한 번), 그 뒤 오를 땐 한 칸씩, 내릴 땐 여러 칸. 인물당 1개
  if (ctx.settings.features.has('taste')) {
    const changes = liveChanges(store, live);
    const seen = new Set<string>();
    for (const t of r.taste ?? []) {
      const who = nameOf(str(t?.who));
      if (!who) {
        drop('taste', t, '명단에 없는 이름', str(t?.who));
        continue;
      }
      const band = Number(t.band);
      if (!Number.isInteger(band) || band < TASTE_MIN || band > TASTE_MAX) {
        drop('taste', t, '띠는 -3~3 정수', who);
        continue;
      }
      const ev = evidence(t.m, t.quote);
      if (typeof ev === 'string') {
        drop('taste', t, ev, who);
        continue;
      }
      if (seen.has(who)) {
        drop('taste', t, '인물당 1개', who);
        continue;
      }
      const cur = tasteOf(store.people[who], changes);
      if (cur !== null && band === cur) {
        drop('taste', t, '바뀐 값이 아님', who);
        continue;
      }
      if (cur !== null && band > cur + 1) {
        drop('taste', t, '오를 땐 한 번에 한 칸', who);
        continue;
      }
      seen.add(who);
      const seq = nextSeq(ev.anchor);
      if (putChange(store, { id: changeId(who, 'taste', ev.anchor, seq, String(band)), anchor: ev.anchor, seq, src: 'story', who, kind: 'taste', band, quote: t.quote, reason: plain(t.reason, 60) || (cur === null ? '첫인상' : `취향 ${cur} → ${band}`) })) report.applied.taste++;
    }
  }

  // 3c. 음란도: 시작값은 표의 값 중 하나로 한 번만, 그 뒤는 새 반응마다 표의 변화량. 기준 메시지당 합 -5~+10 은 계산에서
  if (ctx.settings.features.has('openness')) {
    const changes = liveChanges(store, live);
    const perWho = new Map<string, number>();
    const inited = new Set<string>();
    for (const x of r.openness ?? []) {
      const who = nameOf(str(x?.who));
      if (!who) {
        drop('openness', x, '명단에 없는 이름', str(x?.who));
        continue;
      }
      const ev = evidence(x.m, x.quote);
      if (typeof ev === 'string') {
        drop('openness', x, ev, who);
        continue;
      }
      const cur = opennessOf(store.people[who], changes);
      const seq = nextSeq(ev.anchor);
      if (x.op === 'init') {
        const value = Number(x.value);
        if (cur !== null || inited.has(who)) {
          drop('openness', x, '이미 시작값이 있음', who);
          continue;
        }
        if (!OPENNESS_BASELINES.includes(value)) {
          drop('openness', x, '시작값은 0·90·150·210·270 중 하나', who);
          continue;
        }
        inited.add(who);
        if (putChange(store, { id: changeId(who, 'openness', ev.anchor, seq, `init${value}`), anchor: ev.anchor, seq, src: 'story', who, kind: 'openness', init: value, quote: x.quote, reason: plain(x.reason, 60) || `시작값 ${value}` })) report.applied.openness++;
        continue;
      }
      if (x.op !== 'event') {
        drop('openness', x, '없는 연산', who);
        continue;
      }
      const delta = Number(x.delta);
      if (!OPENNESS_DELTAS.includes(delta)) {
        drop('openness', x, '변화량은 +1·+3·+5·+10·-2·-4·-5 중 하나', who);
        continue;
      }
      if (cur === null && !inited.has(who)) {
        drop('openness', x, '시작값이 없는 인물 (먼저 init)', who);
        continue;
      }
      const n = (perWho.get(who) ?? 0) + 1;
      if (n > 3) {
        drop('openness', x, '인물당 3개 상한', who);
        continue;
      }
      perWho.set(who, n);
      if (putChange(store, { id: changeId(who, 'openness', ev.anchor, seq, `d${delta}|${plain(x.reason, 40)}`), anchor: ev.anchor, seq, src: 'story', who, kind: 'openness', delta, quote: x.quote, reason: plain(x.reason, 60) })) report.applied.openness++;
    }
  }

  // 4. 호칭
  if (ctx.settings.features.has('register')) {
    for (const a of r.address ?? []) {
      const who = nameOf(str(a?.who));
      if (!who) {
        drop('address', a, '명단에 없는 이름', str(a?.who));
        continue;
      }
      if (store.people[who].address.pin) {
        drop('address', a, '고정된 호칭', who);
        continue;
      }
      const ev = evidence(a.m, a.quote);
      if (typeof ev === 'string') {
        drop('address', a, ev, who);
        continue;
      }
      const toUser = plain(a.toUser, 20);
      const register = REGISTERS.includes(a.register as Register) ? (a.register as Register) : null;
      if (!toUser || !register) {
        drop('address', a, '호칭·존댓말 값이 없음', who);
        continue;
      }
      const seq = nextSeq(ev.anchor);
      if (putChange(store, { id: changeId(who, 'address', ev.anchor, seq, `${toUser}|${register}`), anchor: ev.anchor, seq, src: 'story', who, kind: 'address', toUser, register, quote: a.quote, reason: `호칭 → ${toUser} (${register})` })) report.applied.address++;
    }
  }

  // 5. 문서
  for (const d of r.docs ?? []) {
    const type = d?.type as DocType;
    if (!DOC_TYPES.includes(type) || !ctx.settings.features.has(docFeature(type) as Feature)) {
      drop('doc', d, '없는 문서 종류 또는 꺼진 기능');
      continue;
    }
    const key = plain(d.key, 40);
    // 문서는 구간 전체를 요약한 것이라 인용이 없어도 받는다 (기준 메시지만 확정 구간이면). 인용이 있으면 원문에 있어야
    const ev = norm(str(d?.quote)).length >= 3 ? evidence(d.m, d.quote) : evidenceLoose(d?.m);
    if (!key || typeof ev === 'string') {
      drop('doc', d, typeof ev === 'string' ? ev : '이름 없음');
      continue;
    }
    const doc = store.docs[`${type}:${key}`];
    const cur = doc ? liveEntries(doc.entries, live) : [];
    const text = plain(d.text, 200);
    if (type === 'rhythm' && text && !rhythmTextOk(key, text)) {
      drop('doc', d, '리듬 문서 본문 표식이 없음 ([phase:…] 또는 [hook:…])', key);
      continue;
    }
    let replaces: string | undefined;
    if (d.op === 'upsert' || d.op === 'remove') {
      const target = cur.find((x) => x.id === d.replace);
      if (!target) {
        drop('doc', d, 'replace 가 실제 항목이 아님');
        continue;
      }
      if (target.pin) {
        drop('doc', d, '고정된 항목');
        continue;
      }
      replaces = target.id;
    }
    if (d.op !== 'remove' && !text) {
      drop('doc', d, '본문 없음');
      continue;
    }
    if (d.op === 'add' && cur.some((x) => similar(x.text, text))) {
      drop('doc', d, '같은 뜻의 항목이 이미 있음');
      continue;
    }
    const seq = nextSeq(ev.anchor);
    const body = d.op === 'remove' ? `(해소) ${cur.find((x) => x.id === replaces)!.text}`.slice(0, 200) : text;
    if (putDoc(store, type, key, { id: entryId(`${type}:${key}`, 'doc', ev.anchor, seq, body), text: body, src: 'story', anchor: ev.anchor, seq, ...(norm(str(d.quote)).length >= 3 ? { quote: d.quote } : {}), ...(replaces ? { replaces } : {}), ...(d.date ? { date: plain(d.date, 20) } : {}), ...(d.place ? { place: plain(d.place, 40) } : {}), ...(Array.isArray(d.who) ? { who: d.who.map((w) => plain(w, 30)).filter(Boolean).slice(0, 8) } : {}) })) report.applied.docs++;
  }

  // 6. 의심 (인물의 suspicion 칸, 대상·종류 있음)
  if (ctx.settings.features.has('suspicion')) {
    for (const s of r.suspicion ?? []) {
      const who = nameOf(str(s?.who));
      if (!who) {
        drop('suspicion', s, '명단에 없는 이름', str(s?.who));
        continue;
      }
      if (!SUSP_KINDS.has(str(s.kind))) {
        drop('suspicion', s, '없는 의심 종류', who);
        continue;
      }
      const ev = evidence(s.m, s.quote);
      if (typeof ev === 'string') {
        drop('suspicion', s, ev, who);
        continue;
      }
      const target = s.target === '@user' ? '@user' : nameOf(str(s.target)) ?? plain(s.target, 30);
      const text = plain(s.text, 200);
      if (!target || !text) {
        drop('suspicion', s, '대상 또는 본문 없음', who);
        continue;
      }
      const cur = liveEntries(store.people[who].slots.suspicion, live).filter((x) => x.target === target && x.kind === s.kind);
      const seq = nextSeq(ev.anchor);
      const tag = s.op === 'clue' && s.weight && s.weight in SUSP_WEIGHT ? `·${s.weight}` : s.op === 'respond' && s.stage && /^(지켜봄|시험|대면|보고)$/.test(s.stage) ? `·${s.stage}` : s.op === 'close' && s.result && /^(확인|해소|묻음)$/.test(s.result) ? `·${s.result}` : '';
      const prefix = s.op === 'open' ? '[시작] ' : s.op === 'clue' ? `[단서${tag}] ` : s.op === 'respond' ? `[반응${tag}] ` : s.op === 'close' ? `[해소${tag}] ` : '';
      if (!prefix) {
        drop('suspicion', s, '없는 연산', who);
        continue;
      }
      if (cur.some((x) => similar(x.text, prefix + text))) {
        drop('suspicion', s, '같은 뜻의 항목이 이미 있음', who);
        continue;
      }
      // close 는 그 대상·종류의 살아 있는 항목을 모두 대체 (하나로 접음)
      const replaces = s.op === 'close' ? cur.at(-1)?.id : undefined;
      if (putEntry(store, who, 'suspicion', { id: entryId(who, 'suspicion', ev.anchor, seq, prefix + text), text: prefix + text, src: 'story', anchor: ev.anchor, seq, quote: s.quote, target, kind: s.kind, ...(replaces ? { replaces } : {}) })) report.applied.suspicion++;
    }
  }

  // 6b. 세력 평판 계기: 그 세력이 유저를 보는 눈이 바뀔 만한 일인지는 모델이 판단 (사용자 2026-10-26). 코드는 이름→코드, 인용, 세력당 1건, 같은 메시지 중복만 검사
  if (ctx.settings.features.has('faction_rep')) {
    const changes = liveChanges(store, live);
    const seen = new Set<string>();
    const known = knownFactionCodes(store, input.factionNames);
    for (const f of r.faction_cues ?? []) {
      const raw = str(f?.faction).trim();
      const code = known.includes(raw) ? raw : factionCode(raw) || known.find((c) => input.factionNames[c] && raw && input.factionNames[c] === raw) || '';
      if (!code) {
        drop('faction', f, '모르는 세력 이름', raw);
        continue;
      }
      if (!CUES.includes(f.cue as Cue)) {
        drop('faction', f, '표에 없는 계기', code);
        continue;
      }
      const ev = evidence(f.m, f.quote);
      if (typeof ev === 'string') {
        drop('faction', f, ev, code);
        continue;
      }
      if (seen.has(code)) {
        drop('faction', f, '세력당 1건', code);
        continue;
      }
      const who = factionWho(code);
      if (changes.some((x) => x.kind === 'cue' && x.who === who && x.anchor === ev.anchor && x.cue === f.cue)) {
        drop('faction', f, '같은 메시지에 같은 계기가 이미 있음', code);
        continue;
      }
      seen.add(code);
      if (!store.factions[code]) store.factions[code] = { code, name: factionNameOf(code, input.factionNames, store), seeded: { at: ctx.now ?? new Date().toISOString() } };
      const seq = nextSeq(ev.anchor);
      if (putChange(store, { id: changeId(who, 'cue', ev.anchor, seq, f.cue), anchor: ev.anchor, seq, src: 'story', who, kind: 'cue', cue: f.cue as Cue, quote: f.quote, reason: plain(f.reason, 40) })) report.applied.factions++;
    }
  }

  // 7. 유저 신분 (상태창에 없을 때 참고값)
  if (r.identity && (r.identity.faction || r.identity.rank) && (!store.identity || store.identity.from !== 'status')) {
    const anchor = messageKey(list[Math.max(...input.indexes)], Math.max(...input.indexes));
    store.identity = { faction: plain(r.identity.faction, 20), rank: plain(r.identity.rank, 20), level: null, from: 'scan', anchor };
    report.applied.identity = true;
  }

  // 8. 다음 턴 메모 (사실형 Director)
  if (ctx.settings.director === 'facts') {
    const anchor = messageKey(list[Math.max(...input.indexes)], Math.max(...input.indexes));
    for (const n of r.next_note ?? []) {
      const who = nameOf(str(n?.who));
      if (!who || !input.people.includes(who)) {
        drop('note', n, '장면 인물이 아님', str(n?.who));
        continue;
      }
      const now = plain(n.now, 160);
      const mustNot = Array.isArray(n.must_not_reveal) ? n.must_not_reveal.map((x) => plain(x, 100)).filter(Boolean).slice(0, 5) : [];
      if (!now && !mustNot.length) continue;
      const seq = nextSeq(anchor);
      if (putChange(store, { id: changeId(who, 'note', anchor, seq, now + mustNot.join('|')), anchor, seq, src: 'story', who, kind: 'note', now, mustNot, reason: '다음 턴 메모' })) report.applied.notes++;
    }
  }

  // 8b. 서사 리듬 메모 (사실형 Director, 장면 전체): 인물이 아니라 '@rhythm' 에 둔다
  if (ctx.settings.features.has('rhythm') && ctx.settings.director === 'facts') {
    const now = plain(r.rhythm_note, 200);
    if (now) {
      const anchor = messageKey(list[Math.max(...input.indexes)], Math.max(...input.indexes));
      const seq = nextSeq(anchor);
      if (putChange(store, { id: changeId('@rhythm', 'note', anchor, seq, now), anchor, seq, src: 'story', who: '@rhythm', kind: 'note', now, reason: '리듬 메모' })) report.applied.notes++;
    }
  }

  markRead(store, chat, input.indexes);
  return report;
}

/** 리듬 문서 본문 표식: scene 은 `[phase:build_up][engagement:active]`, hook:* 은 `[stage:seeded][tier:short]` 로 시작해야 */
export function rhythmTextOk(key: string, text: string): boolean {
  if (key === 'scene') {
    const m = /^\[phase:([a-z_]+)\]\s*\[engagement:([a-z_]+)\]/.exec(text);
    return !!m && (RHYTHM_PHASES as readonly string[]).includes(m[1]) && (RHYTHM_ENGAGEMENT as readonly string[]).includes(m[2]);
  }
  if (key.startsWith('hook:')) {
    const m = /^\[stage:([a-z_]+)\]\s*\[tier:([a-z]+)\]/.exec(text);
    return !!m && (RHYTHM_HOOK_STAGES as readonly string[]).includes(m[1]) && (RHYTHM_HOOK_TIERS as readonly string[]).includes(m[2]);
  }
  return key === 'chapter' || key === 'arc' || key === 'pending';
}

/** 이 인물의 가장 최근 다음 턴 메모 (살아 있는 것) */
export function latestNote(store: PeopleStore, who: string, live: Liveness): { now?: string; mustNot?: string[] } | null {
  const n = [...store.log].reverse().find((c) => c.kind === 'note' && c.who === who && isAlive(c, live));
  return n ? { now: n.now, mustNot: n.mustNot } : null;
}

export { entriesOf };
