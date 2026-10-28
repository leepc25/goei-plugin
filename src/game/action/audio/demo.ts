// 소리 시험 페이지 (release/demo/goei-sound.html). 폰에서 열어 모든 효과음·곡·환경음을 들어 본다.
import { createGameAudio, SFX, SFX_IDS, BUSES, BUS_LABEL, type SfxId, type Scene, type SongId, SCENE_SONG } from './index';
import { GROUP_LABEL, type SfxGroup } from './sfx';
import { SONGS } from './songs';
import { checkAll } from './check';

const KEY = 'goei-sound-test:v1';
const audio = createGameAudio({
  load: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  save: (s) => {
    try {
      localStorage.setItem(KEY, s);
    } catch {
      /* 개인 창 */
    }
  },
});

const css = `
:root{--void:#1A2226;--sunk:#151C1F;--panel:#232D32;--panel2:#2C383E;--ink:#E3E8EA;--dim:#9AA8AE;--signal:#E0B04A;--on-signal:#1A1406;--red:#D9534F;--line:#3A474D}
*{box-sizing:border-box}
body{margin:0;background:var(--void);color:var(--ink);font:15px/1.45 system-ui,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif;-webkit-tap-highlight-color:transparent}
main{max-width:1100px;margin:0 auto;padding:16px 16px 120px}
h1{font-size:20px;margin:4px 0 2px;letter-spacing:.02em}
h2{font-size:15px;margin:0 0 10px;color:var(--signal)}
.sub{color:var(--dim);font-size:13px;margin:0 0 14px}
section{background:var(--panel);border-radius:12px;padding:14px;margin:0 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:8px}
button{font:inherit;color:var(--ink);background:var(--panel2);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:8px 10px;cursor:pointer;touch-action:manipulation;text-align:center}
button:active{transform:scale(.97)}
button.on{background:var(--signal);color:var(--on-signal);border-color:var(--signal);font-weight:600}
#unlock{width:100%;min-height:56px;font-size:17px;font-weight:700;background:var(--signal);color:var(--on-signal);border:0}
#unlock.done{background:var(--panel2);color:var(--dim);font-weight:500}
.row{display:flex;align-items:center;gap:10px;margin:6px 0}
.row label{width:64px;flex:none;color:var(--dim)}
.row input[type=range]{flex:1;accent-color:var(--signal);min-height:32px}
.row output{width:36px;text-align:right;font-variant-numeric:tabular-nums;color:var(--dim)}
.now{margin:10px 0 0;color:var(--dim);font-size:13px;text-align:center}
.cols{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:860px){.cols{grid-template-columns:1fr 1fr}}
.check{font-size:12px;color:var(--dim);white-space:pre-wrap;margin:10px 0 0}
`;

const root = document.createElement('main');
document.head.insertAdjacentHTML('beforeend', `<style>${css}</style>`);
document.body.append(root);

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Record<string, unknown> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] => {
  const n = Object.assign(document.createElement(tag), props);
  n.append(...kids);
  return n;
};
const btn = (label: string, on: () => void) => el('button', { type: 'button', onclick: on }, label);

root.append(
  el('h1', {}, '소리 시험실'),
  el('p', { className: 'sub' }, '녹음 파일 없이 전부 코드로 만든 효과음·음악·환경음입니다. 먼저 아래 노란 버튼을 눌러 주세요. 아이폰은 무음 스위치를 꺼야 들릴 수 있습니다.'),
);

// ── 켜기 ──
const unlockBtn = btn('소리 켜기', async () => {
  await audio.unlock();
  audio.play('uiOk');
  refresh();
});
unlockBtn.id = 'unlock';
root.append(el('section', {}, unlockBtn));

// ── 음량 ──
const vol = el('section', {}, el('h2', {}, '음량'));
for (const b of BUSES) {
  const out = el('output', {}, '');
  const r: HTMLInputElement = el('input', { type: 'range', min: '0', max: '100', value: String(Math.round(audio.settings[b] * 100)) });
  r.addEventListener('input', () => {
    audio.setVolume(b, Number(r.value) / 100);
    out.textContent = r.value;
  });
  out.textContent = r.value;
  vol.append(el('div', { className: 'row' }, el('label', {}, BUS_LABEL[b]), r, out));
}
const panR = el('input', { type: 'range', min: '-100', max: '100', value: '0' });
const panO = el('output', {}, '0');
panR.oninput = () => (panO.textContent = panR.value);
vol.append(el('div', { className: 'row' }, el('label', {}, '좌우'), panR, panO));
const muteBtn = btn('', () => {
  audio.setMuted(!audio.settings.muted);
  refresh();
});
vol.append(muteBtn);
void audio.ready.then(() => {
  vol.querySelectorAll<HTMLInputElement>('input[type=range]').forEach((r, i) => {
    const b = BUSES[i];
    if (!b) return;
    r.value = String(Math.round(audio.settings[b] * 100));
    (r.nextElementSibling as HTMLOutputElement).textContent = r.value;
  });
  refresh();
});

// ── 층 (음악 + 환경음) ──
const SCENES: [Scene, string][] = [
  ['title', '제목 화면'],
  ['hq', '본부'],
  ['lobby', '로비 (L1~L3)'],
  ['chase', '추격의 층'],
  ['replica', '재현 · 아파트'],
  ['trial', '시험 층'],
  ['dark', '어둠의 층'],
  ['silent', '침묵의 층'],
  ['puzzle', '퍼즐과 선택'],
  ['service', '정비 구역'],
  ['boss', '층 수호자'],
];
const sceneBtns = new Map<Scene | null, HTMLButtonElement>();
const sceneGrid = el('div', { className: 'grid' });
for (const [s, label] of SCENES) {
  const b = btn(label, async () => {
    await audio.unlock();
    audio.floor(s);
    refresh();
  });
  sceneBtns.set(s, b);
  sceneGrid.append(b);
}
const offBtn = btn('끄기', () => {
  audio.floor(null);
  refresh();
});
sceneBtns.set(null, offBtn);
sceneGrid.append(offBtn);
const now = el('p', { className: 'now' });
const jingles = el('div', { className: 'grid' });
for (const id of ['clear', 'gameover', 'discover'] as SongId[])
  jingles.append(
    btn(SONGS[id].label.replace(' (알림곡)', ''), async () => {
      await audio.unlock();
      audio.jingle(id);
    }),
  );
root.append(
  el('section', {}, el('h2', {}, '층별 음악과 환경음'), sceneGrid, now),
  el('section', {}, el('h2', {}, '알림곡 (끝나면 하던 곡으로 돌아감)'), jingles),
  vol,
);

// ── 연출 ──
const seq = (steps: [number, () => void][]) => async () => {
  await audio.unlock();
  for (const [ms, f] of steps) setTimeout(f, ms);
};
const P = (id: SfxId, o: { vol?: number; pan?: number; pitch?: number } = {}) => () => audio.play(id, o);
const E = (e: Parameters<typeof audio.event>[0]) => () => audio.event(e);
const walk = (n: number, gap: number) => Array.from({ length: n }, (_, i) => [i * gap, E({ type: 'step', pan: i % 2 ? 0.1 : -0.1 })] as [number, () => void]);
const scenes = el('div', { className: 'grid' });
const SEQS: [string, [number, () => void][]][] = [
  ['승강기 도착', [[0, P('panelButton')], [250, P('elevatorRide')], [3000, P('dingDong')], [3700, P('doorOpen')], [4900, P('intercom')]]],
  ['3연타', [[0, E({ type: 'hit', strength: 1 })], [230, E({ type: 'hit', strength: 2 })], [520, E({ type: 'whiff', strength: 3 })], [600, E({ type: 'hit', strength: 3 })]]],
  ['점프 킥', [[0, E({ type: 'jump' })], [260, E({ type: 'hit', kind: 'kick' })], [700, E({ type: 'land' })]]],
  ['권총 연사', [[0, E({ type: 'shot' })], [180, E({ type: 'shot' })], [360, E({ type: 'shot' })], [420, E({ type: 'hit', kind: 'bullet', pan: 0.6 })], [700, E({ type: 'empty' })], [1100, E({ type: 'reload' })]]],
  ['필살기', [[0, E({ type: 'super' })], [1300, E({ type: 'hit', kind: 'super' })], [1700, E({ type: 'enemyDie', pan: 0.4 })], [1900, E({ type: 'enemyDie', pan: -0.3 })]]],
  ['가드와 붕괴', [[0, E({ type: 'enemyTell', pan: 0.5 })], [400, E({ type: 'guard' })], [900, E({ type: 'guard', perfect: true })], [1500, E({ type: 'guardBreak' })]]],
  ['맞고 쓰러짐', [[0, E({ type: 'hurt' })], [300, E({ type: 'hurt' })], [500, E({ type: 'down' })], [1500, E({ type: 'wakeup' })]]],
  ['수호자 등장', [[0, E({ type: 'enemySpawn' })], [900, E({ type: 'bossTell' })], [1700, E({ type: 'bossRoar' })], [3300, E({ type: 'stomp', pan: -0.4 })], [3800, E({ type: 'stomp', pan: 0.4 })]]],
  ['걷기 (지금 층 바닥)', walk(8, 380)],
  ['달리기', walk(12, 230)],
  ['규칙 발견', [[0, E({ type: 'ruleFound' })]]],
  ['어둠 속 발소리', [[0, P('enemyStep', { pan: -0.8 })], [700, P('enemyStep', { pan: -0.5 })], [1400, P('enemyStep', { pan: -0.1 })], [2100, P('enemyStep', { pan: 0.3 })], [2600, P('heartbeat')], [3300, P('whisper', { pan: 0.7 })]]],
];
for (const [label, s] of SEQS) scenes.append(btn(label, seq(s)));
root.append(el('section', {}, el('h2', {}, '연출 묶음'), scenes));

// ── 효과음 낱개 ──
const groups = new Map<SfxGroup, SfxId[]>();
for (const id of SFX_IDS) {
  const g = SFX[id].group;
  (groups.get(g) ?? groups.set(g, []).get(g)!).push(id);
}
const cols = el('div', { className: 'cols' });
for (const [g, ids] of groups) {
  const grid = el('div', { className: 'grid' });
  for (const id of ids)
    grid.append(
      btn(SFX[id].label, async () => {
        await audio.unlock();
        audio.play(id, { pan: Number(panR.value) / 100 });
      }),
    );
  cols.append(el('section', {}, el('h2', {}, `${GROUP_LABEL[g]} (${ids.length})`), grid));
}
root.append(cols);

// ── 검사 ──
const checkOut = el('pre', { className: 'check' });
root.append(
  el(
    'section',
    {},
    el('h2', {}, '자동 검사'),
    btn('전부 렌더해서 무음·깨짐 검사', async () => {
      checkOut.textContent = '검사 중…';
      const r = await checkAll();
      const bad = [...r.sfx, ...r.songs].filter((s) => s.nan || s.peak < 0.005 || s.peak > 1.2);
      checkOut.textContent = `효과음 ${r.sfx.length}개, 곡 ${r.songs.length}개 렌더. 문제 ${bad.length}개${bad.length ? '\n' + bad.map((b) => `${b.id} 최대 ${b.peak}`).join('\n') : ''}`;
    }),
    checkOut,
  ),
);

function refresh() {
  unlockBtn.textContent = audio.unlocked ? '소리 켜짐' : '소리 켜기';
  unlockBtn.classList.toggle('done', audio.unlocked);
  muteBtn.textContent = audio.settings.muted ? '음소거 풀기' : '음소거';
  for (const [s, b] of sceneBtns) b.classList.toggle('on', s === audio.scene && (s !== null || !audio.song));
  const s = audio.scene;
  now.textContent = s
    ? SCENE_SONG[s]
      ? `지금: ${SONGS[SCENE_SONG[s]!].label} + 환경음`
      : '지금: 음악 없음 (원문대로 무음), 이명 같은 환경음만'
    : '꺼져 있음';
}
audio.onState(refresh);
refresh();
Object.assign(window, { __audio: audio, __checkAll: checkAll });
