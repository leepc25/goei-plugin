import { clipIndex } from './animation';
import { GAIT, MOTION } from './space';
import { demoArt } from './demo-art';
import { ActionRenderer } from './render';
import { newRun } from './sim';
const labels: Record<string, string> = {
  master: '이전 체형 기준 포즈',
  relaxed: '기본 대기',
  crouchwalk: '앉아 이동',
  lowkick: '하단차기',
  airattack: '공중차기',
  dashattack: '대시공격',
  stun: '스턴',
  victory: '승리',
  defeat: '패배',
  skill: 'C 파괴 능력',
  ult: 'S 필살기',
  cutin: '필살기 별도 컷인',
  idle: '전투 대기',
  walk: '걷기',
  run: '달리기',
  melee1: '근접 1타',
  melee2: '근접 2타',
  melee3: '근접 3타',
  shot: '권총 사격',
  guard: '가드',
  crouch: '낮은 자세',
  jump_up: '점프 상승',
  jump_apex: '점프 정점',
  jump_down: '낙하',
  land: '착지',
  dash: '회피',
  hurt: '피격',
  down: '다운',
  rise: '기상',
};
document.body.innerHTML = `<main><h1>쟈알디 동작 확인</h1><div class="controls"><label>동작 <select id="clip"></select></label><label>속도 <select id="speed"><option value="0.5">0.5배</option><option value="1" selected>1배</option></select></label><label><input type="checkbox" id="move" checked>보행 이동 함께 보기</label><label><input type="checkbox" id="zoom">2배 확대</label><label><input type="checkbox" id="grid" checked>바닥 격자</label><button id="pause">일시정지</button><button id="previous">이전 프레임</button><button id="next">다음 프레임</button><span id="status">그림 읽는 중</span></div><canvas width="1280" height="720"></canvas><p>걷기·달리기는 이동 거리로 재생합니다. 다른 동작은 반복 확인용입니다. 체형·접지·무기 위치·연결을 확인하는 제작 검증 화면입니다.</p></main>`;
const style = document.createElement('style');
style.textContent =
  'body{margin:0;padding:16px;background:#071019;color:#e2d7c0;font:14px monospace}main{max-width:1280px;margin:auto}h1{font-size:20px}.controls{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:14px}button,select{background:#142b3b;color:#e2d7c0;border:1px solid #617b85;padding:8px;font:inherit}canvas{display:block;width:100%;height:auto;image-rendering:pixelated}p{line-height:1.7}';
document.head.append(style);
const canvas = document.querySelector('canvas')!,
  renderer = new ActionRenderer(canvas),
  run = newRun();
run.enemies = [];
run.player.x = 640;
run.player.y = 530;
const select = document.getElementById('clip') as HTMLSelectElement,
  speed = document.getElementById('speed') as HTMLSelectElement,
  moving = document.getElementById('move') as HTMLInputElement,
  zoom = document.getElementById('zoom') as HTMLInputElement,
  status = document.getElementById('status')!;
let paused = false,
  clock = 0,
  last = 0,
  frames: number[] = [0],
  art: Awaited<ReturnType<typeof demoArt>>,
  raf = 0;
function duration() {
  if (select.value === 'walk') return GAIT.walk / MOTION.walkSpeed;
  if (select.value === 'run') return GAIT.run / MOTION.runSpeed;
  if (select.value === 'crouchwalk') return GAIT.crouch / 85;
  return (
    (art?.atlas.action?.frameTimes?.[select.value]?.reduce((sum, n) => sum + n, 0) ?? 800) / 1000
  );
}
function phase() {
  return (clock / duration()) % 1;
}
function poseIndex() {
  return clipIndex(phase(), frames, art?.atlas.action?.frameTimes?.[select.value]);
}
function draw() {
  const clip = select.value,
    walk = ['walk', 'run', 'crouchwalk'].includes(clip);
  run.player.act = clip === 'run' ? 'run' : clip === 'walk' ? 'walk' : 'idle';
  run.player.x =
    walk && moving.checked
      ? 180 +
        ((clock *
          (clip === 'run' ? MOTION.runSpeed : clip === 'crouchwalk' ? 85 : MOTION.walkSpeed)) %
          900)
      : 640;
  renderer.debugGround = (document.getElementById('grid') as HTMLInputElement).checked;
  renderer.drawPose(run, clip, phase());
  if (zoom.checked) {
    const c = renderer.ctx;
    c.imageSmoothingEnabled = false;
    const left = Math.max(0, Math.min(640, run.player.x - 320));
    c.drawImage(canvas, left, 240, 640, 360, 0, 0, 1280, 720);
  }
  status.textContent = `${labels[clip] ?? clip} · ${poseIndex() + 1}/${frames.length} 자세 · 주기 ${Math.round(duration() * 1000)}ms`;
}
select.onchange = () => {
  clock = 0;
  frames = art.atlas.action?.clips[select.value] ?? [0];
  draw();
};
(document.getElementById('pause') as HTMLButtonElement).onclick = (e) => {
  paused = !paused;
  (e.currentTarget as HTMLButtonElement).textContent = paused ? '재생' : '일시정지';
};
for (const [id, delta] of [
  ['previous', -1],
  ['next', 1],
] as const)
  (document.getElementById(id) as HTMLButtonElement).onclick = () => {
    paused = true;
    (document.getElementById('pause') as HTMLButtonElement).textContent = '재생';
    const times = art.atlas.action?.frameTimes?.[select.value] ?? frames.map(() => 1);
    const index = (poseIndex() + delta + frames.length) % frames.length;
    const total = times.reduce((a, b) => a + b, 0);
    clock =
      (duration() * (times.slice(0, index).reduce((a, b) => a + b, 0) + times[index] * 0.01)) /
      total;
    draw();
  };
void (async () => {
  try {
    art = await demoArt();
    await renderer.load(art);
    for (const [id, label] of Object.entries(labels)) {
      if (art.atlas.action?.clips[id]) {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = label;
        select.append(option);
      }
    }
    select.value = 'walk';
    select.onchange!(new Event('change'));
    document.body.dataset.ready = 'true';
    const frame = (now: number) => {
      if (!paused && !document.hidden && last)
        clock += Math.min(0.05, (now - last) / 1000) * Number(speed.value);
      last = now;
      draw();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  } catch (e) {
    status.textContent = e instanceof Error ? e.message : String(e);
  }
})();
window.addEventListener(
  'pagehide',
  () => {
    cancelAnimationFrame(raf);
    renderer.dispose();
  },
  { once: true },
);
