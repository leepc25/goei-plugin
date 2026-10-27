// 가계부 (2026-10-27 설계안 8절): 잔고의 진실은 플러그인 장부. 상태창 10번째 칸(잔고)은 모델이 베껴 쓰는 자리이고,
// `[Previous status]` 의 잔고 칸을 매 턴 장부 값으로 덮어써 모델 오차를 바로잡는다.
// 장부는 채팅 변수 `$st_wallet` (JSON): 시작 잔고 + 거래 목록. 거래는 기준 메시지(anchor)가 채팅에 남아 있을 때만 산다 (다시 굴리기·삭제 대응).
import type { Chat } from './types';
import { messageKey } from './people/store';

export const WALLET_VAR = '$st_wallet';

export interface WalletEntry {
  id: string;
  /** 기준 메시지 키 (messageKey). 수동 조정은 빈 문자열 (늘 산다) */
  anchor: string;
  /** 원 단위, 들어오면 +, 나가면 − */
  amount: number;
  /** 무엇에 (한국어 ≤30) */
  memo: string;
  src: 'story' | 'manual' | 'field';
  quote?: string;
  at: string;
}

export interface Wallet {
  start: number;
  log: WalletEntry[];
}

export const WALLET_MAX = 1_000_000_000_000;

const isEntry = (e: unknown): e is WalletEntry => {
  const x = e as WalletEntry;
  return !!x && typeof x === 'object' && typeof x.id === 'string' && typeof x.anchor === 'string' && Number.isSafeInteger(x.amount) && typeof x.memo === 'string' && (x.src === 'story' || x.src === 'manual' || x.src === 'field');
};

/** 장부 읽기. 없거나 깨졌으면 시작 잔고 defaultStart 의 빈 장부 */
export function readWallet(vars: Record<string, unknown> | undefined, defaultStart = 0): Wallet {
  const raw = vars?.[WALLET_VAR];
  const empty: Wallet = { start: defaultStart, log: [] };
  if (typeof raw !== 'string' || !raw.trim()) return empty;
  try {
    const o = JSON.parse(raw) as Partial<Wallet>;
    if (!o || typeof o !== 'object') return empty;
    return { start: Number.isSafeInteger(o.start) ? (o.start as number) : defaultStart, log: Array.isArray(o.log) ? o.log.filter(isEntry).slice(-400) : [] };
  } catch {
    return empty;
  }
}

export const walletVars = (w: Wallet): Record<string, string> => ({ [WALLET_VAR]: JSON.stringify(w) });

/** 채팅에 남아 있는 메시지 키 (이 키를 기준으로 하는 거래만 산다) */
export function aliveAnchors(chat: Chat): Set<string> {
  return new Set((chat.message ?? []).map((m, i) => messageKey(m, i)));
}

/** 살아 있는 거래 (수동 조정은 늘) */
export function liveWallet(w: Wallet, alive: Set<string>): WalletEntry[] {
  return w.log.filter((e) => !e.anchor || alive.has(e.anchor));
}

/** 지금 잔고 */
export function walletBalance(w: Wallet, alive: Set<string>): number {
  return liveWallet(w, alive).reduce((n, e) => n + e.amount, w.start);
}

const hash = (text: string) => {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
};

export const walletEntryId = (anchor: string, amount: number, memo: string) => `w_${hash(`${anchor}|${amount}|${memo}`)}`;

/** 거래 더하기 (같은 id 가 있으면 그대로). 금액 0·범위 밖은 무시 */
export function addWalletEntry(w: Wallet, e: Omit<WalletEntry, 'id' | 'at'> & { id?: string; at?: string }): Wallet {
  if (!Number.isSafeInteger(e.amount) || e.amount === 0 || Math.abs(e.amount) > WALLET_MAX) return w;
  const id = e.id ?? walletEntryId(e.anchor, e.amount, e.memo);
  if (w.log.some((x) => x.id === id)) return w;
  return { ...w, log: [...w.log, { ...e, id, memo: e.memo.slice(0, 30), at: e.at ?? new Date().toISOString() }].slice(-400) };
}

export function removeWalletEntry(w: Wallet, id: string): Wallet {
  return { ...w, log: w.log.filter((e) => e.id !== id) };
}

/** 잔고를 target 으로 맞추는 수동 조정 한 줄 */
export function adjustWallet(w: Wallet, alive: Set<string>, target: number, memo = '잔고 수정'): Wallet {
  const diff = Math.trunc(target) - walletBalance(w, alive);
  if (!diff) return w;
  return addWalletEntry(w, { anchor: '', amount: diff, memo, src: 'manual', id: `m_${Date.now().toString(36)}_${w.log.length}` });
}

/** 「₩ 1,230,000」. 음수는 「−₩ 5,000」 */
export function formatWon(n: number): string {
  const abs = Math.abs(Math.trunc(n)).toLocaleString('en-US');
  return `${n < 0 ? '−' : ''}₩ ${abs}`;
}

/** 변화 표기 「+50,000」「−5,000」. 0이면 빈 문자열 */
export function formatDelta(n: number): string {
  if (!n) return '';
  return `${n > 0 ? '+' : '−'}${Math.abs(Math.trunc(n)).toLocaleString('en-US')}`;
}

/** 「3만 원」「50,000원」「₩1,200」「12만5천원」 → 원 단위 정수. 못 읽으면 null */
export function parseWon(text: string): number | null {
  const t = String(text ?? '').replace(/\s+/g, '');
  if (!t) return null;
  const sign = /^[-−]/.test(t) ? -1 : 1;
  const body = t.replace(/^[-−+]/, '').replace(/^₩/, '').replace(/(원|won|KRW)$/i, '');
  if (/^\d[\d,]*$/.test(body)) {
    const n = Number(body.replace(/,/g, ''));
    return Number.isSafeInteger(n) ? sign * n : null;
  }
  // 한국어 단위: 억·만·천·백
  const m = /^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(?:(\d+)천)?(?:(\d+)백)?(\d+)?$/.exec(body.replace(/,/g, ''));
  if (!m || m.slice(1).every((x) => x === undefined)) return null;
  const n = Math.round((Number(m[1] ?? 0) * 1e8) + (Number(m[2] ?? 0) * 1e4) + Number(m[3] ?? 0) * 1000 + Number(m[4] ?? 0) * 100 + Number(m[5] ?? 0));
  return Number.isSafeInteger(n) && n > 0 ? sign * n : null;
}

/** 글에 금액이 적혀 있나 (갱신기 거래 검사: 인용에 숫자 금액이 있어야) */
export function mentionsAmount(text: string): boolean {
  return /(₩\s*\d|\d[\d,]*\s*(?:원|won|KRW)|\d+\s*(?:억|만|천)\s*(?:원)?)/i.test(text);
}
