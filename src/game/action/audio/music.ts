// 음악: 작은 트래커. 곡은 글자로 적고(songs.ts), 악기는 전부 코드 합성이다.
// 소리 결은 90년대 아케이드 FM 칩(YM 계열) 느낌: FM 전자 피아노·FM 베이스·네모파 리드·짧은 드럼.
import { type Out, perc, adsr, osc, noise, filt, gainNode, shaper, mtof, AudioScope, busOut, oneShot, ownNode } from './engine';

// ── 악보 글자 ─────────────────────────────────────────────────────────
// 음표 칸: 공백으로 나눈 낱말 하나가 16분음표 한 칸.
//   c4 d#4 eb3   음 (옥타브 숫자는 과학적 표기, c4 = 가운데 도)
//   c4+e4+g4     화음
//   -            앞 음을 한 칸 늘림
//   .            쉼
//   x*4          낱말을 네 칸으로 (음이면 1칸 + '-' 3칸, 쉼이면 쉼 4칸)
//   c5!  c5?     세게 / 여리게
//   |            읽기 쉽게 넣는 마디 줄 (무시)
// 북 칸: 글자 하나가 한 칸. k 큰북, s 작은북, h 닫힌 심벌, o 열린 심벌, c 크래시, t 낮은 톰, m 높은 톰, r 림, x 박수, . 쉼

const PC: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteToMidi(s: string): number {
  const m = /^([a-gA-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error(`음 표기 오류: ${s}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + PC[m[1].toLowerCase()] + acc;
}

export interface NoteEv {
  step: number;
  notes: number[];
  len: number; // 칸 수
  vel: number;
}

/** 음표 칸 글자를 사건 목록으로. 길이(칸 수)도 함께 돌려준다 */
export function parseNotes(src: string): { evs: NoteEv[]; steps: number } {
  const toks: string[] = [];
  for (const raw of src.split(/\s+/)) {
    if (!raw || raw === '|') continue;
    const m = /^(.*)\*(\d+)$/.exec(raw);
    if (m) {
      const n = Number(m[2]);
      if (m[1] === '.' || m[1] === '-') for (let i = 0; i < n; i++) toks.push(m[1]);
      else {
        toks.push(m[1]);
        for (let i = 1; i < n; i++) toks.push('-');
      }
    } else toks.push(raw);
  }
  const evs: NoteEv[] = [];
  let cur: NoteEv | null = null;
  toks.forEach((t, i) => {
    if (t === '-') {
      if (cur) cur.len++;
      return;
    }
    cur = null;
    if (t === '.') return;
    let vel = 0.8;
    let body = t;
    if (body.endsWith('!')) (vel = 1), (body = body.slice(0, -1));
    else if (body.endsWith('?')) (vel = 0.5), (body = body.slice(0, -1));
    cur = { step: i, notes: body.split('+').map(noteToMidi), len: 1, vel };
    evs.push(cur);
  });
  return { evs, steps: toks.length };
}

export interface DrumEv {
  step: number;
  kind: string;
}
export function parseDrums(src: string): { evs: DrumEv[]; steps: number } {
  const s = src.replace(/[\s|]/g, '');
  const evs: DrumEv[] = [];
  for (let i = 0; i < s.length; i++) if (s[i] !== '.') evs.push({ step: i, kind: s[i] });
  return { evs, steps: s.length };
}

// ── 화음 이름 도우미 (반주를 짧게 적으려고) ───────────────────────────

const QUAL: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  dim: [0, 3, 6],
  m7b5: [0, 3, 6, 10],
  sus4: [0, 5, 7],
  aug: [0, 4, 8],
  '5': [0, 7],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
};

/** 'F#m7' → 근음 피치 클래스와 화음 구성음(가까운 자리 배치: 미3~솔4) */
export function chord(name: string): { root: number; tones: number[] } {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name);
  if (!m || !(m[3] in QUAL)) throw new Error(`화음 표기 오류: ${name}`);
  const root = PC[m[1].toLowerCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const tones = QUAL[m[3]].map((iv) => {
    let n = 48 + ((root + iv) % 12);
    while (n < 52) n += 12;
    if (iv >= 12) n += 12;
    return n;
  });
  tones.sort((a, b) => a - b);
  return { root: (root + 12) % 12, tones };
}

const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const tok = (notes: number[]) => notes.map((n) => `${NAMES[n % 12]}${Math.floor(n / 12) - 1}`).join('+');

/** 반주: 화음마다 리듬 글자(x 치기, - 늘림, . 쉼)를 한 번씩 */
export function comp(chords: string, rhythm: string, shift = 0): string {
  return chords
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => {
      const ns = chord(c).tones.map((n) => n + shift);
      return [...rhythm].map((ch) => (ch === 'x' ? tok(ns) : ch === 'X' ? tok(ns) + '!' : ch)).join(' ');
    })
    .join(' ');
}

/** 베이스: r 근음, o 옥타브 위, f 5도, b 단7도, - 늘림, . 쉼 (근음은 옥타브 2) */
export function bass(chords: string, rhythm: string, oct = 2): string {
  return chords
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => {
      const { root } = chord(c);
      const r = 12 * (oct + 1) + root;
      const pick = (ch: string) => (ch === 'r' ? r : ch === 'o' ? r + 12 : ch === 'f' ? r + 7 : ch === 'b' ? r + 10 : -1);
      return [...rhythm].map((ch) => (pick(ch) >= 0 ? tok([pick(ch)]) : ch)).join(' ');
    })
    .join(' ');
}

/** 펼침화음: 숫자는 화음 구성음 순번(넘으면 옥타브 위), - 늘림, . 쉼 */
export function arp(chords: string, shape: string, shift = 12): string {
  return chords
    .split(/\s+/)
    .filter(Boolean)
    .map((c) => {
      const ts = chord(c).tones;
      return [...shape]
        .map((ch) => {
          if (!/\d/.test(ch)) return ch;
          const i = Number(ch);
          return tok([ts[i % ts.length] + 12 * Math.floor(i / ts.length) + shift]);
        })
        .join(' ');
    })
    .join(' ');
}

// ── 악기 ─────────────────────────────────────────────────────────────

export type InstId = 'lead' | 'square' | 'brass' | 'epiano' | 'fmbass' | 'bass' | 'pad' | 'strings' | 'bell' | 'box' | 'organ' | 'pluck' | 'choir' | 'drums';

type Inst = (o: Out, dest: AudioNode, t: number, f: number, dur: number, vel: number) => void;

function fm(o: Out, dest: AudioNode, t: number, f: number, dur: number, vel: number, ratio: number, idx: number, idxDecay: number, a: number, d: number, s: number, r: number) {
  const g = gainNode(o, 0, dest);
  const end = adsr(g.gain, t, a, d, s, dur, r, vel);
  const car = osc(o, 'sine', f, t, end - t, g);
  const mg = gainNode(o, 0);
  mg.gain.setValueAtTime(f * idx, t);
  mg.gain.setTargetAtTime(f * idx * 0.15, t, idxDecay);
  mg.connect(car.frequency);
  osc(o, 'sine', f * ratio, t, end - t, mg);
}

const INST: Record<Exclude<InstId, 'drums'>, Inst> = {
  // 아케이드 리드: 네모파 + 톱니파, 늦게 들어오는 떨림
  lead(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.01, 0.12, 0.7, dur, 0.08, vel * 0.32);
    const lp = filt(o, 'lowpass', 3200, 1.2, g);
    const vib = gainNode(o, 0);
    vib.gain.setValueAtTime(0, t);
    vib.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(0.4, dur));
    const a = osc(o, 'square', f, t, end - t, lp);
    const b = osc(o, 'sawtooth', f * 1.004, t, end - t, gainNode(o, 0.6, lp));
    vib.connect(a.frequency);
    vib.connect(b.frequency);
    osc(o, 'sine', 5.5, t, end - t, vib);
  },
  square(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.005, 0.08, 0.5, dur, 0.05, vel * 0.25);
    osc(o, 'square', f, t, end - t, filt(o, 'lowpass', 2500, 0.7, g));
  },
  // 금관 찌르기: 필터가 확 열렸다 닫힌다
  brass(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.02, 0.2, 0.6, dur, 0.1, vel * 0.22);
    const lp = filt(o, 'lowpass', 400, 2, g);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(3500, t + 0.04);
    lp.frequency.setTargetAtTime(900, t + 0.05, 0.12);
    osc(o, 'sawtooth', f, t, end - t, lp);
    osc(o, 'sawtooth', f * 1.006, t, end - t, lp);
  },
  epiano(o, dest, t, f, dur, vel) {
    fm(o, dest, t, f, Math.min(dur, 1.6), vel * 0.28, 1, 1.8, 0.25, 0.003, 0.9, 0.35, 0.3);
    // 쇳소리 '팅'
    const g = gainNode(o, 0, dest);
    perc(g.gain, t, 0.001, vel * 0.04, 0.15);
    osc(o, 'sine', f * 14, t, 0.2, g);
  },
  fmbass(o, dest, t, f, dur, vel) {
    fm(o, dest, t, f, dur, vel * 0.55, 1, 2.5, 0.06, 0.002, 0.25, 0.55, 0.05);
    const g = gainNode(o, 0, dest);
    adsr(g.gain, t, 0.002, 0.2, 0.7, dur, 0.05, vel * 0.3);
    osc(o, 'sine', f, t, dur + 0.1, g);
  },
  bass(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.003, 0.15, 0.6, dur, 0.06, vel * 0.45);
    const lp = filt(o, 'lowpass', 1400, 3, g);
    lp.frequency.setTargetAtTime(350, t, 0.06);
    osc(o, 'sawtooth', f, t, end - t, lp);
  },
  pad(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.6, 0.5, 0.8, dur, 1.2, vel * 0.09);
    const lp = filt(o, 'lowpass', 1100, 0.7, g);
    for (const k of [0.995, 1, 1.006]) osc(o, 'sawtooth', f * k, t, end - t, lp);
  },
  strings(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.12, 0.3, 0.85, dur, 0.4, vel * 0.13);
    const lp = filt(o, 'lowpass', 2600, 0.7, g);
    const vib = gainNode(o, f * 0.006);
    for (const k of [0.997, 1.003]) vib.connect(osc(o, 'sawtooth', f * k, t, end - t, lp).frequency);
    osc(o, 'sine', 5, t, end - t, vib);
  },
  bell(o, dest, t, f, dur, vel) {
    fm(o, dest, t, f, 0.05, vel * 0.22, 3.5, 2.5, 0.4, 0.002, 1.6, 0.0001, 1.2);
  },
  // 오르골: 사인 + 높은 배음, 짧게 사그라듦. 조금씩 음이 어긋난다
  box(o, dest, t, f, dur, vel) {
    const ff = f * (1 + (Math.random() - 0.5) * 0.008);
    const g = gainNode(o, 0, dest);
    perc(g.gain, t, 0.002, vel * 0.3, 1.4);
    osc(o, 'sine', ff, t, 1.5, g);
    const h = gainNode(o, 0, dest);
    perc(h.gain, t, 0.001, vel * 0.08, 0.4);
    osc(o, 'sine', ff * 5.02, t, 0.5, h);
    void dur;
  },
  organ(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.01, 0.1, 0.9, dur, 0.06, vel * 0.13);
    const vib = gainNode(o, f * 0.004);
    for (const [k, v] of [[1, 1], [2, 0.5], [3, 0.25], [0.5, 0.4]] as const) {
      const n = osc(o, 'sine', f * k, t, end - t, gainNode(o, v, g));
      vib.connect(n.frequency);
    }
    osc(o, 'sine', 6, t, end - t, vib);
  },
  pluck(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    perc(g.gain, t, 0.002, vel * 0.3, Math.min(0.5, dur + 0.15));
    const lp = filt(o, 'lowpass', 3000, 1, g);
    lp.frequency.setTargetAtTime(500, t, 0.08);
    osc(o, 'triangle', f, t, 0.6, lp);
    osc(o, 'square', f, t, 0.6, gainNode(o, 0.2, lp));
  },
  // 사람 목소리 같은 '아—' (모음 대역 둘)
  choir(o, dest, t, f, dur, vel) {
    const g = gainNode(o, 0, dest);
    const end = adsr(g.gain, t, 0.5, 0.4, 0.85, dur, 1, vel * 0.5);
    const f1 = filt(o, 'bandpass', 700, 5, g);
    const f2 = filt(o, 'bandpass', 1150, 6, g);
    for (const k of [0.996, 1.004]) {
      const s = osc(o, 'sawtooth', f * k, t, end - t, f1);
      s.connect(f2);
    }
  },
};

function drum(o: Out, dest: AudioNode, t: number, kind: string, vel: number) {
  const g = gainNode(o, vel, dest);
  switch (kind) {
    case 'k': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, 0.9, 0.25);
      const n = osc(o, 'sine', 150, t, 0.3, e);
      n.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      const c = gainNode(o, 0, g);
      perc(c.gain, t, 0.001, 0.3, 0.02);
      noise(o, t, 0.03, filt(o, 'lowpass', 3000, 0.7, c));
      break;
    }
    case 's': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, 0.45, 0.16);
      noise(o, t, 0.2, filt(o, 'bandpass', 2200, 0.8, e));
      const b = gainNode(o, 0, g);
      perc(b.gain, t, 0.001, 0.35, 0.08);
      const n = osc(o, 'triangle', 230, t, 0.1, b);
      n.frequency.exponentialRampToValueAtTime(160, t + 0.08);
      break;
    }
    case 'x': {
      for (let i = 0; i < 3; i++) {
        const e = gainNode(o, 0, g);
        perc(e.gain, t + i * 0.011, 0.001, 0.4, i === 2 ? 0.12 : 0.01);
        noise(o, t + i * 0.011, 0.14, filt(o, 'bandpass', 1300, 1.5, e));
      }
      break;
    }
    case 'h':
    case 'o': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, kind === 'h' ? 0.18 : 0.15, kind === 'h' ? 0.04 : 0.3);
      noise(o, t, kind === 'h' ? 0.06 : 0.35, filt(o, 'highpass', 7000, 0.7, e));
      break;
    }
    case 'c': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, 0.22, 1.4);
      noise(o, t, 1.5, filt(o, 'highpass', 4500, 0.5, e));
      break;
    }
    case 't':
    case 'm': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, 0.6, 0.3);
      const f0 = kind === 't' ? 110 : 170;
      const n = osc(o, 'sine', f0, t, 0.35, e);
      n.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.3);
      break;
    }
    case 'r': {
      const e = gainNode(o, 0, g);
      perc(e.gain, t, 0.001, 0.3, 0.03);
      osc(o, 'triangle', 1700, t, 0.05, filt(o, 'bandpass', 1700, 4, e));
      noise(o, t, 0.03, filt(o, 'bandpass', 3000, 3, e));
      break;
    }
  }
}

// ── 곡 ───────────────────────────────────────────────────────────────

export interface Chan {
  inst: InstId;
  vol?: number;
  pan?: number;
  verb?: number;
  drive?: number;
}
export interface SongDef {
  label: string;
  bpm: number;
  swing?: number; // 0~0.3, 짝수 칸 밀기
  loop: boolean;
  wrong?: number; // 틀린 음 확률 (어긋난 로비 음악)
  chans: Record<string, Chan>;
  pats: Record<string, Record<string, string>>;
  order: string[]; // 'A', 'B+2' (반음 올림), 'A-3'
}

interface CompiledChan {
  def: Chan;
  at: Map<number, (NoteEv | DrumEv)[]>;
}
export interface Compiled {
  def: SongDef;
  steps: number;
  chans: Record<string, CompiledChan>;
}

export function compileSong(def: SongDef): Compiled {
  const chans: Record<string, CompiledChan> = {};
  for (const [name, c] of Object.entries(def.chans)) chans[name] = { def: c, at: new Map() };
  let base = 0;
  for (const entry of def.order) {
    const m = /^([A-Za-z0-9_]+)([+-]\d+)?$/.exec(entry);
    if (!m || !def.pats[m[1]]) throw new Error(`곡 순서 오류: ${entry}`);
    const pat = def.pats[m[1]];
    const tr = Number(m[2] ?? 0);
    let len = 0;
    const parsed: Record<string, { evs: (NoteEv | DrumEv)[]; steps: number }> = {};
    for (const [name, src] of Object.entries(pat)) {
      const c = def.chans[name];
      if (!c) throw new Error(`없는 악기 줄: ${name}`);
      parsed[name] = c.inst === 'drums' ? parseDrums(src) : parseNotes(src);
      len = Math.max(len, parsed[name].steps);
    }
    for (const [name, p] of Object.entries(parsed)) {
      for (const e of p.evs) {
        const ev = 'notes' in e ? { ...e, notes: e.notes.map((n) => n + tr) } : e;
        const at = chans[name].at;
        const k = base + e.step;
        (at.get(k) ?? at.set(k, []).get(k)!).push(ev);
      }
    }
    base += len;
  }
  return { def, steps: base, chans };
}

export const stepSec = (bpm: number) => 60 / bpm / 4;

/** 곡 하나를 연주하는 상태. 실시간 재생과 오프라인 시험이 같은 함수를 쓴다 */
export class Player {
  readonly out: GainNode;
  private scope: AudioScope;
  private sends: GainNode[];
  private chanNodes = new Map<string, AudioNode>();
  step = 0;
  nextTime: number;
  ended = false;

  constructor(
    private o: Out,
    readonly song: Compiled,
    readonly startAt: number,
  ) {
    this.scope = new AudioScope(busOut(o, 'music'));
    o = this.o = this.scope.out;
    this.out = gainNode(o, 1, o.music);
    const verb = gainNode(o, 1, o.verb), room = gainNode(o, 1, o.room);
    this.sends = [this.out, verb, room];
    this.o = { ...o, verb, room };
    this.nextTime = startAt;
    for (const [name, c] of Object.entries(song.chans)) {
      const d = c.def;
      const g = gainNode(o, d.vol ?? 1);
      let tail: AudioNode = g;
      if (d.drive) tail = tail.connect(shaper(o, d.drive));
      if (d.pan) {
        const p = ownNode(o, o.ctx.createStereoPanner());
        p.pan.value = d.pan;
        tail = tail.connect(p);
      }
      tail.connect(this.out);
      if (d.verb) tail.connect(gainNode(o, d.verb, this.o.verb));
      this.chanNodes.set(name, g);
    }
  }

  /** until 시각까지의 칸을 미리 예약한다 */
  schedule(until: number, now = -Infinity) {
    const s = this.song;
    const sec = stepSec(s.def.bpm);
    // 타이머가 크게 늦었으면 지난 칸은 건너뛴다 (한꺼번에 쏟아지지 않게)
    while (!this.ended && this.nextTime < now - 0.05) {
      this.step++;
      this.nextTime += sec;
      if (!s.def.loop && this.step >= s.steps) this.ended = true;
    }
    while (!this.ended && this.nextTime < until) {
      const i = this.step % s.steps;
      const swing = i % 2 === 1 ? (s.def.swing ?? 0) * sec : 0;
      const t = this.nextTime + swing;
      for (const [name, c] of Object.entries(s.chans)) {
        const evs = c.at.get(i);
        if (!evs) continue;
        const dest = this.chanNodes.get(name)!;
        for (const e of evs) {
          if ('kind' in e) oneShot(this.o, o => drum(o, dest, t, e.kind, 1));
          else {
            const inst = INST[c.def.inst as Exclude<InstId, 'drums'>];
            for (const n of e.notes) {
              const sour = s.def.wrong && Math.random() < s.def.wrong ? (Math.random() < 0.5 ? -1 : 1) * (0.3 + Math.random() * 0.7) : 0;
              oneShot(this.o, o => inst(o, dest, t, mtof(n + sour), e.len * sec * 0.95, e.vel));
            }
          }
        }
      }
      this.step++;
      this.nextTime += sec;
      if (!s.def.loop && this.step >= s.steps) this.ended = true;
    }
  }

  /** 끝나는 데 걸리는 시간(초). 반복곡은 한 바퀴 */
  get lengthSec() {
    return this.song.steps * stepSec(this.song.def.bpm);
  }

  fadeOut(t: number, sec: number) {
    for (const node of this.sends) {
      const g = node.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(0, t + sec);
    }
    this.ended = true;
    this.scope.stopAt(t + sec);
  }
}
