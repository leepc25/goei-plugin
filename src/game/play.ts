// 플러그인 창에서 돌릴 게임. 엔진(게임 전투와 조작, src/game/action/main.ts의 mountGame)이 들어오기 전까지는
// 회색 상자 시험판(차원 승강기)을 다리에 맞춰 붙인다. 엔진이 들어오면 이 파일만 그쪽 mountGame으로 바꾼다.
import type { GameBridge } from './bridge';
import { mountGraybox } from './action/graybox';
import { AGENTS, MISSIONS, RULE_BY_ID, depthLabel } from './action/graybox/data';

const SCHEMA = 'goei-graybox/1';

export function mountPlay(box: HTMLElement, bridge: GameBridge): () => void {
  const slot = bridge.slot;
  return mountGraybox(box, {
    load: () => bridge.saves.read(slot),
    save: (data) => {
      let title = '회색 상자';
      let summary = '';
      try {
        const v = JSON.parse(data) as { meta?: { runs?: number; deepest?: number; rulebook?: unknown[]; currencies?: { budget?: number } }; run?: { agent?: string } };
        const agent = AGENTS.find((a) => a.id === v.run?.agent)?.name ?? '';
        title = `출동 ${v.meta?.runs ?? 0}회${agent ? ` · ${agent}` : ''}`;
        summary = `예산 ${v.meta?.currencies?.budget ?? 0} · 규칙서 ${v.meta?.rulebook?.length ?? 0}줄 · 최저 ${v.meta?.deepest ? depthLabel(v.meta.deepest) : '—'}`;
      } catch {
        /* 요약 없이 저장 */
      }
      return bridge.saves.write(slot, data, { title, summary, schema: SCHEMA });
    },
    narrow: bridge.narrow,
    toLocal: (x, y, el) => bridge.viewport.toLocal(x, y, el),
    onSettle: (run, meta, lines) => {
      const m = MISSIONS.find((x) => x.id === run.mission);
      const agent = AGENTS.find((a) => a.id === run.agent);
      bridge.report({
        id: `gb-${run.seed}-${meta.runs}`,
        mission: m ? `${m.kind}: ${m.title}` : '차원 승강기 출동',
        outcome: run.ended === 'evac' ? 'evac' : 'return',
        depth: depthLabel(Math.max(1, run.depth)),
        agents: agent ? [{ id: agent.id, name: agent.name, hp: Math.max(0, Math.round(run.player.hp)) }] : [],
        rules: run.found.map((id) => RULE_BY_ID[id]?.text ?? id),
        loot: Object.entries(run.loot)
          .filter(([, n]) => n > 0)
          .map(([k, n]) => `${({ cash: '현금', budget: '예산', research: '연구 자료', teeth: '이빨' } as Record<string, string>)[k] ?? k} ${n}`),
        summary: lines.slice(0, 2).join(' '),
      });
    },
  });
}
