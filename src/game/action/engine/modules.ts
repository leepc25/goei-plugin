// 최종 통합: 각 스레드 모듈을 엔진에 이어 붙이는 곳.
//   ui/    화면 틀·메뉴·HUD·터치·화면 효과 (mountGameShell)
//   audio/ 효과음·음악 (createGameAudio)
//   hq/    본부·필드 건물 지도 (hqMap)
// 적(enemy/)·아이템(items/)·대사(story/)를 여기에 잇는다. 옛 차원 승강기 출동(층·임무·정산)은 2026-10-28에 지웠다.
import { BASE_STATS } from '../../combat/baseStats.gen';
import { derive, rollBase } from '../../combat/stats';
import { clockText } from '../../../core/fieldclock';
import type { GameAssets, GameBridge } from '../../bridge';
import { persp, view } from './view';
import { KEYMAP } from './input';
import { drawGuardBar } from '../ui/pixelHud';
import { FighterPlayer, fighterHooks } from '../fighter/player';
import { GRADE_COLOR, PAIR_COLOR, TRAIT_COLOR, openDraft } from '../../perks/draftUi';
import { PERK_TEXT } from '../../perks/defs.gen';

const PERK_KIND = new Map(PERK_TEXT.map((d) => [d.name, d.kind]));
/** HUD 퍽 칸: 얻은 순서대로, 특성은 맨 뒤. 이름 앞 두 글자 · 등급 테두리 · 쌓임 숫자 */
function perkChips(p: FighterPlayer): { t: string; c: string; n?: number }[] {
  const st = new Map(p.perks.stacks().map((x) => [x.name, x.v]));
  const two = (n: string) => n.replace(/\s/g, '').slice(0, 2);
  return [
    ...[...p.perks.ranks.keys()].map((n) => ({ t: two(n), c: PERK_KIND.get(n) === '쌍' ? PAIR_COLOR : GRADE_COLOR[p.perks.topGrade(n)], n: st.get(n) || undefined })),
    ...[...p.perks.traits].map((n) => ({ t: two(n), c: TRAIT_COLOR })),
  ];
}
import { FighterAi } from '../fighter/ai';
import { charArt, charFace, charTop, drawCharClip, hasCharClip, loadChar } from '../art/charPacks';
import { setPixelScale } from './contract';
import { mountTalk } from '../../talk';
import { createGameAudio } from '../audio';
import { VIDEO_AUDIO_EVENT, type VideoTrack } from '../audio/videoTrack';
import { hqMap } from '../hq';
import { mountGameShell, type HudState, type Shell } from '../ui';
import { localStore, type SettingsStore } from '../ui/settings';
import { navigationFeedback } from './navigationFeedback';
import { syncNavigationButton } from '../ui/navigationButton';
import type { Body, GameEvent, HqModuleLike, StageModule } from './contract';
import type { EngineModules, Game } from './game';
import { DEF_BY_KIND, arenaStage, createEnemy, isThreat } from '../enemy';
import { CUTSCENES, VIDEOS, mountStory, type AgentId, type StoryApi } from '../story';
import type { SpeakerId } from '../story/types';
import { linkItems } from './itemsLink';
import { makeHub, silhouette, type HubHost, type HubLife } from './hub';
import { createHqWorld, hqDistrict } from '../../world/hq';
import { isRegionMove } from '../../world/districts';
import { STATUS, type DebuffKind, type StatusSet } from '../../combat/status';
import { createFieldShop, type FieldShop } from './fieldShopLink';
import { DEFAULT_CLOCK, clockRules, waitOptions, type ClockRules } from '../../world/clock';
import { hashSeed } from '../../world/rng';
import { observerLines } from '../../world/observer';
import { Lines, NPC_TYPE, type DialogueData, type LineCtx } from '../../world/lines';
import { Chatter } from '../../world/speech';
import dialogueData from '../../world/dialogue.json';
import type { Actor, SimEvent } from '../../world/actors';
import type { FactionView, PersonView } from '../../bridge';
import { FieldClock } from '../../world/clock';
import type { WorldSim } from '../../world/actors';
import { linkNpcTalk } from './npcLink';
import demoPhotos from '../story/demo-photos.json';
import { whereIs, LANE_TOP, LANE_BOT } from '../hq/map';
import { Squad, DIFF, type Difficulty } from '../../combat/brain';
import { FieldFx, parseFxList } from '../fx/fieldFx';
import { SUPER_TEXT } from '../fx/superText';
import { drawTitleBg, setHudItemIcon } from '../ui';
import { drawItemIcon } from '../items';
import { dummyStage, trainingStage } from './training';
import { fallbackEnemy, type EnemyFactory, type World } from './world';

const local = (key: string) => ({
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

/** 본부 모듈을 엔진 모양으로 감싼다 */
/** 필드 시각 (초). 입장할 때 본편 시각과 합치고, 걸을 때마다 늘어난다 */
/** 필드 제목 화면 글자 (이름 「괴이 ː ANOMALY」) */
const VISIT_TITLE = { title: '괴이 ː ANOMALY', sub: '필드 · 요원들을 만나고 본편 대화를 이어갑니다' };
const fieldClock: { sec: number | null; place: string } = { sec: null, place: '' };
/** 가계부 잔고 (본편 상태창 잔고와 같은 장부, bridge.wallet). 모르거나 잔고 칸을 끈 채팅이면 null */
const fieldWallet: { won: number | null } = { won: null };
/** 관찰 창(F9) 켜짐: 오른쪽 위 자리를 같이 쓴다 */
let observing = false;
const observerOn = () => observing;
/** 필드 가게 창이 쓰는 돈·장부 (hqAdapter 안에서 채운다: 가계부 다리·방문 id가 거기 있다) */
const fieldLink: { pay?: (amount: number, memo: string) => Promise<number | null>; record?: (text: string) => void; fact?: (key: string, value: string) => void; nearPerson?: () => string | null; gift?: (who: string, item: string, counts: boolean) => void } = {};
const wonText = (n: number) => `${n < 0 ? '−' : ''}₩ ${Math.abs(Math.trunc(n)).toLocaleString('en-US')}`;

function hqAdapter(bridge: Partial<GameBridge> | undefined, ui: { chooseFloor: HubHost['chooseFloor']; sfx: (n: string) => void; overlay?: HubHost['overlay']; rules?: () => ClockRules; shop?: (id: string) => string | null; choose?: (o: { title: string; lines?: string[]; options: string[]; cancel?: boolean }) => Promise<number> }): HqModuleLike & { goto(place: string): void; visitReady: Promise<void>; visitor(): { agentId: string; name: string } } {
  const map = hqMap();
  const b = bridge as (Partial<GameBridge> & { slot?: number; photo?: (name: string) => string | undefined }) | undefined;
  // 본부 걷기는 엔진 벨트 장면(engine/hub.ts): 건물 지도는 hqMap(), 엔진은 장면 옮기기·그리기
  // 본부 방문: 상태 태그로 정한 방(사무실·휴게실·의무실)에 요원을 세운다. 들어가기 전에 한 번 읽는다
  let present: { name: string; room: string }[] = [];
  // 필드 시계 규칙 (설정 → 필드 시간, 채팅별). 바꾸면 다음 행동부터
  const rules = () => ui.rules?.() ?? DEFAULT_CLOCK;
  let visitor = { agentId: '', name: '' };
  let ready = false;
  const visitReady = (b?.visit
    ? b.visit.state().then((v) => { visitor = v.visitor; present = v.agents.filter((a) => a.room).map((a) => ({ name: a.name, room: a.room! })); }).catch(() => {})
    // 시연판(본편 연결 없음): 생태계를 볼 수 있게 요원 몇 명을 세운다
    : Promise.resolve().then(() => { present = [{ name: '잼트리', room: 'office' }, { name: '쟈알디', room: 'office' }, { name: '큐라스', room: 'lounge' }, { name: '고르고디오', room: 'lounge' }, { name: '데쥬레', room: 'infirmary' }]; }))
    // 본부에 있는 요원의 인물 팩(생활 클립·전투)을 받아 둔다 (없는 인물은 방문 요원 그림·실루엣)
    .then(() => Promise.all(present.map((p) => loadChar(p.name)))).then(() => { ready = true; });
  // 필드 시각은 본편 상태줄 시각에서 시작한다 (docs/필드_세계_NPC_설계.md 16-3). 유저 소속·신분도 같이
  let me: { faction: string; level: number | null } = { faction: 'A00', level: 1 };
  // 시연판(본편 없음): 시계를 10시에서 시작 (?hour=숫자 로 바꿈) — 근무·시간대·시간 보내기를 볼 수 있게
  if (!b?.card && fieldClock.sec === null) {
    const h = Number(typeof location !== 'undefined' ? new URLSearchParams(location.search).get('hour') ?? 10 : 10);
    fieldClock.sec = (Number.isFinite(h) ? ((h % 24) + 24) % 24 : 10) * 3600;
  }
  void b?.card?.().then((snap) => {
    if (fieldClock.sec === null && snap?.minute != null) fieldClock.sec = snap.minute * 60;
    if (snap) me = { faction: snap.identity?.faction || snap.faction || 'A00', level: snap.identity?.level ?? null };
  }).catch(() => {});
  // 인물 기록(호감 단계·호칭)과 세력 평판: 대사 칸·몹 반응에 쓴다. 기록이 갱신되면 다시 읽는다
  const peopleBy = new Map<string, PersonView>();
  const factionBy = new Map<string, FactionView>();
  const readPeople = () => {
    void b?.people?.people().then((l) => { peopleBy.clear(); for (const p of l) peopleBy.set(p.name, p); }).catch(() => {});
    void b?.people?.factions().then((l) => { factionBy.clear(); for (const f of l) factionBy.set(f.code, f); }).catch(() => {});
  };
  // 잔고: 들어갈 때, 본편 갱신기가 끝날 때(거래를 적었을 수 있음) 다시 읽는다
  const readWallet = () => void b?.wallet?.balance().then((n) => { fieldWallet.won = n; }).catch(() => {});
  readPeople();
  readWallet();
  b?.people?.onChange(() => { readPeople(); readWallet(); });
  /** 필드 거래: 같은 장부에 출처 「필드」로 적는다 (+ 들어옴, − 나감). 가게·거래 화면이 이걸 부른다 */
  const pay = async (amount: number, memo: string): Promise<number | null> => {
    const after = (await b?.wallet?.add(amount, memo, { place: fieldClock.place || undefined, time: fieldClock.sec === null ? undefined : clockText(fieldClock.sec) }).catch(() => null)) ?? null;
    if (after !== null) {
      fieldWallet.won = after;
      void b?.field?.record({ kind: 'trade', text: `${memo} ${amount < 0 ? '−' : '+'}${Math.abs(amount).toLocaleString('en-US')}원`, scene: fieldClock.place || undefined, weight: 1, visit: visitId }).catch(() => {});
    }
    return after;
  };
  // 시연판(본편 없음): 가계부 대신 이번 판 동안만 쓰는 지갑 (시작 잔고 기본값과 같은 14만 원)
  if (!b?.wallet) fieldWallet.won = 140_000;
  fieldLink.pay = (amount, memo) => (b?.wallet ? pay(amount, memo) : Promise.resolve((fieldWallet.won = (fieldWallet.won ?? 0) + amount)));
  fieldLink.record = (text) => void b?.field?.record({ kind: 'act', text, scene: fieldClock.place || undefined, weight: 1, visit: visitId }).catch(() => {});
  fieldLink.fact = (key, value) => void b?.field?.record({ kind: 'act', text: `${key}: ${value}`, scene: fieldClock.place || undefined, weight: 1, fact: { key, value }, visit: visitId }).catch(() => {});
  // 개발 도구·브라우저 시험
  (globalThis as { __goeiWallet?: unknown }).__goeiWallet = { pay, balance: () => fieldWallet.won };
  /** 이번 필드 방문 id (방문마다 호감·평판 상한을 따로 세게) */
  const visitId = `v${Date.now().toString(36)}`;
  const ROOM_SCENE: Record<string, string> = { office: 'office', lounge: 'lounge', infirmary: 'clinic' };
  // 필드 세계 (src/game/world): 요원은 처음 선 방에서 서성이고 이웃 장면을 오간다, 거리·로비는 몹이 오간다.
  // 씨앗: 주소 ?seed=숫자 가 있으면 그것 (재현), 없으면 이번 입장마다 새로
  const seedParam = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('seed') : null;
  const seed = seedParam ? (Number(seedParam) >>> 0 || hashSeed(seedParam)) : (Date.now() >>> 0);
  let sim: WorldSim | null = null;
  // 모델 대화 한 번(창을 열고 닫을 때까지) = 시계 +10분 (사용자 확정 2026-10-26)
  if (typeof window !== 'undefined') window.addEventListener('goei:talk-closed', () => { if (fieldClock.sec !== null) fieldClock.sec += rules().talk * 60; });
  if (typeof window !== 'undefined') window.addEventListener('keydown', (e) => { if (e.key === 'F9' || e.key === '`') { observing = !observing; e.preventDefault(); } });
  const world = () => {
    if (!sim && ready) {
      sim = createHqWorld(map, seed, present.filter((p) => ROOM_SCENE[p.room]).map((p) => ({ name: p.name, scene: ROOM_SCENE[p.room] })), hasCharClip, { stance: (f) => factionBy.get(f)?.stage ?? null });
      chatter = new Chatter(sim, new Lines(dialogueData as unknown as DialogueData, sim.rng), lineCtx);
    }
    // 개발 도구·브라우저 시험: 세계를 들여다본다 (관찰 창과 같은 정보)
    if (sim) (globalThis as { __goeiWorld?: WorldSim }).__goeiWorld = sim;
    return sim;
  };
  let chatter: Chatter | null = null;
  /** 말하는 사람 기준 대사 칸: 플레이어 소속·직급, 적으로 보나 (호감 적대 구간·세력 적대·싸움 중) */
  const lineCtx = (a: Actor): LineCtx => {
    const hour = fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24;
    const named = a.def.kind === 'named' ? peopleBy.get(a.def.name) : undefined;
    const fac = a.def.kind === 'mob' ? sim?.mobFaction(a) ?? (dialogueData as unknown as DialogueData).npc[NPC_TYPE[a.def.archetype ?? a.def.name] ?? '']?.faction ?? null : named?.faction ?? null;
    const enemy = a.act === 'argue' || a.plan === 'chase' || named?.affinity.cell === 'hostile' || (!!fac && factionBy.get(fac)?.stage === 'hostile');
    return { hour, faction: me.faction, level: me.level, enemy };
  };
  // 필드 장부: 이름 인물에게 한 일은 그때그때, 몹은 장면마다 묶어서 (몹 개인 잡담·스쳐 지나감은 넘기지 않음, 13장)
  const mobHits = new Map<string, { n: number; witness?: { faction: string; named: boolean } }>();
  const flushMobs = (sceneId: string) => {
    const m = mobHits.get(sceneId);
    if (!m || !m.n) return;
    mobHits.delete(sceneId);
    const name = map.scenes.find((s) => s.id === sceneId)?.name ?? sceneId;
    void b?.field?.record({ kind: 'provoke', text: `${name}에서 사람 ${m.n}명을 때렸다`, scene: name, weight: m.n >= 3 ? 2 : 1, visit: visitId, ...(m.witness ? { witness: m.witness } : {}) }).catch(() => {});
  };
  /** 마지막으로 있던 지역 (승강장은 지역 없음) */
  let lastDistrict: string | null = null;
  /** 이 장면에서 이미 싸웠나 (싸움 = 장면당 한 번 +10분, 사용자 확정) */
  let foughtHere = false;
  const record = (evs: SimEvent[]) => {
    for (const e of evs) {
      // 기절한 불량배·취객·소매치기가 떨어뜨린 돈: 줍는다 (가계부에 필드 수입). 훔친 돈이 섞였으면 그렇게 적는다
      if (e.kind === 'drop' && e.amount > 0) {
        const c = e.who.charCodeAt(e.who.length - 1) - 0xac00;
        const memo = e.stolen ? '소매치기에게서 되찾은 돈' : `${e.who}${c >= 0 && c <= 11171 && c % 28 !== 0 ? '이' : '가'} 떨어뜨린 돈`;
        void fieldLink.pay?.(e.amount, memo);
        (globalThis as { __goeiEngine?: { world?: { say(t: string, s: number): void } } }).__goeiEngine?.world?.say(`${e.amount.toLocaleString('en-US')}원을 주웠다`, 2);
        continue;
      }
      if (e.kind !== 'hurt') continue;
      if (!foughtHere) { foughtHere = true; if (fieldClock.sec !== null) fieldClock.sec += rules().fight * 60; }
      const w = sim;
      if (!w) return;
      // 목격: 그 장면의 소속 있는 사람 (이름 인물이 보면 named)
      const here = w.inScene(e.scene);
      const namedWit = here.find((q) => q.def.kind === 'named' && q.def.name !== e.who && peopleBy.get(q.def.name)?.faction);
      const mobWit = here.find((q) => w.mobFaction(q));
      const witness = namedWit ? { faction: peopleBy.get(namedWit.def.name)!.faction, named: true } : mobWit ? { faction: w.mobFaction(mobWit)!, named: false } : undefined;
      const sceneName = map.scenes.find((s) => s.id === e.scene)?.name ?? e.scene;
      if (e.named) {
        void b?.field?.record({ kind: 'hurt', text: `${sceneName}에서 ${e.who}을(를) 때렸다`, scene: sceneName, who: [e.who], weight: 2, visit: visitId, ...(witness ? { witness } : {}) }).catch(() => {});
      } else {
        const m = mobHits.get(e.scene) ?? { n: 0 };
        m.n++;
        m.witness ??= witness;
        mobHits.set(e.scene, m);
      }
    }
  };
  let flushT = 0;
  const clockView = () => { const c = new FieldClock(fieldClock.sec === null ? null : fieldClock.sec / 60); return c; };
  // 필드 행위자를 에일린 공격 표적으로 (전투 몸이 아니므로 가짜 몸을 건넨다. 보이는 장면만)
  let lifeScene = '';
  fighterHooks.extraTargets = () => {
    const w = sim;
    if (!w || !lifeScene) return [];
    return w.inScene(lifeScene).filter((a) => a.act !== 'down').map((a) => ({
      x: a.x, y: a.y, z: 0,
      body: { id: -1, team: 'enemy', kind: 'npc', x: a.x, y: a.y, z: 0, dir: a.face, hp: Math.max(1, a.hp ?? 1), hpMax: a.hpMax ?? 1, alive: true, stop: 0, frame: () => ({ hit: [], hurt: [] }), step: () => {},
        // 몹은 등급 체력이 있다 (설계 2-3): 에일린 피해가 그대로 깎인다
        applyHit: (h: { dir: 1 | -1; attackId: number; dmg?: number }) => (w.hitActor(a.def.id, h.dir, h.attackId, h.dmg ?? 12) ? { kind: 'hit' as const } : { kind: 'immune' as const }) } as unknown as Body,
    }));
  };
  // 선물 상대: 지금 장면에서 주인공과 가까운 이름 인물
  let lastAt = { x: 0, y: 0 };
  fieldLink.nearPerson = () => {
    const w = sim;
    if (!w || !lifeScene) return null;
    const near = w.inScene(lifeScene).filter((a) => a.def.kind === 'named' && a.act !== 'gone' && Math.abs(a.x - lastAt.x) < 180).sort((p, q) => Math.abs(p.x - lastAt.x) - Math.abs(q.x - lastAt.x))[0];
    return near?.def.name ?? null;
  };
  // 선물 사건: 오늘 처음이면 gift(인물 기록이 「작은친절」 호감 계기로), 아니면 그냥 행동
  fieldLink.gift = (who, item, counts) => {
    const c = item.charCodeAt(item.length - 1) - 0xac00;
    const text = `${who}에게 ${item}${c >= 0 && c <= 11171 && c % 28 !== 0 ? '을' : '를'} 선물했다`;
    void b?.field?.record({ kind: counts ? 'gift' : 'act', text, scene: fieldClock.place || undefined, who: [who], weight: 1, visit: visitId }).catch(() => {});
  };
  const life: HubLife = {
    tick: (dt, at) => {
      lastAt = { x: at.x, y: (at as { y?: number }).y ?? 0 };
      if (lifeScene && lifeScene !== at.scene) { flushMobs(lifeScene); foughtHere = false; endFights(false); }
      lifeScene = at.scene;
      const w = world();
      if (!w) return;
      // 무기를 들이민 주인공(겁 반응): 무기를 꺼낸 채 바라보는 쪽
      const pl = (globalThis as { __goeiEngine?: { world?: { player?: unknown } | null } }).__goeiEngine?.world?.player;
      const P = pl instanceof FighterPlayer ? pl.core.P : null;
      w.step(dt, { ...at, hour: fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24, armed: !!P?.armed, face: P?.face ?? 1 });
      const evs = w.events.splice(0);
      record(evs);
      chatter?.step(dt, at.scene, at.x, evs);
      if ((flushT += dt) > 20) { flushT = 0; flushMobs(at.scene); }
    },
    lifeTime: () => sim?.time ?? 0,
    hit: (sceneId, boxes, dir) => world()?.hitBoxes(sceneId, boxes, dir).length ?? 0,
    actors: (sceneId) => (world()?.inScene(sceneId) ?? []).map((a) => {
      const st = a.seat ? world()?.graph.scene(sceneId)?.seats?.[a.seat.i] : undefined;
      return { id: a.def.id, name: a.def.name, kind: a.def.kind, x: a.x, y: a.y, face: a.face, look: a.def.look, moving: a.act === 'walk', clip: a.clip, since: a.clipAt, icon: a.icon, say: a.say,
        ...(a.seat && st ? { seat: { box: st.box, dir: a.seat.dir, kind: a.seat.kind, x: a.seat.x, y: a.seat.y } } : {}) };
    }),
    observer: (sceneId) => (observing && sim ? observerLines(sim, clockView(), sceneId, seed) : null),
    // 몹: 인물 팩(look = 몹 그림 이름, src/game/world/mobs.ts looks) → 받는 동안·없으면 실루엣. 처음 보이는 그림은 그때 받는다
    drawMob: (c, a) => {
      if (a.look && !charArt(a.look)) void loadChar(a.look);
      if (!(a.look && drawCharClip(c, a.look, a.x, a.y, a.face, performance.now(), a.clip, (a.since ?? 0) * 1000))) silhouette(c, a);
    },
    combat: (api, sceneId) => combatStep(api, sceneId),
  };
  // ── 필드 전투 AI (2026-10-29 AI 세팅): 주인공을 막아선 몹(적대 세력·경찰 출동·시비 뒤 맞섬)은 그 그림의 인물 팩으로 전투 AI 몸(ai-char:<그림>)을 세워 싸운다.
  // 몸이 쓰러지면 1.5초 뒤 행위자로 되돌려 기절(깨면 떠남)·장부 기록. 주인공이 장면을 떠나면 싸움은 끊기고 행위자는 그 자리에 선다
  const fights = new Map<string, { body: Body & { hp: number; hpMax: number; alive: boolean; label: string }; t: number; scene: string }>();
  const endFights = (down: boolean) => {
    const w = sim;
    for (const [id, f] of fights) { f.body.alive = false; w?.fromFight(id, f.body.x, f.body.y, down); }
    fights.clear();
  };
  function combatStep(api: { spawn(s: { kind: string; x: number; y: number }): void; world: { bodies: readonly Body[] } }, sceneId: string) {
    const w = sim;
    if (!w) return;
    // 엔진 spawn은 몸을 돌려주지 않는다 → 생긴 뒤 목록 끝의 몸
    const spawn = (spec: { kind: string; x: number; y: number }): Body | undefined => { const n = api.world.bodies.length; api.spawn(spec); return api.world.bodies.length > n ? api.world.bodies[api.world.bodies.length - 1] : undefined; };
    for (const [id, f] of fights) {
      if (f.scene !== sceneId || !f.body.alive || !api.world.bodies.includes(f.body)) { f.body.alive = false; w.fromFight(id, f.body.x, f.body.y, false); fights.delete(id); continue; }
      if (f.body.hp > 0) continue;
      if ((f.t += 1 / 30) < 1.5) continue;
      f.body.alive = false;
      w.fromFight(id, f.body.x, f.body.y, true);
      fights.delete(id);
    }
    for (const a of w.challengers(sceneId)) {
      const look = a.def.look ?? a.def.name;
      if (!charArt(look)) { void loadChar(look); continue; }
      const b = spawn({ kind: `ai-char:${look}`, x: a.x, y: a.y });
      if (!b) continue;
      if (!(b instanceof FighterAi)) { b.alive = false; continue; }
      if (!w.toFight(a.def.id)) { b.alive = false; continue; }
      // 몸 = 그 몹이 생겨날 때 굴린 힘민체지정 (10-30 사용자: 등급 배수 버림). 이름표는 원형 이름
      if (a.base) { b.base = a.base; b.stat = derive(a.base); b.baseHp = b.stat.hp; }
      b.hp = Math.max(1, a.hp ?? b.hpMax); b.hpMax = Math.max(1, a.hpMax ?? b.hpMax);
      b.label = a.def.name;
      (b as unknown as { dir: 1 | -1 }).dir = a.face;
      fights.set(a.def.id, { body: b as typeof b & { hp: number; hpMax: number; alive: boolean; label: string }, t: 0, scene: sceneId });
    }
  }
  const visitors = (sceneId: string) => {
    const here = present.filter((p) => ROOM_SCENE[p.room] === sceneId && !!charArt(p.name));
    const sc = map.scenes.find((s) => s.id === sceneId);
    if (!sc || !here.length) return [];
    const [top, bot] = sc.lane ?? [LANE_TOP, LANE_BOT];
    // 방 가운데 쪽에 고르게
    const slots = [[0.36, 0.55], [0.5, 0.35], [0.62, 0.75], [0.44, 0.9], [0.72, 0.45], [0.28, 0.8]].map(([fx, fy]) => [sc.length * fx, fy]);
    return here.slice(0, slots.length).map((p, i) => ({ name: p.name, x: slots[i][0], y: top + (bot - top) * slots[i][1], face: (slots[i][0] > sc.length / 2 ? -1 : 1) as 1 | -1 }));
  };
  const hub = makeHub(
    {
      map: () => map,
      // 옛 본부 메뉴 자리는 닫혀 있다 (hqMap). 열린 자리는 앉기·가게·대화 자리뿐
      openPlace: () => {},
      bark: () => null,
      chooseFloor: (o, pick) => ui.chooseFloor(o, pick),
      sfx: (n) => ui.sfx(n),
      visitors,
      life,
      // 장면을 옮기면 장부에 이동 사건과 지금 위치(확정 사실)를 남긴다
      entered: (to, from, walkedPx) => {
        fieldClock.place = to.name;
        // 장면 넘어가기 10분, 지하철로 다른 지역에 내리면 지역 이동 30분 (사용자 확정 2026-10-26, 설정 → 필드 시간). 걸은 거리는 시계와 무관
        void walkedPx;
        const d = hqDistrict(to.id);
        const region = isRegionMove(lastDistrict ?? hqDistrict(from.id), d);
        if (d) lastDistrict = d;
        const sec = (region ? rules().region : rules().scene) * 60;
        if (fieldClock.sec !== null) fieldClock.sec += sec;
        const at = fieldClock.sec === null ? '' : ` (${clockText(fieldClock.sec)})`;
        void b?.field?.record({ kind: 'move', text: `${from.name} → ${to.name}${at}`, scene: to.name, weight: 1, fact: { key: '주인공 위치', value: to.name } }).catch(() => {});
        if (fieldClock.sec !== null) void b?.field?.record({ kind: 'move', text: `필드 시각 ${clockText(fieldClock.sec)}`, scene: to.name, weight: 1, fact: { key: '필드 시각', value: clockText(fieldClock.sec) } }).catch(() => {});
      },
      overlay: ui.overlay,
      hour: () => (fieldClock.sec === null ? null : (fieldClock.sec / 3600) % 24),
      shop: (id) => ui.shop?.(id) ?? null,
      // 앉기·눕기 자리: 시간 보내기 (16-2장). 고른 만큼 시계가 간다
      sat: () => {
        const opts = waitOptions(rules(), fieldClock.sec === null ? null : fieldClock.sec / 60);
        if (!opts.length || !ui.choose) return;
        const now = fieldClock.sec === null ? null : clockText(fieldClock.sec);
        void ui.choose({ title: '시간 보내기', lines: now ? [`지금 ${now}`] : [], options: [...opts.map((o) => o.label), '그냥 있기'], cancel: true }).then((i) => {
          const o = i >= 0 ? opts[i] : undefined;
          if (!o) return;
          if (fieldClock.sec !== null) fieldClock.sec += o.minutes * 60;
          const at = fieldClock.sec === null ? '' : clockText(fieldClock.sec);
          if (at) void b?.field?.record({ kind: 'wait', text: `${fieldClock.place || '필드'}에서 시간을 보냈다 (${at})`, scene: fieldClock.place || undefined, weight: 1, fact: { key: '필드 시각', value: at } }).catch(() => {});
        }).catch(() => {});
      },
      // 본부 대화창이 떠 있으면 머리 위 표시를 숨긴다 (독립 검수: 브리핑 뒤 ↓ 표시)
      busy: () => typeof document !== 'undefined' && !!document.querySelector('.hq-talk, .hq-over:not(:empty)'),
    },
    (place) => whereIs(place as never),
  );
  return {
    visitReady,
    visitor: () => visitor,
    hub: () => hub,
    goto: (place: string) => hub.goto(place),
    isOpen: () => false,
    mount() {},
    onReturn() {},
    unmount() {},
  };
}

/** 주인공 머리 꼭대기 (발 기준 화면 px, 음수, 원근 미포함) */
function heroTop(p: World['player']): number {
  return p instanceof FighterPlayer ? charTop(p.art.key) : -230;
}

function hudState(w: World, shell: Shell): HudState {
  const p = w.player;
  const boss = w.boss();
  const f = w.floor;
  return {
    agent: { name: p.label ?? '쟈알디', color: p instanceof FighterPlayer ? p.art.cfg.color : '#c0453a', portrait: p instanceof FighterPlayer ? charFace(p.art.key, 64, p.dir < 0) : null },
    hp: p.hp,
    maxHp: p.hpMax,
    energy: p.skillCd > 0 ? 75 - p.skillCd : 75,
    maxEnergy: 75,
    gauge: p.gauge,
    armor: p.armor,
    // 에일린은 탄창 대신 우하단 기술 상자에 총열 열을 보인다
    weapon: heldWeapon(w) ?? ((p as { core?: unknown }).core ? null : { name: '권총', mag: p.ammo, magMax: p.mag, reserve: p.reserve, reload: p.moveKey === 'reload' ? p.mf / 4 : null }),
    items: w.items.map((it) => ({ id: it?.id, label: it?.label ?? '', count: it?.n ?? 0 })),
    field: fieldClock.sec !== null || fieldClock.place || (w.stage?.id === 'hq' && fieldWallet.won !== null) ? { clock: fieldClock.sec === null ? undefined : clockText(fieldClock.sec), place: fieldClock.place || undefined, wallet: fieldWallet.won === null ? undefined : wonText(fieldWallet.won) } : undefined,
    floor: { depth: '', name: f.title },
    perks: p instanceof FighterPlayer && p.perks.active ? perkChips(p) : undefined,
    boss: boss ? { name: boss.label, hp: boss.hp, max: boss.hpMax } : null,
    // 아래 자막은 3초까지만 (바닥 띠를 오래 가리지 않게)
    message: w.subtitle && w.tick - w.subtitleAt < 90 ? w.subtitle.text : undefined,
    // 가드 게이지는 가드 중이거나 닳았을 때만
    meters: [
      ...(p.guarding || p.guardMeter < 100 ? [{ label: '가드', v: p.guardMeter, max: 100, color: '#9ad08a' }] : []),
      ...(p instanceof FighterPlayer && p.dodgeMeter < p.dodgeMax ? [{ label: '회피', v: p.dodgeMeter, max: p.dodgeMax, color: '#8fc6e8' }] : []),
    ],
    // 걸린 상태 효과 (출혈×2 5 · 오염×1 …)
    status: ((p as { status?: StatusSet }).status?.view() ?? []).map((v) => ({ label: `${v.label}${v.stacks > 1 ? `×${v.stacks}` : ''}${v.t !== null ? ` ${Math.ceil(v.t)}` : ''}`, good: false })),
    compact: shell.touchShown,
    device: shell.touchShown ? 'touch' : shell.input.last,
    navigation: navigationFeedback(w),
  };
}

/** 임시 무기를 든 동안 무기 칸은 그 무기의 남은 횟수·탄 (아이템 모듈이 notes.held에 남김) */
function heldWeapon(w: World) {
  const h = w.notes.held as { name: string; uses: number; max: number } | null | undefined;
  return h ? { name: h.name, mag: h.uses, magMax: h.max, reserve: 0, reload: null } : null;
}

export interface Wiring {
  mods: EngineModules;
  /** 게임이 붙을 상자 (껍데기가 있으면 그 무대) */
  box: HTMLElement;
  bind(game: Game): void;
}

export function engineModules(box: HTMLElement, bridge?: Partial<GameBridge>): Wiring {
  setHudItemIcon(drawItemIcon as never);
  const audio = createGameAudio(local('goei-game-audio'));
  let game: Game | null = null;
  /** 필드 입장 판정. 막히면 이유를 보이고 「밖에 있어요」로 고칠 수 있다. 들어가도 되면 true */
  async function gate(): Promise<boolean> {
    const f = bridge?.field;
    if (!f?.entry) return true;
    let info = await f.entry().catch(() => null);
    while (info && !info.allow) {
      const i = await shell.choose({ title: '지금은 들어갈 수 없어요', lines: [info.reason ?? ''], options: ['닫기', '밖에 있어요'] });
      if (i !== 1) return false;
      f.override?.('outside');
      info = await f.entry().catch(() => null);
    }
    if (info?.notice) await shell.choose({ title: '알림', lines: [info.notice], options: ['확인'] });
      return true;
  }
  // 게임 안 설정: 리스에서는 플러그인이 이 채팅 변수로 둔다(메인 설정 → 필드와 같은 값). 아직 없으면 이 기기에 남은 값으로 시작
  const uiPrefs = bridge?.uiPrefs;
  const store: SettingsStore | undefined = uiPrefs ? {
    load: async () => (await uiPrefs.load().catch(() => null)) ?? localStore.load(),
    save: (t) => { uiPrefs.save(t); localStore.save(t); },
  } : undefined;
  let fieldShop: FieldShop | null = null;
  const shell = mountGameShell(box, {
    synth: true,
    bag: { available: () => !!game?.inHub && !!fieldShop, open: () => fieldShop?.openBag() },
    store,
    title: VISIT_TITLE.title,
    sub: VISIT_TITLE.sub,
    pauseInfo: () => '',
    onNew: async () => { if (await gate()) game?.start_new(); },
    onContinue: async () => { if (await gate()) game?.start_new(); },
    // 필드는 저장 슬롯이 없다: 상태는 본편 채팅 변수(가방 $fd_state 등)에 있다
    hasSave: () => false,
    onRetreat: () => bridge?.visit ? bridge.close?.() : game?.endRun('withdraw'),
    onTitle: () => game?.toTitle(),
    toLocal: bridge?.viewport ? (x, y, el) => bridge.viewport!.toLocal(x, y, el) : undefined,
    field: bridge?.visit ? {
      onExit: () => bridge.close?.(),
      // 옛 플러그인(mode 없음)은 전체 화면 칸을 숨긴다
      fullscreen: bridge.viewport && 'mode' in bridge.viewport ? { enter: (k) => bridge.viewport!.enter(k), exit: () => bridge.viewport!.exit(), mode: () => bridge.viewport!.mode ?? null } : undefined,
    } : undefined,
  });
  // 필드 전투 효과 틀 (fx/fieldFx.ts). 히트스톱·필살 컷인 동안은 월드를 멈춘다(mods.frozen)
  const ffx = new FieldFx();
  (globalThis as { __goeiFieldFx?: unknown }).__goeiFieldFx = ffx; // 시험용
  ffx.sfx = (n) => audio.event({ type: n === 'super' ? 'super' : 'hit', kind: n === 'slam' ? 'super' : undefined, strength: 3 } as never);
  const cutins = new Map<string, HTMLImageElement>();
  if (bridge?.visit && bridge.assets) void loadFieldFx(bridge.assets, ffx, cutins);
  const inField = () => !!game?.inHub && !!bridge?.visit && !mods.blocking?.() && !shell.paused;
  // NPC 자유 대화 (npcLink.ts): 껍데기 놀이판 층에 대화창
  // 본부 방문: 머리 위 이름표·말풍선과 아래 한 줄 입력 (talk.ts)
  const visit = bridge?.visit ? mountTalk(shell.stage.ui, bridge.visit, bridge.field) : null;
  const npc = linkNpcTalk({
    visit: visit ? name => { if (name) visit.open(name); } : undefined,
    layer: shell.stage.ui,
    bridge,
    settings: () => shell.settings,
    agent: () => runAgent,
    day: () => (fieldClock.sec === null ? 0 : Math.floor(fieldClock.sec / 86400)),
    photo: (k) => (bridge as { photo?: (n: string) => string | undefined } | undefined)?.photo?.(k) || (demoPhotos as Record<string, string>)[k],
    sfx: (n) => audio.play(n as never),
    onOpen: (on) => shell.touch.setVisible(!on && shell.mode === 'play'),
  });
  (globalThis as { __goeiNpc?: unknown }).__goeiNpc = npc; // 시험용
  (globalThis as { __goeiStage?: unknown }).__goeiStage = shell.stage; // 시험용
  // 필드 요원: 지금 그림(몸 약 97도트)을 화면 약 255px로 (PixelLab 256 캔버스 몸 약 170도트 ×1.5 크기를 미리 보기). 원근은 view.persp
  setPixelScale(bridge?.visit ? 2.625 : 2.75);
  (globalThis as { __goeiSetPixel?: (p: number) => void }).__goeiSetPixel = setPixelScale; // 시험용
  let guardA = 0; // 방어 게이지 불투명도
  // 시연용 방: 적 시험장은 적 모듈 것(?start=arena), 아이템 진열(?start=items)
  const itemStage: StageModule = {
    id: 'itemroom',
    label: '아이템 진열실',
    firstFloor: () => ({ id: 'itemroom', title: '아이템 진열실', length: 3200, startX: 300, exitX: Infinity, banner: '아이템 진열실 · E 줍기·들기 · A 던지기·휘두르기', encounters: [{ triggerX: 0, lockFrom: 0, lockTo: 3200, waves: [[{ kind: 'dummy', x: 1600, y: 560 }, { kind: 'dummy', x: 2400, y: 620 }]] }] }),
    nextFloor: () => null,
  };
  // 대련 방 (전투 AI 시험, docs/전투_AI_설계.md): ?start=stage=spar  ·  난이도 ?ai=easy|normal|hard|nightmare
  const aiDiff: Difficulty = (() => { try { const v = new URLSearchParams(location.search).get('ai'); return v && v in DIFF ? (v as Difficulty) : 'normal'; } catch { return 'normal'; } })();
  const sparStage: StageModule = {
    id: 'spar',
    label: '대련',
    firstFloor: () => ({
      id: 'spar-room', title: '대련', length: 2400, startX: 500, exitX: Infinity,
      banner: `대련 · 전투 AI (${aiDiff}) · 1:1 뒤 1:2`,
      encounters: [{ triggerX: 0, lockFrom: 0, lockTo: 2400, waves: [[{ kind: 'ai-eileen', x: 1100, y: 580 }], [{ kind: 'ai-eileen', x: 1300, y: 540 }, { kind: 'ai-eileen', x: 200, y: 640 }]] }],
    }),
    nextFloor: () => null,
  };
  let squad = new Squad(DIFF[aiDiff].melee);
  let aiN = 0;
  const unknownKinds = new Set<string>();
  const enemyFactory: EnemyFactory = (spec, w) => {
    // 통합 테스트룸 인물 AI: 'ai-char' = 주인공과 같은 인물, 'ai-char:<이름>' = 그 인물 팩(받아 둔 것만). 대련('ai-eileen')도 주인공이 인물 팩이면 그 인물로
    if ((spec.kind === 'ai-char' || spec.kind.startsWith('ai-char:') || spec.kind === 'ai-eileen') && w.player instanceof FighterPlayer) {
      const who = spec.kind.startsWith('ai-char:') ? spec.kind.slice(8) : '';
      const art = who ? charArt(who) : w.player.art;
      if (!art) { void loadChar(who); return fallbackEnemy(spec, w); }
      if (aiN === 0) squad = new Squad(DIFF[aiDiff].melee);
      const n = ++aiN;
      const personas = [{ aggression: 0.75, patience: 0.35, zoning: 0.2, courage: 0.9 }, { aggression: 0.35, patience: 0.8, zoning: 0.3, courage: 0.8 }, { aggression: 0.4, patience: 0.5, zoning: 0.85, courage: 0.7 }];
      const ai = new FighterAi((w.player as unknown as { clips: ConstructorParameters<typeof FighterAi>[0] }).clips, art, { id: `ai${n}`, grade: 'B', difficulty: aiDiff, persona: personas[(n - 1) % personas.length], seed: 1000 + n, squad, label: `AI ${art.cfg.name} ${n}` });
      ai.x = spec.x; ai.y = spec.y;
      // 힘민체지정만으로(10-30 사용자): 이름 있는 55명은 표, 그 밖의 NPC는 한 명마다 합 25를 무작위로 나눔. 보정은 퍽
      if (!BASE_STATS[art.cfg.name]) { ai.base = rollBase(Math.random); ai.stat = derive(ai.base); ai.baseHp = ai.hp = ai.hpMax = ai.stat.hp; }
      return ai as never;
    }
    if (DEF_BY_KIND[spec.kind]) {
      const sp = spec as typeof spec & { affixes?: never };
      return createEnemy(spec.kind, spec.x, spec.y, () => w.rand(), { elite: spec.elite, affixes: sp.affixes }) as never;
    }
    if (!spec.kind.startsWith('dummy') && !unknownKinds.has(spec.kind)) {
      unknownKinds.add(spec.kind);
      console.warn('[goei] 적 모듈에 없는 종류 → 임시 적:', spec.kind);
    }
    return fallbackEnemy(spec, w);
  };
  // 대사·컷신: 말풍선은 늘, 대화창·컷신이 열리면 전투를 멈춘다
  let world: World | null = null;
  let runAgent: AgentId = 'eileen'; // 주인공은 에일린 (쟈알디는 부장 NPC)
  const storyRoot = document.createElement('div');
  // 넘치는 창(층 단추 등)이 바깥 틀에 스크롤바를 만들면 틀 크기가 바뀌어 화면을 다시 맞추고, 그게 되풀이되며 화면이 떨렸다 (리스 작은 창)
  storyRoot.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:15;overflow:hidden';
  shell.stage.root.appendChild(storyRoot);
  const attachVideoAudio = (event: Event) => audio.attachMedia((event as CustomEvent<VideoTrack>).detail);
  storyRoot.addEventListener(VIDEO_AUDIO_EVENT, attachVideoAudio);
  const savedFlags = (() => {
    try {
      return JSON.parse(localStorage.getItem('goei-game-story') ?? 'null') ?? undefined;
    } catch {
      return undefined;
    }
  })();
  // 메뉴 소리와 설정 화면의 음량 밀대를 소리 모듈에 잇는다 (환경음·메뉴 버스는 효과음 밀대를 따른다)
  shell.menu.onSound = (k) => audio.play(k === 'move' ? 'uiMove' : k === 'ok' ? 'uiOk' : 'uiBack');
  let vol = '';
  const syncVolume = () => {
    const s = shell.settings;
    const key = `${s.master}/${s.music}/${s.sfx}`;
    if (key === vol) return;
    vol = key;
    audio.setVolume('master', s.master);
    audio.setVolume('music', s.music);
    audio.setVolume('sfx', s.sfx);
    audio.setVolume('amb', s.sfx * 0.8);
    audio.setVolume('ui', s.sfx * 0.7);
  };
  // 발소리: 엔진이 step 사건을 따로 내지 않으므로 땅 위에서 움직인 거리로 낸다 (보폭 걸음 55 / 달리기 75)
  let foot = { x: 0, y: 0, d: 0, w: null as unknown };
  const footsteps = (w: { player: { x: number; y: number; airborne: boolean; running: boolean } }) => {
    const p = w.player;
    if (foot.w !== w) foot = { x: p.x, y: p.y, d: 0, w };
    const moved = Math.hypot(p.x - foot.x, (p.y - foot.y) * 1.5);
    foot.x = p.x;
    foot.y = p.y;
    if (p.airborne || moved > 60) return void (foot.d = 0);
    foot.d += moved;
    if (foot.d >= (p.running ? 75 : 55)) {
      foot.d = 0;
      audio.event({ type: 'step', x: p.x, vol: p.running ? 0.9 : 0.6 });
    }
  };
  (globalThis as { __goeiStoryStart?: (id: string) => void }).__goeiStoryStart = (id) => (CUTSCENES[id] || VIDEOS[id] ? story.cutscene(id) : story.say(id));
  const story: StoryApi = mountStory(
    storyRoot,
    {
      getAgent: () => runAgent,
      sfx: (n) => audio.event({ type: 'custom', name: n } as never),
      shake: (ms, amp) => shell.fx.onGameEvent({ type: 'shake', ms, amp } as never),
      anchor: (id) => {
        if (id !== 'agent' || !world) return null;
        // 껍데기 root 좌표(돌린 화면이어도 root 안에서는 가로)로 계산: 게임 화면(.gs-stage)은 translate(tx,ty) scale(k)
        const st = shell.canvas.parentElement as HTMLElement;
        const m = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(st.style.transform);
        const k = shell.stage.scale || 1;
        const ox = st.offsetLeft + (m ? +m[1] : 0) - storyRoot.offsetLeft,
          oy = st.offsetTop + (m ? +m[2] : 0) - storyRoot.offsetTop;
        const p = world.player;
        // 말풍선은 머리 위, 화면 가장자리(터치 버튼 띠) 안쪽으로
        const gx = Math.max(200, Math.min(1000, p.x - world.camX));
        // 보이는 터치 버튼(오른쪽 묶음)의 왼쪽 끝을 넘지 않게. 버튼 위치는 배치 좌표 translate라 회전과 무관
        let maxX: number | undefined;
        const tp = storyRoot.ownerDocument.querySelector<HTMLElement>('.tp');
        if (tp && tp.offsetParent) {
          let tx = 0;
          for (let n: HTMLElement | null = tp; n && n !== storyRoot.offsetParent; n = n.offsetParent as HTMLElement | null) tx += n.offsetLeft;
          for (const b of tp.querySelectorAll<HTMLElement>('.tp-b:not(.item):not(.top)')) {
            if (!b.offsetWidth || getComputedStyle(b).display === 'none') continue;
            const left = tx - storyRoot.offsetLeft + new DOMMatrix(getComputedStyle(b).transform).m41;
            if (left > storyRoot.clientWidth / 2) maxX = Math.min(maxX ?? Infinity, left);
          }
        }
        // 놀이판(게임 화면) 안쪽으로만: 폰 가로의 좌우 버튼 띠에 걸치지 않게
        let lo = ox,
          hi = Math.min(maxX ?? Infinity, ox + 1280 * k);
        // 문·승강기·벽 가구 앞을 피해, 머리에서 가장 가까운 빈 벽 구간 안에 말풍선을 둔다 (독립 검수: 말풍선이 문을 가림)
        const gap = bubbleGap(world, gx);
        if (gap) {
          lo = Math.max(lo, ox + gap[0] * k);
          hi = Math.min(hi, ox + gap[1] * k);
        }
        return { x: ox + gx * k, y: oy + Math.max(120, p.y - p.z - (world.hintShown ? 362 : 290)) * k, minX: lo, maxX: hi };
      },
      emit: (ev, arg) => world?.emit({ type: 'custom', name: ev, data: { arg } } as never),
      paused: () => shell.paused,
    },
    { saved: savedFlags },
  );
  (globalThis as { __goeiStory?: StoryApi }).__goeiStory = story; // 시험용
  const saveFlags = () => {
    try {
      localStorage.setItem('goei-game-story', JSON.stringify(story.flags));
    } catch {
      /* 저장 못 해도 진행 */
    }
  };
  const storyKeys = (e: KeyboardEvent) => {
    if (!story.isBlocking()) return;
    if (e.code === 'Escape') story.skip();
    else if (/^Digit[1-9]$/.test(e.code)) story.choose(Number(e.code.slice(5)) - 1);
    else if (['Space', 'Enter', 'KeyE', 'KeyZ', 'KeyA'].includes(e.code)) story.advance();
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', storyKeys, true);
  // 엘리베이터 층 단추 (본부). 1~5 숫자키·Esc, 누르면 닫힌다
  let floorPick: ((i: number | null) => void) | null = null;
  const floorBox = document.createElement('div');
  floorBox.className = 'goei-engine-elev';
  floorBox.hidden = true;
  storyRoot.appendChild(floorBox);
  const closeFloors = (i: number | null) => {
    floorBox.hidden = true;
    const f = floorPick;
    floorPick = null;
    f?.(i);
  };
  // 키보드: 방향키로 고르고 Enter·Space·E로 누른다 (사용자 2026-10-25)
  let floorSel = -1;
  const floorBtns = () => [...floorBox.querySelectorAll('button')] as HTMLButtonElement[];
  const markFloor = (i: number) => {
    floorSel = i;
    floorBtns().forEach((b, k) => b.classList.toggle('sel', k === i));
  };
  const stepFloor = (d: number) => {
    const bs = floorBtns();
    for (let k = 1; k <= bs.length; k++) {
      const j = (floorSel + d * k + bs.length * 2) % bs.length;
      if (!bs[j].disabled) return markFloor(j);
    }
  };
  const chooseFloor: HubHost['chooseFloor'] = (opts, pick) => {
    floorPick = pick;
    floorBox.innerHTML = opts.map((o, i) => `<button type="button" data-i="${i}"${o.open && !o.here ? '' : ' disabled'}${o.here ? ' class="here"' : ''}>${o.label}</button>`).join('');
    floorBox.hidden = false;
    markFloor(floorBtns().findIndex((b) => !b.disabled));
    audio.play('panelButton' as never);
  };
  floorBox.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (b && !b.disabled) closeFloors(Number(b.dataset.i));
  });
  const floorKeys = (e: KeyboardEvent) => {
    if (floorBox.hidden) return;
    if (e.code === 'Escape') closeFloors(null);
    // 한 줄 배치 (사용자 2026-10-25: 두 줄은 헷갈림)
    else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft') stepFloor(-1);
    else if (e.code === 'ArrowDown' || e.code === 'ArrowRight') stepFloor(1);
    else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyE') {
      if (!e.repeat && floorSel >= 0 && !floorBtns()[floorSel]?.disabled) closeFloors(floorSel);
    } else if (/^Digit[1-9]$/.test(e.code)) {
      // 숫자키 = 층 숫자(1·2·3), 지하는 4=B1, 5=B2, 6=B3
      const n = e.code.slice(5);
      const want = n === '4' ? 'B1' : n === '5' ? 'B2' : n === '6' ? 'B3' : n;
      const b = [...floorBox.querySelectorAll('button')].find((q) => q.textContent === want) as HTMLButtonElement | undefined;
      if (b && !b.disabled) closeFloors(Number(b.dataset.i));
    } else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };
  window.addEventListener('keydown', floorKeys, true);
  const hq = hqAdapter(bridge, {
    chooseFloor,
    sfx: (n) => audio.play(n as never),
    overlay: visit ? (c, people, player) => visit.draw(c, people, player) : undefined,
    choose: (o) => shell.choose(o),
    shop: (id) => fieldShop?.open(id) ?? null,
    rules: () => { const t = shell.settings; return clockRules({ scene: t.tScene, region: t.tRegion, talk: t.tTalk, fight: t.tFight, waitShort: t.tWaitShort, waitLong: t.tWaitLong }); },
  });
  // 필드 가게·가방 창 (src/game/world/fieldShop.ts): 돈은 가계부, 가방·재고는 채팅 변수 $fd_state
  fieldShop = createFieldShop({
    root: shell.stage.ui,
    store: bridge?.fieldState,
    minute: () => (fieldClock.sec === null ? null : fieldClock.sec / 60),
    balance: () => fieldWallet.won,
    pay: (amount, memo) => fieldLink.pay?.(amount, memo) ?? Promise.resolve(null),
    heal: (ratio) => { const p = game?.world?.player; if (p) p.hp = Math.min(p.hpMax, p.hp + p.hpMax * ratio); },
    record: (text) => fieldLink.record?.(text),
    rng: Math.random,
    nearPerson: () => fieldLink.nearPerson?.() ?? null,
    fact: (key, value) => fieldLink.fact?.(key, value),
    gift: (who, item, counts) => fieldLink.gift?.(who, item, counts),
  });
  // 창의 다른 탭으로 가면 일시정지 메뉴를 열어 둔다 (게임 멈춤·소리 끔). 돌아오면 「계속」으로 이어 간다
  let hiddenNow = false;
  const offHidden = bridge?.onHidden?.((h) => {
    hiddenNow = h;
    if (h) {
      visit?.close();
      if (shell.mode === 'play' && !shell.paused) shell.openPause();
      audio.setPaused(true);
    }
  });
  const cancelStoryForScene = () => {
    story.cancel();
    storyRoot.style.visibility = shell.paused ? 'hidden' : '';
  };
  // 에일린 테스트룸 전투의 소리는 화면 효과 없이 소리만
  fighterHooks.sfx = (e) => audio.event(e as never);
  fighterHooks.openDraft = (p, offers) => openDraft(shell.canvas.parentElement ?? document.body, p, { world, offers });
  const listeners: ((e: GameEvent) => void)[] = [
    (e) => {
      audio.event(e as never);
      if (game?.inHub && (e.type === 'enter:floor' || e.type === 'custom')) return; // 본부: 승강기 안내·층 제목 없음
      shell.fx.onGameEvent(e as never);
      story.event(e.type, e as never);
      if (e.type === 'run:end') saveFlags();
    },
  ];
  const mods: EngineModules = {
    frozen: () => ffx.frozen(),
    stages: [trainingStage, dummyStage, arenaStage, itemStage, sparStage],
    enemyFactory,
    hq,
    hqLayer: () => shell.stage.ui,
    hud: false,
    blocking: () => !!visit?.isOpen() || story.isBlocking() || !floorBox.hidden || npc.isOpen() || !!fieldShop?.isOpen(),
    covered: () => story.isVideoPlaying(),
    listeners,
    surface: { canvas: shell.canvas, ctx: shell.ctx },
    paused: () => shell.paused,
    openTitle: () => {
      cancelStoryForScene();
      world = null;
      shell.openTitle();
    },
    onPlay: () => shell.play(),
    frame: (dt) => {
      ffx.opt = { shake: shell.settings.shake, flash: shell.settings.flash, numbers: shell.settings.numbers };
      ffx.update(shell.paused ? 0 : dt);
      { const o = ffx.camera(); shell.canvas.style.translate = o.x || o.y ? `${o.x}px ${o.y}px` : ''; }
      syncVolume();
      audio.setPaused(hiddenNow || shell.paused);
      audio.setCutscene(story.isVideoPlaying());
      story.update(dt);
      shell.frame(dt);
      shell.input.endFrame();
    },
    overlay: (ctx, w, dt) => {
      if (!w) return;
      audio.setListener(w.camX + 640, 640);
      footsteps(w);
      ctx.save();
      ctx.scale(view.zoom, view.zoom);
      ctx.translate(-w.drawCamX - view.crop, -view.cropY);
      shell.fx.drawWorld(ctx);
      ffx.drawWorld(ctx);
      ctx.restore();
      shell.fx.drawScreen(ctx, w.player.hp / w.player.hpMax);
      const hs = hudState(w, shell);
      if (npc.isOpen()) hs.message = undefined; // 대화창이 열려 있으면 자막·안내 한 줄은 숨긴다 (같은 말이 두 번, 폰 키보드 자리)
      if (mods.blocking?.() || shell.paused) hs.navigation = undefined;
      // 필드(방문): 전투 HUD 대신 주인공 칸 (도트 얼굴·이름·체력·필살 게이지). 대화창·메뉴가 열려 있으면 숨긴다
      let cardEnd = 0;
      if (game?.inHub && !mods.blocking?.() && !shell.paused) {
        const me = hq.visitor();
        const name = me.name || (w.player instanceof FighterPlayer ? w.player.label : '방문자');
        const face = w.player instanceof FighterPlayer ? charFace(w.player.art.key, 64, w.player.dir < 0) : null;
        // 좌상단 초상화 상자 (사용자 2026-10-25: 위 목표 띠 대신)
        shell.hud.drawFieldCard(ctx, { name, face, hp: w.player.hp, maxHp: w.player.hpMax, gauge: w.player.gauge, compact: hs.compact, top: true, items: hs.items, device: hs.device, status: hs.status }, dt);
        // 오른쪽 위 필드 시각·장소·잔고 (관찰 창이 켜져 있으면 그 자리라 숨김)
        if (!observerOn()) shell.hud.drawFieldCorner(ctx, hs.field, hs.compact);
      }
      // 왼쪽 아래 기술 칸 줄 (에일린): 터치 버튼이 있으면 그 자리라 숨긴다. 자막은 그 오른쪽에
      const core = (w.player as { core?: { P: Record<string, any> } }).core;
      if (core && !shell.touchShown && !mods.blocking?.() && !shell.paused) {
        const P = core.P, clip = P.clip?.id as string | undefined, off = ['down', 'belly', 'stun'].includes(P.mode);
        const lv = P.charge >= 2 ? 3 : P.charge > 1.3 ? 2 : P.charge > 0.5 ? 1 : 0;
        const key = (b: string) => { const c = Object.keys(KEYMAP).find((k) => KEYMAP[k] === b); return c ? c.replace(/^Key/, '') : '?'; };
        cardEnd = shell.hud.drawSkillBox(ctx, { compact: hs.compact, slots: [
          { key: key('light'), icon: 'punch', name: '약공', cd: 0, off, active: ['9', '10', '11'].includes(clip ?? '') },
          { key: key('heavy'), icon: 'kick', name: '강공', cd: 0, off, active: clip === '12' },
          { key: key('shoot'), icon: 'gun', name: '사격', cd: P.overT > 0 ? P.overT / 2.6 : 0, cdText: P.overT > 0 ? P.overT.toFixed(1) : undefined, off, active: clip === '15', bar: P.heat / 100, hot: P.overT > 0 || P.heat > 70 },
          { key: key('charge'), icon: 'bolt', name: '충전', cd: 0, off, active: P.mode === 'charge', bar: P.mode === 'charge' ? P.charge / 2.2 : undefined, badge: P.mode === 'charge' && lv ? ['', '1', '2', 'MAX'][lv] : undefined },
          { key: key('skill'), icon: 'wave', name: '기술', cd: 0, off, active: clip === '22_1' },
          { key: key('super'), icon: 'star', name: '필살', cd: 0, off: off || P.sp < 100, full: P.sp >= 100, bar: P.sp / 100 },
        ] }, dt);
      }
      if (!game?.inHub) shell.hud.draw(ctx, { ...hs, messageLeft: cardEnd }, dt); // 본부에서는 전투 HUD 없음
      else if (!mods.blocking?.() && !shell.paused) {
        // 본부: 대사는 말하는 사람 머리 위 말풍선 (사용자 2026-10-25: 아래 검은 자막 상자 대신). 그 밖의 안내 한 줄은 주인공 머리 위
        const z = view.zoom, toX = (x: number) => (x - w.drawCamX - view.crop) * z, toY = (y: number) => (y - view.cropY) * z;
        const sp = (w.stage as { speech?: () => { who: string; text: string; x: number; y: number; top: number } | null }).speech?.();
        if (sp) shell.hud.drawSpeech(ctx, { x: toX(sp.x), y: toY(sp.y + sp.top) - 6, who: sp.who, text: sp.text, compact: hs.compact });
        else if (hs.message) {
          const p = w.player, head = heroTop(p) * persp(p.y);
          shell.hud.drawSpeech(ctx, { x: toX(p.x), y: toY(p.y - p.z + head) - 10, who: '', text: hs.message, compact: hs.compact });
        }
      }
      // 방어 게이지: 캐릭터 머리 위, 막는 중·회복 중에만 (가득 차면 천천히 사라진다)
      const ep = w.player instanceof FighterPlayer ? w.player : null;
      if (ep && !mods.blocking?.() && !shell.paused) {
        const show = ep.guard < 99.5 || ep.core.P.mode === 'block';
        guardA = show ? Math.min(1, guardA + dt * 8) : Math.max(0, guardA - dt * 2.5);
        const z = view.zoom, head = heroTop(ep) * persp(ep.y);
        const gx = (ep.x - w.drawCamX - view.crop) * z, gy = (ep.y - ep.z + head * 0.92 - view.cropY) * z - 12;
        drawGuardBar(ctx, gx + 5, gy, ep.guard / 100, ep.guardBroken, guardA, performance.now() / 1000);
      }
      // 본부: 위 안내 띠 대신 캐릭터 옆 말풍선 (닿는 문·자리가 있을 때만, 캐릭터와 겹치지 않게 옆에)
      const tg = game?.inHub && !mods.blocking?.() && !shell.paused ? (w.stage as { nearInfo?: () => { text: string; locked: boolean } | null }).nearInfo?.() : null;
      if (tg) {
        const p = w.player, z = view.zoom;
        const head = heroTop(p) * persp(p.y);
        const sx = (p.x - w.drawCamX - view.crop) * z, sy = (p.y - p.z + head * 0.72 - view.cropY) * z;
        const half = 46 * persp(p.y) * 1.15 * z;
        const side: 1 | -1 = sx > ctx.canvas.width - 320 ? -1 : 1;
        const key = hs.device === 'pad' ? 'B' : hs.device === 'touch' || hs.compact ? '조' : 'E';
        shell.hud.drawPrompt(ctx, { x: sx + side * (half + 18), y: sy, side, key, text: tg.locked ? `${tg.text} · 잠김` : tg.text, locked: tg.locked, compact: hs.compact });
      }
      ffx.drawScreen(ctx);
      syncNavigationButton(shell.canvas, hs.navigation);
      shell.touch.setItems(hs.items);
      shell.touch.setGauge(w.player.gauge / 100);
      shell.touch.hint('reload', w.player.ammo <= 2 && w.player.reserve > 0);
      shell.fx.drawTransition(ctx);
    },
    onScene: (name) => {
      if (name === 'title' || name === 'hq') audio.floor(name as never);
      if (name === 'hq') shell.play(); // 본부도 걷는 장면: 타이틀 메뉴 닫고 조작·터치 켜기
    },
    onPause: (p) => {
      // 메뉴가 열리면 말풍선·GO 표시를 숨긴다
      storyRoot.style.visibility = p ? 'hidden' : '';
      if (world) world.paused = p;
    },
    onWorld: (w, run) => {
      cancelStoryForScene();
      world = w;
      runAgent = run.agent as AgentId;
      w.hitFx = false; // 맞을 때 효과는 껍데기 fx가 그린다
      if (run.stageId === 'hq') return void npc.attach(w, { hub: (hq.hub?.() ?? null) as never, hq: true }); // 본부 걷기: 아이템·대사 안내·전투 기록 없음
      w.threat = (b) => (DEF_BY_KIND[b.kind] ? isThreat(b as never) : true);
      w.on((e) => {
        // 임시 퍽(src/game/perks): 층(방)에 들어감 · 전투를 끝냄
        // 방 보상: 전투가 끝나면 카드가 떨어지고(괴이 판 진행 중일 때만), 안 집고 다음 방으로 가면 그때 3택1 창
        if (w.player instanceof FighterPlayer && e.type === 'enter:floor') { if (w.player.reward) w.player.takeReward(); w.player.perks.roomEnter(); }
        if (w.player instanceof FighterPlayer && e.type === 'combat:clear') { w.player.perks.roomClear(); w.player.dropReward(); }
        if (e.type !== 'custom') return;
        const d = (e.data ?? {}) as { dmg?: number; text?: string; kind?: string; ticks?: number; debuff?: { kind?: string; ticks?: number } };
        // 디버프는 글자만이 아니라 실제로 건다 (src/game/combat/status.ts, 에일린)
        const st = (w.player as { status?: StatusSet }).status;
        const dur = ((w.player as { stat?: { statusDur: number } }).stat?.statusDur ?? 1) * (w.player instanceof FighterPlayer ? w.player.perks.inDur() : 1);   // 정신력(정)으로 지속이 줄어듦 · 퍽 내성
        const put = (k?: string, ticks?: number) => { if (st && k && k in STATUS) st.apply(k as DebuffKind, ticks ? (ticks / 30) * dur : undefined); };
        // 회피·무적으로 피했으면 디버프도 안 건다(10-30: 피해는 0인데 출혈 등이 걸리던 버그)
        if (e.name === 'hurtPlayer') { if (w.api.hurtPlayer(d.dmg ?? 10) !== false) put(d.debuff?.kind, d.debuff?.ticks); }
        else if (e.name === 'debuff') { put(d.kind, d.ticks); if (d.text) w.say(d.text, 1.5); }
      });
      const items = linkItems(w, run);
      npc.attach(w, { items, hq: false });
      if (run.stageId === 'itemroom') items.showcase();
      w.hooks.push(() => items.tick());
      w.underlays.push((c, camX) => items.draw(c, camX));
    },
    drawIdle: (name, ctx, t) => {
      if (name === 'title') drawTitleBg(ctx, t, VISIT_TITLE.title, VISIT_TITLE.sub);
    },
    boot: (g) => { void hq.visitReady.then(() => { if (bridge?.visit || !bootFromUrl(g)) g.toTitle(); }); return true; },
    dispose: () => {
      offHidden?.();
      npc.dispose();
      const g = globalThis as { __goeiStory?: unknown; __goeiStoryStart?: unknown; __goeiNpc?: unknown };
      delete g.__goeiStory;
      delete g.__goeiNpc;
      delete g.__goeiStoryStart;
      world = null;
      game = null;
      window.removeEventListener('keydown', storyKeys, true);
      window.removeEventListener('keydown', floorKeys, true);
      saveFlags();
      storyRoot.removeEventListener(VIDEO_AUDIO_EVENT, attachVideoAudio);
      story.dispose();
      visit?.dispose();
      setPixelScale(2.75);
      audio.dispose();
      shell.dispose();
    },
  };
  return {
    mods,
    box: shell.stage.root,
    bind: (g) => {
      game = g;
    },
  };
}

/** 시작 꼬리표 (게임_통합_규격 1장): ?start=hq | stage=training|dummy|spar | arena | items | story=<장면> */
function bootFromUrl(g: Game): boolean {
  let q: URLSearchParams;
  try {
    q = new URLSearchParams(location.search);
  } catch {
    return false;
  }
  const start = q.get('start');
  if (!start) return false;
  const [k, v] = start.split('=');
  if (k === 'hq') g.start_new();
  else if (k === 'stage') g.start_new(v || undefined);
  else if (k === 'arena') g.start_new('arena');
  else if (k === 'items') g.start_new('itemroom');
  else if (k === 'story') {
    g.start_new('dummy');
    if (v) (globalThis as { __goeiStoryStart?: (id: string) => void }).__goeiStoryStart?.(v);
  } else return false;
  return true;
}

/** 화면 x(게임 좌표) 근처에서 문·승강기·벽 가구와 겹치지 않는 폭 300 이상 빈 구간 [시작, 끝] (화면 좌표) */
function bubbleGap(world: World, gx: number): [number, number] | null {
  const cam = world.camX;
  const solid: [number, number][] = (world.floor.keepOut ?? []).filter(([a, b]) => b - a >= 60).map(([a, b]) => [a - cam, b - cam]);
  for (const pr of world.floor.props ?? []) {
    if (!/door|elevator|exit|panel|shutter|mirror|goalwall/.test(pr.kind)) continue;
    const h = Math.max(pr.w, 200) / 2 + 20;
    solid.push([pr.x - h - cam, pr.x + h - cam]);
  }
  solid.sort((a, b) => a[0] - b[0]);
  const gaps: [number, number][] = [];
  let at = Math.max(0, gx - 520);
  const end = Math.min(1280, gx + 520);
  for (const [a, b] of solid) {
    if (b <= at) continue;
    if (a >= end) break;
    if (a - at >= 300) gaps.push([at, a]);
    at = Math.max(at, b);
  }
  if (end - at >= 300) gaps.push([at, end]);
  if (!gaps.length) return null;
  const dist = (g: [number, number]) => (gx < g[0] ? g[0] - gx : gx > g[1] ? gx - g[1] : 0);
  gaps.sort((a, b) => dist(a) - dist(b));
  return dist(gaps[0]) < 360 ? gaps[0] : null;
}

/** 필드 효과 팩 (game-pack/field-fx, 아직 없음): fx/fx_목록.txt + fx/<시트>.png, cutin/<인물>.png(_2). 없으면 코드 효과만 */
async function loadFieldFx(assets: GameAssets, ffx: FieldFx, cutins: Map<string, HTMLImageElement>) {
  try {
    if (!(await assets.ready('field-fx'))) return;
    const list = await assets.bytes('field-fx', 'fx/fx_목록.txt');
    const img = async (file: string) => {
      const u = await assets.url('field-fx', file);
      if (!u) return null;
      const im = new Image();
      im.src = u;
      await im.decode();
      return im;
    };
    for (const d of list ? parseFxList(new TextDecoder().decode(list)) : []) {
      const im = await img(`fx/${d.name}.png`).catch(() => null);
      if (im) ffx.register(d, im);
    }
    for (const name of Object.keys(SUPER_TEXT)) {
      for (const k of [name, `${name}_2`]) {
        const im = await img(`cutin/${k}.png`).catch(() => null);
        if (im) cutins.set(k, im);
      }
    }
  } catch { /* 팩이 없거나 깨졌으면 코드 효과만 */ }
}
