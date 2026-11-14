// 인물 기록 정리 (리수폿 「문서 정리」에 해당): 보조 모델이 한 인물의 살아 있는 항목들을 더 적은 수의 조밀한 항목으로 다시 쓴다.
// 사용자가 인물 화면에서 「정리」를 눌렀을 때만. 합쳐진 원본은 folded 표시(되돌릴 수 없음), 하나에서 온 항목은 대체(replaces).
import type { PeopleSettings } from './settings';
import { guideOr } from '../guides';
import { entryId, liveEntries, liveness, plain, type Liveness } from './store';
import { CORE_SLOTS, SLOT_META, slotsFor, type Entry, type PeopleStore, type SlotId } from './types';
import { recordChars } from './updater';

export interface ConsolidateInput {
  system: string;
  data: { name: string; chars: number; target: number; slots: Record<string, { id: string; text: string; target?: string }[]> };
  /** 입력에 넣은 항목 id → 항목 */
  ids: Map<string, { slot: SlotId; entry: Entry }>;
}

/** 글은 지침 「인물 기록 갱신기(덧붙임)」 CONSOLIDATE 절. 절이 없으면 아래에 남긴 글 */
export const CONSOLIDATE_PROMPT = (lang: 'ko' | 'en', slots: SlotId[] = [...CORE_SLOTS]) => guideOr('UpdaterExtra', 'CONSOLIDATE', () => [
  'You tidy the per-chat record of one roleplay character. The record is a set of slots, each a list of short entries. Over time entries pile up, overlap, or go stale. Rewrite each slot into fewer, denser entries without losing any fact that is still true.',
  '',
  'Rules:',
  '- Merge entries that describe the same thing; drop nothing that is still true. Keep concrete details (names, numbers, places, dates). When two entries conflict, keep the later one (entries are listed oldest first) and you may note the change.',
  `- \`chars\` is the record's current size and \`target\` the size to reach (sum of entry texts). Reduce toward target; a result near it is enough; never pad. Each entry is one statement ≤300 chars${lang === 'en' ? ' in English' : ' in Korean'}. Names, quotes, address terms, Korean labels and prefixes stay as written.`,
  '- `state` and `scene` are the present: merge aggressively, keep only what is still true. `history` is a chronological digest: merge adjacent events into one line each. `relationship`, `speech` and the feature slots (`affinity.*`, `register.*`) keep one entry per `target`.',
  '- Give every result entry `from`: the ids of the input entries it came from (one or more). An input entry that you leave out of every `from` is treated as discarded, so only omit an entry when it is stale or fully covered elsewhere.',
  '- Slots you do not return stay as they are.',
  '',
  'Output exactly one JSON object, nothing else:',
  '{"slots":{"<slot>":[{"text":"<statement>","target":"<name|@user|null>","from":["<id>"]}]}}',
  'Slot hints: ' + slots.map((s) => `${s} = ${SLOT_META[s].hint}`).join('; '),
].join('\n'), { lang_note: lang === 'en' ? ' in English' : ' in Korean', slot_hints: slots.map((s) => `${s} = ${SLOT_META[s].hint}`).join('; ') });

/** 정리 요청의 user 글 (host/people.ts). 지침 「인물 기록 갱신기(덧붙임)」 CONSOLIDATE.USER 절, 없으면 여기 남긴 글 */
export const consolidateUserText = (dataText: string): string => guideOr('UpdaterExtra', 'CONSOLIDATE.USER', () => `Record to tidy:\n${dataText}\n\nReturn the JSON object.`, { data: dataText });

export function buildConsolidate(store: PeopleStore, chat: Parameters<typeof liveness>[0], who: string, settings: PeopleSettings): ConsolidateInput | null {
  const p = store.people[who];
  if (!p) return null;
  const live = liveness(chat);
  const slots: ConsolidateInput['data']['slots'] = {};
  const ids = new Map<string, { slot: SlotId; entry: Entry }>();
  const enabled = slotsFor(settings.features, settings.qualitative);
  for (const slot of enabled) {
    // 수치 모드 의심 칸은 정리하지 않는다: 항목마다 종류(kind)와 맨 앞 표식 하나로 점수를 세므로 합치면 깨진다 (갱신기 merge 도 막음)
    if (SLOT_META[slot].once || slot === 'suspicion') continue;
    const cur = liveEntries(p.slots[slot], live).filter((e) => !e.pin);
    if (!cur.length) continue;
    const pos = (e: Entry) => live.at.get(e.anchor) ?? -1;
    const sorted = [...cur].sort((a, b) => pos(a) - pos(b) || a.seq - b.seq);
    slots[slot] = sorted.map((e) => ({ id: e.id, text: e.text, ...(e.target ? { target: e.target } : {}) }));
    for (const e of sorted) ids.set(e.id, { slot, entry: e });
  }
  if (!ids.size) return null;
  return { system: CONSOLIDATE_PROMPT(settings.lang, enabled), data: { name: who, chars: recordChars(p, live), target: Math.round(settings.personCap * 0.8), slots }, ids };
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
    if (!slotsFor(settings.features, settings.qualitative).includes(slot) || !input.data.slots[slot] || !Array.isArray(items)) {
      report.dropped.push({ slot: slotName, reason: '없는 칸이거나 목록이 아님', item: items });
      continue;
    }
    const inputIds = new Set(input.data.slots[slot].map((e) => e.id));
    const next: { text: string; target?: string; from: string[] }[] = [];
    let bad = false;
    for (const it of items) {
      const text = plain(it?.text, 300);
      const from = Array.isArray(it?.from) ? it.from.map((x) => String(x)).filter((id) => inputIds.has(id)) : [];
      if (!text || !from.length) {
        report.dropped.push({ slot, reason: !text ? '글 없음' : 'from 에 이 칸의 항목 id 가 없음', item: it });
        bad = true;
        break;
      }
      const target = typeof it.target === 'string' && it.target ? plain(it.target, 40) : undefined;
      next.push({ text, ...(target ? { target } : {}), from });
    }
    if (bad || !next.length || next.length >= input.data.slots[slot].length) {
      if (!bad) report.dropped.push({ slot, reason: !next.length ? '결과 항목 없음' : '입력보다 줄지 않음', item: items });
      continue;
    }
    const list = (p.slots[slot] ??= []);
    const used = new Set<string>();
    let seq = list.filter((e) => e.anchor === '#0').length;
    for (const n of next) {
      seq++;
      list.push({ id: entryId(who, slot, '#0', seq, n.text), text: n.text, src: 'story', anchor: '#0', seq, ...(n.target ? { target: n.target } : {}), ...(n.from.length === 1 ? { replaces: n.from[0] } : { from: n.from }) });
      for (const id of n.from) used.add(id);
    }
    // 어디에도 안 쓰인 원본은 버린 것: 원본에 folded 를 단다. 예전의 취소(void) 대체 항목은 살아 있지 않아 원본을 숨기지 못했다 (전수검사 11-13)
    for (const e of input.data.slots[slot]) {
      if (used.has(e.id)) continue;
      const orig = list.find((x) => x.id === e.id);
      if (orig) orig.folded = true;
    }
    report.slots++;
    report.before += input.data.slots[slot].length;
    report.after += next.length;
  }
  return report;
}
