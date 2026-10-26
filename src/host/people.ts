// 인물 기록 호스트: 갱신기를 실제로 돌린다 (모델 호출·채팅 저장·진단). 본편 응답 뒤(매 턴) 또는 「지금 갱신」에서.
// 쓰기 규칙: 본편 응답 대기 중이면 보류, 쓰기 직전 같은 채팅인지 확인, 덧붙이기만, 작업은 한 번에 하나.
import type { Chat } from '../core/types';
import { bookText } from '../core/refs';
import { generate, runModel, LlmError, type LlmMessage } from './llm';
import { buildDirector, directorBlock, parseDirector, type DirectorNote } from '../core/people/director';
import { loadContext, updateChat, type ChatContext } from './risu';
import { isWaiting, onWaiting } from './waiting';
import { peopleStore, withPeople, unreadIndexes, messageKey, messageHash as messageHashOf, liveness } from '../core/people/store';
import { applyUpdate, assemblePrompt, buildUpdate, enabledSections, parseUpdate, planBatches, type ApplyReport, type UpdateInput } from '../core/people/updater';
import { peopleSettings, type PeopleSettings } from '../core/people/settings';
import { seedPerson } from '../core/people/seed';
import { nameMatcher } from '../core/people/select';
import { allNames, seedBaseFor, valuesOf } from '../core/people/base';
import { playerAgent } from '../core/player';
import { promptFor } from '../core/people/prompt';
import { messageText } from '../core/refs';
import { findStatusTags } from '../core/world/status';
import { parseIdentity } from '../core/people/identity';
import type { Identity, PeopleStore } from '../core/people/types';

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
async function pushDiag(run: DiagRun, keepRaw: boolean): Promise<void> {
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

let inflight: Promise<RunResult> | null = null;
let pendingReason: string | null = null;

export interface RunResult { ran: number; applied: number; skipped: string[]; errors: string[] }

/** 안 읽은 응답을 묶음으로 읽어 기록에 반영한다. 이미 돌고 있으면 끝난 뒤 한 번 더 */
export function requestPeopleUpdate(reason: string, o: { manual?: boolean } = {}): Promise<RunResult> {
  if (inflight) {
    pendingReason = reason;
    return inflight;
  }
  inflight = runOnce(reason, o).finally(() => {
    inflight = null;
    if (pendingReason) {
      const r = pendingReason;
      pendingReason = null;
      void requestPeopleUpdate(r, o);
    }
  });
  return inflight;
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

async function runOnce(reason: string, o: { manual?: boolean }): Promise<RunResult> {
  const result: RunResult = { ran: 0, applied: 0, skipped: [], errors: [] };
  const ctx = await loadContext().catch(() => null);
  if (!ctx) return result;
  const settings = peopleSettings(ctx.chat.scriptstate);
  if (!settings.on || (settings.when === 'manual' && !o.manual)) return result;
  const store = peopleStore(ctx.chat);
  // 처음 등장한 인물 시드 (모델 없음) — 안 읽은 구간 전체
  const unread = unreadIndexes(ctx.chat, store);
  setStatus({ unread: unread.length });
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
      const system = assemblePrompt(promptFor(settings), enabledSections(settings), settings.rules);
      const input = buildUpdate(fresh.chat, curStore, batches[b], { settings, system, values: Object.fromEntries(input0Names(curStore).map((n) => [n, valuesOf(n)])), names: allNames(), exclude });
      if (!input.people.length) {
        // 장면 인물이 없으면 모델을 부르지 않고 읽음 표시만
        await updateChat(fresh.charIndex, fresh.chatIndex, (cur) => {
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
        });
        diag.report = report;
        return withPeople(cur, s);
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
      diag.stage = error instanceof LlmError ? 'model' : diag.raw ? 'parse' : 'build';
      diag.error = error instanceof Error ? error.message : String(error);
      if (!diag.raw && error && typeof error === 'object' && 'raw' in error) diag.raw = String((error as { raw?: unknown }).raw ?? '');
      result.errors.push(diag.error);
      console.log(`[goei] 인물 기록 갱신 실패: ${diag.error}`);
    } finally {
      diag.ms = Date.now() - t0;
      await pushDiag(diag, settings.keepRaw);
    }
    if (result.errors.length >= 3) break;
  }
  const after = await loadContext().catch(() => null);
  setStatus({ busy: false, label: '', unread: after ? unreadIndexes(after.chat, peopleStore(after.chat)).length : 0 });
  return result;
}

const input0Names = (s: PeopleStore) => Object.keys(s.people);

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
