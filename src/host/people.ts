// 인물 기록 호스트: 갱신기를 실제로 돌린다 (모델 호출·채팅 저장·진단). 본편 응답 뒤(매 턴) 또는 「지금 갱신」에서.
// 쓰기 규칙: 본편 응답 대기 중이면 보류, 쓰기 직전 같은 채팅인지 확인, 덧붙이기만, 작업은 한 번에 하나.
import type { Chat } from '../core/types';
import { bookText } from '../core/refs';
import { generate, runModel, LlmError, type LlmMessage } from './llm';
import { buildDirector, buildDirectorPass2, directorBlock, parseDirectorAny, repairDirector, runSearches, type DirectorInput, type DirectorNote } from '../core/people/director';
import { loadContext, updateChat, type ChatContext } from './risu';
import { isWaiting, onWaiting } from './waiting';
import { peopleStore, withPeople, splitUnread, unreadIndexes, messageKey, messageHash as messageHashOf, liveness, recordRun, snapshotRun } from '../core/people/store';
import { hypaSummaries } from '../core/people/hypa';
import { applyUpdate, assemblePrompt, buildUpdate, sectionBody, shopKeyLine, clearStoryRecords, enabledSections, mentionIndexes, parseUpdate, planBatches, recordChars, type ApplyReport } from '../core/people/updater';
import { applyConsolidate, buildConsolidate, consolidateUserText, parseConsolidate, type ConsolidateReport } from '../core/people/consolidate';
import { peopleSettings, type PeopleSettings } from '../core/people/settings';
import { seedPerson } from '../core/people/seed';
import { nameMatcher } from '../core/people/select';
import { buildRouter, parseRouter, type RouterHint } from '../core/people/router';
import { speechVarietyBlock } from '../core/people/speech';
import { sexualWriterSection } from '../core/people/sexual';
import { allNames, extraNames, seedBaseFor, temperOf, valuesOf } from '../core/people/base';
import { playerAgent } from '../core/player';
import { peopleBlockFor } from '../core/people/request';
import { userInfo } from './user';
import { promptFor, UPDATER_COMPACT, UPDATER_DETAILED } from '../core/people/prompt';
import { messageText } from '../core/refs';
import { findStatusTags } from '../core/world/status';
import { colConfig } from '../core/world/statuscols';
import { mentionsPoints, pointsOn, pointsVars, readPoints } from '../core/points';
import { addWalletEntry, aliveAnchors, mentionsAmount, readWallet, syncWalletToStatus, walletBalance, walletLoose, walletSyncOn, walletVars, WALLET_START_DEFAULT } from '../core/wallet';
import { applyItemChanges, itemAutoOn, itemStateOn, itemsAwayOf, itemsNowOf, itemsVars, readItems, setItemRules, usedItemsAt } from '../core/items';
import { ensureItemIcons, itemPictures } from './itemicons';
import { getPrefs } from '../core/settings';
import { settleShop, shopJudgeBy, shopJudgeGuide, shopOn, shopRule, stripShopTags } from '../core/shop';
import { guideSections } from '../core/guides';

/** Director 기본 지침: 지침 탭 「Director」의 FACTS·SCENE 절 */
/** Router 기본 지침: 지침 탭 「Router」의 ROLE·RULES 절 */
const routerBase = () => { const g = guideSections('Router'); return [g.ROLE, g.RULES].filter((x) => x?.trim()).join('\n'); };
const directorBase = () => { const g = guideSections('Director'); return { facts: g.FACTS, scene: g.SCENE }; };
import { parseIdentity } from '../core/people/identity';
import type { Identity, PeopleStore } from '../core/people/types';
import { factionList } from '../core/factions';
import type { LoreEntry } from '../core/types';

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
  stage?: 'build' | 'model' | 'parse' | 'save' | 'skip' | 'budget';
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
  if (!o.scope?.indexes) unread = splitUnread(ctx.chat, store).newer;
  else unread = o.scope.indexes.filter((i) => ctx.chat.message[i]?.role === 'char');
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
      // 백일몽 포인트 (core/points.ts): 신분이 백일몽이면 포인트 잔고를 자료에 넣고 포인트 거래 절을 켠다
      const pointsUse = pointsOn(fresh.chat);
      const pointBal = pointsUse ? walletBalance(readPoints(fresh.chat.scriptstate), aliveAnchors(fresh.chat)) : null;
      const batchKeys = batches[b].map((i) => (fresh.chat.message[i] ? messageKey(fresh.chat.message[i], i) : '')).filter(Boolean);
      // 소지품 (core/items.ts): 설정 「보조 모델이 읽기」가 켜져 있으면 지금 목록을 자료에 넣고 소지품 절을 켠다
      const itemsOn = itemAutoOn(fresh.chat.scriptstate);
      const itemsNow = itemsOn ? itemsNowOf(fresh.chat, itemPictures) : null;
      // 상태 그림 묶음(꿈결 수집기)의 그림 이름은 그림 팩에서 읽는다: 아직 안 받았으면 받기만 걸어 두고 이번 요청은 그림 이름 없이 간다
      if (itemsOn) void ensureItemIcons();
      const usedNow = itemsOn ? usedItemsAt(readItems(fresh.chat.scriptstate), batchKeys, aliveAnchors(fresh.chat)) : [];
      // 상점 판단 (11-09, 설정 「상점 판단」): 갱신기가 맡으면 이 묶음에 든 가장 최근 응답 하나를 판단한다. 다시 읽기(only)는 하지 않는다
      const lastChar = fresh.chat.message.reduce((a, m, i) => (m.role === 'char' ? i : a), -1);
      const shopAt = !o.scope?.only && shopOn(fresh.chat.scriptstate) && shopJudgeBy(fresh.chat.scriptstate).by === 'updater' && batches[b].includes(lastChar) ? lastChar : -1;
      const shopSelf = shopAt >= 0 ? [...exclude, userInfo().name] : [];
      const input = buildUpdate(fresh.chat, curStore, batches[b], { shop: shopAt >= 0 ? { at: shopAt, self: shopSelf } : null,  settings, system: '', values: Object.fromEntries(input0Names(curStore).map((n) => [n, valuesOf(n)])), names: allNames(), hints: routerHintsNow(), memory: await hypaMemory(fresh.chat, fresh.char, [...batches[b].map((i) => messageText(String(fresh.chat.message[i]?.data ?? ''))), ...Object.keys(curStore.people)].join('\n'), settings), exclude, factionNames: factionNamesOf(fresh.char.globalLore), only: o.scope?.only, wallet: balance, points: pointBal, items: itemsNow, used: usedNow, away: itemsOn ? itemsAwayOf(fresh.chat) : [] });
      // 지침은 자료를 본 뒤 조립한다 (저장 상한을 넘긴 인물이 있으면 정리 절을 켠다)
      const sections = enabledSections(settings);
      if (input.tidy.length) sections.add('tidy');
      if (walletOn) sections.add('wallet');
      if (walletOn && walletLoose(fresh.chat.scriptstate)) sections.add('wallet_loose');
      if (pointsUse) sections.add('points');
      if (itemsOn) sections.add('items');
      const system = updaterSystem(settings, sections, fresh.chat.scriptstate, !!input.shop);
      input.system = system;
      if (input.overBudget.length) {
        // 2026-11-07 사용자 결정(W4, 원본 writerInputBudgetTokens): 확정 응답 글이 상한을 넘으면 접어서 보내지 않고 거부한다. 읽음 표시도 안 한다
        diag.stage = 'budget';
        diag.error = `입력 상한 넘김(${settings.spanCap.toLocaleString()}자, ${input.overBudget.length}개 응답): 보내지 않음. 설정 「응답 길이 상한」을 올리거나 긴 응답을 나눠 읽기`;
        result.skipped.push(diag.error);
        console.log(`[goei] 인물 기록 갱신 거부: ${diag.error}`);
        continue;
      }
      // 장면 인물이 없어도 소지품·가계부는 이 갱신기가 읽는다 (11-08 전수점검: 혼자 있는 장면에서 얻은 물건·쓴 돈이 기록되지 않았다).
      // 소지품 읽기가 켜져 있거나, 가계부가 켜져 있고 글에 금액이 있거나 어림도 받을 때만 부른다 (쓸데없는 호출은 그대로 안 함)
      const moneyOrItems = !!input.shop || itemsOn || (walletOn && (walletLoose(fresh.chat.scriptstate) || batches[b].some((i) => mentionsAmount(messageText(String(fresh.chat.message[i]?.data ?? '')))))) || (pointsUse && batches[b].some((i) => mentionsPoints(messageText(String(fresh.chat.message[i]?.data ?? '')))));
      if (!input.people.length && !moneyOrItems) {
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
      const { raw, value } = await generate(messages, settings.stageModel.update, parseUpdate, { retries: 1, retryModel: 'same', state: fresh.chat.scriptstate, staticModel: settings.stageModelId.update || undefined, label: '갱신기' });
      diag.raw = raw;
      diag.outChars = raw.length;
      // 쓰기: 응답 대기 중이면 기다리고, 같은 채팅인지·메시지가 그대로인지 확인
      await waitNotBusy();
      const keys = new Map([...input.tags.values()].map((i) => [i, messageKey(fresh.chat.message[i], i)]));
      const saved = await updateChat(fresh.charIndex, fresh.chatIndex, (cur) => {
        if (chatId({ ...fresh, chat: cur }) !== id) return null;
        for (const [i, k] of keys) if (!cur.message[i] || messageKey(cur.message[i], i) !== k) return null;
        const s = peopleStore(cur);
        const before = snapshotRun(s);
        const report = applyUpdate(s, cur, input, value, {
          settings,
          sheetOf: sheet,
          baseOf: (name) => seedBaseFor(name, userFaction(cur), s.identity),
          exclude,
          only: o.scope?.only,
          keepRead: !!o.scope?.only,
          wallet: walletOn,
          walletLoose: walletOn && walletLoose(cur.scriptstate),
          points: pointsUse,
          items: itemsOn,
        });
        diag.report = report;
        // 되돌리기용 (리수폿 J-4): 이 갱신이 새로 만든 것. 다시 읽기(only)는 적지 않는다
        if (!o.scope?.only) recordRun(s, before, new Date().toISOString());
        let next = cur;
        if (report.wallet.length) {
          let w = readWallet(cur.scriptstate, walletStart);
          for (const e of report.wallet) w = addWalletEntry(w, { ...e, src: 'story' });
          next = { ...cur, scriptstate: { ...(cur.scriptstate ?? {}), ...walletVars(w) } };
        }
        if (report.points.length) {
          let p = readPoints(next.scriptstate);
          for (const e of report.points) p = addWalletEntry(p, { ...e, src: 'story' });
          next = { ...next, scriptstate: { ...(next.scriptstate ?? {}), ...pointsVars(p) } };
        }
        // 거래를 적은 뒤 상태창 잔고 맞춤 줄을 다시 계산한다 (같은 거래를 두 번 세지 않게, core/wallet.ts syncWalletToStatus)
        // 설정 「상태창 잔고 따르기」가 꺼져 있으면 맞추지 않는다 (본편 응답 처리 body.ts 와 같은 조건, 11-08 전수점검)
        if (walletOn && walletSyncOn(next.scriptstate)) {
          const w = syncWalletToStatus(readWallet(next.scriptstate, walletStart), next);
          if (w) next = { ...next, scriptstate: { ...(next.scriptstate ?? {}), ...walletVars(w) } };
        }
        // 소지품 변화를 목록($st_items)에 (core/items.ts applyItemChanges). 소모성 횟수는 「사용」 기록으로 이미 셈 — 여기선 본문이 말한 변화만
        if (report.items.length) {
          // 판정 표·「두고 옴」 말은 이 채팅의 설정으로 (core/itemrules.ts). order = 메시지 차례 (사용자가 버린 물건은 버린 뒤의 메시지가 근거일 때만 되살린다)
          setItemRules(next.scriptstate);
          const it = applyItemChanges(readItems(next.scriptstate), aliveAnchors(next), report.items, { state: itemStateOn(next.scriptstate), order: (next.message ?? []).map((m, i) => messageKey(m, i)) });
          next = { ...next, scriptstate: { ...(next.scriptstate ?? {}), ...itemsVars(it) } };
        }
        // 상점 판단 (11-09): 판단한 응답 끝의 표식을 갱신기 판단대로 바꾸고(있으면 붙이고 없으면 지움) 본편과 같은 정리(settleShop)를 돌린다.
        // 화면의 「상점 열기」 카드는 표식에서 그려지니 본편이 판단할 때와 같은 길로 뜬다
        if (report.shop !== undefined && shopAt >= 0 && next.message[shopAt]) {
          const at = report.shop?.index ?? shopAt;
          const body = stripShopTags(String(next.message[at].data ?? ''));
          const list = [...next.message];
          list[at] = { ...list[at], data: report.shop ? `${body}\n[shop: ${report.shop.name}|${report.shop.owner}]` : body };
          next = { ...next, message: list };
          const r = settleShop(next, at, shopSelf);
          if (r) next = { ...next, ...(r.message ? { message: r.message } : {}), scriptstate: { ...(next.scriptstate ?? {}), ...r.vars } };
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

/** 갱신기 지침 조립 (실제 호출·미리보기 같은 길). 상점 판단을 맡으면 「상점」 절을 켜고 기준 글(지침 「상점」 SHOP_RULE·SHOP_JUDGE)을 채운다.
 *  지침을 고쳐 둔 사용자는 고친 글에 상점 절이 없을 수 있어 기본 글의 절을 덧붙인다 (릴리스 점검 11-09: 안 그러면 상점이 매 턴 닫혔다) */
function updaterSystem(settings: PeopleSettings, sections: Set<string>, vars: Record<string, unknown> | undefined, shop: boolean): string {
  const base = promptFor(settings);
  if (shop) sections.add('shop');
  let system = assemblePrompt(base, sections, settings.rules, settings.lang, speechVarietyBlock(settings, 'writer'), sexualWriterSection(settings));
  if (shop && !base.includes('<<SECTION:shop>>')) {
    const def = settings.prompt === 'compact' ? UPDATER_COMPACT : UPDATER_DETAILED;
    system += `\n\n${sectionBody(def, 'shop') ?? ''}\n${shopKeyLine()}`;
  }
  return system.replace('<<SHOP_RULE>>', () => (shop ? shopRule(vars) : '')).replace('<<SHOP_JUDGE>>', () => (shop ? shopJudgeGuide() : ''));
}

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
      { role: 'user', content: consolidateUserText(dataText) },
    ];
    const { raw, value } = await generate(messages, settings.stageModel.tidy, parseConsolidate, { retries: 1, retryModel: 'same', state: ctx.chat.scriptstate, staticModel: settings.stageModelId.tidy || undefined, label: '정리' });
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

/** 하이파 참조 (리수폿 J-3, 2026-11-07 관련도 선택·플러스): 설정이 꺼져 있으면 빈 목록. 플러스는 플러그인 저장소 hypaplus_state_<char>_<chat> */
async function hypaMemory(chat: Chat, char: { chaId?: string } | undefined, query: string, s: PeopleSettings, cap = s.hypaCap): Promise<string[]> {
  if (!s.hypa) return [];
  let plus: unknown;
  if (s.hypaPlus) {
    const charId = String(char?.chaId ?? '').trim();
    const chatKey = String((chat as Record<string, unknown>).id ?? '').trim();
    if (charId && chatKey) {
      try { plus = await risuai.pluginStorage.getItem(`hypaplus_state_${charId}_${chatKey}`); } catch { plus = undefined; }
    }
  }
  return hypaSummaries(chat, cap, query, { plus: plus ?? undefined, maxItems: s.hypaItems });
}

// ── 모델 Router (본편 앞, 설정 router=model) ──

let routerCache: { key: string; selected: string[] } | null = null;
let routerHints: RouterHint[] = [];
// 2026-11-07: 시간 초과 누적으로 세션 끝까지 끄던 routerSlowStreak 는 뺌 (원본은 그 턴만 생략). 전수검사 2 의 A
/** 마지막 Router 가 본 미등록 이름 (갱신기 힌트) */
export const routerHintsNow = (): RouterHint[] => routerHints;

/** 모델이 고른 장면 인물. 실패·지연·빈 결과면 null (코드 Router 로). 입력·최근 글·명단이 같으면 재사용 */
export async function routerPeople(chat: Chat, store: PeopleStore, input: string, settings: PeopleSettings, exclude: string[] = [], identityOf?: (name: string) => string | null | undefined): Promise<string[] | null> {
  if (settings.router !== 'model' || !Object.keys(store.people).length) return null;
  const names = allNames();
  const built = buildRouter(chat, store, names, input, { exclude, recent: settings.recentMsgs, prompt: routerBase(), rules: settings.routerRules, identityOf });
  if (routerCache?.key === built.key) return routerCache.selected;
  const t0 = Date.now();
  const diag: DiagRun = { at: new Date().toISOString(), chat: '', reason: 'router', model: settings.stageModel.router, people: [], indexes: [], sizes: { system: built.system.length, data: JSON.stringify(built.data).length, span: 0 }, outChars: 0, ms: 0, ok: false };
  try {
    const raw = await Promise.race([
      runModel([{ role: 'system', content: built.system }, { role: 'user', content: JSON.stringify(built.data) }], settings.stageModel.router, settings.stageModelId.router || undefined, '라우터'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`시간 제한 ${settings.routerTimeout}초`)), settings.routerTimeout * 1000)),
    ]);
    diag.raw = raw;
    diag.outChars = raw.length;
    const r = parseRouter(raw, store, names, built.max);
    diag.people = r.selected;
    diag.ok = true;
    routerCache = { key: built.key, selected: r.selected };
    routerHints = r.newCharacters;
    return r.selected.length ? r.selected : null;
  } catch (error) {
    diag.error = error instanceof Error ? error.message : String(error);
    diag.stage = /시간 제한/.test(diag.error) ? 'model' : 'parse';
    console.log(`[goei] Router 생략 (코드 Router 로): ${diag.error}`);
    return null;
  } finally {
    diag.ms = Date.now() - t0;
    await pushDiag(diag, settings.keepRaw);
  }
}

// ── Director (본편 앞, 사실형·연출형. 원본은 두 역할 다 본편 앞 1회 호출) ──

let directorCache: { key: string; notes: DirectorNote[] } | null = null;
// 2026-11-07: directorSlowStreak(3회 초과 시 세션 끝까지 끔) 뺌. 실패는 그 턴만 메모 없이 진행

/** Director 메모 글(사실형·연출형). 시간 제한을 넘거나 실패하면 빈 문자열(본편을 막지 않는다). 입력·기록이 같으면 직전 메모 재사용 */
export async function directorNoteText(chat: Chat, store: PeopleStore, people: string[], input: string, settings: PeopleSettings, user: string, lore?: unknown, char?: { chaId?: string }): Promise<string> {
  if (settings.director !== 'scene' && settings.director !== 'facts') return '';
  const built = buildDirector(chat, store, people, input, settings, Object.fromEntries(people.map((n) => [n, valuesOf(n)])), await hypaMemory(chat, char, [input, ...(Array.isArray(chat.message) ? chat.message.slice(-Math.max(1, settings.recentMsgs)).map((m) => messageText(String(m.data ?? ''))) : []), ...people].join('\n'), settings, Math.min(settings.hypaCap, 6000)), directorBase());
  if (!built) return '';
  if (settings.directorReuse && directorCache?.key === built.key) return directorBlock(directorCache.notes, user);
  // 1차: 메모 또는 검색 요청. 검색 요청이면 코드가 찾아서 2차 (리수폿 B). 각 호출에 시간 제한
  // 출력 검증(JSON·notes)에 실패하면 원본처럼 「고침 요청」을 붙여 1회 더 묻는다 (repairDirectorPrompt 상당)
  const call = async (b: DirectorInput, reason: string, allowSearch: boolean, repaired = false): Promise<ReturnType<typeof parseDirectorAny> | null> => {
    const t0 = Date.now();
    const diag: DiagRun = { at: new Date().toISOString(), chat: '', reason, model: settings.stageModel.director, people, indexes: [], sizes: { system: b.system.length, data: JSON.stringify(b.data).length, span: 0 }, outChars: 0, ms: 0, ok: false };
    try {
      const raw = await Promise.race([
        runModel([{ role: 'system', content: b.system }, { role: 'user', content: JSON.stringify(b.data) }], settings.stageModel.director, settings.stageModelId.director || undefined, '디렉터'),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`시간 제한 ${settings.directorTimeout}초`)), settings.directorTimeout * 1000)),
      ]);
      diag.raw = raw;
      diag.outChars = raw.length;
      const r = parseDirectorAny(raw, people, settings.director === 'scene', allowSearch);
      diag.ok = true;
      return r;
    } catch (error) {
      diag.error = error instanceof Error ? error.message : String(error);
      diag.stage = /시간 제한/.test(diag.error) ? 'model' : 'parse';
      console.log(`[goei] Director 메모 ${diag.stage === 'parse' && !repaired ? '고침 요청' : '생략'}: ${diag.error}`);
      if (diag.stage === 'parse' && !repaired && diag.raw) return call(repairDirector(b, diag.raw, diag.error), `${reason}-repair`, allowSearch, true);
      return null;
    } finally {
      diag.ms = Date.now() - t0;
      await pushDiag(diag, settings.keepRaw);
    }
  };
  let r = await call(built, 'director', built.search);
  if (r && 'need' in r) {
    const found = runSearches(r.need, { chat, lore });
    r = await call(buildDirectorPass2(built, found), 'director2', false);
  }
  if (!r || !('notes' in r)) return '';
  directorCache = { key: built.key, notes: r.notes };
  return directorBlock(r.notes, user);
}

/** 설정 요약 (화면용) */
export function describeSettings(s: PeopleSettings): string {
  return [`갱신 ${s.when === 'turn' ? '매 턴' : '수동'}`, `모델 ${s.model === 'main' ? '메인' : '보조'}`, `지침 ${s.prompt === 'detailed' ? '자세히' : '간결'}`, `Director ${s.director === 'off' ? '끔' : s.director === 'note' ? '메모형' : s.director === 'facts' ? '사실형' : '연출형'}`].join(' · ');
}

export { liveness };

// ── 호출 흐름 미리 계산 (2026-11-07 사용자: 지금 설정으로 들어갈 요청을 조립해 토큰을 보인다). 모델을 부르지 않고 요청만 만든다 ──

/** 지금 설정·채팅으로 Router·Director·갱신기가 보낼 요청 (없으면 null). 유저 입력은 마지막 유저 메시지로 친다 */
export async function previewPeopleCalls(ctx: ChatContext): Promise<{ router: LlmMessage[] | null; director: LlmMessage[] | null; update: LlmMessage[] | null }> {
  const out = { router: null as LlmMessage[] | null, director: null as LlmMessage[] | null, update: null as LlmMessage[] | null };
  const settings = peopleSettings(ctx.chat.scriptstate);
  if (!settings.on) return out;
  const store = peopleStore(ctx.chat);
  const exclude = excludedNames(ctx);
  const lastUser = [...(ctx.chat.message ?? [])].reverse().find((m) => m.role === 'user');
  const input = messageText(String(lastUser?.data ?? ''));
  const names = allNames();
  if (settings.router === 'model' && Object.keys(store.people).length) {
    const b = buildRouter(ctx.chat, store, names, input, { exclude, recent: settings.recentMsgs, prompt: routerBase(), rules: settings.routerRules, identityOf: sheetOf(ctx) });
    out.router = [{ role: 'system', content: b.system }, { role: 'user', content: JSON.stringify(b.data) }];
  }
  if ((settings.director === 'scene' || settings.director === 'facts') && Object.keys(store.people).length) {
    const me = playerAgent(ctx.char.globalLore, ctx.chat.scriptstate);
    const { people } = peopleBlockFor(ctx.chat, { settings, store, sheetOf: sheetOf(ctx), temperOf, extraNames: extraNames(), input, user: me?.name || userInfo().name || '주인공', factionNames: factionNamesOf(ctx.char.globalLore) });
    const memory = await hypaMemory(ctx.chat, ctx.char, [input, ...people].join('\n'), settings, Math.min(settings.hypaCap, 6000)).catch(() => [] as string[]);
    const b = buildDirector(ctx.chat, store, people, input, settings, Object.fromEntries(people.map((n) => [n, valuesOf(n)])), memory, directorBase());
    if (b) out.director = [{ role: 'system', content: b.system }, { role: 'user', content: JSON.stringify(b.data) }];
  }
  if (settings.when === 'turn') {
    // 다음 턴 갱신기는 「마지막 응답 하나」를 읽는다고 치고 조립한다
    const list = ctx.chat.message ?? [];
    let last = -1;
    for (let i = list.length - 1; i >= 0; i--) if (list[i].role === 'char') { last = i; break; }
    if (last >= 0) {
      const walletOn = colConfig(ctx.chat.scriptstate).wallet !== 'off';
      const balance = walletOn ? walletBalance(readWallet(ctx.chat.scriptstate, getPrefs().walletStart ?? WALLET_START_DEFAULT), aliveAnchors(ctx.chat)) : null;
      const itemsOn = itemAutoOn(ctx.chat.scriptstate);
      const itemsNow = itemsOn ? itemsNowOf(ctx.chat, itemPictures) : null;
      const usedNow = itemsOn && list[last] ? usedItemsAt(readItems(ctx.chat.scriptstate), [messageKey(list[last], last)], aliveAnchors(ctx.chat)) : [];
      const memory = await hypaMemory(ctx.chat, ctx.char, [messageText(String(list[last]?.data ?? '')), ...Object.keys(store.people)].join('\n'), settings).catch(() => [] as string[]);
      // 상점 판단 (실제 호출과 같게, 릴리스 점검 11-09)
      const shopOnNow = shopOn(ctx.chat.scriptstate) && shopJudgeBy(ctx.chat.scriptstate).by === 'updater';
      const inp = buildUpdate(ctx.chat, store, [last], { shop: shopOnNow ? { at: last, self: [...exclude, userInfo().name] } : null, settings, system: '', values: Object.fromEntries(input0Names(store).map((n) => [n, valuesOf(n)])), names, hints: routerHintsNow(), memory, exclude, factionNames: factionNamesOf(ctx.char.globalLore), wallet: balance, points: pointsOn(ctx.chat) ? walletBalance(readPoints(ctx.chat.scriptstate), aliveAnchors(ctx.chat)) : null, items: itemsNow, used: usedNow, away: itemsOn ? itemsAwayOf(ctx.chat) : [] });
      const sections = enabledSections(settings);
      if (inp.tidy.length) sections.add('tidy');
      if (walletOn) sections.add('wallet');
      if (walletOn && walletLoose(ctx.chat.scriptstate)) sections.add('wallet_loose');
      if (pointsOn(ctx.chat)) sections.add('points');
      if (itemsOn) sections.add('items');
      const system = updaterSystem(settings, sections, ctx.chat.scriptstate, !!inp.shop);
      out.update = [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(inp.data) }];
    }
  }
  return out;
}
