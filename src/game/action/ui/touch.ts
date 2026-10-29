// 모바일 터치 조작 (사용자 설계 docs/모바일조작/모바일_조작_설계.md, 배치 docs/모바일조작/배치안3.png, 2026-10-29 구현).
// 버튼 종류는 어디서나 고정: 약공격·강공격·회피·막기·점프·고유(길게 = 충전)·필살·조사 + 아래 가운데 자동·메뉴. 왼쪽 절반 = 떠다니는 스틱.
// 대사창이 뜨면 「대사창 모드」(약공격 자리 = 선택 Enter, 점프 자리 = 취소 Escape, 스틱 = ↑↓←→), 입력칸에 초점이 가면 「키패드 모드」(전부 숨김).
// 모든 버튼은 키보드와 같은 키 코드를 InputHub 에 누르고 뗀다. 손가락을 떼지 않고 옆 버튼으로 미끄러지면 그 버튼이 눌린다.
// 터치는 게임 층 루트(.gs)에서 받는다: 버튼·스틱·대사창 선택지·입력칸·메뉴 항목 말고는 아무 영향도 없게 preventDefault 만 한다.
import { CODE, TOUCH_CHARGE } from './keys';
import { BTN_CELL, BTN_CELLS, BTN_INNER, BTN_SHEET, BTN_SHEET_H, BTN_SHEET_W } from './mobileButtons.gen';
import type { InputHub } from './input';
import type { UiSettings } from './settings';

export type TouchId = 'light' | 'heavy' | 'dodge' | 'block' | 'jump' | 'unique' | 'ult' | 'interact' | 'auto' | 'menu' | 'ok' | 'cancel';
export type TouchMode = 'play' | 'dialog';

interface Btn {
  id: TouchId;
  /** 시트 칸 (없으면 빈 틀 + 글자) */
  cell: number | null;
  text: string;
  /** 약공격 중심에서 떨어진 거리(u). 아래 가운데 줄·대사창 버튼은 layout 이 따로 놓는다 */
  dx: number;
  dy: number;
  /** 지름(u) */
  d: number;
  el: HTMLElement;
  cx: number;
  cy: number;
  r: number;
  /** 대사창 모드에서 보이는 버튼 */
  dialog?: boolean;
  /** 놀이 모드에서 보이는 버튼 */
  play?: boolean;
}

/** 배치안3 을 잰 값 (844×390 기준, u ≈ 62px). 약공격이 오른쪽 아래 구석 */
const DEF: Omit<Btn, 'el' | 'cx' | 'cy' | 'r'>[] = [
  { id: 'light', cell: 0, text: '약공격', dx: 0, dy: 0, d: 1.45, play: true },
  { id: 'dodge', cell: 2, text: '회피', dx: -1.52, dy: 0.29, d: 1.0, play: true },
  { id: 'block', cell: 3, text: '막기', dx: -2.84, dy: 0.29, d: 0.9, play: true },
  { id: 'heavy', cell: 1, text: '강공격', dx: -1.12, dy: -0.98, d: 0.95, play: true },
  { id: 'jump', cell: 4, text: '점프', dx: 0.02, dy: -1.44, d: 0.95, play: true },
  { id: 'unique', cell: 5, text: '고유', dx: -2.42, dy: -1.23, d: 0.9, play: true },
  { id: 'ult', cell: 6, text: '필살', dx: -1.62, dy: -2.4, d: 0.95, play: true },
  { id: 'interact', cell: 7, text: '조사', dx: 0.34, dy: -2.66, d: 0.8, play: true },
  { id: 'auto', cell: null, text: 'AUTO', dx: 0, dy: 0, d: 0.8, play: true },
  { id: 'menu', cell: null, text: '', dx: 0, dy: 0, d: 0.65, play: true },
  // 대사창 모드: 약공격 자리 = 선택, 점프 자리 = 취소
  { id: 'ok', cell: null, text: '선택', dx: 0, dy: 0, d: 1.45, dialog: true },
  { id: 'cancel', cell: null, text: '취소', dx: 0.02, dy: -1.44, d: 0.95, dialog: true },
];

/** 회피: 엔진은 Shift 를 0.15초(5틱) 안에 떼면 회피로 읽는다. 터치는 누르는 순간 누르고 약 2틱 뒤 뗀다 */
const DODGE_MS = 80;
/** 고유: 이보다 오래 누르면 충전(S 누른 채) */
const CHARGE_MS = 300;

/** 터치를 그대로 넘겨야 하는 것 (대사창 선택지·입력칸·메뉴 항목, 글이 넘치는 기록·메뉴 목록 쓸기). 우리 버튼(.tp) 안은 제외.
 *  대사창 판의 빈 곳(대사 글자)은 넘기지 않는다: 스틱이 그 위에서도 시작된다 */
const EXEMPT = 'button, input, textarea, select, a[href], label, [contenteditable="true"], [role="button"], [data-act], [data-mission], [data-go], [data-chip], .mn-row, .mn-list, .gt-log';

/** 빈 틀(아이콘을 지운 약공격 칸): 자동·메뉴·선택·취소 바탕. 한 번만 만든다 */
let frameUrl: string | null = null;
let framePending: Promise<string | null> | null = null;
function emptyFrame(): Promise<string | null> {
  if (frameUrl) return Promise.resolve(frameUrl);
  if (framePending) return framePending;
  framePending = new Promise((res) => {
    if (typeof Image === 'undefined' || typeof document === 'undefined') return res(null);
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = BTN_CELL;
        const g = cv.getContext('2d');
        if (!g) return res(null);
        g.imageSmoothingEnabled = false;
        const [sx, sy] = BTN_CELLS[0];
        g.drawImage(img, sx, sy, BTN_CELL, BTN_CELL, 0, 0, BTN_CELL, BTN_CELL);
        g.fillStyle = BTN_INNER.color;
        g.beginPath();
        g.ellipse(BTN_CELL / 2, BTN_CELL / 2, BTN_INNER.rx, BTN_INNER.ry, 0, 0, Math.PI * 2);
        g.fill();
        frameUrl = cv.toDataURL('image/png');
        res(frameUrl);
      } catch {
        res(null);
      }
    };
    img.onerror = () => res(null);
    img.src = BTN_SHEET;
  });
  return framePending;
}

/** 화면 가장자리 안전 여백(노치·홈 바). env() 를 한 번 재서 쓴다 */
function safeInsets(host: HTMLElement): { t: number; r: number; b: number; l: number } {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  host.append(probe);
  const cs = getComputedStyle(probe);
  const v = { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  probe.remove();
  return v;
}

export class TouchPad {
  private root: HTMLElement;
  /** 터치를 받는 곳 = 게임 층 루트(.gs). 터치 차단도 여기서 */
  private surface: HTMLElement;
  private btns: Btn[] = [];
  private zone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private ptr = new Map<number, { kind: 'stick' } | { kind: 'btn'; b: Btn | null } | { kind: 'eat' }>();
  /** 키 코드별로 누르고 있는 손가락 수 */
  private count = new Map<string, number>();
  private stickPid: number | null = null;
  private dirOn = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false } as Record<string, boolean>;
  private runOn = false;
  private runSince = 0;
  private runTimer = 0;
  private timers = new Set<number>();
  /** 고유: 누른 시각·충전 시작 타이머·충전 중 */
  private uniq = { timer: 0, charging: false, down: false };
  private u = 64;
  private sr = 64;
  private restX = 0;
  private restY = 0;
  /** 스틱 자리 (층 기준 px) */
  private zr = { x: 0, y: 0, w: 0, h: 0 };
  /** 스틱이 시작되면 안 되는 곳 (아래 가운데 자동·메뉴 둘레) */
  private noStick = { x: 0, y: 0, w: 0, h: 0 };
  /** 캔버스 논리 폭 (옛 호환) */
  vw: () => number = () => 1280;
  /** 화면 좌표 → 층 좌표. 플러그인 창이 게임을 90도 돌릴 때 viewport.toLocal 을 넣는다 */
  toLocal: ((clientX: number, clientY: number, el: HTMLElement) => { x: number; y: number }) | null = null;
  visible = false;
  private seenTouch = false;
  private mode: TouchMode = 'play';
  /** 입력칸(키패드)에 초점: 스틱·버튼 전부 숨김 */
  private imeUp = false;
  /** 자동전투 켜짐 (아래 가운데 버튼 안이 청록) */
  private autoOn = false;
  private baseX = 0;
  private baseY = 0;
  constructor(
    private layer: HTMLElement,
    private hub: InputHub,
    private st: () => UiSettings,
    private onMenu: (code: string) => void,
  ) {
    this.surface = (layer.closest('.gs') as HTMLElement | null) ?? layer.parentElement ?? layer;
    this.root = document.createElement('div');
    this.root.className = 'tp gk-font';
    this.root.innerHTML = `<div class="tp-zone"></div><div class="tp-base"><div class="tp-knob"></div></div>`;
    this.zone = this.root.querySelector('.tp-zone')!;
    this.base = this.root.querySelector('.tp-base')!;
    this.knob = this.root.querySelector('.tp-knob')!;
    for (const d of DEF) {
      const el = document.createElement('div');
      el.className = `tp-b ${d.cell === null ? 'tp-frame' : 'tp-icon'}`;
      el.dataset.id = d.id;
      el.setAttribute('aria-label', d.text || '메뉴');
      // 그림 버튼: 글자는 숨긴 이름표 (조사는 navigationButton.ts 가 「잠김」을 덧쓴다)
      el.innerHTML = `<b>${d.text}</b><i class="tp-cd"></i>${d.id === 'ult' ? '<i class="tp-ring"></i>' : ''}${d.id === 'menu' ? '<i class="tp-bars"></i>' : ''}`;
      if (d.cell !== null) el.style.backgroundImage = `url("${BTN_SHEET}")`;
      this.root.append(el);
      this.btns.push({ ...d, el, cx: 0, cy: 0, r: 0 });
    }
    void emptyFrame().then((u) => u && this.root.style.setProperty('--tp-frame', `url("${u}")`));
    layer.append(this.root);
    const opt = { passive: false } as AddEventListenerOptions;
    const s = this.surface;
    s.addEventListener('pointerdown', this.onDown, opt);
    s.addEventListener('pointermove', this.onMove, opt);
    s.addEventListener('pointerup', this.onUp, opt);
    s.addEventListener('pointercancel', this.onUp, opt);
    s.addEventListener('lostpointercapture', this.onUp, opt);
    // 길게 누르기 메뉴·두 손가락 확대(사파리 gesture)·더블탭 확대를 막는다
    s.addEventListener('contextmenu', this.onContext);
    s.addEventListener('gesturestart', this.onGesture as EventListener, opt);
    s.addEventListener('dblclick', this.onContext);
    // 우리가 받은 손가락(버튼·스틱·빈 곳)은 뗄 때 클릭을 만들지 않는다: 메뉴 버튼을 누르면 열린 메뉴 항목이 같은 자리에서 눌리던 문제
    s.addEventListener('touchend', this.onTouchEnd, opt);
    // 잡기가 막힌(돌린·끼워 넣은) 화면에서도 마지막 뗌은 받는다
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('blur', this.onBlur);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('touchstart', this.onAnyTouch, { passive: true, capture: true });
    document.addEventListener('focusin', this.onIme);
    document.addEventListener('focusout', this.onIme);
    if (typeof visualViewport !== 'undefined') visualViewport?.addEventListener('resize', this.onIme);
    this.layout();
  }
  private onDown = (e: PointerEvent) => this.down(e);
  private onMove = (e: PointerEvent) => this.move(e);
  private onUp = (e: PointerEvent) => this.up(e);
  private onContext = (e: Event) => {
    if (this.active()) e.preventDefault();
  };
  private onGesture = (e: Event) => {
    if (this.active()) e.preventDefault();
  };
  private onTouchEnd = (e: TouchEvent) => {
    if (!this.shown) return;
    const t = e.target as Element | null;
    if (t && (t.closest('.tp') || !t.closest(EXEMPT)) && e.cancelable) e.preventDefault();
  };
  private onBlur = () => this.releaseAll();
  private onVisibility = () => {
    if (document.hidden) this.releaseAll();
  };
  private onAnyTouch = () => {
    if (!this.seenTouch) {
      this.seenTouch = true;
      if (!this.shown) this.refresh();
    }
  };

  /** 층이 화면에 90도 돌아 그려지는가 (플러그인 창 회전·껍데기 돌려 보기) */
  private rotated(): boolean {
    const r = this.layer.getBoundingClientRect();
    const w = this.layer.clientWidth,
      h = this.layer.clientHeight;
    return Math.abs(w - h) > 4 && Math.abs(r.width - h) < 2 && Math.abs(r.height - w) < 2;
  }

  /** 설정·화면 크기가 바뀌면 다시 배치 */
  layout() {
    this.releaseAll();
    const s = this.st();
    const bw = this.layer.clientWidth || 800,
      bh = this.layer.clientHeight || 400;
    // 안전 여백을 돌린 화면의 변으로 옮긴다 (시계 방향 90도: 층의 위 = 화면 오른쪽, 오른쪽 = 화면 아래, 아래 = 화면 왼쪽, 왼쪽 = 화면 위)
    const sa = typeof getComputedStyle === 'undefined' ? { t: 0, r: 0, b: 0, l: 0 } : safeInsets(this.layer);
    const ins = this.rotated() ? { t: sa.r, r: sa.b, b: sa.l, l: sa.t } : sa;
    const portrait = bh > bw * 1.05;
    const u = (this.u = Math.max(44, Math.min(86, Math.min(bw, bh) * 0.16)) * s.touchSize);
    this.root.style.setProperty('--tp-u', `${u}px`);
    this.root.style.setProperty('--tp-a', String(s.touchAlpha));
    const flip = (x: number) => (s.lefty ? bw - x : x);
    // 약공격(지름 1.45u) 중심: 오른쪽 아래 구석
    const ax = bw - ins.r - u * 1.275,
      ay = bh - ins.b - u * 1.275;
    // 오른쪽 위 시각·잔고 글자(drawFieldCorner, 캔버스 720 기준 약 110px) 아래로 조사를 둔다: 모자라면 무리 전체를 위아래로 좁힌다
    const cornerBottom = (bh / 720) * 112 + 6;
    const topNeed = 2.66 * u + 0.4 * u;
    const ky = Math.max(0.72, Math.min(1, (ay - cornerBottom) / topNeed));
    const place = (b: Btn, cx: number, cy: number) => {
      const r = (b.d * u) / 2;
      Object.assign(b, { cx, cy, r });
      const el = b.el;
      el.style.width = el.style.height = `${r * 2}px`;
      el.style.left = `${cx - r}px`;
      el.style.top = `${cy - r}px`;
      if (b.cell !== null) {
        const k = (r * 2) / BTN_CELL;
        const [sx, sy] = BTN_CELLS[b.cell];
        el.style.backgroundSize = `${BTN_SHEET_W * k}px ${BTN_SHEET_H * k}px`;
        el.style.backgroundPosition = `${-sx * k}px ${-sy * k}px`;
      }
    };
    // 아래 가운데: 자동 + 메뉴 (홈 바 제스처와 겹치지 않게 아래 끝에서 안전 여백 + 12px). 세로 화면(돌리지 못한 경우)은 위 가운데
    const autoR = 0.4 * u,
      rowY = portrait ? ins.t + 10 + autoR : bh - ins.b - 12 - autoR;
    for (const b of this.btns) {
      if (b.id === 'auto') place(b, flip(bw / 2 - 0.5 * u), rowY);
      else if (b.id === 'menu') place(b, flip(bw / 2 + 0.42 * u), rowY);
      else place(b, flip(ax + b.dx * u), ay + b.dy * u * ky);
    }
    const auto = this.btns.find((b) => b.id === 'auto')!;
    const menu = this.btns.find((b) => b.id === 'menu')!;
    const nl = Math.min(auto.cx - auto.r, menu.cx - menu.r) - 10,
      nr = Math.max(auto.cx + auto.r, menu.cx + menu.r) + 10;
    this.noStick = { x: nl, y: rowY - autoR - 10, w: nr - nl, h: autoR * 2 + 20 };
    // 스틱: 왼쪽 절반 (HUD 얼굴 칸 아래부터)
    const zt = portrait ? Math.max(bh * 0.4, rowY + autoR + 10) : bh * 0.18;
    const zw = bw * 0.5;
    this.zr = { x: s.lefty ? bw - zw : 0, y: zt, w: zw, h: bh - zt };
    Object.assign(this.zone.style, { left: `${this.zr.x}px`, top: `${zt}px`, width: `${zw}px`, height: `${bh - zt}px` });
    this.sr = u * 1.05;
    this.root.style.setProperty('--tp-r', `${this.sr}px`);
    this.restX = ins.l + 24 + this.sr * 1.1;
    this.restY = ins.b + 24 + this.sr * 1.1;
    this.root.classList.toggle('tp-dialog', this.mode === 'dialog');
    this.root.classList.toggle('tp-auto-on', this.autoOn);
    for (const b of this.btns) b.el.style.display = this.usable(b) ? '' : 'none';
    this.restBase();
  }
  private restBase() {
    const s = this.st();
    const zr = this.zr;
    const x = s.lefty ? zr.w - this.restX : this.restX;
    const y = zr.h - this.restY;
    this.placeBase(zr.x + x, zr.y + y);
    this.knob.style.transform = '';
    this.base.classList.remove('on');
  }
  private placeBase(x: number, y: number) {
    this.base.style.transform = `translate(${x - this.sr}px, ${y - this.sr}px)`;
    this.baseX = x;
    this.baseY = y;
  }
  /** 이 모드에서 보이는 버튼인가 */
  private usable(b: Btn) {
    if (this.mode === 'dialog') return !!b.dialog;
    if (this.root.closest('.exploration-map')) return b.id === 'menu';
    return !!b.play;
  }
  /** 눌러지는 버튼인가 (흐린 버튼은 자리만 지킨다) */
  private pressable(b: Btn) {
    return this.usable(b) && !b.el.classList.contains('off');
  }
  /** 옛 호환: 필드 전용 「조사·메뉴만」 규칙은 없앴다 (버튼 종류는 어디서나 고정) */
  setField(_on: boolean) {}
  /** 놀이 / 대사창 모드 */
  setMode(m: TouchMode) {
    if (this.mode === m) return;
    this.mode = m;
    this.releaseAll();
    this.layout();
  }
  get touchMode(): TouchMode {
    return this.mode;
  }
  private onIme = () => {
    const vv = typeof visualViewport !== 'undefined' ? visualViewport : null;
    const a = document.activeElement as HTMLElement | null;
    // 초점만으로 숨긴다 (키보드가 올라와 화면이 줄기를 기다리지 않는다)
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(a?.tagName ?? '') || !!a?.isContentEditable;
    const shrunk = !!vv && vv.height < innerHeight * 0.75 && typing;
    const up = typing || shrunk;
    if (up === this.imeUp) return;
    this.imeUp = up;
    if (up) this.releaseAll();
    this.refresh();
  };
  get keypad() {
    return this.imeUp;
  }
  refresh() {
    const s = this.st();
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const show = s.touch === 'on' || (s.touch === 'auto' && (coarse || this.seenTouch));
    this.root.classList.toggle('hide', !show || !this.visible || this.imeUp);
    this.layout();
  }
  setVisible(on: boolean) {
    if (this.visible === on) return;
    this.visible = on;
    if (!on) this.releaseAll();
    this.refresh();
  }
  get shown() {
    return !this.root.classList.contains('hide');
  }
  /** 터치를 받는 중 (보이고 키패드가 아님) */
  private active() {
    return this.shown && !this.imeUp;
  }
  /** 옛 호환: 아이템 칸은 모바일에서 뺐다 */
  setItems(_items: { count: number; label: string; id?: string }[]) {}
  /** 필살 게이지 0~1: 금색 테두리 게이지, 가득 차면 빛남 */
  setGauge(v: number) {
    const b = this.btns.find((x) => x.id === 'ult')!.el;
    const g = Math.max(0, Math.min(1, v));
    const t = g.toFixed(3);
    if (b.style.getPropertyValue('--g') !== t) b.style.setProperty('--g', t);
    b.classList.toggle('full', g >= 1);
  }
  /** 재사용 대기: frac 0~1 (남은 비율), text = 남은 초. 0 이면 끝 */
  setCool(id: TouchId, frac: number, text = '') {
    const b = this.btns.find((x) => x.id === id)?.el;
    if (!b) return;
    const on = frac > 0;
    b.classList.toggle('cool', on);
    b.style.setProperty('--cd', on ? String(Math.min(1, frac)) : '0');
    const i = b.querySelector<HTMLElement>('.tp-cd')!;
    if (i.textContent !== text) i.textContent = on ? text : '';
  }
  /** 못 씀: 흐리게, 자리는 그대로 */
  setOff(id: TouchId, off: boolean) {
    const b = this.btns.find((x) => x.id === id);
    if (!b || b.el.classList.contains('off') === off) return;
    b.el.classList.toggle('off', off);
    if (off) {
      // 누르던 손가락은 놓아 준다
      for (const [pid, st] of this.ptr) if (st.kind === 'btn' && st.b === b) (this.hold(b, false), (st.b = null), void pid);
    }
  }
  /** 자동전투 켜짐 표시 */
  setAuto(on: boolean) {
    if (this.autoOn === on) return;
    this.autoOn = on;
    this.root.classList.toggle('tp-auto-on', on);
  }
  /** 버튼 강조 (조사할 것이 있을 때 등) */
  hint(id: string, on: boolean) {
    this.btns.find((x) => x.id === id)?.el.classList.toggle('hint', on);
  }
  /** 시험·화면 확인용: 버튼 자리 (층 좌표) */
  rects(): Record<string, { x: number; y: number; r: number; shown: boolean; off: boolean }> {
    return Object.fromEntries(this.btns.map((b) => [b.id, { x: b.cx, y: b.cy, r: b.r, shown: this.usable(b) && this.shown, off: b.el.classList.contains('off') }]));
  }
  private hit(x: number, y: number): Btn | null {
    let best: Btn | null = null,
      bd = Infinity;
    for (const b of this.btns) {
      if (!this.pressable(b)) continue;
      // 원 안(반지름 ×1.15)만
      const d = Math.hypot(x - b.cx, y - b.cy) / b.r;
      if (d < 1.15 && d < bd) (best = b), (bd = d);
    }
    return best;
  }
  private local(e: PointerEvent) {
    if (this.toLocal) return this.toLocal(e.clientX, e.clientY, this.layer);
    const r = this.layer.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  /** 이 버튼이 누르는 키 */
  private codeOf(b: Btn): string | null {
    switch (b.id) {
      case 'light': return CODE.attack;
      case 'heavy': return CODE.reload;
      case 'dodge': return CODE.evade;
      case 'block': return CODE.guard;
      case 'jump': return CODE.jump;
      case 'unique': return CODE.unique;
      case 'ult': return CODE.ult;
      case 'interact': return CODE.interact;
      case 'auto': return CODE.auto;
      case 'menu': return 'Escape';
      case 'ok': return 'Enter';
      case 'cancel': return 'Escape';
    }
  }
  private key(code: string, on: boolean) {
    const n = (this.count.get(code) ?? 0) + (on ? 1 : -1);
    this.count.set(code, Math.max(0, n));
    if (on && n === 1) this.hub.press(code, 'touch');
    else if (!on && n <= 0) this.hub.release(code, 'touch');
  }
  private later(fn: () => void, ms: number) {
    const t = window.setTimeout(() => {
      this.timers.delete(t);
      fn();
    }, ms);
    this.timers.add(t);
    return t;
  }
  private hold(b: Btn, on: boolean) {
    b.el.classList.toggle('on', on);
    if (on && this.st().vibrate) navigator.vibrate?.(8);
    if (b.id === 'menu') {
      // 메뉴(일시정지): 숨은 스틱이 이어지지 않게 다 놓고 연다
      if (on) {
        this.releaseAll();
        this.onMenu('Escape');
      }
      return;
    }
    if (b.id === 'dodge') {
      // 누르는 순간 Shift 를 누르고 2틱쯤 뒤 뗀다 (짧게 = 회피). 손가락을 오래 대고 있어도 회피 한 번
      if (on) {
        this.key(CODE.evade, true);
        this.later(() => this.key(CODE.evade, false), DODGE_MS);
      }
      return;
    }
    if (b.id === 'unique') {
      const charge = TOUCH_CHARGE.code;
      if (!charge) {
        // 충전 키가 없는 조작표(옛 시연판): 누르는 동안 고유 키
        this.key(CODE.unique, on);
        return;
      }
      const u = this.uniq;
      if (on) {
        if (u.down) return;
        u.down = true;
        u.charging = false;
        // 0.3초가 지나는 순간 충전(S 누른 채)
        u.timer = this.later(() => {
          u.timer = 0;
          if (!u.down) return;
          u.charging = true;
          this.key(charge, true);
        }, CHARGE_MS);
      } else {
        if (!u.down) return;
        u.down = false;
        if (u.timer) (clearTimeout(u.timer), this.timers.delete(u.timer), (u.timer = 0));
        if (u.charging) this.key(charge, false);
        else {
          // 짧게 = 고유 키 탭
          this.key(CODE.unique, true);
          this.later(() => this.key(CODE.unique, false), DODGE_MS);
        }
        u.charging = false;
      }
      return;
    }
    const code = this.codeOf(b);
    if (code) this.key(code, on);
  }
  private down(e: PointerEvent) {
    if (!this.active() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const t = e.target as Element | null;
    const p = this.local(e);
    // 놀이 모드에서는 우리 버튼이 먼저, 대사창 모드에서는 선택지·입력칸이 먼저
    let b = this.mode === 'play' ? this.hit(p.x, p.y) : null;
    if (!b && t && !t.closest('.tp') && t.closest(EXEMPT)) return;
    b ??= this.hit(p.x, p.y);
    e.preventDefault();
    try {
      this.surface.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 브라우저 */
    }
    if (b) {
      this.ptr.set(e.pointerId, { kind: 'btn', b });
      this.hold(b, true);
      return;
    }
    const zr = this.zr,
      ns = this.noStick;
    const inZone = p.x >= zr.x && p.y >= zr.y && p.x <= zr.x + zr.w && p.y <= zr.y + zr.h;
    const blocked = this.mode === 'play' && p.x >= ns.x && p.x <= ns.x + ns.w && p.y >= ns.y && p.y <= ns.y + ns.h;
    if (this.stickPid === null && inZone && !blocked && !this.root.closest('.exploration-map')) {
      this.stickPid = e.pointerId;
      this.ptr.set(e.pointerId, { kind: 'stick' });
      this.placeBase(p.x, p.y);
      this.base.classList.add('on');
      this.stickTo(p.x, p.y);
      return;
    }
    // 그 밖(캔버스·HUD): 아무 입력도 만들지 않는다. 뗄 때까지 이 손가락은 먹는다
    this.ptr.set(e.pointerId, { kind: 'eat' });
  }
  private move(e: PointerEvent) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    if (st.kind === 'eat') return;
    const p = this.local(e);
    if (st.kind === 'stick') {
      this.stickTo(p.x, p.y);
      return;
    }
    const b = this.hit(p.x, p.y);
    if (b !== st.b) {
      // 떼지 않고 옆 버튼으로 미끄러지면 옮겨 눌림
      if (st.b) this.hold(st.b, false);
      st.b = b;
      if (b) this.hold(b, true);
    }
  }
  private up(e: PointerEvent) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    this.ptr.delete(e.pointerId);
    try {
      if (this.surface.hasPointerCapture(e.pointerId)) this.surface.releasePointerCapture(e.pointerId);
    } catch {
      /* 이미 풀림 */
    }
    if (st.kind === 'btn') {
      if (st.b) this.hold(st.b, false);
    } else if (st.kind === 'stick') {
      this.stickPid = null;
      this.setStick(0, 0);
      this.restBase();
    }
  }
  private stickTo(x: number, y: number) {
    const R = this.sr * 0.95;
    let dx = x - this.baseX,
      dy = y - this.baseY;
    const m = Math.hypot(dx, dy);
    // 너무 멀리 끌면 받침이 따라온다
    if (m > R * 1.5) {
      const k = (m - R * 1.5) / m;
      this.placeBase(this.baseX + dx * k, this.baseY + dy * k);
      dx = x - this.baseX;
      dy = y - this.baseY;
    }
    const mm = Math.hypot(dx, dy);
    const cl = mm > R ? R / mm : 1;
    this.knob.style.transform = `translate(${dx * cl}px, ${dy * cl}px)`;
    let nx = (dx * cl) / R,
      ny = (dy * cl) / R;
    if (Math.hypot(nx, ny) < 0.18) nx = ny = 0;
    this.setStick(nx, ny);
  }
  private setStick(x: number, y: number) {
    const dialog = this.mode === 'dialog';
    // 대사창 모드: 방향키만 (선택지 한 칸씩). 아날로그·달리기 없음
    this.hub.setAnalog('touch', dialog ? 0 : x, dialog ? 0 : y);
    const dir = (code: string, v: boolean) => {
      if (this.dirOn[code] === v) return;
      this.dirOn[code] = v;
      if (v) this.hub.press(code, 'touch');
      else this.hub.release(code, 'touch');
    };
    // 문턱 0.42, 놓는 문턱 0.3 (떨림 방지). 대사창은 위아래를 먼저 (대각선으로 밀어도 한 방향)
    const th = (on: boolean) => (on ? 0.3 : 0.42);
    if (dialog) {
      const vert = Math.abs(y) >= Math.abs(x);
      dir('ArrowUp', vert && y < -th(this.dirOn.ArrowUp));
      dir('ArrowDown', vert && y > th(this.dirOn.ArrowDown));
      dir('ArrowLeft', !vert && x < -th(this.dirOn.ArrowLeft));
      dir('ArrowRight', !vert && x > th(this.dirOn.ArrowRight));
      return;
    }
    dir('ArrowLeft', x < -th(this.dirOn.ArrowLeft));
    dir('ArrowRight', x > th(this.dirOn.ArrowRight));
    dir('ArrowUp', y < -th(this.dirOn.ArrowUp) * 1.15);
    dir('ArrowDown', y > th(this.dirOn.ArrowDown) * 1.15);
    // 끝까지 밀면 달리기 = Shift 누른 채. 짧게 스치면 회피로 읽히지 않게 최소 0.25초 누른다
    const wantRun = this.st().stickRun && Math.abs(x) > 0.9;
    if (wantRun && !this.runOn) {
      this.runOn = true;
      this.runSince = performance.now();
      // 늦게 떼기가 남아 있으면 그 누름을 다시 쓴다
      const pending = this.runTimer !== 0;
      clearTimeout(this.runTimer);
      this.runTimer = 0;
      if (!pending) this.key(CODE.evade, true);
    } else if (!wantRun && this.runOn) {
      this.runOn = false;
      const left = 250 - (performance.now() - this.runSince);
      clearTimeout(this.runTimer);
      this.runTimer = 0;
      if (left > 0)
        this.runTimer = window.setTimeout(() => {
          this.runTimer = 0;
          this.key(CODE.evade, false);
        }, left);
      else this.key(CODE.evade, false);
    }
  }
  releaseAll() {
    const ids = [...this.ptr.keys()];
    this.ptr.clear();
    for (const id of ids) {
      try {
        if (this.surface.hasPointerCapture(id)) this.surface.releasePointerCapture(id);
      } catch {
        /* 무시 */
      }
    }
    clearTimeout(this.runTimer);
    this.runTimer = 0;
    this.runOn = false;
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.uniq = { timer: 0, charging: false, down: false };
    this.stickPid = null;
    this.setStick(0, 0);
    this.count.clear();
    for (const b of this.btns) b.el.classList.remove('on');
    this.hub.releaseSource('touch');
    this.restBase();
  }
  dispose() {
    const s = this.surface;
    s.removeEventListener('pointerdown', this.onDown);
    s.removeEventListener('pointermove', this.onMove);
    s.removeEventListener('pointerup', this.onUp);
    s.removeEventListener('pointercancel', this.onUp);
    s.removeEventListener('lostpointercapture', this.onUp);
    s.removeEventListener('contextmenu', this.onContext);
    s.removeEventListener('gesturestart', this.onGesture as EventListener);
    s.removeEventListener('dblclick', this.onContext);
    s.removeEventListener('touchend', this.onTouchEnd);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('focusin', this.onIme);
    document.removeEventListener('focusout', this.onIme);
    if (typeof visualViewport !== 'undefined') visualViewport?.removeEventListener('resize', this.onIme);
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('touchstart', this.onAnyTouch, { capture: true });
    this.releaseAll();
    this.root.remove();
  }
}
