// 내 모습 (2026-11-07 사용자): 페르소나로 시작할 때 꼭 고르는 필드 인물 모습 = 일반 NPC 프리셋 하나의 정면(남쪽) 대기 동작.
// 고유 인물로 시작하면 고르지 않고 그 인물 모습. 고른 것은 채팅 변수 $st_look(인물 팩 번호, 예 '6.54')에 둔다.
// 성별은 격자를 거르는 데만 쓰고 본편 모델에 넘기지 않는다 (사용자: 페르소나 시트에 이미 있다).
// 그림·측정값은 내 모습 팩(scripts/data-pack.mjs looksPackText)에서 온다. 여기는 순수 계산.
import { expectOf, type PackSpec } from './datapack';
import type { ScriptState } from './types';

declare const __LOOKS_PACK__: string | undefined;

/** 내 모습 팩: 고를 때 처음 받는다 (host/looks.ts) */
export const LOOKS_PACK: PackSpec = { name: 'goei-data-looks', label: '인물 모습', expect: expectOf(typeof __LOOKS_PACK__ === 'string' ? __LOOKS_PACK__ : undefined) };

export const LOOK_KEY = '$st_look';
/** 대기 동작 한 장 길이 (필드 FIELD_CLIP idle 과 같은 0.6초) */
export const LOOK_FRAME_SEC = 0.6;

export type LookGender = '남' | '여';
export const LOOK_GENDERS: LookGender[] = ['남', '여'];

export interface LookRow {
  /** 인물 팩 번호 (char-6.54 → '6.54') */
  id: string;
  /** 프리셋 이름(시민남3) 또는 고유 인물 이름(에일린) */
  name: string;
  /** 일반 NPC 성별 (필드 신상표). 고유 인물은 '' */
  g: LookGender | '';
  unique: boolean;
  /** 장 수 */
  n: number;
  /** 원래 칸 크기 (128×256) */
  w: number;
  h: number;
  /** 잘린 장 크기 · 원래 칸 안의 자리 */
  cw: number;
  ch: number;
  ox: number;
  oy: number;
  /** 장 하나 길이 (초) */
  sec: number;
  /** 정면 대기 줄 시트 base64 webp (가로로 n장, 장마다 cw×ch) */
  img: string;
}

const obj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);

/** 내 모습 팩 글을 푼다. 형식이 다르면 던진다 */
export function parseLooksPack(text: string): LookRow[] {
  let j: unknown;
  try {
    j = JSON.parse(text);
  } catch {
    throw new Error('인물 모습 팩이 JSON 이 아니에요.');
  }
  if (!obj(j) || j.schema !== 1 || j.kind !== 'looks' || !Array.isArray(j.looks)) throw new Error('인물 모습 팩 형식이 달라요.');
  const out: LookRow[] = [];
  for (const r of j.looks as unknown[]) {
    if (!obj(r) || typeof r.id !== 'string' || typeof r.img !== 'string' || !r.img) continue;
    const n = num(r.n), cw = num(r.cw), ch = num(r.ch);
    if (!(n >= 1 && cw > 0 && ch > 0)) continue;
    const g = r.g === '남' || r.g === '여' ? r.g : '';
    out.push({ id: r.id, name: String(r.name ?? ''), g, unique: r.unique === true, n, w: num(r.w) || 128, h: num(r.h) || 256, cw, ch, ox: num(r.ox) || 0, oy: num(r.oy) || 0, sec: num(r.sec) > 0 ? num(r.sec) : LOOK_FRAME_SEC, img: r.img });
  }
  return out;
}

/** 이 채팅에서 고른 모습 번호 ('' = 고르지 않음) */
export const lookId = (state: ScriptState | Record<string, unknown> | undefined): string => {
  const v = String(state?.[LOOK_KEY] ?? '').trim();
  return /^\d+\.\d+$/.test(v) ? v : '';
};

/** 고르기 격자에 보일 모습: 그 성별의 일반 NPC 프리셋 전부 (팩 순서 그대로, 세력 구분 없음 — 2026-11-08 사용자) */
export const looksOf = (rows: LookRow[], g: LookGender): LookRow[] => rows.filter((r) => !r.unique && r.g === g);

/** 한 번도 고른 적 없을 때 기본 아바타 (2026-11-08 사용자: PixelLab 페르소나 여자 A) */
export const LOOK_FIRST = '페르소나여A';

/** 시작 패널 기본 아바타: 마지막에 고른 것 → 처음 기본 */
export function defaultLook(rows: LookRow[], last: string | undefined): string {
  if (last && rows.some((r) => r.id === last && !r.unique && !!r.g)) return last;
  return rows.find((r) => !r.unique && r.name === LOOK_FIRST)?.id ?? '';
}


/**
 * 이 채팅의 플레이 인물 모습: 고유 인물로 플레이하면 그 인물(명부 이름으로 찾음), 아니면 고른 프리셋. 없으면 undefined
 * @param playerName 고유 인물로 플레이할 때 그 인물 이름 (core/player.ts playerAgent().name)
 */
export function lookFor(rows: LookRow[], state: ScriptState | Record<string, unknown> | undefined, playerName?: string): LookRow | undefined {
  if (playerName) return rows.find((r) => r.unique && r.name === playerName);
  const id = lookId(state);
  return id ? rows.find((r) => r.id === id && !r.unique) : undefined;
}
