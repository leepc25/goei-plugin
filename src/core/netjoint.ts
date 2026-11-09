// 인터넷 자동 호출 묶기 (11-09 사용자 결정: 「게시판 넷 + 괴담톡 한 번에」, 쇼핑몰 둘은 따로).
// 매 턴 자동 호출인 괴담톡·괴담넷·괴담갤·세정게·연어 마켓 가운데 모델(메인/보조·전용 모델 ID)이 같은 것끼리 한 요청(host/joint.ts)으로 보낸다.
// 켬/끔 스위치 하나($net_joint, 기본 켬) — 괴담톡·괴담넷 설정의 「자동 호출」 아래 「한 번에 요청」. 끄면 하나씩 따로 1회.
import { BOARD_SITES, boardState, type BoardSite } from './boards';
import type { ScriptState } from './types';
import { featureModel } from './craft';
import { gnetSettings } from './gnet';
import { phoneSettings } from './phone';

type State = ScriptState | undefined;

export const JOINT_VAR = '$net_joint';
export type JointKind = 'phone' | BoardSite;
export const JOINT_LABEL: Record<JointKind, string> = { phone: '괴담톡', gn: '괴담넷', gal: '괴담갤', wpf: '세정게', sm: '연어 마켓' };
/** 통합 요청 JSON 의 칸 이름 (괴담넷은 옛 이름 gnet 그대로) */
export const JOINT_KEY: Record<JointKind, string> = { phone: 'phone', gn: 'gnet', gal: 'gal', wpf: 'wpf', sm: 'sm' };

export const jointOn = (state: State): boolean => String(state?.[JOINT_VAR] ?? '1') !== '0';

export interface AutoTask {
  kind: JointKind;
  model: 'main' | 'aux';
  /** 전용 모델 ID (고급 설정) */
  fixed?: string;
}

/** 매 턴 자동으로 부르는 인터넷 작업 (설정이 「매 턴」인 것만, 괴담톡 → 게시판 순) */
export function autoTasks(state: State): AutoTask[] {
  const out: AutoTask[] = [];
  const ph = phoneSettings(state);
  if (ph.auto) out.push({ kind: 'phone', model: ph.model, fixed: featureModel(state, 'ph') });
  for (const site of BOARD_SITES) {
    const sv = boardState(state, site);
    const g = gnetSettings(sv);
    if (g.enabled && g.auto) out.push({ kind: site, model: g.model, fixed: featureModel(sv, 'gn') });
  }
  return out;
}

/** 한 요청으로 보낼 덩어리들: 같은 모델끼리 (스위치가 꺼져 있으면 전부 혼자). 길이 2 이상이면 통합 요청 */
export function jointGroups(state: State): AutoTask[][] {
  const tasks = autoTasks(state);
  if (!jointOn(state)) return tasks.map((t) => [t]);
  const by = new Map<string, AutoTask[]>();
  for (const t of tasks) {
    const k = `${t.model}|${t.fixed ?? ''}`;
    const g = by.get(k);
    if (g) g.push(t);
    else by.set(k, [t]);
  }
  return [...by.values()];
}

/** 이 작업과 한 요청으로 묶이는 다른 작업들 (없으면 빈 배열) */
export function jointMates(state: State, kind: JointKind): JointKind[] {
  const g = jointGroups(state).find((x) => x.some((t) => t.kind === kind));
  return g && g.length > 1 ? g.filter((t) => t.kind !== kind).map((t) => t.kind) : [];
}
