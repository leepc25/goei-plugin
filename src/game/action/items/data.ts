/**
 * 아이템·무기·환경 물건·중림 상인 데이터. 수치는 시험판에서 조정한다(기본 기획서 11~14장, 부록 F).
 * 그림이 늘어나지 않게: 요원 고유 무기는 고정, 임시 무기는 두 묶음(한 손 근접 / 총)만 둔다.
 */

// ---------- 소모품 (1~4칸) ----------
export type ItemKind = 'heal' | 'cure' | 'throw' | 'special';
export type ItemEffect =
  | { type: 'heal'; ratio: number }
  | { type: 'cure'; status: 'bleed' | 'taint' | 'headache' | 'mind' | 'any'; heal?: number }
  | { type: 'flash'; radius: number; stun: number }
  | { type: 'smoke'; radius: number; slow: number; time: number }
  | { type: 'salt'; radius: number; time: number }
  | { type: 'ward'; hits: number }
  | { type: 'gauge'; amount: number }
  | { type: 'energy'; amount: number };
export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  /** 칸 하나에 겹치는 최대 수 */
  max: number;
  /** 중림·정비실 기준가(현금). 정비실은 같은 값을 예산으로 받는다. */
  price: number;
  desc: string;
  effect: ItemEffect;
  /** 들고 있으면 디버프가 없어도 써지는지. false면 효과 없을 때 소비하지 않는다. */
  always?: boolean;
}
export const ITEMS: Record<string, ItemDef> = {
  medkit: { id: 'medkit', name: '회복약', kind: 'heal', max: 3, price: 30, desc: '체력 35% 회복', effect: { type: 'heal', ratio: 0.35 } },
  bandage: { id: 'bandage', name: '압박 붕대', kind: 'cure', max: 3, price: 18, desc: '출혈을 멈추고 체력 10% 회복', effect: { type: 'cure', status: 'bleed', heal: 0.1 } },
  antidote: { id: 'antidote', name: '정화제', kind: 'cure', max: 2, price: 40, desc: '오염 한 단계 제거', effect: { type: 'cure', status: 'taint' } },
  // 상태 효과 해제 (docs/게임_성장_경제_설계.md 5-2, 2026-10-27)
  painkiller: { id: 'painkiller', name: '진통제', kind: 'cure', max: 3, price: 20, desc: '두통을 멎게 한다', effect: { type: 'cure', status: 'headache' } },
  sedative: { id: 'sedative', name: '진정제', kind: 'cure', max: 2, price: 30, desc: '공포·혼란을 가라앉힌다', effect: { type: 'cure', status: 'mind' } },
  salt: { id: 'salt', name: '소금', kind: 'special', max: 3, price: 25, desc: '발밑에 소금 원. 괴이가 6초 동안 들어오지 못한다', effect: { type: 'salt', radius: 120, time: 6 }, always: true },
  flash: { id: 'flash', name: '섬광탄', kind: 'throw', max: 3, price: 35, desc: '주변 적 2초 기절', effect: { type: 'flash', radius: 260, stun: 2 }, always: true },
  smoke: { id: 'smoke', name: '연막탄', kind: 'throw', max: 2, price: 28, desc: '연기 속 적 40% 둔화, 5초', effect: { type: 'smoke', radius: 200, slow: 0.4, time: 5 }, always: true },
  charm: { id: 'charm', name: '관리국 부적', kind: 'special', max: 1, price: 60, desc: '다음 피격 1회 무효', effect: { type: 'ward', hits: 1 }, always: true },
  energy: { id: 'energy', name: '에너지 음료', kind: 'special', max: 2, price: 22, desc: '능력 자원 40 회복', effect: { type: 'energy', amount: 40 } },
  adrenaline: { id: 'adrenaline', name: '각성제', kind: 'special', max: 1, price: 70, desc: '필살 게이지 50% 충전', effect: { type: 'gauge', amount: 0.5 } },
};
/** 본부 정비실 보급 목록. 본부 화면이 그리기만 한다. */
export const SUPPLY_CATALOG = ['medkit', 'bandage', 'antidote', 'painkiller', 'sedative', 'salt', 'flash', 'smoke', 'charm', 'energy'].map(id => {
  const d = ITEMS[id];
  return { id: d.id, name: d.name, price: d.price, kind: d.kind, max: d.max, desc: d.desc };
});

// ---------- 고유 무기 (요원 고정, 교체 없음) ----------
export type AmmoType = 'pistol' | 'rifle' | 'none';
export interface SignatureDef {
  agent: string;
  name: string;
  /** 원거리 수단 이름 */
  ranged: string;
  ammo: AmmoType;
  mag: number;
  /** 시작 예비 탄 수(탄창 수 × 장전 수) */
  reserve: number;
  reserveMax: number;
  reload: number;
  /** 원거리 탄이 없는 요원: 어떤 자원을 쓰는지(설명용) */
  resource?: string;
}
export const SIGNATURES: Record<string, SignatureDef> = {
  jyaldi: { agent: 'jyaldi', name: '폭파 + 권총', ranged: '권총', ammo: 'pistol', mag: 8, reserve: 16, reserveMax: 32, reload: 0.9 },
  aileen: { agent: 'aileen', name: '카빈 소총', ranged: '3점사', ammo: 'rifle', mag: 24, reserve: 72, reserveMax: 120, reload: 1.2 },
  deadpole: { agent: 'deadpole', name: '권총', ranged: '빠른 연사', ammo: 'pistol', mag: 15, reserve: 45, reserveMax: 75, reload: 0.8 },
  spangdal: { agent: 'spangdal', name: '가시', ranged: '가시 투사', ammo: 'none', mag: 0, reserve: 0, reserveMax: 0, reload: 0, resource: '없음' },
  geshugan: { agent: 'geshugan', name: '염동 큐브', ranged: '힘 떨어뜨리기', ammo: 'none', mag: 0, reserve: 0, reserveMax: 0, reload: 0, resource: '없음' },
  gorgodio: { agent: 'gorgodio', name: '식칼 + 아머', ranged: '식칼 던지기', ammo: 'none', mag: 0, reserve: 0, reserveMax: 0, reload: 0, resource: '던진 식칼은 E로 회수' },
  kyuras: { agent: 'kyuras', name: '발화', ranged: '핑거 스냅', ammo: 'none', mag: 0, reserve: 0, reserveMax: 0, reload: 0, resource: '과열' },
  rojemon: { agent: 'rojemon', name: '실·인형', ranged: '최면', ammo: 'none', mag: 0, reserve: 0, reserveMax: 0, reload: 0, resource: '인형 2체' },
};
export const AMMO_PICKUP: Record<Exclude<AmmoType, 'none'>, { name: string; amount: number }> = {
  pistol: { name: '권총탄', amount: 8 },
  rifle: { name: '소총 탄창', amount: 24 },
};

// ---------- 임시 무기: 두 묶음만 ----------
/** melee = 한 손 근접 묶음(요원별 휘두르기 클립 1개), gun = 총 묶음(요원별 사격 클립 1개) */
export type WeaponClass = 'melee' | 'gun';
export type Status = 'bleed' | 'slow' | 'stun' | 'burn';
export interface WeaponDef {
  id: string;
  name: string;
  cls: WeaponClass;
  /** 근접: 휘두를 수 있는 횟수. 총: 탄 수(보충 없음) */
  uses: number;
  damage: number;
  knockback: number;
  /** 근접 판정 길이 / 총 사거리 */
  reach: number;
  /** 총: 한 번에 나가는 탄, 퍼짐 */
  pellets?: number;
  spread?: number;
  /** 총: 누르고 있으면 계속 쏘는 간격(초) */
  rate?: number;
  status?: Status;
  /** 슈퍼아머 중인 적도 경직시키는지 */
  armorBreak?: boolean;
  /** 사람형 적에게 피해 배율 */
  vsHuman?: number;
  desc: string;
}
export const WEAPONS: Record<string, WeaponDef> = {
  pipe: { id: 'pipe', name: '쇠파이프', cls: 'melee', uses: 8, damage: 22, knockback: 140, reach: 120, desc: '넉백이 크다' },
  chairleg: { id: 'chairleg', name: '의자 다리', cls: 'melee', uses: 6, damage: 16, knockback: 110, reach: 100, desc: '가볍고 빠르다' },
  kitchenknife: { id: 'kitchenknife', name: '식칼', cls: 'melee', uses: 10, damage: 14, knockback: 40, reach: 90, status: 'bleed', desc: '맞은 적이 출혈' },
  katana: { id: 'katana', name: '검은 일본도', cls: 'melee', uses: 15, damage: 34, knockback: 80, reach: 150, armorBreak: true, desc: '큰 피해, 슈퍼아머도 뚫는다' },
  smg: { id: 'smg', name: '기관단총', cls: 'gun', uses: 30, damage: 7, knockback: 20, reach: 700, rate: 0.08, vsHuman: 1.5, desc: '누르고 있으면 연사. 사람형 적에 강함' },
  servicepistol: { id: 'servicepistol', name: '경비 권총', cls: 'gun', uses: 12, damage: 13, knockback: 30, reach: 620, desc: '한 발씩 정확하게' },
  shotgun: { id: 'shotgun', name: '산탄총', cls: 'gun', uses: 6, damage: 9, knockback: 160, reach: 340, pellets: 5, spread: 40, desc: '가까울수록 아프다, 넉백 큼' },
};

// ---------- 환경 물건 ----------
export interface PropDef {
  id: string;
  name: string;
  /** throw: E로 들어 A로 던진다. break: 때려서 부순다. both: 둘 다 */
  use: 'throw' | 'break' | 'both';
  hp: number;
  /** 던졌을 때 */
  damage: number;
  knockdown: boolean;
  /** 맞거나 부서질 때 퍼지는 효과 */
  burst?: { type: 'smoke' | 'blast' | 'shock'; radius: number; damage?: number; slow?: number; time?: number };
  /** 부서지면 굴리는 상자 드랍 표 */
  loot?: string;
  w: number;
  h: number;
  /** 숨은 방 입구 등 층 생성 쪽이 쓰는 표시 */
  tag?: 'hiddenRoom';
}
/** w·h = 화면 px 실제 크기(쟈알디 키 약 260px 기준: 의자 허리 130, 사물함 230). 그림도 이 높이로 그린다. */
export const PROPS: Record<string, PropDef> = {
  chair: { id: 'chair', name: '의자', use: 'both', hp: 20, damage: 26, knockdown: true, w: 93, h: 130, loot: 'junk' },
  pot: { id: 'pot', name: '화분', use: 'throw', hp: 8, damage: 18, knockdown: false, w: 75, h: 80 },
  extinguisher: { id: 'extinguisher', name: '소화기', use: 'throw', hp: 10, damage: 20, knockdown: false, w: 44, h: 80, burst: { type: 'smoke', radius: 180, slow: 0.4, time: 4 } },
  tv: { id: 'tv', name: '텔레비전', use: 'throw', hp: 12, damage: 34, knockdown: true, w: 76, h: 76, burst: { type: 'shock', radius: 120, damage: 10 } },
  table: { id: 'table', name: '밥상', use: 'throw', hp: 16, damage: 30, knockdown: true, w: 146, h: 80 },
  bin: { id: 'bin', name: '쓰레기통', use: 'both', hp: 14, damage: 16, knockdown: false, w: 84, h: 95, loot: 'junk' },
  crate: { id: 'crate', name: '나무 상자', use: 'break', hp: 24, damage: 0, knockdown: false, w: 102, h: 100, loot: 'crate' },
  drawer: { id: 'drawer', name: '서랍장', use: 'break', hp: 36, damage: 0, knockdown: false, w: 125, h: 110, loot: 'drawer' },
  mailbox: { id: 'mailbox', name: '우편함', use: 'break', hp: 16, damage: 0, knockdown: false, w: 242, h: 80, loot: 'mailbox' },
  barrel: { id: 'barrel', name: '드럼통', use: 'break', hp: 18, damage: 0, knockdown: true, w: 91, h: 130, burst: { type: 'blast', radius: 170, damage: 40 } },
  locker: { id: 'locker', name: '관리국 보급함', use: 'break', hp: 30, damage: 0, knockdown: false, w: 149, h: 230, loot: 'locker' },
  crackedwall: { id: 'crackedwall', name: '금 간 벽', use: 'break', hp: 60, damage: 0, knockdown: false, w: 252, h: 200, tag: 'hiddenRoom', loot: 'hidden' },
};

// ---------- 줍는 것 (바닥 드랍) ----------
export type PickupKind = 'cash' | 'shard' | 'heal' | 'ammo' | 'item' | 'relic' | 'weapon';
export interface RelicDef {
  id: string;
  name: string;
  /** 중림 매입가 */
  value: number;
  /** 본부 감정 시 연구 자료 */
  research: number;
  rare?: boolean;
}
/** 회수물: 가방 6칸을 차지한다(14장). */
export const RELICS: Record<string, RelicDef> = {
  scrap: { id: 'scrap', name: '장비 조각', value: 20, research: 2 },
  oddcoin: { id: 'oddcoin', name: '뒤집힌 동전', value: 35, research: 4 },
  rustkey: { id: 'rustkey', name: '녹슨 승강기 열쇠', value: 45, research: 6 },
  photo: { id: 'photo', name: '얼굴 없는 사진', value: 40, research: 8 },
  checklist: { id: 'checklist', name: '서명란이 빈 점검표', value: 40, research: 8 },
  tooth: { id: 'tooth', name: '누군가의 이빨', value: 25, research: 5 },
  dreamcatcher: { id: 'dreamcatcher', name: '꿈결 수집기', value: 120, research: 30, rare: true },
  blackbox: { id: 'blackbox', name: '승강기 블랙박스', value: 150, research: 40, rare: true },
};
/** 줍는 반경. 현금·파편·회복 조각·탄약은 작게 자동 흡수, 나머지는 E. */
export const PICKUP = { magnet: 46, touch: 30, interact: 80 } as const;

// ---------- 드랍 표 ----------
export interface DropEntry {
  /** 나올 확률(0~1). 1이면 확정 */
  p: number;
  kind: PickupKind;
  /** 현금 범위, 파편 수, 아이템·회수물·무기 후보 */
  min?: number;
  max?: number;
  pool?: string[];
}
export const DROP_TABLES: Record<string, DropEntry[]> = {
  // 적 (기본 기획서 11.2)
  anomaly: [
    { p: 0.7, kind: 'cash', min: 2, max: 6 },
    { p: 0.15, kind: 'heal' },
    { p: 1, kind: 'shard', min: 1, max: 2 },
    { p: 0.12, kind: 'ammo' },
    { p: 0.02, kind: 'relic', pool: ['scrap', 'oddcoin', 'tooth', 'photo'] },
  ],
  fakeAgent: [
    { p: 0.9, kind: 'cash', min: 6, max: 14 },
    { p: 0.1, kind: 'heal' },
    { p: 1, kind: 'shard', min: 1, max: 1 },
    { p: 0.3, kind: 'ammo' },
    { p: 0.05, kind: 'relic', pool: ['scrap'] },
    { p: 0.06, kind: 'item', pool: ['flash', 'bandage'] },
  ],
  gunner: [
    { p: 0.9, kind: 'cash', min: 6, max: 14 },
    { p: 1, kind: 'shard', min: 1, max: 1 },
    { p: 0.45, kind: 'ammo' },
    { p: 0.3, kind: 'weapon', pool: ['smg'] },
    { p: 0.08, kind: 'weapon', pool: ['servicepistol', 'shotgun'] },
  ],
  swordsman: [
    { p: 0.9, kind: 'cash', min: 8, max: 16 },
    { p: 1, kind: 'shard', min: 1, max: 2 },
    { p: 0.5, kind: 'weapon', pool: ['katana'] },
  ],
  daydream: [
    { p: 1, kind: 'cash', min: 14, max: 26 },
    { p: 0.1, kind: 'heal' },
    { p: 1, kind: 'shard', min: 1, max: 1 },
    { p: 0.03, kind: 'relic', pool: ['dreamcatcher'] },
  ],
  midboss: [
    { p: 1, kind: 'cash', min: 30, max: 50 },
    { p: 1, kind: 'heal' },
    { p: 1, kind: 'shard', min: 5, max: 5 },
    { p: 1, kind: 'ammo' },
    { p: 1, kind: 'relic', pool: ['rustkey', 'photo', 'oddcoin'] },
  ],
  boss: [
    { p: 1, kind: 'cash', min: 80, max: 120 },
    { p: 1, kind: 'heal' },
    { p: 1, kind: 'shard', min: 10, max: 10 },
    { p: 1, kind: 'ammo' },
    { p: 1, kind: 'relic', pool: ['blackbox'] },
  ],
  // 부서지는 물건
  junk: [{ p: 0.35, kind: 'cash', min: 1, max: 3 }],
  crate: [
    { p: 0.6, kind: 'cash', min: 2, max: 8 },
    { p: 0.25, kind: 'item', pool: ['medkit', 'bandage', 'salt', 'flash'] },
    { p: 0.25, kind: 'ammo' },
    { p: 0.15, kind: 'weapon', pool: ['pipe', 'chairleg', 'kitchenknife'] },
  ],
  drawer: [
    { p: 0.8, kind: 'cash', min: 4, max: 12 },
    { p: 0.3, kind: 'item', pool: ['bandage', 'antidote', 'painkiller', 'sedative', 'energy'] },
    { p: 0.1, kind: 'relic', pool: ['photo', 'tooth', 'oddcoin'] },
    { p: 0.12, kind: 'weapon', pool: ['kitchenknife'] },
  ],
  mailbox: [
    { p: 0.7, kind: 'cash', min: 3, max: 10 },
    { p: 0.15, kind: 'relic', pool: ['photo', 'rustkey'] },
  ],
  locker: [
    { p: 1, kind: 'ammo' },
    { p: 0.7, kind: 'item', pool: ['medkit', 'flash', 'smoke', 'charm'] },
    { p: 0.25, kind: 'weapon', pool: ['servicepistol', 'shotgun', 'pipe'] },
  ],
  hidden: [
    { p: 1, kind: 'cash', min: 20, max: 40 },
    { p: 1, kind: 'item', pool: ['medkit', 'charm', 'adrenaline'] },
    { p: 0.6, kind: 'relic', pool: ['rustkey', 'oddcoin', 'photo'] },
  ],
};

// ---------- 중림 상인 ----------
export type VendorId = 'madeokhee' | 'backalley' | 'shinyuri' | 'vending';
export interface VendorDef {
  id: VendorId;
  name: string;
  title: string;
  /** 출동 중 휴식방에 나올 확률 */
  appear: number;
  greet: string[];
  bye: string;
}
export const VENDORS: Record<VendorId, VendorDef> = {
  madeokhee: {
    id: 'madeokhee',
    name: '마덕희',
    title: '중림 상인',
    appear: 0.35,
    greet: ['현금만 받아요. 관리국 결재는 여기서 안 통하고.', '주운 거 있으면 보여 줘요. 값은 내가 매겨.'],
    bye: '또 살아서 오면 단골 해 줄게.',
  },
  backalley: {
    id: 'backalley',
    name: '고연지·윤지아',
    title: '중림 뒷골목 의사',
    appear: 0.12,
    greet: ['어디 찢어졌어? 보여 줘 봐.', '선불이야. 마취는 별도고.'],
    bye: '다음엔 덜 다쳐서 와.',
  },
  shinyuri: {
    id: 'shinyuri',
    name: '신유리',
    title: '중림 사채',
    appear: 0.1,
    greet: ['급하지? 돈은 있어. 이자도 있고.', '관리국 예산으로 갚으면 돼. 못 갚으면 물건으로 받고.'],
    bye: '날짜 잊지 마.',
  },
  vending: {
    id: 'vending',
    name: '무엇이든 자판기',
    title: '특수 장소',
    appear: 0.08,
    greet: ['[동전을 넣으십시오. 또는 다른 것을.]'],
    bye: '[이용해 주셔서 감사합니다.]',
  },
};
/** 의사 시술 */
export const CLINIC = [
  { id: 'patch', name: '응급 봉합', price: 40, desc: '체력 50% 회복, 출혈 제거', heal: 0.5, cure: ['bleed'] as string[] },
  { id: 'full', name: '전신 처치', price: 110, desc: '체력 전부 회복, 부상 제거', heal: 1, cure: ['bleed', 'injury'] },
  { id: 'purge', name: '오염 세척', price: 90, desc: '오염 전부 제거', heal: 0, cure: ['taint'] },
];
/** 사채: 받는 현금 → 귀환 후 갚을 예산 */
export const LOANS = [
  { cash: 60, debt: 90 },
  { cash: 120, debt: 190 },
  { cash: 200, debt: 330 },
];
/** 깊이(층)마다 값이 오른다 */
export const priceAt = (base: number, depth: number) => Math.round(base * (1 + Math.min(depth, 20) * 0.04));
