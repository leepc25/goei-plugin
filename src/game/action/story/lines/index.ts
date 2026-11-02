// 대본의 `> agent 태그` 가 찾는 곳. 옛 승강기 줄(el:)은 2026-10-28에 지웠다.
import type { AgentId, Flags } from '../types';
import { agentLine } from './agents';

export function lookupLine(agent: AgentId, tag: string, _flags: Flags, rng: () => number): string | undefined {
  return agentLine(agent, tag, rng);
}
