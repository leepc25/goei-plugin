// 대사·컷신 모듈 입구. 엔진(게임 전투와 조작)과의 약속은 docs/게임_모듈_연결.md:
//   mountStory(root, host) → { say, bark, event, cutscene, update(dt초), isBlocking, flags, talk, dispose }
// 대화창·자유 대화·컷신이 열려 있는 동안 isBlocking()이 true이고, 엔진은 전투 갱신을 멈춘다. 말풍선은 멈추지 않는다.
import css from './style.css';
import type { AgentId, Flags, SpeakerId, StoryStep } from './types';
import { StoryRunner, ScriptLibrary } from './script';
import { buildLibrary } from './library';
import { castOf, MALE_AGENTS } from './cast';
import { lookupLine } from './lines';
import { AGENTS, EVAC_PAIRS } from './lines/agents';
import { BarkPicker } from './director';
import { Cutscene, type CutsceneIO } from './cutscene';
import { VideoPlayer, listed, repoRoot } from './video';
import { VIDEOS, VIDEO_DIR } from './scripts/videos';
import { CUTSCENES } from './scripts/cutscenes';
import { FreeTalk, type TalkModel, type TalkNpcId } from './ai';
import { StoryUI, TalkPanel, type Anchor } from './ui';

export type { AgentId, Flags, StoryEvent } from './types';
export type { TalkModel, TalkNpcId } from './ai';
export { CUTSCENES } from './scripts/cutscenes';
export { VIDEOS } from './scripts/videos';
export { AGENTS, AGENT_LINES, agentLine } from './lines/agents';
export { hqLines, stageHooks } from './hooks';

/** 엔진이 채우는 쪽. 없는 기능은 건너뛴다. */
export interface StoryHost {
  getAgent(): AgentId;
  /** 대화창·컷신이 열리고 닫힐 때 */
  pause?(on: boolean): void;
  camera?(x: number | undefined, y: number | undefined, zoom: number | undefined, ms: number): void;
  actor?(id: string, to: { x?: number; y?: number; face?: 1 | -1; anim?: string; show?: boolean }, ms: number): void;
  bg?(scene: string): void;
  panel?(text: string, ms: number): void;
  shake?(ms: number, amp: number): void;
  sfx?(name: string): void;
  /** 말풍선 위치(이 모듈 root 기준 px). 'agent' | 'elevator' | NPC id. 없거나 null이면 화면 위쪽에 띄운다 */
  anchor?(id: string): { x: number; y: number } | null;
  /** 대본의 `> emit 사건 인자`, 컷신의 emit */
  emit?(event: string, arg: string): void;
  /** 사진 열쇠(cast.ts photo) → 주소 */
  photo?(key: string): string | undefined;
  /** 자유 대화에 쓸 모델 (플러그인: risu.ts의 risuMainModel) */
  talkModel?: TalkModel;
  /** 컷신 프레임 폴더 주소 (컷신 id → 끝이 /인 URL). 없으면 저장소 game-src/art/cutscene/frames/<id>/ 를 추정 */
  videoUrl?(id: string): string | undefined;
  /** 일시정지 메뉴가 열렸나. 열려 있으면 말풍선을 숨긴다 */
  paused?(): boolean;
}

export interface StoryApi {
  flags: Flags;
  library: ScriptLibrary;
  /** 대본 시작 (대화창, 멈춤). vars는 시작 전에 상태 값에 넣는다 */
  say(scriptId: string, vars?: Flags, onDone?: () => void): void;
  /** 엔진 사건 → 말풍선·상태 값 */
  event(name: string, data?: Record<string, unknown>): void;
  /** 바로 말풍선 */
  bark(who: SpeakerId, text: string, ms?: number): void;
  cutscene(id: string, onDone?: () => void): void;
  /** 자유 대화 창 */
  talk(npc: TalkNpcId, onDone?: () => void): void;
  update(dt: number): void;
  isBlocking(): boolean;
  /** 대화 넘기기 (키보드 등) */
  advance(): void;
  choose(n: number): void;
  skip(): void;
  dispose(): void;
}

export interface StoryOptions {
  /** 저장해 둔 상태 값 */
  saved?: Flags;
  /** 시연·시험용: 말풍선 간격·확률 제한을 거의 없앤다 */
  eager?: boolean;
  /** 대화창 자리. 기본 top: 게임 화면 위쪽(HUD 아래)에 띄워 아래쪽 아이템 칸·터치 버튼과 겹치지 않게 한다 */
  dock?: 'top' | 'bottom';
  /** 컷신 방식. video(기본): 도트 애니메이션 프레임(없으면 건너뜀). script: 대본 컷신 (단독 시연판) */
  cutscenes?: 'video' | 'script';
  /** 층에 내릴 때 승강기 안내를 말풍선으로 띄운다. 통합판은 층 모듈이 안내하므로 끈다 (시연판만 true) */
  announce?: boolean;
}

/** 다른 모듈이 world.emit({type:'custom', name})으로 내는 사건 → 이 모듈 사건 이름 */
const CUSTOM: Record<string, string> = {
  ruleBroken: 'rule:break',
  guardianCleared: 'win',
};

export function mountStory(root: HTMLElement, host: StoryHost, opts: StoryOptions = {}): StoryApi {
  const saved = opts.saved;
  const style = document.createElement('style');
  style.textContent = css;
  root.append(style);
  if (opts.dock !== 'bottom') root.classList.add('gsy-top');
  const rng = Math.random;
  const flags: Flags = { favor: 0, rules: 0, ...(saved ?? {}) };
  const lib = buildLibrary();
  const ui = new StoryUI(root, (k) => host.photo?.(k));
  const panel = new TalkPanel(root);
  const talker = new FreeTalk({ model: host.talkModel });
  const picker = new BarkPicker(rng);
  if (opts.eager) {
    picker.gap = 0.4;
    picker.tagCool = 0;
    picker.always = true;
  }
  let now = 0;
  let scene: Cutscene | null = null;
  let sceneDone: (() => void) | undefined;
  let talkDone: (() => void) | undefined;
  let talkNpc: TalkNpcId | null = null;
  let doneCb: (() => void) | undefined;
  let blocking = false;

  const agent = () => host.getAgent();
  const syncAgent = () => {
    const a = agent();
    flags.agent = a;
    flags.male = MALE_AGENTS.includes(a);
  };

  const runner = new StoryRunner(lib, {
    flags,
    get agent() {
      return agent();
    },
    rng,
    speakerName: (who) => castOf(who, agent()).name,
    agentLine: (a, tag, r) => lookupLine(a, tag, flags, r),
    emit: (event, arg) => {
      if (event === 'sfx') host.sfx?.(arg);
      host.emit?.(event, arg);
    },
  });

  const setBlocking = (on: boolean) => {
    if (on === blocking) return;
    blocking = on;
    host.pause?.(on);
  };

  const show = (s: StoryStep) => {
    if (s.kind === 'say') {
      ui.line(castOf(s.who, agent()), s.text, s.mood);
      if (s.who === 'elevator') host.sfx?.('intercom');
    } else if (s.kind === 'choice') ui.choices(s.options);
    else {
      ui.close();
      const cb = doneCb;
      doneCb = undefined;
      cb?.();
    }
    refresh();
  };

  const video = new VideoPlayer(root);
  const refresh = () => setBlocking(ui.boxOpen || !!scene || panel.isOpen || video.open);

  /** 후송 깨어남: 옆에 있던 동료의 주고받기를 앞에 붙인 임시 대본 */
  const evacWrap = (id: string) => {
    const pairs = EVAC_PAIRS[agent()] ?? [];
    if (!pairs.length) return id;
    const p = pairs[Math.floor(rng() * pairs.length) % pairs.length];
    host.emit?.('buddy', p.by);
    host.actor?.('buddy', { anim: p.by, show: true }, 0);
    const tmp = `__evac_${id}`;
    lib.scripts.delete(tmp);
    lib.add(`=== ${tmp}\n${p.by}: ${p.lines[0]}\nagent: ${p.lines[1]}\n> call ${id}\n`, 'evac');
    return tmp;
  };

  const say = (id: string, vars?: Flags, onDone?: () => void) => {
    syncAgent();
    if (vars) Object.assign(flags, vars);
    doneCb = onDone;
    show(runner.start(id === 'evac_wake' || id === 'cs_evac' ? evacWrap(id) : id));
  };

  const advance = () => {
    if (video.open) {
      video.skipSoft();
      return;
    }
    if (panel.isOpen) return;
    if (runner.current.kind === 'say') {
      if (ui.typing) ui.completeTyping();
      else show(runner.next());
    }
  };
  const choose = (n: number) => {
    if (runner.current.kind !== 'choice') return;
    const opt = runner.current.options[n];
    if (opt) show(runner.choose(opt.index));
  };
  ui.onAdvance = advance;
  ui.onChoose = (index) => {
    if (runner.current.kind === 'choice') show(runner.choose(index));
  };

  const anchorOf = (id: string): Anchor => () => host.anchor?.(id) ?? null;

  const bark = (who: SpeakerId, text: string, ms = 2600) => {
    const id = who === 'agent' ? agent() : who;
    const c = castOf(id, agent());
    const key = AGENTS[id as AgentId] ? 'agent' : id;
    ui.bubble(text, anchorOf(key), ms, c.color, who === 'elevator' ? '승강기' : '', key);
  };

  const singleLine = (who: SpeakerId, text: string) => {
    const tmp = '__line';
    lib.scripts.delete(tmp);
    lib.add(`=== ${tmp}\n${who}: ${text.replace(/\n/g, ' ')}\n`, 'line');
    say(tmp);
  };

  // 무대를 바꿔 줄 host.bg가 없으면(통합판) 장면이 바뀐 뒤의 「밝아짐」은 어둡게 가린 채로 둔다.
  // 멈춘 전투 화면 위에 「로비였다」 같은 자막이 뜨면 거짓말이 되기 때문.
  let sceneVeiled = false;
  const io: CutsceneIO = {
    bg: (s) => {
      if (host.bg) host.bg(s);
      else sceneVeiled = true;
    },
    fade: (to, ms) => ui.fade(to === 'clear' && sceneVeiled ? 'dim' : to, ms),
    caption: (t, ms) => ui.caption(t, ms),
    sfx: (n) => host.sfx?.(n),
    shake: (ms, amp) => host.shake?.(ms, amp),
    actor: (id, to, ms) => host.actor?.(id, to, ms),
    camera: (to, ms) => host.camera?.(to.x, to.y, to.zoom, ms),
    panel: (t, ms) => (host.panel ? host.panel(t, ms) : ms > 0 && ui.caption(t, ms)),
    bark: (who, t, ms) => bark(who, t, ms),
    emit: (e, a) => host.emit?.(e, a),
    dialogue: (id) => say(id),
    line: (who, text) => singleLine(who, text),
    agentLine: (tag) => {
      const t = lookupLine(agent(), tag, flags, rng);
      if (t) singleLine('agent', t);
    },
    talking: () => ui.boxOpen,
    closeDialogue: () => {
      doneCb = undefined;
      runner.current = { kind: 'end' };
      ui.close();
    },
  };

  const cutscene = (id: string, onDone?: () => void) => {
    if (opts.cutscenes !== 'script') {
      // 도트 영상. 목록에 없거나 파일을 못 불러오면 바로 끝(onDone)
      const v = VIDEOS[id];
      flags[`seen.cs.${id}`] = 1;
      if (!v) {
        onDone?.();
        return;
      }
      syncAgent();
      const subs = v.subs.map((s) => (s.text.includes('{call}') ? { ...s, text: s.text.replace('{call}', lookupLine(agent(), 'el:call', flags, rng) ?? '…') } : s));
      const base = host.videoUrl ? host.videoUrl(id) : `${repoRoot()}${VIDEO_DIR}${id}/`;
      if (!base) {
        onDone?.();
        return;
      }
      // 받은 컷신은 프레임 폴더 index.json에 이름이 있다
      void video.play(
        base,
        v.cuts,
        subs,
        () => {
          refresh();
          onDone?.();
        },
        listed(base.replace(/[^/]+\/$/, ''), id),
        !!v.sound,
      );
      refresh();
      return;
    }
    const def = CUTSCENES[id];
    if (!def) {
      console.warn('[goei] 없는 컷신:', id);
      onDone?.();
      return;
    }
    syncAgent();
    sceneVeiled = false;
    scene = new Cutscene(def, io);
    sceneDone = onDone;
    flags[`seen.cs.${id}`] = 1;
    ui.setSkippable(true);
    refresh();
  };
  ui.onSkip = () => {
    if (scene) scene.skip();
  };

  const greet: Partial<Record<TalkNpcId, string>> = {
    jaemtri: '응, 후배. 무슨 얘기 하고 싶어?',
    gognija: '오오! 무엇이든 묻게! 대답은 장담 못 하네!',
    dejure: '네, 네…? 저, 저한테요…?',
    konjyuce: '네! 뭐든 물어보세요!',
    madeokhee: '어머, 자기야. 뭐 팔 거 있어요?',
    elevator: '…듣고 있어요.',
  };
  panel.onClose = () => {
    panel.close();
    talkNpc = null;
    refresh();
    const cb = talkDone;
    talkDone = undefined;
    cb?.();
  };
  panel.onSend = async (text) => {
    const npc = talkNpc;
    if (!npc) return;
    panel.add('me', text);
    panel.waiting(true);
    const p = panel.add('npc', '…');
    p.classList.add('wait');
    const res = await talker.reply(npc, text, agent(), flags);
    p.classList.remove('wait');
    p.textContent = res.text;
    panel.waiting(false);
  };
  const talk = (npc: TalkNpcId, onDone?: () => void) => {
    syncAgent();
    talkNpc = npc;
    talkDone = onDone;
    const c = castOf(npc as SpeakerId, agent());
    panel.open(c, c.photo ? host.photo?.(c.photo) : undefined, greet[npc] ?? (AGENTS[npc as AgentId] ? (lookupLine(npc as AgentId, 'offer', flags, rng) ?? '…') : '…'));
    refresh();
  };

  let bossUp = false;
  const event = (name: string, data: Record<string, unknown> = {}) => {
    syncAgent();
    // 엔진 GameEvent 모양 맞추기: custom은 이름으로, 적이 쓰러진 down은 무시
    if (name === 'custom') {
      name = CUSTOM[String(data.name)] ?? '';
      data = (data.data as Record<string, unknown>) ?? {};
      if (!name) return;
    }
    if (name === 'down' && data.who === 'enemy') return;
    if (name === 'combat:boss') bossUp = true;
    if (name === 'combat:clear' && bossUp) (bossUp = false), (name = 'win');
    if (name === 'enter:floor') bossUp = false;
    // 상태 값
    if (name === 'enter:floor' || name === 'floor:enter') {
      const f = (data.floor as Record<string, unknown> | undefined) ?? data;
      if (f.depth !== undefined) flags.depth = Number(f.depth);
      if (f.type !== undefined) flags.ftype = String(f.type);
      if (Number(flags.depth) >= 15) flags.reached_b12 = 1;
      // 승강기 대본(board)이 이미 안내한 층이면 다시 말하지 않는다
      if (opts.announce && Number(flags.announced) !== Number(flags.depth)) {
        const t = lookupLine(agent(), 'el:announce', flags, rng);
        if (t) bark('elevator', t, 2400);
      }
      flags.announced = Number(flags.depth);
    }
    if (name === 'find:rule' || name === 'ruleFound') {
      const id = String(data.id ?? data.rule ?? '');
      if (!id || !flags[`rule_${id}`]) flags.rules = (Number(flags.rules) || 0) + 1;
      if (id) flags[`rule_${id}`] = 1;
    }
    if (name === 'rule:break') flags.broke_rule = 1;
    if (name === 'run:end') {
      const how = String(data.result ?? data.how ?? 'return');
      flags.result = how === 'withdraw' ? 'retreat' : how;
      flags.called_run = 0;
    }
    if (name === 'combat:clear' && data.final) name = 'win';
    // 층에 들어설 때는 층 안내 자막 하나만 (검수 4-7: 요원 말풍선을 겹치지 않는다)
    if (name === 'enter:floor' || name === 'floor:enter') return;
    const b = picker.pick(name, agent(), now);
    if (b) bark('agent', b.text, b.tag === 'ult' || b.tag === 'boss' ? 2000 : 2600);
  };

  const keys = (e: KeyboardEvent) => {
    if (panel.isOpen) return;
    if (scene && e.key === 'Escape') {
      scene.skip();
      e.preventDefault();
      return;
    }
    if (!ui.boxOpen) return;
    if (runner.current.kind === 'choice' && /^[1-9]$/.test(e.key)) {
      choose(Number(e.key) - 1);
      e.preventDefault();
    } else if ([' ', 'Enter', 'e', 'E', 'z', 'Z'].includes(e.key)) {
      advance();
      e.preventDefault();
    }
  };
  root.addEventListener('keydown', keys);

  return {
    flags,
    library: lib,
    say,
    event,
    bark,
    cutscene,
    talk,
    advance,
    choose,
    skip: () => (video.open ? video.finish() : scene?.skip()),
    isBlocking: () => blocking,
    update(dt: number) {
      now += dt;
      const p = !!host.paused?.();
      if (ui.bubbleLayer.hidden !== p) ui.bubbleLayer.hidden = p;
      ui.update(dt);
      if (scene) {
        scene.update(dt);
        if (scene.done) {
          scene = null;
          ui.setSkippable(false);
          ui.fade('clear', 300);
          refresh();
          const cb = sceneDone;
          sceneDone = undefined;
          cb?.();
        }
      }
    },
    dispose() {
      root.removeEventListener('keydown', keys);
      video.finish();
      video.el.remove();
      ui.dispose();
      panel.el.remove();
      style.remove();
    },
  };
}

