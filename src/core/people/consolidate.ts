// 인물 기록 정리 (리수폿 「문서 정리」에 해당): 보조 모델이 한 인물의 살아 있는 항목들을 더 적은 수의 조밀한 항목으로 다시 쓴다.
// 사용자가 인물 화면에서 「정리」를 눌렀을 때만. 합쳐진 원본은 folded 표시(되돌릴 수 없음), 하나에서 온 항목은 대체(replaces).
import type { PeopleSettings } from './settings';
import { entryId, liveEntries, liveness, plain, type Liveness } from './store';
import { SLOTS, type Entry, type PeopleStore, type SlotId } from './types';
import { slotCap } from './updater';

export interface ConsolidateInput {
  system: string;
  data: { name: string; caps: Record<string, number>; slots: Record<string, { id: string; text: string; target?: string }[]> };
  /** 입력에 넣은 항목 id → 항목 */
  ids: Map<string, { slot: SlotId; entry: Entry }>;
}

const SLOT_HINT: Record<SlotId, string> = {
  identity: 'who this person is (affiliation, rank, role, age, appearance)',
  personality: 'durable traits and values',
  state: 'current condition, location, injuries, mood — keep only what is still true',
  relationship: 'stance toward each target; one entry per target (첫인상/현재 평가 labels stay)',
  speech: 'how this person talks to each target; one entry per target',
  behavior: 'habits and patterns of action',
  knowledge: 'what this person actually knows or does not know',
  threads: 'open promises, goals, unresolved matters',
  history: 'notable past events with this person, oldest first',
  scene: 'present scene facts',
  suspicion: 'suspicion cases (prefixes [시작]/[단서]/[반응]/[해소] stay)',
};

export const CONSOLIDATE_PROMPT = (lang: 'ko' | 'en') => [
  'You tidy the per-chat record of one roleplay character. The record is a set of slots, each a list of short entries. Over time entries pile up, overlap, or go stale. Rewrite each slot into fewer, denser entries without losing any fact that is still true.',
  '',
  'Rules:',
  '- Merge entries that describe the same thing; drop nothing that is still true. Keep concrete details (names, numbers, places, dates). When two entries conflict, keep the later one (entries are listed oldest first) and you may note the change.',
  `- Each slot has a cap (\`caps\`). The result for a slot must have at most that many entries, ideally fewer. Each entry is one statement ≤200 chars${lang === 'en' ? ' in English' : ' in Korean'}. Names, quotes, address terms, Korean labels and prefixes stay as written.`,
  '- `state` and `scene` are the present: merge aggressively, keep only what is still true. `history` is a chronological digest: merge adjacent events into one line each. `relationship` and `speech` keep one entry per `target`.',
  '- Give every result entry `from`: the ids of the input entries it came from (one or more). An input entry that you leave out of every `from` is treated as discarded, so only omit an entry when it is stale or fully covered elsewhere.',
  '- Slots you do not return stay as they are.',
  '',
  'Output exactly one JSON object, nothing else:',
  '{"slots":{"<slot>":[{"text":"<statement>","target":"<name|@user|null>","from":["<id>"]}]}}',
  'Slot hints: ' + SLOTS.map((s) => `${s} = ${SLOT_HINT[s]}`).join('; '),
].join('\n');

export function buildConsolidate(store: PeopleStore, chat: Parameters<typeof liveness>[0], who: string, settings: PeopleSettings): ConsolidateInput | null {
  const p = store.people[who];
  if (!p) return null;
  const live = liveness(chat);
  const slots: ConsolidateInput['data']['slots'] = {};
  const caps: Record<string, number> = {};
  const ids = new Map<string, { slot: SlotId; entry: Entry }>();
  for (const slot of SLOTS) {
    const cur = liveEntries(p.slots[slot], live).filter((e) => !e.pin);
    if (!cur.length) continue;
    const pos = (e: Entry) => live.at.get(e.anchor) ?? -1;
    const sorted = [...cur].sort((a, b) => pos(a) - pos(b) || a.seq - b.seq);
    slots[slot] = sorted.map((e) => ({ id: e.id, text: e.text, ...(e.target ? { target: e.target } : {}) }));
    caps[slot] = slotCap(slot, settings.capScale);
    for (const e of sorted) ids.set(e.id, { slot, entry: e });
  }
  if (!ids.size) return null;
  return { system: CONSOLIDATE_PROMPT(settings.lang), data: { name: who, caps, slots }, ids };
}

export interface ConsolidateResult { slots?: Record<string, { text?: unknown; target?: unknown; from?: unknown }[]> }

export function parseConsolidate(raw: string): ConsolidateResult {
  let t = raw.replace(/<(thoughts|think)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '').trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence) t = fence[1].trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('JSON 객체가 없어요');
  const v = JSON.parse(t.slice(a, b + 1)) as unknown;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('JSON 객체가 아니에요');
  const r = v as ConsolidateResult;
  if (r.slots !== undefined && (!r.slots || typeof r.slots !== 'object' || Array.isArray(r.slots))) throw new Error('slots 는 객체여야 해요');
  return r;
}

export interface ConsolidateReport { slots: number; before: number; after: number; dropped: { slot: string; reason: string; item: unknown }[] }

/** 반영: 칸마다 결과 항목을 '#0' 기준(늘 살아 있음)으로 넣고, 원본은 접거나 대체한다. 결과가 입력보다 많거나 깨졌으면 그 칸은 그대로 */
export function applyConsolidate(store: PeopleStore, who: string, input: ConsolidateInput, r: ConsolidateResult, live: Liveness, settings: PeopleSettings): ConsolidateReport {
  const report: ConsolidateReport = { slots: 0, before: 0, after: 0, dropped: [] };
  const p = store.people[who];
  if (!p || !r.slots) return report;
  for (const [slotName, items] of Object.entries(r.slots)) {
    const slot = slotName as SlotId;
    if (!SLOTS.includes(slot) || !input.data.slots[slot] || !Array.isArray(items)) {
      report.dropped.push({ slot: slotName, reason: '없는 칸이거나 목록이 아님', item: items });
      continue;
    }
    const cap = slotCap(slot, settings.capScale);
    const inputIds = new Set(input.data.slots[slot].map((e) => e.id));
    const next: { text: string; target?: string; from: string[] }[] = [];
    let bad = false;
    for (const it of items) {
      const text = plain(it?.text, 200);
      const from = Array.isArray(it?.from) ? it.from.map((x) => String(x)).filter((id) => inputIds.has(id)) : [];
      if (!text || !from.length) {
        report.dropped.push({ slot, reason: !text ? '글 없음' : 'from 에 이 칸의 항목 id 가 없음', item: it });
        bad = true;
        break;
      }
      const target = typeof it.target === 'string' && it.target ? plain(it.target, 40) : undefined;
      next.push({ text, ...(target ? { target } : {}), from });
    }
    if (bad || !next.length || next.length > Math.max(cap, 1) || next.length >= input.data.slots[slot].length) {
      if (!bad) report.dropped.push({ slot, reason: !next.length ? '결과 항목 없음' : next.length > cap ? '상한보다 많음' : '입력보다 줄지 않음', item: items });
      continue;
    }
    const list = (p.slots[slot] ??= []);
    const used = new Set<string>();
    let seq = list.filter((e) => e.anchor === '#0').length;
    for (const n of next) {
      seq++;
      const replaces = n.from.length === 1 ? n.from[0] : undefined;
      list.push({ id: entryId(who, slot, '#0', seq, n.text), text: n.text, src: 'story', anchor: '#0', seq, ...(n.target ? { target: n.target } : {}), ...(replaces ? { replaces } : {}) });
      for (const id of n.from) used.add(id);
    }
    // 둘 이상에서 합쳐진 원본과 어디에도 안 쓰인 원본은 접는다 (하나에서 온 것은 대체로 처리돼 되살릴 수 있다)
    const single = new Set(next.filter((n) => n.from.length === 1).map((n) => n.from[0]));
    for (const e of list) if (inputIds.has(e.id) && !single.has(e.id)) e.folded = true;
    report.slots++;
    report.before += input.data.slots[slot].length;
    report.after += next.length;
  }
  return report;
}
