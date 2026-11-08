// 대전 녹음 소리 (11-08 사용자: 합성 말고 녹음한 무료 소리, 기합 목소리는 쓰지 않는다).
// 배경음악 4곡을 경기마다 돌려 틀고, 타격은 맨손(주먹·뺨·발차기) / 칼(주먹·칼·찌름 + 살 타격)으로 바꾼다.
// 파일은 대전 공용 팩(vs-common)의 sound.json 목록 (game-pack/vs-sound, 출처는 LICENSE.txt). 소리 크기는 게임 음량을 따른다
import { commonUrl } from '../action/art/charPacks';

type Group = 'u1' | 'u2' | 'u3' | 'b1' | 'b2' | 'b3' | 'guard' | 'cloth' | 'swing' | 'jump' | 'land' | 'dash';
interface Manifest { bgm: string[]; [g: string]: string[] }

/** 기본 공격에 칼을 휘두르는 캐릭터 (11-08, 사용자 확인 전 초안: 칼만 던지거나 기술에서만 쓰는 캐릭터는 맨손) */
const BLADE = new Set(['고르고디오', '고영훈', '노기균', '송주익', '이병진', '이도형', '가짜관리국검사A', '가짜관리국검사B', '가짜관리국검사C']);

let ctx: AudioContext | null = null;
let sfxGain: GainNode | null = null, musicGain: GainNode | null = null;
let vol = { sfx: 0.8, music: 0.6 };
let man: Promise<Manifest | null> | null = null;
const bufs = new Map<string, Promise<AudioBuffer | null>>();
let bgmIdx = Math.floor(Math.random() * 4);
let bgm: { src: AudioBufferSourceNode } | null = null;
let bgmWant = false;
const lastAt = new Map<Group, number>();

function ensure(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    apply();
  } catch { ctx = null; }
  return ctx;
}
function apply() {
  if (sfxGain) sfxGain.gain.value = vol.sfx;
  if (musicGain) musicGain.gain.value = vol.music * 0.55;
}
export function setVsVolumes(sfx: number, music: number): void { vol = { sfx, music }; apply(); }

const manifest = () => (man ??= commonUrl('sound.json').then((u) => (u ? fetch(u).then((r) => r.json() as Promise<Manifest>) : null)).catch(() => null));
function buffer(file: string): Promise<AudioBuffer | null> {
  let b = bufs.get(file);
  if (!b) {
    b = commonUrl(file).then(async (u) => {
      const c = ensure();
      if (!u || !c) return null;
      return c.decodeAudioData(await (await fetch(u)).arrayBuffer());
    }).catch(() => null);
    bufs.set(file, b);
  }
  return b;
}

/** 경기 사이에 미리 풀어 둔다 (첫 타격이 늦지 않게) */
export function vsSoundWarm(): void {
  void manifest().then((m) => { if (m) for (const [k, list] of Object.entries(m)) if (k !== 'bgm') list.forEach((f) => void buffer(f)); });
}

function playGroup(g: Group, pan = 0, gain = 1) {
  const c = ensure();
  if (!c) return;
  if (c.state === 'suspended') void c.resume().catch(() => {});
  const now = c.currentTime;
  if (now - (lastAt.get(g) ?? -1) < 0.03) return;   // 같은 타격이 두 곳(코어·세계)에서 같이 와도 한 번만
  lastAt.set(g, now);
  void manifest().then(async (m) => {
    const list = m?.[g];
    if (!list?.length) return;
    const b = await buffer(list[Math.floor(Math.random() * list.length)]);
    if (!b || !ctx || !sfxGain) return;
    const s = ctx.createBufferSource(), p = ctx.createStereoPanner(), gn = ctx.createGain();
    s.buffer = b; s.playbackRate.value = 0.94 + Math.random() * 0.12;
    p.pan.value = Math.max(-0.8, Math.min(0.8, pan)); gn.gain.value = gain;
    s.connect(gn).connect(p).connect(sfxGain);
    s.start();
  });
}

/** 엔진 소리 사건을 녹음 소리로. 바꿨으면 true (합성 소리는 내지 않는다) */
export function vsEventSound(e: { type: string; strength?: number; kind?: string; by?: string; pan?: number }): boolean {
  if (e.type === 'hit') {
    if (e.kind === 'bullet') return false;
    const s = e.kind === 'super' || e.kind === 'blast' ? 3 : e.kind === 'kick' || e.kind === 'low' || e.kind === 'dash' ? Math.max(2, e.strength ?? 2) : Math.min(3, Math.max(1, e.strength ?? 1));
    const blade = !!e.by && BLADE.has(e.by);
    playGroup(`${blade ? 'b' : 'u'}${s}` as Group, e.pan ?? 0, s === 3 ? 1 : 0.85);
    return true;
  }
  if (e.type === 'guard') { playGroup('guard', e.pan ?? 0, 0.8); return true; }
  // 움직임 (11-08 사용자: 옷자락 휘날림·점프·착지·대시)
  if (e.type === 'jump') { playGroup('jump', e.pan ?? 0, 0.7); playGroup('cloth', e.pan ?? 0, 0.55); return true; }
  if (e.type === 'land') { playGroup('land', e.pan ?? 0, 0.7); return true; }
  if (e.type === 'evade') { playGroup('dash', e.pan ?? 0, 0.7); playGroup('cloth', e.pan ?? 0, 0.6); return true; }
  if (e.type === 'whiff') { playGroup((e.strength ?? 1) >= 3 ? 'swing' : 'cloth', e.pan ?? 0, 0.75); return true; }
  return false;
}

/** 배경음악: 켜면 다음 곡을 처음부터 되풀이, 끄면 멈춤 */
export function vsBgm(on: boolean): void {
  bgmWant = on;
  if (bgm) { try { bgm.src.stop(); } catch { /* 이미 멈춤 */ } bgm = null; }
  if (!on) return;
  void manifest().then(async (m) => {
    if (!m?.bgm?.length || !bgmWant) return;
    bgmIdx = (bgmIdx + 1) % m.bgm.length;
    const b = await buffer(m.bgm[bgmIdx]);
    const c = ensure();
    if (!b || !c || !musicGain || !bgmWant || bgm) return;
    if (c.state === 'suspended') void c.resume().catch(() => {});
    const s = c.createBufferSource();
    s.buffer = b; s.loop = true;
    s.connect(musicGain);
    s.start();
    bgm = { src: s };
  });
}
/** 창을 닫을 때 (일시정지): 소리 전체를 멈춘다 */
export function vsSoundPause(paused: boolean): void {
  if (!ctx) return;
  void (paused ? ctx.suspend() : ctx.resume()).catch(() => {});
}
