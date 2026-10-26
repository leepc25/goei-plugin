// 본편 요청에 넣는 인물 기록 블록 (리수폿 Director 의 사실 전달을 코드로). 모델이 쓴 인용·숫자는 넣지 않는다.
// 절 단위 혼합: 시트의 고정 절(Voice·Background·Abilities·Appearance)은 원문, 나머지는 기록.
import { addressOf, affinityView, type AffinityOpts } from './affinity';

const REGISTER_EN: Record<string, string> = { 존댓말: 'formal (존댓말)', 반말: 'informal (반말)', 혼합: 'mixed formal/informal', 하게체: 'hage-che (archaic, superior-to-junior)', 하오체: 'hao-che (archaic, dignified formal)' };
import { liveEntries, plain, type Liveness } from './store';
import { fixedSections } from './seed';
import { norm } from './store';
import type { Change, Entry, PeopleStore, Person } from './types';

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
}

const lines = (list: Entry[]) => list.map((e) => `- ${plain(e.text, 300)}`).join('\n');

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
  const relLine = [`Relationship → ${user}: ${aff.stage.label} (${aff.stage.behavior})`, EXPRESS_TAIL[p.express]].filter(Boolean).join(' ');
  out.push(relLine + (relUser.length ? '\n' + lines(relUser) : ''));
  if (relOther.length) out.push('Relationships with others:\n' + relOther.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  if (addr.toUser) out.push(`Address → ${user}: '${addr.toUser}', ${REGISTER_EN[addr.register] ?? 'mixed'}.`);
  const sp = slot('speech').filter((e) => e.target && e.target !== '@user');
  if (sp.length) out.push('Speech toward others:\n' + sp.map((e) => `- → ${e.target}: ${plain(e.text, 300)}`).join('\n'));
  const be = slot('behavior');
  if (be.length) out.push('Behavior:\n' + lines(be));
  const th = slot('threads');
  if (th.length) out.push('Open threads:\n' + lines(th));
  const su = slot('suspicion');
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
export const PEOPLE_RULE =
  'Living records of the characters in this scene, kept by the system from what actually happened in this chat. They override the static character sheets where they differ. Treat them as background facts, not as events to narrate; never mention scores or these notes themselves.';

/** 여러 인물의 블록을 한 덩어리로 */
export function peopleBlock(blocks: string[], maxChars = 16000): string {
  if (!blocks.length) return '';
  let body = blocks.join('\n\n');
  if (body.length > maxChars) body = body.slice(0, maxChars - 1) + '…';
  return `${PEOPLE_HEAD}\n${PEOPLE_RULE}\n\n${body}`;
}
