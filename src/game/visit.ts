import type { GameVisit, VisitState } from './bridge';

const rooms: Record<string, string> = { office: '사무실', lounge: '휴게실', infirmary: '의무실', quarters: '숙소' };
/** Presentation only. Prompt construction, model calls and chat writes live in the host. */
export function mountVisit(root: HTMLElement, api: GameVisit) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:45;font:16px sans-serif;color:#eee';
  const button = document.createElement('button');
  button.textContent = '본부 인물 · 대화';
  button.style.cssText = 'position:absolute;right:16px;top:76px;pointer-events:auto;padding:12px;background:#1b292b;color:#eee;border:1px solid #a99c78;border-radius:6px';
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', '본부 방문 대화');
  panel.style.cssText = 'position:absolute;inset:12% 5% 5%;background:#111c20f5;padding:20px;pointer-events:auto;display:none;overflow:auto;border:1px solid #a99c78;border-radius:8px';
  panel.innerHTML = '<header style="display:flex;justify-content:space-between"><b>본부 인물</b><button data-close>닫기</button></header><p>대화는 이 채팅에 저장되어 본편에서도 이어집니다.</p><div data-people></div><p role="status"></p><div data-log style="white-space:pre-wrap;max-height:42vh;overflow:auto"></div><form style="display:flex;gap:8px"><select aria-label="대화 모델"><option value="main">메인 모델</option><option value="aux">보조 모델</option></select><input aria-label="요원에게 할 말" maxlength="2000" style="flex:1;min-width:0" autocomplete="off"><button type="submit">보내기</button></form>';
  wrap.append(button, panel); root.append(wrap);
  let state: VisitState = { agents: [], turns: [] };
  let selected = '';
  let busy = false;
  let dead = false;
  const status = panel.querySelector<HTMLElement>('[role=status]')!;
  const input = panel.querySelector('input')!;
  const form = panel.querySelector('form')!;
  const people = panel.querySelector<HTMLElement>('[data-people]')!;
  const log = panel.querySelector<HTMLElement>('[data-log]')!;
  const submit = form.querySelector('button')!;
  const render = () => {
    people.replaceChildren();
    for (const a of state.agents) {
      const b = document.createElement('button');
      b.textContent = `${a.name} · ${a.room ? rooms[a.room] || a.room : '부재/위치 미확인'} (${a.state})`;
      b.disabled = busy || !a.room;
      b.setAttribute('aria-pressed', String(a.id === selected));
      b.style.cssText = `margin:3px;padding:8px;background:${a.id === selected ? '#3c5551' : '#263237'};color:#eee;border:1px solid #75817b`;
      b.onclick = () => { selected = a.id; render(); input.focus(); };
      people.append(b);
    }
    log.textContent = state.turns.filter(t => t.agentId === selected).map(t => `나: ${t.user}\n${t.name}: ${t.reply}`).join('\n\n');
    log.scrollTop = log.scrollHeight;
    submit.disabled = busy || !state.agents.some(a => a.id === selected && a.room);
    input.disabled = busy;
  };
  async function open(name?: string) {
    panel.style.display = 'block';
    status.textContent = '본편 상태를 읽는 중…';
    try {
      state = await api.state();
      if (dead) return;
      selected = state.agents.find(a => a.room && (a.name === name || a.id === name))?.id || selected || state.agents.find(a => a.room)?.id || '';
      status.textContent = state.agents.some(a => a.room) ? '' : '본부에 있는 것으로 확인된 요원이 없어요. 본편 상태 태그를 확인해 주세요.';
      render();
    } catch (e) { if (!dead) status.textContent = String(e instanceof Error ? e.message : e); }
  }
  button.onclick = () => void open();
  panel.querySelector<HTMLButtonElement>('[data-close]')!.onclick = () => { panel.style.display = 'none'; };
  // Typing must not trigger engine movement, attacks or E interactions.
  for (const type of ['keydown', 'keyup', 'pointerdown', 'pointerup']) panel.addEventListener(type, e => e.stopPropagation());
  form.onsubmit = async e => {
    e.preventDefault();
    if (busy || !selected || !input.value.trim()) return;
    const text = input.value;
    busy = true; render(); status.textContent = '답변을 기다리는 중…';
    try {
      state = await api.send(selected, text, panel.querySelector('select')!.value === 'aux' ? 'aux' : 'main');
      if (dead) return;
      input.value = ''; status.textContent = '대화를 본편에 기록했어요.';
    } catch (e) { if (!dead) status.textContent = e instanceof Error ? e.message : String(e); }
    finally { busy = false; if (!dead) { render(); input.focus(); } }
  };
  return { open, isOpen: () => panel.style.display !== 'none', dispose: () => { dead = true; wrap.remove(); } };
}
