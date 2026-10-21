// 시연판 전용 임시 출동: 새 엔진(engine/)이 들어오기 전까지 회색 상자 시험판 시뮬레이션으로 출동을 돌린다.
// 본부 모듈은 이 파일을 쓰지 않는다. 엔진이 붙으면 시연판(demo.ts)만 엔진으로 바꾼다.
import { GrayRenderer } from '../graybox/render';
import { RULE_BY_ID } from '../graybox/data';
import { DT, deploy, endRun, newMeta, newRun, settle as graySettle, step, type Input, type Run } from '../graybox/sim';
import { emptyResult, type MissionLaunch, type RunResult } from './contract';
import { addBag, addItem, newInventory, openRunMenu, useItem, iconCanvas, type RunInventory } from './runmenu';
import { itemName } from './logic';

const GRAY_ITEMS = ['medkit', 'charm', 'energy', 'flash'];

export function runMission(box: HTMLElement, l: MissionLaunch, done: (r: RunResult) => void): () => void {
  const meta = newMeta();
  meta.rulebook = l.knownRules.slice();
  meta.deepest = l.deepest;
  const run: Run = newRun(meta, l.agent, l.goal.id, l.seed);
  run.danger = l.danger;
  run.growth = 0;
  deploy(run, meta);
  const p0 = run.player;
  p0.max = p0.hp = l.stats.hp;
  p0.items = [0, 0, 0, 0];
  const inv: RunInventory = newInventory(l.items, l.relics);
  let lastResearch = 0;
  let bigHit = false;
  let withdrew = false;

  const el = document.createElement('section');
  el.className = 'hq-run';
  el.tabIndex = 0;
  el.innerHTML = `<div class="hq-run-top"><b>출동 · ${l.goal.kind}: ${l.goal.title}</b><button data-r="menu">Esc 가방</button></div>
<div class="hq-run-view"><canvas></canvas><p class="hq-rotate">폰을 가로로 돌리면 화면이 커져요</p></div>
<div class="hq-run-items"></div>
<div class="hq-run-pad"><div class="hq-stick"><i></i></div><div class="hq-run-btns">
<button data-hold="KeyA">A 근접</button><button data-hold="KeyS">S 사격</button><button data-edge="unique">D 고유기</button><button data-hold="KeyQ">Q 가드</button>
<button data-edge="jump">점프</button><button data-edge="evade">회피</button><button data-edge="interact">E</button><button data-edge="ult">W 필살</button>
<button data-choice="0">①</button><button data-choice="1">②</button><button data-choice="2">③</button><button data-r="menu">가방</button></div></div>
<p class="hq-run-note">방향키 이동(같은 방향 두 번 = 달리기) · A 근접 · S 사격 · D 고유기 · Q 가드 · W 필살 · E 상호작용 · Space 점프 · Shift 회피 · 1~4 아이템 · 숫자 = 선택지 · Esc 가방. 회색 상자 임시 전투(새 엔진이 들어오면 바뀜).</p>`;
  box.append(el);
  const canvas = el.querySelector('canvas')!;
  const renderer = new GrayRenderer(canvas);
  const itemsBar = el.querySelector<HTMLElement>('.hq-run-items')!;
  const keys = new Set<string>();
  let edges: Partial<Input> = {};
  let runHeld = false;
  let lastTap: { k: string; t: number } | null = null;
  let stickX = 0,
    stickY = 0,
    stickId: number | null = null;
  let closeMenu: (() => void) | null = null;
  let raf = 0,
    last = performance.now(),
    acc = 0,
    finished = false;

  const drawItems = () => {
    itemsBar.replaceChildren(
      ...inv.items.map((s, i) => {
        const b = document.createElement('button');
        b.dataset.item = String(i);
        b.disabled = !s;
        if (s) b.append(iconCanvas(s.id, 24));
        b.append(` ${i + 1} ${s ? `${itemName(s.id)}×${s.n}` : '—'}`);
        return b;
      }),
    );
    const info = document.createElement('span');
    info.textContent = `가방 ${inv.bag.filter(Boolean).length}/6 · 현금 ${run.loot.cash}`;
    itemsBar.append(info);
  };
  const apply = (id: string) => {
    const p = run.player;
    const names: Record<string, string> = { medkit: '회복약: 체력 35%', bandage: '압박 붕대: 체력 10%', antidote: '정화제', salt: '소금 원', flash: '섬광탄: 주변 적 기절', smoke: '연막탄', charm: '부적: 다음 피격 무효', energy: '에너지 음료' };
    if (id === 'medkit') p.hp = Math.min(p.max, p.hp + p.max * 0.35);
    if (id === 'bandage') p.hp = Math.min(p.max, p.hp + p.max * 0.1);
    if (id === 'charm') p.guardBuff = 10;
    if (id === 'energy') (p.uniqueCd = 0), (p.energy = 100);
    if (id === 'flash' || id === 'smoke' || id === 'salt') for (const e of run.ents) if (e.alive && Math.abs(e.x - p.x) < 300) e.stun = 2;
    run.message = names[id] ?? id;
    run.msgT = 2;
  };
  const use = (slot: number) => {
    const id = useItem(inv, slot);
    if (id) apply(id);
    drawItems();
  };
  const sync = () => {
    const p = run.player;
    // 시험판이 바닥에 놓은 아이템을 가방 칸으로 옮긴다
    p.items.forEach((n, i) => {
      for (let k = 0; k < n; k++) if (!addItem(inv, GRAY_ITEMS[i])) ((run.message = '아이템 칸이 가득 찼다'), (run.msgT = 2));
      if (n) drawItems();
    });
    p.items = [0, 0, 0, 0];
    // 연구 자료가 늘면 회수물 하나 (가방 6칸)
    const dr = run.loot.research - lastResearch;
    if (dr > 0) {
      const name = run.checklist && !inv.bag.some((b) => b?.id === 'checklist') ? '서명란이 빈 점검표' : run.guardianDead ? '수호자의 흔적' : '이상 물품';
      if (!addBag(inv, { id: name === '서명란이 빈 점검표' ? 'checklist' : 'odd', name, research: dr })) ((run.message = '가방이 가득 찼다. 회수물을 두고 간다.'), (run.msgT = 3));
      drawItems();
    } else if (dr < 0) {
      const i = inv.bag.map((b) => !!b).lastIndexOf(true);
      if (i >= 0) inv.bag[i] = null;
    }
    lastResearch = run.loot.research;
    if (p.hp > 0 && p.hp < p.max * 0.3) bigHit = true;
    inv.found = run.found.slice();
    inv.sent = run.sent.slice();
    inv.cash = run.loot.cash;
    inv.upgrades = run.upgrades.slice();
    inv.canWithdraw = run.phase === 'service';
  };
  const finish = () => {
    if (finished) return;
    finished = true;
    const tmp = structuredClone(meta);
    graySettle(run, tmp);
    const how = run.ended === 'evac' ? 'evac' : withdrew ? 'withdraw' : tmp.missionsDone.includes(l.goal.id) ? 'return' : 'withdraw';
    const r: RunResult = {
      ...emptyResult(how),
      missionDone: tmp.missionsDone.includes(l.goal.id) && how === 'return',
      depth: Math.max(1, run.depth),
      floors: run.visited.length,
      kills: run.kills,
      cash: run.loot.cash,
      teeth: run.loot.teeth,
      bag: inv.bag.slice(),
      itemsLeft: inv.items.slice(),
      found: run.found.slice(),
      sent: run.sent.slice(),
      rescued: run.rescue.delivered ? ['worker'] : [],
      bigHit,
      seconds: Math.round(run.time),
    };
    dispose();
    done(r);
  };
  const input = (): Input => {
    const x = Math.max(-1, Math.min(1, (keys.has('ArrowRight') ? 1 : 0) - (keys.has('ArrowLeft') ? 1 : 0) + stickX));
    const y = Math.max(-1, Math.min(1, (keys.has('ArrowDown') ? 1 : 0) - (keys.has('ArrowUp') ? 1 : 0) + stickY));
    const i: Input = { x: Math.abs(x) < 0.3 ? 0 : Math.sign(x), y: Math.abs(y) < 0.3 ? 0 : Math.sign(y), run: runHeld, attack: keys.has('KeyA') || !!edges.attack, shoot: keys.has('KeyS'), guard: keys.has('KeyQ'), ...edges };
    edges = {};
    return i;
  };
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!closeMenu) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n++ < 4) {
        acc -= DT;
        step(run, input(), meta);
        sync();
        if (run.ended) return finish();
      }
    }
    renderer.draw(run, 128);
  };
  const toggleMenu = () => {
    if (closeMenu) return closeMenu();
    sync();
    closeMenu = openRunMenu(el, inv, use, {
      title: '가방 (일시정지)',
      ruleText: (id) => RULE_BY_ID[id]?.text ?? id,
      onWithdraw: () => {
        withdrew = true;
        endRun(run, 'return');
        finish();
      },
      onClose: () => ((closeMenu = null), (last = performance.now()), el.focus({ preventScroll: true })),
    });
  };
  const choosing = () => !!(run.dialog || run.elevator || run.upgradePick);
  const keyEdge: Record<string, keyof Input> = { KeyD: 'unique', KeyW: 'ult', KeyE: 'interact', Space: 'jump', ShiftLeft: 'evade', ShiftRight: 'evade' };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.type === 'keyup') {
      keys.delete(ev.code);
      if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') runHeld = false;
      return;
    }
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
    if (ev.repeat) return;
    if (ev.code === 'Escape') {
      ev.preventDefault();
      if (choosing() && !closeMenu) edges.cancel = true;
      else toggleMenu();
      return;
    }
    if (closeMenu) return;
    if (/^Digit[1-9]$/.test(ev.code)) {
      const n = Number(ev.code.slice(5)) - 1;
      if (choosing()) edges.choice = n;
      else if (n < 4) use(n);
      return;
    }
    if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') {
      const t = performance.now();
      if (lastTap && lastTap.k === ev.code && t - lastTap.t < 260) runHeld = true;
      lastTap = { k: ev.code, t };
    }
    keys.add(ev.code);
    const k = keyEdge[ev.code];
    if (k) (edges as Record<string, unknown>)[k] = true;
    if (ev.code === 'KeyA') edges.attack = true;
  };
  const onPointer = (ev: PointerEvent) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-hold],[data-edge],[data-choice],[data-r],[data-item]');
    if (!t) return;
    if (ev.type === 'pointerdown') {
      if (t.dataset.hold) (keys.add(t.dataset.hold), t.dataset.hold === 'KeyA' && (edges.attack = true));
      if (t.dataset.edge) (edges as Record<string, unknown>)[t.dataset.edge] = true;
      if (t.dataset.choice) edges.choice = Number(t.dataset.choice);
      if (t.dataset.item && !closeMenu) use(Number(t.dataset.item));
      if (t.dataset.r === 'menu') (choosing() ? (edges.cancel = true) : toggleMenu());
    } else if (t.dataset.hold) keys.delete(t.dataset.hold);
  };
  const stick = el.querySelector<HTMLElement>('.hq-stick')!,
    thumb = stick.querySelector<HTMLElement>('i')!;
  const onStick = (ev: PointerEvent) => {
    if (ev.type === 'pointerdown') ((stickId = ev.pointerId), stick.setPointerCapture(ev.pointerId));
    if (stickId !== ev.pointerId) return;
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') {
      stickId = null;
      stickX = stickY = 0;
      runHeld = false;
      thumb.style.transform = '';
      return;
    }
    const r = stick.getBoundingClientRect();
    const dx = (ev.clientX - r.left - r.width / 2) / (r.width / 2),
      dy = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
    stickX = Math.max(-1, Math.min(1, dx));
    stickY = Math.max(-1, Math.min(1, dy));
    runHeld = Math.hypot(dx, dy) > 0.95;
    thumb.style.transform = `translate(${stickX * 28}px,${stickY * 28}px)`;
  };
  const blur = () => (keys.clear(), (runHeld = false));
  el.addEventListener('keydown', onKey);
  el.addEventListener('keyup', onKey);
  el.addEventListener('pointerdown', onPointer);
  el.addEventListener('pointerup', onPointer);
  el.addEventListener('pointercancel', onPointer);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) stick.addEventListener(t, onStick);
  window.addEventListener('blur', blur);
  drawItems();
  el.focus({ preventScroll: true });
  raf = requestAnimationFrame(frame);
  const dispose = () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('blur', blur);
    closeMenu?.();
    el.remove();
  };
  Object.assign(window, { __run: { run, inv, finish, toggleMenu, use, step: (i: Input) => (step(run, i, meta), sync(), run.ended && finish()) } });
  return dispose;
}
