// 필드 말풍선 대사 고르기 (game-src/dialogue 작성 규칙, docs/필드_대사_설계_결정.md).
// 칸: 플레이어 소속·직급(같은 조직이면 상관/동료/부하) × 아군/적군, 시간대 혼잣말, 상황, 생태계(eco) 태그.
// {호칭}은 말하는 사람의 호칭 규칙으로 채우고 바로 뒤 조사를 받침에 맞춘다. 최근에 쓴 줄은 피한다.
import type { Rng } from './rng';

type Cell = Record<string, string[]> | null;
interface Persona { same?: Record<string, Cell>; [faction: string]: Cell | Record<string, Cell> | undefined }
export interface CharLines {
  faction: string | null;
  level: number | null;
  address: Record<string, string>;
  persona: Persona;
  time: Record<string, string[]>;
  situation: Record<string, string[]>;
  eco: Record<string, string[]>;
}
export interface DialogueData {
  version: number;
  characters: Record<string, CharLines>;
  npc: Record<string, Omit<CharLines, 'level' | 'address'> & { level?: null; address?: Record<string, string> }>;
}

/** 몹 원형 → 대사 종류 (game-src/dialogue/npc) */
export const NPC_TYPE: Record<string, string> = {
  행인: '시민', 회사원: '시민', 관광객: '시민', 방문객: '시민', 배달원: '시민', 학생: '학생', 불량배: '불량배',
  경찰: '경찰', 청소부: '청소부', 경비: '관리국 직원', '안내 직원': '관리국 직원', '행정 직원': '관리국 직원', '편의점 점원': '상인',
  상인: '상인', 취객: '시민', 주민: '시민', 산책객: '시민', 승객: '시민', 의사: '의사', 간호사: '간호사',
};

export interface LineCtx {
  /** 필드 시 (모르면 null → 낮) */
  hour: number | null;
  /** 플레이어 소속 코드 (A00 등)·직급 숫자 */
  faction: string;
  level: number | null;
  /** 이 사람이 지금 플레이어를 적으로 보나 (호감 적대 구간·세력 적대·싸움 중) */
  enemy?: boolean;
}

export const timeKey = (h: number | null) => (h == null ? 'day' : h >= 5 && h < 11 ? 'morning' : h < 17 ? 'day' : h < 19.5 ? 'evening' : 'night');

const JOSA = /^(이라도|라도|이랑|랑|으로|로|이|가|은|는|을|를|과|와)/;
const PAIRS: [string, string][] = [['이라도', '라도'], ['이랑', '랑'], ['으로', '로'], ['이', '가'], ['은', '는'], ['을', '를'], ['과', '와']];
/** {호칭} 채우기 + 바로 뒤 조사를 받침에 맞춤 (src/core/josa.ts 규칙과 같음) */
export function fillAddress(line: string, word: string): string {
  return line.replace(/\{호칭\}([가-힣]*)/g, (_m, rest: string) => {
    const j = rest.match(JOSA)?.[0];
    if (!j) return word + rest;
    const last = word.slice(-1).charCodeAt(0) - 0xac00;
    const batchim = last >= 0 && last <= 11171 ? last % 28 !== 0 : true;
    const rieul = batchim && last % 28 === 8; // ㄹ받침 + (으)로 → 로
    const pair = PAIRS.find(([a, b]) => a === j || b === j)!;
    const pick = pair[0] === '으로' ? (batchim && !rieul ? '으로' : '로') : batchim ? pair[0] : pair[1];
    return word + pick + rest.slice(j.length);
  });
}

export class Lines {
  private recent: string[] = [];
  constructor(readonly data: DialogueData, private rng: Rng) {}

  private src(kind: 'named' | 'mob', name: string, archetype?: string) {
    return kind === 'named' ? this.data.characters[name] : this.data.npc[NPC_TYPE[archetype ?? name] ?? NPC_TYPE[name] ?? name];
  }
  /** 이 사람이 이 대사 자료를 갖고 있나 */
  has(kind: 'named' | 'mob', name: string, archetype?: string): boolean {
    return !!this.src(kind, name, archetype);
  }

  /** 플레이어를 부르는 말: 같은 조직이면 직급 비교(up = 플레이어가 위), 아니면 outsider */
  address(c: CharLines | undefined, ctx: LineCtx): string {
    const a = c?.address ?? {};
    if (c?.faction && c.faction === ctx.faction) {
      const rel = c.level == null || ctx.level == null ? 'peer' : ctx.level > c.level ? 'up' : ctx.level < c.level ? 'down' : 'peer';
      return a[rel] || a.peer || '';
    }
    return a.outsider || '';
  }

  /** 플레이어 소속·직급에 맞는 칸의 말풍선 목록 */
  private personaBarks(c: CharLines | DialogueData['npc'][string], ctx: LineCtx): string[] {
    const side = ctx.enemy ? 'enemy' : 'ally';
    let cell: Cell | undefined;
    if (c.faction && c.faction === ctx.faction && c.persona.same) {
      const lv = (c as CharLines).level;
      const rel = lv == null || ctx.level == null ? 'peer' : ctx.level > lv ? 'up' : ctx.level < lv ? 'down' : 'peer';
      cell = c.persona.same[rel] ?? c.persona.same.peer;
    } else cell = (c.persona[ctx.faction] as Cell) ?? (c.persona.etc as Cell);
    return cell?.[side] ?? [];
  }

  /**
   * 말풍선 한 줄. tag: 'idle'(소속 칸 + 시간대 혼잣말) | 상황(alert·hurt…) | 생태계 태그(work·eat·victim…).
   * 생태계 태그에 대사가 없으면 null (억지로 다른 말을 끼우지 않는다)
   */
  bark(kind: 'named' | 'mob', name: string, tag: string, ctx: LineCtx, o: { archetype?: string; partner?: string } = {}): string | null {
    const c = this.src(kind, name, o.archetype);
    if (!c) return null;
    let pool: string[] = [];
    if (tag === 'idle') {
      const per = this.personaBarks(c, ctx);
      const time = c.time[timeKey(ctx.hour)] ?? [];
      pool = this.rng() < 0.55 && per.length ? per : time.length ? time : per;
    } else pool = c.eco?.[tag]?.length ? c.eco[tag] : c.situation?.[tag] ?? [];
    if (!pool.length) return null;
    const fresh = pool.filter((l) => !this.recent.includes(l));
    const line = (fresh.length ? fresh : pool)[Math.floor(this.rng() * (fresh.length || pool.length))];
    this.recent.push(line);
    if (this.recent.length > 40) this.recent.shift();
    const word = kind === 'named' ? this.address(c as CharLines, ctx) : (c as { address?: Record<string, string> }).address?.outsider ?? '';
    return fillAddress(line, word || '거기').replace(/\{상대\}/g, o.partner ?? '');
  }
}
