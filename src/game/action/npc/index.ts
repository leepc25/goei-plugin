// NPC 자유 대화 모듈 입구 (설계안 docs/NPC_자유대화.md).
//   createNpcTalk(layer, host) → { open(target), close, isOpen, relations, dispose }
// 게임 쪽(engine/npcLink.ts)이 누구와 어디서 말하는지(TalkTarget)를 넘기면, 이 모듈이 대화창을 띄우고
// 사용자가 보낼 때만 모델을 부르고, 답의 태그를 판정해 target.onEffect로 돌려준다.
// 모델이 없거나 실패·25초 지연이면 미리 쓴 대사로 대신하고 효과는 없다.
import css from './style.css';
import { evaluate } from '../../../core/cbs';
import { AGENTS } from '../story/lines/agents';
import type { AgentId } from '../story/types';
import { buildPrompt, decide, FAVOR_MAX, FAVOR_MIN, FAVOR_WORD, offlineLine, parseReply, Relations, trimSheet, type AppliedEffect, type MetaInfo, type RelationStore, type TalkModel, type TalkTarget } from './brain';
import { ROSTER, type NpcDef } from './roster';
import SHEETS from './sheets.json';

export * from './brain';
export * from './roster';

export interface NpcHost {
  /** 모델. 없으면 미리 쓴 대사만 */
  model?: TalkModel;
  /** 본편 로어북의 인물 시트 (플러그인). 없거나 null이면 게임에 든 사본 */
  lore?(sheet: string): Promise<string | null>;
  /** 본편 연계 줄 (상태·상황판·최근 장면) */
  meta?(def: NpcDef): Promise<MetaInfo | null>;
  /** 본편 유저 소속 (B00 = 가짜 관리국 쪽). 사본 시트의 CBS를 풀 때 */
  faction?(): string;
  photo?(key: string): string | undefined | Promise<string | undefined>;
  agent(): AgentId;
  /** 본부 일차 (선물 하루 한 번) */
  day?(): number;
  sfx?(name: string): void;
  /** 창이 열리고 닫힐 때 (터치 버튼 숨기기·게임 멈춤) */
  onOpen?(on: boolean): void;
  timeoutMs?: number;
  rng?: () => number;
}

export interface NpcTalk {
  readonly relations: Relations;
  open(t: TalkTarget): void;
  close(): void;
  isOpen(): boolean;
  /** 지금 열린 상대 */
  current(): TalkTarget | null;
  /** 시험용: 입력칸에 쓰고 보낸 것과 같다 */
  send(text: string): Promise<void>;
  /** 판이 끝났을 때: 이름 없는 사람을 잊고 저장 */
  endRun(): void;
  dispose(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** 자주 쓰는 말 단추 (무리마다) */
const CHIPS: Record<NpcDef['group'], string[]> = {
  agent: ['요즘 어때?', '같이 갈래?', '조언 좀 해 줘'],
  hq: ['안녕하세요', '요즘 무슨 일 있어요?', '조언 좀 해 주세요'],
  merchant: ['뭐 팔아요?', '좀 깎아 주세요', '이 층 얘기 좀'],
  daydream: ['우린 싸울 생각 없어', '나눠 갖자', '여기서 꺼져'],
  fake: ['정체가 뭐야', '비켜', '거래하자'],
  faction: ['무슨 일로 왔어요?', '같이 싸울래요?', '정보 좀 줘요'],
  entity: ['안녕하세요', '여기서 나가게 해 주세요', '거래할래요?'],
  elevator: ['안녕하세요', '다음 층은 어디예요?', '외롭지 않아요?'],
  civilian: ['괜찮아요?', '저랑 같이 가요', '여기서 뭘 봤어요?'],
  passenger: ['당신은 누구죠?', '어느 쪽 문이에요?', '도와줄 수 있어요?'],
  resident: ['안녕하세요', '여기 사세요?', '실례했습니다'],
};

const FACE_PX = 44; // 얼굴 칸 132px = 3배 (도트 격자가 딱 맞게)
const FACE_BG = [35, 45, 50];
/** 얼굴 그림을 도트로: 44칸으로 줄이고 가장자리에 이어진 흰 바탕은 패널 색으로 메운다. 읽지 못하는 그림(다른 출처)은 그대로 */
function pixelFace(src: string): Promise<HTMLElement> {
  return new Promise((resolve) => {
    const img = new Image();
    const plain = () => {
      const i = document.createElement('img');
      i.alt = '';
      i.src = src;
      resolve(i);
    };
    img.onerror = plain;
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = FACE_PX;
        const g = c.getContext('2d')!;
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = Math.max(0, (img.naturalHeight - side) * 0.15);
        g.imageSmoothingEnabled = true;
        g.drawImage(img, sx, sy, side, side, 0, 0, FACE_PX, FACE_PX);
        const d = g.getImageData(0, 0, FACE_PX, FACE_PX);
        const a = d.data;
        // 바탕색 = 네 귀퉁이 평균. 그 색에 가까운 가장자리 이어진 칸을 메운다 (흰 바탕·밝은 회색 바탕 모두)
        // 위 두 귀퉁이만 본다 (아래 귀퉁이는 보통 옷)
        const corner = [0, 1, FACE_PX - 2, FACE_PX - 1, FACE_PX, 2 * FACE_PX - 1];
        const ref = [0, 1, 2].map((k) => corner.reduce((t, i) => t + a[i * 4 + k], 0) / corner.length);
        const light = (i: number) => a[i * 4 + 3] < 40 || Math.hypot(a[i * 4] - ref[0], a[i * 4 + 1] - ref[1], a[i * 4 + 2] - ref[2]) < 60;
        const seen = new Uint8Array(FACE_PX * FACE_PX);
        const stack: number[] = [];
        for (let k = 0; k < FACE_PX; k++) stack.push(k, (FACE_PX - 1) * FACE_PX + k, k * FACE_PX, k * FACE_PX + FACE_PX - 1);
        // 밝은 바탕일 때만 (어두운 귀퉁이는 머리카락일 수 있다)
        if (ref[0] * 0.3 + ref[1] * 0.59 + ref[2] * 0.11 < 150) stack.length = 0;
        while (stack.length) {
          const i = stack.pop()!;
          if (seen[i] || !light(i)) continue;
          seen[i] = 1;
          a.set([...FACE_BG, 255], i * 4);
          const x = i % FACE_PX;
          if (x > 0) stack.push(i - 1);
          if (x < FACE_PX - 1) stack.push(i + 1);
          if (i >= FACE_PX) stack.push(i - FACE_PX);
          if (i < FACE_PX * (FACE_PX - 1)) stack.push(i + FACE_PX);
        }
        // 색을 계단으로 (매끈한 그라데이션 대신 도트 색면)
        for (let i = 0; i < a.length; i += 4) for (let k = 0; k < 3; k++) a[i + k] = Math.min(255, Math.round(a[i + k] / 16) * 16);
        g.putImageData(d, 0, 0);
        resolve(c);
      } catch {
        plain(); // 다른 출처 그림이라 픽셀을 못 읽음
      }
    };
    img.src = src;
  });
}

export function createNpcTalk(layer: HTMLElement, host: NpcHost, store?: RelationStore): NpcTalk {
  const style = document.createElement('style');
  style.textContent = css;
  layer.append(style);
  const el = document.createElement('div');
  el.className = 'gnp gk-panel gk-font';
  el.hidden = true;
  el.innerHTML = `<div class="gnp-face gk-face"></div><div class="gnp-body"><div class="gnp-head"><b class="gnp-name"></b><span class="gnp-favor"></span><span class="gnp-state"></span><button type="button" class="gnp-x" data-x aria-label="닫기">✕</button></div><div class="gnp-log" aria-live="polite"></div><div class="gnp-row"><div class="gnp-chips"></div></div><div class="gnp-say"><div class="gnp-acts"></div><input class="gnp-in gk-font" maxlength="200" placeholder="직접 말하기 (T)" enterkeyhint="send" autocomplete="off"><button type="button" class="gnp-send gk-font" data-send>보내기</button></div><div class="gnp-note"></div></div>`;
  layer.append(el);
  const $ = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const face = $('.gnp-face');
  const nameEl = $('.gnp-name');
  const favorEl = $('.gnp-favor');
  const stateEl = $('.gnp-state');
  const log = $('.gnp-log');
  const acts = $('.gnp-acts');
  const chips = $('.gnp-chips');
  const input = $<HTMLInputElement>('.gnp-in');
  const sendBtn = $<HTMLButtonElement>('.gnp-send');
  const note = $('.gnp-note');
  const relations = new Relations(store);
  const rng = host.rng ?? Math.random;

  let target: TalkTarget | null = null;
  let def: NpcDef | null = null;
  let busy = false;
  let hinted = new Set<string>();
  let token = 0;
  let sheetCache = new Map<string, string | null>();

  const keyOf = (t: TalkTarget) => t.key ?? t.npc;
  const rel = () => relations.get(keyOf(target!), !!target!.key);

  const line = (cls: '' | 'me' | 'sys' | 'wait', text: string) => {
    const p = document.createElement('p');
    if (cls) p.className = cls;
    p.textContent = text;
    log.append(p);
    while (log.childElementCount > 40) log.firstElementChild!.remove();
    fitLog();
    return p;
  };
  /** 대화 줄은 위에서부터, 넘치면 오래된 윗줄을 통째로 감춘다 (반쯤 잘린 줄이 남지 않게).
   *  폰에서 입력하는 동안(창이 위로, 아래는 키보드)은 마지막 주고받은 것(내 말·상대 말·결과 줄)만 보인다 */
  const fitLog = () => {
    const ps = [...log.children] as HTMLElement[];
    for (const q of ps) q.hidden = false;
    if (el.classList.contains('typing')) {
      let from = -1;
      ps.forEach((q, i) => q.classList.contains('me') && (from = i));
      if (from < 0) from = Math.max(0, ps.length - 1);
      ps.forEach((q, i) => (q.hidden = i < from));
    }
    for (let i = 0; i < ps.length - 1 && log.scrollHeight > log.clientHeight + 1; i++) ps[i].hidden = true;
  };

  const drawFavor = () => {
    if (!target) return;
    const f = rel().favor;
    let h = '';
    // 왼쪽 세 칸 = 미움(붉은), 가운데 금 = 0, 오른쪽 세 칸 = 호감(금빛)
    for (let v = FAVOR_MIN; v <= FAVOR_MAX; v++) h += v ? `<i class="${v > 0 && f >= v ? 'up' : v < 0 && f <= v ? 'down' : v < 0 ? 'neg' : ''}"></i>` : '<b></b>';
    favorEl.innerHTML = h;
    favorEl.title = `호감 ${FAVOR_WORD(f)}`;
    stateEl.textContent = `호감 ${FAVOR_WORD(f)} ${f > 0 ? '+' : ''}${f}`;
  };

  const drawActs = () => {
    const list = target?.actions ?? [];
    acts.hidden = !list.length;
    acts.innerHTML = list.map((a, i) => `<button type="button" class="gk-btn${i === 0 ? ' on' : ''}" data-act="${i}"><b>${i === 0 ? 'E' : i + 1}</b>${esc(a.label)}</button>`).join('');
  };

  const setBusy = (on: boolean) => {
    busy = on;
    sendBtn.disabled = on;
    el.classList.toggle('busy', on);
  };

  async function sheetText(d: NpcDef): Promise<string | undefined> {
    if (!d.sheet) return undefined;
    if (sheetCache.has(d.sheet)) return sheetCache.get(d.sheet) ?? undefined;
    let text: string | null = null;
    try {
      const live = await host.lore?.(d.sheet);
      if (live) text = trimSheet(live);
    } catch {
      /* 본편 로어북을 못 읽으면 사본 */
    }
    if (!text) {
      const raw = (SHEETS as Record<string, string>)[d.sheet];
      text = raw ? evaluate(raw, { vars: { $st_faction: host.faction?.() ?? '' } }) : null;
    }
    sheetCache.set(d.sheet, text);
    return text ?? undefined;
  }

  const close = () => {
    if (!target) return;
    const t = target;
    target = null;
    def = null;
    token++;
    setBusy(false);
    el.hidden = true;
    input.blur();
    relations.save();
    window.removeEventListener('keydown', keys, true);
    host.onOpen?.(false);
    t.onClose?.();
  };

  const apply = (effects: AppliedEffect[]) => {
    const t = target!;
    for (const e of effects) {
      if (e.note) line('sys', e.note);
      if (e.kind === 'join' || e.kind === 'hostile' || e.kind === 'trade' || e.kind === 'gift') relations.remember(keyOf(t), `${e.kind === 'join' ? '함께 가기로 했다' : e.kind === 'hostile' ? '싸웠다' : e.kind === 'trade' ? '거래했다' : '물건을 줬다'}`);
    }
    drawFavor();
    // 효과는 대사를 읽을 틈을 준 뒤에. 떠남·적대·거래·동행은 대화창을 닫는다
    const closing = effects.some((e) => e.kind === 'hostile' || e.kind === 'leave' || e.kind === 'join' || e.kind === 'trade');
    const fire = () => {
      for (const e of effects) {
        if (e.kind === 'trade') t.actions?.find((a) => a.id === 'trade')?.run();
        t.onEffect?.(e);
      }
    };
    if (!effects.length) return;
    if (closing) {
      const my = token;
      setBusy(true);
      setTimeout(() => {
        if (my !== token) return;
        close();
        fire();
      }, 1400);
    } else fire();
  };

  async function send(textIn: string) {
    const text = textIn.trim().slice(0, 200);
    if (!text || !target || busy) return;
    const t = target;
    const d = def!;
    const r = rel();
    const my = token;
    line('me', text);
    chips.hidden = true; // 말 꺼내기 예시는 처음에만
    markSel();
    const wait = line('wait', '…');
    setBusy(true);
    note.textContent = '';
    let reply = '';
    let effects: AppliedEffect[] = [];
    const model = host.model;
    if (model) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), host.timeoutMs ?? 25000);
      try {
        const a = AGENTS[host.agent()] ?? AGENTS.jyaldi;
        const [sheet, meta] = await Promise.all([sheetText(d), host.meta?.(d).catch(() => null)]);
        const messages = buildPrompt({ def: d, target: t, sheet, agent: { id: a.id, name: a.name, title: a.title, voice: a.voice }, rel: r, meta, text });
        const raw = await Promise.race([
          model(messages, { signal: ctrl.signal }),
          new Promise<never>((_, rej) => ctrl.signal.addEventListener('abort', () => rej(new Error('응답이 25초 넘게 없어요')))),
        ]);
        const got = parseReply(raw, t.name ?? d.name);
        if (!got.text) throw new Error('빈 응답');
        reply = got.text;
        if (my === token) effects = decide(got.tags, { def: d, target: t, rel: r, hinted, day: host.day?.() ?? 0 });
      } catch (e) {
        reply = offlineLine(d, text, rng);
        if (my === token) note.textContent = `모델 응답 실패: ${(e instanceof Error ? e.message : String(e)).slice(0, 80)} · 미리 쓴 대사로 대신했어요`;
      } finally {
        clearTimeout(timer);
      }
    } else reply = offlineLine(d, text, rng);
    if (my !== token) return; // 기다리는 동안 닫았다
    wait.className = '';
    wait.textContent = reply;
    fitLog();
    r.met++;
    r.log = [...r.log, { role: 'user' as const, content: text }, { role: 'assistant' as const, content: reply }].slice(-12);
    setBusy(false);
    apply(effects);
    relations.save();
  }

  const runAct = (i: number) => {
    const a = target?.actions?.[i];
    if (!a || busy) return;
    if (!a.keep) close();
    a.run();
  };

  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    if (b.dataset.x !== undefined) return close();
    if (b.dataset.send !== undefined) {
      const v = input.value;
      input.value = '';
      return void send(v);
    }
    if (b.dataset.act !== undefined) return runAct(Number(b.dataset.act));
    if (b.dataset.chip !== undefined) return void send(b.textContent ?? '');
  });
  // 리스 플러그인 창은 form 제출이 막혀 있다(allow-forms 없음). 그래서 form 없이 Enter를 직접 받는다
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.isComposing || e.keyCode === 229) return; // 한글 조합 중 Enter
    if (e.key === 'Enter') {
      e.preventDefault();
      const v = input.value;
      if (!v.trim()) return input.blur();
      input.value = '';
      void send(v);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      input.blur();
    }
  });
  // 폰: 입력하는 동안 창을 위로 올리고 입력칸을 이름 바로 아래에 둔다 (소프트 키보드가 아래 절반을 덮는다)
  input.addEventListener('focus', () => el.classList.contains('coarse') && (el.classList.add('typing'), fitLog()));
  input.addEventListener('blur', () => (el.classList.remove('typing'), fitLog()));
  for (const ev of ['keyup', 'pointerdown', 'touchstart', 'wheel'] as const) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });

  /** 창이 열린 동안 키: E·Space 첫 버튼, 1~9 버튼, Enter·T 입력칸, Esc 닫기. 게임으로는 안 넘긴다 */
  /** 키보드로 고르는 단추 (사용자 2026-10-25: 키보드가 안 먹는다) — 말 꺼내기 예시 + 행동 + 입력칸 */
  let sel = 0;
  const pickables = (): HTMLElement[] => [...(chips.hidden ? [] : [...chips.querySelectorAll<HTMLElement>('button')]), ...acts.querySelectorAll<HTMLElement>('button'), input];
  const markSel = () => {
    const list = pickables();
    sel = Math.max(0, Math.min(list.length - 1, sel));
    list.forEach((b, i) => b.classList.toggle('gnp-sel', i === sel));
  };
  function keys(e: KeyboardEvent) {
    if (!target || document.activeElement === input) return;
    const k = e.code;
    const list = pickables();
    if (k === 'Escape') close();
    else if (k === 'ArrowLeft' || k === 'ArrowUp') (sel = (sel - 1 + list.length) % list.length), markSel();
    else if (k === 'ArrowRight' || k === 'ArrowDown' || k === 'Tab') (sel = (sel + 1) % list.length), markSel();
    else if (k === 'KeyE') runAct(0); // 단추에 적힌 대로 E = 첫 행동
    else if (k === 'Enter' || k === 'Space') {
      if (e.repeat) return e.preventDefault();
      const b = list[sel];
      if (!b || b === input) input.focus({ preventScroll: true });
      else b.click();
    } else if (/^Digit[1-9]$/.test(k)) runAct(Number(k.slice(5)) - 1);
    else if (k === 'KeyT' || k === 'Slash') input.focus({ preventScroll: true });
    else return;
    e.preventDefault();
    e.stopImmediatePropagation();
  }

  const open = (t: TalkTarget) => {
    const d = ROSTER[t.npc];
    if (!d) return void console.warn('[goei] 대화 상대 없음:', t.npc);
    if (target) close();
    target = t;
    def = d;
    hinted = new Set();
    token++;
    setBusy(false);
    el.style.setProperty('--who', d.color);
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    el.classList.toggle('coarse', coarse);
    input.placeholder = coarse ? '직접 말하기' : '직접 말하기 (T · 방향키로 고르고 Enter)';
    nameEl.textContent = t.name ?? d.name;
    // 얼굴 그림이 있는 사람만 얼굴 칸 (없으면 글자 상자 대신 칸을 접는다)
    face.innerHTML = '';
    face.hidden = true;
    if (d.photo && host.photo) {
      const my = token;
      void Promise.resolve(host.photo(d.photo)).then((src) => {
        if (src && my === token) void pixelFace(src).then((node) => my === token && (face.replaceChildren(node), (face.hidden = false)));
      });
    }
    log.innerHTML = '';
    note.textContent = host.model ? '' : '모델 연결 없음 · 미리 쓴 대사로 답해요';
    const g = t.greet ?? d.greet[Math.floor(rng() * d.greet.length) % d.greet.length];
    if (g) line('', g);
    for (const n of t.notes ?? []) line('sys', n);
    drawFavor();
    drawActs();
    chips.hidden = false;
    chips.innerHTML = CHIPS[d.group].map((c) => `<button type="button" class="gk-font" data-chip>${esc(c)}</button>`).join('');
    sel = 0;
    markSel();
    el.hidden = false;
    fitLog();
    window.addEventListener('keydown', keys, true);
    host.onOpen?.(true);
    host.sfx?.('panelButton');
  };

  return {
    relations,
    open,
    close,
    isOpen: () => !!target,
    current: () => target,
    send,
    endRun() {
      relations.forgetTemp();
      relations.save();
    },
    dispose() {
      close();
      el.remove();
      style.remove();
      sheetCache = new Map();
    },
  };
}
