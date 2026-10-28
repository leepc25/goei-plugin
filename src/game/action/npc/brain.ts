// NPC 자유 대화의 판단 부분 (화면 없음, 시험은 tests/npc.test.mjs).
//   buildPrompt  인물 시트 + 게임 역할·말투 + 지금 상황 + 쓸 수 있는 태그 → 모델에 보낼 메시지
//   parseReply   모델 답 → 화면에 보일 대사와 태그
//   decide       태그 → 실제로 일어날 일. 게임이 판정한다: 모델이 써도 규칙에 안 맞으면 버린다 (설계안 4장)
//   Relations    NPC마다 호감(-3~+3)·대화 기록·기억할 일. 이름 있는 사람만 저장한다
import type { AgentId } from '../story/types';
import { ROSTER, type EffectKind, type NpcDef } from './roster';

export interface TalkMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}
export type TalkModel = (messages: TalkMessage[], opts: { signal: AbortSignal }) => Promise<string>;

export interface TalkHint {
  id: string;
  text: string;
}

/** 대화창 아래 버튼 (원래 E로 하던 일: 임무 창구, 거래, 돕기·무시·뺏기 …) */
export interface TalkAction {
  id: string;
  label: string;
  /** E·1번 키 = 첫 버튼 */
  run(): void;
  /** 누른 뒤에도 대화창을 열어 둔다 */
  keep?: boolean;
}

export interface AppliedEffect {
  kind: EffectKind;
  /** favor: 오르내린 값 */
  delta?: number;
  /** hint: 고른 단서 · gift: 아이템 id */
  hint?: TalkHint;
  item?: string;
  /** 대화창에 보일 한 줄 (「거래창이 열립니다」) */
  note: string;
}

/** 게임 쪽이 대화를 열 때 넘기는 것 */
export interface TalkTarget {
  /** ROSTER id */
  npc: string;
  /** 호감을 기억할 열쇠. 이름 있는 사람은 비워 둔다(= npc). 이름 없는 승객·주민은 그 판의 id (저장하지 않음) */
  key?: string;
  /** 화면 이름 (예: 삼 년째 승객) */
  name?: string;
  /** 이름 없는 사람의 성격·사연 한두 줄 */
  persona?: string;
  /** 이 사람만 아는 진실 (거짓말하는 승객 등). 모델에게만 주고 말하지 말라고 한다 */
  secret?: string;
  /** 장소 설명 (예: 본부 3층 큰 사무실, B-4 재현의 층 복도) */
  place: string;
  /** 상황 사실 몇 줄 */
  facts?: string[];
  /** 알려 줄 수 있는 진짜 단서. 모델은 번호만 고른다 */
  hints?: TalkHint[];
  actions?: TalkAction[];
  /** 이번 만남에서 허락하는 일 (인물의 effects와 겹치는 것만) */
  allow?: EffectKind[];
  greet?: string;
  /** 창을 열 때 보일 안내 줄 (예: 로제몬이 읽은 속마음) */
  notes?: string[];
  gifts?: string[];
  /** 동행할 수 있는 상황인가 (자리·조건). 없으면 join을 버린다 */
  canJoin?: boolean;
  onEffect?(e: AppliedEffect): void;
  onClose?(): void;
}

/** 본편 스냅숏에서 대화에 넣을 것 (설계안 8장). 2~3줄만 */
export interface MetaInfo {
  /** 이 NPC가 본편 명부 요원이면 그 상태 */
  self?: { state: string; situation: string };
  /** 지금 상황판 사건 */
  events?: string[];
  /** 본편 최근 채팅 요약 (설정에서 켰을 때만) */
  recent?: string[];
}

export const FAVOR_MIN = -3;
export const FAVOR_MAX = 3;
const clamp = (v: number) => Math.max(FAVOR_MIN, Math.min(FAVOR_MAX, v));

export const FAVOR_WORD = (f: number) => (f <= -3 ? '적의' : f <= -2 ? '경계' : f <= -1 ? '언짢음' : f === 0 ? '보통' : f === 1 ? '호의' : f === 2 ? '신뢰' : '각별');

// ── 관계 ─────────────────────────────────────────────

export interface Relation {
  favor: number;
  /** 대화한 횟수 */
  met: number;
  /** 최근 대화 (모델에 다시 준다) */
  log: TalkMessage[];
  /** 기억할 일 (거래함, 동행함, 화나게 함) 최근 3개 */
  memo: string[];
  /** 마지막으로 선물한 날 (본부 일차) */
  giftDay?: number;
}

export interface RelationStore {
  load(): string | null;
  save(s: string): void;
}

export class Relations {
  private map = new Map<string, Relation>();
  /** 저장하지 않는 사람 (이름 없는 승객·주민·민간인) */
  private temp = new Set<string>();
  constructor(private store?: RelationStore) {
    try {
      const raw = store?.load();
      const obj = raw ? (JSON.parse(raw) as Record<string, Relation>) : {};
      for (const [k, v] of Object.entries(obj)) if (v && typeof v.favor === 'number') this.map.set(k, { favor: clamp(v.favor), met: v.met | 0, log: Array.isArray(v.log) ? v.log.slice(-12) : [], memo: Array.isArray(v.memo) ? v.memo.slice(-3) : [], giftDay: v.giftDay });
    } catch {
      /* 깨진 저장은 버린다 */
    }
  }
  get(key: string, temp = false): Relation {
    let r = this.map.get(key);
    if (!r) {
      r = { favor: 0, met: 0, log: [], memo: [] };
      this.map.set(key, r);
      if (temp) this.temp.add(key);
    }
    return r;
  }
  favor(key: string, delta: number): number {
    const r = this.get(key);
    r.favor = clamp(r.favor + delta);
    return r.favor;
  }
  remember(key: string, line: string) {
    const r = this.get(key);
    r.memo = [...r.memo.filter((m) => m !== line), line].slice(-3);
  }
  /** 판이 끝나면 이름 없는 사람은 잊는다 */
  forgetTemp() {
    for (const k of this.temp) this.map.delete(k);
    this.temp.clear();
  }
  save() {
    const out: Record<string, Relation> = {};
    for (const [k, v] of this.map) if (!this.temp.has(k)) out[k] = { ...v, log: v.log.slice(-12) };
    try {
      this.store?.save(JSON.stringify(out));
    } catch {
      /* 저장 못 해도 진행 */
    }
  }
  snapshot(): Record<string, number> {
    return Object.fromEntries([...this.map].map(([k, v]) => [k, v.favor]));
  }
}

// ── 시트 ─────────────────────────────────────────────

const DROP = new Set(['Appearance']);
const CAP: Record<string, number> = { Background: 2, Abilities: 2 };
const LIMIT = 2600;

/** 로어북 인물 시트에서 대화에 필요 없는 칸(외모)을 빼고 줄인다. tools/npc_sheets.py와 같은 규칙 */
export function trimSheet(text: string): string {
  const parts = text.replace(/^@@[^\n]*\n?/gm, '').trim().split(/^(#### .+)$/m);
  const out = [parts[0].trim()];
  for (let i = 1; i < parts.length; i += 2) {
    const head = parts[i].slice(5).trim();
    if (DROP.has(head)) continue;
    let lines = (parts[i + 1] ?? '')
      .trim()
      .split('\n')
      .filter((l) => l.trim() && l.trim() !== '---');
    if (CAP[head]) {
      const keep: string[] = [];
      let n = 0;
      for (const l of lines) {
        if (l.trimStart().startsWith('- ') && ++n > CAP[head]) break;
        keep.push(l);
      }
      lines = keep;
    }
    out.push(`#### ${head}\n${lines.join('\n')}`);
  }
  const s = out.filter(Boolean).join('\n\n');
  return s.length <= LIMIT ? s : s.slice(0, LIMIT).replace(/\n[^\n]*$/, '');
}

// ── 프롬프트 ─────────────────────────────────────────

const TAG_WORD: Record<EffectKind, string> = { favor: '호감', trade: '거래', join: '동행', hostile: '적대', leave: '떠남', hint: '힌트', gift: '선물', calm: '진정' };
const TAG_HELP: Record<EffectKind, string> = {
  favor: '[[호감 +1]] 상대가 마음에 들었을 때, [[호감 -1]] 기분이 상했을 때. 그냥 말만 주고받았으면 쓰지 않는다',
  trade: '[[거래]] 물건을 사고팔거나 일을 맡기자고 할 때 (가게 창이 열린다)',
  join: '[[동행]] 함께 가거나 같이 싸우기로 했을 때',
  hostile: '[[적대]] 더는 못 참고 싸우거나 해치려 할 때. 이미 많이 화가 난 상태에서만',
  leave: '[[떠남]] 대화를 끝내고 이 자리를 떠날 때',
  hint: '[[힌트 번호]] 아래 단서 중 하나를 알려 줄 때. 단서 내용은 네 말로 바꿔서 말한다',
  gift: '[[선물 아이템]] 아래 물건 하나를 건넬 때',
  calm: '[[진정]] 화가 풀렸을 때',
};

export function allowedEffects(def: NpcDef, t: TalkTarget): EffectKind[] {
  let list = def.effects.filter((e) => !t.allow || t.allow.includes(e));
  if (!t.actions?.some((a) => a.id === 'trade')) list = list.filter((e) => e !== 'trade');
  if (!t.hints?.length) list = list.filter((e) => e !== 'hint');
  if (!(t.gifts ?? def.gifts)?.length) list = list.filter((e) => e !== 'gift');
  if (!t.canJoin) list = list.filter((e) => e !== 'join');
  return list;
}

export interface PromptIn {
  def: NpcDef;
  target: TalkTarget;
  /** 줄인 인물 시트 (CBS 푼 것) */
  sheet?: string;
  agent: { id: AgentId; name: string; title: string; voice: string };
  rel: Relation;
  meta?: MetaInfo | null;
  text: string;
}

export function buildPrompt(p: PromptIn): TalkMessage[] {
  const { def, target: t, rel } = p;
  const name = t.name ?? def.name;
  const effects = allowedEffects(def, t);
  const situation = [
    `장소: ${t.place}`,
    `말을 거는 사람: ${p.agent.name} (관리국 ${p.agent.title}). 말투: ${p.agent.voice}`,
    `이 사람에 대한 네 마음: ${FAVOR_WORD(rel.favor)} (호감 ${rel.favor > 0 ? '+' : ''}${rel.favor}, -3~+3)`,
    rel.met ? `이전에 ${rel.met}번 이야기했다.` : '처음 만났다.',
    ...rel.memo.map((m) => `지난 일: ${m}`),
    ...(t.facts ?? []),
    ...(p.meta?.self ? [`본편 현재 네 상태: ${p.meta.self.state}${p.meta.self.situation ? ` — ${p.meta.self.situation}` : ''}`] : []),
    ...(p.meta?.events?.length ? [`요즘 관리국 상황판 소식: ${p.meta.events.slice(0, 3).join(' / ')}`] : []),
  ];
  const parts = [
    `너는 「괴이 ː ANOMALY」 필드 게임 속 인물 「${name}」이다. 괴이 롤플레이 「괴이 ː ANOMALY」 세계관이다. 지금 플레이어가 조종하는 관리국 요원과 마주 보고 말한다.`,
    p.sheet ? `[인물 시트: 본편 설정. 영어로 적혀 있지만 대답은 한국어로]\n${p.sheet}` : '',
    t.persona ? `[이 사람]\n${t.persona}` : '',
    `[게임 속 역할] ${def.role}`,
    `[말투] ${def.speech}`,
    `[지금 상황]\n- ${situation.join('\n- ')}`,
    p.meta?.recent?.length ? `[본편 최근 장면: 참고만 하고 이어서 말하지 않는다]\n${p.meta.recent.join('\n')}` : '',
    t.secret ? `[비밀: 입 밖에 내지 말고 말과 행동에만 반영한다]\n${t.secret}` : '',
    effects.length
      ? `[행동 태그] 대사 다음 줄에 해당하는 것만 0~2개 쓴다. 해당 없으면 쓰지 않는다.\n- ${effects.map((e) => TAG_HELP[e]).join('\n- ')}` +
        (effects.includes('hint') ? `\n단서: ${t.hints!.map((h, i) => `${i + 1}) ${h.text}`).join(' ')}` : '') +
        (effects.includes('gift') ? `\n줄 수 있는 물건: ${(t.gifts ?? def.gifts)!.join(', ')}` : '')
      : '',
    `[하지 않는 것] ${[...(def.never ?? []), '상대의 대사나 행동을 대신 쓰지 않는다', '모르는 설정을 지어내지 않고 모르면 모른다고 넘긴다', '게임 밖 이야기(현실, AI)를 하지 않는다'].join(' / ')}.`,
    def.minor ? '[주의] 이 인물은 미성년자다. 성적인 이야기, 노출, 씻기·옷 갈아입기 이야기는 어떤 경우에도 하지 않고 화제를 돌린다.' : '',
    '[형식] 한국어 대사만 1~3문장, 140자 이내. 이름표·따옴표·괄호 지문·별표를 쓰지 않는다. 태그는 대사 뒤 새 줄에만.',
  ];
  const system = parts.filter(Boolean).join('\n\n');
  return [{ role: 'system', content: system }, ...rel.log.slice(-8), { role: 'user', content: p.text }];
}

// ── 답 읽기 ─────────────────────────────────────────

export interface RawTag {
  kind: EffectKind;
  arg: string;
}

const WORD_TAG: Record<string, EffectKind> = Object.fromEntries([
  ...Object.entries(TAG_WORD).map(([k, v]) => [v, k]),
  ...Object.keys(TAG_WORD).map((k) => [k, k]),
  ['합류', 'join'],
  ['적의', 'hostile'],
  ['공격', 'hostile'],
  ['퇴장', 'leave'],
  ['단서', 'hint'],
]) as Record<string, EffectKind>;

const TAG_RE = /\[\[\s*([^\]\s]+)\s*([^\]]*?)\s*\]\]/g;

/** 모델 답 → 대사와 태그. 이름표·따옴표·지문·생각 블록을 지우고 140자 남짓으로 자른다 */
export function parseReply(raw: string, name: string): { text: string; tags: RawTag[] } {
  const tags: RawTag[] = [];
  let t = raw.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  t = t.replace(TAG_RE, (_m, w: string, arg: string) => {
    const kind = WORD_TAG[w.toLowerCase()] ?? WORD_TAG[w];
    if (kind) tags.push({ kind, arg: arg.trim() });
    return '';
  });
  t = t.replace(/<[^>]+>/g, '').trim();
  const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  t = t.replace(new RegExp(`^\\s*(?:${esc})\\s*[:：]\\s*`), '');
  t = t.replace(/^[「"“'](.*)[」"”']$/s, '$1');
  t = t.replace(/\*[^*]*\*/g, '').replace(/\([^)]*\)/g, '').replace(/[ \t]{2,}/g, ' ').replace(/\n{2,}/g, '\n').trim();
  // 다음 사람 대사를 이어 쓰면 거기서 자른다
  t = t.split(/\n\s*[^\s:]{1,8}\s*[:：]/)[0].trim();
  if (t.length > 170) {
    const cut = t.slice(0, 170);
    const end = Math.max(cut.lastIndexOf('.'), cut.lastIndexOf('?'), cut.lastIndexOf('!'), cut.lastIndexOf('…'));
    t = end > 40 ? cut.slice(0, end + 1) : cut + '…';
  }
  return { text: t, tags: tags.slice(0, 3) };
}

// ── 판정 ─────────────────────────────────────────────

export interface DecideCtx {
  def: NpcDef;
  target: TalkTarget;
  rel: Relation;
  /** 이번 만남에서 이미 준 단서 */
  hinted: Set<string>;
  day: number;
}

const NOTE: Partial<Record<EffectKind, string>> = { trade: '거래창이 열립니다', join: '함께 가기로 했다', hostile: '적대한다', leave: '자리를 떠난다', calm: '화가 풀렸다' };

/** 태그 → 실제 효과. 관계(호감)는 여기서 바꾼다. 나머지는 게임 쪽 onEffect가 한다 */
export function decide(tags: RawTag[], c: DecideCtx): AppliedEffect[] {
  const allowed = new Set(allowedEffects(c.def, c.target));
  const out: AppliedEffect[] = [];
  const name = c.target.name ?? c.def.name;
  let favorDone = false;
  // 호감 먼저: 적대·동행 조건이 바뀐 호감을 본다
  for (const t of tags) {
    if (t.kind !== 'favor' || favorDone || !allowed.has('favor')) continue;
    const n = Number((/[-+−]?\d/.exec(t.arg.replace('−', '-')) ?? ['0'])[0]);
    const delta = Math.max(-1, Math.min(1, Math.round(n)));
    if (!delta) continue;
    const before = c.rel.favor;
    c.rel.favor = clamp(before + delta);
    favorDone = true;
    if (c.rel.favor !== before) out.push({ kind: 'favor', delta, note: `${name} 호감 ${delta > 0 ? '↑' : '↓'}` });
  }
  const seen = new Set<EffectKind>();
  for (const t of tags) {
    if (t.kind === 'favor' || seen.has(t.kind) || !allowed.has(t.kind)) continue;
    switch (t.kind) {
      case 'hostile':
        if (c.rel.favor > -2) continue;
        break;
      case 'join':
        if (c.rel.favor < 1) continue;
        break;
      case 'calm':
        if (c.rel.favor < 0) continue;
        break;
      case 'hint': {
        const i = Number((/\d+/.exec(t.arg) ?? ['0'])[0]) - 1;
        const h = c.target.hints?.[i];
        if (!h || c.hinted.has(h.id)) continue;
        c.hinted.add(h.id);
        seen.add('hint');
        out.push({ kind: 'hint', hint: h, note: `단서: ${h.text}` });
        continue;
      }
      case 'gift': {
        const list = c.target.gifts ?? c.def.gifts ?? [];
        const item = list.find((g) => t.arg.includes(g)) ?? (list.length === 1 ? list[0] : undefined);
        if (!item || c.rel.giftDay === c.day) continue;
        c.rel.giftDay = c.day;
        seen.add('gift');
        out.push({ kind: 'gift', item, note: `${name}에게 물건을 받았다` });
        continue;
      }
    }
    seen.add(t.kind);
    out.push({ kind: t.kind, note: NOTE[t.kind] ?? '' });
  }
  // 적대와 동행·거래는 함께 일어나지 않는다
  if (out.some((e) => e.kind === 'hostile')) return out.filter((e) => e.kind !== 'join' && e.kind !== 'trade' && e.kind !== 'calm' && e.kind !== 'gift');
  return out;
}

// ── 모델이 없을 때 ─────────────────────────────────────

export function offlineLine(def: NpcDef, text: string, rng: () => number = Math.random): string {
  const pick = (l: string[]) => l[Math.floor(rng() * l.length) % l.length];
  for (const [re, lines] of def.rules ?? []) if (re.test(text)) return pick(lines);
  return pick(def.lines);
}

export const npcDef = (id: string): NpcDef | undefined => ROSTER[id];
