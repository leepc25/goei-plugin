// 소리 엔진 바탕: 믹서(버스), 공용 잔향·잡음 버퍼, 합성 도우미. 녹음 음원 없이 Web Audio만 쓴다 (기본 기획서 20.3).
// 합성 함수는 BaseAudioContext만 받으므로 OfflineAudioContext로도 그대로 렌더해 시험할 수 있다.

export type Bus = 'master' | 'music' | 'sfx' | 'amb' | 'ui';
export const BUSES: Bus[] = ['master', 'music', 'sfx', 'amb', 'ui'];
export const BUS_LABEL: Record<Bus, string> = { master: '전체', music: '음악', sfx: '효과음', amb: '환경음', ui: '메뉴' };

export interface AudioSettings {
  master: number;
  music: number;
  sfx: number;
  amb: number;
  ui: number;
  muted: boolean;
}
export const DEFAULT_SETTINGS: AudioSettings = { master: 0.8, music: 0.55, sfx: 0.9, amb: 0.7, ui: 0.6, muted: false };

export function cleanSettings(x: unknown): AudioSettings {
  const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_SETTINGS };
  for (const b of BUSES) {
    const v = Number(o[b]);
    if (Number.isFinite(v)) out[b] = Math.min(1, Math.max(0, v));
  }
  out.muted = o.muted === true;
  return out;
}

// 귀로 듣는 크기는 로그에 가깝다: 밀대 0~1을 제곱해 넣으면 가운데가 '절반쯤'으로 들린다
export const sliderGain = (v: number) => v * v;

/** 합성 함수가 쓰는 출력 묶음 */
export interface Out {
  ctx: BaseAudioContext;
  sfx: AudioNode;
  ui: AudioNode;
  music: AudioNode;
  amb: AudioNode;
  verb: AudioNode; // 잔향 보내기 (긴 방)
  room: AudioNode; // 짧은 방 울림
  noise: AudioBuffer; // 흰 잡음 2초
  brown: AudioBuffer; // 갈색 잡음 4초 (낮은 웅웅거림)
}

export function makeNoise(ctx: BaseAudioContext, sec: number, brown = false): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = brown ? 7 : 3;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
  let last = 0;
  for (let i = 0; i < len; i++) {
    const w = rnd();
    if (brown) {
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = w;
  }
  // 이어 붙는 곳이 튀지 않게 끝을 조금 섞는다
  const fade = Math.min(2000, len >> 3);
  for (let i = 0; i < fade; i++) {
    const a = i / fade;
    d[len - fade + i] = d[len - fade + i] * (1 - a) + d[i] * a;
  }
  return buf;
}

export function makeImpulse(ctx: BaseAudioContext, sec: number, decay: number, dark = 0.5): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * sec);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    let seed = 17 + c * 31;
    for (let i = 0; i < len; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const w = seed / 2147483648 - 1;
      lp = lp + (w - lp) * (1 - dark * (i / len));
      d[i] = lp * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

const curves = new Map<number, Float32Array<ArrayBuffer>>();
export function driveCurve(k: number): Float32Array<ArrayBuffer> {
  let c = curves.get(k);
  if (c) return c;
  c = new Float32Array(1024);
  for (let i = 0; i < 1024; i++) {
    const x = (i / 1023) * 2 - 1;
    c[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  curves.set(k, c);
  return c;
}

/** 버스 이름 → 출력 묶음 안의 노드 */
export function busNode(o: Out, bus: Exclude<Bus, 'master'>): AudioNode {
  return o[bus];
}

// ── 합성 도우미 ────────────────────────────────────────────────────────────

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** 이 소리 한 번 분량의 출력: 음량·좌우·잔향 보내기 */
export function voice(o: Out, dest: AudioNode, t: number, vol = 1, pan = 0, verb = 0, room = 0): GainNode {
  const ctx = o.ctx;
  const g = ctx.createGain();
  g.gain.value = vol;
  let tail: AudioNode = g;
  if (pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p);
    tail = p;
  }
  tail.connect(dest);
  if (verb > 0) {
    const s = ctx.createGain();
    s.gain.value = verb;
    tail.connect(s).connect(o.verb);
  }
  if (room > 0) {
    const s = ctx.createGain();
    s.gain.value = room;
    tail.connect(s).connect(o.room);
  }
  void t;
  return g;
}

/** 붙였다 떼는 봉투: 0 → peak (a초) → 0 (d초, 지수 감쇠) */
export function perc(p: AudioParam, t: number, a: number, peak: number, d: number) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.001, a));
  p.exponentialRampToValueAtTime(0.0001, t + a + Math.max(0.005, d));
}

/** a → 유지 → 해제 봉투 */
export function adsr(p: AudioParam, t: number, a: number, d: number, s: number, hold: number, r: number, peak = 1) {
  p.cancelScheduledValues(t);
  p.setValueAtTime(0.0001, t);
  p.linearRampToValueAtTime(peak, t + Math.max(0.002, a));
  p.setTargetAtTime(peak * s, t + a, Math.max(0.003, d / 3));
  const end = t + Math.max(a + 0.005, hold);
  p.setTargetAtTime(0.0001, end, Math.max(0.005, r / 4));
  return end + r;
}

export function osc(o: Out, type: OscillatorType, f: number, t: number, dur: number, dest: AudioNode): OscillatorNode {
  const n = o.ctx.createOscillator();
  n.type = type;
  n.frequency.setValueAtTime(f, t);
  n.connect(dest);
  n.start(t);
  n.stop(t + dur + 0.05);
  return n;
}

export function noise(o: Out, t: number, dur: number, dest: AudioNode, brown = false, rate = 1): AudioBufferSourceNode {
  const n = o.ctx.createBufferSource();
  n.buffer = brown ? o.brown : o.noise;
  n.loop = true;
  n.playbackRate.value = rate;
  n.connect(dest);
  // 같은 잡음 구간이 매번 들리지 않게 시작점을 흔든다
  n.start(t, Math.random() * 1.5);
  n.stop(t + dur + 0.05);
  return n;
}

export function filt(o: Out, type: BiquadFilterType, f: number, q = 0.7, dest?: AudioNode): BiquadFilterNode {
  const n = o.ctx.createBiquadFilter();
  n.type = type;
  n.frequency.value = f;
  n.Q.value = q;
  if (dest) n.connect(dest);
  return n;
}

export function gainNode(o: Out, v: number, dest?: AudioNode): GainNode {
  const g = o.ctx.createGain();
  g.gain.value = v;
  if (dest) g.connect(dest);
  return g;
}

export function shaper(o: Out, k: number, dest?: AudioNode): WaveShaperNode {
  const n = o.ctx.createWaveShaper();
  n.curve = driveCurve(k);
  n.oversample = '2x';
  if (dest) n.connect(dest);
  return n;
}

/** 버스·잔향을 한 컨텍스트에 꾸린다. 실시간·오프라인 공용 */
export function buildGraph(ctx: BaseAudioContext, dest: AudioNode) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 8;
  comp.ratio.value = 6;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;
  const master = ctx.createGain();
  master.connect(comp).connect(dest);
  const bus = (v: number) => {
    const g = ctx.createGain();
    g.gain.value = v;
    g.connect(master);
    return g;
  };
  const music = bus(1);
  const sfx = bus(1);
  const amb = bus(1);
  const ui = bus(1);
  // 음악만 따로 낮출 수 있게(컷인) 한 단 더 둔다
  const duck = ctx.createGain();
  duck.connect(music);
  const verb = ctx.createConvolver();
  verb.buffer = makeImpulse(ctx, 2.6, 2.4, 0.7);
  const verbOut = ctx.createGain();
  verbOut.gain.value = 0.55;
  verb.connect(verbOut).connect(master);
  const room = ctx.createConvolver();
  room.buffer = makeImpulse(ctx, 0.45, 3, 0.3);
  const roomOut = ctx.createGain();
  roomOut.gain.value = 0.5;
  room.connect(roomOut).connect(master);
  const out: Out = {
    ctx,
    sfx,
    ui,
    music: duck,
    amb,
    verb,
    room,
    noise: makeNoise(ctx, 2),
    brown: makeNoise(ctx, 4, true),
  };
  return { out, gains: { master, music, sfx, amb, ui } as Record<Bus, GainNode>, duck, comp };
}
