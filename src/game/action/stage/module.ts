// 차원 승강기 StageModule (docs/게임_모듈_연결.md 3장). 엔진이 부르는 것은 firstFloor·nextFloor·tick·onInteract·onEvent 다섯뿐이다.
// 층 tick이 하는 일: 지형(구덩이·단·낮은 천장·좁은 길) 판정, 유형별 규칙(침묵 소리·어둠 빛·추격 벽·퍼즐 조임·재현 주민·시험 목표),
// 정비 구역 체류 시간과 포식자, 승강기 총애. 적·수호자의 몸과 행동은 적 모듈이 kind로 만든다(여기는 spawn만).
import type { FloorPlan, GameEvent, PropSpec, RunConfigCore, StageApi, StageModule } from '../engine/contract';
import { B12, FLOOR_TYPES, depthLabel } from './data/floortypes';
import { RULE, ruleText } from './data/rules';
import { CLOSE_SPAM_LINE, LONELY_LINE, MUTTER, STUCK_LINE, announce, defaultCallout, dealTruth, elevatorButtons, greetLine, type ElevatorButton, type ElevatorLines } from './elevator';
import { makeFloor, pickSub, pickType } from './gen/floor';
import { cellAt, makeService } from './gen/service';
import { CHOICE_LABEL, PASSENGER_LABEL, defaultTalk, type PassengerChoice, type PassengerKind, type PassengerLines } from './passengers';
import { carPlan, cellPlan, endingPlan, floorPlan, segAt, type StagePlan } from './plan';
import { mix, rng } from './rng';
import { addFavor, currentKnown, exitOpen, newMeta, newOuting, reshuffle, ruleVersion, sendFound, type Outing, type StageMeta, type Target } from './state';
import { LANE_DEPTH, ROOM_W, Y_BOTTOM, Y_TOP, laneY, type Placed, type SpawnHook, type Terrain } from './types';

const DT = 1 / 30;

export interface StageStore {
  load(): StageMeta | null;
  save(meta: StageMeta): void;
}
/** 승강기에 탈 때 대사 모듈에 넘기는 값 */
export interface BoardInfo {
  /** 지금 깊이(1~) */
  depth: number;
  /** 방금 내린 층 유형 (첫 탑승이면 '') */
  ftype: string;
  favor: number;
  agent: string;
  /** 이번 출동 몇 번째 탑승인지 (1부터) */
  ride: number;
  /** 총애가 낮아 문이 안 닫히는 초 (0이면 아님) */
  stuck: number;
  /** 이번 출동 변형: 인사하면 깎임 / 닫힘 한 번만 눌러도 깎임 */
  greetFlip: boolean;
  closeAny: boolean;
}
/** greet = 인사, spam = 닫힘 연타, quiet = 가만히. favor를 주면 그 값을 쓰고(이전 값 ±1로 자름), 안 주면 층 모듈이 굴린다 */
export interface BoardResult {
  act: 'greet' | 'spam' | 'quiet';
  favor?: number;
}
export interface PassengerInfo {
  kind: PassengerKind;
  honest: boolean;
  /** 사연이 긴 쪽 (규칙 8의 단서) */
  long: boolean;
  /** 이 층에 갈림길 문이 있음 (승객이 문을 가리킬 수 있음) */
  fork: boolean;
  /** 규칙서에 승객 규칙이 있음 */
  knowsRule: boolean;
  agent: string;
  depth: number;
}
/** follow = 승객이 가리킨 문 표시, help = 돕기(구조·보급), ignore = 지나침, rob = 뺏기 */
export interface PassengerResult {
  choice: PassengerChoice | 'follow';
}
export interface DealInfo {
  favor: number;
  items: string[];
}
export interface StageHooks {
  /** 승강기 안에 들어설 때. true를 돌려주면 대사 모듈이 인사·호명·방송을 맡고 끝나면 done을 부른다. false·없음이면 층 모듈 기본(소품 E) */
  board?(v: BoardInfo, done: (r: BoardResult) => void): boolean;
  /** 승객과 말할 때(E). true면 대사 모듈이 대화·선택지를 맡는다 */
  meetPassenger?(v: PassengerInfo, done: (r: PassengerResult) => void): boolean;
  /** 정비 구역 인터폰 거래. deal null = 안 함 */
  deal?(v: DealInfo, done: (r: { deal: 'reveal' | 'skip' | 'supply' | null }) => void): boolean;
  /** 거울(E). off = 내려서 다시 탄다(승강기 안일 때) */
  mirror?(v: { tired: boolean; inCar: boolean; agent: string }, done: (r: { off: boolean }) => void): boolean;
  /** 층 도착 방송. true면 대사 모듈이 말한 것 */
  announce?(v: { depth: number; type: string; label: string; hint: string; first: boolean; agent: string }): boolean;
  /** 대사만 바꿔 끼우기 (효과는 층 모듈이 정한다). story/hooks.ts stageHooks()가 쓰는 모양 */
  elevator?: ElevatorLines;
  passenger?: PassengerLines;
  /** 출동 기록 한 줄 (시험 로그용) */
  log?(line: string): void;
}


/** 층 하나가 열려 있는 동안의 규칙 상태 */
interface Runtime {
  plan: StagePlan;
  t: number;
  prevX: number;
  prevY: number;
  safeX: number;
  stillT: number;
  noise: number;
  light: number;
  summonCd: number;
  stalkCd: number;
  chaseX: number;
  chaseSlow: number;
  backT: number;
  surge: number;
  squeeze: number;
  squeezeMax: number;
  switchSeq: Record<string, number[]>;
  opened: Set<string>;
  greeted: Set<string>;
  woke: Set<string>;
  mealOk: Set<string>;
  spawned: Set<number>;
  talked: Set<string>;
  choices: Map<string, { hook: SpawnHook; choice: PassengerChoice | 'deal'; deal?: 'reveal' | 'skip' | 'supply' }>;
  kills: number;
  enemyTotal: number;
  trial: { on: boolean; read: boolean; t: number; found: number; done: boolean; failed: boolean; stopT: number } | null;
  guardianSpawned: boolean;
  guardianSkip: boolean;
  predator: boolean;
  rested: boolean;
  sentHere: boolean;
  warned: Set<string>;
  hurtCd: number;
  red: boolean;
}

export interface ElevatorStage extends StageModule {
  meta(): StageMeta;
  outing(): Outing | null;
  /** 시연판: 규칙서·총애·깊이 기록을 채워 EXIT를 바로 시험 */
  debugFillExit(): void;
  resetMeta(): void;
}

export function createElevatorStage(store: StageStore, hooks: StageHooks = {}): ElevatorStage {
  let meta: StageMeta = store.load() ?? newMeta();
  let out: Outing | null = null;
  let rt: Runtime | null = null;
  let planN = 0;
  const save = () => store.save(meta);
  const log = (s: string) => {
    out?.log.push(s);
    hooks.log?.(s);
  };

  const newRt = (plan: StagePlan): Runtime => ({
    plan,
    t: 0,
    prevX: plan.startX,
    prevY: 590,
    safeX: plan.startX,
    stillT: 0,
    noise: 0,
    light: plan.type === 'dark' ? 1 : plan.type === 'deep' ? 0.08 : 1,
    summonCd: 0,
    stalkCd: 0,
    chaseX: plan.type === 'chase' ? plan.startX - 400 : -9999,
    chaseSlow: 0,
    backT: 0,
    surge: 0,
    squeeze: plan.stage.floor?.tuning.squeeze ?? 0,
    squeezeMax: plan.stage.floor?.tuning.squeeze ?? 0,
    switchSeq: {},
    opened: new Set(),
    greeted: new Set(),
    woke: new Set(),
    mealOk: new Set(),
    spawned: new Set(),
    talked: new Set(),
    choices: new Map(),
    kills: 0,
    enemyTotal: plan.encounters.reduce((n, e) => n + e.waves.reduce((m, w) => m + w.filter((s) => !s.boss).length, 0), 0) + (plan.stage.floor?.spawns.filter((s) => s.role === 'enemy' && !s.data.harmless && plan.type === 'chase').length ?? 0),
    trial: plan.stage.floor?.goal ? { on: !meta || !out?.flags.includes('trial_mid'), read: false, t: plan.stage.floor.goal.time, found: 0, done: false, failed: false, stopT: 0 } : null,
    guardianSpawned: false,
    guardianSkip: false,
    predator: false,
    rested: false,
    sentHere: false,
    warned: new Set(),
    hurtCd: 0,
    red: false,
  });

  // 대사 모듈이 대화를 마치고 돌려준 결과는 다음 tick에, 아직 같은 층일 때만 적용한다
  let later: { plan: string; run: (api: StageApi) => void }[] = [];
  const defer =
    <R>(run: (api: StageApi, r: R) => void) =>
    (res: R) => {
      const plan = rt?.plan.id;
      if (plan) later.push({ plan, run: (api) => run(api, res) });
    };

  const placedOf = (prop: PropSpec): Placed | undefined => (prop.id.startsWith('p') ? rt?.plan.stage.floor?.placed.find((p) => `p${p.id}` === prop.id) : undefined);
  const hookOf = (id: string): SpawnHook | undefined => (id.startsWith('h') ? rt?.plan.stage.floor?.spawns.find((s) => `h${s.id}` === id) : undefined);

  const foundRule = (api: StageApi, id: string, x: number) => {
    if (!out || !RULE[id]) return;
    const text = ruleText(id, ruleVersion(meta, id));
    const already = meta.known[id] === ruleVersion(meta, id) || out.found.includes(id);
    api.world.say(`규칙: ${text}${out.variants.includes(id) ? `\n${RULE[id].variant!.text}` : ''}`, 4);
    if (!already) {
      out.found.push(id);
      api.world.emit({ type: 'ruleFound', x, id });
      log(`규칙 발견 (미송신): ${text}`);
      api.note('stage.found', [...out.found]);
    }
  };

  // ── 층 만들기
  const buildFloorPlan = (t: Extract<Target, { to: 'floor' }>): StagePlan => {
    const o = out!;
    const f = makeFloor({ seed: o.seed, depth: t.depth, type: t.type, sub: t.sub, danger: o.danger, growth: o.growth, flags: o.flags, epoch: meta.epoch, exitOpen: t.depth === 1 && exitOpen(meta), tired: o.tired });
    o.depth = t.depth;
    o.where = 'floor';
    o.floor = f;
    o.tired = false;
    if (!o.visited.some((v) => v.depth === t.depth)) o.visited.push({ depth: t.depth, type: t.type });
    if (o.lastTypes[o.lastTypes.length - 1] !== t.type || o.lastTypes.length === 0) o.lastTypes.push(t.type);
    if (t.depth > meta.deepest) meta.deepest = t.depth;
    meta.bestFloors = Math.max(meta.bestFloors, o.visited.length);
    save();
    log(`${f.label} 도착 · 조각 ${f.segments.length - 2 - (f.guardian ? 1 : 0)}개 · 폭 ${f.width}px${f.fallback ? ` · 고정 배치 ${f.fallback}` : ''}${f.guardian ? ` · 수호자 ${FLOOR_TYPES[f.type].guardians.find((g) => g.kind === f.guardian)?.label ?? f.guardian}` : ''}`);
    return floorPlan(f, `floor:${t.depth}:${++planN}`, t.startX ?? 240);
  };

  const buildCell = (t: Extract<Target, { to: 'service' }>): StagePlan => {
    const o = out!;
    const z = o.service!;
    o.cell = [t.col, t.row];
    o.where = 'service';
    const cell = cellAt(z, t.col, t.row);
    const startX = t.side === 'l' ? 120 : t.side === 'r' ? ROOM_W - 120 : t.side === 'u' ? 560 : t.side === 'd' ? 720 : 400;
    return cellPlan(z, cell, `service:${z.depth}:${t.col},${t.row}:${++planN}`, startX);
  };

  const enterService = () => {
    const o = out!;
    // 같은 출동 안에서 나갔다 들어오면 다시 짜인다 (다락방·로프·입구·아래 점검문은 그대로)
    const again = o.service && o.serviceDepth === o.depth;
    if (again) o.rerolls++;
    o.service = makeService({ seed: o.seed, depth: o.depth, reroll: again ? o.rerolls : 0, flags: o.flags, epoch: meta.epoch });
    o.serviceDepth = o.depth;
    o.serviceTime = 0;
    if (again) log('정비 구역이 다시 짜였다 (다락방·로프 위치는 그대로)');
    return { to: 'service', col: o.service.entryCell[0], row: o.service.entryCell[1], side: 'u' } as Target;
  };

  const buttonsNow = (): ElevatorButton[] => {
    const o = out!;
    return elevatorButtons({ seed: o.seed + o.ride * 17, depth: o.depth, favor: meta.favor, epoch: meta.epoch, last: o.lastTypes, reveal: o.reveal, deepest: meta.deepest, exitOpen: exitOpen(meta) });
  };

  const finishWith = (api: StageApi, t: Target) => {
    out!.pending = t;
    api.finish('next');
  };

  const wake = (api: StageApi, why: string, x: number, radius = 600) => {
    const f = rt?.plan.stage.floor;
    if (!f || !rt) return;
    let n = 0;
    for (const s of f.spawns) {
      const id = `h${s.id}`;
      if ((s.role === 'resident' || (s.role === 'enemy' && s.data.harmless)) && !rt.woke.has(id) && Math.abs(s.x - x) < radius) {
        rt.woke.add(id);
        api.setProp(id, null);
        api.spawn({ kind: s.role === 'resident' ? 'resident' : 'lurker', x: s.x, y: laneY(s.lane) });
        n++;
      }
    }
    if (n) {
      api.world.say(`${why} — ${n}이(가) 깨어났다`, 3);
      api.world.shake(8, 4);
      log(`규칙 위반: ${why}`);
    }
  };

  // ── 지형: 구덩이·단·낮은 천장·좁은 길·붉은 바닥·유리 (층 tick이 맡는다, 엔진은 movePlayer만)
  const terrain = (api: StageApi, terr: Terrain[]) => {
    const r = rt!;
    const p = api.world.player;
    const lane = ((p.y - Y_TOP) / (Y_BOTTOM - Y_TOP)) * LANE_DEPTH;
    let blocked = false;
    for (const t of terr) {
      const inX = p.x > t.x0 && p.x < t.x1;
      const wasIn = r.prevX > t.x0 && r.prevX < t.x1;
      switch (t.kind) {
        case 'pit':
          if (inX && p.z <= 0.5 && !p.airborne) {
            api.hurtPlayer(12, true);
            // 구덩이 앞에서 한 걸음 물러난 자리 (경직 중 제자리 점프로 다시 빠지지 않게)
            r.safeX = r.prevX < t.x0 ? Math.min(r.safeX, t.x0 - 120) : Math.max(r.safeX, t.x1 + 120);
            api.movePlayer(r.safeX);
            api.world.say('떨어졌다. 구덩이는 점프로.', 2);
            api.world.emit({ type: 'down', x: p.x, who: 'player' });
            return;
          }
          break;
        case 'block':
          if (inX && !wasIn && p.z < t.h - 6) blocked = true;
          break;
        case 'low':
          if (inX && !p.crouching) {
            blocked = true;
            if (!r.warned.has('low')) r.warned.add('low'), api.world.say('천장이 낮다. ↓ 앉아서 지나간다.', 2);
          }
          break;
        case 'narrow':
          if (inX && (lane < t.lane0 - 2 || lane > t.lane1 + 2)) {
            if (!wasIn) blocked = true;
            else api.movePlayer(p.x, laneY(Math.max(t.lane0, Math.min(t.lane1, lane))));
          }
          break;
        case 'redfloor':
          if (inX && lane >= t.lane0 && lane <= t.lane1 && p.z <= 0.5 && r.hurtCd <= 0) {
            r.hurtCd = 1.2;
            r.red = true;
            api.hurtPlayer(10);
            foundRule(api, 'r_red', p.x);
            wake(api, '붉은 바닥을 밟았다', p.x, 500);
          }
          break;
        case 'glass':
          if (inX && p.z <= 0.5 && Math.abs(p.x - r.prevX) > 0.5) r.noise += (p.running ? 0.03 : 0.012) * (rt!.plan.stage.floor?.tuning.noiseMul ?? 1);
          break;
      }
    }
    if (blocked) api.movePlayer(r.prevX, p.y);
    else if (!terr.some((t) => t.kind === 'pit' && p.x > t.x0 - 30 && p.x < t.x1 + 30) && p.z <= 0.5) r.safeX = p.x;
  };

  const spawnGuardianNear = (api: StageApi, why: string) => {
    const f = rt!.plan.stage.floor!;
    const g = f.spawns.find((s) => s.role === 'guardian');
    const kind = g?.kind ?? FLOOR_TYPES[f.type].guardians[0]?.kind ?? 'guard';
    const p = api.world.player;
    api.spawn({ kind, x: p.x + (p.dir === 1 ? -420 : 420), y: p.y, boss: true });
    api.world.emit({ type: 'bossRoar', x: p.x, kind });
    api.world.say(`${why}: ${FLOOR_TYPES[f.type].guardians.find((x) => x.kind === kind)?.label ?? kind}`, 3);
    log(`수호자 등장 (${why})`);
  };

  // ── 유형별 규칙
  const floorRules = (api: StageApi) => {
    const r = rt!;
    const plan = r.plan;
    const f = plan.stage.floor!;
    const p = api.world.player;
    const moved = Math.hypot(p.x - r.prevX, p.y - r.prevY) > 0.3;
    r.stillT = moved || p.airborne ? 0 : r.stillT + DT;
    const tune = f.tuning;

    // 침묵 (B-12 포함): 달리기·착지·공격이 소리. 소리가 차면 수호자 소환.
    if (f.type === 'silent' || f.type === 'deep') {
      if (p.running && moved) r.noise += 0.02 * tune.noiseMul;
      r.noise = Math.max(0, r.noise - 0.004);
      api.world.noise = Math.min(1, r.noise);
      r.summonCd -= DT;
      if (r.noise >= 1 && r.summonCd <= 0) {
        r.summonCd = 20;
        r.noise = 0.4;
        foundRule(api, 'silent', p.x);
        if (f.type === 'deep') api.spawn({ kind: 'toucher', x: p.x + 160, y: p.y });
        else spawnGuardianNear(api, '소리가 찼다');
      }
    }
    // 어둠: 빛이 몇 초 만에 사그라든다. 멈추면 체온을 재는 것이 온다.
    if (f.type === 'dark' || f.type === 'deep') {
      if (f.type === 'dark') r.light = Math.max(0.12, r.light - (DT / 9) * tune.lightFade);
      api.world.light = r.light;
      r.stalkCd -= DT;
      if (r.stillT > 1.5 && r.stalkCd <= 0) {
        r.stalkCd = 6;
        api.spawn({ kind: f.type === 'deep' ? 'toucher' : 'warmth', x: p.x + (r.t % 2 < 1 ? -260 : 260), y: p.y });
        api.world.say(f.type === 'deep' ? '무언가가 어깨를 만진다.' : '멈췄다. 누군가 체온을 잰다.', 2.5);
        foundRule(api, 'dark', p.x);
      }
    }
    // 추격: 자동으로 다가오는 벽. 문을 닫으면 느려지고, 뒤돌아보면 빨라진다.
    if (f.type === 'chase') {
      const end = f.segments[f.segments.length - 1].x;
      if (p.x < end - 200 && r.t > 1.2) {
        let v = tune.chaseSpeed * DT;
        if (r.chaseSlow > 0) (v *= 0.35), (r.chaseSlow -= DT);
        if (r.surge > 0) (v *= 1.6), (r.surge -= DT);
        // 너무 멀어지면 따라잡는다 (화면 밖에서 기다리지 않게)
        if (p.x - r.chaseX > 750) v *= 2.5;
        r.chaseX += v;
      }
      if (p.dir === -1 && !p.airborne) r.backT += DT;
      else r.backT = 0;
      if (r.backT > 0.6 && r.surge <= 0) {
        r.surge = 2;
        api.world.say('뒤를 봤다. 그것이 빨라진다.', 2);
        foundRule(api, 'c_back', p.x);
      }
      if (p.x < r.chaseX + 30 && r.hurtCd <= 0) {
        r.hurtCd = 1;
        api.hurtPlayer(18, true);
        api.movePlayer(r.chaseX + 260);
        api.world.shake(10, 6);
      }
      // 추격 층 적은 화면을 잠그지 않고 다가가면 나온다
      for (const s of f.spawns)
        if (s.role === 'enemy' && !r.spawned.has(s.id) && s.x - p.x < 700) {
          r.spawned.add(s.id);
          api.spawn({ kind: s.kind, x: s.x, y: laneY(s.lane), elite: s.elite || undefined });
        }
      plan.stage.fx.chaseX = r.chaseX;
    }
    // 퍼즐: 시간이 다 되면 벽이 조여 온다. 셔터는 정답 문·스위치로만 열린다.
    if (f.type === 'puzzle') {
      r.squeeze -= DT;
      plan.stage.fx.squeeze = r.squeeze < 15 ? Math.min(1, (15 - r.squeeze) / 15) : 0;
      if (r.squeeze < 15 && !r.warned.has('sq')) r.warned.add('sq'), foundRule(api, 'p_wall', p.x);
      if (r.squeeze <= 0 && r.hurtCd <= 0) (r.hurtCd = 1), api.hurtPlayer(6);
    }
    for (const sh of f.placed.filter((x) => x.kind === 'shutter'))
      if (!r.opened.has(`p${sh.id}`) && p.x > sh.x - 26 && r.prevX <= sh.x - 26 + 40) api.movePlayer(Math.min(p.x, sh.x - 30), p.y);
    // 재현: 인사·뛰지 않기·밥상. 빈집은 남의 물건, 붉은 벽은 붉은 바닥(지형).
    if (f.type === 'replica') {
      const nogreet = out!.flags.includes('replica_nogreet');
      for (const s of f.spawns.filter((s) => s.role === 'resident')) {
        const id = `h${s.id}`;
        if (r.woke.has(id)) continue;
        if (!nogreet && !r.greeted.has(id) && p.x > s.x + 60 && r.prevX <= s.x + 60) {
          foundRule(api, 'r_greet', p.x);
          wake(api, '인사 없이 지나갔다', s.x, 200);
        }
        if (p.running && moved && Math.abs(p.x - s.x) < 300) {
          foundRule(api, 'r_quiet', p.x);
          wake(api, '복도에서 뛰었다', s.x, 400);
        }
      }
      for (const tb of f.placed.filter((x) => x.kind === 'table' && !x.data.guardian))
        if (!r.mealOk.has(`p${tb.id}`) && p.x > tb.x + tb.w / 2 + 20 && r.prevX <= tb.x + tb.w / 2 + 20) {
          r.mealOk.add(`p${tb.id}`);
          foundRule(api, 'r_meal', p.x);
          wake(api, '밥상을 그냥 지나쳤다', tb.x, 700);
        }
    }
    // 로비: 평범해 보이는 것에 등을 보이지 마라. 거꾸로 가는 시계 앞에서는 걸어라.
    if (f.type === 'lobby') {
      for (const s of f.spawns.filter((s) => s.role === 'enemy' && s.data.harmless)) {
        const id = `h${s.id}`;
        if (r.woke.has(id)) continue;
        const near = Math.abs(p.x - s.x) < 260;
        const away = (s.x > p.x && p.dir === -1) || (s.x < p.x && p.dir === 1);
        if (near && away) {
          r.backT += DT;
          if (r.backT > 1.4) {
            r.backT = 0;
            foundRule(api, 'lobby', p.x);
            wake(api, '등을 보였다', s.x, 80);
          }
        }
      }
      if (p.running && moved && f.placed.some((x) => x.kind === 'prop' && x.label === '거꾸로 가는 시계' && Math.abs(x.x - p.x) < 240) && r.summonCd <= 0) {
        r.summonCd = 12;
        foundRule(api, 'l_clock', p.x);
        api.spawn({ kind: 'lurker', x: p.x - 300, y: p.y });
        api.world.say('시계 앞에서 뛰었다. 등 뒤가 서늘하다.', 2.5);
      }
      r.summonCd -= DT;
    }
    // 시험 층: 목표·제한 시간. 실패하면 수호자.
    if (r.trial && f.goal) {
      const tr = r.trial;
      const goalX = f.placed.find((x) => x.kind === 'goalwall')!.x;
      if (!tr.on && p.x > goalX) tr.on = true;
      if (tr.on && !tr.done && !tr.failed) {
        tr.t -= DT;
        if (f.goal.kind === 'nostop') {
          tr.stopT = r.stillT;
          if (tr.stopT > 1.2) fail(api, '멈췄다');
          if (p.x > f.segments[f.segments.length - 2].x) succeed(api);
        }
        if (f.goal.kind === 'marks' && tr.found >= f.goal.need) succeed(api);
        if (f.goal.kind === 'clear' && r.kills >= Math.max(1, r.enemyTotal)) succeed(api);
        if (tr.t <= 0) fail(api, '시간 초과');
      }
    }
    // 수호자 방: 405호 노부부는 밥상(「잘 먹었습니다」)으로 넘길 수 있어 층 tick이 직접 부른다
    if (!r.guardianSpawned) {
      const g = f.spawns.find((s) => s.role === 'guardian');
      if (g && (g.kind === 'elder' || g.data.survive)) {
        const room = segAt(f.segments, g.x);
        if (p.x > room.x + 380) {
          r.guardianSpawned = true;
          if (r.guardianSkip) {
            api.world.say('노부부가 고개를 끄덕인다. 「잘 먹었어요?」 …지나가도 된다.', 3.5);
            addFavor(meta, out!, 1, '수호자를 규칙으로 통과');
            save();
          } else if (g.data.survive) {
            for (let k = 0; k < 3; k++) api.spawn({ kind: 'toucher', x: room.x + 400 + k * 260, y: laneY(30 + k * 50) });
            api.world.say('만지는 것들. 멈추지 말고, 소리 내지 말고, 지나가라.', 4);
          } else {
            api.spawn({ kind: g.kind, x: g.x, y: laneY(g.lane), boss: true, elite: g.elite || undefined });
            api.world.emit({ type: 'combat:boss', index: 0 });
          }
        }
      }
    }
    // 떠도는 승객 중 구조 대상은 따라온다 (화면 표시만; 다락방·로프까지 데려가면 구조)
    if (out!.escort && !r.warned.has('esc')) r.warned.add('esc'), api.world.say('회사원이 뒤를 따라온다. 다락방 로프까지 데려가자.', 3);
  };

  const succeed = (api: StageApi) => {
    const tr = rt!.trial!;
    tr.done = true;
    api.heal(40);
    out!.items.push('heal');
    addFavor(meta, out!, 1, '시험 목표 달성');
    save();
    api.world.say('목표 달성. 벽의 글씨가 지워진다. (회복 + 보급품 + 총애 +1)', 4);
    api.note('stage.trial', 'success');
    log('시험 층 목표 달성');
  };
  const fail = (api: StageApi, why: string) => {
    const tr = rt!.trial!;
    tr.failed = true;
    api.note('stage.trial', 'fail');
    foundRule(api, 'trial', api.world.player.x);
    spawnGuardianNear(api, `시험 실패 (${why})`);
  };

  // ── 정비 구역: 체류 시간 → 포식자
  const serviceRules = (api: StageApi) => {
    const r = rt!;
    const o = out!;
    o.serviceTime += DT;
    api.world.light = r.light;
    const lim = o.service!.predatorAfter;
    if (o.serviceTime > lim - 20 && !r.warned.has('pred')) {
      r.warned.add('pred');
      api.world.say('덕트 저편에서 무언가 큰 것이 기어 오는 소리.', 3);
    }
    if (o.serviceTime > lim && !r.predator) {
      r.predator = true;
      const p = api.world.player;
      api.spawn({ kind: 'predator', x: p.x < 640 ? ROOM_W - 80 : 80, y: p.y, boss: true });
      api.world.say('포식자. 여기 오래 있으면 안 됐다.', 3);
      foundRule(api, 'attic', p.x);
      log(`포식자 등장 (정비 구역 ${Math.round(o.serviceTime)}초)`);
    }
  };

  const mod: ElevatorStage = {
    id: 'elevator',
    label: '차원 승강기',
    meta: () => meta,
    outing: () => out,
    debugFillExit() {
      for (const id of ['entry', 'noreturn', 'close', 'greet', 'mirror', 'lobby', 'attic', 'passenger', 'trial', 'dark', 'silent', 'exit']) meta.known[id] = ruleVersion(meta, id);
      meta.favor = 3;
      meta.deepest = Math.max(meta.deepest, B12);
      save();
    },
    resetMeta() {
      meta = newMeta();
      save();
    },

    firstFloor(run: RunConfigCore): FloorPlan {
      out = newOuting(meta, { seed: run.seed, agent: run.agent, danger: run.danger });
      meta.outings++;
      planN = 0;
      const plan = buildFloorPlan({ to: 'floor', depth: 1, type: 'lobby', sub: null });
      rt = newRt(plan);
      log(`출동 ${meta.outings}회째 · 씨앗 ${run.seed}${out.variants.length ? ` · 이번 출동 변형: ${out.variants.map((v) => RULE[v].variant!.text.replace('이번 출동: ', '')).join(' / ')}` : ''}`);
      return plan;
    },

    nextFloor(_run, _prev, how): FloorPlan | null {
      const o = out;
      if (!o) return null;
      if (how === 'withdraw') {
        const sent = sendFound(meta, o);
        save();
        log(o.ending ? '출구로 나왔다.' : `귀환 로프로 돌아왔다. 송신 ${sent.length}줄`);
        rt = null;
        return null;
      }
      const t: Target = o.pending ?? { to: 'floor', depth: o.depth + 1, type: pickType(o.depth + 1, o.lastTypes, o.seed, meta.epoch), sub: null };
      o.pending = null;
      let plan: StagePlan;
      if (t.to === 'car') {
        o.where = 'car';
        o.ride++;
        o.greeted = false;
        o.closeCount = 0;
        o.rideAttack = false;
        o.stuck = meta.favor <= -2 ? 10 : 0;
        plan = carPlan(`car:${++planN}`, buttonsNow(), o.depth);
      } else if (t.to === 'service') plan = buildCell(t);
      else if (t.to === 'ending') {
        o.where = 'ending';
        plan = endingPlan(`ending:${++planN}`);
      } else {
        if (t.type === 'replica' && !t.sub) t.sub = pickSub(o.seed, t.depth, meta.epoch);
        plan = buildFloorPlan(t);
      }
      rt = newRt(plan);
      return plan;
    },

    tick(api: StageApi, floor: FloorPlan) {
      if (!rt || rt.plan.id !== floor.id || !out) return;
      const r = rt;
      const p = api.world.player;
      if (r.t === 0) onEnter(api);
      if (later.length) {
        const now = later.filter((l) => l.plan === r.plan.id);
        later = [];
        for (const l of now) l.run(api);
      }
      r.t += DT;
      r.hurtCd -= DT;
      const where = r.plan.stage.where;
      if (where === 'floor' || where === 'service') terrain(api, r.plan.stage.terrain);
      if (where === 'floor') floorRules(api);
      if (where === 'service') serviceRules(api);
      if (where === 'car' && out.stuck > 0) {
        out.stuck -= DT;
        if (out.stuck <= 0) api.world.say('…문이 닫혔어요.', 2);
      }
      r.plan.stage.fx.light = api.world.light;
      r.plan.stage.fx.noise = api.world.noise;
      r.plan.stage.fx.red = r.red;
      r.prevX = api.world.player.x;
      r.prevY = api.world.player.y;
      void p;
    },

    onEvent(api: StageApi, floor: FloorPlan, e: GameEvent) {
      if (!rt || rt.plan.id !== floor.id || !out) return;
      const f = rt.plan.stage.floor;
      const mul = f?.tuning.noiseMul ?? 1;
      const loud = f && (f.type === 'silent' || f.type === 'deep');
      switch (e.type) {
        case 'land':
          if (loud) rt.noise += 0.12 * mul;
          break;
        case 'hit':
          if (loud) rt.noise += (0.06 + e.strength * 0.04) * mul;
          if (rt.plan.stage.where === 'car' && !out.rideAttack) {
            out.rideAttack = true;
            addFavor(meta, out, -2, '승강기 안에서 공격');
            api.world.say('…여기서 그러지 마요.', 2.5);
            save();
          }
          break;
        case 'shot':
          if (loud) rt.noise += 0.25 * mul;
          break;
        case 'whiff':
          if (loud) rt.noise += 0.03 * mul;
          if (rt.plan.stage.where === 'car' && !out.rideAttack) {
            out.rideAttack = true;
            addFavor(meta, out, -2, '승강기 안에서 공격');
            api.world.say('…여기서 그러지 마요.', 2.5);
            save();
          }
          break;
        case 'enemyDie':
          rt.kills++;
          break;
        case 'item':
          if (e.id === 'light') rt.light = 1;
          break;
      }
    },

    onInteract(api: StageApi, floor: FloorPlan, prop: PropSpec) {
      if (!rt || rt.plan.id !== floor.id || !out) return;
      const o = out;
      const r = rt;
      const p = api.world.player;
      const pl = placedOf(prop);
      // 선택지 (승객·거래)
      const ch = r.choices.get(prop.id);
      if (ch) return resolveChoice(api, prop, ch);
      switch (prop.kind) {
        // ── 층
        case 'elevator':
          if (r.plan.stage.where === 'floor' && prop.label === '타고 온 엘리베이터') {
            api.world.say('문이 열리지 않는다. 패널에는 없던 숫자가 빼곡하다.', 3);
            foundRule(api, 'noreturn', p.x);
          } else api.world.say('패널을 눌러야 탈 수 있다.', 2);
          break;
        case 'panel':
          if (pl?.data.exit) api.world.say('패널에 EXIT 불이 들어와 있다.', 2);
          api.world.emit({ type: 'ding', x: p.x });
          finishWith(api, { to: 'car' });
          break;
        case 'mirror': {
          const tired = rng(mix(o.seed, o.ride, o.depth, 55))() < 0.35;
          foundRule(api, 'mirror', p.x);
          const inCar = r.plan.stage.where === 'car';
          if (inCar) o.tired = tired;
          if (hooks.mirror?.({ tired, inCar, agent: o.agent }, defer<{ off: boolean }>((api, res) => res.off && inCar && finishWith(api, { to: 'car' })))) break;
          if (inCar) {
            if (tired) (o.tired = true), api.world.say('거울 속 얼굴이 피곤해 보인다. (내려서 다시 타면 바뀐다. 그대로 가면 다음 층 위협 +30%)', 4);
            else (o.tired = false), api.world.say('거울 속 얼굴은 괜찮아 보인다.', 2);
          } else api.world.say(tired ? '거울 속 얼굴이 피곤해 보인다.' : '거울 속 얼굴. 나다. 아마도.', 2.5);
          break;
        }
        case 'checklist':
          foundRule(api, 'entry', p.x);
          if (!o.items.includes('checklist')) o.items.push('checklist'), api.world.say('서명란이 빈 점검표를 챙겼다. (회수물)', 2.5);
          break;
        case 'sign':
          if (pl?.data.rule) {
            foundRule(api, String(pl.data.rule), p.x);
            if (pl.data.arrow) api.world.say(`표지: 「${pl.data.arrow}」${o.flags.includes('puzzle_mirror') && o.variants.includes('p_sign') ? '\n(이번 출동 표지는 거울에 비친 것)' : ''}`, 4);
            if (pl.data.order) api.world.say(`순서 표지: ${String(pl.data.order).split('-').map((n) => '①②③④'[Number(n) - 1]).join(' → ')}`, 4);
          }
          break;
        case 'symbol':
          api.world.say(pl?.data.danger ? '동그라미 안에 줄 하나: 이 근처는 위험.' : '빈 동그라미: 이 근처는 쉼터.', 2.5);
          break;
        case 'b12':
          foundRule(api, 'b12', p.x);
          break;
        case 'door':
          if (pl && pl.data.fork !== undefined) {
            const sh = r.plan.stage.floor!.placed.find((x) => x.kind === 'shutter' && x.data.fork === pl.data.fork)!;
            if (r.opened.has(`p${sh.id}`)) break;
            if (pl.data.correct) {
              r.opened.add(`p${sh.id}`);
              api.setProp(`p${sh.id}`, { solid: false, label: '열린 셔터', h: 20 });
              api.movePlayer(sh.x + 80);
              api.world.emit({ type: 'door', x: p.x, id: 'fork-ok' });
              api.world.say('문 너머로 나왔다. 셔터 뒤편이다.', 2.5);
            } else {
              api.hurtPlayer(10, true);
              r.squeeze -= 10;
              const sign = r.plan.stage.floor!.placed.find((x) => x.kind === 'sign' && x.data.fork === pl.data.fork);
              api.movePlayer(sign ? sign.x : p.x - 300);
              api.world.say('함정. 문 너머는 처음 그 복도였다. (벽이 10초 더 조여 온다)', 3);
              foundRule(api, 'p_sign', p.x);
            }
          }
          break;
        case 'switch':
          if (pl?.data.bell) {
            api.world.say('뎅—', 1);
            if (r.plan.stage.floor?.type === 'silent') r.noise += 0.5;
            break;
          }
          if (pl && pl.data.group !== undefined) {
            const g = String(pl.data.group);
            const sh = r.plan.stage.floor!.placed.find((x) => x.kind === 'shutter' && String(x.data.group) === g)!;
            if (r.opened.has(`p${sh.id}`)) break;
            const want = String(sh.data.order).split('-').map(Number);
            const seq = (r.switchSeq[g] ??= []);
            seq.push(Number(pl.data.n));
            api.world.emit({ type: 'door', x: p.x, id: 'switch' });
            if (want[seq.length - 1] !== seq[seq.length - 1]) {
              r.switchSeq[g] = [];
              r.squeeze -= 10;
              api.world.say('틀린 순서. 스위치가 전부 튀어 올라온다. (벽 -10초)', 2.5);
              foundRule(api, 'p_order', p.x);
            } else if (seq.length === want.length) {
              r.opened.add(`p${sh.id}`);
              api.setProp(`p${sh.id}`, { solid: false, label: '열린 셔터', h: 20 });
              api.world.say('셔터가 올라간다.', 2);
            } else api.world.say(`딸깍 (${seq.length}/${want.length})`, 1);
          }
          break;
        case 'hatch':
        case 'servicedoor':
          o.returnX = prop.x;
          api.world.emit({ type: 'door', x: p.x, id: 'service' });
          finishWith(api, enterService());
          break;
        case 'goalwall':
          if (r.trial) {
            r.trial.read = true;
            r.trial.on = true;
            foundRule(api, 'trial', p.x);
            api.world.say(`벽: 「${r.plan.stage.floor!.goal!.text}」`, 4);
          }
          break;
        case 'mark':
          if (r.trial && !r.opened.has(prop.id)) {
            r.opened.add(prop.id);
            r.trial.found++;
            api.setProp(prop.id, null);
            api.world.say(`표식 ${r.trial.found}/${r.plan.stage.floor!.goal!.need}`, 1.5);
          }
          break;
        case 'table':
          r.mealOk.add(prop.id);
          foundRule(api, 'r_meal', p.x);
          api.world.say('「잘 먹었습니다.」', 2);
          if (pl?.data.guardian) r.guardianSkip = true;
          break;
        case 'item':
        case 'pack': {
          const item = String(pl?.data.item ?? r.plan.stage.cell?.things.find((t) => `s${t.id}` === prop.id)?.data.item ?? 'heal');
          api.setProp(prop.id, null);
          o.items.push(item);
          if (item === 'heal') api.heal(25);
          if (item === 'light') r.light = 1;
          api.world.emit({ type: 'pickup', x: p.x, id: item });
          api.world.say(`주웠다: ${itemName(item)}`, 1.5);
          break;
        }
        case 'belonging':
          api.setProp(prop.id, null);
          foundRule(api, 'r_things', p.x);
          for (let k = 0; k < 2; k++) api.spawn({ kind: 'resident', x: p.x + (k ? 300 : -300), y: p.y, elite: true });
          api.world.say('남의 물건에 손을 댔다. 집이 일어난다.', 3);
          r.red = true;
          break;
        case 'chasedoor':
          if (p.x > prop.x + 10 && !r.opened.has(prop.id)) {
            r.opened.add(prop.id);
            r.chaseSlow = 2.5;
            api.setProp(prop.id, { label: '닫힌 방화문' });
            api.world.emit({ type: 'door', x: p.x, id: 'close' });
            api.world.say('문을 닫았다. 뒤의 것이 문을 부수느라 느려진다.', 2);
            foundRule(api, 'c_door', p.x);
          } else if (!r.opened.has(prop.id)) api.world.say('지나간 뒤에 닫아야 한다.', 1.5);
          break;
        case 'npc': {
          const h = hookOf(prop.id);
          if (!h) break;
          if (h.role === 'resident') {
            if (o.flags.includes('replica_nogreet')) {
              foundRule(api, 'r_greet', p.x);
              wake(api, '눈을 마주치고 인사했다 (이번 출동에는 다름)', h.x, 200);
            } else {
              r.greeted.add(prop.id);
              foundRule(api, 'r_greet', p.x);
              api.world.say('「안녕하세요.」 …주민이 고개를 끄덕인다.', 2);
            }
          } else api.world.say('「안녕하세요. 편하게 둘러보세요.」', 2);
          break;
        }
        case 'passenger':
          talkPassenger(api, prop);
          break;
        // ── 정비 구역
        case 'up':
          api.world.emit({ type: 'door', x: p.x, id: 'hatch' });
          finishWith(api, { to: 'floor', depth: o.serviceDepth, type: o.floor!.type, sub: o.floor!.sub, startX: o.returnX });
          break;
        case 'down': {
          const d = o.serviceDepth + 1;
          finishWith(api, { to: 'floor', depth: d, type: pickType(d, o.lastTypes, o.seed, meta.epoch, 888), sub: null, startX: 240 });
          break;
        }
        case 'fall': {
          const d = o.serviceDepth + 2;
          api.hurtPlayer(10, true);
          log('승강로 틈새로 떨어졌다 (깊이 +2)');
          finishWith(api, { to: 'floor', depth: d, type: pickType(d, o.lastTypes, o.seed, meta.epoch, 999), sub: null, startX: 240 });
          break;
        }
        case 'left':
        case 'right':
        case 'ladder_up':
        case 'ladder_down': {
          const [c, rw] = o.cell;
          const t: Target =
            prop.kind === 'left' ? { to: 'service', col: c - 1, row: rw, side: 'r' } : prop.kind === 'right' ? { to: 'service', col: c + 1, row: rw, side: 'l' } : prop.kind === 'ladder_up' ? { to: 'service', col: c, row: rw - 1, side: 'd' } : { to: 'service', col: c, row: rw + 1, side: 'u' };
          if ((prop.kind === 'left' || prop.kind === 'right') && cellAt(o.service!, c, rw).duct[prop.kind === 'left' ? 'l' : 'r'] && !p.crouching) {
            api.world.say('덕트다. ↓ 앉은 채로 E.', 1.5);
            break;
          }
          finishWith(api, t);
          break;
        }
        case 'rope':
          if (o.escort) o.rescued.push(o.escort), addFavor(meta, o, 1, '승객을 구함'), (o.escort = null);
          api.note('stage.rescued', o.rescued);
          api.world.say('귀환 로프를 잡았다. 승강로를 한참 올라간다…', 3);
          sendFound(meta, o);
          save();
          api.finish('withdraw');
          break;
        case 'bed':
          if (r.rested) api.world.say('더 쉬면 위험하다.', 1.5);
          else (r.rested = true), api.heal(999), api.world.say('잠깐 눈을 붙였다. 체력 회복.', 2);
          break;
        case 'intercom':
          if (!r.sentHere) {
            r.sentHere = true;
            const sent = sendFound(meta, o);
            save();
            api.world.say(sent.length ? `송신 완료: 규칙 ${sent.length}줄. 이제 후송돼도 남는다.` : '보낼 단서가 없다. (다시 E = 승강기와 거래)', 3);
            if (o.escort) o.rescued.push(o.escort), addFavor(meta, o, 1, '승객을 구함'), (o.escort = null), api.world.say('회사원을 로프로 먼저 올려 보냈다.', 2.5);
          } else if (o.deals >= 1) api.world.say('인터폰: 「한 번이면 충분하잖아요.」', 2);
          else offerDeal(api, prop);
          break;
        case 'memo':
          foundRule(api, 'attic', p.x);
          if (r.plan.stage.cell?.things.find((t) => `s${t.id}` === prop.id)?.data.writer) api.world.say('메모 옆에 누가 쪼그려 앉아 있다. 「…너도 오래 있지 마.」', 3);
          break;
        case 'map':
          o.reveal = true;
          meta.mapHint = pickType(o.serviceDepth + 1, o.lastTypes, o.seed, meta.epoch, 3);
          save();
          api.world.say(`지도: 다음 승강기 버튼의 층 유형이 보인다. 아래층은 아마 「${FLOOR_TYPES[meta.mapHint].label}」.`, 3.5);
          break;
        case 'gear':
          api.setProp(prop.id, null);
          o.items.push('gear');
          api.world.say('용도 모를 장비를 챙겼다. (회수물 · 거래에 쓸 수 있다)', 2.5);
          break;
        case 'merchant':
          break; // 상점 창은 아이템 모듈이 엔진 interactHooks에서 연다
        // ── 승강기 안
        case 'greet':
          if (o.greeted) api.world.say(greetLine(meta.favor, false, false), 2);
          else doGreet(api, true);
          break;
        case 'close':
          o.closeCount++;
          if (o.closeCount >= 3 || (o.flags.includes('close_any') && o.closeCount === 1)) doSpam(api, true);
          else api.world.say('딸깍.', 0.8);
          break;
        case 'getoff':
          finishWith(api, { to: 'car' });
          break;
        case 'button': {
          if (o.stuck > 0) {
            api.world.say(`${STUCK_LINE} (${Math.ceil(o.stuck)}초)`, 2);
            if (!r.warned.has('stuckspawn')) r.warned.add('stuckspawn'), api.spawn({ kind: o.depth <= 3 ? 'lurker' : 'charger', x: 80, y: 600 });
            break;
          }
          const b = r.plan.stage.buttons![Number(prop.id.slice(3))];
          if (b.exit) {
            o.ending = true;
            sendFound(meta, o);
            const changed = reshuffle(meta);
            save();
            log(`EXIT. 승강기가 재편됐다: ${changed.map((id) => RULE[id].texts[ruleVersion(meta, id) - 1]).join(' / ')} → 새 줄로`);
            api.note('stage.exit', true);
            finishWith(api, { to: 'ending' });
            break;
          }
          finishWith(api, { to: 'floor', depth: b.depth, type: b.type, sub: b.sub });
          break;
        }
        case 'van':
          api.world.say('인터폰 마지막 한 줄: 「또 와요.」', 4);
          api.finish('withdraw');
          break;
      }
    },
  };

  /** 인사 (소품 E 또는 대사 모듈 선택). given = 대사 모듈이 굴린 총애 */
  const doGreet = (api: StageApi, talk: boolean, given?: number) => {
    const o = out!;
    o.greeted = true;
    foundRule(api, 'greet', api.world.player.x);
    if (o.flags.includes('greet_flip')) {
      addFavor(meta, o, -1, '말 걸지 말라는 날 인사함');
      if (talk) api.world.say(greetLine(meta.favor, false, true), 2.5);
    } else {
      const gain = given !== undefined ? Math.max(0, Math.min(1, given - meta.favor)) : rng(mix(o.seed, o.ride, 31))() < 0.5 ? 1 : 0;
      if (gain) addFavor(meta, o, 1, '인사');
      if (talk) api.world.say(greetLine(meta.favor, !!gain, false), 2.5);
      if (talk && meta.favor >= 3 && !meta.lonelyHeard) ((meta.lonelyHeard = true), api.world.say(LONELY_LINE, 5));
    }
    save();
  };
  const doSpam = (api: StageApi, talk: boolean) => {
    const o = out!;
    addFavor(meta, o, -1, '닫힘 연타');
    foundRule(api, 'close', api.world.player.x);
    if (talk) api.world.say(CLOSE_SPAM_LINE, 2.5);
    o.closeCount = -99;
    save();
  };

  const onEnter = (api: StageApi) => {
    const r = rt!;
    const o = out!;
    const plan = r.plan;
    api.world.light = r.light;
    api.world.noise = 0;
    api.note('stage.depth', o.depth);
    api.note('stage.visited', o.visited.map((v) => `${depthLabel(v.depth)} ${FLOOR_TYPES[v.type].label}`));
    if (plan.stage.where === 'floor') {
      const f = plan.stage.floor!;
      api.world.emit({ type: 'ding', x: plan.startX });
      const first = o.depth === 1 && o.visited.length === 1;
      const told = hooks.announce?.({ depth: f.depth, type: f.type, label: FLOOR_TYPES[f.type].label, hint: FLOOR_TYPES[f.type].hint, first, agent: o.agent });
      if (!told) api.world.say(first ? '띵. 1층입니다. 문이 열립니다. …로비 같은데, 로비가 아니다.' : announce(f.depth, f.type), 4);
      if (f.goal && !o.flags.includes('trial_mid')) api.world.say(`벽에 큰 글씨: 「${f.goal.text}」 (E로 읽기)`, 4);
    } else if (plan.stage.where === 'car') {
      const info: BoardInfo = { depth: o.depth, ftype: o.lastTypes.at(-1) ?? '', favor: meta.favor, agent: o.agent, ride: o.ride, stuck: Math.max(0, o.stuck), greetFlip: o.flags.includes('greet_flip'), closeAny: o.flags.includes('close_any') };
      const byStory = hooks.board?.(
        info,
        defer<BoardResult>((api, res) => {
          if (res.act === 'greet' && !out!.greeted) doGreet(api, false, res.favor);
          else if (res.act === 'spam' && out!.closeCount >= 0) doSpam(api, false);
        }),
      );
      if (byStory) {
        // 인사·닫힘은 대사 모듈 선택지로 했으니 소품은 치운다
        api.setProp('greet', null);
        api.setProp('close', null);
        if (o.stuck > 0) log('총애가 낮아 문이 안 닫힌다 (10초)');
        return;
      }
      const lines = hooks.elevator;
      const n = o.ride;
      const call = rng(mix(o.seed, n, 7))() < 0.4 ? lines?.callout?.(o.agent, meta.favor, n) ?? defaultCallout(o.agent, meta.favor) : MUTTER[n % MUTTER.length];
      api.world.say(o.stuck > 0 ? STUCK_LINE : call, 3.5);
      if (o.stuck > 0) log('총애가 낮아 문이 안 닫힌다 (10초)');
    } else if (plan.stage.where === 'service') {
      const c = plan.stage.cell!;
      if (c.kind === 'attic' && !r.warned.has('attic')) api.world.say('선배들의 다락방. 벽에 긁어 쓴 글씨: 「여기 오래 있지 마」', 3);
    } else if (plan.stage.where === 'ending') api.world.say('…1층입니다. 문이 열립니다.', 4);
  };

  const talkPassenger = (api: StageApi, prop: PropSpec) => {
    const r = rt!;
    const o = out!;
    const h = hookOf(prop.id);
    if (!h) return;
    const kind = h.kind as PassengerKind;
    const fork = !!h.data.fork;
    if (!r.talked.has(prop.id)) {
      const info: PassengerInfo = { kind, honest: !!h.data.honest, long: !!h.data.long, fork, knowsRule: currentKnown(meta).includes('passenger'), agent: o.agent, depth: o.depth };
      if (hooks.meetPassenger?.(info, defer<PassengerResult>((api, res) => applyPassenger(api, prop, h, res.choice)))) {
        r.talked.add(prop.id);
        return;
      }
    }
    const lines = hooks.passenger?.talk?.(kind, !!h.data.honest, !!h.data.long) ?? defaultTalk(kind, !!h.data.long, fork);
    api.world.say(`${PASSENGER_LABEL[kind]}: ${lines.join(' ')}`, 5);
    if (r.talked.has(prop.id)) return;
    r.talked.add(prop.id);
    if (o.agent === 'rojemon') api.world.say(h.data.honest ? '(로제몬: 진짜야.)' : '(로제몬: 거짓말이야.)', 3);
    // 선택지를 승객 오른쪽에 소품으로 낸다
    (['help', 'ignore', 'rob'] as PassengerChoice[]).forEach((c, i) => {
      const id = `${prop.id}:${c}`;
      r.choices.set(id, { hook: h, choice: c });
      api.setProp(id, { id, kind: 'choice', x: prop.x + 90 + i * 90, y: prop.y + 40, w: 60, h: 40, label: CHOICE_LABEL[c] });
    });
  };

  const clearChoices = (api: StageApi, prefix: string) => {
    for (const id of [...rt!.choices.keys()].filter((k) => k.startsWith(prefix))) {
      rt!.choices.delete(id);
      api.setProp(id, null);
    }
  };

  const resolveChoice = (api: StageApi, prop: PropSpec, ch: { hook: SpawnHook; choice: PassengerChoice | 'deal'; deal?: 'reveal' | 'skip' | 'supply' }) => {
    const o = out!;
    const p = api.world.player;
    if (ch.choice === 'deal') {
      clearChoices(api, 'deal:');
      return applyDeal(api, ch.deal!);
    }
    clearChoices(api, `h${ch.hook.id}:`);
    applyPassenger(api, prop, ch.hook, ch.choice);
  };

  const applyDeal = (api: StageApi, deal: 'reveal' | 'skip' | 'supply') => {
    const o = out!;
    const cost = o.items.find((i) => i === 'gear' || i === 'checklist') ?? o.items[0];
    if (!cost) return api.world.say('인터폰: 「줄 게 없으면 거래도 없어요.」', 2.5);
    o.items.splice(o.items.indexOf(cost), 1);
    o.deals++;
    const truth = dealTruth(meta.favor, rng(mix(o.seed, o.deals, meta.favor, 11))());
    log(`승강기와 거래: ${deal} (${itemName(cost)} 줌) · ${truth ? '참' : '거짓'}`);
    if (deal === 'reveal') {
      o.reveal = true;
      const ty = pickType(o.serviceDepth + 1, o.lastTypes, o.seed, meta.epoch, truth ? 3 : 4);
      api.world.say(`인터폰: 「다음은 ${FLOOR_TYPES[ty].label}예요.」${truth ? '' : ' (…정말일까)'}`, 3.5);
    } else if (deal === 'skip') {
      const d = o.serviceDepth + (truth ? 3 : 1);
      api.world.say(`인터폰: 「아래로 모셔다 드릴게요.」`, 2.5);
      finishWith(api, { to: 'floor', depth: d, type: pickType(d, o.lastTypes, o.seed, meta.epoch, 77), sub: null });
    } else {
      api.world.say(truth ? '인터폰: 「매트 밑을 봐요.」 (회복약 2개)' : '인터폰: 「매트 밑을 봐요.」 …아무것도 없다.', 3);
      if (truth) o.items.push('heal', 'heal'), api.heal(30);
    }
    save();
  };

  const applyPassenger = (api: StageApi, prop: PropSpec, h: SpawnHook, c: PassengerChoice | 'follow') => {
    const o = out!;
    const p = api.world.player;
    const kind = h.kind as PassengerKind;
    const honest = !!h.data.honest;
    log(`승객 조우: ${PASSENGER_LABEL[kind]} · ${({ help: '돕기', ignore: '무시', rob: '뺏기', follow: '따라가기' } as const)[c]} · ${honest ? '진실' : '거짓'}`);
    if (c === 'follow' && kind !== 'three_years') c = 'ignore';
    if (c === 'ignore') return void api.world.say('지나쳤다.', 1.5);
    if (c === 'rob') {
      api.setProp(`h${h.id}`, null);
      if (!honest || kind === 'nothuman') {
        api.spawn({ kind: kind === 'nothuman' ? 'nothuman' : 'thief', x: prop.x, y: prop.y });
        api.world.say('승객이 돌변했다.', 2);
      } else (o.items.push('heal'), api.world.say('배낭에서 회복약을 빼앗았다. 승객은 말없이 사라졌다.', 2.5));
      return;
    }
    // 돕기
    const f = rt!.plan.stage.floor;
    switch (kind) {
      case 'three_years': {
        // follow·help 둘 다 승객이 가리킨 문을 표시한다
        foundRule(api, 'passenger', p.x);
        const doors = f?.placed.filter((x) => x.kind === 'door' && x.data.fork !== undefined) ?? [];
        if (doors.length) {
          const pointed = doors.filter((d) => (honest ? d.data.correct : !d.data.correct))[0];
          api.setProp(`p${pointed.id}`, { label: `${pointed.label} ← 승객이 가리킨 문` });
          api.world.say(`승객이 ${pointed.label}을 가리킨다.`, 2.5);
        } else {
          o.reveal = honest || o.reveal;
          api.world.say(honest ? '다음 승강기 버튼의 유형을 알려 줬다.' : '다음 층 얘기를 한참 했다. 믿을 만한지는 모르겠다.', 2.5);
        }
        break;
      }
      case 'markers':
        o.reveal = true;
        api.world.say('벽 기호 읽는 법을 배웠다. 다음 버튼 유형이 보인다.', 2.5);
        break;
      case 'supply':
        if (honest) (o.items.push('heal'), api.heal(20), api.world.say('승객이 보급품을 나눠 줬다.', 2));
        else (api.setProp(`h${h.id}`, null), api.spawn({ kind: 'thief', x: prop.x, y: prop.y }), api.world.say('「그 배낭, 이리 내.」 승객이 덤빈다.', 2.5));
        break;
      case 'nothuman':
        api.setProp(`h${h.id}`, null);
        api.spawn({ kind: 'nothuman', x: prop.x, y: prop.y });
        api.world.say('승객 옷을 입은 것이 고개를 든다. 얼굴이…', 2.5);
        break;
      case 'missing':
        o.escort = `missing:${o.depth}`;
        api.setProp(`h${h.id}`, null);
        api.world.say('회사원이 따라온다. 다락방 로프나 인터폰까지 데려가면 구조.', 3);
        break;
    }
  };

  const offerDeal = (api: StageApi, prop: PropSpec) => {
    const r = rt!;
    const hookStub: SpawnHook = { id: 0, role: 'passenger', kind: 'deal', x: 0, lane: 0, wave: 0, elite: false, data: {} };
    if (hooks.deal?.({ favor: meta.favor, items: [...out!.items] }, defer<{ deal: 'reveal' | 'skip' | 'supply' | null }>((api, res) => res.deal && applyDeal(api, res.deal)))) return;
    api.world.say(`인터폰: 「거래할래요? 회수물 하나면 돼요.」 (가진 것: ${out!.items.map(itemName).join(', ') || '없음'})`, 4);
    (
      [
        ['reveal', '다음 층 유형'],
        ['skip', '더 아래로 (깊이 +2)'],
        ['supply', '보급품 위치'],
      ] as const
    ).forEach(([d, label], i) => {
      const id = `deal:${d}`;
      r.choices.set(id, { hook: hookStub, choice: 'deal', deal: d });
      api.setProp(id, { id, kind: 'choice', x: prop.x + 100 + i * 90, y: prop.y + 60, w: 60, h: 40, label });
    });
  };

  return mod;
}

export function itemName(id: string): string {
  return ({ heal: '회복약', light: '손전등', guard: '방어 강화', ammo: '탄약', gear: '용도 모를 장비', checklist: '점검표' } as Record<string, string>)[id] ?? id;
}
