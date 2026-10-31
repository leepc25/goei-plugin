// 효과음 합성 목록. 모든 소리는 코드로 그때그때 만든다 (용량 0).
// 타격은 미스타라·던파식: 낮은 '쿵' + 짧은 '딱' + 몸통 울림, 1·2·3타로 갈수록 무겁고 길게 (기본 기획서 1.1.1).
import { type Out, voice, perc, osc, noise, filt, gainNode, shaper, mtof } from './engine';

export interface SfxParams {
  vol: number;
  pan: number;
  pitch: number; // 1 = 그대로
  dest: AudioNode;
}
type Recipe = (o: Out, t: number, p: SfxParams) => number;

export type SfxGroup = 'combat' | 'enemy' | 'ui' | 'step' | 'elevator' | 'world';
export const GROUP_LABEL: Record<SfxGroup, string> = {
  combat: '전투',
  enemy: '적·수호자',
  ui: '메뉴·알림',
  step: '발소리',
  elevator: '승강기',
  world: '층·사물',
};

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// ── 재료 ──────────────────────────────────────────────────────────────

/** 낮은 쿵: 사인파 음높이를 떨어뜨린다 */
function thump(o: Out, t: number, dest: AudioNode, f0: number, f1: number, dur: number, vol: number) {
  const g = gainNode(o, 0, dest);
  perc(g.gain, t, 0.002, vol, dur);
  const n = osc(o, 'sine', f0, t, dur, g);
  n.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.8);
}

/** 짧은 잡음 터짐 (딱·칙) */
function burst(o: Out, t: number, dest: AudioNode, type: BiquadFilterType, f: number, q: number, dur: number, vol: number, a = 0.001) {
  const g = gainNode(o, 0, dest);
  perc(g.gain, t, a, vol, dur);
  const fl = filt(o, type, f, q, g);
  noise(o, t, dur + a, fl);
  return fl;
}

/** 음 하나 (삑·띵) */
function tone(o: Out, t: number, dest: AudioNode, type: OscillatorType, f: number, dur: number, vol: number, a = 0.003) {
  const g = gainNode(o, 0, dest);
  perc(g.gain, t, a, vol, dur);
  return osc(o, type, f, t, dur + a, g);
}

/** FM 종소리: 반송파 + 변조파 (YM 계열 칩 소리) */
function bell(o: Out, t: number, dest: AudioNode, f: number, dur: number, vol: number, ratio = 3.5, index = 3) {
  const g = gainNode(o, 0, dest);
  perc(g.gain, t, 0.002, vol, dur);
  const car = osc(o, 'sine', f, t, dur, g);
  const mg = gainNode(o, 0);
  mg.gain.setValueAtTime(f * index, t);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, t + dur);
  mg.connect(car.frequency);
  osc(o, 'sine', f * ratio, t, dur, mg);
}

/** 휙: 잡음을 대역 필터로 쓸어 올리고 내린다 */
function swoosh(o: Out, t: number, dest: AudioNode, f0: number, f1: number, dur: number, vol: number) {
  const g = gainNode(o, 0, dest);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const fl = filt(o, 'bandpass', f0, 1.4, g);
  fl.frequency.setValueAtTime(f0, t);
  fl.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.4);
  fl.frequency.exponentialRampToValueAtTime(f0 * 0.7, t + dur);
  noise(o, t, dur, fl);
}

// ── 전투 ──────────────────────────────────────────────────────────────

function hit(level: 1 | 2 | 3): Recipe {
  return (o, t, p) => {
    const v = voice(o, p.dest, t, p.vol, p.pan, 0.08 * level, 0.25);
    const k = p.pitch * rnd(0.95, 1.05);
    const len = [0.1, 0.16, 0.28][level - 1];
    thump(o, t, v, [150, 130, 110][level - 1] * k, 40, len, [0.8, 0.95, 1.1][level - 1]);
    burst(o, t, v, 'bandpass', [2600, 2000, 1500][level - 1] * k, 1.2, [0.03, 0.045, 0.07][level - 1], [0.7, 0.8, 0.9][level - 1]);
    // 몸통 울림: 찌그러뜨린 삼각파
    const body = gainNode(o, 0, v);
    perc(body.gain, t, 0.001, 0.35 + level * 0.1, len * 0.7);
    const sh = shaper(o, 4 + level * 6, body);
    const b = osc(o, 'triangle', 320 * k, t, len, sh);
    b.frequency.exponentialRampToValueAtTime(90 * k, t + len * 0.6);
    if (level === 3) {
      // 강타: 지연된 두 번째 충격 + 낮은 붐
      thump(o, t + 0.012, v, 70, 30, 0.35, 0.8);
      burst(o, t, v, 'lowpass', 900, 0.7, 0.22, 0.5);
    }
    return len + 0.4;
  };
}

const whiff: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  swoosh(o, t, v, 600 * p.pitch, 2400 * p.pitch, 0.16, 0.45);
  return 0.2;
};

const swingHeavy: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  swoosh(o, t, v, 300 * p.pitch, 1400 * p.pitch, 0.28, 0.6);
  return 0.3;
};

const kick: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1, 0.2);
  swoosh(o, t, v, 500, 1800, 0.12, 0.35);
  thump(o, t + 0.08, v, 140 * p.pitch, 45, 0.14, 0.9);
  burst(o, t + 0.08, v, 'bandpass', 1800, 1, 0.05, 0.7);
  return 0.4;
};

const lowKick: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.2);
  swoosh(o, t, v, 250, 900, 0.1, 0.4);
  thump(o, t + 0.05, v, 110, 40, 0.12, 0.9);
  burst(o, t + 0.05, v, 'lowpass', 1500, 0.8, 0.08, 0.6);
  return 0.3;
};

const dashHit: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.15, 0.2);
  swoosh(o, t, v, 400, 3000, 0.2, 0.5);
  thump(o, t + 0.12, v, 120, 35, 0.3, 1.1);
  burst(o, t + 0.12, v, 'bandpass', 1300, 0.9, 0.09, 0.8);
  return 0.6;
};

const gun: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.25, 0.4);
  const k = p.pitch * rnd(0.96, 1.04);
  burst(o, t, v, 'highpass', 1200 * k, 0.6, 0.06, 0.9);
  burst(o, t, v, 'bandpass', 500 * k, 0.8, 0.12, 0.8);
  thump(o, t, v, 180 * k, 50, 0.1, 1);
  // 작은 금속성 '칭' (슬라이드)
  tone(o, t + 0.07, v, 'square', 2900 * k, 0.03, 0.06);
  return 0.6;
};

const gunSilenced: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.15);
  burst(o, t, v, 'lowpass', 1400 * p.pitch, 0.9, 0.05, 0.6);
  thump(o, t, v, 220, 80, 0.05, 0.4);
  tone(o, t + 0.05, v, 'square', 2600, 0.025, 0.05);
  return 0.2;
};

const reload: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.3);
  burst(o, t, v, 'bandpass', 3000, 3, 0.03, 0.5);
  tone(o, t, v, 'square', 1800, 0.02, 0.08);
  burst(o, t + 0.22, v, 'bandpass', 2200, 4, 0.04, 0.6);
  tone(o, t + 0.22, v, 'triangle', 900, 0.05, 0.2);
  return 0.4;
};

const emptyClick: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  burst(o, t, v, 'highpass', 4000, 1, 0.015, 0.5);
  tone(o, t, v, 'square', 1400, 0.015, 0.1);
  return 0.1;
};

const bulletHit: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.2);
  burst(o, t, v, 'bandpass', 1800 * p.pitch, 1.5, 0.04, 0.7);
  thump(o, t, v, 130, 50, 0.07, 0.6);
  return 0.15;
};

const ricochet: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol * 0.6, p.pan, 0.2);
  const n = tone(o, t, v, 'sine', 3800 * p.pitch, 0.35, 0.3);
  n.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
  burst(o, t, v, 'highpass', 3000, 1, 0.02, 0.4);
  return 0.5;
};

const guard: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.12, 0.3);
  burst(o, t, v, 'bandpass', 1100, 2, 0.05, 0.7);
  // 금속성 막는 소리: 맞지 않는 배음 두 개
  tone(o, t, v, 'square', 520 * p.pitch, 0.12, 0.12);
  tone(o, t, v, 'triangle', 1370 * p.pitch, 0.18, 0.18);
  thump(o, t, v, 100, 60, 0.06, 0.5);
  return 0.3;
};

const guardBreak: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3, 0.3);
  const sh = shaper(o, 20, v);
  burst(o, t, sh, 'bandpass', 900, 1, 0.25, 0.6);
  const n = tone(o, t, v, 'sawtooth', 600, 0.4, 0.25);
  n.frequency.exponentialRampToValueAtTime(90, t + 0.4);
  thump(o, t, v, 90, 30, 0.3, 1);
  // 비틀거림 경고음
  for (let i = 0; i < 3; i++) tone(o, t + 0.25 + i * 0.12, v, 'square', 1500 - i * 200, 0.06, 0.06);
  return 0.7;
};

const parry: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.35);
  bell(o, t, v, 1320 * p.pitch, 0.6, 0.4, 2.01, 2);
  burst(o, t, v, 'highpass', 5000, 1, 0.04, 0.5);
  return 0.8;
};

const evade: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  swoosh(o, t, v, 800, 3500, 0.22, 0.4);
  burst(o, t + 0.15, v, 'lowpass', 600, 0.7, 0.08, 0.25);
  return 0.3;
};

const jump: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  burst(o, t, v, 'lowpass', 700, 0.7, 0.06, 0.4);
  swoosh(o, t, v, 500, 1500, 0.14, 0.2);
  return 0.2;
};

const land: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.25);
  thump(o, t, v, 90, 40, 0.1, 0.7);
  burst(o, t, v, 'lowpass', 900, 0.7, 0.08, 0.45);
  return 0.2;
};

const hurt: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.05, 0.2);
  thump(o, t, v, 120, 45, 0.15, 1);
  burst(o, t, v, 'bandpass', 1000, 0.9, 0.08, 0.7);
  // 숨이 막히는 듯한 짧은 '헉' (모음 비슷하게 잡음 두 대역)
  const g = gainNode(o, 0, v);
  perc(g.gain, t + 0.02, 0.01, 0.25, 0.12);
  const f1 = filt(o, 'bandpass', 700, 6, g);
  const f2 = filt(o, 'bandpass', 1200, 6, g);
  const n = noise(o, t + 0.02, 0.15, f1);
  n.connect(f2);
  return 0.3;
};

const down: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.3);
  thump(o, t, v, 80, 30, 0.25, 1);
  burst(o, t, v, 'lowpass', 600, 0.7, 0.2, 0.6);
  thump(o, t + 0.18, v, 70, 30, 0.12, 0.5); // 한 번 튕김
  burst(o, t + 0.18, v, 'lowpass', 500, 0.7, 0.1, 0.3);
  return 0.5;
};

const wakeup: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  swoosh(o, t, v, 400, 1200, 0.2, 0.3);
  return 0.25;
};

const armor: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2, 0.2);
  tone(o, t, v, 'square', 220, 0.12, 0.2);
  tone(o, t, v, 'square', 331, 0.12, 0.15);
  burst(o, t, v, 'bandpass', 2400, 3, 0.05, 0.4);
  return 0.3;
};

/** 능력 충격파: 낮게 울리는 폭발 + 공기 밀림 */
const ability: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.4, 0.3);
  thump(o, t, v, 160, 28, 0.6, 1.2);
  const g = gainNode(o, 0, v);
  perc(g.gain, t, 0.01, 0.8, 0.7);
  const fl = filt(o, 'lowpass', 3000, 0.8, g);
  fl.frequency.setValueAtTime(3000, t);
  fl.frequency.exponentialRampToValueAtTime(200, t + 0.7);
  const sh = shaper(o, 8, fl);
  noise(o, t, 0.75, sh, true, 2);
  swoosh(o, t, v, 300, 1800, 0.5, 0.35);
  return 1.2;
};

/** 필살기 시작: 화면 암전·컷인 순간의 '촤앙' */
const superStart: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.6);
  const n = tone(o, t, v, 'sawtooth', 110, 0.9, 0.25, 0.01);
  n.frequency.exponentialRampToValueAtTime(880, t + 0.6);
  const n2 = tone(o, t, v, 'sawtooth', 112, 0.9, 0.2, 0.01);
  n2.frequency.exponentialRampToValueAtTime(887, t + 0.6);
  burst(o, t, v, 'highpass', 6000, 0.7, 0.5, 0.25, 0.3);
  bell(o, t + 0.55, v, 1760, 1.2, 0.35, 3.5, 4);
  burst(o, t + 0.55, v, 'bandpass', 3000, 0.7, 0.15, 0.6);
  return 1.8;
};

/** 필살기 명중: 강타보다 크고 길게 */
const superHit: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5, 0.3);
  hit(3)(o, t, { ...p, dest: v, vol: 1, pan: 0 });
  thump(o, t + 0.02, v, 60, 25, 0.9, 1.1);
  const g = gainNode(o, 0, v);
  perc(g.gain, t, 0.005, 0.9, 1.1);
  const fl = filt(o, 'lowpass', 2500, 0.7, g);
  fl.frequency.exponentialRampToValueAtTime(120, t + 1.1);
  noise(o, t, 1.2, shaper(o, 12, fl), true, 3);
  return 1.6;
};

const heal: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.4);
  [72, 76, 79, 84].forEach((m, i) => bell(o, t + i * 0.07, v, mtof(m) * p.pitch, 0.5, 0.18, 2, 1.2));
  return 1;
};

const itemUse: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  burst(o, t, v, 'bandpass', 2500, 2, 0.06, 0.5); // 뚜껑 따는 소리
  tone(o, t + 0.08, v, 'square', 660, 0.06, 0.12);
  tone(o, t + 0.15, v, 'square', 990, 0.1, 0.12);
  return 0.35;
};

const pickup: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.15);
  tone(o, t, v, 'square', 988 * p.pitch, 0.07, 0.15);
  tone(o, t + 0.07, v, 'square', 1319 * p.pitch, 0.15, 0.15);
  return 0.3;
};

const enemyDie: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.35);
  // 괴이가 흩어지는 소리: 내려가는 잡음 + 거꾸로 울리는 종
  const g = gainNode(o, 0, v);
  perc(g.gain, t, 0.02, 0.6, 0.8);
  const fl = filt(o, 'bandpass', 3000, 2, g);
  fl.frequency.exponentialRampToValueAtTime(150, t + 0.8);
  noise(o, t, 0.85, fl);
  const n = tone(o, t, v, 'triangle', 880 * p.pitch, 0.7, 0.2, 0.01);
  n.frequency.exponentialRampToValueAtTime(110, t + 0.7);
  return 1;
};

// ── 적·수호자 ─────────────────────────────────────────────────────────

/** 공격 예고: 짧고 날카로운 경고 (보고 피할 시간) */
const enemyTell: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2);
  const n = tone(o, t, v, 'sawtooth', 700 * p.pitch, 0.25, 0.18, 0.02);
  n.frequency.exponentialRampToValueAtTime(1400 * p.pitch, t + 0.2);
  tone(o, t, v, 'sine', 1404 * p.pitch, 0.25, 0.12, 0.02);
  return 0.35;
};

/** 모퉁이 귀신: 떨리는 울음 */
const ghostWail: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  const dur = 1.3;
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.35, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const f = 420 * p.pitch;
  const a = osc(o, 'sine', f, t, dur, g);
  const b = osc(o, 'triangle', f * 1.5, t, dur, gainNode(o, 0.3, g));
  for (const n of [a, b]) {
    n.frequency.linearRampToValueAtTime(f * 1.25 * (n === b ? 1.5 : 1), t + 0.5);
    n.frequency.linearRampToValueAtTime(f * 0.8 * (n === b ? 1.5 : 1), t + dur);
  }
  const lg = gainNode(o, f * 0.03);
  lg.connect(a.frequency);
  osc(o, 'sine', 6.5, t, dur, lg);
  // 숨소리 섞기
  const ng = gainNode(o, 0, v);
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.linearRampToValueAtTime(0.12, t + 0.3);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise(o, t, dur, filt(o, 'bandpass', f * 2, 3, ng));
  return dur + 0.5;
};

const ghostAttack: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3);
  swoosh(o, t, v, 300, 2200, 0.25, 0.5);
  const n = tone(o, t, v, 'sawtooth', 300, 0.3, 0.2, 0.02);
  n.frequency.exponentialRampToValueAtTime(900, t + 0.25);
  return 0.4;
};

const crawler: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1, 0.3);
  // 다리 많은 것: 빠른 딱딱 소리 무리
  const n = 14;
  for (let i = 0; i < n; i++) {
    const tt = t + i * rnd(0.03, 0.055);
    burst(o, tt, v, 'bandpass', rnd(2200, 4200) * p.pitch, 6, 0.012, rnd(0.25, 0.5));
  }
  return 0.9;
};

const stomp: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.15, 0.4);
  thump(o, t, v, 60 * p.pitch, 25, 0.35, 1.2);
  burst(o, t, v, 'lowpass', 400, 0.7, 0.25, 0.6);
  return 0.5;
};

const enemyShot: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2);
  burst(o, t, v, 'bandpass', 900, 1.2, 0.08, 0.7);
  thump(o, t, v, 150, 60, 0.08, 0.6);
  return 0.3;
};

const enemySpawn: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.6);
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  const fl = filt(o, 'bandpass', 200, 3, g);
  fl.frequency.exponentialRampToValueAtTime(2500, t + 0.5);
  noise(o, t, 0.7, fl);
  tone(o, t + 0.45, v, 'sine', 55, 0.4, 0.5);
  return 1;
};

const whisper: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  // 알아들을 수 없는 속삭임: 모음 대역을 바꿔 가며 잡음을 짧게 끊는다
  const syll = 6 + Math.floor(Math.random() * 4);
  let tt = t;
  for (let i = 0; i < syll; i++) {
    const d = rnd(0.07, 0.16);
    const g = gainNode(o, 0, v);
    perc(g.gain, tt, d * 0.3, rnd(0.15, 0.3), d);
    const f1 = filt(o, 'bandpass', rnd(500, 900), 8, g);
    const f2 = filt(o, 'bandpass', rnd(1200, 2600), 8, g);
    const hs = filt(o, 'highpass', 4000, 0.7, gainNode(o, 0.4, g));
    const n = noise(o, tt, d * 1.3, f1);
    n.connect(f2);
    n.connect(hs);
    tt += d + rnd(0.01, 0.06);
  }
  return tt - t + 0.6;
};

const bossTell: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.4);
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.16;
    tone(o, tt, v, 'square', 880, 0.1, 0.12);
    tone(o, tt, v, 'square', 932, 0.1, 0.1); // 반음 부딪힘
  }
  thump(o, t, v, 70, 35, 0.6, 0.8);
  return 0.8;
};

const bossRoar: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  const dur = 1.6;
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.9, t + 0.15);
  g.gain.setTargetAtTime(0.0001, t + dur * 0.6, 0.25);
  const sh = shaper(o, 30, g);
  const base = 70 * p.pitch;
  const a = osc(o, 'sawtooth', base, t, dur, sh);
  const b = osc(o, 'sawtooth', base * 1.47, t, dur, sh);
  a.frequency.linearRampToValueAtTime(base * 0.75, t + dur);
  b.frequency.linearRampToValueAtTime(base * 1.1, t + dur);
  // 그르렁: 낮은 떨림으로 음량을 흔든다
  const am = gainNode(o, 0.35);
  am.connect(g.gain);
  osc(o, 'sine', 23, t, dur, am);
  const ng = gainNode(o, 0, v);
  perc(ng.gain, t, 0.1, 0.4, dur);
  noise(o, t, dur, filt(o, 'bandpass', 500, 1.5, ng), true, 4);
  return dur + 1;
};

const heartbeat: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  thump(o, t, v, 55, 35, 0.12, 0.9);
  thump(o, t + 0.22, v, 50, 30, 0.15, 0.7);
  return 0.5;
};

/** 거점 경보 사이렌 한 바퀴 (10-31 필드 기능 9번): 오르내리는 두 음 울림. 경보 중 1.6초마다 다시 튼다 */
const siren: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol * 0.55, p.pan, 0.25);
  const lp = filt(o, 'lowpass', 2600, 0.8, v);
  const g = gainNode(o, 0, lp);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.08);
  g.gain.setValueAtTime(0.5, t + 1.35);
  g.gain.linearRampToValueAtTime(0, t + 1.55);
  for (const [type, k] of [['sawtooth', 1], ['square', 1.5]] as const) {
    const n = osc(o, type, 620 * k, t, 1.55, g);
    n.frequency.linearRampToValueAtTime(980 * k, t + 0.75);
    n.frequency.linearRampToValueAtTime(620 * k, t + 1.5);
  }
  return 1.6;
};

const enemyStep: Recipe = (o, t, p) => {
  // 어둠의 층: 보이지 않는 것의 발소리. 몸이 없는 듯 축축하고 무겁게
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3);
  thump(o, t, v, 75 * p.pitch, 40, 0.15, 0.7);
  burst(o, t, v, 'bandpass', 500, 4, 0.1, 0.35);
  return 0.3;
};

// ── 발소리 (바닥 재질) ───────────────────────────────────────────────

export type Surface = 'marble' | 'concrete' | 'carpet' | 'metal' | 'tile' | 'wet' | 'void' | 'wood';
export const SURFACE_LABEL: Record<Surface, string> = {
  marble: '대리석',
  concrete: '콘크리트',
  carpet: '장판·카펫',
  metal: '철판·덕트',
  tile: '타일',
  wet: '젖은 바닥',
  void: '알 수 없는 재질',
  wood: '나무 마루',
};

function step(s: Surface): Recipe {
  return (o, t, p) => {
    const k = p.pitch * rnd(0.9, 1.1);
    const vol = p.vol * rnd(0.8, 1);
    switch (s) {
      case 'marble': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.12, 0.3);
        burst(o, t, v, 'bandpass', 3200 * k, 2, 0.025, 0.5);
        burst(o, t + 0.005, v, 'bandpass', 900 * k, 1.5, 0.05, 0.35);
        return 0.15;
      }
      case 'concrete': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.03, 0.25);
        burst(o, t, v, 'bandpass', 1400 * k, 1, 0.04, 0.5);
        thump(o, t, v, 110 * k, 60, 0.05, 0.4);
        return 0.12;
      }
      case 'carpet': {
        const v = voice(o, p.dest, t, vol, p.pan);
        burst(o, t, v, 'lowpass', 500 * k, 0.7, 0.07, 0.55, 0.008);
        return 0.12;
      }
      case 'wood': {
        const v = voice(o, p.dest, t, vol, p.pan, 0, 0.3);
        burst(o, t, v, 'bandpass', 1100 * k, 2, 0.04, 0.45);
        tone(o, t, v, 'triangle', 190 * k, 0.07, 0.25);
        if (Math.random() < 0.15) {
          // 삐걱
          const n = tone(o, t + 0.05, v, 'sawtooth', 380, 0.18, 0.04, 0.05);
          n.frequency.linearRampToValueAtTime(330, t + 0.2);
        }
        return 0.3;
      }
      case 'metal': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.1, 0.4);
        burst(o, t, v, 'bandpass', 2000 * k, 1, 0.02, 0.4);
        tone(o, t, v, 'triangle', 517 * k, 0.18, 0.12);
        tone(o, t, v, 'sine', 1243 * k, 0.12, 0.08);
        tone(o, t, v, 'sine', 2071 * k, 0.08, 0.05);
        return 0.25;
      }
      case 'tile': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.08, 0.35);
        burst(o, t, v, 'highpass', 3500 * k, 1, 0.02, 0.5);
        burst(o, t, v, 'bandpass', 1200 * k, 1.5, 0.04, 0.3);
        return 0.12;
      }
      case 'wet': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.05, 0.2);
        const g = gainNode(o, 0, v);
        perc(g.gain, t, 0.005, 1.6, 0.12);
        const fl = filt(o, 'bandpass', 600 * k, 5, g);
        fl.frequency.exponentialRampToValueAtTime(1800 * k, t + 0.1);
        noise(o, t, 0.13, fl);
        return 0.2;
      }
      case 'void': {
        const v = voice(o, p.dest, t, vol, p.pan, 0.4);
        thump(o, t, v, 60 * k, 45, 0.2, 0.5);
        const n = tone(o, t, v, 'sine', 880 * k, 0.25, 0.05, 0.08);
        n.frequency.exponentialRampToValueAtTime(840 * k, t + 0.25);
        return 0.4;
      }
    }
  };
}

// ── 승강기 ────────────────────────────────────────────────────────────

/** 띵. (원문 첫 장면) */
const ding: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.35, 0.3);
  bell(o, t, v, 1318.5 * p.pitch, 2.2, 0.45, 1.0, 1.5);
  bell(o, t, v, 1318.5 * 2.76 * p.pitch, 1.0, 0.08, 1.0, 0.8);
  return 2.6;
};

/** 띵-동 (두 음): 승강기 도착 안내 */
const dingDong: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.35, 0.3);
  bell(o, t, v, 1318.5 * p.pitch, 1.4, 0.4, 1.0, 1.4);
  bell(o, t + 0.45, v, 1046.5 * p.pitch, 2, 0.4, 1.0, 1.4);
  return 2.6;
};

function doorSlide(open: boolean): Recipe {
  return (o, t, p) => {
    const v = voice(o, p.dest, t, p.vol, p.pan, 0.1, 0.3);
    const dur = 1.1;
    // 모터 웅
    const mg = gainNode(o, 0, v);
    mg.gain.setValueAtTime(0.0001, t);
    mg.gain.linearRampToValueAtTime(0.18, t + 0.15);
    mg.gain.setValueAtTime(0.18, t + dur - 0.2);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const m = osc(o, 'sawtooth', 95, t, dur, filt(o, 'lowpass', 300, 1, mg));
    m.frequency.linearRampToValueAtTime(open ? 110 : 85, t + dur);
    // 문짝 미끄러짐
    const rg = gainNode(o, 0, v);
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.linearRampToValueAtTime(0.3, t + 0.2);
    rg.gain.setValueAtTime(0.3, t + dur - 0.25);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    noise(o, t, dur, filt(o, 'bandpass', 700, 0.8, rg), true, 6);
    // 끝에 쿵 (닫힘이 더 크다)
    thump(o, t + dur - 0.05, v, open ? 120 : 90, 40, 0.12, open ? 0.4 : 0.9);
    burst(o, t + dur - 0.05, v, 'bandpass', 1500, 2, 0.04, open ? 0.2 : 0.5);
    return dur + 0.3;
  };
}

const panelButton: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.2);
  burst(o, t, v, 'bandpass', 3500, 3, 0.012, 0.6);
  tone(o, t + 0.01, v, 'sine', 1975 * p.pitch, 0.09, 0.2);
  return 0.15;
};

const intercom: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  const dur = 0.9;
  // 잡음 띠 + 툭툭 끊기는 소리
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.3, t + 0.03);
  g.gain.setValueAtTime(0.3, t + dur - 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const bp = filt(o, 'bandpass', 1800, 1.2, g);
  noise(o, t, dur, shaper(o, 30, bp));
  for (let i = 0; i < 8; i++) burst(o, t + rnd(0, dur), v, 'highpass', 2500, 1, 0.01, rnd(0.2, 0.5));
  tone(o, t, v, 'square', 1000, 0.05, 0.08);
  return dur + 0.2;
};

/** 승강기 이동 한 번: 덜컥 → 웅 → 멈춤 */
const elevatorRide: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.3);
  const dur = 2.8;
  thump(o, t, v, 70, 35, 0.2, 0.8);
  burst(o, t, v, 'lowpass', 500, 0.7, 0.15, 0.4);
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.6);
  g.gain.setValueAtTime(0.5, t + dur - 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const h = osc(o, 'sawtooth', 48, t, dur, filt(o, 'lowpass', 220, 2, g));
  h.frequency.linearRampToValueAtTime(52, t + dur * 0.5);
  h.frequency.linearRampToValueAtTime(46, t + dur);
  noise(o, t, dur, filt(o, 'lowpass', 300, 0.7, gainNode(o, 0.6, g)), true);
  // 승강로 바람
  swoosh(o, t + 0.5, v, 200, 700, dur - 0.8, 0.15);
  thump(o, t + dur - 0.1, v, 80, 35, 0.15, 0.6);
  return dur + 0.3;
};

const ropeCreak: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3);
  const dur = rnd(0.5, 0.9);
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.2, t + dur * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  // 삐걱: 아주 낮은 음의 펄스열을 공명 필터로
  const f = rnd(18, 30);
  const s = osc(o, 'sawtooth', f, t, dur, filt(o, 'bandpass', rnd(600, 1100), 12, g));
  s.frequency.linearRampToValueAtTime(f * rnd(0.6, 1.4), t + dur);
  return dur + 0.4;
};

// ── 메뉴·알림 ─────────────────────────────────────────────────────────

const uiMove: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  tone(o, t, v, 'square', 1760 * p.pitch, 0.03, 0.14);
  return 0.06;
};
const uiOk: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.05);
  tone(o, t, v, 'square', 1320 * p.pitch, 0.05, 0.1);
  tone(o, t + 0.05, v, 'square', 1980 * p.pitch, 0.09, 0.1);
  return 0.18;
};
const uiBack: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  tone(o, t, v, 'square', 1320 * p.pitch, 0.05, 0.09);
  tone(o, t + 0.05, v, 'square', 880 * p.pitch, 0.08, 0.09);
  return 0.16;
};
const uiError: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  tone(o, t, v, 'square', 196, 0.09, 0.15);
  tone(o, t + 0.11, v, 'square', 185, 0.14, 0.15);
  return 0.3;
};
const uiOpen: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  swoosh(o, t, v, 1500, 5000, 0.12, 0.15);
  tone(o, t + 0.04, v, 'triangle', 1046, 0.1, 0.12);
  return 0.2;
};
const uiClose: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  swoosh(o, t, v, 4000, 1200, 0.1, 0.12);
  return 0.15;
};
const textBlip: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan);
  tone(o, t, v, 'square', 600 * p.pitch * rnd(0.97, 1.03), 0.025, 0.05);
  return 0.04;
};
/** 괴담톡 알림 (진동 + 두 음) */
const message: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  bell(o, t, v, 1568, 0.25, 0.2, 2, 1);
  bell(o, t + 0.12, v, 2093, 0.4, 0.2, 2, 1);
  const g = gainNode(o, 0, v);
  perc(g.gain, t, 0.01, 0.15, 0.25);
  osc(o, 'square', 150, t, 0.25, filt(o, 'lowpass', 300, 1, g));
  return 0.6;
};
/** 규칙서 한 줄이 열릴 때: 도장 (기본 기획서 21장 1) */
const ruleStamp: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.25, 0.4);
  thump(o, t, v, 140, 50, 0.12, 1.1);
  burst(o, t, v, 'lowpass', 1800, 0.7, 0.09, 0.8); // 종이 철썩
  burst(o, t, v, 'bandpass', 4000, 1, 0.03, 0.4);
  [64, 68, 71, 76].forEach((m, i) => bell(o, t + 0.18 + i * 0.05, v, mtof(m), 0.9, 0.14, 1, 1.2));
  return 1.2;
};
const save: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2);
  [67, 72, 79].forEach((m, i) => tone(o, t + i * 0.08, v, 'triangle', mtof(m), 0.25, 0.15));
  return 0.6;
};
const coin: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  tone(o, t, v, 'square', 1975, 0.06, 0.12);
  tone(o, t + 0.06, v, 'square', 2637, 0.25, 0.12);
  return 0.35;
};
const levelUp: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3);
  [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => tone(o, t + i * 0.05, v, 'square', mtof(m), 0.12, 0.08));
  bell(o, t + 0.36, v, mtof(84), 1, 0.25, 2, 2);
  return 1.4;
};

// ── 층·사물 ───────────────────────────────────────────────────────────

const doorWood: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1, 0.4);
  // 경첩 삐걱 + 닫힘
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.7, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  const s = osc(o, 'sawtooth', 24, t, 0.6, filt(o, 'bandpass', 1300, 14, g));
  s.frequency.linearRampToValueAtTime(14, t + 0.6);
  return 0.7;
};
const doorSlam: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.35, 0.4);
  thump(o, t, v, 95, 40, 0.25, 1.1);
  burst(o, t, v, 'lowpass', 1200, 0.7, 0.18, 0.7);
  burst(o, t, v, 'bandpass', 2500, 2, 0.04, 0.4);
  return 1;
};
/** 똑똑똑 (408호처럼 문 두드리는 소리) */
const knock: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.15, 0.5);
  for (let i = 0; i < 3; i++) {
    const tt = t + i * 0.22 + (i === 2 ? 0.05 : 0);
    thump(o, tt, v, 160, 90, 0.06, 0.7);
    burst(o, tt, v, 'bandpass', 900, 3, 0.04, 0.5);
  }
  return 1;
};
const switchClick: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.3);
  burst(o, t, v, 'bandpass', 2800, 4, 0.015, 0.7);
  thump(o, t, v, 300, 150, 0.03, 0.3);
  return 0.1;
};
/** 문 손잡이 찰칵: 걸쇠가 빠지는 짧은 두 번 딸깍 (본부 문, 2026-10-25 사용자: 지이익 대신 찰칵) */
const doorLatch: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol * 0.7, p.pan, 0, 0.25);
  burst(o, t, v, 'bandpass', 2200 * p.pitch, 6, 0.012, 0.55);
  thump(o, t, v, 260, 120, 0.025, 0.25);
  burst(o, t + 0.07, v, 'bandpass', 1500 * p.pitch, 5, 0.018, 0.4);
  thump(o, t + 0.07, v, 180, 90, 0.04, 0.2);
  return 0.2;
};
/** 엘리베이터 도착 부드러운 띵 (사용자: 너무 쨍함 → 낮고 짧게, 작게) */
const elevChime: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol * 0.45, p.pan, 0.25, 0.2);
  bell(o, t, v, 784 * p.pitch, 1.1, 0.3, 1.0, 0.6);
  return 1.3;
};
const crateBreak: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1, 0.3);
  thump(o, t, v, 120, 50, 0.15, 0.8);
  for (let i = 0; i < 7; i++) {
    const tt = t + rnd(0, 0.25);
    burst(o, tt, v, 'bandpass', rnd(700, 2500), 3, rnd(0.02, 0.06), rnd(0.2, 0.5));
  }
  return 0.6;
};
const glassBreak: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3, 0.3);
  burst(o, t, v, 'highpass', 3000, 0.7, 0.15, 0.7);
  for (let i = 0; i < 9; i++) {
    const tt = t + rnd(0.02, 0.5);
    tone(o, tt, v, 'sine', rnd(3000, 7000), rnd(0.05, 0.2), rnd(0.05, 0.12));
  }
  return 0.9;
};
/** 깜빡이는 형광등의 '지직' */
const flicker: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  for (let i = 0; i < 5; i++) {
    const tt = t + rnd(0, 0.5);
    const d = rnd(0.02, 0.08);
    const g = gainNode(o, 0, v);
    perc(g.gain, tt, 0.002, rnd(0.15, 0.3), d);
    osc(o, 'sawtooth', 120, tt, d, filt(o, 'highpass', 800, 1, g));
  }
  return 0.7;
};
const drip: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  const n = tone(o, t, v, 'sine', rnd(1400, 2200) * p.pitch, 0.08, 0.25, 0.001);
  n.frequency.exponentialRampToValueAtTime(n.frequency.value * 0.5 + 400, t + 0.06);
  return 0.6;
};
/** 벽이 조여 오는 소리 (퍼즐 층 시간 압박) */
const wallGrind: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2, 0.3);
  const dur = 1.5;
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.5, t + 0.2);
  g.gain.setValueAtTime(0.5, t + dur - 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  noise(o, t, dur, shaper(o, 10, filt(o, 'lowpass', 400, 4, g)), true, 8);
  osc(o, 'sawtooth', 41, t, dur, filt(o, 'lowpass', 160, 1, gainNode(o, 0.5, g)));
  return dur + 0.3;
};
const clockTick: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0, 0.3);
  burst(o, t, v, 'bandpass', 3800 * p.pitch, 8, 0.012, 0.5);
  return 0.05;
};
/** 시험 층 시간 경고 */
const timerWarn: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.1);
  tone(o, t, v, 'square', 1046, 0.08, 0.12);
  tone(o, t + 0.15, v, 'square', 1046, 0.08, 0.12);
  return 0.3;
};
/** 소리 게이지가 올라갈 때 (침묵의 층) */
const noiseUp: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.4);
  const n = tone(o, t, v, 'sine', 300, 0.4, 0.25, 0.05);
  n.frequency.exponentialRampToValueAtTime(600, t + 0.4);
  tone(o, t, v, 'sine', 317, 0.4, 0.15, 0.05);
  return 0.6;
};
/** 다락방 도착 (안전) */
const safeRoom: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  [67, 71, 74, 79].forEach((m, i) => bell(o, t + i * 0.12, v, mtof(m), 1.6, 0.16, 1, 1.4));
  return 2.2;
};
/** 공포 순간 강조 (점프 스케어용 굉음) */
const scare: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.5);
  const dur = 1.2;
  const g = gainNode(o, 0, v);
  perc(g.gain, t, 0.005, 0.7, dur);
  const sh = shaper(o, 25, g);
  [61, 62, 67, 68, 73].forEach((m) => osc(o, 'sawtooth', mtof(m) * 0.5, t, dur, sh));
  burst(o, t, v, 'highpass', 2000, 0.7, 0.8, 0.4);
  thump(o, t, v, 50, 25, 0.8, 1);
  return dur + 1;
};

/** 구두 굽 또각 (컷신) */
const heels: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.25, 0.4);
  for (let i = 0; i < 4; i++) {
    const tt = t + i * 0.32;
    burst(o, tt, v, 'bandpass', 3600, 4, 0.02, 0.6);
    tone(o, tt, v, 'triangle', 1250, 0.03, 0.15);
  }
  return 1.6;
};
/** 덕트 안을 기는 소리: 철판이 우그러지는 쿵·깡 */
const duct: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.3, 0.5);
  for (let i = 0; i < 3; i++) {
    const tt = t + i * rnd(0.35, 0.5);
    thump(o, tt, v, 90, 50, 0.2, 0.6);
    tone(o, tt, v, 'triangle', rnd(300, 420), 0.4, 0.15);
    tone(o, tt, v, 'sine', rnd(900, 1300), 0.25, 0.06);
  }
  return 1.8;
};
/** 천장 해치·점검문: 걸쇠 철컥 + 경첩 */
const hatch: Recipe = (o, t, p) => {
  const v = voice(o, p.dest, t, p.vol, p.pan, 0.2, 0.4);
  burst(o, t, v, 'bandpass', 2600, 5, 0.03, 0.7);
  tone(o, t, v, 'square', 820, 0.04, 0.1);
  const g = gainNode(o, 0, v);
  g.gain.setValueAtTime(0.0001, t + 0.1);
  g.gain.linearRampToValueAtTime(0.5, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  const s = osc(o, 'sawtooth', 30, t + 0.1, 0.6, filt(o, 'bandpass', 1500, 12, g));
  s.frequency.linearRampToValueAtTime(18, t + 0.7);
  thump(o, t + 0.7, v, 110, 45, 0.15, 0.7);
  return 1;
};

// ── 목록 ─────────────────────────────────────────────────────────────

export interface SfxDef {
  label: string;
  group: SfxGroup;
  bus: 'sfx' | 'ui' | 'amb';
  fn: Recipe;
}

const d = (label: string, group: SfxGroup, fn: Recipe, bus: SfxDef['bus'] = 'sfx'): SfxDef => ({ label, group, bus, fn });

export const SFX = {
  hit1: d('1타 (약)', 'combat', hit(1)),
  hit2: d('2타 (보통)', 'combat', hit(2)),
  hit3: d('3타 (강)', 'combat', hit(3)),
  whiff: d('헛손질', 'combat', whiff),
  swingHeavy: d('큰 휘두르기', 'combat', swingHeavy),
  kick: d('점프 킥', 'combat', kick),
  lowKick: d('하단차기', 'combat', lowKick),
  dashHit: d('대시 공격', 'combat', dashHit),
  gun: d('권총', 'combat', gun),
  gunSilenced: d('소음기 권총', 'combat', gunSilenced),
  reload: d('재장전', 'combat', reload),
  emptyClick: d('탄 없음', 'combat', emptyClick),
  bulletHit: d('탄 명중', 'combat', bulletHit),
  ricochet: d('도탄', 'combat', ricochet),
  guard: d('가드', 'combat', guard),
  guardBreak: d('가드 붕괴', 'combat', guardBreak),
  parry: d('저스트 가드', 'combat', parry),
  evade: d('회피', 'combat', evade),
  jump: d('점프', 'combat', jump),
  land: d('착지', 'combat', land),
  hurt: d('피격', 'combat', hurt),
  down: d('다운', 'combat', down),
  wakeup: d('기상', 'combat', wakeup),
  armor: d('슈퍼아머', 'combat', armor),
  ability: d('능력 충격파', 'combat', ability),
  superStart: d('필살기 컷인', 'combat', superStart),
  superHit: d('필살기 명중', 'combat', superHit),
  heal: d('회복', 'combat', heal),
  itemUse: d('소모품 사용', 'combat', itemUse),
  pickup: d('줍기', 'combat', pickup),
  enemyDie: d('괴이 소멸', 'enemy', enemyDie),
  enemyTell: d('공격 예고', 'enemy', enemyTell),
  ghostWail: d('귀신 울음', 'enemy', ghostWail),
  ghostAttack: d('귀신 덮침', 'enemy', ghostAttack),
  crawler: d('다리 많은 것', 'enemy', crawler),
  stomp: d('무거운 발구름', 'enemy', stomp),
  enemyShot: d('경비 사격', 'enemy', enemyShot),
  enemySpawn: d('출현', 'enemy', enemySpawn),
  enemyStep: d('보이지 않는 발소리', 'enemy', enemyStep),
  whisper: d('속삭임', 'enemy', whisper),
  heartbeat: d('심장 소리', 'enemy', heartbeat),
  bossTell: d('수호자 예고', 'enemy', bossTell),
  bossRoar: d('수호자 포효', 'enemy', bossRoar),
  scare: d('공포 굉음', 'enemy', scare),
  stepMarble: d('대리석', 'step', step('marble')),
  stepConcrete: d('콘크리트', 'step', step('concrete')),
  stepCarpet: d('장판·카펫', 'step', step('carpet')),
  stepWood: d('나무 마루', 'step', step('wood')),
  stepMetal: d('철판·덕트', 'step', step('metal')),
  stepTile: d('타일', 'step', step('tile')),
  stepWet: d('젖은 바닥', 'step', step('wet')),
  stepVoid: d('알 수 없는 재질', 'step', step('void')),
  ding: d('띵', 'elevator', ding),
  dingDong: d('띵동', 'elevator', dingDong),
  doorOpen: d('문 열림', 'elevator', doorSlide(true)),
  doorClose: d('문 닫힘', 'elevator', doorSlide(false)),
  panelButton: d('패널 버튼', 'elevator', panelButton),
  intercom: d('인터폰 잡음', 'elevator', intercom),
  elevatorRide: d('승강기 이동', 'elevator', elevatorRide),
  ropeCreak: d('귀환 로프', 'elevator', ropeCreak),
  doorWood: d('문 삐걱', 'world', doorWood),
  doorSlam: d('문 쾅', 'world', doorSlam),
  doorLatch: d('문 찰칵', 'world', doorLatch),
  elevChime: d('승강기 띵 (부드럽게)', 'elevator', elevChime),
  knock: d('똑똑똑', 'world', knock),
  switchClick: d('스위치', 'world', switchClick),
  crateBreak: d('상자 부숨', 'world', crateBreak),
  glassBreak: d('유리 깨짐', 'world', glassBreak),
  flicker: d('형광등 지직', 'world', flicker),
  drip: d('물방울', 'world', drip),
  wallGrind: d('벽이 조여 옴', 'world', wallGrind),
  clockTick: d('시계 초침', 'world', clockTick),
  timerWarn: d('시간 경고', 'world', timerWarn),
  noiseUp: d('소리 게이지 상승', 'world', noiseUp),
  safeRoom: d('다락방 도착', 'world', safeRoom),
  heels: d('구두 소리', 'world', heels),
  duct: d('덕트 기어가기', 'world', duct),
  hatch: d('해치 열기', 'world', hatch),
  uiMove: d('커서 이동', 'ui', uiMove, 'ui'),
  uiOk: d('결정', 'ui', uiOk, 'ui'),
  uiBack: d('취소', 'ui', uiBack, 'ui'),
  uiError: d('안 됨', 'ui', uiError, 'ui'),
  uiOpen: d('창 열기', 'ui', uiOpen, 'ui'),
  uiClose: d('창 닫기', 'ui', uiClose, 'ui'),
  textBlip: d('대사 글자', 'ui', textBlip, 'ui'),
  message: d('괴담톡 알림', 'ui', message, 'ui'),
  ruleStamp: d('규칙 발견 (도장)', 'ui', ruleStamp, 'ui'),
  save: d('저장', 'ui', save, 'ui'),
  coin: d('보상', 'ui', coin, 'ui'),
  levelUp: d('강화', 'ui', levelUp, 'ui'),
  siren: d('거점 경보 사이렌', 'world', siren),
} satisfies Record<string, SfxDef>;

export type SfxId = keyof typeof SFX;
export const SFX_IDS = Object.keys(SFX) as SfxId[];

export const SURFACE_SFX: Record<Surface, SfxId> = {
  marble: 'stepMarble',
  concrete: 'stepConcrete',
  carpet: 'stepCarpet',
  wood: 'stepWood',
  metal: 'stepMetal',
  tile: 'stepTile',
  wet: 'stepWet',
  void: 'stepVoid',
};
