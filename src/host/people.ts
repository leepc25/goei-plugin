// 인물 기록 호스트: 갱신기를 실제로 돌린다 (모델 호출·채팅 저장·진단). 본편 응답 뒤(매 턴) 또는 「지금 갱신」에서.
// 쓰기 규칙: 본편 응답 대기 중이면 보류, 쓰기 직전 같은 채팅인지 확인, 덧붙이기만, 작업은 한 번에 하나.
import type { Chat } from '../core/types';
import { bookText } from '../core/refs';
import { generate, runModel, LlmError, type LlmMessage } from './llm';
import { buildDirector, directorBlock, parseDirector, type DirectorNote } from '../core/people/director';
import { loadContext, updateChat, type ChatContext } from './risu';
import { isWaiting, onWaiting } from './waiting';
import { peopleStore, withPeople, unreadIndexes, messageKey, messageHash as messageHashOf, liveness } from '../core/people/store';
import { applyUpdate, assemblePrompt, buildUpdate, clearStoryRecords, enabledSections, mentionIndexes, parseUpdate, planBatches, recordChars, type ApplyReport } from '../core/people/updater';
import { applyConsolidate, buildConsolidate, parseConsolidate, type ConsolidateReport } from '../core/people/consolidate';
import { peopleSettings, type PeopleSettings } from '../core/people/settings';
import { seedPerson } from '../core/people/seed';
import { nameMatcher } from '../core/people/select';
import { allNames, seedBaseFor, valuesOf } from '../core/people/base';
import { playerAgent } from '../core/player';
import { promptFor } from '../core/people/prompt';
import { messageText } from '../core/refs';
import { findStatusTags } from '../core/world/status';
import { colConfig } from '../core/world/statuscols';
import { addWalletEntry, aliveAnchors, readWallet, walletBalance, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { getPrefs } from '../core/settings';
import { parseIdentity } from '../core/people/identity';
import type { Identity, PeopleStore } from '../core/people/types';
import { factionList } from '../core/factions';
import type { LoreEntry } from '../core/types';
import { endedInBatch, endedNowOf, journalSettings, readReports, reportVars, withDebriefs } from '../core/journal';

// ── 진단 ──

export interface DiagRun {
  at: string;
  chat: string;
  reason: string;
  model: string;
  people: string[];
  indexes: number[];
  sizes: { system: number; data: number; span: number };
  outChars: number;
  ms: number;
  ok: boolean;
  stage?: 'build' | 'model' | 'parse' | 'save' | 'skip';
  error?: string;
  report?: ApplyReport;
  /** 「정리」 결과 (reason 'consolidate') */
  tidy?: ConsolidateReport;
  system?: string;
  data?: string;
  raw?: string;
}
const DIAG_KEY = 'goei-people-diag';
const DIAG_KEEP = 10;
const DIAG_FAIL_KEEP = 30;

export async function loadDiag(): Promise<DiagRun[]> {
  try {
    const raw: unknown = await risuai.pluginStorage.getItem(DIAG_KEY);
    const v = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
    return Array.isArray(v) ? (v as DiagRun[]) : [];
  } catch {
    return [];
  }
}
export async function pushDiag(run: DiagRun, keepRaw: boolean): Promise<void> {
  try {
    const list = await loadDiag();
    const item = keepRaw ? run : { ...run, system: undefined, data: undefined, raw: run.ok ? undefined : run.raw };
    list.push(item);
    const ok = list.filter((r) => r.ok).slice(-DIAG_KEEP);
    const bad = list.filter((r) => !r.ok).slice(-DIAG_FAIL_KEEP);
    const next = [...ok, ...bad].sort((a, b) => a.at.localeCompare(b.at));
    await risuai.pluginStorage.setItem(DIAG_KEY, JSON.stringify(next));
  } catch {
    /* 진단을 못 남겨도 진행 */
  }
}
export async function clearDiag(): Promise<void> {
  try {
    await risuai.pluginStorage.setItem(DIAG_KEY, '[]');
  } catch {
    /* */
  }
}

// ── 상태 알림 (화면이 「갱신 중」·「끝남」을 그린다) ──

export type PeopleStatus = { busy: boolean; label: string; unread: number };
const subs = new Set<(s: PeopleStatus) => void>();
let status: PeopleStatus = { busy: false, label: '', unread: 0 };
export const peopleStatus = () => status;
export function onPeopleStatus(cb: (s: PeopleStatus) => void): () => void {
  subs.add(cb);
  return () => void subs.delete(cb);
}
function setStatus(next: Partial<PeopleStatus>): void {
  status = { ...status, ...next };
  for (const f of subs) f(status);
}

// ── 시트·시작값 ──

export const chatId = (ctx: ChatContext) => `${String(ctx.char.chaId ?? ctx.charIndex)}:${ctx.chatIndex}:${messageKey(ctx.chat.message[0] ?? { role: 'user', data: '' }, 0)}`;

export const sheetOf = (ctx: ChatContext) => (name: string): string | null => bookText({ char: ctx.char, chat: ctx.chat }, name) || null;

/** 기록하지 않는 이름: 유저가 연기하는 요원 (캐릭터로 플레이) */
function excludedNames(ctx: ChatContext): string[] {
  const me = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
  return me?.name ? [me.name] : [];
}

/** 명부의 세력 코드 → 이름 (세력 평판 표시·해석용) */
export function factionNamesOf(lore: LoreEntry[] | undefined): Record<string, string> {
  try {
    return Object.fromEntries(factionList(lore).map((f) => [f.code, f.name]));
  } catch {
    return {};
  }
}

function userFaction(chat: Chat): string {
  const v = chat.scriptstate?.['$st_faction'] ?? chat.scriptstate?.['st_faction'];
  return typeof v === 'string' ? v : '';
}

/** 처음 등장한 인물의 기록을 만든다 (시트 → 시작값). 확정 구간 글에 이름이 나온, 아직 기록이 없는 사람.
 *  유저가 연기하는 요원(exclude)은 기록하지 않는다 (있던 기록은 지운다). 호칭 시작값은 유저 신분(identity)으로 고른다 */
export function seedAppearing(store: PeopleStore, chat: Chat, indexes: number[], sheet: (name: string) => string | null, o: { exclude?: string[]; identity?: Identity } = {}): string[] {
  const list = Array.isArray(chat.message) ? chat.message : [];
  const exclude = new Set(o.exclude ?? []);
  const match = nameMatcher(allNames().filter((n) => !store.people[n.name] && !exclude.has(n.name)));
  const texts = indexes.flatMap((i) => [list[i - 1], list[i]]).filter(Boolean).map((m) => messageText(String(m!.data ?? '')));
  const found = new Set<string>();
  for (const t of texts) for (const n of match(t)) found.add(n);
  const faction = userFaction(chat);
  const made: string[] = [];
  for (const name of found) {
    store.people[name] = seedPerson(name, sheet(name), seedBaseFor(name, faction, o.identity ?? store.identity));
    made.push(name);
  }
  return made;
}

/** 유저가 연기하는 요원의 기록을 지운다 (자기 자신은 기록 대상이 아니다). 지운 이름을 돌려준다 */
export function dropExcluded(store: PeopleStore, exclude: string[]): string[] {
  const gone: string[] = [];
  for (const n of exclude) {
    if (!store.people[n]) continue;
    delete store.people[n];
    store.log = store.log.filter((c) => c.who !== n);
    delete store.folded[n];
    gone.push(n);
  }
  return gone;
}

/** 가장 최근 봇 응답의 상태창 신분 칸 */
export function statusIdentity(chat: Chat): ReturnType<typeof parseIdentity> {
  const list = Array.isArray(chat.message) ? chat.message : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].role !== 'char') continue;
    const tags = findStatusTags(String(list[i].data ?? ''));
    const t = tags.at(-1);
    if (!t) continue;
    return t.identity ? parseIdentity(t.identity, messageKey(list[i], i)) : null;
  }
  return null;
}

// ── 실행 ──

/** 돌고 있는 갱신 수. 요청은 차례로 잇는다 (QC 2026-10-28: 예전엔 돌고 있을 때 들어온 요청의 이유·옵션(수동·범위)을 버리고
 *  처음 요청의 옵션으로 한 번 더 돌았고, 부른 쪽은 처음 요청의 결과를 받았다) */
let running = 0;
let chain: Promise<unknown> = Promise.resolve();
export const peopleUpdating = () => running > 0;

export interface RunResult { ran: number; applied: number; skipped: string[]; errors: string[] }

/** 안 읽은 응답을 묶음으로 읽어 기록에 반영한다. 이미 돌고 있으면 끝난 뒤 이어서 (읽을 것이 없으면 바로 끝난다) */
export interface RunScope {
  /** 읽을 응답 위치 (없으면 안 읽은 것). backfill·다시 읽기 */
  indexes?: number[];
  /** 이 인물만 반영하고 읽음 표시는 그대로 (다시 읽기) */
  only?: string[];
}

export function requestPeopleUpdate(reason: string, o: { manual?: boolean; scope?: RunScope } = {}): Promise<RunResult> {
  running++;
  const run = chain.then(() => runOnce(reason, o)).finally(() => {
    running--;
  });
  chain = run.catch(() => {});
  return run;
}

async function waitNotBusy(): Promise<void> {
  if (!isWaiting()) return;
  await new Promise<void>((resolve) => {
    const off = onWaiting((w) => {
      if (!w) {
        off();
        resolve();
      }
    });
  });
}

async function runOnce(reason: string, o: { manual?: boolean; scope?: RunScope }): Promise<RunResult> {
  const result: RunResult = { ran: 0, applied: 0, skipped: [], errors: [] };
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return result;
  const settings = peopleSettings(ctx.chat.scriptstate);
  if (!settings.on || (settings.when === 'manual' && !o.manual)) return result;
  const store = peopleStore(ctx.chat);
  // 읽을 범위: 지정(backfill·다시 읽기)이 없으면 안 읽은 응답 가운데 「마지막으로 읽은 것 뒤」만.
  // 읽은 적이 없으면(기능을 중간에 켬) 마지막 응답 하나만 — 지난 응답은 「지난 응답 읽기」로 사용자가 고른다
  const allUnread = unreadIndexes(ctx.chat, store);
  let unread = allUnread;
  if (!o.scope?.indexes) {
    const lastRead = Math.max(-1, ...ctx.chat.message.map((m, i) => (store.read[messageKey(m, i)] !== undefined ? i : -1)));
    unread = lastRead < 0 ? allUnread.slice(-1) : allUnread.filter((i) => i > lastRead);
  } else unread = o.scope.indexes.filter((i) => ctx.chat.message[i]?.role === 'char');
  setStatus({ unread: allUnread.length });
  if (!unread.length) return result;
  const sheet = sheetOf(ctx);
  // 상태창 신분 칸 (가장 최근 응답) → 기록. 상태창이 늘 우선
  const identity = statusIdentity(ctx.chat);
  const idChanged = !!identity && (!store.identity || store.identity.faction !== identity.faction || store.identity.rank !== identity.rank || store.identity.from !== 'status');
  // 유저가 연기하는 요원은 기록하지 않는다
  const exclude = excludedNames(ctx);
  const dropped = dropExcluded(store, exclude);
  const seeded = seedAppearing(store, ctx.chat, unread, sheet, { exclude, identity: identity ?? store.identity });
  if (seeded.length || idChanged || dropped.length) {
    await updateChat(ctx.charIndex, ctx.chatIndex, (cur) => {
      const s = peopleStore(cur);
      dropExcluded(s, exclude);
      for (const n of seeded) if (!s.people[n]) s.people[n] = store.people[n];
      if (identity && idChanged) s.identity = identity;
      return withPeople(cur, s);
    }).catch(() => null);
  }
  const batches = planBatches(ctx.chat, unread, settings.spanCap);
  const id = chatId(ctx);
  for (let b = 0; b < batches.length; b++) {
    setStatus({ busy: true, label: batches.length > 1 ? `관계 갱신 중… (${b + 1}/${batches.length})` : '관계 갱신 중…' });
    const t0 = Date.now();
    const diag: DiagRun = { at: new Date().toISOString(), chat: id, reason, model: settings.model, people: [], indexes: batches[b], sizes: { system: 0, data: 0, span: 0 }, outChars: 0, ms: 0, ok: false };
    try {
      const fresh = (await loadContext().catch(() => null)) ?? ctx;
      if (chatId(fresh) !== id) {
        diag.stage = 'skip';
        diag.error = '채팅이 바뀌어 중단';
        result.skipped.push(diag.error);
        break;
      }
      const curStore = peopleStore(fresh.chat);
      // 가계부: 상태창 잔고 칸을 쓰는 채팅이면 장부 잔고를 자료에 넣고 거래 절을 켠다 (core/wallet.ts)
      const walletOn = colConfig(fresh.chat.scriptstate).wallet !== 'off';
      const walletStart = getPrefs().walletStart ?? WALLET_START_DEFAULT;
      const balance = walletOn ? walletBalance(readWallet(fresh.chat.scriptstate, walletStart), aliveAnchors(fresh.chat)) : null;
      // 소감 (core/journal/debrief): 설정 「소감 자동」이 켜져 있고 이 묶음에서 종료된 사건(보고서)이 있으면 같은 호출에 얹는다. 다시 읽기(only)는 제외
      const batchKeys = batches[b].map((i) => (fresh.chat.message[i] ? messageKey(fresh.chat.message[i], i) : '')).filter(Boolean);
      const ended = journalSettings(fresh.chat.scriptstate).debriefAuto && !o.scope?.only ? endedInBatch(readReports(fresh.chat), batchKeys).map(endedNowOf) : [];
      const input = buildUpdate(fresh.chat, curStore, batches[b], { settings, system: '', values: Object.fromEntries(input0Names(curStore).map((n) => [n, valuesOf(n)])), names: allNames(), exclude, factionNames: factionNamesOf(fresh.char.globalLore), only: o.scope?.only, wallet: balance, ended });
      // 지침은 자료를 본 뒤 조립한다 (저장 상한을 넘긴 인물이 있으면 정리 절을 켠다)
      const sections = enabledSections(settings);
      if (input.tidy.length) sections.add('tidy');
      if (walletOn) sections.add('wallet');
      if (ended.length) sections.add('debrief');
      const system = assemblePrompt(promptFor(settings), sections, settings.rules, settings.lang);
      input.system = system;
      if (!input.people.length) {
        // 장면 인물이 없으면 모델을 부르지 않고 읽음 표시만 (다시 읽기는 표시도 안 바꿈)
        if (!o.scope?.only) await updateChat(fresh.charIndex, fresh.chatIndex, (cur) => {
          const s = peopleStore(cur);
          for (const i of input.indexes) {
            const m = cur.message[i];
            if (m) s.read[messageKey(m, i)] = messageHashOf(m);
          }
          return withPeople(cur, s);
        });
        diag.ok = true;
        diag.stage = 'skip';
        diag.error = '장면 인물 없음';
        result.skipped.push('장면 인물 없음');
        continue;
      }
      const dataText = JSON.stringify(input.data);
      diag.people = input.people;
      diag.sizes = { system: system.length, data: dataText.length, span: JSON.stringify(input.data.span).length };
      if (settings.keepRaw) {
        diag.system = system;
        diag.data = dataText;
      }
      const messages: LlmMessage[] = [
        { role: 'system', content: system },
        { role: 'user', content: dataText },
      ];
      const { raw, value } = await generate(messages, settings.model, parseUpdate, { retries: 1, retryModel: 'same', state: fresh.chat.scriptstate });
      diag.raw = raw;
      diag.outChars = raw.length;
      // 쓰기: 응답 대기 중이면 기다리고, 같은 채팅인지·메시지가 그대로인지 확인
      await waitNotBusy();
      const keys = new Map([...input.tags.values()].map((i) => [i, messageKey(fresh.chat.message[i], i)]));
      const saved = await updateChat(fresh.charIndex, fresh.chatIndex, (cur) => {
        if (chatId({ ...fresh, chat: cur }) !== id) return null;
        for (const [i, k] of keys) if (!cur.message[i] || messageKey(cur.message[i], i) !== k) return null;
        const s = peopleStore(cur);
        const report = applyUpdate(s, cur, input, value, {
          settings,
          sheetOf: sheet,
          baseOf: (name) => seedBaseFor(name, userFaction(cur), s.identity),
          exclude,
          only: o.scope?.only,
          keepRead: !!o.scope?.only,
          wallet: walletOn,
          debrief: ended.length > 0,
        });
        diag.report = report;
        let next = cur;
        if (report.wallet.length) {
          let w = readWallet(cur.scriptstate, walletStart);
          for (const e of report.wallet) w = addWalletEntry(w, { ...e, src: 'story' });
          next = { ...cur, scriptstate: { ...(cur.scriptstate ?? {}), ...walletVars(w) } };
        }
        // 소감은 보고서($goei_reports)에 (종료 턴이면 turn, 지난 응답 읽기면 backfill)
        if (report.debriefs?.length) {
          const d = withDebriefs(readReports(next), report.debriefs, reason === 'backfill' ? 'backfill' : 'turn');
          if (d.applied) next = { ...next, scriptstate: { ...(next.scriptstate ?? {}), ...reportVars(d.store) } };
        }
        return withPeople(next, s);
      });
      if (!saved) {
        diag.stage = 'save';
        diag.error = '저장 직전에 채팅이 달라져 이번 결과를 버림';
        result.skipped.push(diag.error);
        continue;
      }
      diag.ok = true;
      result.ran++;
      result.applied += diag.report ? diag.report.applied.entries + diag.report.applied.cues + diag.report.applied.address + diag.report.applied.docs + diag.report.applied.suspicion : 0;
    } catch (error) {
      // 응답 원문이 오류에 붙어 있으면(형식 오류 재시도 끝) 먼저 꺼내야 단계가 parse 로 적힌다 (QC 2026-10-28: 늘 build 로 적혔다)
      if (!diag.raw && error && typeof error === 'object' && 'raw' in error) diag.raw = String((error as { raw?: unknown }).raw ?? '');
      diag.stage = error instanceof LlmError ? 'model' : diag.raw ? 'parse' : 'build';
      diag.error = error instanceof Error ? error.message : String(error);
      result.errors.push(diag.error);
      console.log(`[goei] 인물 기록 갱신 실패: ${diag.error}`);
    } finally {
      diag.ms = Date.now() - t0;
      await pushDiag(diag, settings.keepRaw);
    }
    if (result.errors.length >= 3) break;
  }
  // 정리: 별도 호출 설정이면 저장 상한을 넘긴 인물마다 정리 호출 1회
  if (settings.tidy === 'separate' && result.ran) {
    const now = await loadContext().catch(() => null);
    if (now && chatId(now) === id) {
      const s = peopleStore(now.chat);
      const live = liveness(now.chat);
      for (const n of Object.keys(s.people)) {
        if (recordChars(s.people[n], live) <= settings.personCap) continue;
        const r = await consolidateInner(now, n, settings).catch((error) => ({ ok: false, message: String(error) }));
        if (!r.ok) result.skipped.push(`정리(${n}): ${r.message}`);
      }
    }
  }
  const after = await loadContext().catch(() => null);
  setStatus({ busy: false, label: '', unread: after ? unreadIndexes(after.chat, peopleStore(after.chat)).length : 0 });
  return result;
}

const input0Names = (s: PeopleStore) => Object.keys(s.people);

/** 지난 응답 읽기: 최근 turns 개 응답(0 = 전부) 가운데 안 읽은 것을 묶음으로 읽는다 (기능을 중간에 켰거나 끄고 지나간 구간) */
export async function backfillPeople(turns: number): Promise<RunResult> {
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return { ran: 0, applied: 0, skipped: ['채팅을 읽지 못했어요'], errors: [] };
  const store = peopleStore(ctx.chat);
  const unread = unreadIndexes(ctx.chat, store);
  const bots = ctx.chat.message.map((m, i) => (m.role === 'char' ? i : -1)).filter((i) => i >= 0);
  const pick = new Set(turns > 0 ? bots.slice(-turns) : bots);
  const indexes = unread.filter((i) => pick.has(i));
  if (!indexes.length) return { ran: 0, applied: 0, skipped: ['그 범위에 안 읽은 응답이 없어요'], errors: [] };
  return requestPeopleUpdate('backfill', { manual: true, scope: { indexes } });
}

/** 인물별 다시 읽기: 이 인물의 이야기 기록을 지우고, 그 인물이 나온 최근 turns 개 응답을 이 인물만 대상으로 다시 읽는다. 읽음 표시는 그대로 */
export async function rereadPerson(name: string, turns: number): Promise<RunResult & { cleared: number }> {
  if (running) return { ran: 0, applied: 0, skipped: ['갱신이 돌고 있어요'], errors: [], cleared: 0 };
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return { ran: 0, applied: 0, skipped: ['채팅을 읽지 못했어요'], errors: [], cleared: 0 };
  const store = peopleStore(ctx.chat);
  const p = store.people[name];
  if (!p) return { ran: 0, applied: 0, skipped: ['기록이 없는 인물'], errors: [], cleared: 0 };
  const indexes = mentionIndexes(ctx.chat, name, [...p.aliases, ...(allNames().find((n) => n.name === name)?.aliases ?? [])], turns);
  let cleared = 0;
  await updateChat(ctx.charIndex, ctx.chatIndex, (cur) => {
    const s = peopleStore(cur);
    cleared = clearStoryRecords(s, name);
    return withPeople(cur, s);
  });
  if (!indexes.length) return { ran: 0, applied: 0, skipped: ['최근 응답에 이 인물이 나오지 않아요 (기록만 비움)'], errors: [], cleared };
  const r = await requestPeopleUpdate('reread', { manual: true, scope: { indexes, only: [name] } });
  return { ...r, cleared };
}

/** 인물 기록 「정리」: 보조 모델이 이 인물의 살아 있는 항목을 더 적은 항목으로 다시 쓴다 (사용자가 눌렀을 때만, 1회 호출) */
export async function consolidatePerson(name: string): Promise<{ ok: boolean; message: string; report?: ConsolidateReport }> {
  if (running) return { ok: false, message: '갱신이 돌고 있어요. 끝난 뒤 다시 눌러 주세요.' };
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return { ok: false, message: '채팅을 읽지 못했어요.' };
  return consolidateInner(ctx, name, peopleSettings(ctx.chat.scriptstate));
}

async function consolidateInner(ctx: ChatContext, name: string, settings: PeopleSettings): Promise<{ ok: boolean; message: string; report?: ConsolidateReport }> {
  const store = peopleStore(ctx.chat);
  const input = buildConsolidate(store, ctx.chat, name, settings);
  if (!input) return { ok: false, message: '정리할 항목이 없어요.' };
  const id = chatId(ctx);
  const t0 = Date.now();
  const diag: DiagRun = { at: new Date().toISOString(), chat: id, reason: 'consolidate', model: settings.model, people: [name], indexes: [], sizes: { system: input.system.length, data: 0, span: 0 }, outChars: 0, ms: 0, ok: false };
  setStatus({ busy: true, label: `${name} 기록 정리 중…` });
  try {
    const dataText = JSON.stringify(input.data);
    diag.sizes.data = dataText.length;
    if (settings.keepRaw) (diag.system = input.system), (diag.data = dataText);
    const messages: LlmMessage[] = [
      { role: 'system', content: input.system },
      { role: 'user', content: `Record to tidy:\n${dataText}\n\nReturn the JSON object.` },
    ];
    const { raw, value } = await generate(messages, settings.model, parseConsolidate, { retries: 1, retryModel: 'same', state: ctx.chat.scriptstate });
    diag.raw = raw;
    diag.outChars = raw.length;
    await waitNotBusy();
    const saved = await updateChat(ctx.charIndex, ctx.chatIndex, (cur) => {
      if (chatId({ ...ctx, chat: cur }) !== id) return null;
      const s = peopleStore(cur);
      diag.tidy = applyConsolidate(s, name, input, value, liveness(cur), settings);
      return withPeople(cur, s);
    });
    if (!saved) {
      diag.stage = 'save';
      diag.error = '저장 직전에 채팅이 달라져 버림';
      return { ok: false, message: diag.error };
    }
    diag.ok = true;
    const r = diag.tidy!;
    const msg = r.slots ? `정리: ${r.slots}칸, 항목 ${r.before} → ${r.after}${r.dropped.length ? ` (${r.dropped.length}칸은 결과가 맞지 않아 그대로)` : ''}` : `바뀐 칸이 없어요${r.dropped.length ? ` (${r.dropped[0].reason})` : ''}`;
    return { ok: true, message: msg, report: r };
  } catch (error) {
    if (!diag.raw && error && typeof error === 'object' && 'raw' in error) diag.raw = String((error as { raw?: unknown }).raw ?? '');
    diag.stage = error instanceof LlmError ? 'model' : diag.raw ? 'parse' : 'build';
    diag.error = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `정리 실패: ${diag.error}` };
  } finally {
    diag.ms = Date.now() - t0;
    await pushDiag(diag, settings.keepRaw);
    setStatus({ busy: false, label: '' });
  }
}

// ── 연출형 Director (본편 앞) ──

let directorCache: { key: string; notes: DirectorNote[] } | null = null;
let directorSlowStreak = 0;
export const directorPaused = () => directorSlowStreak >= 3;

/** 연출형 메모 글. 시간 제한을 넘거나 실패하면 빈 문자열(본편을 막지 않는다). 입력·기록이 같으면 직전 메모 재사용 */
export async function directorNoteText(chat: Chat, store: PeopleStore, people: string[], input: string, settings: PeopleSettings, user: string): Promise<string> {
  if (settings.director !== 'scene' || directorPaused()) return '';
  const built = buildDirector(chat, store, people, input, settings, Object.fromEntries(people.map((n) => [n, valuesOf(n)])));
  if (!built) return '';
  if (settings.directorReuse && directorCache?.key === built.key) return directorBlock(directorCache.notes, user);
  const t0 = Date.now();
  const diag: DiagRun = { at: new Date().toISOString(), chat: '', reason: 'director', model: settings.model, people, indexes: [], sizes: { system: built.system.length, data: JSON.stringify(built.data).length, span: 0 }, outChars: 0, ms: 0, ok: false };
  try {
    const raw = await Promise.race([
      runModel([{ role: 'system', content: built.system }, { role: 'user', content: JSON.stringify(built.data) }], settings.model),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`시간 제한 ${settings.directorTimeout}초`)), settings.directorTimeout * 1000)),
    ]);
    diag.raw = raw;
    diag.outChars = raw.length;
    const notes = parseDirector(raw, people, true);
    directorCache = { key: built.key, notes };
    directorSlowStreak = 0;
    diag.ok = true;
    return directorBlock(notes, user);
  } catch (error) {
    diag.error = error instanceof Error ? error.message : String(error);
    diag.stage = /시간 제한/.test(diag.error) ? 'model' : 'parse';
    if (/시간 제한/.test(diag.error)) directorSlowStreak++;
    console.log(`[goei] Director 메모 생략: ${diag.error}`);
    return '';
  } finally {
    diag.ms = Date.now() - t0;
    await pushDiag(diag, settings.keepRaw);
  }
}

/** 설정 요약 (화면용) */
export function describeSettings(s: PeopleSettings): string {
  return [`갱신 ${s.when === 'turn' ? '매 턴' : '수동'}`, `모델 ${s.model === 'main' ? '메인' : '보조'}`, `지침 ${s.prompt === 'detailed' ? '자세히' : '간결'}`, `Director ${s.director === 'off' ? '끔' : s.director === 'facts' ? '사실형' : '연출형'}`].join(' · ');
}

export { liveness };
