import { factionList, factionVars } from './factions';
import { findFaction, findScenario, greetingKey, isFaction, isLang, SCENARIOS } from './scenarios';
import { hasSceneCard } from './dispatch';
import { buildSeed } from './seed';
import type { Chat, LoreEntry, Manifest, ScriptState, StartChoice } from './types';

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

/** 커스텀 임무 첫 장면 지시문만 놓이고 아직 보내지 않은 채팅 (다시 고를 수 있다) */
export function unsentOpening(chat: Chat): boolean {
  const m = chat.message ?? [];
  return m.length === 1 && m[0]?.role === 'user' && hasSceneCard(String(m[0].data ?? ''));
}

/** fresh: 아직 선택 없음, staged: 선택했지만 첫 전송 전 (다시 고를 수 있음), started: 대화 진행 중 */
export function chatPhase(chat: Chat): ChatPhase {
  if ((chat.message ?? []).length > 0 && !unsentOpening(chat)) return 'started';
  return isFaction(chat.scriptstate?.['$st_faction']) ? 'staged' : 'fresh';
}

export function currentChoice(chat: Chat): Partial<StartChoice> {
  const s = chat.scriptstate ?? {};
  const faction = isFaction(s['$st_faction']) ? s['$st_faction'] : undefined;
  const lang = isLang(s['$st_lang']) ? s['$st_lang'] : undefined;
  const fm = Number(s['$st_fm']);
  return { faction, lang, fm: Number.isInteger(fm) && fm > 0 ? fm : undefined };
}

export class StartError extends Error {}

export interface StartPlan {
  fmIndex: number;
  scriptstate: ScriptState;
  seedMissing: string[];
  /** preset: 빈 첫 장면으로 시작하고 커스텀 임무 창에서 첫 지시문을 보낸다 */
  kind: 'opening' | 'direct' | 'preset';
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
  const scenario = findScenario(choice.faction, choice.fm, factions);
  if (!scenario) throw new StartError('상황을 골라 주세요.');
  // 커스텀 임무 시작은 직접 입력과 같은 빈 첫 장면을 쓴다 (원본도 같은 인사말)
  const direct = faction.scenarios.find((s) => s.kind === 'direct');
  const keys = [greetingKey(choice.faction, choice.lang, choice.fm)];
  if (scenario.kind === 'preset' && direct) keys.push(greetingKey(choice.faction, choice.lang, direct.fm));
  // 새 세력은 자기 인사말이 없어서 기본 세력의 직접 입력용 빈 첫 장면을 같이 쓴다
  if (!faction.builtin && scenario.kind !== 'opening') {
    for (const f of SCENARIOS.factions) for (const sc of f.scenarios) if (sc.kind === 'direct') keys.push(greetingKey(f.code, choice.lang, sc.fm));
  }
  const fmIndex = keys.map((k) => manifest.greetings[k]).find((i) => Number.isInteger(i)) ?? -1;
  if (!Number.isInteger(fmIndex) || fmIndex < 0 || fmIndex >= greetingCount) {
    throw new StartError(`이 카드에 「${scenario.label}」 첫 장면이 없어요. 경량 카드를 다시 만들어 주세요.`);
  }
  const seed = buildSeed(lore, choice.faction, choice.fm, faction.builtin ? undefined : faction.seed);
  return {
    fmIndex,
    kind: scenario.kind,
    seedMissing: seed.missing,
    scriptstate: {
      $st_faction: choice.faction,
      $st_lang: choice.lang,
      $st_fm: String(choice.fm),
      $st_pick: choice.faction,
      $st_lang_pick: choice.lang,
      $st_fm_pick: String(choice.fm),
      $ib_affiliation: faction.affiliation,
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

export function applyStart(chat: Chat, plan: StartPlan): Chat {
  return {
    ...chat,
    // 보내지 않은 커스텀 임무 지시문은 새 선택으로 바꾼다
    ...(unsentOpening(chat) ? { message: [] } : {}),
    fmIndex: plan.fmIndex,
    scriptstate: { ...(chat.scriptstate ?? {}), ...plan.scriptstate },
  };
}
