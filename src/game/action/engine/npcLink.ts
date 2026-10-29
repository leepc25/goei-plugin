// NPC 자유 대화를 엔진에 잇는 곳 (npc/ 모듈, 설계안 docs/NPC_자유대화.md).
// E를 누른 자리에 말을 걸 수 있는 사람이 있으면 대화창을 연다(world.talkHook). 원래 E가 하던 일(임무 창구·거래·인사·
// 돕기/무시/뺏기)은 대화창 버튼이 되고, E를 한 번 더 누르면 첫 버튼이다.
// 누가 어디에 있나:
//   본부  자리 주인(hq/map.ts spot.who): 잼트리·콘쥬스·데쥬레·고그니쟈·부장(쟈알디)·사무실 요원들·면담실 생존자
//   층    중림 상인(merchant 소품) · 떠도는 승객(층 모듈 meetPassenger 훅) · 사는 척하는 주민(npc 소품) · 승강기(인사 소품)
//         · 난입한 백일몽 탐사원(대치: 먼저 때리거나 말로 틀어지면 싸우고, 말이 통하면 그 방 동안 같이 싸운다)
// 행동(설계안 5-1): 평소 → (호감 -2 이하) 경계 → 적대 / 동행 / 떠남. 움직임은 게임 코드가 하고, 모델은 태그로 계기만 준다.
// 아직 게임에 없는 사람(브라우니·탐미주의·블라렛·살라딘·아벤샤·가짜 관리국 이름 있는 둘·다른 백일몽)은 talkTo(npc, …)로 붙인다.
import type { GameBridge } from '../../bridge';
import type { PropSpec } from './contract';
import type { World } from './world';
import type { Hub } from './hub';
import type { HqSpot } from '../hq/map';
import { Enemy, type Brain } from '../enemy/enemy';
import type { Attack } from '../enemy/roster';
import { AGENTS } from '../story/lines/agents';
import type { AgentId } from '../story/types';
import { createNpcTalk, ROSTER, SPOT_NPC, VENDOR_NPC, DAYDREAM_NPCS, type AppliedEffect, type MetaInfo, type NpcDef, type NpcTalk, type TalkAction, type TalkHint, type TalkTarget } from '../npc';
import { RULES } from '../stage/data/rules';
import { FLOOR_TYPES, depthLabel } from '../stage';
import type { StageHooks } from '../stage';
import { PASSENGER_LABEL, type PassengerChoice, type PassengerKind } from '../stage/passengers';
import { SURVIVORS } from '../hq/data';
import { VENDORS } from '../items/data';

export interface NpcLinkOpts {
  visit?: (name?: string) => void;
  /** 대화창을 넣을 1280×720 층 (껍데기 stage.ui) */
  layer: HTMLElement;
  bridge?: Partial<GameBridge>;
  settings(): { talkModel?: 'main' | 'aux'; talkRecent?: boolean };
  agent(): AgentId;
  day(): number;
  /** 본부 면담실에 있는 구조된 생존자 id */
  rescued(): string[];
  photo(key: string): string | undefined | Promise<string | undefined>;
  sfx(name: string): void;
  /** 창이 열리고 닫힐 때 (터치 버튼 숨김) */
  onOpen(on: boolean): void;
}

export interface NpcLink {
  talk: NpcTalk;
  isOpen(): boolean;
  /** 월드마다: E 가로채기·백일몽 대치·동행 두뇌 */
  attach(w: World, o: { hub?: Hub | null; items?: { give(id: string): boolean } | null; hq: boolean }): void;
  /** 층 모듈 훅에 승객 대화를 끼운다 */
  stageHooks(h: StageHooks): StageHooks;
  /** 다른 모듈이 사람을 붙일 때: 지금 월드에서 이 사람과 대화창을 연다 */
  talkTo(npc: string, extra?: Partial<TalkTarget>): void;
  dispose(): void;
}

const store = (key: string) => ({
  load: () => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  save: (v: string) => {
    try {
      localStorage.setItem(key, v);
    } catch {
      /* 저장 못 해도 진행 */
    }
  },
});

const VERB: Record<string, string> = { 임무: '임무 창구', 장비: '장비·보급', 감정: '회수물 감정', 연구: '연구', 결재: '결재', 커피: '커피 한 잔', 요원: '요원 편성', 면담: '면담 기록' };

/** 백일몽 현장 탐사원 (가면 쓰고 현장에 나오는 사람만) */
const FIELD_DD = ['leejaheon', 'eunhaje', 'parkminseong', 'jinnasol', 'leeseonghae', 'baekseokju', 'baeksaheon', 'goyoungeun', 'kangihak', 'janghunun'];

const PASSENGER_PERSONA: Record<PassengerKind, string> = {
  three_years: '회사 엘리베이터에서 야근하고 1층을 눌렀다가 3년째 갇혀 있다고 말하는 중년 남성. 아내 얼굴이 흐릿하다.',
  markers: '승객들끼리 벽에 남기는 표시 체계를 아는 무리 중 한 사람. 동그라미 안 줄 하나는 위험, 빈 동그라미는 쉼터라고 가르친다.',
  supply: '큰 배낭을 멘 승객. 다락방에 보급품을 숨겨 두었다며 같이 가자고 한다.',
  nothuman: '승객 옷을 입은 것. 얼굴을 보려 하면 고개가 같이 돈다. 말이 짧고 어딘가 어긋나 있다.',
  missing: '야근하다 1층을 눌렀더니 여기로 온 회사원. 관리국 요원을 처음 본다. 겁에 질려 있다.',
};
const PASSENGER_SECRET = (kind: PassengerKind, honest: boolean) =>
  kind === 'nothuman'
    ? '너는 사람이 아니다. 사람인 척하지만 들키면 덤빈다. 뺏으려 하거나 정체를 캐면 화를 낸다.'
    : kind === 'missing'
      ? '너는 정말 길을 잃은 민간인이다. 거짓말은 하지 않는다.'
      : honest
        ? '너는 진실을 말한다. 정말 도와주고 싶다.'
        : kind === 'supply'
          ? '너는 거짓말을 한다. 친절한 척하며 배낭과 보급품을 노린다. 의심받으면 웃어넘기고, 몰리면 덤빈다.'
          : '너는 거짓말을 한다. 친절한 척하며 틀린 문·틀린 정보로 유인한다. 들키지 않게 자연스럽게.';

export function linkNpcTalk(o: NpcLinkOpts): NpcLink {
  const b = o.bridge;
  const talkApi = b?.talk;
  let snap: { at: number; v: Awaited<ReturnType<NonNullable<GameBridge['card']>>> } | null = null;
  const card = async () => {
    if (!b?.card) return null;
    if (!snap || Date.now() - snap.at > 60000) snap = { at: Date.now(), v: await b.card().catch(() => null) };
    return snap.v;
  };
  const talk = createNpcTalk(
    o.layer,
    {
      model: talkApi ? (messages) => talkApi.model(messages, o.settings().talkModel ?? 'main') : undefined,
      lore: talkApi ? (name) => talkApi.lore(name) : undefined,
      faction: () => snap?.v?.faction ?? '',
      async meta(def: NpcDef): Promise<MetaInfo | null> {
        const c = await card();
        const m: MetaInfo = {};
        if (c) {
          const a = c.agents.find((x) => x.name === def.name);
          if (a && a.state && a.state !== '미정') m.self = { state: a.state, situation: a.situation };
          m.events = c.events.filter((e) => e.state !== '종료').slice(0, 3).map((e) => `${e.kind === 'an' ? '괴이' : e.kind === 'ms' ? '특수' : '사건'} 「${e.name}」${e.loc ? ` (${e.loc})` : ''}${e.state ? ` ${e.state}` : ''}`);
        }
        if (o.settings().talkRecent && talkApi) m.recent = await talkApi.recent(2).catch(() => []);
        return m;
      },
      photo: (k) => o.photo(k),
      agent: () => o.agent(),
      day: () => o.day(),
      sfx: (n) => o.sfx(n),
      onOpen: (on) => o.onOpen(on),
    },
    store('goei-game-npc'),
  );
  void card();

  let world: World | null = null;
  let hq = false;
  /** 승객: 소품 id → 층 모듈이 넘긴 done (고를 때까지 다시 말 걸 수 있다) */
  const pending = new Map<string, { info: PassengerMeet; done: (r: { choice: PassengerChoice | 'follow' }) => void }>();
  let lastPassengerProp: PropSpec | null = null;
  type PassengerMeet = { kind: PassengerKind; honest: boolean; long: boolean; fork: boolean; agent: string; depth: number };

  /** 이 층의 진짜 단서: 아직 못 찾은 이 층·공통 규칙 줄 */
  const floorHints = (w: World): TalkHint[] => {
    const found = new Set((w.notes['stage.found'] as string[] | undefined) ?? []);
    const type = w.floor.type ?? '';
    return RULES.filter((r) => (r.scope === type || r.scope === 'common' || r.scope === 'service') && !found.has(r.id))
      .slice(0, 4)
      .map((r) => ({ id: r.id, text: r.texts[0] }));
  };
  const floorPlace = (w: World) => {
    const d = w.floor.depth ?? 0;
    const ft = FLOOR_TYPES[(w.floor.type ?? '') as keyof typeof FLOOR_TYPES];
    return `차원 승강기 ${d ? depthLabel(d) : ''} ${ft?.label ?? w.floor.title ?? ''}`.replace(/\s+/g, ' ').trim();
  };
  const floorFacts = (w: World) => {
    const p = w.player;
    return [`요원 체력 ${Math.round((p.hp / p.hpMax) * 100)}%`, ...(w.notes.held ? ['요원이 임시 무기를 들고 있다'] : [])];
  };

  /** 모든 대화는 공통 효과(선물·단서·기록)를 거쳐 지금 월드에 잇는다 */
  const open = (t: TalkTarget) => talk.open(world ? common(world, t) : t);

  // ── 본부 ─────────────────────────────────────────
  const hubTalk = (w: World, hub: Hub, prop: PropSpec): boolean => {
    const sc = hub.current();
    const spot = sc?.spots.find((s) => `spot:${s.id}` === prop.id) as (HqSpot & { open?: boolean }) | undefined;
    if (!sc || !spot || spot.open === false || !spot.who) return false;
    // 일하는 자리(임무 창구·정비실 등)는 E = 그 창 (사용자 2026-10-25: 임무 책상에서 대화로 빠져 헷갈림). 말은 사람 앞 「대화」 자리에서
    if (spot.place && spot.place !== 'office' && spot.place !== 'interview') return false;
    if (o.visit) { o.visit(spot.who); return true; }
    const me = o.agent();
    const place = `관리국 본부 ${sc.floor} ${sc.name}`;
    const facts = [`본부 ${o.day()}일차`];
    const placeAct: TalkAction = { id: 'place', label: VERB[spot.verb] ?? spot.verb, run: () => w.interactWith(prop) };
    const withPlace = (t: Omit<TalkTarget, 'place'>, more: TalkAction[] = []): TalkTarget => ({ place, facts, ...t, actions: [placeAct, ...more] });
    if (spot.place === 'office') {
      // 사무실: 출동하지 않은 요원들. 한 명과 말하고 버튼으로 바꾼다
      const others = (Object.keys(AGENTS) as AgentId[]).filter((a) => a !== me && a !== 'jyaldi');
      const pick = (id: AgentId) => open(withPlace({ npc: id, facts: [...facts, '출동하지 않고 사무실에서 쉬는 중'] }, others.filter((x) => x !== id).slice(0, 6).map((x) => ({ id: `ag:${x}`, label: `${AGENTS[x].name}에게`, run: () => setTimeout(() => pick(x), 0) }))));
      pick(others[Math.floor(Math.random() * others.length)] ?? 'eileen');
      return true;
    }
    if (spot.place === 'interview') {
      const list = o.rescued().filter((r) => SURVIVORS[r]);
      if (!list.length) return false;
      const pick = (id: string) =>
        open(
          withPlace(
            { npc: 'civilian', key: `sv:${id}`, name: SURVIVORS[id].name, persona: `차원 승강기에서 관리국 요원에게 구조되어 본부 면담실에 있다. 겪은 일: ${SURVIVORS[id].clue}`, facts: [...facts, '구조된 뒤 면담실에서 진술을 기다린다'], allow: ['favor'] },
            list.filter((x) => x !== id).map((x) => ({ id: `sv:${x}`, label: `${SURVIVORS[x].name}에게`, run: () => setTimeout(() => pick(x), 0) })),
          ),
        );
      pick(list[0]);
      return true;
    }
    const npc = SPOT_NPC[spot.who];
    if (!npc || npc === me || !ROSTER[npc]) return false;
    open(withPlace({ npc }));
    return true;
  };

  // ── 층: 상인·주민·승강기·백일몽 ────────────────────
  const merchantTalk = (w: World, prop: PropSpec): boolean => {
    const ids = Object.keys(VENDORS);
    const vendor = ids.find((v) => prop.label?.includes(VENDORS[v as keyof typeof VENDORS].name)) ?? 'madeokhee';
    const npc = VENDOR_NPC[vendor];
    if (!npc) return false;
    const trade: TalkAction = { id: 'trade', label: '거래', run: () => w.interactWith(prop) };
    const pick = (id: string) =>
      open({
        npc: id,
        place: `${floorPlace(w)} 정비 구역 휴식방 (출동 중)`,
        facts: [...floorFacts(w), `가진 현금 ${(w.notes.cash as number | undefined) ?? 0}`],
        hints: floorHints(w),
        actions: [trade, ...(vendor === 'backalley' ? [{ id: 'swap', label: id === 'goyeonji' ? '윤지아에게' : '고연지에게', run: () => setTimeout(() => pick(id === 'goyeonji' ? 'yunjia' : 'goyeonji'), 0) }] : [])],
        onEffect: (e) => {
          if (e.kind === 'leave') w.api.setProp(prop.id, null), w.say(`${ROSTER[id].name}가 짐을 챙겨 떠났다.`, 2);
        },
      });
    pick(npc);
    return true;
  };

  const residentNear = (w: World, x: number) =>
    w.bodies.find((bd): bd is Enemy => bd instanceof Enemy && bd.alive && bd.kind === 'resident' && Math.abs(bd.x - x) < 160) ?? null;

  const residentTalk = (w: World, prop: PropSpec): boolean => {
    const e = residentNear(w, prop.x);
    if (e?.hostile) return false; // 이미 턱이 벌어졌다
    const key = `rs:${prop.id}`;
    open({
      npc: 'resident',
      key,
      place: `${floorPlace(w)} (아파트를 그대로 베낀 층)`,
      facts: [...floorFacts(w), e?.mem.greeted ? '요원은 이미 인사했다' : '요원은 아직 인사하지 않았다'],
      hints: floorHints(w).slice(0, 2),
      actions: [{ id: 'greet', label: '인사한다', run: () => w.interactWith(prop) }],
      onEffect: (ef) => {
        if (!e || !e.alive) return;
        if (ef.kind === 'favor' && talk.relations.get(key, true).favor >= 1 && !e.mem.greeted) {
          e.mem.greeted = true;
          e.say('…편하게 둘러보세요', 50);
        }
        if (ef.kind === 'hostile') {
          e.hostile = true;
          e.mem.turnedAt = w.tick;
          e.say('말이 많네', 50);
          e.set('stunned');
          e.stunT = 20;
          w.emit({ type: 'custom', name: 'ruleBroken', data: { rule: 'r_greet', id: e.id } });
          w.emit({ type: 'enemyTell', x: e.x, kind: e.kind });
        }
      },
    });
    return true;
  };

  const elevatorTalk = (w: World, prop: PropSpec): boolean => {
    open({
      npc: 'elevator',
      place: `차원 승강기 안 (${floorPlace(w)})`,
      facts: floorFacts(w),
      hints: RULES.filter((r) => r.scope === 'elevator' || r.scope === 'common').slice(0, 4).map((r) => ({ id: r.id, text: r.texts[0] })),
      allow: ['hint'],
      actions: [{ id: 'greet', label: '인사한다', run: () => w.interactWith(prop) }],
    });
    return true;
  };

  // ── 백일몽 대치·동행 ─────────────────────────────
  const ddName = (e: Enemy) => DAYDREAM_NPCS[e.mem.npc as string]?.name ?? '백일몽';

  /** 대치: 거리를 두고 지켜본다. 먼저 맞으면 싸운다 */
  const parley: Brain = {
    tick(e, wv) {
      const w = wv as unknown as World;
      if (!e.mem.parley) return;
      if (e.lastHurt > 0) return void endParley(e, w, 'hostile');
      if (e.state !== 'idle' && e.state !== 'walk') return;
      const p = w.player;
      e.face(p.x);
      const dx = e.x - p.x;
      const want = 260;
      if (Math.abs(dx) < want - 40) {
        e.x += Math.sign(dx || 1) * e.speed() * 0.7;
        e.set('walk');
      } else if (Math.abs(p.y - e.y) > 30) {
        e.y += Math.sign(p.y - e.y) * 1.5;
        e.set('walk');
      } else e.set('idle');
      if (!e.mem.parleySaid && Math.abs(dx) < 520) {
        e.mem.parleySaid = true;
        e.say('…관리국?', 60);
      }
      return true;
    },
  };

  const endParley = (e: Enemy, w: World, how: 'hostile' | 'leave' | 'join') => {
    e.mem.parley = false;
    if (e.mem.brain0) e.brain = e.mem.brain0 as Brain;
    if (how === 'hostile') {
      e.hostile = true;
      e.say('그래, 해 보자.', 50);
    } else if (how === 'leave') {
      e.mem.fleeDir = Math.sign(e.x - w.player.x) || 1;
      e.dir = e.mem.fleeDir;
      e.say('수고하세요.', 50);
      e.set('flee');
    } else makeAlly(e, w);
  };

  /** 쓸 수 있는 공격: 잡기·발사(연막 등)는 빼고 */
  const allyAttacks = (e: Enemy): Attack[] => e.def.attacks.filter((a) => !a.move.specs.some((s) => (s as { grab?: unknown }).grab) && !a.move.frames.some((f) => (f as { fire?: string }).fire));

  /** 동행: 가까운 적을 친다. 적이 없으면 요원 뒤를 따라간다 */
  const ally: Brain = {
    tick(e, w) {
      if (e.state !== 'idle' && e.state !== 'walk') return;
      const p = w.player;
      let best: Enemy | null = null;
      let bd = 900;
      for (const x of w.bodies) {
        if (!(x instanceof Enemy) || x === e || !x.alive || x.team !== 'enemy' || !x.hostile || /dead|hidden|dormant|spawn/.test(x.state)) continue;
        const d = Math.abs(x.x - e.x);
        if (d < bd) (bd = d), (best = x);
      }
      const sp = e.speed();
      if (best) {
        const dx = best.x - e.x;
        const dy = best.y - e.y;
        e.face(best.x);
        const atk = allyAttacks(e).find((a) => e.cd(a.move.id) <= 0 && Math.abs(dx) >= a.range[0] && Math.abs(dx) <= a.range[1] && Math.abs(dy) <= a.dy);
        if (atk && w.rand() < 0.2) {
          e.start(atk.move, w, atk.cd);
          return true;
        }
        if (Math.abs(dx) > 70) e.x += Math.sign(dx) * sp;
        if (Math.abs(dy) > 6) e.y += Math.sign(dy) * Math.min(Math.abs(dy), sp * 0.6);
        e.set('walk');
        return true;
      }
      // 요원 뒤 120~220
      const behind = p.x - p.dir * 170;
      const dx = behind - e.x;
      e.face(p.x);
      if (Math.abs(dx) > 50) {
        e.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * (Math.abs(dx) > 400 ? 1.8 : 1));
        e.set('walk');
      } else e.set('idle');
      if (Math.abs(p.y - e.y) > 20) e.y += Math.sign(p.y - e.y) * 1.5;
      return true;
    },
  };

  const makeAlly = (e: Enemy, w: World) => {
    // 같은 편으로 (맞음 판정은 team으로 갈린다). 싸움 구간을 막지 않게 위협에서 빠진다
    Object.defineProperty(e, 'team', { value: 'player', configurable: true });
    e.hostile = false;
    e.mem.mode = 'peace';
    e.mem.ally = true;
    e.brain = ally;
    e.label = `동행 · ${ddName(e)}`;
    e.say('같이 가죠. 이 방까지만.', 60);
    w.emit({ type: 'custom', name: 'npcJoin', data: { npc: e.mem.npc, kind: e.kind } });
  };

  const daydreamTalk = (w: World): boolean => {
    const p = w.player;
    const e = w.bodies.find((bd): bd is Enemy => bd instanceof Enemy && bd.alive && !!bd.mem.parley && Math.abs(bd.x - p.x) < 300) ?? null;
    if (!e) return false;
    const npc = e.mem.npc as string;
    open({
      npc,
      key: undefined,
      place: `${floorPlace(w)} (백일몽 탐사조가 같은 층을 뒤지다 마주쳤다)`,
      facts: [...floorFacts(w), '서로 회수물을 노리는 경쟁자다. 싸우면 회수물을 뺏고 뺏긴다', '함께 가면 이 방 동안만 같이 싸운다'],
      hints: floorHints(w),
      canJoin: true,
      allow: ['favor', 'hint', 'join', 'hostile', 'leave', 'gift'],
      actions: [
        { id: 'ignore', label: '무시하고 지나간다', run: () => endParley(e, w, 'leave') },
        { id: 'fight', label: '쫓아낸다 (싸움)', run: () => endParley(e, w, 'hostile') },
      ],
      onEffect: (ef) => {
        if (!e.alive) return;
        if (ef.kind === 'hostile') endParley(e, w, 'hostile');
        else if (ef.kind === 'leave') endParley(e, w, 'leave');
        else if (ef.kind === 'join') endParley(e, w, 'join');
      },
    });
    return true;
  };

  // ── 공통 효과 ───────────────────────────────────
  let items: { give(id: string): boolean } | null = null;
  const common = (w: World, t: TalkTarget): TalkTarget => {
    const inner = t.onEffect;
    return {
      ...t,
      onEffect: (e: AppliedEffect) => {
        if (e.kind === 'gift' && e.item) {
          if (items?.give(e.item)) w.say(`${t.name ?? ROSTER[t.npc]?.name}에게 받았다.`, 2);
        }
        if (e.kind === 'hint' && e.hint) ((w.notes['npc.hints'] ??= []) as string[]).push(e.hint.id);
        if (e.kind === 'join' || e.kind === 'hostile' || e.kind === 'trade' || e.kind === 'gift') ((w.notes['npc.events'] ??= []) as string[]).push(`${t.name ?? ROSTER[t.npc]?.name}: ${e.note}`);
        inner?.(e);
      },
    };
  };

  // ── 승객 (층 모듈 meetPassenger) ─────────────────
  const passengerOpen = (w: World, propId: string) => {
    const pd = pending.get(propId);
    if (!pd) return false;
    const { info, done } = pd;
    const kind = info.kind;
    const civ = kind === 'missing';
    const finish = (c: PassengerChoice | 'follow') => {
      if (!pending.has(propId)) return;
      pending.delete(propId);
      done({ choice: c });
    };
    const actions: TalkAction[] = [
      { id: 'help', label: civ ? '데려간다' : '돕는다', run: () => finish('help') },
      ...(kind === 'three_years' ? [{ id: 'follow', label: '가리킨 문으로 따라간다', run: () => finish('follow') }] : []),
      { id: 'ignore', label: '지나친다', run: () => finish('ignore') },
      ...(civ ? [] : [{ id: 'rob', label: '뺏는다', run: () => finish('rob') }]),
    ];
    open({
      npc: civ ? 'civilian' : 'passenger',
      key: `ps:${propId}`,
      name: PASSENGER_LABEL[kind],
      persona: PASSENGER_PERSONA[kind],
      secret: PASSENGER_SECRET(kind, info.honest),
      place: floorPlace(w),
      facts: floorFacts(w),
      hints: info.honest || civ ? floorHints(w).slice(0, 2) : [],
      canJoin: true,
      notes: info.agent === 'rojemon' && !civ ? [info.honest && kind !== 'nothuman' ? '로제몬: 진짜야.' : '로제몬: 거짓말이야.'] : [],
      actions,
      onEffect: (e) => {
        if (e.kind === 'join') finish(kind === 'three_years' ? 'follow' : 'help');
        else if (e.kind === 'hostile') finish(!info.honest || kind === 'nothuman' ? 'rob' : 'ignore');
        else if (e.kind === 'leave') finish('ignore');
      },
    });
    return true;
  };

  // ── E 가로채기 ───────────────────────────────────
  const talkHook = (w: World, hub: Hub | null) => (prop: PropSpec | null): boolean => {
    if (talk.isOpen()) return true;
    if (hq) return !!(hub && prop?.kind === 'hubspot' && hubTalk(w, hub, prop));
    if (prop?.kind === 'merchant') return merchantTalk(w, prop);
    if (prop?.kind === 'passenger') {
      if (pending.has(prop.id)) return passengerOpen(w, prop.id);
      lastPassengerProp = prop; // 처음엔 층 모듈이 meetPassenger를 부른다
      return false;
    }
    if (prop?.kind === 'npc' && residentNear(w, prop.x)) return residentTalk(w, prop);
    if (prop?.kind === 'greet') return elevatorTalk(w, prop);
    if (!prop || Math.abs(prop.x - w.player.x) > 40) return daydreamTalk(w);
    return false;
  };

  const link: NpcLink = {
    talk,
    isOpen: () => talk.isOpen(),
    attach(w, a) {
      world = w;
      hq = a.hq;
      items = a.items ?? null;
      talk.close();
      w.talkHook = talkHook(w, a.hub ?? null);
      if (hq) return;
      // 백일몽: 처음 보이면 이름 있는 탐사원 하나를 붙이고 대치로 시작
      w.hooks.push(() => {
        for (const bd of w.bodies) {
          if (!(bd instanceof Enemy) || bd.def.faction !== 'daydream' || bd.mem.npc) continue;
          bd.mem.npc = FIELD_DD[(bd.id * 7 + (w.run.seed | 0)) % FIELD_DD.length];
          bd.label = `백일몽 ${ddName(bd)}`;
          bd.mem.parley = true;
          bd.mem.brain0 = bd.brain;
          bd.brain = { ...bd.brain, tick: (e, ww) => (e.mem.parley ? parley.tick!(e, ww) : (bd.mem.brain0 as Brain).tick?.(e, ww)) };
          bd.hostile = false;
        }
      });
      w.on((e) => {
        if (e.type === 'run:end') talk.endRun();
      });
    },
    stageHooks(h) {
      return {
        ...h,
        meetPassenger(v, done) {
          const w = world;
          const prop = lastPassengerProp;
          lastPassengerProp = null;
          if (!w || !prop) return h.meetPassenger?.(v, done) ?? false;
          pending.set(prop.id, { info: { kind: v.kind as PassengerKind, honest: v.honest, long: v.long, fork: v.fork, agent: v.agent, depth: v.depth }, done });
          return passengerOpen(w, prop.id);
        },
      };
    },
    talkTo(npc, extra = {}) {
      const w = world;
      if (!w || !ROSTER[npc]) return;
      open({ npc, place: hq ? '관리국 본부' : floorPlace(w), facts: hq ? [] : floorFacts(w), hints: hq ? [] : floorHints(w), ...extra });
    },
    dispose() {
      talk.dispose();
      pending.clear();
      world = null;
    },
  };
  return link;
}
