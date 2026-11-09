// 백일몽 포인트 (2026-11-08 사용자): 백일몽 임직원 복지 포인트. 원화와 바꿔 쓸 수 없는 따로 된 장부라 가계부($st_wallet)와 섞지 않는다.
// 장부 모양·거래 살리기(기준 메시지)는 가계부와 같다 (core/wallet.ts 의 거래 함수를 그대로 쓴다). 채팅 변수 `$st_points` (JSON).
// 시작 포인트는 0 (등급별 지급은 본문에 적힌 대로 갱신기가 거래로 적는다).
import type { Chat } from './types';
import { findStatusTags } from './world/status';
import { addWalletEntry, aliveAnchors, liveWallet, removeWalletEntry, walletBalance, WALLET_MAX, type Wallet } from './wallet';
import { messageKey } from './people/store';
import { colConfig, isPointsOrg, POINTS_ON_VAR } from './world/statuscols';
export { isPointsOrg, POINTS_ORG } from './world/statuscols';

export const POINTS_VAR = '$st_points';

export function readPoints(vars: Record<string, unknown> | undefined): Wallet {
  const raw = vars?.[POINTS_VAR];
  const empty: Wallet = { start: 0, log: [] };
  if (typeof raw !== 'string' || !raw.trim()) return empty;
  try {
    const o = JSON.parse(raw) as Partial<Wallet>;
    if (!o || typeof o !== 'object') return empty;
    return { start: Number.isSafeInteger(o.start) ? (o.start as number) : 0, log: Array.isArray(o.log) ? o.log.filter((e) => !!e && typeof e === 'object' && typeof e.id === 'string' && typeof e.anchor === 'string' && Number.isSafeInteger(e.amount) && typeof e.memo === 'string').slice(-400) : [] };
  } catch {
    return empty;
  }
}

export const pointsVars = (w: Wallet): Record<string, string> => ({ [POINTS_VAR]: JSON.stringify(w) });

/** 마지막 상태창 신분 칸 (없으면 '') */
export function lastIdentity(chat: Chat): string {
  const msgs = chat.message ?? [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const tags = findStatusTags(String((msgs[i] as { data?: unknown }).data ?? ''));
    for (let k = tags.length - 1; k >= 0; k--) if (tags[k].identity) return tags[k].identity;
  }
  return '';
}


/** 포인트 칸 「자동」 켜짐 표시 (POINTS_ON_VAR) 를 마지막 신분에 맞춘 값. 신분 칸이 아직 없으면 fallback(시작 세력 등)을 따른다. 바뀔 게 없으면 null */
export function pointsFlagFor(chat: Chat, fallback = false): '1' | '0' | null {
  const id = lastIdentity(chat);
  const on = id ? isPointsOrg(id) : fallback;
  const want = on ? '1' : '0';
  return chat.scriptstate?.[POINTS_ON_VAR] === want ? null : want;
}

/** 포인트 장부를 쓰나: 포인트 칸이 사용 중이거나(자동이면 신분이 백일몽), 이미 포인트 거래가 있으면 (백일몽을 나와도 지난 기록은 보인다) */
export function pointsOn(chat: Chat): boolean {
  return colConfig(chat.scriptstate).points !== 'off' || readPoints(chat.scriptstate).log.length > 0;
}

/** 최근 포인트 거래 n줄 (영어 한 줄: 「-100 p 탈모약」). 상태창 맞춤 줄은 뺀다 */
export function recentPointLines(w: Wallet, alive: Set<string>, n: number): string[] {
  if (n <= 0) return [];
  return liveWallet(w, alive).filter((e) => e.memo !== POINTS_SYNC_MEMO).slice(-n).map((e) => `${e.amount > 0 ? '+' : ''}${e.amount.toLocaleString('en-US')} p ${e.memo}`);
}

export const POINTS_SYNC_MEMO = '상태창 포인트';

/** 마지막 응답의 상태창 포인트 칸에 장부를 맞춘다 (가계부 syncWalletToStatus 와 같은 방식). 바뀐 게 없으면 null */
export function syncPointsToStatus(w: Wallet, chat: Chat): Wallet | null {
  const msgs = chat.message ?? [];
  let i = msgs.length - 1;
  while (i >= 0 && msgs[i].role === 'user') i--;
  if (i < 0) return null;
  const m = msgs[i];
  const tags = findStatusTags(typeof m.data === 'string' ? m.data : '');
  let target: number | null = null;
  for (let k = tags.length - 1; k >= 0; k--) {
    const n = tags[k].points ? Number(tags[k].points) : NaN;
    if (Number.isSafeInteger(n) && Math.abs(n) <= WALLET_MAX) {
      target = n;
      break;
    }
  }
  if (target === null) return null;
  // 첫 포인트 상태창(앞선 응답에 포인트 칸이 없음)은 따르지 않는다 — 포인트는 무조건 0에서 시작 (2026-11-09 사용자: 모델이 「기본 포인트 900」을 지어내 적어도 장부는 0).
  // 그 뒤의 지급·사용은 갱신기 거래와 상태창 따르기가 적는다
  let first = true;
  for (let k = 0; k < i && first; k++) {
    if (msgs[k].role === 'user') continue;
    const d = typeof msgs[k].data === 'string' ? (msgs[k].data as string) : '';
    if (findStatusTags(d).some((t) => t.points)) first = false;
  }
  if (first) return null;
  const anchor = messageKey(m, i);
  const id = `ps_${anchor}`;
  const base = removeWalletEntry(w, id);
  const alive = aliveAnchors(chat);
  // 그 응답에 묶인 상점 거래는 상태창 다음 일이라 맞춤 셈에서 뺀다 (가계부와 같음)
  const before = { ...base, log: base.log.filter((e) => !(e.src === 'store' && e.anchor === anchor)) };
  const diff = target - walletBalance(before, alive);
  const next = diff === 0 ? base : addWalletEntry(base, { id, anchor, amount: diff, memo: POINTS_SYNC_MEMO, src: 'story' });
  return JSON.stringify(next) === JSON.stringify(w) ? null : next;
}

/** 「1,200 p」. 음수는 「−1,200 p」 */
export function formatPoints(n: number): string {
  return `${n < 0 ? '−' : ''}${Math.abs(Math.trunc(n)).toLocaleString('en-US')} p`;
}

/** 「500p」「1,000포인트」「1만 포인트」「500」 → 정수. 못 읽으면 null */
export function parsePoints(text: string): number | null {
  const t = String(text ?? '').replace(/\s+/g, '');
  if (!t) return null;
  const sign = /^[-−]/.test(t) ? -1 : 1;
  const body = t.replace(/^[-−+]/, '').replace(/(p|P|포인트|points?)$/i, '').replace(/,/g, '');
  if (/^\d+$/.test(body)) {
    const n = Number(body);
    return Number.isSafeInteger(n) ? sign * n : null;
  }
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(?:(\d+)천)?(?:(\d+)백)?(\d+)?$/.exec(body);
  if (!m || m.slice(1).every((x) => x === undefined)) return null;
  const n = Math.round(Number(m[1] ?? 0) * 1e8 + Number(m[2] ?? 0) * 1e4 + Number(m[3] ?? 0) * 1000 + Number(m[4] ?? 0) * 100 + Number(m[5] ?? 0));
  return Number.isSafeInteger(n) && n > 0 ? sign * n : null;
}

/** 글에 포인트 양이 적혀 있나 (「500p」「1,000 포인트」「1만 포인트」) */
export function mentionsPoints(text: string): boolean {
  return /\d[\d,]*\s*(?:p\b|P\b|포인트|points?\b)|\d+\s*(?:억|만|천)\s*포인트/i.test(text);
}
