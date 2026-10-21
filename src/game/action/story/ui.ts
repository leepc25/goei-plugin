// 대화창·선택지·말풍선·자막·암전·자유 대화 창. DOM으로 그리고, 게임 캔버스 위에 겹친다.
import type { CastInfo } from './cast';
import type { Mood } from './types';

export type Anchor = () => { x: number; y: number } | null;

interface Bubble {
  el: HTMLElement;
  left: number;
  anchor: Anchor;
  key: string;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export class StoryUI {
  readonly el: HTMLElement;
  private box: HTMLElement;
  private nameEl: HTMLElement;
  private textEl: HTMLElement;
  private photoEl: HTMLElement;
  private choicesEl: HTMLElement;
  readonly bubbleLayer: HTMLElement;
  private captionEl: HTMLElement;
  private fadeEl: HTMLElement;
  private skipEl: HTMLButtonElement;
  private bubbles: Bubble[] = [];
  private full = '';
  private shown = 0;
  private captionLeft = 0;
  /** 초당 글자 수 */
  cps = 42;
  onAdvance: () => void = () => {};
  onChoose: (index: number) => void = () => {};
  onSkip: () => void = () => {};

  constructor(
    root: HTMLElement,
    private photo: (key: string) => string | undefined,
  ) {
    const el = document.createElement('div');
    el.className = 'gsy';
    el.innerHTML = `<div class="gsy-fade"></div><div class="gsy-bubbles"></div><div class="gsy-caption" hidden></div>
<button class="gsy-skip" hidden>건너뛰기 ▶▶</button>
<div class="gsy-dock"><div class="gsy-choices" hidden></div>
<div class="gsy-box" hidden role="dialog" aria-live="polite"><div class="gsy-photo"></div><div class="gsy-body"><b class="gsy-name"></b><p class="gsy-text"></p></div><i class="gsy-next">▼</i></div></div>`;
    root.append(el);
    this.el = el;
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    this.box = q('.gsy-box');
    this.nameEl = q('.gsy-name');
    this.textEl = q('.gsy-text');
    this.photoEl = q('.gsy-photo');
    this.choicesEl = q('.gsy-choices');
    this.bubbleLayer = q('.gsy-bubbles');
    this.captionEl = q('.gsy-caption');
    this.fadeEl = q('.gsy-fade');
    this.skipEl = q<HTMLButtonElement>('.gsy-skip');
    this.box.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.tapBox();
    });
    this.skipEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onSkip();
    });
    this.choicesEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-i]');
      if (!b) return;
      e.stopPropagation();
      this.onChoose(Number(b.dataset.i));
    });
  }

  get boxOpen() {
    return !this.box.hidden || !this.choicesEl.hidden;
  }
  get typing() {
    return !this.box.hidden && this.shown < this.full.length;
  }

  tapBox() {
    if (this.typing) this.completeTyping();
    else this.onAdvance();
  }
  completeTyping() {
    this.shown = this.full.length;
    this.textEl.textContent = this.full;
    this.box.classList.add('done');
  }

  line(cast: CastInfo, text: string, mood: Mood) {
    this.choicesEl.hidden = true;
    this.box.hidden = false;
    this.box.dataset.mood = mood;
    this.box.classList.toggle('narr', !cast.name);
    this.box.classList.remove('done');
    this.box.style.setProperty('--who', cast.color);
    this.nameEl.textContent = cast.name;
    const src = cast.photo ? this.photo(cast.photo) : undefined;
    this.photoEl.hidden = !cast.name;
    this.photoEl.innerHTML = src ? `<img alt="" src="${esc(src)}">` : `<span>${esc(cast.name.slice(0, 1))}</span>`;
    this.full = text;
    this.shown = 0;
    this.textEl.textContent = '';
  }

  choices(options: { text: string; index: number }[]) {
    this.completeTyping();
    this.box.classList.add('asking');
    this.choicesEl.hidden = false;
    this.choicesEl.innerHTML = options.map((o, n) => `<button data-i="${o.index}"><kbd>${n + 1}</kbd>${esc(o.text)}</button>`).join('');
  }

  close() {
    this.box.hidden = true;
    this.box.classList.remove('asking');
    this.choicesEl.hidden = true;
    this.full = '';
  }

  setSkippable(on: boolean) {
    this.skipEl.hidden = !on;
  }

  /** key: 말하는 자리. 같은 자리의 앞 말풍선은 바로 지운다 */
  bubble(text: string, anchor: Anchor, ms: number, color: string, name = '', key = name) {
    const el = document.createElement('div');
    el.className = 'gsy-bubble';
    el.style.setProperty('--who', color);
    el.innerHTML = `${name ? `<b>${esc(name)}</b>` : ''}${esc(text)}`;
    this.bubbleLayer.append(el);
    for (const b of this.bubbles)
      if (b.key === key) {
        b.left = 0;
        b.el.remove();
      }
    this.bubbles = this.bubbles.filter((b) => b.left > 0);
    this.bubbles.push({ el, left: ms / 1000, anchor, key });
    this.place(this.bubbles[this.bubbles.length - 1]);
  }

  caption(text: string, ms: number) {
    this.captionEl.hidden = false;
    this.captionEl.textContent = text;
    this.captionEl.classList.remove('out');
    this.captionLeft = ms / 1000;
  }

  /** dim: 무대 그림이 없을 때(통합판 컷신) 멈춘 게임 화면을 어둡게 가린다 */
  fade(to: 'black' | 'clear' | 'dim', ms: number) {
    this.fadeEl.style.transition = `opacity ${Math.max(0, ms)}ms linear`;
    this.fadeEl.style.opacity = to === 'black' ? '1' : to === 'dim' ? '0.86' : '0';
  }

  private place(b: Bubble) {
    const p = b.anchor();
    if (!p) {
      b.el.classList.add('free');
      return;
    }
    b.el.classList.remove('free');
    // 화면 밖으로 나가지 않게 가로 위치를 당기고, 꼬리는 말하는 사람 쪽에 남긴다
    const w = b.el.offsetWidth,
      W = this.el.clientWidth;
    const x = Math.max(w / 2 + 6, Math.min(W - w / 2 - 6, p.x));
    b.el.style.setProperty('--tail', `${Math.round(p.x - x)}px`);
    b.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(p.y, 0))}px) translate(-50%, -100%)`;
  }

  update(dt: number) {
    if (this.typing) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(this.full.length, this.shown + dt * this.cps);
      if (Math.floor(this.shown) !== before) this.textEl.textContent = this.full.slice(0, Math.floor(this.shown));
      if (!this.typing) this.box.classList.add('done');
    }
    for (const b of this.bubbles) {
      b.left -= dt;
      this.place(b);
      if (b.left < 0.25) b.el.classList.add('out');
      if (b.left <= 0) b.el.remove();
    }
    this.bubbles = this.bubbles.filter((b) => b.left > 0);
    if (!this.captionEl.hidden) {
      this.captionLeft -= dt;
      if (this.captionLeft < 0.3) this.captionEl.classList.add('out');
      if (this.captionLeft <= 0) this.captionEl.hidden = true;
    }
  }

  dispose() {
    this.el.remove();
  }
}

/** 자유 대화 창 */
export class TalkPanel {
  readonly el: HTMLElement;
  private log: HTMLElement;
  private input: HTMLInputElement;
  private send: HTMLButtonElement;
  onSend: (text: string) => void = () => {};
  onClose: () => void = () => {};
  constructor(root: HTMLElement) {
    const el = document.createElement('div');
    el.className = 'gsy-talk';
    el.hidden = true;
    el.innerHTML = `<div class="gsy-talk-head"><span class="gsy-photo"></span><b></b><button data-x aria-label="닫기">✕</button></div><div class="gsy-talk-log"></div><form><input maxlength="200" placeholder="하고 싶은 말" enterkeyhint="send"><button>보내기</button></form>`;
    root.append(el);
    this.el = el;
    this.log = el.querySelector('.gsy-talk-log')!;
    this.input = el.querySelector('input')!;
    this.send = el.querySelector('form button')!;
    el.querySelector('form')!.addEventListener('submit', (e) => {
      e.preventDefault();
      const t = this.input.value.trim();
      if (!t || this.send.disabled) return;
      this.input.value = '';
      this.onSend(t);
    });
    el.querySelector('[data-x]')!.addEventListener('click', () => this.onClose());
    for (const ev of ['keydown', 'keyup', 'pointerdown'] as const) el.addEventListener(ev, (e) => e.stopPropagation());
  }
  open(cast: CastInfo, photo: string | undefined, greeting: string) {
    this.el.hidden = false;
    this.el.style.setProperty('--who', cast.color);
    this.el.querySelector('.gsy-talk-head b')!.textContent = cast.name;
    this.el.querySelector('.gsy-talk-head .gsy-photo')!.innerHTML = photo ? `<img alt="" src="${esc(photo)}">` : `<span>${esc(cast.name.slice(0, 1))}</span>`;
    this.log.innerHTML = '';
    this.add('npc', greeting);
    this.input.focus({ preventScroll: true });
  }
  add(who: 'me' | 'npc', text: string) {
    const p = document.createElement('p');
    p.className = who;
    p.textContent = text;
    this.log.append(p);
    this.log.scrollTop = this.log.scrollHeight;
    return p;
  }
  waiting(on: boolean) {
    this.send.disabled = on;
    this.el.classList.toggle('wait', on);
  }
  close() {
    this.el.hidden = true;
    this.input.blur();
  }
  get isOpen() {
    return !this.el.hidden;
  }
}
