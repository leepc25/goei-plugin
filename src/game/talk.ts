// 본부 방문 대화 화면 (2026-10-22 설계 2판): RPG처럼 머리 위 이름표와 말풍선, 아래 한 줄 입력.
// 요청·모델·저장은 플러그인(host/game/visit.ts)이 한다. 여기는 보이는 것만.
import type { GameVisit, VisitState } from './bridge';
import { ensureKit, PIXEL_FONT } from './action/ui/kit';

export interface TalkPerson { name: string; x: number; y: number; top: number }
interface Bubble { who: string; text: string; until: number; pending?: boolean }

const FONT = (px: number) => `${px}px "${PIXEL_FONT}", "Galmuri11", sans-serif`;
/** 말을 걸 수 있는 거리 (발 기준 가로). 벗어나면 입력창이 닫힌다 */
const REACH = 150;
const BUBBLE_W = 340;

const CSS = `
.gt-bar{position:absolute;left:50%;bottom:12px;transform:translateX(-50%);width:min(92%,760px);display:none;gap:8px;align-items:center;padding:10px;background:#0d1417ee;border:2px solid #a99c78;pointer-events:auto;z-index:46;font-family:"${PIXEL_FONT}","Galmuri11",sans-serif;color:#ece6d4;-webkit-font-smoothing:none}
.gt-bar[data-open]{display:flex;flex-wrap:wrap}
.gt-to{font-size:16px;color:#ffd27a;white-space:nowrap}
.gt-in{flex:1;min-width:120px;font:inherit;font-size:18px;padding:8px 10px;background:#05090b;color:#fff;border:2px solid #5b6a72;outline:none}
.gt-in:focus{border-color:#ffd27a}
.gt-bar button{font:inherit;font-size:16px;padding:8px 12px;background:#1b292b;color:#ece6d4;border:2px solid #75817b;cursor:pointer}
.gt-bar button:disabled{opacity:.45;cursor:default}
.gt-msg{flex-basis:100%;font-size:14px;color:#ff9a8a;min-height:0}
.gt-msg:empty{display:none}
.gt-log{position:absolute;left:50%;bottom:76px;transform:translateX(-50%);width:min(92%,760px);max-height:45%;overflow:auto;display:none;padding:12px 14px;background:#0d1417f2;border:2px solid #a99c78;pointer-events:auto;z-index:46;font-family:"${PIXEL_FONT}","Galmuri11",sans-serif;font-size:16px;line-height:1.6;color:#ece6d4;white-space:pre-wrap}
.gt-log[data-open]{display:block}
`;

export function mountTalk(root: HTMLElement, api: GameVisit) {
  ensureKit();
  const st = document.createElement('style');
  st.textContent = CSS;
  const bar = document.createElement('div');
  bar.className = 'gt-bar';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', '본부 대화');
  bar.innerHTML = '<span class="gt-to"></span><input class="gt-in" aria-label="할 말" maxlength="300" autocomplete="off" enterkeyhint="send"><button type="button" data-send>말하기</button><button type="button" data-log>기록</button><button type="button" data-close aria-label="대화 닫기">닫기</button><div class="gt-msg" role="status"></div>';
  const log = document.createElement('div');
  log.className = 'gt-log';
  log.setAttribute('aria-label', '이번 대화 기록');
  root.append(st, bar, log);
  const to = bar.querySelector<HTMLElement>('.gt-to')!;
  const input = bar.querySelector<HTMLInputElement>('.gt-in')!;
  const sendBtn = bar.querySelector<HTMLButtonElement>('[data-send]')!;
  const msg = bar.querySelector<HTMLElement>('.gt-msg')!;

  let state: VisitState = { visitor: { agentId: '', name: '' }, agents: [], turns: [] };
  let target = '';
  let busy = false;
  let dead = false;
  const bubbles: Bubble[] = [];
  const me = () => state.visitor.name || '나';
  const say = (who: string, text: string, pending = false) => {
    for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === who) bubbles.splice(i, 1);
    // 읽을 시간: 4초 + 글자당 0.08초
    bubbles.push({ who, text, pending, until: pending ? Infinity : performance.now() + 4000 + [...text].length * 80 });
  };
  const refresh = () => {
    sendBtn.disabled = busy || !target;
    input.disabled = busy;
  };
  const renderLog = () => {
    const agent = state.agents.find((a) => a.name === target);
    const turns = state.turns.filter((t) => t.agentId === agent?.id).slice(-30);
    log.textContent = turns.length ? turns.map((t) => `${t.visitor || me()}: ${t.user}\n${t.name}: ${t.reply}`).join('\n\n') : '아직 나눈 말이 없어요.';
    log.scrollTop = log.scrollHeight;
  };

  async function open(name: string) {
    target = name;
    msg.textContent = '';
    to.textContent = `${name}에게`;
    bar.setAttribute('data-open', '');
    refresh();
    input.focus();
    try {
      state = await api.state();
      if (dead) return;
      if (!state.agents.some((a) => a.name === name && a.room)) msg.textContent = '지금 이 요원과는 대화할 수 없어요.';
      if (log.hasAttribute('data-open')) renderLog();
    } catch (e) {
      if (!dead) msg.textContent = e instanceof Error ? e.message : String(e);
    }
  }
  function close() {
    bar.removeAttribute('data-open');
    log.removeAttribute('data-open');
    input.blur();
    target = '';
  }
  const send = async () => {
    const text = input.value.trim();
    const agent = state.agents.find((a) => a.name === target && a.room);
    if (busy || !text || !agent) return;
    busy = true;
    msg.textContent = '';
    input.value = '';
    say(me(), text);
    say(agent.name, '…', true);
    refresh();
    try {
      state = await api.send(agent.id, text, 'aux');
      if (dead) return;
      const reply = state.turns.filter((t) => t.agentId === agent.id).at(-1)?.reply ?? '';
      say(agent.name, reply);
      if (log.hasAttribute('data-open')) renderLog();
    } catch (e) {
      if (dead) return;
      for (let i = bubbles.length - 1; i >= 0; i--) if (bubbles[i].who === agent.name) bubbles.splice(i, 1);
      msg.textContent = e instanceof Error ? e.message : String(e);
      input.value = input.value || text;
    } finally {
      busy = false;
      refresh();
      if (!dead && bar.hasAttribute('data-open')) input.focus();
    }
  };
  sendBtn.onclick = () => void send();
  // Risu 플러그인 창은 form submit이 막혀 있다: 버튼과 Enter로 보낸다 (한글 조합 중 Enter 제외)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); void send(); }
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
      c.font = FONT(22);
      const tw = Math.ceil(c.measureText(p.name).width) + 16;
      const tagBottom = place(x, tw, 28, Math.round(p.y + p.top));
      tag(c, p.name, x, tagBottom - 14, near || p.name === target || isPlayer);
      const b = bubbles.find((q) => q.who === p.name);
      if (b) {
        const size = bubbleSize(c, b, now);
        const bottom = place(x, size.w + 4, size.h + 16, tagBottom - 30);
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

function tag(c: CanvasRenderingContext2D, name: string, x: number, y: number, bright: boolean) {
  c.font = FONT(22);
  const w = Math.ceil(c.measureText(name).width) + 16;
  c.fillStyle = bright ? 'rgba(10,14,16,.85)' : 'rgba(10,14,16,.55)';
  c.fillRect(x - w / 2, y - 14, w, 28);
  c.fillStyle = bright ? '#ffd27a' : '#cfc8b4';
  c.fillText(name, x, y + 1);
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

/** bottom = 꼬리 끝 */
function bubble(c: CanvasRenderingContext2D, s: BubbleSize, x: number, bottom: number) {
  c.font = FONT(22);
  const { lines, w, h } = s;
  const left = x - w / 2;
  const top = bottom - h - 12;
  c.fillStyle = '#000';
  c.fillRect(left - 2, top - 2, w + 4, h + 4);
  c.fillStyle = '#f4efe2';
  c.fillRect(left, top, w, h);
  // 꼬리 (도트 계단)
  for (let i = 0; i < 4; i++) {
    c.fillStyle = '#000';
    c.fillRect(x - 10 + i * 2, top + h + i * 3, 16 - i * 4 + 2, 3);
    c.fillStyle = '#f4efe2';
    c.fillRect(x - 8 + i * 2, top + h + i * 3, 12 - i * 4, 3);
  }
  c.fillStyle = '#1b1712';
  lines.forEach((l, i) => c.fillText(l, x, top + 10 + LH / 2 + i * LH + 1));
}
