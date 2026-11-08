// 대전 서바이벌 (11-08 사용자): 웨이브로 몰려오는 상대. 판을 끊지 않고 한 무대에서 계속, 내가 쓰러지면 끝.
// - 5웨이브 한 묶음을 되풀이: 1~4 = 졸개(NPC), 5 = 대장(이름 있는 인물). 첫 대장만 혼자, 그다음 대장은 졸개 2명과 함께
// - 졸개 수: 묶음마다 하나씩 늘어 최대 6명. 화면에 동시에 나와 있는 건 최대 6명(사용자 결정), 때리는 건 공격 무게 2까지(Squad)
// - 묶음마다 상대 체력·공격력 +10% (3묶음째부터 그대로)
// - 회복: 웨이브를 넘길 때 10%, 대장을 잡으면 30%
// - 쓰러진 상대는 3초 누워 있다가 1.2초 깜빡이고 사라진다 (본문을 가리지 않게)
import { charArt, charRoster, loadChar } from '../art/charPacks';
import { Squad } from '../../combat/brain';
import { versus } from './versus';
import type { Body } from './contract';

export const SURV = {
  /** 화면에 동시에 나와 있는 상대 */
  onScreen: 6,
  /** 동시 공격 무게 (약공 1·강공 2) */
  attackWeight: 2,
  /** 졸개 최대 수 */
  maxMinions: 6,
  /** 묶음마다 세지는 비율, 몇 묶음까지 */
  tierStep: 0.1,
  tierMax: 3,
  healWave: 0.1,
  healBoss: 0.3,
  /** 다음 상대가 나오는 간격 (초) */
  spawnGap: 0.6,
  /** 웨이브 사이 쉬는 시간 (초) */
  rest: 1.6,
  /** 시체: 누워 있는 초, 깜빡이는 초 */
  lie: 3,
  blink: 1.2,
};

/** 웨이브 n (1부터) 의 구성 */
export function waveOf(n: number): { boss: boolean; minions: number; tier: number } {
  const c = Math.floor((n - 1) / 5), pos = ((n - 1) % 5) + 1;
  const tier = Math.min(c, SURV.tierMax);
  if (pos === 5) return { boss: true, minions: c === 0 ? 0 : 2, tier };
  return { boss: false, minions: Math.min(SURV.maxMinions, 2 + c + (pos >= 3 ? 1 : 0)), tier };
}

type Foe = Body & { hp: number; hpMax: number; alive: boolean; dmgMul?: number; vsHpMul?: number; vsBoss?: boolean; vsDeadT?: number; vsBlink?: boolean; dir?: number };

export const surv = {
  wave: 0,
  /** 이번 웨이브에 아직 안 나온 상대 */
  queue: [] as { name: string; boss: boolean }[],
  /** 다음 웨이브까지 남은 초 (0 이면 진행 중) */
  restT: 0,
  spawnT: 0,
  /** 웨이브 알림 남은 초 */
  bannerT: 0,
  /** 이번 웨이브 체력·공격 배수 */
  mul: 1,
  squad: new Squad(SURV.attackWeight),
  side: 0,
};

export function resetSurvival(): void {
  surv.wave = 0; surv.queue = []; surv.restT = 0.4; surv.spawnT = 0; surv.bannerT = 0; surv.mul = 1; surv.side = 0;
  surv.squad = new Squad(SURV.attackWeight);
  versus.kills = 0;
}

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function startWave(): void {
  surv.wave++;
  const w = waveOf(surv.wave);
  surv.mul = 1 + SURV.tierStep * w.tier;
  const me = versus.team[0][0];
  const rows = charRoster().filter((r) => r.name !== me);
  const npcs = rows.filter((r) => r.npc).map((r) => r.name);
  const named = rows.filter((r) => !r.npc).map((r) => r.name);
  surv.queue = [];
  if (w.boss && named.length) surv.queue.push({ name: pick(named), boss: true });
  for (let i = 0; i < w.minions && npcs.length; i++) surv.queue.push({ name: pick(npcs), boss: false });
  // 데이터는 미리 받아 두었다: 그림만 풀어 둔다
  for (const q of surv.queue) void loadChar(q.name);
  surv.bannerT = 1.6;
  surv.spawnT = 0.5;
}

/**
 * 매 틱 (투명 무대 hooks 에서, 서바이벌일 때만). 돌려주는 값 없음: 끝 판정(내가 쓰러짐)은 game.ts 가 한다
 * spawn = 엔진 몸 만들기, player = 주인공 몸
 */
export function survivalTick(dt: number, bodies: readonly Body[], player: Body & { hp: number; hpMax: number }, spawn: (spec: Record<string, unknown>) => Body | undefined, line: number, width: number): void {
  surv.bannerT = Math.max(0, surv.bannerT - dt);
  const foes = bodies.filter((b) => b.team === 'enemy') as Foe[];
  // 쓰러진 상대: 처음 쓰러질 때 수를 세고, 대장이면 크게 회복. 누워 있다 깜빡이고 사라진다
  for (const f of foes) {
    if (f.hp > 0 && f.alive) continue;
    if (f.vsDeadT == null) {
      f.vsDeadT = 0;
      versus.kills++;
      if (f.vsBoss && player.hp > 0) player.hp = Math.min(player.hpMax, player.hp + player.hpMax * SURV.healBoss);
    }
    f.vsDeadT += dt;
    if (f.vsDeadT > SURV.lie) f.vsBlink = Math.floor((f.vsDeadT - SURV.lie) * 10) % 2 === 0;
    if (f.vsDeadT > SURV.lie + SURV.blink) f.alive = false;
  }
  if (player.hp <= 0) return;
  const living = foes.filter((f) => f.alive && f.hp > 0);
  // 웨이브 끝 → 쉬었다 다음
  if (surv.wave > 0 && !surv.queue.length && !living.length && surv.restT <= 0) {
    surv.restT = SURV.rest;
    player.hp = Math.min(player.hpMax, player.hp + player.hpMax * SURV.healWave);
  }
  if (surv.restT > 0) {
    surv.restT -= dt;
    if (surv.restT <= 0) startWave();
    return;
  }
  // 나오기: 화면 한도 안에서, 그림이 풀린 인물부터, 양쪽 끝에서 번갈아
  surv.spawnT -= dt;
  if (surv.spawnT > 0 || !surv.queue.length || living.length >= SURV.onScreen) return;
  const i = surv.queue.findIndex((q) => !!charArt(q.name));
  if (i < 0) return;
  const q = surv.queue.splice(i, 1)[0];
  surv.side ^= 1;
  const x = surv.side ? width - 80 : 80;
  const b = spawn({ kind: `ai-char:${q.name}`, x, y: line, grade: q.boss ? 'B' : 'D', squad: surv.squad }) as Foe | undefined;
  if (b) {
    b.vsBoss = q.boss;
    // 졸개는 대전 체력 3배를 받지 않는다. 묶음 배수는 둘 다
    b.vsHpMul = (q.boss ? 3 : 1) * surv.mul;
    b.dmgMul = (b.dmgMul ?? 1) * surv.mul;
    b.dir = x > player.x ? -1 : 1;
  }
  surv.spawnT = SURV.spawnGap;
}
