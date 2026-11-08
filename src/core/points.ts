// 백일몽 포인트 (2026-11-08 사용자): 백일몽 임직원 복지 포인트. 원화와 바꿔 쓸 수 없는 따로 된 장부라 가계부($st_wallet)와 섞지 않는다.
// 장부 모양·거래 살리기(기준 메시지)는 가계부와 같다 (core/wallet.ts 의 거래 함수를 그대로 쓴다). 채팅 변수 `$st_points` (JSON).
// 시작 포인트는 0 (등급별 지급은 본문에 적힌 대로 갱신기가 거래로 적는다).
import type { Chat } from './types';
import { findStatusTags } from './world/status';
import type { Wallet } from './wallet';

export const POINTS_VAR = '$st_points';
/** 포인트를 쓰는 조직 (상태창 신분 칸 「조직/직급」의 조직) */
export const POINTS_ORG = '백일몽';

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

/** 포인트 장부를 쓰나: 지금 신분이 백일몽이거나, 이미 포인트 거래가 있으면 (백일몽을 나와도 지난 기록은 보인다) */
export function pointsOn(chat: Chat): boolean {
  const org = lastIdentity(chat).split(/[/／]/)[0].trim();
  return org === POINTS_ORG || readPoints(chat.scriptstate).log.length > 0;
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
