// 엔진 사건 → 요원 말풍선. 너무 자주 말하지 않게 간격·확률·우선순위를 둔다. 화면과 무관한 순수 로직.
import type { AgentId } from './types';
import { agentLine, type AgentTag } from './lines/agents';

interface Rule {
  tag: AgentTag;
  /** 말할 확률 0~1 */
  chance: number;
  /** 높을수록 간격 제한을 덜 받는다 (3 이상은 짧은 간격만) */
  prio: number;
  /** 같은 태그 재사용 간격(초) */
  cool?: number;
}

/** 엔진·층 모듈 사건 이름 → 태그. 전투 스레드 이름(enter:floor, combat:clear, run:end)도 받는다. */
export const EVENT_RULES: Record<string, Rule> = {
  'combat:start': { tag: 'combat', chance: 1, prio: 2 },
  'combat:boss': { tag: 'boss', chance: 1, prio: 3 },
  'combat:kill': { tag: 'kill', chance: 0.22, prio: 0 },
  'combat:clear': { tag: 'kill', chance: 0.6, prio: 1 },
  'combat:combo': { tag: 'combo', chance: 0.5, prio: 1 },
  'combat:dodge': { tag: 'dodge', chance: 0.3, prio: 0 },
  'combat:ult': { tag: 'ult', chance: 1, prio: 4, cool: 2 },
  'combat:guardbreak': { tag: 'guardbreak', chance: 0.8, prio: 2 },
  'ammo:low': { tag: 'ammo_low', chance: 1, prio: 2, cool: 20 },
  'ammo:empty': { tag: 'ammo_empty', chance: 1, prio: 3, cool: 20 },
  'weapon:pickup': { tag: 'weapon', chance: 0.7, prio: 1 },
  'item:use': { tag: 'item', chance: 0.45, prio: 1 },
  'hp:low': { tag: 'hp_low', chance: 1, prio: 3, cool: 25 },
  'find:rule': { tag: 'find', chance: 1, prio: 3, cool: 3 },
  'find:item': { tag: 'find_item', chance: 0.8, prio: 2 },
  'rule:break': { tag: 'rule_break', chance: 1, prio: 3, cool: 4 },
  'intrude:fake': { tag: 'intrude_fake', chance: 1, prio: 4 },
  'intrude:daydream': { tag: 'intrude_daydream', chance: 1, prio: 4 },
  rescue: { tag: 'rescue', chance: 1, prio: 3 },
  win: { tag: 'win', chance: 1, prio: 4 },
  'floor:enter': { tag: 'floor', chance: 0.8, prio: 2 },
  'enter:floor': { tag: 'floor', chance: 0.8, prio: 2 },
  'attic:enter': { tag: 'attic', chance: 1, prio: 2 },
  down: { tag: 'down', chance: 1, prio: 4 },
  revive: { tag: 'evac', chance: 1, prio: 4 },
};
// 엔진 GameEvent 이름(docs/게임_모듈_연결.md 5장)도 같은 규칙으로 받는다
const ALIAS: Record<string, string> = {
  enemyDie: 'combat:kill',
  evade: 'combat:dodge',
  super: 'combat:ult',
  guardBreak: 'combat:guardbreak',
  empty: 'ammo:empty',
  pickup: 'weapon:pickup',
  item: 'item:use',
  ruleFound: 'find:rule',
};
for (const [k, v] of Object.entries(ALIAS)) EVENT_RULES[k] = EVENT_RULES[v];

export class BarkPicker {
  private last = -1e9;
  private lastTag = new Map<string, number>();
  /** 기본 간격(초) */
  gap = 3.5;
  /** 같은 태그 기본 재사용 간격(초) */
  tagCool = 10;
  /** 확률·태그별 간격 무시 (시연판) */
  always = false;
  constructor(private rng: () => number = Math.random) {}

  /** now: 초. 말할 게 있으면 {tag, text} */
  pick(event: string, agent: AgentId, now: number): { tag: AgentTag; text: string } | null {
    const r = EVENT_RULES[event];
    if (!r) return null;
    const gap = r.prio >= 3 ? Math.min(1.2, this.gap) : this.gap;
    if (now - this.last < gap) return null;
    if (!this.always && now - (this.lastTag.get(r.tag) ?? -1e9) < (r.cool ?? this.tagCool)) return null;
    if (!this.always && this.rng() >= r.chance) return null;
    const text = agentLine(agent, r.tag, this.rng);
    if (!text) return null;
    this.last = now;
    this.lastTag.set(r.tag, now);
    return { tag: r.tag, text };
  }
}
