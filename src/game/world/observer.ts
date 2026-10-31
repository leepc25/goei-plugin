// 세계 관찰 창 글 (docs/필드_세계_NPC_설계.md 15장 개발 도구). 화면은 hub가 그린다.
import type { FieldClock } from './clock';
import type { Actor, WorldSim } from './actors';
import { NEEDS } from './needs';
import { profileOf } from './mobs';

const NEED_KO: Record<string, string> = { work: '업무', hunger: '허기', energy: '피로', bladder: '소', bowel: '대', social: '사교', fun: '휴식' };
const needLine = (a: Actor) => (a.needs ? '  ' + NEEDS.map((n) => `${NEED_KO[n]}${Math.round(a.needs![n])}`).join(' ') : '');
const temperLine = (a: Actor) => (a.temper ? `  용${a.temper.courage.toFixed(1)} 호${a.temper.curious.toFixed(1)} 급${a.temper.haste.toFixed(1)}${a.temper.sly > 0.3 ? ' 손버릇' : ''}${a.drunk ? ' 취함' : ''}` : '');

export function observerLines(sim: WorldSim, clock: FieldClock, scene: string, seed: number): string[] {
  const here = sim.inScene(scene);
  const lvl = sim.uproarLevel(scene);
  const out = [
    `[세계 관찰] 시각 ${clock.text()} · 씨앗 ${seed} · 생활 ${Math.floor(sim.time)}초 · 행위자 ${sim.actors.length}`,
    `— 이 장면 (${sim.graph.scene(scene)?.name ?? scene}) ${here.length}명 · 소란도 ${lvl} (${Math.round(sim.uproarValue(scene))}) —`,
  ];
  for (const a of here.slice(0, 14)) {
    const mark = a.def.kind === 'named' ? '●' : a.post ? '◆' : '·';
    const pf = a.def.kind === 'mob' ? profileOf(a.def.look) : null;   // 그림 신상: 성별·나이대·직업
    out.push(`${mark} ${a.def.name}${pf ? `(${pf.sex}·${pf.age}${pf.job && pf.job !== a.def.name ? `·${pf.job}` : ''})` : ''}  ${a.doing}${a.def.kind === 'named' ? needLine(a) : temperLine(a)}${a.perks?.length ? `  [${a.perks.join('·')}]` : ''}`);   // NPC 퍽
  }
  if (here.length > 14) out.push(`  … 외 ${here.length - 14}명`);
  const named = sim.actors.filter((a) => a.def.kind === 'named' && a.scene !== scene);
  if (named.length) out.push('— 다른 장면 —');
  for (const a of named) out.push(`● ${a.def.name}  ${sim.graph.scene(a.scene)?.name ?? a.scene}  ${a.doing}`);
  const mobs = new Map<string, number>();
  for (const a of sim.actors) if (a.def.kind === 'mob' && a.scene !== scene) mobs.set(a.scene, (mobs.get(a.scene) ?? 0) + 1);
  for (const [s, n] of mobs) out.push(`· ${sim.graph.scene(s)?.name ?? s} 몹 ${n}${sim.uproarLevel(s) ? ` 소란${sim.uproarLevel(s)}` : ''}`);
  return out;
}
