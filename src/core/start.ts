import { BUILTIN, factionList, factionVars, PLAYER_FM, scenesOf } from './factions';
import { findFaction, findScenario, greetingKey, isFaction, isLang, SCENARIOS } from './scenarios';
import { agentScene, factionScenes, sceneText } from './scenes';
import { hasSceneCard, isSceneMessage, sceneMessage, UNSENT_MARK } from './dispatch';
import { buildSeed } from './seed';
import { readDirectory } from './world/directory';
import type { Chat, ChatMessage, LoreEntry, Manifest, ScriptState, StartChoice } from './types';

import { manifestEntry } from './lorebooks';

export { MANIFEST_COMMENT } from './lorebooks';

export function readManifest(lore: LoreEntry[] | undefined): Manifest | null {
  const entry = manifestEntry(lore);
  if (!entry || typeof entry.content !== 'string') return null;
  try {
    const m = JSON.parse(entry.content) as Manifest;
    if (m && m.plugin === 'goei-plugin' && m.greetings && typeof m.greetings === 'object') return m;
  } catch {
    /* fall through */
  }
  return null;
}

export type ChatPhase = 'fresh' | 'staged' | 'started';

/** 커스텀 임무 첫 장면 지시문이나 보내지 못한 직접 입력, 또는 플러그인이 넣은 첫 장면만 놓인 채팅 (다시 고를 수 있다) */
export function unsentOpening(chat: Chat): boolean {
  const m = chat.message ?? [];
  const text = String(m[0]?.data ?? '');
  if (m.length !== 1) return false;
  if (m[0]?.role === 'char') return isSceneMessage(text);
  return m[0]?.role === 'user' && (hasSceneCard(text) || text.includes(UNSENT_MARK));
}

/** 플러그인이 넣은 첫 장면 메시지가 맨 앞에 있는 채팅인지 (첫 전송 전) */
export const sceneStaged = (chat: Chat): boolean => (chat.message ?? []).length === 1 && chat.message[0]?.role === 'char' && isSceneMessage(chat.message[0].data);

/** fresh: 아직 선택 없음, staged: 선택했지만 첫 전송 전 (다시 고를 수 있음), started: 대화 진행 중 */
export function chatPhase(chat: Chat): ChatPhase {
  if ((chat.message ?? []).length > 0 && !unsentOpening(chat)) return 'started';
  return isFaction(chat.scriptstate?.['$st_faction']) ? 'staged' : 'fresh';
}

export function currentChoice(chat: Chat): Partial<StartChoice> {
  const s = chat.scriptstate ?? {};
  // 시작 화면에서 고른 칸($st_pick, 묶음이면 묶음 코드)을 먼저, 없으면 실제 소속
  const faction = isFaction(s['$st_pick']) ? s['$st_pick'] : isFaction(s['$st_faction']) ? s['$st_faction'] : undefined;
  const lang = isLang(s['$st_lang']) ? s['$st_lang'] : undefined;
  const fm = Number(s['$st_fm']);
  const player = String(s['$st_player'] ?? '');
  // fm 0 = 그 인물의 첫 장면 (인물로 시작할 때만)
  return { faction, lang, fm: Number.isInteger(fm) && (fm > 0 || (fm === 0 && !!player)) ? fm : undefined, ...(player ? { player } : {}) };
}

export class StartError extends Error {}

export interface StartPlan {
  /** 카드의 빈 추가 첫 메시지 번호 (첫 장면은 플러그인이 메시지로 넣으므로 Risu 쪽은 늘 빈 것) */
  fmIndex: number;
  scriptstate: ScriptState;
  seedMissing: string[];
  /** preset: 빈 첫 장면으로 시작하고 커스텀 임무 창에서 첫 지시문을 보낸다 */
  kind: 'opening' | 'direct' | 'preset';
  /** opening: 첫 메시지로 넣을 첫 장면 글 (공용 장면 또는 인물별 장면) */
  scene?: string;
}

/** 묶음(조직 아님)으로 시작할 때 모델에게 알릴 소속: 고른 인물의 원 소속 (기본 세력이면 그 세력의 소속 이름, 아니면 조직 이름) */
export function memberAffiliation(lore: LoreEntry[], playerId: string, fallback: string): string {
  const a = readDirectory(lore).agents.find((x) => x.id === playerId);
  if (!a?.affiliation) return fallback;
  const facs = factionList(lore);
  const f = BUILTIN.includes(a.affiliation) ? facs.find((x) => x.code === a.affiliation) : facs.find((x) => !x.builtin && !x.group && x.org === a.affiliation);
  return f?.affiliation ?? a.affiliation;
}

/** 묶음(조직 아님)으로 시작할 때 실제로 쓰는 소속 코드: 고른 인물의 원 소속 세력 코드 (사원증·톡 탭·기록이 그 조직 기준이 되게). 못 찾으면 묶음 코드 */
export function effectiveFaction(lore: LoreEntry[], code: string, playerId: string | undefined): string {
  const facs = factionList(lore);
  const f = facs.find((x) => x.code === code);
  if (!f?.group || !playerId) return code;
  const a = readDirectory(lore).agents.find((x) => x.id === playerId);
  if (!a?.affiliation) return code;
  if (BUILTIN.includes(a.affiliation)) return a.affiliation;
  return facs.find((x) => !x.builtin && !x.group && x.org === a.affiliation)?.code ?? code;
}

/**
 * START 확정: 원본 Lua의 setup-start와 같은 채팅 변수를 만들고,
 * 선택한 첫 장면이 들어 있는 추가 인사말 번호를 고른다.
 */
export function planStart(
  choice: StartChoice,
  manifest: Manifest,
  lore: LoreEntry[],
  greetingCount: number,
  /** 상황판 변수 (startWorldVars). 없으면 상황판 지침을 끈 채로 시작 */
  world: ScriptState | null = null,
): StartPlan {
  const factions = factionList(lore);
  const faction = findFaction(choice.faction, factions);
  if (!faction) throw new StartError('소속을 골라 주세요.');
  if (!isLang(choice.lang)) throw new StartError('언어를 골라 주세요.');
  // 묶음(중립)은 내 페르소나 없이 그 인물로만 시작한다
  if (faction.group && !choice.player) throw new StartError('이 칸은 인물을 골라 시작해요.');
  // 인물별 첫 장면 (fm 0): 그 인물로 플레이할 때만, 글이 있을 때만
  const playerScene = choice.fm === PLAYER_FM && choice.player ? agentScene(choice.player, scenesOf(lore)) : null;
  const scenario = playerScene ? { fm: PLAYER_FM, label: '첫 장면', kind: 'opening' as const } : findScenario(choice.faction, choice.fm, factions);
  if (!scenario) throw new StartError('상황을 골라 주세요.');
  // 세력 공용 장면은 신입(페르소나) 시점이라 캐릭터 플레이에는 인물별 장면·직접 입력·커스텀 임무만
  if (choice.player && scenario.kind === 'opening' && !playerScene) throw new StartError('캐릭터로 시작할 때는 그 인물의 첫 장면이나 직접 입력·커스텀 임무를 골라 주세요.');
  let scene = '';
  if (scenario.kind === 'opening') {
    scene = playerScene ? sceneText(playerScene, choice.lang) : sceneText(factionScenes(choice.faction, scenesOf(lore)).find((r) => r.fm === choice.fm) ?? null, choice.lang);
    if (!scene.trim()) throw new StartError(`「${scenario.label}」의 ${choice.lang === 'en' ? '영어' : '한국어'} 글이 없어요. 설정 창 세계 › 시작 화면에서 적어 주세요.`);
  }
  // Risu 쪽 첫 메시지는 늘 카드의 공용 빈 첫 장면 (직접 입력용). 첫 장면 글은 플러그인이 메시지로 넣는다 (2026-11-05 사용자: Risu 추가 첫 메시지를 안 씀)
  const fmIndex = emptyGreeting(manifest, greetingCount);
  if (fmIndex < 0) throw new StartError('이 카드에 빈 첫 장면이 없어요. 설치 · 점검에서 인사말을 다시 심어 주세요.');
  const seed = buildSeed(lore, choice.faction, choice.fm, faction.builtin ? undefined : faction.group ? [] : faction.seed);
  return {
    fmIndex,
    kind: scenario.kind,
    ...(scene ? { scene } : {}),
    seedMissing: seed.missing,
    scriptstate: {
      // 묶음은 모델·사원증·톡 탭에 고른 인물의 원 소속으로 보인다 (묶음 이름은 모델에 알리지 않음, 2026-11-05 사용자). 고른 칸은 $st_pick 에
      $st_faction: effectiveFaction(lore, choice.faction, choice.player),
      $st_player: choice.player ?? '',
      $st_lang: choice.lang,
      $st_fm: String(choice.fm),
      $st_pick: choice.faction,
      $st_lang_pick: choice.lang,
      $st_fm_pick: String(choice.fm),
      $ib_affiliation: faction.group && choice.player ? memberAffiliation(lore, choice.player, faction.affiliation) : faction.affiliation,
      $st_anomaly_on: '0',
      $an_report: '',
      $in_report: '',
      $ms_report: '',
      $ag_report: '',
      $seed_lore: seed.text,
      $seed_inputs: '0',
      $goei_last: '',
      ...factionVars(lore),
      ...(world ?? {}),
    },
  };
}

/** 카드의 빈 추가 첫 메시지 번호: 매니페스트의 직접 입력 키 중 범위 안의 것. 없으면 -1 */
export function emptyGreeting(manifest: Manifest, greetingCount: number): number {
  const keys: string[] = [];
  for (const f of SCENARIOS.factions) for (const sc of f.scenarios) if (sc.kind === 'direct') for (const l of SCENARIOS.languages) keys.push(greetingKey(f.code, l.code, sc.fm));
  for (const k of keys) {
    const n = manifest.greetings[k];
    if (Number.isInteger(n) && n >= 0 && n < greetingCount) return n;
  }
  return -1;
}

/** 첫 장면 메시지 (char). chatId 는 Risu 가 새로 주지 않으므로 여기서 만든다 */
export function sceneChatMessage(text: string, id: string): ChatMessage {
  return { role: 'char', data: sceneMessage(text), time: Date.now(), chatId: id };
}

export function applyStart(chat: Chat, plan: StartPlan, sceneId = ''): Chat {
  // 보내지 않은 커스텀 임무 지시문·앞서 넣은 첫 장면은 새 선택으로 바꾼다
  const message = unsentOpening(chat) ? [] : [...(chat.message ?? [])];
  if (plan.scene) message.push(sceneChatMessage(plan.scene, sceneId || `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`));
  return {
    ...chat,
    message,
    fmIndex: plan.fmIndex,
    scriptstate: { ...(chat.scriptstate ?? {}), ...plan.scriptstate },
  };
}
