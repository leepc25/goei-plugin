// 세력 평판 (docs/설계안_세력평판.md): 세력 → 유저 값. 인물 호감 엔진(sumCues)을 그대로 쓰고 who 는 '세력:코드'.
// 시작값은 조직×조직 표(relations-base orgs), 유저 소속은 상태창 신분. 수배·표적 같은 별도 상태는 없다.
// 무엇이 평판을 바꾸는지는 갱신기 모델이 판단한다 (공식·집단 제한 없음, 사용자 2026-10-26). 코드는 인용·세력당 1건·메시지당 ±10 만 검사.
import { factionView } from './affinity';
import { factionBase } from './base';
import { factionCodesIn, ORG_NAMES } from './identity';
import type { PeopleSettings } from './settings';
import { FACTION_STAGES, factionWho, type Change, type FactionStage, type PeopleStore } from './types';

export interface FactionNow { code: string; name: string; value: number; stage: FactionStage; base: number }

/** 유저 소속 코드 (상태창 신분 → 채팅 변수) */
export function userFactionOf(store: PeopleStore, chat: { scriptstate?: Record<string, unknown> }): string {
  const v = chat.scriptstate?.['$st_faction'] ?? chat.scriptstate?.['st_faction'];
  return store.identity?.faction || (typeof v === 'string' ? v : '');
}

/** 아는 세력 코드 전부: 기본 5 + 장부에 있는 것 + 이름표(명부)에 있는 것 */
export function knownFactionCodes(store: PeopleStore, names: Record<string, string> = {}): string[] {
  return [...new Set([...Object.keys(ORG_NAMES), ...Object.keys(store.factions), ...Object.keys(names)])];
}

export const factionName = (code: string, names: Record<string, string> = {}, store?: PeopleStore): string => names[code] || store?.factions[code]?.name || ORG_NAMES[code] || code;

/** 세력 하나의 현재값 */
export function factionNow(store: PeopleStore, code: string, changes: Change[], userFaction: string, settings: PeopleSettings, names: Record<string, string> = {}): FactionNow {
  const base = factionBase(code, userFaction);
  const v = factionView(code, base, changes, store.folded[factionWho(code)] ?? 0, settings.speed, settings.factionBounds);
  return { code, name: factionName(code, names, store), value: v.value, stage: v.stage, base };
}

/** 장면 세력: 장면 인물의 소속 ∪ 글에 이름이 나온 세력. 유저 자신의 소속도 포함 (자기 조직의 평판) */
export function sceneFactionCodes(store: PeopleStore, people: string[], texts: string[], names: Record<string, string> = {}): string[] {
  const out: string[] = [];
  const push = (c: string) => { if (c && !out.includes(c)) out.push(c); };
  for (const n of people) push(store.people[n]?.faction ?? '');
  for (const t of texts) for (const c of factionCodesIn(t, names)) push(c);
  return out;
}

/** 본편에 넣을 세력 절: 중립은 생략. 비어 있으면 '' */
export function factionsBlock(list: FactionNow[], user = '{{user}}'): string {
  const lines = list.filter((f) => f.stage.id !== 'neutral').map((f) => `- ${f.name} → ${user}: ${f.stage.behavior.replace(/\{\{user\}\}/g, user)}`);
  if (!lines.length) return '';
  return ['## Factions → ' + user + ' (standing of each organization toward ' + user + ', kept by the system; members act accordingly)', ...lines].join('\n');
}

export const stageLabel = (id: FactionStage['id']) => FACTION_STAGES[id].label;
