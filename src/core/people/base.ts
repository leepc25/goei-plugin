// 미리 만든 자료 (game-src/dialogue/relations-base.json · aliases.json): 인물별 가치관·표현 정도·성격 계수·호감 시작값·별명.
// 개발 때 위키·시트를 읽어 만들고 사용자가 검수한다. 실행 중 모델 호출 없음.
import relationsBase from '../../../game-src/dialogue/relations-base.json';
import aliasesBase from '../../../game-src/dialogue/aliases.json';
import addressBase from '../../../game-src/dialogue/address.json';
import type { NameEntry } from './select';
import type { SeedBase } from './seed';
import { relativeRank } from './identity';
import { REGISTERS, type Identity, type Register, type Temper } from './types';

interface BasePerson { faction: string; values: string; express: 0 | 1 | 2 | 3; temper: Temper; english: string[] }
interface RelationsBase { version: number; people: Record<string, BasePerson>; pairs: Record<string, { aff: number; src: string }>; orgs: Record<string, number> }
interface AliasesBase { version: number; names: Record<string, { aliases: string[]; titles: string[] }>; ambiguous: Record<string, string[]> }
/** 호칭 표 (address.json): 그 인물의 직급 단계, 말투, 자기 호칭, 유저가 상급·동급·하급·외부인일 때 부르는 말 */
interface AddressRow { level: number | null; register: string; self: string; up: string; peer: string; down: string; outsider: string }
interface AddressBase { version: number; names: Record<string, AddressRow> }

export const RELATIONS: RelationsBase = relationsBase as RelationsBase;
export const ALIASES: AliasesBase = aliasesBase as AliasesBase;
export const ADDRESS: AddressBase = addressBase as AddressBase;

/** 유저 신분(상태창)에 따른 시작 호칭. 표에 없는 인물은 undefined (갱신기가 채움) */
export function seedAddress(name: string, faction: string, user: Identity | undefined): { toUser: string; register: Register } | undefined {
  const row = ADDRESS.names[name];
  if (!row) return undefined;
  const rel = relativeRank(user, faction, row.level);
  const register = REGISTERS.includes(row.register as Register) ? (row.register as Register) : '존댓말';
  return { toUser: row[rel] || row.outsider || '', register };
}

/** 처음 등장한 인물의 시작값 한 벌: 소속·표현 정도·호감 시작값·별명·호칭 */
export function seedBaseFor(name: string, userFaction: string, user: Identity | undefined): SeedBase {
  const b = RELATIONS.people[name];
  const faction = b?.faction ?? '';
  const alias = ALIASES.names[name];
  const address = seedAddress(name, faction, user);
  return {
    faction,
    ...(b ? { express: b.express } : {}),
    affinityBase: userAffinityBase(faction, userFaction),
    aliases: [...new Set([...(alias?.aliases ?? []), ...(b?.english ?? [])])],
    ...(address ? { address } : {}),
  };
}

export const basePerson = (name: string): BasePerson | undefined => RELATIONS.people[name];
export const valuesOf = (name: string): string => RELATIONS.people[name]?.values ?? '';
export const temperOf = (name: string): Temper | undefined => RELATIONS.people[name]?.temper;

/** 인물 조직 → 유저 조직 시작값. 같은 조직·표에 없으면 0 */
export function userAffinityBase(personFaction: string, userFaction: string): number {
  if (!personFaction || !userFaction || personFaction === userFaction) return 0;
  return RELATIONS.orgs[`${personFaction}>${userFaction}`] ?? 0;
}

/** 인물 → 인물 시작값 (위키 근거 쌍). 없으면 0 */
export const pairBase = (from: string, to: string): number => RELATIONS.pairs[`${from}>${to}`]?.aff ?? 0;

/** 이름 표: 미리 만든 별명·호칭 (기록에 있는 사람 + 아직 등장 전 사람 전부) */
export function allNames(): NameEntry[] {
  return Object.entries(ALIASES.names).map(([name, v]) => ({ name, aliases: [...new Set([...(v.aliases ?? []), ...(RELATIONS.people[name]?.english ?? [])])], titles: v.titles ?? [] }));
}
export const extraNames = (): Record<string, { aliases?: string[]; titles?: string[] }> => Object.fromEntries(allNames().map((e) => [e.name, { aliases: e.aliases, titles: e.titles }]));
