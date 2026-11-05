// 첫 장면 (2026-11-05 사용자 결정): Risu 추가 첫 메시지(alternateGreetings)를 쓰지 않고 플러그인이 글을 첫 메시지로 넣는다.
// 기본 글은 세계 자료 팩(records.ts defaultScenes: 세력 공용 장면 = 원본 카드 인사말, 인물별 장면 = src/data/world/scenes.json),
// 고친 글·새 장면·인물별 글은 명부(Directory) 「첫 장면」 칸에 저장한다. 기존 세력은 인물을 누굴 고르든 공용 장면, 인물별 장면은
// 그 인물로 플레이할 때(주인공 = 그 요원) 「이 인물의 첫 장면」 하나로 보인다. 빈 칸이면 직접 입력·커스텀 임무만 (「첫 장면 없음」 표시 없음).
import { defaultScenes } from './world/records';
import type { LangCode } from './types';

/** 저장값 한 줄 (명부 「첫 장면」). 비운 칸은 기본값을 쓴다 */
export interface SceneData {
  label?: string;
  ko?: string;
  en?: string;
  /** 시작 화면에서 숨김 (기본 장면을 빼고 싶을 때. 지우지 않고 숨긴다) */
  hidden?: boolean;
}
export interface ScenesData {
  /** 세력 코드 → fm → 장면 */
  세력?: Record<string, Record<string, SceneData>>;
  /** 요원 ID(P001) → 장면 */
  인물?: Record<string, SceneData>;
}

export interface SceneRow {
  fm: number;
  label: string;
  ko: string;
  en: string;
  hidden: boolean;
  /** 기본값(팩)에 없는, 사용자가 만든 장면 */
  custom: boolean;
  /** 기본값이 있는 칸: 글을 비우면 기본 글로 돌아간다 */
  hasDefault: boolean;
}

/** 사용자가 만든 장면의 첫 번호 (기본 장면 번호와 겹치지 않게) */
export const CUSTOM_FM = 101;

const s = (v: unknown) => (typeof v === 'string' ? v : '');
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/** 저장값에서 「첫 장면」 칸만 골라 정리한다 (빈 값은 뺀다) */
export function pickScenes(raw: unknown): ScenesData {
  const d = obj(raw);
  const out: ScenesData = {};
  const one = (v: unknown): SceneData | null => {
    const o = obj(v);
    const row: SceneData = {};
    if (s(o.label).trim()) row.label = s(o.label).trim();
    if (s(o.ko).trim()) row.ko = s(o.ko);
    if (s(o.en).trim()) row.en = s(o.en);
    if (o.hidden === true) row.hidden = true;
    return Object.keys(row).length ? row : null;
  };
  for (const [code, rows] of Object.entries(obj(d.세력))) {
    for (const [fm, v] of Object.entries(obj(rows))) {
      if (!/^\d+$/.test(fm)) continue;
      const row = one(v);
      if (row) ((out.세력 ??= {})[code] ??= {})[fm] = row;
    }
  }
  for (const [id, v] of Object.entries(obj(d.인물))) {
    const row = one(v);
    if (row) (out.인물 ??= {})[id] = row;
  }
  return out;
}

function safeDefaults() {
  try {
    return defaultScenes();
  } catch {
    return { 세력: {}, 인물: {} };
  }
}

/** 세력 하나의 첫 장면 전체 (숨긴 것 포함, fm 순). 기본 장면 + 저장값 덧쓰기 + 사용자가 만든 장면 */
export function factionScenes(code: string, saved: ScenesData | undefined): SceneRow[] {
  const base = safeDefaults().세력[code] ?? {};
  const over = saved?.세력?.[code] ?? {};
  const fms = [...new Set([...Object.keys(base), ...Object.keys(over)])].map(Number).filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
  return fms.map((fm) => {
    const b = base[String(fm)];
    const o = over[String(fm)] ?? {};
    return {
      fm,
      label: o.label || b?.label || `장면 ${fm}`,
      ko: o.ko || b?.ko || '',
      en: o.en || b?.en || '',
      hidden: !!o.hidden,
      custom: !b,
      hasDefault: !!b,
    };
  });
}

/** 인물별 첫 장면 (저장값이 있으면 그것, 없으면 기본값). 둘 다 비면 null */
export function agentScene(agentId: string, saved: ScenesData | undefined): { ko: string; en: string } | null {
  const b = safeDefaults().인물[agentId];
  const o = saved?.인물?.[agentId];
  const ko = o?.ko || b?.ko || '';
  const en = o?.en || b?.en || '';
  return ko.trim() || en.trim() ? { ko, en } : null;
}

/** 저장값만 (기본값 없이) — 설정 창에서 「직접 고친 글」을 구분할 때 */
export function agentSceneSaved(agentId: string, saved: ScenesData | undefined): SceneData | undefined {
  return saved?.인물?.[agentId];
}

export const sceneText = (row: { ko: string; en: string } | null | undefined, lang: LangCode): string => (row ? (lang === 'en' ? row.en : row.ko) : '');

/** 다음 사용자 장면 번호 */
export function nextCustomFm(rows: SceneRow[]): number {
  return Math.max(CUSTOM_FM - 1, ...rows.map((r) => r.fm)) + 1;
}
