// 본편 채팅 연동 (기본기획서 22장): 읽기는 자동, 쓰기는 사용자가 버튼을 누를 때만.
// 실제 읽기·쓰기는 「리스 플러그인 탑재」 스레드의 bridge.card()·bridge.report()가 한다. 여기는 그 모양과 본부 쪽 해석만.
import type { AgentId } from './contract';
import { AGENT_BY_ID, MISSION_BY_ID } from './data';
import { reportText } from './logic';
import type { HqSave } from './state';

export interface CardAgent {
  id: string;
  name: string;
  english?: string;
  photo?: string;
  state?: string;
}
export interface CardEvent {
  kind: string;
  name: string;
  loc?: string;
  state?: string;
  situation?: string;
}
export interface CardView {
  agents: CardAgent[];
  events: CardEvent[];
}
export interface ReportPayload {
  mission: string;
  outcome: 'return' | 'withdraw' | 'evac';
  depth: number;
  agents: { id: string; name: string; hp: number; injured: boolean }[];
  rules: string[];
  loot: string[];
  summary: string;
}
export interface MainLink {
  card(): Promise<CardView | null>;
  /** 사용자가 「보고서 붙이기」를 눌렀을 때만 부른다. 돌려준 글은 안내로 보여 준다. */
  report(p: ReportPayload): Promise<string>;
}

/** 명부의 이름·사진을 게임 요원 카드에 쓴다 (22.1). 영문 이름이나 한글 이름으로 맞춘다. */
export function rosterFor(card: CardView | null, id: AgentId): CardAgent | null {
  if (!card) return null;
  const a = AGENT_BY_ID[id];
  const en = id === 'eileen' ? 'aileen' : id;
  return card.agents.find((x) => x.name === a.name || (x.english ?? '').toLowerCase().startsWith(en)) ?? null;
}
/** 상황판에 지금 떠 있는 괴이 이름들 (임무 게시판 「본편 연계」 표시용) */
export const boardNames = (card: CardView | null) => (card?.events ?? []).filter((e) => !e.state || /활성|진행|출현/.test(e.state)).map((e) => e.name);

export function reportPayload(s: HqSave): ReportPayload | null {
  const l = s.last;
  if (!l) return null;
  const a = AGENT_BY_ID[l.agent];
  return {
    mission: MISSION_BY_ID[l.mission]?.title ?? l.mission,
    outcome: l.how,
    depth: l.result.depth,
    agents: [{ id: a.id, name: a.name, hp: l.how === 'evac' ? 0 : 1, injured: s.agents[l.agent].injured > 0 }],
    rules: l.result.found,
    loot: l.result.bag.filter(Boolean).map((b) => b!.name),
    summary: reportText(s),
  };
}
