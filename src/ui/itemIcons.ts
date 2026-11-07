// 소지품 종류 아이콘 14종 (2026-11-07 사용자 결정 「그려봐」): ui/icons.ts 와 같은 선 그림체 (24 격자, 선 1.8).
// 종류 값은 고정 목록. 장터·보조 모델·직접 넣기 모두 이 값 중 하나를 적고, 아이콘은 값을 1:1로 따라간다. 목록 밖 값은 misc.
export type ItemKind = 'weapon' | 'wear' | 'tool' | 'device' | 'charm' | 'medical' | 'food' | 'paper' | 'key' | 'seal' | 'anomaly' | 'valuable' | 'consumable' | 'misc';

export const ITEM_KINDS: { id: ItemKind; label: string; hint: string }[] = [
  { id: 'weapon', label: '무기', hint: '총·칼·둔기' },
  { id: 'wear', label: '방호구·옷', hint: '조끼·장갑·제복' },
  { id: 'tool', label: '도구', hint: '손전등·밧줄·공구' },
  { id: 'device', label: '전자기기', hint: '폰·녹음기·카메라·측정기' },
  { id: 'charm', label: '종교물·부적', hint: '십자가·염주·부적·성수' },
  { id: 'medical', label: '의료', hint: '약·붕대·주사' },
  { id: 'food', label: '음식·기호품', hint: '물·초콜릿·담배·술' },
  { id: 'paper', label: '기록물', hint: '서류·사진·수첩·USB' },
  { id: 'key', label: '열쇠·출입증', hint: '열쇠·카드키·신분증' },
  { id: 'seal', label: '봉인구·용기', hint: '수갑·봉인 상자·시료통' },
  { id: 'anomaly', label: '회수물·이상물', hint: '괴이에서 나온 것' },
  { id: 'valuable', label: '귀중품', hint: '현금 봉투·보석·시계' },
  { id: 'consumable', label: '소모품', hint: '건전지·탄약·소금·초' },
  { id: 'misc', label: '기타', hint: '어디에도 안 맞는 것' },
];

export const itemKind = (v: unknown): ItemKind => (ITEM_KINDS.some((k) => k.id === v) ? (v as ItemKind) : 'misc');

const stroke = (d: string) =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

export const ITEM_ICONS: Record<ItemKind, string> = {
  weapon: stroke('<path d="M21 3c-1 4-4 8-9 12l-3-3C13 7 17 4 21 3Z"/><path d="m9 12-5 5 3 3 5-5"/><path d="m4 17 3 3"/>'),
  wear: stroke('<path d="M8 3h2l2 2 2-2h2l3 4-2 2v12H7V9L5 7Z"/><path d="M12 5v16"/>'),
  tool: stroke('<path d="M3 7h9l4 3v4l-4 3H3Z"/><path d="M7 7v10M16 10v4"/><path d="M19.5 9.5 21 8M19.5 14.5 21 16M20 12h1.5"/>'),
  device: stroke('<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M10.5 6h3"/><path d="M11 18.5h2"/>'),
  charm: stroke('<path d="M7.5 2.5h9v17l-4.5 2-4.5-2Z"/><path d="M12 6v7"/><path d="M9.5 8.5h5"/><path d="M10 16h4"/>'),
  medical: stroke('<rect x="5" y="7" width="14" height="14" rx="2.5"/><path d="M9 4h6v3H9Z"/><path d="M12 11v6M9 14h6"/>'),
  food: stroke('<path d="M5 8h11v8a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16"/><path d="M8.5 3c0 1.2 1 1.6 1 2.8M12.5 3c0 1.2 1 1.6 1 2.8"/>'),
  paper: stroke('<path d="M7 3h7l5 5v13H7Z"/><path d="M14 3v5h5"/><path d="M10 12h7M10 16h7"/>'),
  key: stroke('<circle cx="8" cy="15.5" r="4.5"/><path d="M11.5 12 20 3.5"/><path d="m16.5 7 2.5 2.5M14 9.5l2.5 2.5"/>'),
  seal: stroke('<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><path d="M12 14v3"/>'),
  anomaly: stroke('<path d="M2.5 12c2.5-4.5 6-7 9.5-7s7 2.5 9.5 7c-2.5 4.5-6 7-9.5 7s-7-2.5-9.5-7Z"/><circle cx="12" cy="12" r="3"/><path d="M12 2.5v1.5M12 20v1.5"/>'),
  valuable: stroke('<path d="M7 3h10l4 6-9 12L3 9Z"/><path d="M3 9h18M9.5 9 12 21M14.5 9 12 21M7 3l2.5 6M17 3l-2.5 6"/>'),
  consumable: stroke('<rect x="3" y="8" width="16" height="8" rx="2"/><path d="M19 10.5h2v3h-2"/><path d="M7 11v2M10.5 11v2"/>'),
  misc: stroke('<path d="M3 8 12 3l9 5-9 5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>'),
};
