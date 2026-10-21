// 메뉴 화면: 타이틀·일시정지·설정·조작법·확인창·선택지. 1280×720 층(.gs-ui) 위의 DOM.
// 키보드(↑↓ 고르기, ←→ 값 바꾸기, Enter·Space 결정, Esc 뒤로), 게임패드(스틱·십자, A 결정, B 뒤로), 터치(누르기) 모두 받는다.
export type MenuItem =
  | { type: 'button'; label: string; sub?: string; act: () => void; danger?: boolean; disabled?: boolean }
  | { type: 'toggle'; label: string; get: () => boolean; set: (v: boolean) => void }
  | { type: 'slider'; label: string; get: () => number; set: (v: number) => void; min: number; max: number; step: number; fmt?: (v: number) => string }
  | { type: 'choice'; label: string; options: [string, string][]; get: () => string; set: (v: string) => void }
  | { type: 'head'; label: string }
  | { type: 'html'; html: string };

export interface Screen {
  id: string;
  title?: string;
  sub?: string;
  items: MenuItem[];
  /** 뒤로(Esc·B). 없으면 한 단계 닫기 */
  back?: () => void;
  /** 'title' | 'dialog' | 'panel' */
  look?: 'title' | 'dialog' | 'panel' | 'wide';
  /** 숫자 키로 고르기 (선택지) */
  numbered?: boolean;
  noBack?: boolean;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const focusable = (it: MenuItem) => it.type !== 'head' && it.type !== 'html' && !(it.type === 'button' && it.disabled);

export class Menu {
  private stack: Screen[] = [];
  private focus = 0;
  private el: HTMLElement;
  onChange: (() => void) | null = null;
  /** 메뉴가 열리고 닫힐 때 (터치 버튼 숨기기 등) */
  onOpen: ((open: boolean) => void) | null = null;
  /** 소리 스레드가 메뉴 이동·결정 소리를 붙일 자리 */
  onSound: ((kind: 'move' | 'ok' | 'back') => void) | null = null;
  constructor(private layer: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'mn';
    layer.append(this.el);
    this.el.addEventListener('click', (e) => this.click(e));
    this.el.addEventListener('pointermove', (e) => {
      const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
      if (row && e.pointerType === 'mouse') this.setFocus(Number(row.dataset.i), false);
    });
  }
  get isOpen() {
    return this.stack.length > 0;
  }
  get top(): Screen | null {
    return this.stack[this.stack.length - 1] ?? null;
  }
  open(s: Screen) {
    this.stack.push(s);
    this.focus = this.first();
    this.render();
  }
  replace(s: Screen) {
    this.stack.pop();
    this.open(s);
  }
  back() {
    const s = this.top;
    if (!s || s.noBack) return;
    this.onSound?.('back');
    if (s.back) s.back();
    else this.pop();
  }
  pop() {
    this.stack.pop();
    this.focus = this.first();
    this.render();
  }
  closeAll() {
    this.stack = [];
    this.render();
  }
  /** 화면 내용이 바뀌면 다시 그린다 (초점 유지) */
  refresh() {
    this.render();
  }
  private first() {
    const s = this.top;
    if (!s) return 0;
    const i = s.items.findIndex(focusable);
    return Math.max(0, i);
  }
  private setFocus(i: number, sound = true) {
    if (i === this.focus) return;
    this.focus = i;
    if (sound) this.onSound?.('move');
    this.el.querySelectorAll('[data-i]').forEach((r) => r.classList.toggle('f', Number((r as HTMLElement).dataset.i) === i));
    this.el.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block: 'nearest' });
  }
  private moveFocus(d: number) {
    const s = this.top;
    if (!s) return;
    const n = s.items.length;
    let i = this.focus;
    for (let k = 0; k < n; k++) {
      i = (i + d + n) % n;
      if (focusable(s.items[i])) return this.setFocus(i);
    }
  }
  /** 키 하나를 메뉴가 먹으면 true */
  key(code: string): boolean {
    const s = this.top;
    if (!s) return false;
    const it = s.items[this.focus];
    switch (code) {
      case 'ArrowUp':
        this.moveFocus(-1);
        return true;
      case 'ArrowDown':
        this.moveFocus(1);
        return true;
      case 'ArrowLeft':
      case 'ArrowRight':
        if (it) this.adjust(it, code === 'ArrowLeft' ? -1 : 1);
        return true;
      case 'Enter':
      case 'Space':
      case 'NumpadEnter':
        if (it) this.activate(it);
        return true;
      case 'Escape':
      case 'Backspace':
        this.back();
        return true;
    }
    if (s.numbered && /^Digit[1-9]$/.test(code)) {
      const n = Number(code.slice(5)) - 1;
      const btns = s.items.map((x, i) => [x, i] as const).filter(([x]) => x.type === 'button');
      const pick = btns[n];
      if (pick) (this.focus = pick[1]), this.activate(pick[0]);
      return true;
    }
    return true;
  }
  private adjust(it: MenuItem, d: number) {
    if (it.type === 'slider') {
      const v = Math.max(it.min, Math.min(it.max, Math.round((it.get() + d * it.step) / it.step) * it.step));
      it.set(Number(v.toFixed(3)));
    } else if (it.type === 'toggle') it.set(!it.get());
    else if (it.type === 'choice') {
      const i = it.options.findIndex(([v]) => v === it.get());
      it.set(it.options[(i + d + it.options.length) % it.options.length][0]);
    } else return;
    this.onSound?.('move');
    this.render();
    this.onChange?.();
  }
  private activate(it: MenuItem) {
    if (it.type === 'button') {
      if (it.disabled) return;
      this.onSound?.('ok');
      it.act();
    } else this.adjust(it, 1);
  }
  private click(e: MouseEvent) {
    const t = e.target as HTMLElement;
    const row = t.closest<HTMLElement>('[data-i]');
    if (t.closest('[data-back]')) return this.back();
    if (!row) return;
    const i = Number(row.dataset.i);
    const it = this.top?.items[i];
    if (!it) return;
    this.setFocus(i, false);
    const step = t.closest<HTMLElement>('[data-step]');
    if (step) return this.adjust(it, Number(step.dataset.step));
    if (it.type === 'slider') {
      const bar = row.querySelector<HTMLElement>('.mn-bar');
      if (bar && t.closest('.mn-bar')) {
        const r = bar.getBoundingClientRect();
        const k = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        it.set(Number((it.min + Math.round((k * (it.max - it.min)) / it.step) * it.step).toFixed(3)));
        this.render();
        this.onChange?.();
      }
      return;
    }
    const opt = t.closest<HTMLElement>('[data-opt]');
    if (opt && it.type === 'choice') {
      it.set(opt.dataset.opt!);
      this.render();
      this.onChange?.();
      return;
    }
    this.activate(it);
  }
  private render() {
    const s = this.top;
    this.layer.classList.toggle('menu-on', !!s);
    this.onOpen?.(!!s);
    if (!s) {
      this.el.innerHTML = '';
      this.el.className = 'mn';
      return;
    }
    this.el.className = `mn on mn-${s.look ?? 'panel'}`;
    let bn = 0;
    const rows = s.items
      .map((it, i) => {
        const f = i === this.focus ? ' f' : '';
        switch (it.type) {
          case 'head':
            return `<div class="mn-head">${esc(it.label)}</div>`;
          case 'html':
            return `<div class="mn-html">${it.html}</div>`;
          case 'button': {
            bn++;
            const num = s.numbered ? `<em>${bn}</em>` : '';
            return `<button type="button" class="mn-row mn-btn${f}${it.danger ? ' danger' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${num}<span>${esc(it.label)}</span>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}</button>`;
          }
          case 'toggle':
            return `<div class="mn-row${f}" data-i="${i}"><span>${esc(it.label)}</span><b class="mn-tog ${it.get() ? 'on' : ''}"><i></i></b></div>`;
          case 'slider': {
            const v = it.get();
            const k = (v - it.min) / (it.max - it.min);
            return `<div class="mn-row${f}" data-i="${i}"><span>${esc(it.label)}</span><span class="mn-sl"><b data-step="-1">−</b><span class="mn-bar"><i style="width:${(k * 100).toFixed(1)}%"></i></span><b data-step="1">+</b><em>${esc(it.fmt ? it.fmt(v) : String(v))}</em></span></div>`;
          }
          case 'choice':
            return `<div class="mn-row${f}" data-i="${i}"><span>${esc(it.label)}</span><span class="mn-ch">${it.options.map(([v, l]) => `<b data-opt="${esc(v)}" class="${v === it.get() ? 'on' : ''}">${esc(l)}</b>`).join('')}</span></div>`;
        }
      })
      .join('');
    const back = s.noBack || s.look === 'title' ? '' : `<button type="button" class="mn-x" data-back aria-label="뒤로">✕</button>`;
    const title = s.look === 'title' ? `<div class="mn-logo"><small>관리국 괴이 탐사</small><b>${esc(s.title ?? '')}</b><span>${esc(s.sub ?? '')}</span></div>` : s.title ? `<h2>${esc(s.title)}</h2>${s.sub ? `<p class="mn-sub">${esc(s.sub)}</p>` : ''}` : '';
    this.el.innerHTML = `<div class="mn-box">${back}${title}<div class="mn-list">${rows}</div></div>`;
    this.el.querySelector('.f')?.scrollIntoView({ block: 'nearest' });
  }
  dispose() {
    this.el.remove();
  }
}

/** 선택지 창 (대화·승강기 패널·강화 고르기). 고른 번호, Esc 면 -1 */
export function choiceScreen(menu: Menu, o: { title: string; lines?: string[]; options: string[]; cancel?: boolean }, pick: (i: number) => void): Screen {
  return {
    id: 'choice',
    look: 'dialog',
    numbered: true,
    title: o.title,
    noBack: o.cancel === false,
    back: () => pick(-1),
    items: [
      ...(o.lines?.length ? [{ type: 'html' as const, html: o.lines.map((l) => `<p>${esc(l)}</p>`).join('') }] : []),
      ...o.options.map((label, i) => ({ type: 'button' as const, label, act: () => pick(i) })),
    ],
  };
}
export { esc };
