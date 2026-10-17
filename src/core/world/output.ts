// 채팅 변수와 상황판 상태 사이의 다리. 상태는 채팅 변수 $goei_world(JSON) 하나에 두고,
// 로어북이 읽는 $an_report 등은 상태에서 매번 다시 만든다.
import { findFaction } from '../scenarios';
import type { Chat, ScriptState } from '../types';
import type { Catalog } from './catalog';
import { applyOutput, bootstrap, parseWorld, reports, type Rng, type WorldSettings, type WorldState } from './engine';
import { cleanOutput, hasWorldTags } from './tags';

export const WORLD_KEY = '$goei_world';
const LAST_KEY = '$goei_last';

export function worldOn(chat: Chat): boolean {
  return chat.scriptstate?.['$st_anomaly_on'] === '1';
}

export function readWorld(chat: Chat): WorldState {
  return parseWorld(chat.scriptstate?.[WORLD_KEY]);
}

export function worldVars(w: WorldState, c: Catalog, s: WorldSettings, faction: string): ScriptState {
  const r = reports(w, c, s, faction);
  return {
    ...c.factionVars,
    [WORLD_KEY]: JSON.stringify(w),
    $st_anomaly_on: '1',
    $an_report: r.an,
    $in_report: r.in,
    $ms_report: r.ms,
    $ag_report: r.ag,
  };
}

/** START 때 넣을 상황판 변수 (첫 발생 추첨 포함) */
export function startWorldVars(c: Catalog, s: WorldSettings, faction: string, rng: Rng): ScriptState {
  return worldVars(bootstrap(c, s, rng), c, s, faction);
}

/** 짧은 지문: 같은 응답을 두 번 처리하지 않기 위해 */
function fingerprint(index: number, text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${index}:${text.length}:${(h >>> 0).toString(36)}`;
}

/**
 * 모델 응답이 채팅에 들어간 뒤 한 번: 태그를 상태에 반영하고, 저장 본문에서 태그를 지우고,
 * 다음 턴 브리핑을 만든다. 바꿀 것이 없으면 null.
 * raw: 리스너가 받은 그 응답 본문. 최신 채팅에서 같은 본문을 찾아 고친다.
 */
export function processOutput(chat: Chat, messageIndex: number, raw: string, c: Catalog, s: WorldSettings, rng: Rng): Chat | null {
  if (!worldOn(chat)) return null;
  const messages = chat.message ?? [];
  let index = messageIndex;
  if (messages[index]?.data !== raw) {
    index = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'char' && messages[i].data === raw) {
        index = i;
        break;
      }
    }
  }
  const msg = messages[index];
  if (!msg || msg.role !== 'char') return null;

  const state = chat.scriptstate ?? {};
  const clean = cleanOutput(raw);
  // 이미 처리한 응답에 리스너가 다시 불린 경우 (태그도 없고 지문도 같음)
  if (!hasWorldTags(raw) && state[LAST_KEY] === fingerprint(index, clean)) return null;

  const faction = String(state['$st_faction'] ?? '');
  const result = applyOutput(readWorld(chat), c, s, faction, raw, rng);
  const now = result.faction ?? faction;
  const vars: ScriptState = { ...worldVars(result.world, c, s, now), [LAST_KEY]: fingerprint(index, clean) };
  if (result.faction) {
    vars.$st_faction = result.faction;
    vars.$st_pick = result.faction;
    vars.$ib_affiliation = c.affiliations?.[result.faction] ?? findFaction(result.faction)?.affiliation ?? '미등록';
  }
  const message = messages.slice();
  message[index] = { ...msg, data: clean };
  return { ...chat, message, scriptstate: { ...state, ...vars } };
}
