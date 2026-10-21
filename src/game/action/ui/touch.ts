// 모바일 터치 조작: 왼쪽 떠다니는 스틱 + 오른쪽 버튼 무리. 손가락을 떼지 않고 옆 버튼으로 미끄러져도 눌린다.
// 모든 버튼은 키보드와 같은 키 코드를 InputHub 에 누르고 뗀다.
import { drawHudItemIcon } from './hud';
import type { InputHub } from './input';
import type { UiSettings } from './settings';
import { portraitTop } from './stage';

interface Btn {
  id: string;
  code: string;
  label: string;
  key: string;
  /** 기준점(A 버튼 중심)에서 떨어진 거리, 단위 u */
  dx: number;
  dy: number;
  d: number;
  el?: HTMLElement;
  cx?: number;
  cy?: number;
  r?: number;
  group?: 'cluster' | 'items' | 'top';
}

const CLUSTER: Btn[] = [
  { id: 'attack', code: 'KeyA', label: '공격', key: 'A', dx: 0, dy: 0, d: 1.45 },
  { id: 'jump', code: 'Space', label: '점프', key: 'Spc', dx: -1.6, dy: 0.15, d: 1.05 },
  { id: 'shoot', code: 'KeyS', label: '사격', key: 'S', dx: -1.15, dy: -1.15, d: 1.05 },
  { id: 'unique', code: 'KeyD', label: '고유', key: 'D', dx: 0.05, dy: -1.6, d: 1.05 },
  { id: 'evade', code: 'ShiftLeft', label: '회피', key: 'Shift', dx: -2.85, dy: 0.3, d: 1.0 },
  { id: 'guard', code: 'KeyQ', label: '가드', key: 'Q', dx: -2.55, dy: -1.35, d: 0.95 },
  { id: 'interact', code: 'KeyE', label: '조사', key: 'E', dx: -1.55, dy: -2.5, d: 0.95 },
  { id: 'ult', code: 'KeyW', label: '필살', key: 'W', dx: 0.2, dy: -2.85, d: 1.0 },
  { id: 'reload', code: 'KeyR', label: '장전', key: 'R', dx: -3.75, dy: -0.6, d: 0.7 },
  { id: 'support', code: 'KeyC', label: '지원', key: 'C', dx: -2.75, dy: -2.65, d: 0.7 },
];

export class TouchPad {
  private root: HTMLElement;
  private btns: Btn[] = [];
  private zone: HTMLElement;
  private base: HTMLElement;
  private knob: HTMLElement;
  private ptr = new Map<number, { kind: 'stick' } | { kind: 'btn'; b: Btn }>();
  private count = new Map<string, number>();
  private stickPid: number | null = null;
  private sx = 0;
  private sy = 0;
  private dirOn = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false } as Record<string, boolean>;
  private runOn = false;
  private runSince = 0;
  private runTimer = 0;
  private u = 64;
  /** 스틱 받침 반지름과 쉴 때 자리(바깥 가장자리에서) */
  private sr = 64;
  private restX = 64 * 1.55;
  private restY = 64;
  /** 스틱 자리 (층 기준 px) */
  private zr = { x: 0, y: 0, w: 0, h: 0 };
  /** 화면 좌표 → 층 좌표. 리스 플러그인 창이 게임을 90도 돌릴 때 bridge.viewport.toLocal 을 넣는다 */
  /** 캔버스 논리 폭 (채우기면 1280 보다 넓다) */
  vw: () => number = () => 1280;
  toLocal: ((clientX: number, clientY: number, el: HTMLElement) => { x: number; y: number }) | null = null;
  visible = false;
  private seenTouch = false;
  constructor(
    private layer: HTMLElement,
    private hub: InputHub,
    private st: () => UiSettings,
    private onMenu: (code: string) => void,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'tp';
    this.root.innerHTML = `<div class="tp-zone"><div class="tp-base"><div class="tp-knob"></div></div></div>`;
    this.zone = this.root.querySelector('.tp-zone')!;
    this.base = this.root.querySelector('.tp-base')!;
    this.knob = this.root.querySelector('.tp-knob')!;
    const mk = (b: Btn, cls: string) => {
      const el = document.createElement('div');
      el.className = `tp-b ${cls}`;
      el.dataset.id = b.id;
      el.innerHTML = `<b>${b.label}</b><i>${b.key}</i>`;
      this.root.append(el);
      b.el = el;
      this.btns.push(b);
    };
    for (const b of CLUSTER) mk({ ...b, group: 'cluster' }, b.id === 'attack' ? 'big' : b.d < 0.8 ? 'small' : '');
    for (let i = 0; i < 4; i++) mk({ id: `item${i + 1}`, code: `Digit${i + 1}`, label: '', key: String(i + 1), dx: 0, dy: 0, d: 0.78, group: 'items' }, 'item');
    mk({ id: 'map', code: 'KeyZ', label: '지도', key: 'Z', dx: 0, dy: 0, d: 0.62, group: 'top' }, 'top');
    mk({ id: 'menu', code: 'Escape', label: '☰', key: '메뉴', dx: 0, dy: 0, d: 0.62, group: 'top' }, 'top');
    const ring = document.createElement('div');
    ring.className = 'tp-ring';
    this.btns.find((b) => b.id === 'ult')!.el!.append(ring);
    layer.append(this.root);
    const opt = { passive: false } as AddEventListenerOptions;
    this.root.addEventListener('pointerdown', (e) => this.down(e), opt);
    this.root.addEventListener('pointermove', (e) => this.move(e), opt);
    this.root.addEventListener('pointerup', (e) => this.up(e), opt);
    this.root.addEventListener('pointercancel', (e) => this.up(e), opt);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('touchstart', this.onAnyTouch, { passive: true, capture: true });
    this.layout();
  }
  private onAnyTouch = () => {
    if (!this.seenTouch) (this.seenTouch = true), this.refresh();
  };
  /** 설정·화면 크기가 바뀌면 다시 배치 */
  layout() {
    const s = this.st();
    const bw = this.layer.clientWidth || 800,
      bh = this.layer.clientHeight || 400;
    const portrait = bh > bw * 1.05;
    const vw = this.vw();
    const scale = Math.min(bw / vw, bh / 720);
    const stageW = vw * scale,
      stageBottom = portrait ? portraitTop(bh, 720 * scale) + 720 * scale : (bh + 720 * scale) / 2;
    if (!portrait) return this.layoutSide(bw, bh, (bw - stageW) / 2);
    this.u = (portrait ? Math.max(42, Math.min(70, bw * 0.135)) : Math.max(44, Math.min(86, Math.min(bw, bh) * 0.155))) * s.touchSize;
    const u = this.u;
    const flip = s.lefty ? -1 : 1;
    this.root.style.setProperty('--tp-u', `${u}px`);
    this.root.style.setProperty('--tp-a', String(s.touchAlpha));
    this.sr = u;
    this.restX = u * 1.55;
    this.restY = u;
    this.root.style.setProperty('--tp-r', `${u}px`);
    const safeB = 10,
      safeS = 14;
    const ax = s.lefty ? safeS + u * 0.8 : bw - safeS - u * 0.8;
    const ay = bh - safeB - u * 0.85;
    // 세로: 버튼 무리를 조금 좁히고, 장전·지원은 아이템 줄로 옮긴다
    const squeeze = portrait ? 0.8 : 1;
    const rowBtns = portrait ? ['item1', 'item2', 'item3', 'item4', 'reload', 'support'] : ['item1', 'item2', 'item3', 'item4'];
    const side = (bw - stageW) / 2;
    const topInSide = !portrait && side >= u * 0.75;
    for (const b of this.btns) {
      let cx = 0,
        cy = 0;
      const ri = rowBtns.indexOf(b.id);
      if (ri >= 0) {
        const gap = u * (portrait ? 0.95 : 0.92);
        cx = bw / 2 + (ri - (rowBtns.length - 1) / 2) * gap;
        cy = portrait ? Math.max(stageBottom + 10 + u * 0.4, ay - 3.3 * u) : bh - safeB - u * 0.45;
      } else if (b.group === 'cluster') (cx = ax + b.dx * u * flip * squeeze), (cy = ay + b.dy * u * squeeze);
      else {
        const i = b.id === 'menu' ? 0 : 1;
        if (topInSide) {
          // 옆 검은 띠 안에 세로로
          cx = s.lefty ? side / 2 : bw - side / 2;
          cy = 12 + u * 0.35 + i * u * 0.8;
        } else {
          // 띠가 없으면 가운데 위 (터치 HUD 는 가운데 위를 비워 둔다)
          cx = bw / 2 + (i === 0 ? 0.4 : -0.4) * u;
          cy = (portrait ? 10 : 8) + u * 0.32;
        }
      }
      const d = ri >= 0 ? 0.8 : b.d;
      const r = (d * u) / 2;
      Object.assign(b, { cx, cy, r });
      const el = b.el!;
      el.style.width = el.style.height = `${r * 2}px`;
      el.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
    }
    // 스틱 자리: 버튼 반대쪽 아래
    const clusterW = u * (portrait ? 3.6 : 4.4);
    const zw = portrait ? Math.max(u * 2.4, bw - clusterW - safeS * 2) : bw * 0.45;
    const zt = portrait ? stageBottom + 10 : bh * 0.22;
    this.zr = { x: s.lefty ? bw - zw : 0, y: zt, w: zw, h: bh - zt };
    Object.assign(this.zone.style, { left: `${this.zr.x}px`, top: `${zt}px`, width: `${zw}px`, height: `${bh - zt}px` });
    this.restBase();
  }
  /** 가로 화면: 좌우 검은 띠를 먼저 쓴다. 오른쪽 띠 = 공격·점프·회피·사격·고유·필살, 그 안쪽 아래 = 가드·조사·장전·지원,
   *  왼쪽 띠 = 메뉴·지도·아이템 1~4, 왼쪽 아래 = 스틱. 플레이어가 서는 바닥 가운데는 비운다 */
  private layoutSide(bw: number, bh: number, side: number) {
    const s = this.st();
    const g = 4;
    this.u = Math.max(40, Math.min(86, (bh - 16 - 6 * g) / 5.55)) * s.touchSize;
    const u = this.u;
    this.root.style.setProperty('--tp-u', `${u}px`);
    this.root.style.setProperty('--tp-a', String(s.touchAlpha));
    const edge = 6;
    const colR = side >= u * 0.9 ? bw - side / 2 : bw - edge - u * 0.6;
    const colL = side >= u * 0.7 ? side / 2 : edge + u * 0.36;
    const mir = (x: number) => (s.lefty ? bw - x : x);
    const place = (id: string, cx: number, cy: number, d: number) => {
      const b = this.btns.find((x) => x.id === id)!;
      const r = (d * u) / 2;
      cx = mir(cx);
      Object.assign(b, { cx, cy, r });
      const el = b.el!;
      el.style.width = el.style.height = `${r * 2}px`;
      el.style.transform = `translate(${cx - r}px, ${cy - r}px)`;
    };
    const stack = (ids: string[], x: number, d: number[], fromBottom: boolean) => {
      let y = fromBottom ? bh - edge : edge;
      ids.forEach((id, i) => {
        const r = (d[i] * u) / 2;
        y += fromBottom ? -r : r;
        place(id, x, y, d[i]);
        y += fromBottom ? -r - g : r + g;
      });
    };
    stack(['attack', 'jump', 'evade', 'shoot', 'unique', 'ult'], colR, [1.15, 0.88, 0.88, 0.88, 0.88, 0.88], true);
    // 안쪽 열은 작게(0.64u), 같은 높이의 오른쪽 띠 버튼 바로 옆에 붙여 캔버스를 덜 가린다
    const right = ['attack', 'jump', 'evade', 'shoot', 'unique', 'ult'].map((id) => this.btns.find((x) => x.id === id)!);
    const di = 0.64,
      ri = (di * u) / 2;
    let y = bh - edge;
    for (const id of ['guard', 'interact', 'reload', 'support']) {
      y -= ri;
      let left = colR;
      for (const b of right) if (Math.abs((b.cy ?? 0) - y) < (b.r ?? 0) + ri) left = Math.min(left, mir(b.cx ?? 0) - (b.r ?? 0));
      place(id, left - g - ri, y, di);
      y -= ri + g;
    }
    stack(['menu', 'map', 'item1', 'item2', 'item3', 'item4'], colL, [0.66, 0.66, 0.66, 0.66, 0.66, 0.66], false);
    const zw = bw * 0.42,
      zt = bh * 0.3;
    this.zr = { x: s.lefty ? bw - zw : 0, y: zt, w: zw, h: bh - zt };
    Object.assign(this.zone.style, { left: `${this.zr.x}px`, top: `${zt}px`, width: `${zw}px`, height: `${bh - zt}px` });
    // 스틱 받침: 조금 작게, 쉴 때는 왼쪽 띠에 걸쳐 캔버스 안으로 60px 넘게 들어가지 않게
    this.sr = u * 0.82;
    this.root.style.setProperty('--tp-r', `${this.sr}px`);
    this.restX = Math.max(edge + this.sr, side + 60 - this.sr);
    this.restY = edge + this.sr;
    this.restBase();
  }
  private restBase() {
    const s = this.st();
    const zr = this.zr;
    const x = s.lefty ? zr.w - this.restX : this.restX;
    const y = zr.h - this.restY;
    this.placeBase(x, y);
    this.knob.style.transform = '';
    this.base.classList.remove('on');
  }
  private placeBase(x: number, y: number) {
    this.base.style.transform = `translate(${x - this.sr}px, ${y - this.sr}px)`;
    this.baseX = x;
    this.baseY = y;
  }
  private baseX = 0;
  private baseY = 0;
  refresh() {
    const s = this.st();
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    const show = s.touch === 'on' || (s.touch === 'auto' && (coarse || this.seenTouch));
    this.root.classList.toggle('hide', !show || !this.visible);
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
  /** 아이템 칸: 글자 대신 아이콘 + 개수 */
  setItems(items: { count: number; label: string; id?: string }[]) {
    items.forEach((it, i) => {
      const b = this.btns.find((x) => x.id === `item${i + 1}`);
      if (!b?.el) return;
      const key = `${it.id ?? ''}|${it.label}`;
      if (b.el.dataset.icon !== key) {
        b.el.dataset.icon = key;
        b.el.innerHTML = `<canvas width="64" height="64"></canvas><i>${i + 1}</i><u></u>`;
        const g = b.el.querySelector('canvas')!.getContext('2d');
        if (g && (it.label || it.id)) drawHudItemIcon(g, it, 4, 4, 56);
      }
      const u = b.el.querySelector('u')!;
      const n = it.label || it.id ? String(it.count) : '';
      if (u.textContent !== n) u.textContent = n;
      b.el.classList.toggle('empty', it.count <= 0);
    });
  }
  /** 필살 게이지 0~1 */
  setGauge(v: number) {
    const b = this.btns.find((x) => x.id === 'ult')!.el!;
    b.style.setProperty('--g', String(Math.max(0, Math.min(1, v))));
    b.classList.toggle('full', v >= 1);
  }
  /** 버튼 강조 (조사할 것이 있을 때 E, 탄이 적을 때 R 등) */
  hint(id: string, on: boolean) {
    this.btns.find((x) => x.id === id)?.el?.classList.toggle('hint', on);
  }
  private hit(x: number, y: number): Btn | null {
    let best: Btn | null = null,
      bd = Infinity;
    for (const b of this.btns) {
      const d = Math.hypot(x - b.cx!, y - b.cy!);
      const lim = b.r! * (b.group === 'cluster' ? 1.18 : 1.05);
      if (d < lim && d / b.r! < bd) (best = b), (bd = d / b.r!);
    }
    return best;
  }
  private local(e: PointerEvent) {
    if (this.toLocal) return this.toLocal(e.clientX, e.clientY, this.layer);
    const r = this.layer.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  private hold(b: Btn, on: boolean) {
    const n = (this.count.get(b.code) ?? 0) + (on ? 1 : -1);
    this.count.set(b.code, Math.max(0, n));
    b.el!.classList.toggle('on', n > 0);
    if (b.code === 'Escape' || b.code === 'KeyZ') {
      if (on && n === 1) this.onMenu(b.code);
      return;
    }
    if (on && n === 1) {
      this.hub.press(b.code, 'touch');
      if (this.st().vibrate) navigator.vibrate?.(8);
    } else if (!on && n <= 0) this.hub.release(b.code, 'touch');
  }
  private down(e: PointerEvent) {
    e.preventDefault();
    const p = this.local(e);
    const b = this.hit(p.x, p.y);
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      /* 일부 브라우저 */
    }
    if (b) {
      this.ptr.set(e.pointerId, { kind: 'btn', b });
      this.hold(b, true);
      return;
    }
    const zr = this.zr;
    const zx = p.x - zr.x,
      zy = p.y - zr.y;
    if (this.stickPid === null && zx >= 0 && zy >= 0 && zx <= zr.w && zy <= zr.h) {
      this.stickPid = e.pointerId;
      this.ptr.set(e.pointerId, { kind: 'stick' });
      this.placeBase(zx, zy);
      this.base.classList.add('on');
      this.stickTo(zx, zy);
    }
  }
  private move(e: PointerEvent) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    e.preventDefault();
    const p = this.local(e);
    if (st.kind === 'stick') {
      this.stickTo(p.x - this.zr.x, p.y - this.zr.y);
      return;
    }
    const b = this.hit(p.x, p.y);
    if (b && b !== st.b) {
      this.hold(st.b, false);
      this.hold(b, true);
      st.b = b;
    }
  }
  private up(e: PointerEvent) {
    const st = this.ptr.get(e.pointerId);
    if (!st) return;
    this.ptr.delete(e.pointerId);
    if (st.kind === 'btn') this.hold(st.b, false);
    else {
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
    this.sx = x;
    this.sy = y;
    this.hub.setAnalog('touch', x, y);
    const dir = (code: string, v: boolean) => {
      if (this.dirOn[code] === v) return;
      this.dirOn[code] = v;
      if (v) this.hub.press(code, 'touch');
      else this.hub.release(code, 'touch');
    };
    // 문턱 0.42, 놓는 문턱 0.3 (떨림 방지)
    const th = (on: boolean) => (on ? 0.3 : 0.42);
    dir('ArrowLeft', x < -th(this.dirOn.ArrowLeft));
    dir('ArrowRight', x > th(this.dirOn.ArrowRight));
    dir('ArrowUp', y < -th(this.dirOn.ArrowUp) * 1.15);
    dir('ArrowDown', y > th(this.dirOn.ArrowDown) * 1.15);
    // 끝까지 밀면 달리기 = Shift 누른 채. 짧게 스치면 회피로 읽히지 않게 최소 0.25초 누른다
    const wantRun = this.st().stickRun && Math.abs(x) > 0.9;
    const shiftBtn = this.btns.find((b) => b.code === 'ShiftLeft')!;
    if (wantRun && !this.runOn) {
      this.runOn = true;
      this.runSince = performance.now();
      clearTimeout(this.runTimer);
      this.hold(shiftBtn, true);
    } else if (!wantRun && this.runOn) {
      this.runOn = false;
      const left = 250 - (performance.now() - this.runSince);
      clearTimeout(this.runTimer);
      if (left > 0) this.runTimer = window.setTimeout(() => this.hold(shiftBtn, false), left);
      else this.hold(shiftBtn, false);
    }
  }
  releaseAll() {
    for (const [id, st] of this.ptr) {
      if (st.kind === 'btn') this.hold(st.b, false);
      this.ptr.delete(id);
    }
    if (this.runOn) (this.runOn = false), clearTimeout(this.runTimer), this.hold(this.btns.find((b) => b.code === 'ShiftLeft')!, false);
    this.stickPid = null;
    this.setStick(0, 0);
    this.count.clear();
    for (const b of this.btns) b.el!.classList.remove('on');
    this.hub.releaseSource('touch');
    this.restBase();
  }
  dispose() {
    window.removeEventListener('touchstart', this.onAnyTouch, { capture: true });
    this.releaseAll();
    this.root.remove();
  }
}
