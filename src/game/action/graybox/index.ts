// 회색 상자 시험판 · 화면·입력·저장. 키는 기본 기획서 부록 A: 방향키 이동, A 근접, S 원거리, D 고유기, Q 가드, W 필살, E 상호작용, Space 점프, Shift 회피, 1~4 아이템, Z 지도, X 자동.
import css from './style.css';
import { AGENTS, MISSIONS, RULE_BY_ID, TYPE_LABEL, depthLabel } from './data';
import { GrayRenderer } from './render';
import { DEFAULT_SPEC, runLoadTest } from './loadtest';
import { DT, newMeta, newRun, restore, serialize, settle, step, unlockedMissions, type Input, type Meta, type Run } from './sim';

export interface GrayHost {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
  narrow(): boolean;
}
export function mountGraybox(box: HTMLElement, host: GrayHost): () => void {
  const root = document.createElement('section');
  root.className = 'gb';
  root.tabIndex = 0;
  const style = document.createElement('style');
  style.textContent = css;
  root.innerHTML = `<div class="gb-top"><b>회색 상자 시험판 · 차원 승강기</b><span data-size-label></span><button data-do="hq">본부</button><button data-do="pause">Esc 메뉴</button><button data-do="size">크기 비교</button><button data-do="load">부하 시험</button><button data-do="reset">새 데이터</button><span data-busy></span></div>
<div class="gb-fit"><canvas tabindex="0" aria-label="게임 화면"></canvas>
<div class="gb-panel" data-panel="hq"></div>
<div class="gb-panel" data-panel="brief"></div>
<div class="gb-panel" data-panel="settle"></div>
<div class="gb-panel" data-panel="pause"><h2>메뉴</h2><p>Esc 또는 계속으로 돌아간다.</p><div class="row"><button data-do="resume">계속</button><button data-do="tohq">본부로 (출동 포기 = 후송 취급)</button></div><p>조작: 방향키 이동(같은 방향 두 번 = 달리기) · A 근접 3연타 · S 원거리 · D 고유기 · Q 가드 · W 필살(게이지 100) · E 상호작용/인사 · Space 점프 · Shift 회피 · ↓ 앉기, 앉아 A 하단 · 달리며 A 돌진 · 공중 A · 1~4 아이템 · Z 지도 · X 자동(미구현) · 경직 중인 적에 닿으면 잡기</p></div>
<div class="gb-panel" data-panel="size"><h2>크기 비교 (정자세 키 · 2배 표시)</h2><p>그림 없이 상자 높이만 바꾼다. 적·수호자는 요원 비례. 선택은 저장된다.</p><div class="row"><button data-size="128">128px (지금 기준, 256px 표시)</button><button data-size="96">96px (192px 표시)</button><button data-size="80">80px (160px 표시)</button></div><div class="row"><button data-do="closesize">닫기</button></div></div>
<div class="gb-panel" data-panel="load"><h2>가짜 팩 부하 시험</h2><p>노이즈 PNG를 실제 장수·크기로 만들어 저장(IndexedDB, pluginStorage 대용)·읽기·디코딩·층 교체 10회를 잰다. 실제 RisuAI pluginStorage와 모바일 실기는 별도.</p><div class="row"><button data-load="128">128px로 시험</button><button data-load="96">96px로 시험</button><button data-load="80">80px로 시험</button><button data-do="closeload">닫기</button></div><pre data-load-out style="white-space:pre-wrap"></pre></div>
</div>
<div class="gb-foot"><div class="gb-stick" aria-label="이동"><i></i></div><button data-hold="attack">A</button><button data-hold="shoot">S</button><button data-edge="unique">D</button><button data-hold="guard">Q</button><button data-edge="ult">W</button><button data-edge="interact">E</button><button data-edge="jump">Spc</button><button data-edge="evade">Shift</button><button data-edge="run">달리기</button><button data-item="0">1</button><button data-item="1">2</button><button data-item="2">3</button><button data-item="3">4</button><button data-choice="0">①</button><button data-choice="1">②</button><button data-choice="2">③</button><button data-edge="cancel">Esc</button></div>
<p class="gb-note">방향키 이동 · A 근접 · S 원거리 · D 고유기 · Q 가드 · W 필살 · E 상호작용 · Space 점프 · Shift 회피 · 1~4 아이템 · 숫자 = 선택지 · Z 지도 · Esc 메뉴</p>`;
  box.append(style, root);
  const $ = <T extends HTMLElement>(s: string) => root.querySelector<T>(s)!;
  const canvas = $<HTMLCanvasElement>('canvas');
  const renderer = new GrayRenderer(canvas);
  let meta: Meta = newMeta();
  let run: Run = newRun(meta);
  let paused = false,
    disposed = false,
    raf = 0,
    last = 0,
    acc = 0,
    dirty = false,
    lastSave = 0,
    saving = false;
  const keys = new Set<string>();
  let edges: Partial<Input> = {};
  let lastTap: { key: string; t: number } | null = null;
  let runHeld = false;
  let stickId: number | null = null,
    stickX = 0,
    stickY = 0;
  const stick = $('.gb-stick'),
    thumb = $('.gb-stick i');
  const panel = (name: string | null) => {
    root.querySelectorAll<HTMLElement>('.gb-panel').forEach((p) => p.classList.toggle('on', p.dataset.panel === name));
  };
  const hqHtml = () => {
    const list = unlockedMissions(meta);
    const m = list[Math.min(run.hqMission, list.length - 1)];
    const rules = meta.rulebook.map((id) => `<li>${RULE_BY_ID[id]?.text ?? id}</li>`).join('') || '<li>아직 없음</li>';
    return `<h2>본부 · 잼트리 자리</h2><p>예산 ${meta.currencies.budget} · 현금 ${meta.currencies.cash} · 연구 자료 ${meta.currencies.research} · 이빨 ${meta.currencies.teeth} · 최저 ${meta.deepest ? depthLabel(meta.deepest) : '—'} · 출동 ${meta.runs}회 · 완료 임무 ${meta.missionsDone.length}/${MISSIONS.length}</p>
<p><b>임무</b> (숫자 키 또는 클릭)</p><div class="row">${list.map((x, i) => `<button data-mission="${i}" class="${x.id === m?.id ? 'sel' : ''}">${i + 1}. ${x.kind} · ${x.title} (${x.depth})</button>`).join('')}</div>
<p><b>요원</b> (←→ 또는 클릭)</p><div class="row">${AGENTS.map((a, i) => `<button data-agent="${i}" class="${i === run.hqAgent ? 'sel' : ''}">${a.name} · HP ${a.hp} · ${a.uniqueLabel} · 회피 ${a.evade === 'back' ? '뒤로' : '옆으로'}</button>`).join('')}</div>
<p><b>규칙서</b> (${meta.rulebook.length}줄)</p><ul style="columns:2;margin:4px 0">${rules}</ul>
<div class="row"><button data-do="brief">E 브리핑으로</button></div>`;
  };
  const briefHtml = () => {
    const m = MISSIONS.find((x) => x.id === run.mission)!;
    const a = AGENTS[run.hqAgent];
    const rel = meta.rulebook.map((id) => RULE_BY_ID[id]).filter(Boolean);
    return `<h2>브리핑</h2><p><b>${m.kind}: ${m.title}</b> · ${m.depth} · 보상 예산 ${m.reward.budget}${m.reward.teeth ? ` · 이빨 ${m.reward.teeth}` : ''}${m.reward.research ? ` · 연구 ${m.reward.research}` : ''}</p>
<p>출동 요원: ${a.name} · 지원 요원·유물·아이템 칸은 다음 단계</p>
<p>알려진 규칙 ${rel.length}줄: ${rel.map((r) => r.text).join(' / ') || '없음. 첫 출동은 표지(노란 상자)를 E로 읽어 규칙을 모은다.'}</p>
<p>잼트리: 「점검표요. 서명란이 비어 있으면 그게 입구래요. …네, 지금 타신 그거요.」</p>
<p>출동 흐름: 로비 L1~L3 → 승강기 버튼으로 B-1… · 층 끝 패널 E로 승강기 · 점검문/해치로 정비 구역 → 다락방(회복·송신·로프 귀환) · 한 층 더 갈지 로프를 탈지는 매번 선택</p>
<div class="row"><button data-choice="0">E 출동</button><button data-edge="cancel">Esc 돌아가기</button></div>`;
  };
  const settleHtml = () => `<h2>정산 · ${run.ended === 'evac' ? '후송' : '귀환'}</h2>${settle(run, meta).map((l) => `<p>${l}</p>`).join('')}<p>가 본 층: ${run.visited.map((v) => `${depthLabel(v.depth)} ${TYPE_LABEL[v.type]}`).join(' → ')}</p><div class="row"><button data-choice="0">E 본부로</button></div>`;
  let shownPhase = '';
  const syncPanels = () => {
    const ph = run.phase;
    if (ph === 'hq') {
      const html = hqHtml();
      const el = $('[data-panel=hq]');
      if (el.innerHTML !== html) el.innerHTML = html;
      panel('hq');
    } else if (ph === 'brief') {
      if (shownPhase !== 'brief') $('[data-panel=brief]').innerHTML = briefHtml();
      panel('brief');
    } else if (ph === 'settle') {
      if (shownPhase !== 'settle') $('[data-panel=settle]').innerHTML = settleHtml();
      panel('settle');
    } else if (paused) panel('pause');
    else if (!root.querySelector('.gb-panel.on[data-panel=size], .gb-panel.on[data-panel=load]')) panel(null);
    shownPhase = ph;
    $('[data-size-label]').textContent = `요원 ${meta.size}px`;
    $('[data-busy]').textContent = saving ? '저장 중' : dirty ? '진행 중' : '저장됨';
  };
  const input = (): Input => {
    const rev = (k: string) => keys.has(k);
    let x = (rev('ArrowRight') ? 1 : 0) - (rev('ArrowLeft') ? 1 : 0) + stickX;
    let y = (rev('ArrowDown') ? 1 : 0) - (rev('ArrowUp') ? 1 : 0) + stickY;
    x = Math.max(-1, Math.min(1, x));
    y = Math.max(-1, Math.min(1, y));
    const i: Input = { x: Math.abs(x) < 0.3 ? 0 : Math.sign(x), y: Math.abs(y) < 0.3 ? 0 : Math.sign(y), run: runHeld, attack: rev('KeyA') || !!edges.attack, shoot: rev('KeyS') || !!edges.shoot, guard: rev('KeyQ') || !!edges.guard, ...edges };
    edges = {};
    return i;
  };
  const save = async (force = false) => {
    if (!dirty && !force) return;
    if (saving) return;
    saving = true;
    try {
      await host.save(serialize(run, meta));
      dirty = false;
      lastSave = performance.now();
    } catch {
      /* 다음에 다시 */
    }
    saving = false;
  };
  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0);
    last = now;
    if (!paused) {
      acc += dt;
      let n = 0;
      while (acc >= DT && n++ < 4) {
        acc -= DT;
        step(run, input(), meta);
        dirty = true;
      }
    } else edges = {};
    renderer.draw(run, meta.size);
    syncPanels();
    if (dirty && now - lastSave > 5000) void save();
  };
  // 입력
  const keyMap: Record<string, keyof Input> = { KeyD: 'unique', KeyW: 'ult', KeyE: 'interact', Space: 'jump', ShiftLeft: 'evade', ShiftRight: 'evade', KeyX: 'auto', Escape: 'cancel' };
  const onKey = (ev: KeyboardEvent) => {
    const t = ev.target as HTMLElement | null;
    if (t && t !== canvas && t !== root && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if (!root.contains(t) && t !== document.body) return;
    if (ev.type === 'keydown') {
      if (ev.code === 'Escape') {
        if (run.dialog || run.elevator) edges.cancel = true;
        else if (run.phase === 'floor' || run.phase === 'service') (paused = !paused), syncPanels();
        else edges.cancel = true;
        ev.preventDefault();
        return;
      }
      if (ev.repeat) return;
      if (/^Digit[1-9]$/.test(ev.code)) {
        const n = Number(ev.code.slice(5)) - 1;
        if (run.dialog || run.elevator || run.upgradePick || run.phase !== 'floor' && run.phase !== 'service') edges.choice = n;
        else if (n < 4) edges.item = n;
        ev.preventDefault();
        return;
      }
      if (ev.code === 'KeyZ') {
        ev.preventDefault();
        return;
      }
      if (ev.code === 'KeyX') {
        run.message = '자동 전환(X)은 회색 상자 다음 단계';
        run.msgT = 2;
        return;
      }
      if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') {
        const now = performance.now();
        if (lastTap && lastTap.key === ev.code && now - lastTap.t < 260) runHeld = true;
        lastTap = { key: ev.code, t: now };
      }
      keys.add(ev.code);
      const k = keyMap[ev.code];
      if (k) (edges as Record<string, unknown>)[k] = true;
      if (ev.code === 'KeyA') edges.attack = true;
      if (ev.code === 'KeyS') edges.shoot = true;
      if (ev.code === 'KeyE' && (run.phase === 'hq' || run.phase === 'brief' || run.phase === 'settle')) edges.interact = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.code)) ev.preventDefault();
    } else {
      keys.delete(ev.code);
      if (ev.code === 'ArrowLeft' || ev.code === 'ArrowRight') runHeld = false;
    }
  };
  // A는 홀드가 아니라 엣지(연타). S·Q는 홀드.
  const onPointer = (ev: PointerEvent) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('[data-hold],[data-edge],[data-item],[data-choice],[data-do],[data-size],[data-load],[data-mission],[data-agent]');
    if (!t) return;
    if (ev.type === 'pointerdown') {
      canvas.focus({ preventScroll: true });
      if (t.dataset.hold) keys.add(t.dataset.hold === 'attack' ? 'KeyA' : t.dataset.hold === 'shoot' ? 'KeyS' : 'KeyQ'), t.dataset.hold === 'attack' && (edges.attack = true);
      if (t.dataset.edge === 'run') runHeld = true;
      else if (t.dataset.edge) (edges as Record<string, unknown>)[t.dataset.edge] = true;
      if (t.dataset.item) edges.item = Number(t.dataset.item);
      if (t.dataset.choice) edges.choice = Number(t.dataset.choice);
      if (t.dataset.mission) (run.hqMission = Number(t.dataset.mission)), syncPanels();
      if (t.dataset.agent) (run.hqAgent = Number(t.dataset.agent)), syncPanels();
      if (t.dataset.size) (meta.size = Number(t.dataset.size) as Meta['size']), (dirty = true), syncPanels();
      if (t.dataset.load) void loadTest(Number(t.dataset.load) as 128 | 96 | 80);
      switch (t.dataset.do) {
        case 'pause':
          paused = !paused;
          syncPanels();
          break;
        case 'resume':
          paused = false;
          syncPanels();
          break;
        case 'hq':
        case 'tohq':
          if (run.phase === 'floor' || run.phase === 'service') run.ended = 'evac', (run.phase = 'settle');
          else run.phase = 'hq';
          paused = false;
          syncPanels();
          break;
        case 'brief':
          edges.interact = true;
          break;
        case 'size':
          panel('size');
          break;
        case 'closesize':
        case 'closeload':
          panel(null);
          syncPanels();
          break;
        case 'load':
          panel('load');
          break;
        case 'reset':
          if (confirm('규칙서·재화·기록을 지우고 새로 시작할까요?')) {
            meta = newMeta();
            run = newRun(meta);
            dirty = true;
            void save(true);
            syncPanels();
          }
          break;
      }
    } else if (t.dataset.hold) keys.delete(t.dataset.hold === 'attack' ? 'KeyA' : t.dataset.hold === 'shoot' ? 'KeyS' : 'KeyQ');
    else if (t.dataset.edge === 'run') runHeld = false;
  };
  const loadTest = async (size: 128 | 96 | 80) => {
    const out = $('[data-load-out]');
    out.textContent = '시작…';
    try {
      const r = await runLoadTest(DEFAULT_SPEC(size), (s) => (out.textContent = s));
      out.textContent = r.lines.join('\n');
      (window as unknown as { __loadResult?: unknown }).__loadResult = r;
    } catch (e) {
      out.textContent = `실패: ${String(e)}`;
    }
  };
  const onStick = (ev: PointerEvent) => {
    if (ev.type === 'pointerdown') {
      stickId = ev.pointerId;
      stick.setPointerCapture(ev.pointerId);
    }
    if (stickId !== ev.pointerId) return;
    if (ev.type === 'pointerup' || ev.type === 'pointercancel') {
      stickId = null;
      stickX = stickY = 0;
      thumb.style.transform = '';
      return;
    }
    const r = stick.getBoundingClientRect();
    const dx = (ev.clientX - r.left - r.width / 2) / (r.width / 2),
      dy = (ev.clientY - r.top - r.height / 2) / (r.height / 2);
    stickX = Math.max(-1, Math.min(1, dx));
    stickY = Math.max(-1, Math.min(1, dy));
    runHeld = Math.hypot(dx, dy) > 0.9;
    thumb.style.transform = `translate(${stickX * 30}px,${stickY * 30}px)`;
  };
  root.addEventListener('keydown', onKey);
  root.addEventListener('keyup', onKey);
  root.addEventListener('pointerdown', onPointer);
  root.addEventListener('pointerup', onPointer);
  root.addEventListener('pointercancel', onPointer);
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) stick.addEventListener(t, onStick);
  const blur = () => {
    keys.clear();
    runHeld = false;
  };
  window.addEventListener('blur', blur);
  // 복원
  void (async () => {
    const saved = restore(await host.load());
    if (saved && !disposed) {
      meta = saved.meta;
      run = saved.run;
      if (run.phase === 'floor' || run.phase === 'service') paused = true;
    }
    if (!disposed) {
      syncPanels();
      canvas.focus({ preventScroll: true });
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  })();
  Object.assign(window, {
    __gb: {
      get run() {
        return run;
      },
      get meta() {
        return meta;
      },
      set(r: Run) {
        run = r;
      },
      step: (i: Input) => step(run, i, meta),
      save: () => save(true),
      unpause: () => {
        paused = false;
      },
    },
  });
  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    window.removeEventListener('blur', blur);
    void save(true);
    root.remove();
    style.remove();
  };
}
