import raw from '../data/scenarios.json';
import type { Faction, FactionCode, LangCode, Scenario, ScenarioData } from './types';

export const SCENARIOS = raw as ScenarioData;

// list: 카드의 세력 목록 (factions.ts factionList). 없으면 기본 다섯 세력

export function findFaction(code: string, list: Faction[] = SCENARIOS.factions): Faction | undefined {
  return list.find((f) => f.code === code);
}

export function findScenario(code: string, fm: number, list: Faction[] = SCENARIOS.factions): Scenario | undefined {
  return findFaction(code, list)?.scenarios.find((s) => s.fm === fm);
}

export function isLang(value: unknown): value is LangCode {
  return SCENARIOS.languages.some((l) => l.code === value);
}

/** 세력 코드 모양인지 (A00~Z00). 카드에 그 세력이 있는지는 findFaction으로 본다 */
export function isFaction(value: unknown): value is FactionCode {
  return typeof value === 'string' && /^[A-Z]00$/.test(value);
}

export function defaultScenario(code: FactionCode, list: Faction[] = SCENARIOS.factions): number {
  return SCENARIOS.defaultScenario[code] ?? findFaction(code, list)?.scenarios[0]?.fm ?? 1;
}

export function greetingKey(faction: FactionCode, lang: LangCode, fm: number): string {
  return `${faction}-${lang}-${fm}`;
}
