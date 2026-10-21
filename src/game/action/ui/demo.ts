// 화면·조작 시연판: 회색 상자 층(차원 승강기)을 새 껍데기(ui/)로 돌린다. 단독 HTML 진입점.
// 폰: 가로로 돌리면 왼쪽 스틱 + 오른쪽 버튼. PC: 키보드 (부록 A). 게임패드: 표준 배치.
import { AGENTS, RULE_BY_ID, TYPE_COLOR, TYPE_LABEL, UPGRADES, depthLabel } from '../graybox/data';
import { DT, deploy, elevatorOptions, endRun, enterFloor, newMeta, newRun, restore, serialize, settle, step, H, type Input, type Meta, type Run } from '../graybox/sim';
import { cameraX, currentFloor, drawTitleBg, drawWorld } from './demo-world';
import { drawMap, type HudState } from './hud';
import { mountGameShell } from './index';

const SAVE = 'goei-ui-demo:v1';
const box = document.getElementById('box')!;
const q = new URLSearchParams(location.search);
if (q.get('w')) box.style.width = `${q.get('w')}px`;
if (q.get('h')) box.style.height = `${q.get('h')}px`;

const load = (): { run: Run; meta: Meta } | null => {
  try {
    return restore(localStorage.getItem(SAVE));
  } catch {
    return null;
  }
};
let meta: Meta = newMeta();
let run: Run = newRun(meta);
{
  const s = load();
  if (s) (meta = s.meta), (run = s.run);
}
const save = () => {
  try {
    localStorage.setItem(SAVE, serialize(run, meta));
  } catch {
    /* 저장 공간 없음 */
  }
};
const inRun = () => run.phase === 'floor' || run.phase === 'service';

const shell = mountGameShell(box, {
  title: '차원 승강기',
  sub: '띵. 1층입니다. 문이 열립니다.',
  hasSave: () => inRun(),
  onNew: () => void startNew(),
  onContinue: () => {
    shell.play();
    void shell.fx.transition('fade', { open: true });
  },
  onRetreat: () => {
    endRun(run, 'evac');
  },
  onTitle: () => {
    save();
    shell.openTitle();
  },
  pauseInfo: () => (inRun() ? `${depthLabel(run.depth)} ${TYPE_LABEL[currentFloor(run).type]} · 규칙 ${run.found.length} · 현금 ${run.loot.cash}` : ''),
});
const { input, hud, fx } = shell;

async function startNew() {
  const i = await shell.choose({ title: '출동 요원', lines: ['누구를 보낼까요?'], options: AGENTS.map((a) => `${a.name} · 체력 ${a.hp} · ${a.uniqueLabel}`) });
  if (i < 0) return;
  run = newRun(meta, AGENTS[i].id, 'm1');
  deploy(run, meta);
  resetAmmo();
  hud.reset();
  shell.play();
  save();
}

// ── 탄약: 회색 상자 판엔 탄 제한이 없어 시연판이 센다 (아이템과 무기 스레드가 실제 규칙을 맡는다)
const MAG = 12;
let mag = MAG,
  reserve = 48,
  reload: number | null = null,
  shotsSeen = new WeakSet<object>();
const resetAmmo = () => ((mag = MAG), (reserve = 48), (reload = null));
const startReload = () => {
  if (reload === null && mag < MAG && reserve > 0) reload = 0;
};

// ── 입력 → 회색 상자 Input. Shift 0.15초 안에 떼면 회피, 누르고 있으면 달리기. 같은 방향 두 번도 달리기
let shiftAt = 0,
  lastTap: { code: string; t: number } | null = null,
  dblRun = false,
  pendingChoice: number | undefined,
  pendingCancel = false;
input.on((code, down) => {
  if (!down) {
    if (code === 'ShiftLeft' && performance.now() - shiftAt < 150) evadeEdge = true;
    if (code === 'ArrowLeft' || code === 'ArrowRight') dblRun = false;
    return;
  }
  if (code === 'ShiftLeft') shiftAt = performance.now();
  if (code === 'ArrowLeft' || code === 'ArrowRight') {
    const now = performance.now();
    if (lastTap && lastTap.code === code && now - lastTap.t < 260) dblRun = true;
    lastTap = { code, t: now };
  }
  if (!inRun() || shell.paused) return;
  if (code === 'KeyZ') mapOpen = !mapOpen;
  if (code === 'KeyR') startReload();
  if (code === 'KeyX') hud.toast('자동 전환: 전투 쪽에서 붙이는 중', '#9fd8ff');
  if (code === 'KeyH') hud.toast('판정 보기: 전투 쪽에서 붙이는 중', '#9fd8ff');
  if (code === 'KeyC') hud.toast('지원 요원 호출: 아직 없음', '#9fd8ff');
});
let evadeEdge = false;
let mapOpen = false;

function makeInput(): Input {
  const a = input.axis();
  const sx = Math.abs(a.x) < 0.3 ? 0 : Math.sign(a.x),
    sy = Math.abs(a.y) < 0.3 ? 0 : Math.sign(a.y);
  const canShoot = mag > 0 && reload === null;
  const i: Input = {
    x: sx,
    y: sy,
    run: (input.held('ShiftLeft') && input.heldFor('ShiftLeft') >= 0.15) || dblRun,
    attack: input.held('KeyA') || input.pressed('KeyA'),
    shoot: canShoot && (input.held('KeyS') || input.pressed('KeyS')),
    guard: input.held('KeyQ'),
    unique: input.pressed('KeyD'),
    ult: input.pressed('KeyW'),
    interact: input.pressed('KeyE'),
    jump: input.pressed('Space'),
    evade: evadeEdge,
  };
  for (let n = 0; n < 4; n++) if (input.pressed(`Digit${n + 1}`)) i.item = n;
  if (pendingChoice !== undefined) (i.choice = pendingChoice), (pendingChoice = undefined);
  if (pendingCancel) (i.cancel = true), (pendingCancel = false);
  if (input.pressed('KeyS') && !canShoot && reload === null) hud.toast(reserve > 0 ? '탄창이 비었다 · R 재장전' : '탄이 없다', '#ff8a80');
  evadeEdge = false;
  return i;
}

// ── 선택지(대화·승강기·강화)는 껍데기의 선택 창으로
let shownChoice: object | null = null;
function syncChoices() {
  if (shell.menu.isOpen) return;
  const obj = run.dialog ?? run.elevator ?? (run.upgradePick as object | null);
  if (!obj || obj === shownChoice) {
    if (!obj) shownChoice = null;
    return;
  }
  shownChoice = obj;
  let title = '',
    lines: string[] = [],
    options: string[] = [];
  if (run.dialog) ({ title, lines, options } = run.dialog);
  else if (run.elevator) {
    title = '엘리베이터 패널';
    lines = [`총애 ${run.favor} · 층 유형은 총애 2 이상이거나 지도·승객 정보가 있을 때만 보인다`];
    options = elevatorOptions(run).map((o) => o.label);
  } else if (run.upgradePick) {
    title = '강화 선택 · 수호자 보상';
    options = run.upgradePick.map((id) => UPGRADES.find((u) => u.id === id)?.label ?? id);
  }
  void shell.choose({ title, lines, options, cancel: !run.upgradePick }).then((i) => {
    if (i < 0) pendingCancel = true;
    else pendingChoice = i;
  });
}

// ── 사건 감지 → 효과
const hpSeen = new Map<number, number>();
let pHp = -1,
  lastFloorKey = '',
  lastPhase = run.phase,
  effectsSeen = new WeakSet<object>(),
  ruleAt = new Map<string, number>(),
  lastAttic = false;
function detect() {
  const p = run.player;
  for (const e of run.ents) {
    const old = hpSeen.get(e.id);
    if (old !== undefined && e.hp < old) {
      const dmg = old - e.hp;
      const sc = meta.size / 128;
      fx.onEvent({ type: 'hit', x: e.x, y: e.y - e.h * sc * 0.6 - e.z, strength: dmg >= 30 ? 3 : dmg >= 17 ? 2 : 1, dmg, target: 'enemy' });
      if (!e.alive || e.hp <= 0) fx.onEvent({ type: 'down', x: e.x, y: e.y });
    }
    hpSeen.set(e.id, e.hp);
  }
  if (pHp >= 0 && p.hp < pHp) {
    fx.onEvent({ type: 'hurt', strength: pHp - p.hp > 20 ? 2 : 1 });
    fx.onEvent({ type: 'hit', x: p.x, y: p.y - meta.size * 1.2, strength: 1, dmg: pHp - p.hp, target: 'player' });
  } else if (pHp >= 0 && p.hp > pHp + 5) fx.onEvent({ type: 'heal', x: p.x, y: p.y - meta.size * 2, amount: Math.round(p.hp - pHp) });
  pHp = p.hp;
  for (const ef of run.effects) {
    if (effectsSeen.has(ef)) continue;
    effectsSeen.add(ef);
    if (ef.kind === 'blast') fx.onEvent({ type: 'blast', x: ef.x, y: ef.y });
    if (ef.kind === 'guard') fx.onEvent({ type: 'guard', x: ef.x, y: ef.y });
  }
  for (const b of run.bolts) {
    if (b.enemy || shotsSeen.has(b)) continue;
    shotsSeen.add(b);
    mag = Math.max(0, mag - 1);
    if (mag === 0) startReload();
  }
  if (run.cutin > 0.9) fx.onEvent({ type: 'ult' });
  for (const id of run.found) if (!ruleAt.has(id)) ruleAt.set(id, run.time);
  if (run.atticHealed && !lastAttic) (reserve = 48), hud.toast('다락방: 탄 보충', '#e8e0b0');
  lastAttic = run.atticHealed;
  const f = currentFloor(run);
  const key = `${run.phase}:${run.depth}:${f.seed}`;
  if (inRun() && key !== lastFloorKey) {
    const first = lastFloorKey === '';
    const toService = run.phase === 'service' && lastPhase === 'floor';
    const fromService = run.phase === 'floor' && lastPhase === 'service';
    if (toService || fromService) void fx.transition('fade', { open: true, dur: 0.7 });
    else {
      void fx.transition('doors', { open: true, text: depthLabel(run.depth), dur: 1.8 });
      if (!first || shell.mode === 'play') fx.onEvent({ type: 'floor', depth: depthLabel(run.depth), name: TYPE_LABEL[f.type], variant: f.variant || undefined });
    }
    hpSeen.clear();
    lastFloorKey = key;
  }
  lastPhase = run.phase;
}

function hudState(): HudState {
  const p = run.player,
    f = currentFloor(run),
    a = AGENTS.find((x) => x.id === run.agent) ?? AGENTS[0];
  const cam = cameraX(run);
  const ITEM = ['회복', '방어', '능력', '손전등'];
  const near = f.props.filter((pr) => !pr.used && Math.abs(pr.x + pr.w / 2 - p.x) < 100).sort((x, y) => Math.abs(x.x - p.x) - Math.abs(y.x - p.x))[0];
  const PROMPT: Record<string, string> = { sign: '읽기', door: '열기', lockdoor: '열기', servicedoor: '점검문', hatch: '해치 (점프 중)', panel: '승강기 부르기', mirror: '거울 보기', rope: '로프 타기 · 귀환', phone: '인터폰', pickup: '줍기', checklist: '점검표', crate: '틈새 막기', key: '줍기', exit: 'EXIT' };
  const talker = run.ents.find((e) => e.alive && !e.hostile && (e.special === 'passenger' || e.special === 'elder' || e.special === 'rule') && Math.abs(e.x - p.x) < 110 && Math.abs(e.y - p.y) < 70);
  let prompt: HudState['prompt'] = null;
  if (talker) prompt = { text: talker.special === 'rule' ? '인사하기' : '말 걸기', key: 'E', x: talker.x - cam, y: talker.y - talker.h * (meta.size / 128) - 30 };
  else if (near && PROMPT[near.kind] && !(near.kind === 'panel' && near.data !== 'end')) prompt = { text: PROMPT[near.kind], key: 'E', x: near.x + near.w / 2 - cam, y: near.y - 16 };
  const guardian = run.ents.find((e) => e.guardian && e.alive && e.spawned && Math.abs(e.x - p.x) < 1100);
  const meters: HudState['meters'] = [];
  if (f.type === 'silent' || p.noise > 0) meters.push({ label: '소리', v: p.noise, max: 100, color: '#8cf' });
  let timer: HudState['timer'] = null;
  if (run.trial?.started && !run.trial.done) timer = { label: `시험 ${run.trial.kills}/${f.goal?.need ?? 0}`, sec: run.trial.left };
  else if (run.phase === 'service' && run.atticT > 0) timer = { label: '다락방', sec: Math.max(0, (f.variant.includes('빠른') ? 45 : 90) - run.atticT) };
  const status: HudState['status'] = [];
  if (p.guardBuff > 0) status.push({ label: `방어 강화 ${Math.ceil(p.guardBuff)}`, good: true });
  if (p.lit > 0) status.push({ label: `손전등 ${Math.ceil(p.lit)}`, good: true });
  if (p.reversed) status.push({ label: '조작 반전', good: false });
  if (p.stun > 0) status.push({ label: '경직', good: false });
  return {
    agent: { name: a.name, color: a.color },
    hp: p.hp,
    maxHp: p.max,
    energy: p.energy,
    maxEnergy: 100,
    gauge: p.gauge,
    status,
    weapon: { name: '권총', mag, magMax: MAG, reserve, reload },
    items: p.items.map((n, i) => ({ label: ITEM[i], count: n })),
    floor: { depth: depthLabel(run.depth), name: TYPE_LABEL[f.type], variant: f.variant || undefined },
    rules: run.found.slice(-3).map((id) => ({ text: RULE_BY_ID[id]?.text ?? id, fresh: run.time - (ruleAt.get(id) ?? -99) < 4 })),
    ruleCount: { found: run.found.length, sent: run.sent.length },
    favor: run.favor,
    money: run.loot,
    boss: guardian ? { name: guardian.label, hp: guardian.hp, max: guardian.max } : null,
    prompt,
    meters,
    timer,
    message: run.message,
    device: input.last,
    compact: shell.touchShown,
  };
}

// ── 정산
let settling = false;
async function handleSettle() {
  if (settling) return;
  settling = true;
  const lines = settle(run, meta);
  await fx.transition('fade', { dur: 0.6 });
  save();
  await shell.info(run.ended === 'evac' ? '정산 · 후송' : '정산 · 귀환', [...lines, `가 본 층: ${run.visited.map((v) => `${depthLabel(v.depth)} ${TYPE_LABEL[v.type]}`).join(' → ')}`], '타이틀로');
  run.phase = 'hq';
  save();
  settling = false;
  shell.openTitle();
}

// ── 주 반복
let last = performance.now(),
  acc = 0,
  lastSave = 0,
  t = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000 || 0);
  last = now;
  t += dt;
  shell.frame(dt);
  const c = shell.ctx;
  if (shell.mode === 'title' || !inRun()) {
    if (run.phase === 'settle') void handleSettle();
    drawTitleBg(c, t);
    fx.drawTransition(c);
    input.endFrame();
    return;
  }
  syncChoices();
  if (!shell.paused && !mapOpen) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n++ < 4) {
      acc -= DT;
      step(run, makeInput(), meta);
      input.endFrame();
      detect();
      if (reload !== null) {
        reload += DT / 1.2;
        if (reload >= 1) {
          const take = Math.min(MAG - mag, reserve);
          mag += take;
          reserve -= take;
          reload = null;
        }
      }
      if (!inRun()) break;
    }
  } else {
    acc = 0;
    input.endFrame();
  }
  if (!inRun()) return;
  drawWorld(c, run, fx, meta.size);
  const hs = hudState();
  fx.drawScreen(c, run.player.hp / run.player.max);
  hud.draw(c, hs, dt);
  shell.touch.setItems(hs.items);
  shell.touch.setGauge(run.player.gauge / 100);
  shell.touch.hint('interact', !!hs.prompt);
  shell.touch.hint('reload', mag <= 3 && reserve > 0);
  if (mapOpen) {
    const f = currentFloor(run);
    drawMap(c, {
      floors: run.visited.map((v) => ({ label: `${depthLabel(v.depth)} ${TYPE_LABEL[v.type]}`, current: v.depth === run.depth })),
      strip: f.chunks.map((ch) => ({ w: ch.w, color: ch.kind === 'guardian' ? '#a33' : ch.kind === 'attic' ? '#a83' : TYPE_COLOR[f.type], tag: ch.kind === 'guardian' ? '수호자' : ch.kind === 'attic' ? '다락방' : ch.kind === 'hall_end' ? '승강기' : undefined })),
      at: run.player.x / f.width,
    });
  }
  fx.drawTransition(c);
  if (now - lastSave > 5000) (save(), (lastSave = now));
}
void H;
shell.openTitle();
requestAnimationFrame(frame);
window.addEventListener('pagehide', save);
Object.assign(window, { __ui: { shell, get run() { return run; }, get meta() { return meta; }, startNew, hudState, goFloor: (type: Parameters<typeof enterFloor>[2], depth = 6) => enterFloor(run, depth, type) } });
