// 소지품 판정 칸 (장착 갈래·상태·소모 횟수·쓰임 글). 다른 데에 기대지 않는 순수 함수만 — 명부(world/directory)·시작 소지품이 소지품 전체를 끌어오지 않게 (core/items.ts 가 다시 내보냄)

/** 장착 갈래 (2026-11-07 사용자: 부위 나누지 않고 둘만). 칸: 손 2 · 장비 6 (2026-11-12 사용자: 장비 칸 둘 더).
 *  'weapon' = 손에 드는 것 전부(무기·도구·불빛·우산…), 'gear' = 몸에 입거나 차는 것. 저장된 채팅이 그대로 읽히게 안쪽 값은 'weapon' 그대로 (사용자 2026-11-14) */
export type ItemEquip = 'weapon' | 'gear';
export const EQUIP_SLOTS: Record<ItemEquip, number> = { weapon: 2, gear: 6 };
export const EQUIP_LABEL: Record<ItemEquip, string> = { weapon: '손', gear: '장비' };
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
/** 무게 글: 1kg 밑은 g, 그 위는 10g 단위까지 kg (「250g」「1.24kg」「12.4kg」). 2026-11-13 사용자: 어림수로만 보여 현실감이 없다 */
export const weightText = (kg: number): string => (kg < 1 ? `${Math.max(1, Math.round(kg * 1000))}g` : `${Number(kg.toFixed(2))}kg`);

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

/** 「쓰임」 칸 글 → 판정: 손·장비·사용·소모N (옛 글의 「무기」도 손으로 읽는다, 사용자 2026-11-14) (「·」「,」「/」 띄어쓰기 어느 것으로 이어도). 모르는 말은 무시 */
export function parseTraits(text: unknown): Omit<ItemTraits, 'icon' | 'weight'> {
  const out: Omit<ItemTraits, 'icon' | 'weight'> = { use: false };
  // 「소모 3」「소모3회」「소모(3)」「소모 x3」은 쪼개기 전에 「소모3」으로 붙인다: 띄우면 1회로, 글자가 붙으면 소모가 빠졌다 (전수검사 11-13)
  const src = String(text ?? '').replace(/(소모|consumable|uses?)\s*[:：]?\s*[(（x×]?\s*(\d+)\s*[)）]?\s*(?:회|번|개)?/gi, '$1$2 '); // 끝에 띄어쓰기: 숫자 뒤 띄어쓰기까지 먹어 「소모3 장비」가 한 덩어리로 붙어 버려졌다 (재검토 11-14)
  for (const t0 of src.split(/[\s,，/·+]+/)) {
    const t = t0.trim().toLowerCase();
    if (!t) continue;
    if (/^(손|hand|held|무기|weapon)$/.test(t)) out.equip = 'weapon';
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

/** 그림 칸 「종류/물건말/english」: 한글과 「/」를 지우지 않는다 (2026-11-10: 영어·숫자만 남겨 「옷/코트」가 통째로 사라져 그림이 전부 상자로 나왔다) */
export const cleanIcon = (v: unknown): string | undefined => String(v ?? '').toLowerCase().replace(/[／|｜]/g, '/').replace(/[^a-z0-9가-힣 /\-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40) || undefined;
