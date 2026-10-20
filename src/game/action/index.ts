import type { GameHost } from '../index';
import css from './style.css';
import { ActionRenderer } from './render';
import { SCENE } from './space';
import { newRun, practiceRun, restore, serialize, step, type Input } from './sim';

// 같은 호스트를 닫았다 다시 열어도 최신 쓰기 완료를 기다린 뒤 복원한다.
const writes = new WeakMap<GameHost, Promise<void>>();

export function mountAction(box: HTMLElement, host: GameHost): () => void {
  const root = document.createElement('section');
  root.className = 'ga';
  root.tabIndex = 0;
  root.setAttribute('aria-label', '쟈알디 1인 전투 검증판');
  const style = document.createElement('style');
  style.textContent = css;
  root.innerHTML = `<div class="ga-hud"><b>쟈알디 · 일반 체형 2배 도트 · 액션 v4</b><span>HP <progress data-meter="hp" max="200"></progress><span data-hp></span></span><span>능력 <progress data-meter="energy" max="100"></progress></span><span>방어 <progress data-meter="guard" max="100"></progress></span><span>필살 <progress data-meter="gauge" max="100"></progress></span><button data-do="auto">F 자동</button><button data-do="practice">동작 훈련</button><button data-do="pause">Esc 메뉴</button></div>
  <div class="ga-fit"><canvas tabindex="0" aria-label="방향키 이동 Z 근접 · D 사격 X 점프 C 능력 Shift 회피 A 방어 S 필살 QWE 아이템"></canvas><div class="ga-menu"><b data-menu-title>그림을 불러오는 중</b><p data-menu-text>기준 체형 전용 동작 · 1인 전투 시연판</p><button data-do="resume" disabled>계속</button><button data-do="restart" hidden>새 훈련</button></div></div>
  <div class="ga-foot"><div class="ga-stick" aria-label="이동 조이스틱"><span>이동</span><i></i></div><div class="ga-controls"><button data-hold="attack">Z 근접</button><button data-hold="ranged">D 사격</button><button data-edge="jump">X 점프</button><button data-edge="skill">C 파괴</button><button data-edge="dash">⇧ 회피/달리기</button><button data-hold="guard">A 방어</button><button data-edge="ult">S 필살</button><button data-item="0">Q 회복</button><button data-item="1">W 방어</button><button data-item="2">E 능력</button></div><span class="ga-msg" aria-live="polite"></span><span data-busy></span><button data-do="restart">새 훈련</button></div><p class="ga-note">방 하나 · 적 4체 / A+↓ 앉기 · A 유지+←→ 앉아 이동 · 앉아 Z 하단차기 · Shift+이동+Z 대시공격 · 공중 Z 차기 · D 사격 / 바닥 클릭 이동·적 클릭 공격·우클릭 회피 / 방향키 이동 · Z 근접 · D 사격 · F 자동 전투</p>`;
  root.querySelector('.ga-controls')!.insertAdjacentHTML('beforeend','<button data-edge="reload">R 재장전</button><button data-edge="grab">G 잡기/던지기</button>');
  root.querySelector('.ga-hud')!.insertAdjacentHTML('beforeend','<span data-ammo></span>');
  box.append(style, root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const canvas = $<HTMLCanvasElement>('canvas'),
    fit = $('.ga-fit'),
    menu = $('.ga-menu'),
    renderer = new ActionRenderer(canvas);
  let run = newRun(),
    ready = false,
    disposed = false,
    paused = true,
    raf = 0,
    last = 0,
    acc = 0,
    dirty = false,
    saving = false,
    lastSave = 0,
    saveError = false;
  let stickId: number | null = null,
    stickX = 0,
    stickY = 0;
  const stick = $('.ga-stick'),
    thumb = $('.ga-stick i');
  let target: { x: number; y: number; attack: boolean; id?: number } | null = null;
  const keys = new Set<string>(),
    pointers = new Map<number, string>();
  let edges: Partial<Input> = {};
  const clear = () => {
    keys.clear();
    pointers.clear();
    edges = {};
    target = null;
    stickId = null;
    stickX = stickY = 0;
    thumb.style.transform = 'translate(0,0)';
  };
  const text = (selector: string, value: string) => {
    const e = $(selector);
    if (e.textContent !== value) e.textContent = value;
  };
  const hud = () => {
    const p = run.player;
    if (root.dataset.action !== p.act) root.dataset.action = p.act;
    for (const [name, value] of Object.entries({
      hp: p.hp,
      energy: p.energy,
      guard: p.guard,
      gauge: p.gauge,
    }))
      $<HTMLProgressElement>(`[data-meter="${name}"]`).value = value;
    text('[data-hp]', String(Math.ceil(p.hp)));
    text('[data-ammo]', `탄약 ${p.ammo}/8 · 예비 ${p.reserve}`);
    text('[data-do="auto"]', run.auto ? 'F 자동 ON' : 'F 수동');
    text('.ga-msg', run.message);
    text(
      '[data-busy]',
      saveError ? '저장 실패 · 재시도 중' : saving ? '저장 중' : dirty ? '진행 중' : '저장됨',
    );
    root.dataset.saveError = String(saveError);
    ['Q 음식', 'W 붕대', 'E 음료'].forEach((label, i) => {
      const b = $<HTMLButtonElement>(`[data-item="${i}"]`);
      b.textContent = `${label} ${p.items[i]}`;
      b.disabled = run.phase !== 'combat' || p.items[i] <= 0;
    });
  };
  // 쓰기를 직렬화하며 닫을 때 최신 스냅샷까지 이어서 저장한다.
  const save = async (force = false): Promise<void> => {
    if (!ready || !dirty) return;
    if (saving && !force) return;
    if (!force && performance.now() - lastSave < 5000) return;
    const data = serialize(run);
    dirty = false;
    saving = true;
    lastSave = performance.now();
    const task = (writes.get(host) ?? Promise.resolve()).then(() => host.save(data));
    writes.set(
      host,
      task.catch(() => {}),
    );
    try {
      await task;
      saveError = false;
    } catch {
      dirty = true;
      saveError = true;
    } finally {
      saving = false;
      if (!disposed) hud();
    }
  };
  const pause = (value: boolean) => {
    paused = value;
    clear();
    acc = 0;
    last = 0;
    menu.hidden = !value;
    text('[data-menu-title]', '일시정지');
    text(
      '[data-menu-text]',
      'Q 회복제 · W 방어 회복 · E 능력 회복. 닫아도 출동 상태를 이어갑니다. F로 자동 전투를 켜고 끌 수 있습니다.',
    );
    $<HTMLButtonElement>('[data-do="resume"]').disabled = !ready;
    if (value) void save(true);
  };
  const restart = (practice = false) => {
    if (!ready) return;
    run = practice ? practiceRun() : newRun();
    dirty = true;
    pause(false);
    void save(true);
    root.focus();
    hud();
  };
  const toggle = () => {
    if (!ready || paused) return;
    clear();
    run.auto = !run.auto;
    dirty = true;
    void save(true);
    hud();
  };
  const manual = () => {
    if (run.auto) {
      run.auto = false;
      dirty = true;
    }
  };
  const codes: Record<string, string> = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    KeyZ: 'attack',
    KeyD: 'ranged',
    KeyA: 'guard',
    ShiftLeft: 'run',
    ShiftRight: 'run',
  };
  const once: Record<string, keyof Input> = {
    KeyR: 'reload',
    KeyG: 'grab',
    KeyX: 'jump',
    KeyC: 'skill',
    ShiftLeft: 'dash',
    ShiftRight: 'dash',
    KeyS: 'ult',
  };
  const abort = new AbortController(),
    signal = abort.signal;
  root.addEventListener(
    'keydown',
    (ev) => {
      const e = ev as KeyboardEvent;
      if ((e.target as HTMLElement).matches('input,textarea,select,[contenteditable=true]')) return;
      if (e.code === 'Escape') {
        e.preventDefault();
        if (!e.repeat && ready) pause(!paused);
        return;
      }
      // 메뉴 버튼에 초점이 있으면 Enter/Space 등 브라우저 기본 탐색을 보존한다.
      if (paused || !ready) return;
      if (e.code === 'KeyF') {
        e.preventDefault();
        if (!e.repeat) toggle();
        return;
      }
      if (!codes[e.code] && !once[e.code] && !['KeyQ', 'KeyW', 'KeyE'].includes(e.code)) return;
      e.preventDefault();
      manual();
      target = null;
      if (codes[e.code]) keys.add(codes[e.code]);
      if (!e.repeat && once[e.code]) edges[once[e.code]] = true as never;
      if (!e.repeat && ['KeyQ', 'KeyW', 'KeyE'].includes(e.code))
        edges.item = ['KeyQ', 'KeyW', 'KeyE'].indexOf(e.code);
    },
    { signal },
  );
  root.addEventListener(
    'keyup',
    (ev) => {
      const e = ev as KeyboardEvent;
      if (codes[e.code]) keys.delete(codes[e.code]);
    },
    { signal },
  );
  root.addEventListener(
    'focusout',
    (e) => {
      if (!root.contains(e.relatedTarget as Node | null)) {
        clear();
        if (ready && !run.auto && !paused) pause(true);
      }
    },
    { signal },
  );
  window.addEventListener(
    'blur',
    () => {
      if (ready) pause(true);
    },
    { signal },
  );
  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden && ready) pause(true);
    },
    { signal },
  );
  root.addEventListener(
    'click',
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-do]');
      if (!b) return;
      if (b.dataset.do === 'auto') toggle();
      if (b.dataset.do === 'pause' && ready) pause(!paused);
      if (b.dataset.do === 'resume' && ready) {
        pause(false);
        root.focus();
      }
      if (b.dataset.do === 'restart') restart();
      if (b.dataset.do === 'practice') restart(true);
    },
    { signal },
  );
  root.addEventListener(
    'pointerdown',
    (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>(
        '[data-hold],[data-edge],[data-item]',
      );
      if (!b || b.disabled || paused || !ready) return;
      e.preventDefault();
      root.focus();
      manual();
      target = null;
      b.setPointerCapture(e.pointerId);
      if (b.dataset.hold) pointers.set(e.pointerId, b.dataset.hold);
      if (b.dataset.edge) {
        edges[b.dataset.edge as keyof Input] = true as never;
        if (b.dataset.edge === 'dash') pointers.set(e.pointerId, 'run');
      }
      if (b.dataset.item !== undefined) edges.item = Number(b.dataset.item);
    },
    { signal },
  );
  const updateStick = (e: PointerEvent) => {
    const b = stick.getBoundingClientRect(),
      dx = (e.clientX - b.left - b.width / 2) / (b.width * 0.35),
      dy = (e.clientY - b.top - b.height / 2) / (b.height * 0.35),
      len = Math.max(1, Math.hypot(dx, dy));
    stickX = Math.abs(dx) < 0.18 ? 0 : dx / len;
    stickY = Math.abs(dy) < 0.18 ? 0 : dy / len;
    thumb.style.transform = `translate(${stickX * 28}px,${stickY * 28}px)`;
  };
  stick.addEventListener(
    'pointerdown',
    (e) => {
      if (!ready || paused || stickId !== null) return;
      e.preventDefault();
      root.focus();
      manual();
      target = null;
      stickId = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      updateStick(e);
    },
    { signal },
  );
  stick.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerId === stickId) updateStick(e);
    },
    { signal },
  );
  const release = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (e.pointerId === stickId) {
      stickId = null;
      stickX = stickY = 0;
      thumb.style.transform = 'translate(0,0)';
    }
  };
  root.addEventListener('pointerup', release, { signal });
  root.addEventListener('pointercancel', release, { signal });
  root.addEventListener('lostpointercapture', release, { signal });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault(), { signal });
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (paused || !ready) return;
      e.preventDefault();
      root.focus();
      manual();
      const b = canvas.getBoundingClientRect();
      const x = Math.max(55, Math.min(1225, ((e.clientX - b.left) / b.width) * 1280)),
        y = ((e.clientY - b.top) / b.height) * 720;
      if (e.button === 2) {
        edges.dash = true;
        target = {
          x,
          y: Math.max(SCENE.floorMin, Math.min(SCENE.floorMax, y)),
          attack: false,
        };
        return;
      }
      const enemy = run.enemies.find(
        (a) => a.hp > 0 && Math.abs(a.x - x) < 90 && y > a.y - SCENE.adultHeight && y < a.y + 20,
      );
      target = enemy
        ? { x: enemy.x, y: enemy.y, attack: true, id: enemy.id }
        : {
            x,
            y: Math.max(SCENE.floorMin, Math.min(SCENE.floorMax, y)),
            attack: false,
          };
    },
    { signal },
  );
  const input = (): Input => {
    const held = new Set([...keys, ...pointers.values()]);
    const p = run.player;
    let x = Number(held.has('right')) - Number(held.has('left')) + stickX,
      y = Number(held.has('down')) - Number(held.has('up')) + stickY,
      attack = held.has('attack');
    if (target?.id) {
      const e = run.enemies.find((e) => e.id === target?.id && e.hp > 0);
      if (e) {
        target.x = e.x;
        target.y = e.y;
      } else target = null;
    }
    if (target) {
      const dx = target.x - p.x,
        dy = target.y - p.y;
      x = Math.abs(dx) > (target.attack ? 95 : 10) ? Math.sign(dx) : 0;
      y = Math.abs(dy) > 12 ? Math.sign(dy) : 0;
      attack = target.attack && Math.abs(dx) < 120 && Math.abs(dy) < 25;
      if (target.attack) p.dir = dx >= 0 ? 1 : -1;
      if (!target.attack && !x && !y) target = null;
    }
    const result = {
      x,
      y,
      attack,
      ranged: held.has('ranged'),
      run: held.has('run') || Math.hypot(stickX, stickY) > 0.95,
      guard: held.has('guard'),
      ...edges,
    };
    edges = {};
    return result;
  };
  const resize = () => {
    const scale = Math.max(0.01, Math.min(fit.clientWidth / 1280, fit.clientHeight / 720));
    canvas.style.width = `${Math.floor(1280 * scale)}px`;
    canvas.style.height = `${Math.floor(720 * scale)}px`;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(fit);
  let waiting = host.waiting();
  const offWaiting = host.onWaiting((value) => {
    waiting = value;
  });
  let hudTime = 0;
  const frame = (now: number) => {
    if (disposed) return;
    if (ready && !paused && !document.hidden) {
      const wasCombat = run.phase === 'combat';
      acc += Math.min(0.1, last ? (now - last) / 1000 : 0);
      let ticks = 0;
      while (acc >= 1 / 60 && ticks++ < 8) {
        step(run, input(), 1 / 60);
        acc -= 1 / 60;
        dirty = true;
      }
      void save(wasCombat && run.phase !== 'combat');
    } else acc = 0;
    last = now;
    if (ready && !document.hidden && (!paused || hudTime === 0)) renderer.draw(run);
    if (now - hudTime > 120) {
      hud();
      hudTime = now;
    }
    raf = requestAnimationFrame(frame);
  };
  void (async () => {
    try {
      const [raw, art] = await Promise.all([
        (writes.get(host) ?? Promise.resolve()).then(() => host.load()),
        host.art(),
      ]);
      if (disposed) return;
      const restored = restore(raw);
      run = restored ?? newRun();
      await renderer.load(art);
      root.dataset.artProfile = art.atlas.action?.profile ?? 'unknown';
      if (art.atlas.action?.profile === 'production-v5-preview')
        text('.ga-hud > b', '쟈알디 · 신규 작화 적용 시연 · 제작 중');
      if (disposed) return;
      ready = true;
      if (raw && !restored) {
        run.message = '저장을 읽지 못해 새 훈련을 시작합니다.';
      }
      pause(true);
      text('[data-menu-title]', '쟈알디 · 1인 전투 검증판');
      text(
        '[data-menu-text]',
        '계속 버튼을 누르면 시작합니다. 방향키 이동 · Z 근접 · D 사격 · X 점프 · C 파괴 · Shift 회피 · A 가드 · S 필살 · QWE 아이템 · F 자동. 기존 순찰 기록은 별도로 보존됩니다.',
      );
      $<HTMLButtonElement>('[data-do="restart"]').hidden = false;
      resize();
      hud();
    } catch (e) {
      if (!disposed) {
        text('[data-menu-title]', '검증판을 열지 못했습니다');
        text('[data-menu-text]', e instanceof Error ? e.message : String(e));
      }
    }
  })();
  raf = requestAnimationFrame(frame);
  return () => {
    if (disposed) return;
    clear();
    void save(true);
    disposed = true;
    cancelAnimationFrame(raf);
    abort.abort();
    observer.disconnect();
    offWaiting();
    renderer.dispose();
    root.remove();
    style.remove();
  };
}
