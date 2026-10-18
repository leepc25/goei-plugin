// 관찰형 게임 「관리국 순찰」: 응답을 기다리는 동안 분대가 학교를 순찰하며 싸우는 모습을 지켜본다.
// 플러그인 창은 mountGame(box, host)로 붙이고, 돌려받은 함수로 정리한다.
import css from './style.css';
import { FACES } from './assets';
import { AGENTS, CAMP, ENEMIES, ROOMS, TUNE, type AgentId, type EnemyId } from './data';
import { Renderer } from './render';
import { agentDef, agents, alive, applySquad, newRun, readMeta, step, trigger, type Meta, type Run } from './sim';

export interface GameHost {
  /** 저장된 문자열을 불러온다. 없으면 null */
  load(): Promise<string | null>;
  /** 문자열을 저장한다. 바뀐 게 있을 때 최소 5초 간격으로만 부른다 */
  save(data: string): Promise<void>;
  /** 지금 AI 응답을 기다리는 중인가 */
  waiting(): boolean;
  /** 기다림 시작/끝 알림. 돌려받은 함수로 구독 해제 */
  onWaiting(cb: (waiting: boolean) => void): () => void;
  /** 모바일 폭인가 */
  narrow(): boolean;
}

/** 같은 페이지에서 닫았다 다시 열면 순찰을 이어서 보여 준다 (저장은 기록만) */
let lastRun: { run: Run; squad: string } | null = null;

const STEP = 1 / 30;

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function faceStyle(id: AgentId, size: number): string {
  return `background-image:url('${FACES}');background-position:${-agentDef(id).face * size}px 0`;
}

export function mountGame(box: HTMLElement, host: GameHost): () => void {
  let disposed = false;
  let raf = 0;
  const root = document.createElement('div');
  root.className = 'goei-game';
  const style = document.createElement('style');
  style.textContent = css;
  root.innerHTML = `
    <div class="gg-top"><span class="gg-place"></span><span class="gg-steps"></span><span class="gg-depth"></span><span class="gg-sp"></span>
      <button class="gg-tb" data-act="squad">편성</button><button class="gg-tb" data-act="rec">기록</button></div>
    <div class="gg-stage"><canvas aria-label="관리국 순찰 화면"></canvas><div class="gg-load">불러오는 중</div></div>
    <div class="gg-squad"></div>
    <div class="gg-sheet" hidden></div>`;
  box.append(style, root);
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const canvas = $<HTMLCanvasElement>('canvas');
  const stage = $<HTMLElement>('.gg-stage');
  const squadEl = $<HTMLElement>('.gg-squad');
  const sheet = $<HTMLElement>('.gg-sheet');
  const renderer = new Renderer(canvas);

  let meta: Meta = readMeta(null);
  let run: Run | null = null;
  let dirty = false;
  let lastSave = Date.now();
  let saving = false;
  let speed = host.waiting() ? TUNE.waitingSpeed : 1;
  let picking: AgentId[] = [];

  const save = (force = false) => {
    if (!dirty || saving || (!force && Date.now() - lastSave < TUNE.saveGap)) return;
    dirty = false;
    saving = true;
    lastSave = Date.now();
    host.save(JSON.stringify(meta)).catch(() => (dirty = true)).finally(() => (saving = false));
  };

  // ---- 화면 크기 ----
  const fit = () => {
    renderer.layout(stage.clientWidth, stage.clientHeight, window.devicePixelRatio || 1);
    if (run) renderer.draw(run, true);
  };
  const ro = new ResizeObserver(() => !disposed && fit());
  ro.observe(stage);

  // ---- 위쪽 줄과 분대 카드 ----
  let topKey = '';
  const drawTop = () => {
    if (!run) return;
    const camp = run.phase === 'camp' || (run.phase === 'retreat' && run.pt > 0.6);
    const key = `${camp}|${run.room}|${run.depth}`;
    if (key === topKey) return;
    topKey = key;
    $('.gg-place').textContent = camp ? CAMP.name : ROOMS[run.rooms[run.room]].name;
    $('.gg-depth').textContent = `순찰 ${run.depth}`;
    $('.gg-steps').innerHTML = camp ? '' : [0, 1, 2].map((i) => `<i class="${i < run!.room ? 'done' : i === run!.room ? 'now' : ''}${i === 2 ? ' boss' : ''}"></i>`).join('');
  };

  let cardKey = '';
  const drawCards = () => {
    if (!run) return;
    const team = [...agents(run)].sort((a, b) => meta.squad.indexOf(a.kind as AgentId) - meta.squad.indexOf(b.kind as AgentId));
    const key = team.map((u) => u.uid).join(',');
    if (key !== cardKey) {
      cardKey = key;
      squadEl.innerHTML = team.map((u) => {
        const d = agentDef(u.kind as AgentId);
        return `<button class="gg-ag" data-uid="${u.uid}" aria-label="${esc(d.name)} ${esc(d.skillName)}">
          <span class="gg-face" style="${faceStyle(d.id, 40)}"></span><span class="gg-nm">${esc(d.name)}</span>
          <span class="gg-bar hp"><b></b></span><span class="gg-bar sk"><b></b></span></button>`;
      }).join('');
    }
    const foesUp = run.units.some((u) => u.side === 'e' && alive(u));
    for (const u of team) {
      const el = squadEl.querySelector<HTMLElement>(`[data-uid="${u.uid}"]`);
      if (!el) continue;
      const hp = u.hp / u.max;
      (el.querySelector('.hp b') as HTMLElement).style.transform = `scaleX(${hp.toFixed(3)})`;
      (el.querySelector('.sk b') as HTMLElement).style.transform = `scaleX(${Math.min(1, u.gauge).toFixed(3)})`;
      el.classList.toggle('ready', u.gauge >= 1 && alive(u) && run.phase === 'patrol' && foesUp);
      el.classList.toggle('down', !alive(u) && u.act !== 'rest');
      el.classList.toggle('low', hp < 0.3);
    }
  };

  // ---- 편성 · 기록 ----
  const openSquad = () => {
    picking = [...meta.squad];
    sheet.hidden = false;
    drawSquadSheet();
  };
  const drawSquadSheet = () => {
    sheet.innerHTML = `<div class="gg-sh-head"><b>분대 편성</b><span class="gg-depth">${picking.length} / 4</span><button class="gg-tb" data-act="close">닫기</button></div>
      <div class="gg-sh-body"><div class="gg-pick">${AGENTS.map((a) => `<button class="gg-pk${picking.includes(a.id) ? ' on' : ''}" data-pick="${a.id}">
        <span class="gg-face" style="${faceStyle(a.id, 48)}"></span><b>${esc(a.name)}</b><small>${esc(a.role)} · ${esc(a.skillName)}</small></button>`).join('')}</div></div>
      <div class="gg-sh-foot"><button class="gg-tb primary" data-act="apply"${picking.length === 4 ? '' : ' disabled'}>이 분대로 출발</button></div>`;
  };
  const openRecord = () => {
    sheet.hidden = false;
    const kills = (Object.keys(ENEMIES) as EnemyId[]).map((k) => `<dt>${esc(ENEMIES[k].name)}</dt><dd>${meta.kills[k] ?? 0}</dd>`).join('');
    sheet.innerHTML = `<div class="gg-sh-head"><b>순찰 기록</b><button class="gg-tb" data-act="close">닫기</button></div>
      <div class="gg-sh-body"><dl class="gg-rec">
        <dt>가장 깊은 순찰</dt><dd>${meta.best}</dd><dt>마친 순찰</dt><dd>${meta.patrols}</dd><dt>후퇴</dt><dd>${meta.wipes}</dd>
        <dt class="gg-sec">처치</dt>${kills}</dl></div>`;
  };

  root.addEventListener('click', (ev) => {
    const t = (ev.target as HTMLElement).closest<HTMLElement>('button');
    if (!t || !run) return;
    const act = t.dataset.act;
    if (act === 'squad') return openSquad();
    if (act === 'rec') return openRecord();
    if (act === 'close') return void (sheet.hidden = true);
    if (act === 'apply' && picking.length === 4) {
      applySquad(run, meta, picking);
      dirty = true;
      cardKey = topKey = '';
      sheet.hidden = true;
      return;
    }
    if (t.dataset.pick) {
      const id = t.dataset.pick as AgentId;
      if (picking.includes(id)) picking = picking.filter((x) => x !== id);
      else if (picking.length < 4) picking.push(id);
      return drawSquadSheet();
    }
    if (t.dataset.uid) trigger(run, Number(t.dataset.uid));
  });

  const unwait = host.onWaiting((w) => (speed = w ? TUNE.waitingSpeed : 1));

  // ---- 진행 ----
  let acc = 0;
  let prev = 0;
  let uiT = 0;
  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!run || document.hidden) {
      prev = now;
      return;
    }
    const dt = Math.min(0.25, prev ? (now - prev) / 1000 : 0);
    prev = now;
    acc += dt * speed;
    while (acc >= STEP) {
      acc -= STEP;
      if (step(run, meta, STEP, renderer.w).changed) dirty = true;
    }
    renderer.draw(run);
    uiT += dt;
    if (uiT > 0.1) {
      uiT = 0;
      drawTop();
      drawCards();
      save();
    }
  };

  void (async () => {
    try {
      const [raw] = await Promise.all([host.load().catch(() => null), renderer.load()]);
      if (disposed) return;
      meta = readMeta(raw);
      run = lastRun && lastRun.squad === meta.squad.join() ? lastRun.run : newRun(meta);
      $('.gg-load').remove();
      fit();
      drawTop();
      drawCards();
      raf = requestAnimationFrame(frame);
    } catch {
      if (!disposed) $('.gg-load').textContent = '그림을 불러오지 못했습니다';
    }
  })();

  return () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    ro.disconnect();
    unwait();
    if (run) lastRun = { run, squad: meta.squad.join() };
    save(true);
    style.remove();
    root.remove();
  };
}
