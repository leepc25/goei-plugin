// NPC 전용 퍽 (docs/퍽/NPC_퍽_안.md, 10-31 사용자 확정): 수치는 힘민체지정, 보정은 퍽으로만.
// 경찰은 필드의 경찰관 역할 그대로라 표의 퍽을 전부 붙인다. 나머지(시민·불량배·경비·전투 NPC)는 몹이라 생겨날 때 역할·성격으로 무작위.
// 퍽은 동작을 직접 고르지 않고 AI가 고르는 경향만 바꾼다. 「기존」 = 주인공 퍽(perks/runtime.ts)을 NPC 몸에 그대로 붙임.
import type { Temperament, MobRole } from './mobs';
import type { Rng } from './rng';

export type NpcCat = 'civilian' | 'thug' | 'police' | 'guard' | 'fighter';
export interface NpcPerkDef {
  name: string;
  /** 어디서 듣나: 필드 시뮬·전투 몸·둘 다 */
  where: 'field' | 'fight' | 'both';
  /** 주인공 퍽 이름 (같은 효과를 전투 몸 PerkRun 에 붙인다) */
  reuse?: string;
}
export const NPC_PERKS: Record<NpcCat, NpcPerkDef[]> = {
  civilian: [
    { name: '겁쟁이', where: 'both' }, { name: '깡다구', where: 'both' }, { name: '날쌘 도망', where: 'field' }, { name: '신고 정신', where: 'field' },
    { name: '구경꾼', where: 'field' }, { name: '두꺼운 가죽', where: 'fight', reuse: '두꺼운 가죽' }, { name: '주머니 두둑', where: 'field' },
  ],
  thug: [
    { name: '싸움꾼', where: 'both' }, { name: '패거리', where: 'field' }, { name: '뒤끝', where: 'field' }, { name: '손버릇', where: 'field' },
    { name: '단련된 주먹', where: 'fight', reuse: '단련된 주먹' }, { name: '버티기', where: 'fight', reuse: '버티기' }, { name: '술기운', where: 'fight' },
  ],
  police: [
    { name: '방어막', where: 'fight' }, { name: '지원 요청', where: 'both' }, { name: '정조준', where: 'fight', reuse: '정조준' },
    { name: '체포술', where: 'fight', reuse: '족쇄 차기' }, { name: '정신 방벽', where: 'fight', reuse: '정신 방벽' }, { name: '끈질긴 추적', where: 'field' },
  ],
  guard: [
    { name: '방어막', where: 'fight' }, { name: '가드 강화', where: 'fight', reuse: '가드 강화' }, { name: '완전 방어', where: 'fight', reuse: '완전 방어' },
    { name: '자리 지킴', where: 'fight' }, { name: '호출', where: 'field' },
  ],
  fighter: [
    { name: '강적', where: 'fight' }, { name: '방어막', where: 'fight' }, { name: '버티기', where: 'fight', reuse: '버티기' }, { name: '위기 회복', where: 'fight', reuse: '위기 회복' },
    { name: '다운 무시', where: 'fight', reuse: '다운 무시' }, { name: '낙법', where: 'fight', reuse: '낙법' }, { name: '고유기 숙련', where: 'fight', reuse: '고유기 숙련' },
    { name: '정신 방벽', where: 'fight', reuse: '정신 방벽' }, { name: '협공', where: 'fight' },
  ],
};
export const npcPerkDef = (name: string): NpcPerkDef | undefined => Object.values(NPC_PERKS).flat().find((p) => p.name === name);

/** 원형 역할 → 분류. 세력 전투원은 'fighter' (괴이·시험장 적, 필드 배치는 C15) */
export function catOf(role: MobRole | undefined): NpcCat {
  return role === 'police' ? 'police' : role === 'guard' ? 'guard' : role === 'thug' ? 'thug' : 'civilian';
}

/** 생겨날 때 한 번. 경찰 = 전부, 시민 = 50%로 1개, 불량배·경비 = 1~2개(경비 방어막 50%), 전투 NPC = 2~3개(강적 10%). 성격으로 기울인다 */
export function rollNpcPerks(rng: Rng, cat: NpcCat, t?: Temperament): string[] {
  const all = NPC_PERKS[cat].map((p) => p.name);
  if (cat === 'police') return all;
  const c = t?.courage ?? 0.5, cur = t?.curious ?? 0.5, sly = t?.sly ?? 0;
  const w = (n: string): number => {
    switch (n) {
      case '겁쟁이': return c < 0.4 ? 3 : c < 0.6 ? 1 : 0.2;
      case '깡다구': return c > 0.6 ? 3 : c > 0.4 ? 1 : 0.2;
      case '날쌘 도망': return c < 0.5 ? 2 : 0.6;
      case '신고 정신': return c > 0.5 ? 2 : 0.6;
      case '구경꾼': return cur > 0.6 ? 3 : 0.6;
      case '싸움꾼': case '뒤끝': return c > 0.7 ? 3 : 1;
      case '손버릇': return sly > 0.3 ? 3 : 0.5;
      case '강적': return 0;   // 따로 10%
      case '방어막': return cat === 'guard' ? 0 : 1;   // 경비는 따로 50%
      default: return 1;
    }
  };
  const n = cat === 'civilian' ? (rng() < 0.5 ? 1 : 0) : cat === 'fighter' ? 2 + (rng() < 0.5 ? 1 : 0) : 1 + (rng() < 0.5 ? 1 : 0);
  const out: string[] = [];
  if (cat === 'guard' && rng() < 0.5) out.push('방어막');
  if (cat === 'fighter' && rng() < 0.1) out.push('강적');
  while (out.length < n) {
    const left = all.filter((p) => !out.includes(p) && !(p === '겁쟁이' && out.includes('깡다구')) && !(p === '깡다구' && out.includes('겁쟁이')) && w(p) > 0);
    if (!left.length) break;
    let r = rng() * left.reduce((s, p) => s + w(p), 0);
    out.push(left.find((p) => (r -= w(p)) <= 0) ?? left[left.length - 1]);
  }
  return out;
}

/** 성격에 바로 얹는 퍽 (필드 시뮬·전투 두뇌가 같이 본다) */
export function applyTemper(perks: readonly string[], t: Temperament): void {
  const cl = (v: number) => Math.max(0, Math.min(1, v));
  if (perks.includes('겁쟁이')) t.courage = cl(t.courage - 0.3);
  if (perks.includes('깡다구')) t.courage = cl(t.courage + 0.3);
  if (perks.includes('손버릇')) t.sly = cl(t.sly + 0.3);
  if (perks.includes('구경꾼')) t.curious = cl(t.curious + 0.3);
}
