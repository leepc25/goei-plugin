// 본편 요청에 넣는 인물 기록 블록 (리수폿 Director 의 사실 전달을 코드로). 모델이 쓴 인용·숫자는 넣지 않는다.
// 절 단위 혼합: 시트의 고정 절(Voice·Background·Abilities·Appearance)은 원문, 나머지는 기록.
import { addressOf, affinityView, opennessOf, tasteOf, type AffinityOpts } from './affinity';

const REGISTER_EN: Record<string, string> = { 존댓말: 'formal (존댓말)', 반말: 'informal (반말)', 혼합: 'mixed formal/informal', 하게체: 'hage-che (archaic, superior-to-junior)', 하오체: 'hao-che (archaic, dignified formal)' };
import { liveEntries, plain, type Liveness } from './store';
import { fixedSections } from './seed';
import { norm } from './store';
import { OPENNESS_MAX, SLOT_META, TASTE_STAGES, opennessStage, slotsFor, type Change, type Entry, type PeopleStore, type Person, type SlotId } from './types';
import { axesLinesEn } from './axes';

const EXPRESS_TAIL: Record<0 | 1 | 2 | 3, string> = {
  0: 'Expression: almost never shown; appears only through actions and priorities, not words.',
  1: 'Expression: restrained; small, deniable cues (pauses, gaze, delayed replies).',
  2: 'Expression: visible but controlled.',
  3: 'Expression: open and immediate.',
};

export interface BlockOpts extends AffinityOpts {
  /** 시트 원문 (고정 절을 넣을 때). 없으면 기록만 */
  sheet?: string | null;
  /** 'split' = 고정 절 + 기록 (기본), 'append' = 시트 전체 + 기록, 'record' = 기록만 */
  mode?: 'split' | 'append' | 'record';
  /** 모르는 것 목록 (unknownTo) */
  unknown?: string[];
  /** 유저 표기 (기본 {{user}}) */
  user?: string;
  /** 사실형 Director 메모 (갱신기가 미리 써 둔 것) */
  note?: { now?: string; mustNot?: string[] } | null;
  maxChars?: number;
  /** 켜진 선택 기능 (taste·openness 줄을 넣을지) */
  taste?: boolean;
  openness?: boolean;
  /** 정성 모드(수치 끔)인 기능: 단계·숫자 줄 대신 전용 칸 */
  qual?: Set<string>;
  /** 성격 6축 줄을 넣을지 (기능 axes) */
  axes?: boolean;
  /** 켜진 기능 (전용 칸을 넣을지 정함). 없으면 기본 칸만 */
  features?: Set<string>;
}

const lines = (list: Entry[]) => list.map((e) => `- ${plain(e.text, 300)}`).join('\n');
/** 대상 칸: 유저 대상은 그대로, 다른 인물 대상은 「→ 이름:」 */
const targetedLines = (list: Entry[], user: string) => list.map((e) => `- ${e.target && e.target !== '@user' ? `→ ${e.target}: ` : ''}${plain(e.text, 300)}`).join('\n');
/** 기능별 전용 칸 묶음 (2026-11-06 「I」): 켜진 기능의 칸만, 비어 있으면 뺀다 */
const FEATURE_GROUPS: { title: string; slots: SlotId[] }[] = [
  { title: 'Taste and appraisal', slots: ['affinity.profile', 'affinity.values', 'affinity.appraisal', 'affinity.current_appraisal', 'affinity.intent', 'affinity.stance', 'affinity.bind', 'affinity.private', 'affinity.approach', 'affinity.surface_actual'] },
  { title: 'Address and relationship stage', slots: ['register.context', 'register.stage_assessment', 'register.knowledge_gap', 'register.restraint'] },
  { title: 'Perception', slots: ['perception.profile', 'perception.modifiers', 'perception.channels', 'perception.reading', 'perception.secret'] },
  { title: 'Intimacy conditions', slots: ['openness.context'] },
  { title: 'Goodwill (qualitative; no score exists)', slots: ['affinity.regard', 'affinity.speech', 'affinity.behavior'] },
  { title: 'Suspicion (qualitative; no score exists)', slots: ['suspicion.concern', 'suspicion.speech', 'suspicion.behavior'] },
  { title: 'Intimacy attitude (qualitative; no score exists)', slots: ['openness.attitude', 'openness.speech', 'openness.behavior'] },
];
const SLOT_EN: Record<string, string> = {
  'affinity.profile': 'Taste profile', 'affinity.values': 'Values and biases', 'affinity.appraisal': 'First impression (fixed)', 'affinity.current_appraisal': 'Current appraisal', 'affinity.intent': 'Intent', 'affinity.stance': 'Stance', 'affinity.bind': 'Constraint', 'affinity.private': 'Unexpressed', 'affinity.approach': 'Approach', 'affinity.surface_actual': 'Surface vs purpose',
  'register.context': 'Address conditions', 'register.stage_assessment': 'Relationship stage', 'register.knowledge_gap': 'Last contact', 'register.restraint': 'Restraint',
  'perception.profile': 'Observation tendency', 'perception.modifiers': 'Current impairments', 'perception.channels': 'Scene conditions', 'perception.reading': 'Clues read', 'perception.secret': 'Secrets held',
  'openness.context': 'Conditions',
  'affinity.regard': 'Goodwill', 'affinity.speech': 'Speech', 'affinity.behavior': 'Behavior',
  'suspicion.concern': 'Concern', 'suspicion.speech': 'Speech', 'suspicion.behavior': 'Behavior',
  'openness.attitude': 'Attitude', 'openness.speech': 'Speech', 'openness.behavior': 'Behavior',
};

/** 예산을 넘으면 오래된 항목부터 뺀다: 지난 일 → 아는 것 → 행동 → 장면 → 목표 순. 다른 절은 그대로 */
const TRIM_ORDER: (keyof Person['slots'])[] = ['history', 'knowledge', 'behavior', 'scene', 'threads'];

/** 한 인물의 블록. 비어 있는 절은 빼고, 보통(무관심) 단계면 관계 줄을 짧게 */
export function personBlock(p: Person, store: PeopleStore, live: Liveness, changes: Change[], o: BlockOpts = {}): string {
  const user = o.user ?? '{{user}}';
  const kept: Partial<Record<keyof Person['slots'], Entry[]>> = {};
  for (const k of Object.keys(p.slots) as (keyof Person['slots'])[]) kept[k] = liveEntries(p.slots[k], live);
  // 글자 예산: 넘치면 오래된 항목부터 뺀다 (글자 수 기준, 항목 수 상한 없음)
  if (o.maxChars) {
    const size = () => Object.values(kept).reduce((n, l) => n + (l ?? []).reduce((m, e) => m + e.text.length + 3, 0), 0);
    for (const k of TRIM_ORDER) while (size() > o.maxChars && kept[k]?.length) kept[k]!.shift();
  }
  const slot = (k: keyof Person['slots']) => kept[k] ?? [];
  const out: string[] = [`## ${p.name} (living record · updated in this chat)`];
  const mode = o.mode ?? 'split';
  if (o.sheet && mode === 'append') out.push(o.sheet.trim());
  const id = slot('identity');
  if (id.length) out.push('Identity:\n' + lines(id));
  const per = slot('personality');
  if (per.length) out.push('Personality:\n' + lines(per));
  if (o.axes) out.push('Personality axes (baseline traits, not current feeling):\n' + axesLinesEn(p.axes).join('\n') + (p.patterns?.length ? '\nLong-term changes:\n' + p.patterns.map((t) => `- ${plain(t, 300)}`).join('\n') : ''));
  if (o.sheet && mode === 'split') for (const s of fixedSections(o.sheet)) out.push(`${s.name}:\n${s.body}`);
  const st = slot('state');
  if (st.length) out.push('Current state:\n' + lines(st));
  const kn = slot('knowledge');
  if (kn.length) out.push('Knows:\n' + lines(kn));
  if (o.unknown?.length) out.push('Does not know (has not witnessed or been told):\n' + o.unknown.map((u) => `- ${plain(u, 120)}`).join('\n'));
  const rel = slot('relationship');
  const relUser = rel.filter((e) => !e.target || e.target === '@user');
  const relOther = rel.filter((e) => e.target && e.target !== '@user');
  const aff = affinityView(p, changes, store.folded[p.name] ?? 0, o);
  const addr = addressOf(p, changes);
  // 정성 모드면 단계 없이 (호감은 전용 칸의 글로만)
  const relLine = [o.qual?.has('affinity') ? `Relationship → ${user}:` : `Relationship → ${user}: ${aff.stage.label} (${aff.stage.behavior})`, EXPRESS_TAIL[p.express]].filter(Boolean).join(' ');
  out.push(relLine + (relUser.length ? '\n' + lines(relUser) : ''));
  if (o.taste) {
    const band = tasteOf(p, changes);
    if (band !== null) out.push(`First impression (taste) → ${user}: ${band > 0 ? '+' : ''}${band} — ${TASTE_STAGES[band]?.en ?? ''}. A separate axis from the relationship above; it never grants closeness by itself.`);
  }
  if (o.openness && !o.qual?.has('openness')) {
    const v = opennessOf(p, changes);
    if (v !== null) {
      const st = opennessStage(v);
      out.push(`Openness: ${st.en} (${Math.round(v)}/${OPENNESS_MAX}) — contraception attitude: ${st.contraceptionEn}. Applies only inside intimate contexts that actually arise; an explicit current condition or the other participant's choice takes priority.`);
    }
  }
  if (relOther.length) out.push('Relationships with others:\n' + relOther.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  if (addr.toUser) out.push(`Address → ${user}: '${addr.toUser}', ${REGISTER_EN[addr.register] ?? 'mixed'}.`);
  // 기능별 전용 칸 (켜진 기능만)
  const enabled = new Set(slotsFor(o.features ?? new Set(), o.qual));
  for (const g of FEATURE_GROUPS) {
    const parts = g.slots.filter((s) => enabled.has(s)).map((s) => ({ s, list: slot(s) })).filter((x) => x.list.length);
    if (!parts.length) continue;
    out.push(`${g.title}:\n` + parts.map((x) => `${SLOT_EN[x.s] ?? SLOT_META[x.s].label}:\n${targetedLines(x.list, user)}`).join('\n'));
  }
  const sp = slot('speech').filter((e) => e.target && e.target !== '@user');
  if (sp.length) out.push('Speech toward others:\n' + sp.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  const be = slot('behavior');
  if (be.length) out.push('Behavior:\n' + lines(be));
  const th = slot('threads');
  if (th.length) out.push('Open threads:\n' + lines(th));
  const su = o.qual?.has('suspicion') ? [] : slot('suspicion');
  if (su.length) out.push('Suspicion:\n' + su.map((e) => `- ${e.target ? `about ${e.target === '@user' ? user : e.target}` : ''}${e.kind ? ` [${e.kind}]` : ''}: ${plain(e.text, 200)}`).join('\n'));
  const hi = slot('history');
  if (hi.length) out.push('Recent (this chat):\n' + lines(hi));
  const sc = slot('scene');
  if (sc.length) out.push('Now:\n' + lines(sc));
  if (o.note?.now || o.note?.mustNot?.length) {
    out.push(['Director note:', o.note.now ? `- ${plain(o.note.now, 160)}` : '', ...(o.note.mustNot ?? []).map((m) => `- Must not reveal: ${plain(m, 100)}`)].filter(Boolean).join('\n'));
  }
  return out.join('\n');
}

/**
 * 이 인물이 모르는 것: 다른 인물의 「아는 정보」에 있지만 이 인물의 아는 정보에 없는 사실 (최근 것 우선, 최대 5).
 * 리수폿 Director 의 지식 경계를 코드로 흉내 내는 가장 싼 방법.
 */
export function unknownTo(p: Person, store: PeopleStore, live: Liveness, max = 5): string[] {
  const mine = liveEntries(p.slots.knowledge, live).map((e) => norm(e.text));
  const seen = new Set<string>();
  const out: { text: string; pos: number }[] = [];
  for (const other of Object.values(store.people)) {
    if (other.name === p.name) continue;
    for (const e of liveEntries(other.slots.knowledge, live)) {
      const n = norm(e.text);
      if (seen.has(n) || mine.some((m) => m.includes(n) || n.includes(m))) continue;
      seen.add(n);
      out.push({ text: e.text, pos: live.at.get(e.anchor) ?? -1 });
    }
  }
  return out.sort((a, b) => b.pos - a.pos).slice(0, max).map((x) => x.text);
}

export const PEOPLE_HEAD = '[People records]';
/** 지식 경계 규칙 (원본 DIRECTOR_KNOWLEDGE_RULE): Director 가 꺼져 있거나 실패해도 기록 블록이 들어가면 늘 함께 간다 (2026-11-07 전수검사 2 의 C) */
export const KNOWLEDGE_RULE =
  'Do not have a character mention or act on a secret or fact they have not witnessed, learned, or otherwise demonstrably known. Never invent how they acquired information. Keep facts, beliefs, guesses, and misunderstandings distinct. A missing record does not prove ignorance: actual evidence in the conversation may establish knowledge.';
export const PEOPLE_RULE =
  `Living records of the characters in this scene, kept by the system from what actually happened in this chat. They override the static character sheets where they differ. Treat them as background facts, not as events to narrate; never mention scores or these notes themselves. ${KNOWLEDGE_RULE}`;

/** 여러 인물의 블록을 한 덩어리로 */
export function peopleBlock(blocks: string[], maxChars = 16000): string {
  if (!blocks.length) return '';
  let body = blocks.join('\n\n');
  if (body.length > maxChars) body = body.slice(0, maxChars - 1) + '…';
  return `${PEOPLE_HEAD}\n${PEOPLE_RULE}\n\n${body}`;
}

/** 서사 리듬 블록 (문서 종류 rhythm + '@rhythm' 메모). 기록이 없으면 빈 문자열 */
export function rhythmBlock(docs: { key: string; text: string }[], note: string | null | undefined, clock: string[] = []): string {
  if (!docs.length && !note) return '';
  const order = (k: string) => (k === 'scene' ? 0 : k === 'chapter' ? 1 : k === 'arc' ? 2 : k.startsWith('hook:') ? 3 : 4);
  const lines = [...docs].sort((a, b) => order(a.key) - order(b.key)).map((d) => `- ${d.key}: ${plain(d.text, 300)}`);
  return ['## Scene rhythm (kept by the system; guidance, not content to narrate)', ...lines, ...(clock.length && docs.some((d) => d.key.startsWith('hook:')) ? ['Hook clock (counted by the system; never say turn numbers in the story):', ...clock] : []), ...(note ? [`- Direction for this reply: ${plain(note, 200)}`] : [])].join('\n');
}
