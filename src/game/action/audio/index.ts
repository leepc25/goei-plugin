// 게임 소리 입구. 엔진은 이 파일만 부른다 (docs/게임_모듈_연결.md).
//   const audio = createGameAudio({ load, save });
//   audio.event({ type: 'hit', strength: 3, x });   // 전투·적·UI 사건
//   audio.floor('dark');                             // 층 들어갈 때: 음악 + 환경음
//   audio.duck(1.5);                                 // 필살기 컷인
// AudioContext는 처음 소리를 낼 때 만든다. 다른 봇에서는 아무것도 하지 않는다.
import { type AudioSettings, type Bus, type Out, BUSES, DEFAULT_SETTINGS, buildGraph, cleanSettings, sliderGain } from './engine';
import { SFX, SFX_IDS, SURFACE_SFX, type SfxId, type Surface } from './sfx';
import { Player, compileSong, type Compiled } from './music';
import { SONGS, type SongId } from './songs';
import { startAmbience, type Scene } from './ambience';

export { SFX, SFX_IDS, type SfxId, type Surface } from './sfx';
export { SONGS, SONG_IDS, type SongId } from './songs';
export { BUSES, BUS_LABEL, cleanSettings, type AudioSettings, type Bus } from './engine';
export type { Scene } from './ambience';

/** 층·화면 → 음악 (침묵의 층은 음악 없음) */
export const SCENE_SONG: Record<Scene, SongId | null> = {
  title: 'title',
  hq: 'hq',
  lobby: 'lobby',
  chase: 'chase',
  replica: 'replica',
  trial: 'trial',
  dark: 'dark',
  silent: null,
  puzzle: 'puzzle',
  service: 'service',
  boss: 'boss',
};
/** 층의 기본 바닥 재질 (step 사건에 surface가 없을 때) */
export const SCENE_SURFACE: Record<Scene, Surface> = {
  title: 'marble',
  hq: 'wood',
  lobby: 'marble',
  chase: 'concrete',
  replica: 'carpet',
  trial: 'tile',
  dark: 'wet',
  silent: 'concrete',
  puzzle: 'void',
  service: 'metal',
  boss: 'concrete',
};

export interface AudioEvent {
  type: string;
  strength?: number; // hit 1·2·3
  x?: number; // 월드 x (setListener 기준으로 좌우)
  pan?: number; // -1~1 직접 지정
  vol?: number;
  pitch?: number;
  surface?: Surface;
  open?: boolean; // door
  kind?: string; // hit: kick | low | dash | bullet | super / door: elevator | wood | slam / shot: silenced
  perfect?: boolean; // guard: 저스트 가드
  floor?: { type?: string }; // enter:floor
  how?: string; // run:end
  name?: string; // custom
}

const SCENES = new Set<string>(['title', 'hq', 'lobby', 'chase', 'replica', 'trial', 'dark', 'silent', 'puzzle', 'service', 'boss']);

/** 다른 모듈이 쓰는 소리 이름 (대사·컷신 스크립트) */
const ALIAS: Record<string, SfxId> = { doors: 'doorOpen', rope: 'ropeCreak', stamp: 'ruleStamp', knockknock: 'knock', static: 'intercom' };

/** 엔진 사건 → 효과음. 없는 사건은 null (조용히 무시) */
export function pickSfx(e: AudioEvent, scene: Scene | null): SfxId | null {
  switch (e.type) {
    case 'hit':
      if (e.kind === 'kick') return 'kick';
      if (e.kind === 'low') return 'lowKick';
      if (e.kind === 'dash') return 'dashHit';
      if (e.kind === 'bullet') return 'bulletHit';
      if (e.kind === 'super') return 'superHit';
      return e.strength && e.strength >= 3 ? 'hit3' : e.strength === 2 ? 'hit2' : 'hit1';
    case 'whiff':
      return e.strength && e.strength >= 3 ? 'swingHeavy' : 'whiff';
    case 'shot':
      return e.kind === 'silenced' ? 'gunSilenced' : e.kind === 'enemy' ? 'enemyShot' : 'gun';
    case 'empty':
      return 'emptyClick';
    case 'guard':
      return e.perfect ? 'parry' : 'guard';
    case 'super':
      return 'superStart';
    case 'item':
      return 'itemUse';
    case 'step':
      return SURFACE_SFX[e.surface ?? (scene ? SCENE_SURFACE[scene] : 'concrete')];
    case 'door':
      if (e.kind === 'wood') return 'doorWood';
      if (e.kind === 'slam') return 'doorSlam';
      return e.open === false ? 'doorClose' : 'doorOpen';
    case 'ruleFound':
      return 'ruleStamp';
    case 'hp:low':
      return 'heartbeat';
    case 'custom':
      if (e.name && e.name in ALIAS) return ALIAS[e.name];
      return e.name && e.name in SFX ? (e.name as SfxId) : null;
    default:
      return e.type in SFX ? (e.type as SfxId) : null;
  }
}

// 같은 소리를 너무 촘촘히 겹치지 않게 (초)
const MIN_GAP: Partial<Record<SfxId, number>> = { textBlip: 0.03, uiMove: 0.03, heartbeat: 0.3 };
const STEP_GAP = 0.07;
const MAX_VOICES = 28;

export interface GameAudioOptions {
  load?: () => unknown; // 저장된 설정 (문자열 JSON 또는 객체, Promise 가능)
  save?: (json: string) => unknown;
  /** 첫 터치·클릭·키 입력에서 자동으로 잠금 해제 (기본 켬) */
  autoUnlock?: boolean;
}

export type GameAudio = ReturnType<typeof createGameAudio>;

export function createGameAudio(opts: GameAudioOptions = {}) {
  let settings: AudioSettings = { ...DEFAULT_SETTINGS };
  let ctx: AudioContext | null = null;
  let graph: ReturnType<typeof buildGraph> | null = null;
  let out: Out | null = null;
  let disposed = false;
  let userPaused = false;
  let scene: Scene | null = null;
  let amb: ReturnType<typeof startAmbience> | null = null;
  let song: { id: SongId; player: Player } | null = null;
  let resumeSong: SongId | null = null; // 알림곡이 끝나면 돌아갈 곡
  let jingleTimer = 0;
  let pumpTimer = 0;
  const lastAt = new Map<string, number>();
  const voices: number[] = []; // 끝나는 시각들
  let listener = { x: 0, half: 640 };
  const compiled = new Map<SongId, Compiled>();
  const listeners = new Set<() => void>();

  // ── 설정 ──
  const ready = (async () => {
    try {
      const raw = await opts.load?.();
      if (raw != null) settings = cleanSettings(typeof raw === 'string' ? JSON.parse(raw) : raw);
    } catch {
      /* 손상된 설정은 기본값 */
    }
    applyVolumes();
  })();
  let saveTimer = 0;
  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try {
        void opts.save?.(JSON.stringify(settings));
      } catch {
        /* 저장 실패는 소리에 영향 없음 */
      }
    }, 400);
  };
  function applyVolumes() {
    if (!graph || !ctx) return;
    const t = ctx.currentTime;
    for (const b of BUSES) {
      const v = b === 'master' ? (settings.muted ? 0 : sliderGain(settings.master)) : sliderGain(settings[b]);
      graph.gains[b].gain.setTargetAtTime(v, t, 0.03);
    }
  }

  // ── 컨텍스트 ──
  // 첫 사용자 동작(unlock) 전에는 AudioContext를 만들지 않는다 (브라우저 자동 재생 경고 방지).
  // 그 전에 들어온 층·곡은 기억해 두었다가 잠금 해제 때 튼다.
  let wantSong: SongId | null = null;
  function ensure(): Out | null {
    return disposed ? null : out;
  }
  function create(): Out | null {
    if (disposed) return null;
    if (out) return out;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC({ latencyHint: 'interactive' });
    } catch {
      return null;
    }
    graph = buildGraph(ctx, ctx.destination);
    out = graph.out;
    applyVolumes();
    ctx.addEventListener('statechange', () => listeners.forEach((f) => f()));
    return out;
  }

  // ── 모바일 잠금 해제 ──
  // iOS·안드로이드는 사용자가 화면을 만진 그 순간에 resume해야 소리가 난다.
  // iOS 17+은 audioSession을 'playback'으로 두면 무음 스위치를 켜도 들린다.
  async function unlock() {
    const fresh = !out;
    const o = create();
    if (!o || !ctx) return false;
    if (fresh) {
      if (scene) {
        amb = startAmbience(o, scene);
        music(SCENE_SONG[scene], 1.2);
      } else if (wantSong) music(wantSong);
      wantSong = null;
    }
    try {
      const nav = navigator as unknown as { audioSession?: { type: string } };
      if (nav.audioSession && nav.audioSession.type !== 'playback') nav.audioSession.type = 'playback';
    } catch {
      /* 없는 브라우저 */
    }
    if (ctx.state !== 'running' && !userPaused) {
      try {
        // 빈 버퍼 하나를 바로 재생해야 iOS가 풀린다
        const b = ctx.createBufferSource();
        b.buffer = ctx.createBuffer(1, 1, 22050);
        b.connect(ctx.destination);
        b.start(0);
        await ctx.resume();
      } catch {
        return false;
      }
    }
    if (ctx.state === 'running') detachUnlock();
    return ctx.state === 'running';
  }
  const UNLOCK_EVENTS = ['pointerdown', 'touchend', 'mousedown', 'keydown'] as const;
  const onGesture = () => void unlock();
  function attachUnlock() {
    for (const ev of UNLOCK_EVENTS) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  }
  function detachUnlock() {
    for (const ev of UNLOCK_EVENTS) window.removeEventListener(ev, onGesture, { capture: true });
  }
  if (opts.autoUnlock !== false) attachUnlock();

  // 화면을 떠나면 멈추고, 돌아오면 다시 (배터리·백그라운드 소리 방지)
  const onVis = () => {
    if (!ctx) return;
    if (document.hidden) void ctx.suspend();
    else if (!userPaused) void ctx.resume();
  };
  document.addEventListener('visibilitychange', onVis);

  // ── 효과음 ──
  function play(id: SfxId, o: { vol?: number; pan?: number; pitch?: number; at?: number } = {}) {
    const ao = ensure();
    if (!ao || !ctx || ctx.state !== 'running') return false;
    const def = SFX[id];
    if (!def) return false;
    const now = ctx.currentTime;
    const gap = def.group === 'step' ? STEP_GAP : (MIN_GAP[id] ?? 0.015);
    if (now - (lastAt.get(id) ?? -1) < gap) return false;
    // 동시에 너무 많이 울리면 발소리·환경 소리부터 버린다
    while (voices.length && voices[0] < now) voices.shift();
    if (voices.length >= MAX_VOICES && (def.group === 'step' || def.group === 'world')) return false;
    lastAt.set(id, now);
    const t = Math.max(now, o.at ?? now) + 0.005;
    const dur = def.fn(ao, t, { vol: o.vol ?? 1, pan: o.pan ?? 0, pitch: o.pitch ?? 1, dest: ao[def.bus] });
    const end = t + dur;
    const i = voices.findIndex((v) => v > end);
    voices.splice(i < 0 ? voices.length : i, 0, end);
    return true;
  }

  function panOf(e: AudioEvent) {
    if (e.pan != null) return e.pan;
    if (e.x == null) return 0;
    return Math.max(-0.8, Math.min(0.8, (e.x - listener.x) / listener.half));
  }

  function event(e: AudioEvent) {
    // 흐름 사건: 음악을 바꾼다
    switch (e.type) {
      case 'enter:floor':
        if (e.floor?.type && SCENES.has(e.floor.type)) floor(e.floor.type as Scene);
        return true;
      case 'combat:boss':
        music('boss', 0.6);
        return true;
      case 'combat:clear':
        if (song?.id === 'boss') jingle('clear', scene ? SCENE_SONG[scene] : null);
        return true;
      case 'run:end':
        jingle(e.how === 'evac' ? 'gameover' : 'clear', null);
        return true;
    }
    const id = pickSfx(e, scene);
    if (!id) return false;
    // 화면 밖 멀리서 난 소리는 작게
    const far = e.x == null ? 1 : Math.max(0.35, 1 - Math.max(0, Math.abs(e.x - listener.x) - listener.half) / (listener.half * 2));
    const ok = play(id, { vol: (e.vol ?? 1) * far, pan: panOf(e), pitch: e.pitch });
    if (ok && e.type === 'super') duck(1.6);
    if (ok && e.type === 'ruleFound') duck(1.2, 0.4);
    return ok;
  }

  // ── 음악 ──
  function songOf(id: SongId) {
    let c = compiled.get(id);
    if (!c) compiled.set(id, (c = compileSong(SONGS[id])));
    return c;
  }
  function pump() {
    if (!ctx || !song) return;
    // 백그라운드에서 타이머가 늦어져도 끊기지 않게 넉넉히 미리 예약
    song.player.schedule(ctx.currentTime + 0.4, ctx.currentTime);
  }
  function startPump() {
    if (!pumpTimer) pumpTimer = window.setInterval(pump, 50);
  }

  function music(id: SongId | null, fade = 1) {
    const o = ensure();
    if (!o || !ctx) {
      wantSong = id;
      return;
    }
    clearTimeout(jingleTimer);
    resumeSong = null;
    if (song?.id === id && !song.player.ended) return;
    const t = ctx.currentTime;
    song?.player.fadeOut(t, fade);
    song = null;
    if (!id) return;
    const player = new Player(o, songOf(id), t + Math.min(0.15, fade * 0.3));
    song = { id, player };
    startPump();
    pump();
  }

  /** 한 번만 나오는 알림곡. 끝나면 하던 곡으로 돌아간다 */
  function jingle(id: SongId, then?: SongId | null) {
    const o = ensure();
    if (!o || !ctx) return;
    const back = then !== undefined ? then : (resumeSong ?? song?.id ?? null);
    music(id, 0.25);
    resumeSong = back;
    const len = song!.player.lengthSec;
    jingleTimer = window.setTimeout(() => {
      const b = resumeSong;
      resumeSong = null;
      if (b) music(b, 0.5);
    }, (len + 0.8) * 1000);
  }

  /** 음악을 잠깐 낮춘다 (컷인·규칙 발견) */
  function duck(sec: number, to = 0.25) {
    if (!ctx || !graph) return;
    const g = graph.duck.gain;
    const t = ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(to, t, 0.04);
    g.setTargetAtTime(1, t + sec, 0.3);
  }

  // ── 층 ──
  function floor(s: Scene | null) {
    if (s === scene) return;
    scene = s;
    const o = ensure();
    if (!o) return;
    amb?.stop();
    amb = s ? startAmbience(o, s) : null;
    music(s ? SCENE_SONG[s] : null, 1.2);
  }

  return {
    ready,
    unlock,
    get unlocked() {
      return ctx?.state === 'running';
    },
    get scene() {
      return scene;
    },
    get song() {
      return song?.id ?? null;
    },
    play,
    event,
    music,
    jingle,
    duck,
    floor,
    /** 소리의 좌우를 정할 기준: 화면 가운데 x와 화면 반 너비 */
    setListener(x: number, half = 640) {
      listener = { x, half: Math.max(1, half) };
    },
    get settings(): AudioSettings {
      return { ...settings };
    },
    setVolume(bus: Bus, v: number) {
      settings = cleanSettings({ ...settings, [bus]: v });
      applyVolumes();
      persist();
    },
    setMuted(m: boolean) {
      settings = { ...settings, muted: m };
      applyVolumes();
      persist();
    },
    /** 게임 일시정지: 모든 소리를 멈춘다 */
    pause() {
      userPaused = true;
      void ctx?.suspend();
    },
    resume() {
      userPaused = false;
      void unlock();
    },
    onState(f: () => void) {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    dispose() {
      disposed = true;
      detachUnlock();
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(pumpTimer);
      clearTimeout(jingleTimer);
      amb?.stop(0.1);
      void ctx?.close();
      ctx = null;
      out = null;
      graph = null;
    },
  };
}
