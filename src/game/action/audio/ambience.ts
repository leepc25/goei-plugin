// 층별 환경음: 계속 깔리는 소리(웅웅·바람·형광등) + 가끔 들리는 사건 소리(문 쾅, 속삭임, 보이지 않는 발소리).
// 침묵의 층은 거의 무음, 어둠의 층은 발소리 파문 위주 (기본 기획서 20.2).
import { type Out, gainNode, osc, noise, filt, AudioScope, busOut, oneShot } from './engine';
import { SFX, type SfxId } from './sfx';

export type Scene = 'title' | 'hq' | 'lobby' | 'chase' | 'replica' | 'trial' | 'dark' | 'silent' | 'puzzle' | 'service' | 'boss';

interface Layer {
  kind: 'hum' | 'rumble' | 'air' | 'ring';
  f: number;
  vol: number;
}
interface Ev {
  id: SfxId | 'typing';
  gap: [number, number]; // 초
  vol: [number, number];
  pitch?: [number, number];
  pan?: number; // 좌우로 흩어지는 폭
}
interface Spec {
  layers: Layer[];
  events: Ev[];
}

export const AMBIENCE: Record<Scene, Spec> = {
  title: { layers: [{ kind: 'rumble', f: 120, vol: 0.12 }], events: [] },
  hq: {
    layers: [{ kind: 'air', f: 900, vol: 0.02 }, { kind: 'hum', f: 60, vol: 0.015 }],
    events: [
      { id: 'typing', gap: [3, 9], vol: [0.15, 0.3], pan: 0.8 },
      { id: 'message', gap: [25, 50], vol: [0.08, 0.15], pan: 0.8 },
      { id: 'switchClick', gap: [12, 30], vol: [0.1, 0.2], pan: 0.8 },
    ],
  },
  lobby: {
    layers: [{ kind: 'hum', f: 120, vol: 0.035 }, { kind: 'air', f: 700, vol: 0.025 }],
    events: [
      { id: 'flicker', gap: [6, 14], vol: [0.15, 0.35], pan: 0.7 },
      { id: 'intercom', gap: [20, 40], vol: [0.1, 0.2], pan: 0.5 },
      { id: 'ding', gap: [30, 60], vol: [0.05, 0.1], pitch: [0.94, 0.94], pan: 1 },
    ],
  },
  chase: {
    layers: [{ kind: 'rumble', f: 160, vol: 0.22 }, { kind: 'air', f: 400, vol: 0.05 }],
    events: [
      { id: 'doorSlam', gap: [4, 9], vol: [0.2, 0.45], pan: 1 },
      { id: 'crawler', gap: [5, 11], vol: [0.25, 0.45], pan: 0.9 },
    ],
  },
  replica: {
    layers: [{ kind: 'hum', f: 60, vol: 0.03 }],
    events: [
      { id: 'clockTick', gap: [1, 1], vol: [0.12, 0.12], pan: 0 },
      { id: 'knock', gap: [15, 35], vol: [0.25, 0.4], pan: 1 },
      { id: 'whisper', gap: [18, 40], vol: [0.15, 0.3], pan: 1 },
      { id: 'doorWood', gap: [14, 30], vol: [0.15, 0.3], pan: 1 },
    ],
  },
  trial: {
    layers: [{ kind: 'hum', f: 100, vol: 0.025 }, { kind: 'air', f: 1200, vol: 0.015 }],
    events: [{ id: 'intercom', gap: [18, 35], vol: [0.1, 0.2], pan: 0.5 }],
  },
  dark: {
    layers: [{ kind: 'rumble', f: 90, vol: 0.18 }],
    events: [
      { id: 'enemyStep', gap: [1.5, 5], vol: [0.25, 0.5], pan: 1 },
      { id: 'heartbeat', gap: [8, 15], vol: [0.25, 0.4], pan: 0 },
      { id: 'whisper', gap: [12, 25], vol: [0.12, 0.25], pan: 1 },
      { id: 'drip', gap: [4, 9], vol: [0.1, 0.25], pan: 1 },
    ],
  },
  silent: {
    // 원문: 아무 소리도 안 들림. 귀가 먹먹한 이명 하나만
    layers: [{ kind: 'ring', f: 7200, vol: 0.004 }],
    events: [{ id: 'drip', gap: [25, 50], vol: [0.03, 0.06], pan: 1 }],
  },
  puzzle: {
    layers: [{ kind: 'air', f: 500, vol: 0.03 }, { kind: 'hum', f: 82, vol: 0.02 }],
    events: [
      { id: 'wallGrind', gap: [18, 35], vol: [0.15, 0.3], pan: 0.6 },
      { id: 'clockTick', gap: [2, 2], vol: [0.06, 0.06], pan: 0.3 },
    ],
  },
  service: {
    layers: [{ kind: 'rumble', f: 140, vol: 0.2 }, { kind: 'air', f: 300, vol: 0.04 }],
    events: [
      { id: 'drip', gap: [2, 6], vol: [0.15, 0.3], pan: 1 },
      { id: 'ropeCreak', gap: [8, 16], vol: [0.2, 0.35], pan: 1 },
      { id: 'bossRoar', gap: [30, 60], vol: [0.05, 0.08], pitch: [0.6, 0.8], pan: 1 }, // 멀리서 포식자
      { id: 'stomp', gap: [20, 40], vol: [0.06, 0.12], pan: 1 },
    ],
  },
  boss: { layers: [{ kind: 'rumble', f: 120, vol: 0.18 }], events: [] },
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** 환경음 하나를 켠다. stop()으로 서서히 끈다 */
export function startAmbience(o: Out, scene: Scene, fadeIn = 1.5) {
  const scope = new AudioScope(busOut(o, 'amb'));
  o = scope.out;
  const ctx = o.ctx;
  const spec = AMBIENCE[scene];
  const out = gainNode(o, 0, o.amb);
  const verb = gainNode(o, 1, o.verb), room = gainNode(o, 1, o.room);
  o = { ...o, verb, room };
  const t0 = ctx.currentTime;
  out.gain.setValueAtTime(0.0001, t0);
  out.gain.linearRampToValueAtTime(1, t0 + fadeIn);
  const long = 86400;
  for (const l of spec.layers) {
    const g = gainNode(o, l.vol, out);
    if (l.kind === 'hum') {
      // 형광등·냉장고 웅: 기본음 + 배음, 아주 느리게 흔들림
      for (const [k, v] of [[1, 1], [2, 0.5], [3, 0.3], [4, 0.15]] as const) osc(o, 'sine', l.f * k, t0, long, gainNode(o, v, g));
      const wob = gainNode(o, l.vol * 0.3);
      wob.connect(g.gain);
      osc(o, 'sine', 0.13, t0, long, wob);
    } else if (l.kind === 'rumble') {
      noise(o, t0, long, filt(o, 'lowpass', l.f, 1.5, g), true);
      const wob = gainNode(o, l.vol * 0.4);
      wob.connect(g.gain);
      osc(o, 'sine', 0.07, t0, long, wob);
    } else if (l.kind === 'air') {
      noise(o, t0, long, filt(o, 'bandpass', l.f, 0.6, g));
      const wob = gainNode(o, l.vol * 0.6);
      wob.connect(g.gain);
      osc(o, 'sine', 0.05, t0, long, wob);
    } else {
      osc(o, 'sine', l.f, t0, long, g);
    }
  }
  const timers = new Set<number>();
  const later = (f: () => void, ms: number) => {
    const id = window.setTimeout(() => { timers.delete(id); f(); }, ms);
    timers.add(id);
  };
  let live = true;
  const fire = (e: Ev) => {
    if (!live) return;
    if (ctx.state !== 'running') {
      // 멈춘 동안 쌓였다가 한꺼번에 터지지 않게 건너뛴다
      later(() => fire(e), e.gap[0] * 1000);
      return;
    }
    const vol = rnd(e.vol[0], e.vol[1]);
    const pan = (Math.random() * 2 - 1) * (e.pan ?? 0);
    const pitch = e.pitch ? rnd(e.pitch[0], e.pitch[1]) : 1;
    const t = ctx.currentTime + 0.05;
    if (e.id === 'typing') {
      const n = 4 + Math.floor(Math.random() * 10);
      for (let i = 0; i < n; i++) oneShot(o, ao => SFX.switchClick.fn(ao, t + i * rnd(0.07, 0.16), { vol: vol * rnd(0.5, 1), pan, pitch: rnd(1.2, 1.8), dest: out }));
    } else oneShot(o, ao => SFX[e.id as SfxId].fn(ao, t, { vol, pan, pitch, dest: out }));
    later(() => fire(e), rnd(e.gap[0], e.gap[1]) * 1000);
  };
  for (const e of spec.events) later(() => fire(e), rnd(e.gap[0] * 0.3, e.gap[1] * 0.6) * 1000);
  return {
    scene,
    stop(fade = 1.2) {
      if (!live) return;
      live = false;
      for (const id of timers) clearTimeout(id);
      timers.clear();
      const t = ctx.currentTime;
      for (const node of [out, verb, room]) {
        node.gain.cancelScheduledValues(t);
        node.gain.setValueAtTime(node.gain.value, t);
        node.gain.linearRampToValueAtTime(0, t + fade);
      }
      scope.stopAt(t + fade);
    },
  };
}
