// 대본의 `> line 묶음:키` 와 `> agent 태그` 가 찾는 곳.
import type { AgentId, Flags } from '../types';
import { agentLine } from './agents';
import { BOARD_BY_FAVOR, CALLS, ELEVATOR, FAVOR_LINES, TYPE_HINTS, announce } from './elevator';
import type { FloorType } from '../../graybox/data';

const pick = <T>(list: readonly T[] | undefined, rng: () => number): T | undefined => (list?.length ? list[Math.floor(rng() * list.length) % list.length] : undefined);

export function lookupLine(agent: AgentId, tag: string, flags: Flags, rng: () => number): string | undefined {
  if (!tag.startsWith('el:')) return agentLine(agent, tag, rng);
  const key = tag.slice(3);
  const favor = Math.max(-3, Math.min(3, Number(flags.favor) || 0));
  switch (key) {
    case 'board':
      return pick(BOARD_BY_FAVOR[String(favor)], rng);
    case 'call': {
      // 같은 요원에게는 3줄을 차례로 쓴다 (다 쓰면 처음부터).
      const k = `calls.${agent}`;
      const n = Number(flags[k]) || 0;
      flags[k] = n + 1;
      return CALLS[agent][n % CALLS[agent].length];
    }
    case 'favor_high':
      return pick(FAVOR_LINES[agent].high, rng);
    case 'favor_low':
      return pick(FAVOR_LINES[agent].low, rng);
    case 'announce':
      return announce(Number(flags.depth) || 1, rng);
    case 'hint': {
      const list = TYPE_HINTS[(flags.ftype as FloorType) || 'lobby'];
      return favor >= 2 ? list?.[0] : pick(list, rng);
    }
    default:
      return pick((ELEVATOR as Record<string, string[]>)[key], rng);
  }
}
