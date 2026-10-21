// 곡 목록. 층 유형마다 한 곡 + 본부·수호자·제목 + 짧은 알림곡. 모두 Claude 작곡 (원작 음원 아님).
// 침묵의 층은 원문대로 음악이 없다 (스테이지 설계서 3장).
import { type SongDef, comp, bass, arp } from './music';

const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

// ── 본부: 따뜻하고 시끄러운 사무실 (공포 70 : 직장 코미디 30 의 30쪽) ─────
const hq: SongDef = {
  label: '본부 · 관리국 사무실',
  bpm: 112,
  swing: 0.14,
  loop: true,
  chans: {
    mel: { inst: 'square', vol: 0.8, pan: 0.15, verb: 0.15 },
    keys: { inst: 'epiano', vol: 0.9, pan: -0.2, verb: 0.2 },
    bass: { inst: 'fmbass', vol: 0.9 },
    dr: { inst: 'drums', vol: 0.55 },
    hat: { inst: 'drums', vol: 0.35, pan: 0.3 },
  },
  pats: {
    A: {
      mel: 'a4*2 c5*2 e5*3 d5 c5*2 a4*2 g4*4 | f4*2 a4*2 c5*4 . . d5 c5 a4*4 | bb4*3 a4 g4*2 f4*2 d4*2 f4*2 g4*4 | e4*2 g4*2 bb4*2 c5*2 e5*4 .*4',
      keys: comp('Fmaj7 Dm7 Gm7 C7', 'x-.x-.x--.x-....'),
      bass: bass('F Dm Gm C7', 'r..o..r.f..o.r.b'),
      dr: rep('k...s..kk.k.s...', 4),
      hat: rep('h.hhh.hhh.hhh.ho', 4),
    },
    B: {
      mel: 'c5*2 . c5 e5*2 d5*2 c5*3 a4 g4*4 | f#4*2 a4*2 c5*2 d5*2 f#5*4 e5*2 d5*2 | d5*3 c5 bb4*2 a4*2 g4*4 f4*2 g4*2 | bb4*2 a4*2 g4*2 e4*2 c4*4 .*4',
      keys: comp('Am7 D7 Gm7 C7', 'x-.x-.x--.x-....'),
      bass: bass('A D Gm C7', 'r..o..r.f..o.r.b'),
      dr: rep('k...s..kk.k.s...', 3) + ' k...s..ks.s.s.xx',
      hat: rep('h.hhh.hhh.hhh.ho', 4),
    },
  },
  order: ['A', 'B', 'A', 'B'],
};

// ── 로비: 승강기 대기실 음악. 평범한데 가끔 음이 틀린다 ───────────────
const lobby: SongDef = {
  label: '로비 · 어긋난 대기 음악',
  bpm: 96,
  loop: true,
  wrong: 0.06,
  chans: {
    mel: { inst: 'organ', vol: 1, verb: 0.3 },
    keys: { inst: 'epiano', vol: 0.75, pan: -0.25, verb: 0.3 },
    bass: { inst: 'bass', vol: 0.6 },
    rim: { inst: 'drums', vol: 0.4, pan: 0.2 },
    hat: { inst: 'drums', vol: 0.2, pan: -0.3 },
  },
  pats: {
    A: {
      mel: 'g4*4 bb4*2 g4*2 f4*4 eb4*4 | g4*2 f4*2 eb4*2 c4*2 d4*8 | ab4*4 c5*2 ab4*2 g4*4 f4*4 | d4*2 f4*2 ab4*2 bb4*2 g4*8',
      keys: comp('Ebmaj7 Cm7 Fm7 Bb7', 'x.x..x.x.x..x.x.'),
      bass: bass('Eb Cm Fm Bb', 'r-.f-.r.f-.r.f..'),
      rim: rep('k..r..r.k..r..r.', 4),
      hat: rep('hhhhhhhhhhhhhhhh', 4),
    },
    B: {
      mel: 'bb4*4 d5*2 bb4*2 a4*4 g4*4 | e4*2 g4*2 bb4*2 c5*2 bb4*8 | ab4*2 g4*2 f4*2 eb4*2 c4*8 | d4*4 f4*4 bb3*8',
      keys: comp('Gm7 C7 Fm7 Bb7', 'x.x..x.x.x..x.x.'),
      bass: bass('G C Fm Bb', 'r-.f-.r.f-.r.f..'),
      rim: rep('k..r..r.k..r..r.', 4),
      hat: rep('hhhhhhhhhhhhhhhh', 4),
    },
  },
  order: ['A', 'B', 'A', 'B-1'], // 마지막 바퀴는 반음 낮게 미끄러진다
};

// ── 추격의 층: 멈추면 죽는다 ─────────────────────────────────────────
const chase: SongDef = {
  label: '추격의 층',
  bpm: 168,
  loop: true,
  chans: {
    mel: { inst: 'lead', vol: 0.9, verb: 0.12 },
    stab: { inst: 'brass', vol: 0.8, pan: -0.3 },
    bass: { inst: 'fmbass', vol: 1 },
    dr: { inst: 'drums', vol: 0.7 },
    hat: { inst: 'drums', vol: 0.3, pan: 0.3 },
  },
  pats: {
    A: {
      mel: 'd5*2 . d5 f5*2 d5*2 a5*4 g5*2 f5*2 | e5*2 f5*2 e5*2 d5*2 c5*4 a4*4 | bb4*2 . bb4 d5*2 f5*2 bb5*4 a5*2 g5*2 | a5*4 g5*4 e5*4 c5*4',
      stab: comp('Dm Dm Bb C', 'X..x..x.........'),
      bass: bass('Dm Dm Bb C', 'r.ror.orr.ror.oo'),
      dr: 'c.h.s.hkk.h.s.hs ' + rep('k.h.s.hkk.h.s.hs', 2) + ' k.s.s.kks.sssmtt',
      hat: rep('hhhhhhhhhhhhhhhh', 4),
    },
    B: {
      mel: 'a5*3 a5 a5*2 g5*2 f5*2 e5*2 d5*4 | f5*2 e5*2 d5*2 c5*2 d5*8 | g5*3 g5 bb5*2 a5*2 g5*2 f5*2 e5*4 | c#5*4 e5*4 a5*4 c#6*4',
      stab: comp('Dm Dm Gm A', 'X..x..x.........'),
      bass: bass('Dm Dm Gm A', 'r.ror.orr.ror.oo'),
      dr: 'c.h.s.hkk.h.s.hs ' + rep('k.h.s.hkk.h.s.hs', 2) + ' sssssssssmmmtttc',
      hat: rep('hhhhhhhhhhhhhhhh', 4),
    },
  },
  order: ['A', 'B', 'A+2', 'B'],
};

// ── 재현의 층 · 아파트: 오르골 자장가 (3박자, 한 마디 12칸) ──────────
const replica: SongDef = {
  label: '재현의 층 · 아파트',
  bpm: 76,
  loop: true,
  chans: {
    box: { inst: 'box', vol: 1, verb: 0.45, pan: 0.1 },
    acc: { inst: 'pluck', vol: 0.45, pan: -0.2, verb: 0.3 },
    pad: { inst: 'pad', vol: 0.6, verb: 0.4 },
    tick: { inst: 'drums', vol: 0.12, pan: 0.5 },
  },
  pats: {
    A: {
      box: 'e5*4 a5*4 c6*4 | b5*4 a5*4 e5*4 | f5*4 a5*4 d6*4 | c6*4 b5*4 g#5*4 | a5*4 c6*2 b5*2 a5*4 | e5*4 f5*4 a5*4 | g#5*4 b5*4 e5*4 | a5*12',
      acc: bass('Am Am Dm E Am F E Am', 'r...........', 3) ,
      pad: 'a3+e4*24 d4+a4*12 e4+g#4*12 a3+e4*12 f3+c4*12 e3+b3*12 a3+e4*12',
      tick: rep('r...r...r...', 8),
    },
    B: {
      // 둘째 바퀴: 오르골 태엽이 풀려 한 음씩 빠진다
      box: 'e5*4 .*4 c6*4 | b5*4 .*4 e5*4 | f5*4 a5*4 .*4 | c6*4 .*4 g#5*4 | a5*4 .*8 | e5*4 .*8 | g#5*4 .*4 e5*4 | a4*12',
      acc: bass('Am Am Dm E Am F E Am', 'r...........', 3),
      pad: 'a3+e4*24 d4+a4*12 e4+g#4*12 a3+e4*12 f3+c4*12 e3+b3*12 a3+e4*12',
      tick: rep('r...r...r...', 8),
    },
  },
  order: ['A', 'B'],
};

// ── 시험 층: 벽에 적힌 목표, 째깍거리는 시간 ────────────────────────
const trial: SongDef = {
  label: '시험 층',
  bpm: 132,
  loop: true,
  chans: {
    mel: { inst: 'square', vol: 0.9, pan: 0.2, verb: 0.2 },
    arp: { inst: 'bell', vol: 0.7, pan: -0.3, verb: 0.3 },
    bass: { inst: 'bass', vol: 0.8 },
    dr: { inst: 'drums', vol: 0.6 },
    tick: { inst: 'drums', vol: 0.3, pan: 0.4 },
  },
  pats: {
    A: {
      mel: 'e5*2 .*2 f5*2 .*2 e5*2 b4*2 .*4 | f5*2 .*2 g5*2 .*2 f5*2 c5*2 .*4 | e5 f5 g5 a5 b5*4 .*2 a5*2 g5*2 f5*2 | e5*8 .*8',
      arp: arp('Em F Em F', '0121012101210121'),
      bass: bass('Em F Em F', 'r.r.r.r.r.r.r.r.'),
      dr: rep('k...k...k...k...', 4),
      tick: rep('r.r.r.r.r.r.r.r.', 4),
    },
    B: {
      arp: arp('Em G F Em', '0123012301230123'),
      bass: bass('Em G F Em', 'r.r.o.r.r.r.o.r.'),
      dr: rep('k..sk...k..sk.s.', 3) + ' k.s.k.s.ssssmmtt',
      tick: rep('hhhhhhhhhhhhhhhh', 4),
    },
  },
  order: ['A', 'A', 'B', 'A+1'],
};

// ── 어둠의 층: 거의 아무것도 없다. 낮게 깔린 숨, 가끔 울리는 한 음 ──
const dark: SongDef = {
  label: '어둠의 층',
  bpm: 60,
  loop: true,
  chans: {
    drone: { inst: 'pad', vol: 0.9, verb: 0.5 },
    voice: { inst: 'choir', vol: 0.35, verb: 0.6, pan: -0.3 },
    ping: { inst: 'bell', vol: 0.45, verb: 0.9, pan: 0.4 },
    beat: { inst: 'drums', vol: 0.35 },
  },
  pats: {
    A: {
      drone: 'c2+g2*64',
      voice: '.*16 eb4*24 .*8 d4*16',
      ping: '.*20 g5? .*13 f#5? .*21 c6? .*7',
      beat: rep('k..k............', 4),
    },
    B: {
      drone: 'c#2+g#2*32 c2+g2*32',
      voice: '.*8 e4*20 .*4 eb4*32',
      ping: '.*9 b5? .*30 c5? .*23',
      beat: rep('k..k............', 2) + ' k..k....k..k.... k..k....k..k....',
    },
  },
  order: ['A', 'B'],
};

// ── 퍼즐과 선택의 층: 7박(한 마디 14칸), 온음 음계로 길을 잃는다 ─────
const puzzle: SongDef = {
  label: '퍼즐과 선택의 층',
  bpm: 100,
  loop: true,
  chans: {
    arp: { inst: 'bell', vol: 0.8, verb: 0.4, pan: 0.25 },
    low: { inst: 'pad', vol: 0.7, verb: 0.3 },
    bass: { inst: 'pluck', vol: 0.7, pan: -0.2 },
    dr: { inst: 'drums', vol: 0.5 },
  },
  pats: {
    A: {
      arp: 'c5 . e5 . g#5 . d5 . f#5 . a#5 . e5 . | c6 . a#5 . f#5 . d5 . g#5 . e5 . c5 .',
      low: 'c3+f#3*28',
      bass: 'c2*6 . d2*7 | c2*6 . a#1*7',
      dr: 'k.....s...k.s. k...t.s...k.sm',
    },
  },
  order: ['A', 'A+1', 'A-2', 'A+3', 'A', 'A-1'],
};

// ── 정비 구역 · 다락방: 잠깐 숨 돌리는 곳 ─────────────────────────────
const service: SongDef = {
  label: '정비 구역 · 다락방',
  bpm: 84,
  loop: true,
  chans: {
    mel: { inst: 'strings', vol: 0.8, verb: 0.4, pan: 0.15 },
    keys: { inst: 'epiano', vol: 0.8, verb: 0.35, pan: -0.2 },
    bass: { inst: 'fmbass', vol: 0.55 },
    dr: { inst: 'drums', vol: 0.25 },
  },
  pats: {
    A: {
      mel: 'd5*6 c5*2 bb4*8 | g4*4 bb4*4 d5*8 | f5*6 d5*2 c5*4 bb4*4 | a4*12 .*4',
      keys: arp('Gm7 Ebmaj7 Bbmaj7 F', '0.1.2.3.2.1.0.1.', 0),
      bass: bass('Gm Eb Bb F', 'r-------f---r---'),
      dr: rep('k.......r.......', 4),
    },
    B: {
      mel: 'bb4*4 a4*4 g4*8 | g4*4 bb4*4 eb5*8 | eb5*6 d5*2 c5*8 | d5*4 c5*4 a4*4 f#4*4',
      keys: arp('Gm7 Ebmaj7 Cm7 D7', '0.1.2.3.2.1.0.1.', 0),
      bass: bass('Gm Eb Cm D', 'r-------f---r---'),
      dr: rep('k.......r.......', 4),
    },
  },
  order: ['A', 'B'],
};

// ── 층 수호자 ─────────────────────────────────────────────────────────
const boss: SongDef = {
  label: '층 수호자',
  bpm: 152,
  loop: true,
  chans: {
    mel: { inst: 'lead', vol: 1, verb: 0.15 },
    stab: { inst: 'brass', vol: 0.9, pan: -0.25, verb: 0.15 },
    voice: { inst: 'choir', vol: 0.4, verb: 0.5, pan: 0.3 },
    bass: { inst: 'fmbass', vol: 1, drive: 2 },
    kick: { inst: 'drums', vol: 0.75 },
    hat: { inst: 'drums', vol: 0.3, pan: 0.3 },
  },
  pats: {
    A: {
      mel: 'c5*2 eb5*2 g5*4 f5*2 eb5*2 d5*2 eb5*2 | c5*4 g4*4 c5*2 d5*2 eb5*4 | f5*2 eb5*2 c5*4 ab5*4 g5*4 | b4*4 d5*4 f5*4 g5*4',
      stab: comp('Cm Cm Ab G', 'X..x..x...x..x..'),
      voice: comp('Cm Cm Ab G', 'x---------------'),
      bass: bass('Cm Cm Ab G', 'r.rrr.rrr.rrr.ro'),
      kick: 'c..k..s.k..k..s. ' + rep('k..k..s.k..k..s.', 2) + ' k..k..s.k.ssssss',
      hat: rep('h.h.h.h.h.h.h.h.', 4),
    },
    B: {
      mel: 'ab5*4 g5*2 f5*2 c5*4 f5*4 | eb5*4 d5*2 c5*2 g4*8 | f5*4 ab5*4 db6*4 c6*4 | b5*8 g5*4 d5*4',
      stab: comp('Fm Cm Db G', 'X..x..x...x..x..'),
      voice: comp('Fm Cm Db G', 'x---------------'),
      bass: bass('Fm Cm Db G', 'r.rrr.rrr.rrr.ro'),
      kick: 'c..k..s.k..k..s. ' + rep('k..k..s.k..k..s.', 2) + ' kkkksssstttmmmmc',
      hat: rep('h.h.h.h.h.h.h.h.', 4),
    },
  },
  order: ['A', 'B', 'A', 'B+1'],
};

// ── 제목 화면 (ANOMALY SIMULATION) ───────────────────────────────────
const title: SongDef = {
  label: '제목 화면',
  bpm: 116,
  loop: true,
  chans: {
    mel: { inst: 'strings', vol: 1, verb: 0.35 },
    arp: { inst: 'pluck', vol: 0.6, pan: -0.3, verb: 0.2 },
    bass: { inst: 'fmbass', vol: 0.9 },
    dr: { inst: 'drums', vol: 0.55 },
    hat: { inst: 'drums', vol: 0.25, pan: 0.3 },
  },
  pats: {
    A: {
      mel: 'e5*6 d5*2 c5*4 b4*4 | a4*8 c5*4 f5*4 | g5*6 f5*2 e5*4 d5*4 | g#4*4 b4*4 e5*8',
      arp: arp('Am F G E', '0120' .repeat(4)),
      bass: bass('Am F G E', 'r.......r...r.o.'),
      dr: 'c...s...k.k.s... ' + rep('k...s...k.k.s...', 3),
      hat: rep('..h...h...h...h.', 4),
    },
    B: {
      mel: 'a5*6 g5*2 e5*8 | f5*4 e5*4 c5*8 | d5*4 f5*4 a5*4 g5*4 | g#5*8 b5*4 e6*4',
      arp: arp('Am F Dm E', '0120'.repeat(4)),
      bass: bass('Am F Dm E', 'r.......r...r.o.'),
      dr: rep('k...s...k.k.s...', 3) + ' k.k.s.s.ssssmmtc',
      hat: rep('h.h.h.h.h.h.h.h.', 4),
    },
  },
  order: ['A', 'B'],
};

// ── 알림곡 (한 번만) ─────────────────────────────────────────────────
const clear: SongDef = {
  label: '층 돌파 (알림곡)',
  bpm: 150,
  loop: false,
  chans: {
    mel: { inst: 'lead', vol: 1, verb: 0.3 },
    stab: { inst: 'brass', vol: 0.9, verb: 0.3 },
    bass: { inst: 'fmbass', vol: 0.9 },
    dr: { inst: 'drums', vol: 0.6 },
  },
  pats: {
    A: {
      mel: 'g4 c5 e5 g5*3 e5 g5*9 | ab5*2 bb5*2 c6*12',
      stab: 'c4+e4+g4*2 .*6 c4+e4+g4*8 | ab3+c4+eb4*2 bb3+d4+f4*2 c4+e4+g4*12',
      bass: 'c3*2 .*6 c2*8 | ab2*2 bb2*2 c3*12',
      dr: 'k.s.k.sssc...... k.k.c...........',
    },
  },
  order: ['A'],
};

const gameover: SongDef = {
  label: '후송 (알림곡)',
  bpm: 70,
  loop: false,
  chans: {
    mel: { inst: 'strings', vol: 1, verb: 0.5 },
    pad: { inst: 'pad', vol: 0.8, verb: 0.5 },
    bell: { inst: 'bell', vol: 0.5, verb: 0.8 },
  },
  pats: {
    A: {
      mel: 'e5*4 d#5*4 d5*4 c#5*4 | c5*16',
      pad: 'a3+c4+e4*16 f3+ab3+c4*16',
      bell: '.*16 a4*16',
    },
  },
  order: ['A'],
};

const discover: SongDef = {
  label: '규칙 발견 (알림곡)',
  bpm: 140,
  loop: false,
  chans: {
    b: { inst: 'bell', vol: 0.9, verb: 0.5 },
    pad: { inst: 'strings', vol: 0.7, verb: 0.5 },
  },
  pats: { A: { b: 'e5 g#5 b5 e6*13', pad: 'e4+g#4+b4*16' } },
  order: ['A'],
};

export const SONGS = { title, hq, lobby, chase, replica, trial, dark, puzzle, service, boss, clear, gameover, discover } satisfies Record<string, SongDef>;
export type SongId = keyof typeof SONGS;
export const SONG_IDS = Object.keys(SONGS) as SongId[];
