// 소지품 판정 칸 (장착 갈래·상태·소모 횟수·쓰임 글). 다른 데에 기대지 않는 순수 함수만 — 명부(world/directory)·시작 소지품이 소지품 전체를 끌어오지 않게 (core/items.ts 가 다시 내보냄)

/** 장착 갈래 (2026-11-07 사용자: 부위 나누지 않고 무기·무기 아닌 것 둘만). 칸: 무기 2 · 장비 4 */
export type ItemEquip = 'weapon' | 'gear';
export const EQUIP_SLOTS: Record<ItemEquip, number> = { weapon: 2, gear: 4 };
export const EQUIP_LABEL: Record<ItemEquip, string> = { weapon: '무기', gear: '장비' };
export const itemEquip = (v: unknown): ItemEquip | undefined => (v === 'weapon' || v === 'gear' ? v : undefined);

/** 상태 (파괴는 목록에서 빠지고 기록 「파괴」) */
export type ItemState = 'ok' | 'damaged' | 'broken';
export const STATE_LABEL: Record<ItemState, string> = { ok: '멀쩡', damaged: '손상', broken: '고장' };
export const itemState = (v: unknown): ItemState => (v === 'damaged' || v === 'broken' ? v : 'ok');

/** 소모성 횟수 (1~999). 아니면 undefined = 비소모 */
export const itemUses = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim()) : Number(v);
  return Number.isSafeInteger(n) && n >= 1 ? Math.min(999, n) : undefined;
};

/** 무게 kg (2026-11-08 사용자: 칸 수에 더해 무게도). 물건을 만드는 모델이 정한다. 0 이상, 소수 셋째 자리까지. 없으면 undefined */
export const itemWeight = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.trim().replace(/,/g, '.').replace(/\s*(kg|킬로그램|킬로)$/i, '')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? Math.min(9999, Math.round(n * 1000) / 1000) : undefined;
};
/** 무게 글: 1kg 밑은 g, 그 위는 소수 한 자리 kg (「250g」「1.2kg」「12kg」) */
export const weightText = (kg: number): string => (kg < 1 ? `${Math.max(1, Math.round(kg * 1000))}g` : `${Number(kg.toFixed(kg < 10 ? 1 : 0))}kg`);

/** 판정 칸 (상점 줄·보조 모델·시작 소지품·직접 넣기가 같은 꼴로) */
export interface ItemTraits {
  /** 사용 가능 (소모성이면 늘 참) */
  use: boolean;
  /** 소모성: 처음 횟수 */
  uses?: number;
  equip?: ItemEquip;
  /** 그림 찾기용 낱말 (영어, 물건 만드는 모델이 적음) */
  icon?: string;
  /** 무게 kg */
  weight?: number;
}

/** 「쓰임」 칸 글 → 판정: 무기·장비·사용·소모N (「·」「,」「/」 띄어쓰기 어느 것으로 이어도). 모르는 말은 무시 */
export function parseTraits(text: unknown): Omit<ItemTraits, 'icon' | 'weight'> {
  const out: Omit<ItemTraits, 'icon' | 'weight'> = { use: false };
  for (const t0 of String(text ?? '').split(/[\s,，/·+]+/)) {
    const t = t0.trim().toLowerCase();
    if (!t) continue;
    if (/^(무기|weapon)$/.test(t)) out.equip = 'weapon';
    else if (/^(장비|gear|wear)$/.test(t)) out.equip = out.equip ?? 'gear';
    else if (/^(사용|use|usable)$/.test(t)) out.use = true;
    else {
      const m = /^(?:소모|consumable|uses?)[:：]?(\d+)?$/.exec(t);
      if (m) {
        out.use = true;
        out.uses = itemUses(m[1] ?? 1);
      }
    }
  }
  return out;
}

/** 판정 → 「쓰임」 칸 글 (parseTraits 와 거꾸로) */
export const traitsText = (t: Partial<ItemTraits>): string =>
  [t.equip ? EQUIP_LABEL[t.equip] : '', t.uses ? `소모${t.uses}` : t.use ? '사용' : ''].filter(Boolean).join('·') || '-';

export const cleanIcon = (v: unknown): string | undefined => String(v ?? '').toLowerCase().replace(/[^a-z0-9 \-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || undefined;
