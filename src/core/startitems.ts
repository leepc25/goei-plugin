// 고유 인물 시작 소지품 (2026-11-07 사용자: 모델 호출 없이 미리 정해 둠).
// 목록은 코드에 두지 않고 명부(Directory 로어북) 요원 줄의 `start_items` 칸에 둔다. 명부 편집 화면에서 보고 고친다.
// 그 인물로 시작하면 소지품($st_items)에 넣고, 무기·장비는 빈 장착 칸에 차례로 끼운다 (무기 2 · 장비 4, 넘치면 소지품).
import { addItem, itemEquip, ITEMS_VAR, itemsVars, itemUses, parseTraits, traitsText, type ItemEquip, type Items } from './items';

/** 명부에 저장하는 한 줄 */
export interface StartItem {
  name: string;
  use?: boolean;
  /** 소모성 처음 횟수 */
  uses?: number;
  equip?: ItemEquip;
  /** false = 장착 갈래지만 소지품에서 시작 (칸이 비어 있어도) */
  wear?: false;
  desc?: string;
  effect?: string;
  /** 그림 찾기용 영어 낱말 */
  icon?: string;
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** 명부 글 → 줄 (이름 없는 줄은 뺀다) */
export function readStartItems(v: unknown): StartItem[] {
  if (!Array.isArray(v)) return [];
  const out: StartItem[] = [];
  for (const x of v) {
    if (!x || typeof x !== 'object') continue;
    const o = x as Record<string, unknown>;
    const name = s(o.name);
    if (!name) continue;
    const uses = itemUses(o.uses);
    const equip = itemEquip(o.equip);
    out.push({
      name,
      ...(o.use === true || uses ? { use: true } : {}),
      ...(uses ? { uses } : {}),
      ...(equip ? { equip } : {}),
      ...(equip && o.wear === false ? { wear: false as const } : {}),
      ...(s(o.desc) ? { desc: s(o.desc) } : {}),
      ...(s(o.effect) ? { effect: s(o.effect) } : {}),
      ...(s(o.icon) ? { icon: s(o.icon) } : {}),
    });
  }
  return out;
}

/** 편집 칸 한 줄의 차례: 이름 | 쓰임 | 시작 자리 | 설명 | 효과 | 그림 낱말 (초안 표와 같은 칸) */
export const START_ITEM_COLUMNS = '이름 | 쓰임 | 시작 자리 | 설명 | 효과 | 그림 낱말';

const place = (e: StartItem) => (!e.equip || e.wear === false ? '소지품' : e.equip === 'weapon' ? '무기 칸' : '장비 칸');

/** 줄 → 편집 칸 글 */
export const startItemsText = (list: StartItem[]): string =>
  list.map((e) => [e.name, traitsText(e), place(e), e.desc || '-', e.effect || '-', e.icon || '-'].join(' | ')).join('\n');

/** 편집 칸 글 → 줄. 「-」는 빈 칸. 쓰임은 「무기·사용」「장비」「사용」「소모 3」 (띄어 써도). 시작 자리에 「소지품」이면 장착 갈래라도 소지품에서 시작 */
export function parseStartItems(text: string): StartItem[] {
  const out: StartItem[] = [];
  for (const line of text.split('\n')) {
    const c = line.split('|').map((x) => x.trim()).map((x) => (x === '-' ? '' : x));
    const name = c[0] ?? '';
    if (!name) continue;
    // 「소모 3」처럼 숫자를 띄어 써도 붙여 읽는다
    const t = parseTraits((c[1] ?? '').replace(/(소모|consumable|uses?)\s+(\d)/gi, '$1$2'));
    out.push({
      name,
      ...(t.use ? { use: true } : {}),
      ...(t.uses ? { uses: t.uses } : {}),
      ...(t.equip ? { equip: t.equip } : {}),
      ...(t.equip && (c[2] ?? '').includes('소지품') ? { wear: false as const } : {}),
      ...(c[3] ? { desc: c[3] } : {}),
      ...(c[4] ? { effect: c[4] } : {}),
      ...(c[5] ? { icon: c[5] } : {}),
    });
  }
  return out;
}

/** 시작 소지품 → 새 채팅의 소지품. 직접 넣은 물건처럼 기준 메시지 없이(늘 산다) */
export function startItemsState(list: StartItem[], at = new Date().toISOString()): Items {
  let it: Items = { list: [], log: [] };
  const alive = new Set<string>();
  for (const e of list) {
    it = addItem(it, alive, {
      name: e.name, desc: e.desc, effect: e.effect, use: !!e.use, uses: e.uses, equip: e.equip, icon: e.icon,
      wear: e.wear !== false, from: 'manual', anchor: '', at,
    });
  }
  return it;
}

/** 시작 변수: 줄이 없으면 빈 소지품 */
export const startItemsVars = (list: StartItem[]): Record<string, string> => (list.length ? itemsVars(startItemsState(list)) : { [ITEMS_VAR]: '' });
