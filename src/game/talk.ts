// 본부 방문 대화 화면 (2026-10-22 설계 2판): RPG처럼 머리 위 이름표와 말풍선, 아래 한 줄 입력.
// 요청·모델·저장은 플러그인(host/game/visit.ts)이 한다. 여기는 보이는 것만.
import type { GameField, GameVisit, VisitState } from './bridge';
import { canJoin, classify, fieldCompanions } from '../core/fieldfollow';
import { ensureKit, PIXEL_FONT } from './action/ui/kit';

export interface TalkPerson { name: string; x: number; y: number; top: number }
interface Bubble { who: string; text: string; until: number; pending?: boolean; /** 이때부터 보인다 (끼어든 말은 앞 말 뒤에) */ from?: number }

const FONT = (px: number) => `${px}px "${PIXEL_FONT}", "Galmuri11", sans-serif`;
/** 말을 걸 수 있는 거리 (발 기준 가로). 벗어나면 입력창이 닫힌다 */
const REACH = 150;
const BUBBLE_W = 340;
/** 끼어들 수 있는 거리 (같은 방, 주인공 발 기준 가로) */
const OVERHEAR = 480;

// 모든 것이 도트 (2026-10-23 사용자): 입력창·기록창은 도트 틀(kit의 panel·slot·row), 글꼴은 도트 글꼴
const CSS = `
.gt-bar{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:min(92%,720px);display:none;gap:6px;align-items:center;padding:2px 4px;pointer-events:auto;z-index:46;color:#ece6d4}
.gt-bar.gk-panel,.gt-log.gk-panel{border-width:17px;border-image-width:17px;box-shadow:none!important}
.gt-bar[data-open]{display:flex;flex-wrap:wrap}
.gt-to{font-size:18px;color:#ffe27a;white-space:nowrap;text-shadow:2px 2px 0 #000}
.gt-in{flex:1;min-width:120px;font:inherit;font-size:20px;padding:2px 6px;background:none;color:#fff;outline:none;border-width:7px;border-image-width:7px;text-shadow:2px 2px 0 #000}
.gt-in::placeholder{color:#8b8574}
.gt-bar .gk-btn.gt-mode{min-width:3.4em;text-align:center}
.gt-bar[data-act] .gk-btn.gt-mode{background:#3a2f4a;color:#e6c8ff;box-shadow:0 -3px 0 0 #9b7bc4,0 3px 0 0 #9b7bc4,-3px 0 0 0 #9b7bc4,3px 0 0 0 #9b7bc4,0 6px 0 0 rgba(0,0,0,.55)}
.gt-bar[data-act] .gt-in{font-style:italic}
.gt-in:focus,.gt-in:focus-visible{outline:none;box-shadow:none}
/* 단추: 모서리를 한 칸 깎은 도트 단추 (kit의 메뉴 줄 판은 이 크기에서 찌그러진다) */
.gt-bar .gk-btn,.gt-bar .gk-btn:hover,.gt-bar .gk-btn:focus-visible{font-size:18px;line-height:1;padding:6px 10px;margin:0 3px;border:0;border-image:none;background:#2b2620;color:#d8d0bc;box-shadow:0 -3px 0 0 #6e6350,0 3px 0 0 #6e6350,-3px 0 0 0 #6e6350,3px 0 0 0 #6e6350,0 6px 0 0 rgba(0,0,0,.55)}
.gt-bar .gk-btn:hover,.gt-bar .gk-btn:focus-visible{background:#3d3428;color:#ffe27a;box-shadow:0 -3px 0 0 #c9a74a,0 3px 0 0 #c9a74a,-3px 0 0 0 #c9a74a,3px 0 0 0 #c9a74a,0 6px 0 0 rgba(0,0,0,.55);outline:none}
.gt-bar .gk-btn:active{transform:translateY(3px);box-shadow:0 -3px 0 0 #c9a74a,0 3px 0 0 #c9a74a,-3px 0 0 0 #c9a74a,3px 0 0 0 #c9a74a}
.gt-bar .gk-btn:disabled{opacity:.4;cursor:default}
.gt-msg{flex-basis:100%;font-size:16px;color:#ff9a8a;text-shadow:2px 2px 0 #000}
.gt-msg:empty{display:none}
.gt-log{position:absolute;left:50%;bottom:84px;transform:translateX(-50%);width:min(92%,720px);max-height:45%;overflow:auto;display:none;padding:4px 8px;pointer-events:auto;z-index:46;font-size:18px;line-height:1.6;color:#ece6d4;white-space:pre-wrap;text-shadow:2px 2px 0 #000}
.gt-log[data-open]{display:block}
`;

export function mountTalk(root: HTMLElement, api: GameVisit, field?: GameField) {
  ensureKit();
  const st = document.createElement('style');
  st.textContent = CSS;
  const bar = document.createElement('div');
  bar.className = 'gt-bar gk-panel gk-font';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', '본부 대화');
  bar.innerHTML = '<span class="gt-to"></span><button type="button" class="gk-btn gt-mode" data-mode aria-label="말로 보내기 (Tab: 행동으로 바꾸기)">말</button><input class="gt-in gk-slot gk-font" aria-label="할 말" placeholder="할 말" maxlength="300" autocomplete="off" enterkeyhint="send"><button type="button" class="gk-btn" data-send>말하기</button><button type="button" class="gk-btn" data-log>기록</button><button type="button" class="gk-btn" data-close aria-label="대화 닫기">닫기</button><div class="gt-msg" role="status"></div>';
  const log = document.createElement('div');
  log.className = 'gt-log gk-panel gk-font';
  log.setAttribute('aria-label', '이번 대화 기록');
  root.append(st, bar, log);
  const to = bar.querySelector<HTMLElement>('.gt-to')!;
  const input = bar.querySelector<HTMLInputElement>('.gt-in')!;
  const sendBtn = bar.querySelector<HTMLButtonElement>('[data-send]')!;
  const modeBtn = bar.querySelector<HTMLButtonElement>('[data-mode]')!;
  // 말·행동 전환 (2026-10-23 사용자: 입력하면서 별표 치기가 어렵다). 단추나 Tab으로 바꾼다. 별표로 감싸도 행동
  let act = false;
  const setMode = (on: boolean) => {
    act = on;
    bar.toggleAttribute('data-act', on);
    modeBtn.textContent = on ? '행동' : '말';
    modeBtn.setAttribute('aria-label', on ? '행동으로 보내기 (Tab: 말로 바꾸기)' : '말로 보내기 (Tab: 행동으로 바꾸기)');
    input.placeholder = on ? '할 행동 (예: 서류를 건넨다)' : '할 말';
    input.setAttribute('aria-label', on ? '할 행동' : '할 말');
  };
  modeBtn.onclick = () => {
    setMode(!act);
    input.focus();
  };
  const msg = bar.querySelector<HTMLElement>('.gt-msg')!;

  let state: VisitState = { visitor: { agentId: '', name: '' }, agents: [], turns: [] };
  let target = '';
  let busy = false;
  let dead = false;
  const bubbles: Bubble[] = [];
  const me = () => state.visitor.name || '나';
  let seen: { people: TalkPerson[]; player: TalkPerson | null } = { people: [], player: null };
  const say = (who: string, text: string, pending = false, delay = 0) => {
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === who) bubbles.splice(i, 1);
    // 읽을 시간: 4초 + 글자당 0.08초
    const from = performance.now() + delay;
    bubbles.push({ who, text, pending, from, until: pending ? Infinity : from + 4000 + [...text].length * 80 });
  };
  /** 같은 방에서 가까이 있는 다른 요원 id (끼어들 수 있는 사람) */
  const nearby = (target: string): string[] => {
    const p = seen.player;
    if (!p) return [];
    return seen.people
      .filter((q) => q.name !== target && Math.abs(q.x - p.x) < OVERHEAR)
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))
      .map((q) => state.agents.find((a) => a.name === q.name && a.room)?.id ?? '')
      .filter(Boolean);
  };
  const refresh = () => {
    sendBtn.disabled = busy || !target;
    input.disabled = busy;
  };
  const renderLog = () => {
    const agent = state.agents.find((a) => a.name === target);
    const turns = state.turns.filter((t) => t.agentId === agent?.id || t.extra?.some((e) => e.agentId === agent?.id)).slice(-30);
    log.textContent = turns.length ? turns.map((t) => [t.act ? `${t.visitor || me()}: *${t.user}*` : `${t.visitor || me()}: ${t.user}`, `${t.name}: ${t.reply}`, ...(t.extra ?? []).map((e) => `${e.name}: ${e.line}`)].join('\n')).join('\n\n') : '아직 나눈 말이 없어요.';
    log.scrollTop = log.scrollHeight;
  };

  async function open(name: string) {
    target = name;
    msg.textContent = '';
    to.textContent = `${name}에게`;
    bar.setAttribute('data-open', '');
    refresh();
    // 터치 기기는 바로 키패드를 띄우지 않는다: 터치판 대사창 모드의 「선택」(또는 입력칸 누르기)으로 연다 (모바일 조작 설계 2026-10-28)
    if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) input.focus();
    try {
      state = await api.state();
      if (dead) return;
      if (!state.agents.some((a) => a.name === name && a.room)) msg.textContent = '지금 이 요원과는 대화할 수 없어요.';
      if (log.hasAttribute('data-open')) renderLog();
    } catch (e) {
      if (!dead) msg.textContent = e instanceof Error ? e.message : String(e);
    }
  }
  /** 이번 대화창에서 모델과 주고받은 횟수 (닫을 때 1번 이상이면 시계 +대화 분, 필드 세계 16-2) */
  let exchanged = 0;
  function close() {
    if (target && exchanged > 0) window.dispatchEvent(new CustomEvent('goei:talk-closed', { detail: { name: target, exchanged } }));
    exchanged = 0;
    bar.removeAttribute('data-open');
    log.removeAttribute('data-open');
    input.blur();
    target = '';
  }
  /** 「따라와」「기다려」 같은 분명한 부탁은 모델 없이 코드가 장부에 남긴다 (7-2). 애매하면 아무것도 하지 않는다 */
  const followers: string[] = [];
  function follow(agent: { name: string; state?: string }, text: string) {
    if (!field || /^\*/.test(text)) return;
    const want = classify(text);
    if (want === 'follow') {
      const ok = canJoin({ state: agent.state, affinity: 0 });
      if (!ok.ok) { msg.textContent = ok.reason ?? ''; return; }
      if (followers.includes(agent.name)) return;
      followers.push(agent.name);
      const { shown, rest } = fieldCompanions(followers);
      void field.record({ kind: 'follow', text: `${agent.name} started following {user}.`, who: [agent.name], weight: 2, fact: { key: 'companions', value: [...shown, ...(rest.length ? [`(+ ${rest.join(', ')})`] : [])].join(', ') } }).catch(() => {});
    } else if (want === 'wait' || want === 'return') {
      const i = followers.indexOf(agent.name);
      if (i < 0) return;
      followers.splice(i, 1);
      void field.record({ kind: 'unfollow', text: `${agent.name} ${want === 'wait' ? 'stayed behind to wait' : 'went back to their post'}.`, who: [agent.name], weight: 2, fact: { key: 'companions', value: followers.join(', ') || 'none' } }).catch(() => {});
    }
  }
  const send = async () => {
    const raw = input.value.trim();
    const agent = state.agents.find((a) => a.name === target && a.room);
    if (busy || !raw || !agent) return;
    const bare = raw.replace(/^\*+|\*+$/g, '').trim();
    const text = act || /^\*/.test(raw) ? `*${bare}*` : raw;
    if (!bare) return;
    busy = true;
    msg.textContent = '';
    input.value = '';
    say(me(), text);
    say(agent.name, '…', true);
    refresh();
    try {
      state = await api.send(agent.id, text, 'aux', nearby(agent.name));
      if (dead) return;
      exchanged++;
      follow(agent, text);
      const turn = state.turns.filter((t) => t.agentId === agent.id).at(-1);
      say(agent.name, turn?.reply ?? '');
      // 끼어든 말은 앞 말을 읽을 틈을 두고 차례로
      let delay = 0;
      let prev = turn?.reply ?? '';
      for (const e of turn?.extra ?? []) {
        delay += 900 + [...prev].length * 45;
        say(e.name, e.line, false, delay);
        prev = e.line;
      }
      if (log.hasAttribute('data-open')) renderLog();
    } catch (e) {
      if (dead) return;
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === agent.name) bubbles.splice(i, 1);
      msg.textContent = e instanceof Error ? e.message : String(e);
      input.value = input.value || raw;
    } finally {
      busy = false;
      refresh();
      if (!dead && bar.hasAttribute('data-open')) input.focus();
    }
  };
  // 내 이름표가 처음부터 주인공 이름이게 (입력창을 열기 전에도)
  void api.state().then((v) => { if (!dead && !busy) state = v; }).catch(() => {});
  sendBtn.onclick = () => void send();
  // Risu 플러그인 창은 form submit이 막혀 있다: 버튼과 Enter로 보낸다 (한글 조합 중 Enter 제외)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void send(); }
    if (e.key === 'Tab' && !e.isComposing) { e.preventDefault(); setMode(!act); }
    if (e.key === 'Escape') close();
  });
  bar.querySelector<HTMLButtonElement>('[data-close]')!.onclick = close;
  bar.querySelector<HTMLButtonElement>('[data-log]')!.onclick = () => {
    if (log.toggleAttribute('data-open')) renderLog();
  };
  // 입력 중 글자가 게임 이동·E로 새지 않게
  for (const el of [bar, log]) for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup']) el.addEventListener(type, (e) => e.stopPropagation());

  /** 장면 그리기 끝에 부른다 (월드 좌표). people = 이 방 요원, player = 주인공 발 위치 */
  function draw(c: CanvasRenderingContext2D, people: TalkPerson[], player: TalkPerson | null) {
    const now = performance.now();
    seen = { people, player };
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].until < now) bubbles.splice(i, 1);
    const all = [...people, ...(player ? [{ ...player, name: me() }] : [])];
    // 멀어지면 입력창을 닫는다
    if (target && player && !busy) {
      const p = people.find((q) => q.name === target);
      if (!p || Math.abs(p.x - player.x) > REACH * 1.6) close();
    }
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // 가까이 선 사람끼리 이름표·말풍선이 겹치지 않게: 아래(발이 앞)인 사람부터 놓고, 겹치면 위로 올린다
    const placed: { l: number; r: number; t: number; b: number }[] = [];
    const place = (cx: number, w: number, h: number, bottom: number) => {
      let b = bottom;
      for (let guard = 0; guard < 20; guard++) {
        const hit = placed.find((q) => cx - w / 2 < q.r && cx + w / 2 > q.l && b - h < q.b && b > q.t);
        if (!hit) break;
        b = hit.t - 4;
      }
      placed.push({ l: cx - w / 2, r: cx + w / 2, t: b - h, b });
      return b;
    };
    for (const p of [...all].sort((a, b) => b.y - a.y)) {
      const isPlayer = !!player && p.name === me() && p.x === player.x;
      const near = !!player && !isPlayer && Math.abs(p.x - player.x) < REACH && Math.abs(p.y - player.y) < 80;
      const x = Math.round(p.x);
      c.font = FONT(TAG_PX);
      const tw = Math.ceil(c.measureText(p.name).width) + 8;
      const tagBottom = place(x, tw, 18, Math.round(p.y + p.top));
      // 지금 조작하는 주인공은 이름표를 달지 않는다 (사용자 2026-10-25). 자리만 잡아 말풍선을 머리 위에 띄운다
      if (!isPlayer) tag(c, p.name, x, tagBottom - 9, near || p.name === target);
      // 내가 입력하는 동안 내 머리 위에 움직이는 점 (말을 보내면 그 말로 바뀐다)
      const typing = isPlayer && !busy && bar.hasAttribute('data-open') && document.activeElement === input && input.value.trim() !== '';
      const b = bubbles.find((q) => q.who === p.name && (q.from ?? 0) <= now) ?? (typing ? { who: p.name, text: '', until: Infinity, pending: true } : undefined);
      if (b) {
        const size = bubbleSize(c, b, now);
        const bottom = place(x, size.w + 4, size.h + 16, tagBottom - 20);
        bubble(c, size, x, bottom);
      }
    }
    c.restore();
  }

  return {
    open: (name: string) => void open(name),
    isOpen: () => bar.hasAttribute('data-open'),
    close,
    draw,
    dispose() {
      dead = true;
      st.remove();
      bar.remove();
      log.remove();
    },
  };
}

/** 도트 한 칸 (게임 그림 배율 2.75에 맞춰 3) */
const U = 3;

/** 도트 상자: 모서리 한 칸씩 깎은 테두리 + 아래 그림자 */
function pixelBox(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, line: string, shadow = true) {
  x = Math.round(x / U) * U;
  y = Math.round(y / U) * U;
  w = Math.ceil(w / U) * U;
  h = Math.ceil(h / U) * U;
  if (shadow) {
    c.fillStyle = 'rgba(0,0,0,.45)';
    c.fillRect(x + U, y + h, w - U, U);
    c.fillRect(x + w, y + U, U, h);
  }
  c.fillStyle = line;
  c.fillRect(x + U, y, w - 2 * U, h);
  c.fillRect(x, y + U, w, h - 2 * U);
  c.fillStyle = fill;
  c.fillRect(x + 2 * U, y + U, w - 4 * U, h - 2 * U);
  c.fillRect(x + U, y + 2 * U, w - 2 * U, h - 4 * U);
  return { x, y, w, h };
}

/** 이름표: 상자 없이 작은 글씨와 어두운 테두리만 (2026-10-23 사용자: 투박하다, 튀지 않게) */
const TAG_PX = 12;
function tag(c: CanvasRenderingContext2D, name: string, x: number, y: number, bright: boolean) {
  c.font = FONT(TAG_PX);
  c.fillStyle = 'rgba(0,0,0,.75)';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) c.fillText(name, x + dx, y + dy);
  c.fillStyle = bright ? '#ece6d6' : 'rgba(206,200,186,.72)';
  c.fillText(name, x, y);
}

function wrap(c: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of [...text]) {
    if (c.measureText(cur + ch).width > max && cur) {
      // 띄어쓰기에서 끊을 수 있으면 거기서
      const sp = cur.lastIndexOf(' ');
      if (sp > cur.length / 2) { lines.push(cur.slice(0, sp)); cur = cur.slice(sp + 1) + ch; } else { lines.push(cur); cur = ch; }
    } else cur += ch;
  }
  if (cur) lines.push(cur);
  return lines;
}

type BubbleSize = { lines: string[]; w: number; h: number };
const LH = 30;
function bubbleSize(c: CanvasRenderingContext2D, b: Bubble, now: number): BubbleSize {
  c.font = FONT(22);
  const text = b.pending ? '.'.repeat(1 + (Math.floor(now / 350) % 3)) : b.text;
  const lines = wrap(c, text, BUBBLE_W - 28);
  const w = Math.min(BUBBLE_W, Math.max(64, ...lines.map((l) => Math.ceil(c.measureText(l).width))) + 28);
  return { lines, w, h: lines.length * LH + 20 };
}

/** bottom = 꼬리 끝. 도트 상자 + 계단 꼬리 */
function bubble(c: CanvasRenderingContext2D, s: BubbleSize, x: number, bottom: number) {
  c.font = FONT(22);
  const { lines, w, h } = s;
  const box = pixelBox(c, x - w / 2, bottom - h - 4 * U, w, h, '#f4efe2', '#14110d');
  const tx = Math.round(x / U) * U;
  const ty = box.y + box.h - U;
  // 꼬리: 세 칸 계단 (테두리 한 칸)
  for (let i = 0; i < 3; i++) {
    const half = (3 - i) * U;
    c.fillStyle = '#14110d';
    c.fillRect(tx - half - U, ty + i * U, (half + U) * 2, U);
    c.fillStyle = '#f4efe2';
    c.fillRect(tx - half, ty + i * U, half * 2, U);
  }
  c.fillStyle = '#14110d';
  c.fillRect(tx - U, ty + 3 * U, 2 * U, U);
  c.fillStyle = '#1b1712';
  lines.forEach((l, i) => c.fillText(l, x, box.y + 10 + LH / 2 + i * LH + 1));
}
