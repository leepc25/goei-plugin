// 퍽 출현 조건과 방 보상 추첨 (docs/설계_퍽_목록_3판.md 1장 8항·4장·쌍 퍽). 글은 defs.gen.ts, 효과는 runtime.ts.
// 엔진·그림을 모른다 (node 시험 가능): 인물 키트(Kit)와 지금 가진 퍽만 보고 고른다.
import { PERK_TEXT, TRAIT_TEXT, type PerkText, type TraitText } from './defs.gen';
import type { DebuffKind } from '../combat/status';

/** 상태 이상 + 표식·묶기 (조합 퍽의 재료) */
export type Ail = DebuffKind | 'mark' | 'bind';
export const AILS: Ail[] = ['bleed', 'taint', 'headache', 'confuse', 'fear', 'slow', 'silence', 'mark', 'bind'];

/** 인물 키트: 출현 조건에 쓰는 것만 */
export interface Kit {
  shot: boolean;
  thrown: boolean;
  hot: boolean;
  skill: boolean;
  charge: boolean;
  super: boolean;
  str: number;
  /** 이 인물 기술이 거는 상태 (출처별) */
  ails: Partial<Record<'skill' | 'charge' | 'super' | 'any', Ail[]>>;
}

/** 인물 설정(char.json cfg) → 키트 */
export function kitOf(cfg: Record<string, any>, has: (id: string) => boolean, str: number): Kit { // eslint-disable-line @typescript-eslint/no-explicit-any
  const bal = cfg.bal ?? {};
  const sk = cfg.skills ?? {};
  const ails = (o: unknown): Ail[] => {
    const out = new Set<Ail>();
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') {
        const d = (v as { debuff?: { k?: string } }).debuff;
        if (d?.k) out.add(d.k as Ail);
        Object.values(v).forEach(walk);
      }
    };
    walk(o);
    return [...out];
  };
  const skill = ails([sk.skill, sk.skill2]), charge = ails(sk.charge), sup = ails(sk.super);
  return {
    shot: has('15') && bal.gun !== 'none',
    thrown: bal.gun === 'thrown',
    hot: !!cfg.ranged?.heat || bal.gun === 'rapid',
    skill: !!sk.skill,
    charge: !!sk.charge,
    super: !!sk.super,
    str,
    ails: { skill, charge, super: sup, any: [...new Set([...skill, ...charge, ...sup])] },
  };
}

/** 퍽이 직접 거는 상태 (4장 표). 특성 「저주받은 손」은 표식·묶기 빼고 전부 */
const PERK_AILS: Record<string, Ail[]> = {
  '출혈 일격': ['bleed'], '가시 방패': ['bleed'], '두통 유발': ['headache'], '혼쭐': ['confuse'], '혼란 충전': ['confuse'],
  '위협': ['fear'], '겁주기': ['fear'], '발목 걸기': ['slow'], '꿰뚫는 회피': ['slow'], '둔화 고유기': ['slow'],
  '침묵의 필살': ['silence'], '오염 손톱': ['taint'], '표식탄': ['mark'], '급소 간파': ['mark'], '족쇄 차기': ['bind'],
  '저주받은 손': ['bleed', 'taint', 'headache', 'confuse', 'fear', 'slow', 'silence'],
};

/** 아이템 체계 보류(10-30 사용자): 아이템에 기대는 퍽·특성은 후보에 안 낸다 */
export const HELD = new Set(['약 잘 쓰는 손', '넉넉한 주머니', '아끼기', '한 모금', '퀵 드로우', '응급 자동 사용', '맨몸', '단식']);

/** 쌍 퍽: [반드시, 이 중 하나] */
export const PAIRS: Record<string, [string, string[]]> = {
  '연쇄 폭파': ['시체 폭발', ['회피 폭탄', '폭발탄', '과열 방출']],
  '피바다': ['피 터뜨리기', ['출혈 일격', '가시 방패', '깊은 상처']],
  '탄막 반사': ['겹탄', ['도탄', '탄 되받기']],
  '빈틈 없음': ['탄 되받기', ['무적 회피']],
  '그림자 분대': ['따라 치는 그림자', ['앙코르']],
  '유성 낙하': ['내려찍기', ['3단 점프']],
  '사냥꾼의 눈': ['그림자 습격', ['표식탄', '급소 간파']],
  '소용돌이': ['끌어당기는 충전', ['혼란 충전']],
  '역병': ['오염 전파', ['오염 연소']],
  '반응 장갑': ['방어막', ['깨지며 터진다']],
};

export interface Owned { ranks: Map<string, number>; traits: Set<string> }

/** 지금 걸 수 있는 상태 (기술 + 가진 퍽·특성) */
export function ailSources(kit: Kit, own: Owned): Set<Ail> {
  const s = new Set<Ail>(kit.ails.any ?? []);
  for (const n of [...own.ranks.keys(), ...own.traits]) for (const a of PERK_AILS[n] ?? []) s.add(a);
  return s;
}

/** 이 퍽이 이 인물·지금 퍽 묶음에 나올 수 있나 (랭크가 다 찬 것은 따로 거름) */
export function perkOk(name: string, kit: Kit, own: Owned): boolean {
  if (HELD.has(name)) return false;
  const pair = PAIRS[name];
  const hasP = (n: string) => own.ranks.has(n);
  if (pair) return hasP(pair[0]) && pair[1].some(hasP);
  const src = ailSources(kit, own);
  const ail = (a: Ail) => src.has(a);
  switch (name) {
    case '무거운 한 방': return kit.str >= 6;
    case '정조준': case '빠른 방아쇠': case '거리 감각': case '급소 겨냥': case '폭발탄': case '표식탄': case '겁주기': case '자세 무너뜨리기': case '틈새 사격': case '탄피 모으기': return kit.shot;
    case '겹탄': case '관통탄': case '도탄': return kit.shot && !kit.thrown;
    case '투척 강화': case '부메랑 투척': return kit.thrown;
    case '냉각 장치': case '과열 방출': return kit.hot;
    case '고유기 숙련': case '고유기 강화': case '고유기 2회': case '피의 저금통': case '책상 내려치기': case '진조의 피': return kit.skill;
    case '둔화 고유기': return kit.skill && !(kit.ails.skill ?? []).includes('slow');
    case '충전 단축': case '충전 강화': case '끌어당기는 충전': case '수술 여섯 시간째': return kit.charge;
    case '혼란 충전': return kit.charge && !(kit.ails.charge ?? []).includes('confuse');
    case '필살 충전': case '필살 강화': case '시작 게이지': case '고통 증폭': return kit.super;
    case '침묵의 필살': return kit.super && !(kit.ails.super ?? []).includes('silence');
    case '앙코르': return kit.super && kit.skill;
    case '깊은 상처': case '피 터뜨리기': return ail('bleed');
    case '지속 연장': case '약점 찌르기': return src.size > 0;
    case '상처 옮기기': return src.size >= 2;
    case '오염 전파': return ail('taint');
    case '오염 연소': return kit.super && ail('taint');
    case '표식 전염': return ail('mark');
    case '겁먹은 등': return ail('fear');
    case '묶인 과녁': return kit.shot && ail('bind');
    case '두통 울림': return ail('headache');
    case '제 편 때리기': return ail('confuse');
    case '얼어붙은 발': return ail('slow');
    case '입막음 처형': return ail('silence');
    case '보이지 않는 사슬': return ail('bind');
  }
  return true;
}

export function traitOk(t: TraitText, kit: Kit): boolean {
  if (HELD.has(t.name)) return false;
  if (t.cond.includes('사격')) return kit.shot;
  if (t.cond.includes('필살·고유기')) return kit.super && kit.skill;
  if (t.cond.includes('고유기')) return kit.skill;
  return true;
}

export type Offer = { type: 'perk'; def: PerkText; rank: number } | { type: 'trait'; def: TraitText };

/** 방 보상 후보: 3개(특성 「탐욕」 4개). 쌍 퍽은 조건이 맞으면 최대 1개, 특성은 최대 1개(25%).
 * 같은 것은 두 번 안 나온다. 랭크가 다 찬 퍽은 안 나온다(응급 치료는 몇 번이고). 특성 「외길」: 가진 퍽 가중 2배, 랭크 1짜리 절반 */
export function draft(kit: Kit, own: Owned, rand: () => number = Math.random): Offer[] {
  const n = own.traits.has('탐욕') ? 4 : 3;
  const oneWay = own.traits.has('외길');
  const pool = PERK_TEXT.filter((p) => (own.ranks.get(p.name) ?? 0) < p.rank && perkOk(p.name, kit, own));
  const w = (p: PerkText) => (p.name === '다운 무시' ? 0.3 : 1) * (oneWay && own.ranks.has(p.name) ? 2 : 1) * (oneWay && p.rank === 1 ? 0.5 : 1);
  const pick = <T>(list: T[], wt: (x: T) => number): T | null => {
    const total = list.reduce((s, x) => s + wt(x), 0);
    let r = rand() * total;
    for (const x of list) if ((r -= wt(x)) <= 0) return x;
    return list[list.length - 1] ?? null;
  };
  const out: Offer[] = [];
  const used = new Set<string>();
  const pairs = pool.filter((p) => p.kind === '쌍');
  if (pairs.length && rand() < 0.5) { const p = pick(pairs, w)!; out.push({ type: 'perk', def: p, rank: (own.ranks.get(p.name) ?? 0) + 1 }); used.add(p.name); }
  const traits = TRAIT_TEXT.filter((t) => !own.traits.has(t.name) && traitOk(t, kit));
  if (traits.length && rand() < 0.25) { const t = traits[Math.floor(rand() * traits.length)]; out.push({ type: 'trait', def: t }); used.add(t.name); }
  const rest = pool.filter((p) => p.kind !== '쌍');
  while (out.length < n) {
    const left = rest.filter((p) => !used.has(p.name));
    if (!left.length) break;
    const p = pick(left, w)!;
    used.add(p.name);
    out.push({ type: 'perk', def: p, rank: (own.ranks.get(p.name) ?? 0) + 1 });
  }
  // 섞기 (쌍·특성이 늘 앞에 오지 않게)
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
