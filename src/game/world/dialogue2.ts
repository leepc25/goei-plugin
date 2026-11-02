// 새 대사 자료(game-src/dialogue2, 10-31 사용자 칸 기준) 읽기 — 칸 열쇠 하나로 말풍선 한 줄.
// 자료는 대사 팩(game-pack/dialogue, 파일마다 gzip JSON)에서 인물·NPC 파일 단위로 받아 둔다 (16MB 라 코드에 못 묶는다).
// 칸 열쇠(docs/대사_연결.md): 「facing.greet」처럼 묶음.칸 만 주면 주인공 소속(A00…·etc)과 평판(friend·neutral·wary·hostile)을 끼워
// facing.<소속>.<평판>.greet 를 찾는다. 상대가 주인공이 아니면(expel·combat) _other·other 칸으로. 주인공이 아는 인물로 플레이 중이면 chars.<인물> 먼저.
// 자료가 아직 없거나 그 칸이 비면 null — 억지로 다른 말을 끼우지 않는다 (호출 쪽이 임시 글을 쓰든 말풍선 기호로 대신한다).
import type { Rng } from './rng';

export type Rep = 'friend' | 'neutral' | 'wary' | 'hostile';
export type Stance = 'friendly' | 'favorable' | 'neutral' | 'wary' | 'hostile';
/** 주인공 소속 갈래 (칸_구조.md): 기본 다섯 + 그 밖 */
export const FACTION_KEYS = ['A00', 'B00', 'C00', 'D00', 'E00'] as const;
/** 주인공이 상대인 24갈래 묶음 */
export const GROUPS_24 = ['facing', 'react', 'busy', 'companion', 'injured', 'combat', 'shower', 'toilet', 'expel'] as const;
/** 주인공이 아닌 상대일 때 쓰는 묶음 → 그 묶음 (expel → expel_other, combat → combat.other) */
const OTHER: Record<string, string> = { expel: 'expel_other', combat: 'combat.other' };
/** chars.<인물> 에 있는 칸 (facing 과 같은 네 칸) */
const CHAR_CELLS = new Set(['greet', 'talk', 'hit1', 'hit2']);

type Tree = { [k: string]: Tree | string[] | string | undefined };
export interface SpeakerData extends Tree {
  name: string;
  faction?: string;
  sex?: '남' | '여';
}

export interface CueCtx {
  /** 주인공 소속 코드 */
  faction: string;
  /** 말하는 사람 쪽에서 본 주인공 평판 (세력 평판 구간 또는 이름 인물 호감 구간). 모르면 neutral */
  stance?: Stance | Rep | null;
  /** 주인공이 플레이 중인 이름 인물 (없으면 유저 본인) → chars.<인물> 칸 먼저 */
  player?: string | null;
  /** 상대. '{user}' 또는 없음 = 주인공, 그 밖 = 다른 사람 (expel_other·combat.other) */
  target?: string;
  /** 상대 인물 이름 (social.mate.<인물>·shower.mate 등) */
  partner?: string;
  /** 필드 시 (time 묶음) */
  hour?: number | null;
  /** 자료가 없을 때 쓸 임시 글 */
  say?: string;
}

export const repOf = (s: Stance | Rep | null | undefined): Rep => (s === 'friendly' || s === 'favorable' || s === 'friend' ? 'friend' : s === 'wary' || s === 'hostile' ? s : 'neutral');
export const timeKey = (h: number | null | undefined) => (h == null ? 'day' : h >= 5 && h < 11 ? 'morning' : h < 17 ? 'day' : h < 19.5 ? 'evening' : 'night');

/** 몹 원형 + 성별 + 거점 소속 → NPC 대사 파일 이름 (game-src/dialogue2/npc). 없으면 null */
export function npcFileOf(archetype: string | undefined, sex: '남' | '여' | null | undefined, faction: string | null | undefined): string | null {
  if (!archetype) return null;
  const s = sex ?? '남';
  if (archetype === '의사') return '의사_남';
  if (archetype === '간호사') return '간호사_여';
  if (archetype === '편의점 점원') return `상인_${s}`;
  if (['행인', '학생', '불량배', '경찰', '청소부', '상인'].includes(archetype)) return `${archetype}_${s}`;
  // 세력 소속 NPC: 관리국은 직책별, 다른 세력은 그 세력 파일 (가짜 관리국은 남성만)
  if (['경비', '안내 직원', '행정 직원', '관리국 요원'].includes(archetype)) {
    if (faction === 'B00') return archetype === '경비' || archetype === '관리국 요원' ? '가짜 관리국 진압부대_남' : '가짜 관리국 검사부대_남';
    if (faction === 'C00') return `백일몽 직원_${s}`;
    if (faction === 'E00') return `프리랜서_${s}`;
    if (faction && faction !== 'A00' && faction >= 'F00') return `협회 직원_${s}`;
    return `${archetype}_${s}`;
  }
  return null;
}

const isList = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

function dig(t: Tree | undefined, path: string[]): string[] | null {
  let cur: Tree | string[] | string | undefined = t;
  for (const k of path) {
    if (!cur || typeof cur === 'string' || Array.isArray(cur)) return null;
    cur = cur[k];
  }
  return isList(cur) ? cur : null;
}

/** gzip 바이트 → 글. DecompressionStream 이 없는 환경(옛 웹뷰)이면 null (대사 없이 돈다) */
export async function gunzipText(bytes: Uint8Array): Promise<string | null> {
  if (typeof DecompressionStream === 'undefined') return null;
  const ds = new DecompressionStream('gzip');
  const w = ds.writable.getWriter();
  void w.write(bytes as unknown as BufferSource).then(() => w.close()).catch(() => {});
  return new Response(ds.readable).text();
}

export class Dialogue2 {
  private cache = new Map<string, SpeakerData | null>();
  private pending = new Map<string, Promise<SpeakerData | null>>();
  private recent: string[] = [];
  /**
   * load: 팩 파일(c_<이름>.json.gz · n_<파일>.json.gz)의 바이트. 없으면 null.
   * 시험·시연판은 data 로 바로 넣을 수 있다.
   */
  constructor(private load: (file: string) => Promise<Uint8Array | null>, private rng: Rng, data: Record<string, SpeakerData> = {}) {
    for (const [k, v] of Object.entries(data)) this.cache.set(k, v);
  }

  static fileKey(kind: 'named' | 'mob', name: string): string {
    return kind === 'named' ? `c_${name}` : `n_${name}`;
  }
  /** 받아 둔 자료가 있나 (없으면 fetch 가 시작되고 false) */
  has(kind: 'named' | 'mob', name: string): boolean {
    const key = Dialogue2.fileKey(kind, name);
    if (this.cache.has(key)) return !!this.cache.get(key);
    void this.fetch(key);
    return false;
  }
  /** 미리 받아 두기 (장면에 있는 사람들) */
  prefetch(kind: 'named' | 'mob', names: string[]): Promise<unknown> {
    return Promise.all(names.map((n) => this.fetch(Dialogue2.fileKey(kind, n))));
  }
  private fetch(key: string): Promise<SpeakerData | null> {
    if (this.cache.has(key)) return Promise.resolve(this.cache.get(key) ?? null);
    let p = this.pending.get(key);
    if (!p) {
      p = this.load(`${key}.json.gz`)
        .then(async (b) => (b ? gunzipText(b) : null))
        .then((t) => (t ? (JSON.parse(t) as SpeakerData) : null))
        .catch(() => null)
        .then((d) => { this.cache.set(key, d); this.pending.delete(key); return d; });
      this.pending.set(key, p);
    }
    return p;
  }
  data(kind: 'named' | 'mob', name: string): SpeakerData | null {
    return this.cache.get(Dialogue2.fileKey(kind, name)) ?? null;
  }

  /** 칸 열쇠 → 후보 줄 목록 (풀어 쓴 경로도 받는다: facing.A00.friend.greet) */
  pool(d: SpeakerData, cell: string, ctx: CueCtx): string[] {
    const parts = cell.split('.');
    const [grp, ...rest] = parts;
    const toUser = !ctx.target || ctx.target === '{user}';
    if (grp === 'time') return dig(d, ['time', rest[0] ?? timeKey(ctx.hour)]) ?? [];
    if ((GROUPS_24 as readonly string[]).includes(grp) && rest.length === 1) {
      const name = rest[0];
      if (!toUser) {
        const o = OTHER[grp];
        return o ? dig(d, [...o.split('.'), name]) ?? [] : [];
      }
      // 주인공이 아는 인물로 플레이 중: 마주 보고 하는 그 인물 칸
      if (grp === 'facing' && ctx.player && CHAR_CELLS.has(name)) {
        const c = dig(d, ['chars', ctx.player, name]);
        if (c?.length) return c;
      }
      const fac = (FACTION_KEYS as readonly string[]).includes(ctx.faction) ? ctx.faction : 'etc';
      const rep = repOf(ctx.stance);
      return dig(d, [grp, fac, rep, name]) ?? dig(d, [grp, 'etc', rep, name]) ?? [];
    }
    if (grp === 'social' && rest[0] === 'mate' && rest.length === 1) return (ctx.partner && dig(d, ['social', 'mate', ctx.partner])) || dig(d, ['social', 'mate_greet']) || [];
    if (grp === 'shower' && rest[0] === 'mate') return dig(d, ['shower', 'mate']) ?? [];
    return dig(d, parts) ?? [];
  }

  /**
   * 말풍선 한 줄. 자료가 없거나(아직 안 받음·그 사람 자료 없음) 칸이 비면 null.
   * 최근에 쓴 줄은 피한다.
   */
  line(kind: 'named' | 'mob', name: string, cell: string, ctx: CueCtx): string | null {
    const key = Dialogue2.fileKey(kind, name);
    if (!this.cache.has(key)) { void this.fetch(key); return null; }
    const d = this.cache.get(key);
    if (!d) return null;
    const pool = this.pool(d, cell, ctx);
    if (!pool.length) return null;
    const fresh = pool.filter((l) => !this.recent.includes(l));
    const from = fresh.length ? fresh : pool;
    const line = from[Math.floor(this.rng() * from.length)];
    this.recent.push(line);
    if (this.recent.length > 60) this.recent.shift();
    return line;
  }
}
