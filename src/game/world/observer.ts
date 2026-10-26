// 세계 관찰 창 글 (docs/필드_세계_NPC_설계.md 15장 개발 도구). 화면은 hub가 그린다.
import type { FieldClock } from './clock';
import type { WorldSim } from './actors';

export function observerLines(sim: WorldSim, clock: FieldClock, scene: string, seed: number): string[] {
  const here = sim.inScene(scene);
  const out = [`[세계 관찰] 시각 ${clock.text()} · 씨앗 ${seed} · 생활 ${Math.floor(sim.time)}초 · 행위자 ${sim.actors.length}`, `— 이 장면 (${sim.graph.scene(scene)?.name ?? scene}) ${here.length}명 —`];
  for (const a of here) out.push(`${a.def.kind === 'named' ? '●' : '·'} ${a.def.name}  ${a.doing}  x${Math.round(a.x)}`);
  const named = sim.actors.filter((a) => a.def.kind === 'named' && a.scene !== scene);
  if (named.length) out.push('— 다른 장면 —');
  for (const a of named) out.push(`● ${a.def.name}  ${sim.graph.scene(a.scene)?.name ?? a.scene}  ${a.doing}`);
  const mobs = new Map<string, number>();
  for (const a of sim.actors) if (a.def.kind === 'mob' && a.scene !== scene) mobs.set(a.scene, (mobs.get(a.scene) ?? 0) + 1);
  for (const [s, n] of mobs) out.push(`· ${sim.graph.scene(s)?.name ?? s} 몹 ${n}`);
  return out;
}
