// NPC 자유 대화를 엔진에 잇는 곳 (npc/ 모듈, 설계안 docs/NPC_자유대화.md).
// E를 누른 자리에 말을 걸 수 있는 사람이 있으면 대화창을 연다(world.talkHook).
// 필드(본편 연결): 이름 인물 대화 자리 → 본부 방문 대화(talk.ts, 인물 기록). 시연판(본편 없음)만 옛 대화 모듈로 연다.
// 옛 차원 승강기 층의 상인·승객·주민·승강기·백일몽 대치와 면담실 생존자는 출동과 같이 지웠다 (2026-10-28).
import type { GameBridge } from '../../bridge';
import type { PropSpec } from './contract';
import type { World } from './world';
import type { Hub } from './hub';
import type { HqSpot } from '../hq/map';
import type { AgentId } from '../story/types';
import { createNpcTalk, ROSTER, SPOT_NPC, type AppliedEffect, type MetaInfo, type NpcDef, type NpcTalk, type TalkTarget } from '../npc';

export interface NpcLinkOpts {
  visit?: (name?: string) => void;
  /** 대화창을 넣을 1280×720 층 (껍데기 stage.ui) */
  layer: HTMLElement;
  bridge?: Partial<GameBridge>;
  settings(): { talkModel?: 'main' | 'aux'; talkRecent?: boolean };
  agent(): AgentId;
  day(): number;
  photo(key: string): string | undefined | Promise<string | undefined>;
  sfx(name: string): void;
  /** 창이 열리고 닫힐 때 (터치 버튼 숨김) */
  onOpen(on: boolean): void;
}

export interface NpcLink {
  talk: NpcTalk;
  isOpen(): boolean;
  /** 월드마다: E 가로채기 */
  attach(w: World, o: { hub?: Hub | null; items?: { give(id: string): boolean } | null; hq: boolean }): void;
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
  /** 모든 대화는 공통 효과(선물 받기·기록)를 거쳐 지금 월드에 잇는다 */
  const open = (t: TalkTarget) => talk.open(world ? common(world, t) : t);

  // ── 본부·필드 ───────────────────────────────────
  const hubTalk = (hub: Hub, prop: PropSpec): boolean => {
    const sc = hub.current();
    const spot = sc?.spots.find((s) => `spot:${s.id}` === prop.id) as (HqSpot & { open?: boolean }) | undefined;
    if (!sc || !spot || spot.open === false || !spot.who) return false;
    if (o.visit) { o.visit(spot.who); return true; }
    const npc = SPOT_NPC[spot.who];
    if (!npc || npc === o.agent() || !ROSTER[npc]) return false;
    open({ npc, place: `관리국 본부 ${sc.floor} ${sc.name}`, facts: [] });
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
        if (e.kind === 'join' || e.kind === 'hostile' || e.kind === 'trade' || e.kind === 'gift') ((w.notes['npc.events'] ??= []) as string[]).push(`${t.name ?? ROSTER[t.npc]?.name}: ${e.note}`);
        inner?.(e);
      },
    };
  };

  // ── E 가로채기 ───────────────────────────────────
  const talkHook = (hub: Hub | null) => (prop: PropSpec | null): boolean => {
    if (talk.isOpen()) return true;
    return !!(hq && hub && prop?.kind === 'hubspot' && hubTalk(hub, prop));
  };

  const link: NpcLink = {
    talk,
    isOpen: () => talk.isOpen(),
    attach(w, a) {
      world = w;
      hq = a.hq;
      items = a.items ?? null;
      talk.close();
      w.talkHook = talkHook(a.hub ?? null);
    },
    talkTo(npc, extra = {}) {
      if (!world || !ROSTER[npc]) return;
      open({ npc, place: '관리국 본부', facts: [], ...extra });
    },
    dispose() {
      talk.dispose();
      world = null;
    },
  };
  return link;
}
