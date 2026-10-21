// 시연판 무대: 640×360 캔버스에 배경·인물을 코드로 그린다 (그림 자산 없음, 얼굴만 요원 사진).
// 엔진에 붙일 때는 이 파일 대신 엔진이 StoryHost의 bg·actor·camera·panel을 구현한다.
import { TYPE_COLOR, TYPE_LABEL, depthLabel, type FloorType } from '../graybox/data';

export const W = 640;
export const H = 360;

export interface Actor {
  id: string;
  x: number;
  y: number;
  face: 1 | -1;
  anim: string;
  show: boolean;
  /** 사진 열쇠 또는 색 */
  photo?: string;
  color: string;
  label?: string;
  tw?: { fx: number; fy: number; tx: number; ty: number; t: number; d: number };
}

interface Cam {
  x: number;
  y: number;
  z: number;
}

const rnd = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export class Stage {
  readonly canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  actors = new Map<string, Actor>();
  scene = 'office';
  floor: { depth: number; type: FloorType } = { depth: 1, type: 'lobby' };
  panelText = '';
  private panelFull = '';
  private panelT = 0;
  private panelD = 0;
  private shakeT = 0;
  private shakeA = 0;
  cam: Cam = { x: W / 2, y: H / 2, z: 1 };
  private camTw: { f: Cam; t: Cam; e: number; d: number } | null = null;
  private time = 0;
  private imgs = new Map<string, HTMLImageElement>();
  constructor(private photos: Record<string, string>) {
    this.canvas = document.createElement('canvas');
    this.g = this.canvas.getContext('2d')!;
  }

  img(key: string) {
    let im = this.imgs.get(key);
    if (!im && this.photos[key]) {
      im = new Image();
      im.src = this.photos[key];
      this.imgs.set(key, im);
    }
    return im;
  }

  actor(id: string, to: Partial<Actor>, ms: number, base?: Partial<Actor>) {
    let a = this.actors.get(id);
    if (!a) {
      a = { id, x: W / 2, y: 300, face: 1, anim: 'idle', show: false, color: '#555', ...base };
      this.actors.set(id, a);
    }
    if (to.face) a.face = to.face;
    if (to.anim) a.anim = to.anim;
    if (to.show !== undefined) a.show = to.show;
    if (to.photo !== undefined) a.photo = to.photo;
    if (to.color) a.color = to.color;
    if (to.label !== undefined) a.label = to.label;
    const tx = to.x ?? a.tw?.tx ?? a.x,
      ty = to.y ?? a.tw?.ty ?? a.y;
    if (ms > 0) {
      if (tx !== a.x) a.face = tx > a.x ? 1 : -1;
      a.tw = { fx: a.x, fy: a.y, tx, ty, t: 0, d: ms / 1000 };
    } else {
      a.x = tx;
      a.y = ty;
      a.tw = undefined;
    }
  }

  camera(x: number | undefined, y: number | undefined, z: number | undefined, ms: number) {
    const t = { x: x ?? this.cam.x, y: y ?? this.cam.y, z: z ?? this.cam.z };
    if (ms <= 0) {
      this.cam = t;
      this.camTw = null;
    } else this.camTw = { f: { ...this.cam }, t, e: 0, d: ms / 1000 };
  }

  panel(text: string, ms: number) {
    this.panelFull = text;
    if (ms <= 0) {
      this.panelText = text;
      this.panelD = 0;
    } else {
      this.panelT = 0;
      this.panelD = ms / 1000;
      if (!text.startsWith(this.panelText)) this.panelText = '';
    }
  }

  shake(ms: number, amp: number) {
    this.shakeT = ms / 1000;
    this.shakeA = amp;
  }

  /** 캔버스 좌표 → 화면(px, canvas 기준) */
  toScreen(x: number, y: number) {
    const r = this.canvas.getBoundingClientRect();
    const s = r.width / W;
    const sx = (x - this.cam.x) * this.cam.z + W / 2,
      sy = (y - this.cam.y) * this.cam.z + H / 2;
    return { x: sx * s, y: sy * s };
  }
  fromScreen(px: number, py: number) {
    const r = this.canvas.getBoundingClientRect();
    const s = r.width / W;
    return { x: (px / s - W / 2) / this.cam.z + this.cam.x, y: (py / s - H / 2) / this.cam.z + this.cam.y };
  }
  hit(px: number, py: number): Actor | null {
    const p = this.fromScreen(px, py);
    let best: Actor | null = null;
    for (const a of this.actors.values()) if (a.show && Math.abs(p.x - a.x) < 26 && p.y > a.y - 96 && p.y < a.y + 8) best = a;
    return best;
  }

  update(dt: number) {
    this.time += dt;
    for (const a of this.actors.values()) {
      if (!a.tw) continue;
      a.tw.t += dt;
      const k = Math.min(1, a.tw.t / a.tw.d);
      a.x = a.tw.fx + (a.tw.tx - a.tw.fx) * k;
      a.y = a.tw.fy + (a.tw.ty - a.tw.fy) * k;
      if (k >= 1) {
        a.tw = undefined;
        if (a.anim === 'walk') a.anim = 'idle';
      }
    }
    if (this.camTw) {
      this.camTw.e += dt;
      const k = Math.min(1, this.camTw.e / this.camTw.d);
      const e = k * k * (3 - 2 * k);
      const { f, t } = this.camTw;
      this.cam = { x: f.x + (t.x - f.x) * e, y: f.y + (t.y - f.y) * e, z: f.z + (t.z - f.z) * e };
      if (k >= 1) this.camTw = null;
    }
    if (this.panelD > 0) {
      this.panelT += dt;
      const k = Math.min(1, this.panelT / this.panelD);
      const n = Math.max(this.panelText.length, Math.floor(this.panelFull.length * k));
      this.panelText = this.panelFull.slice(0, n);
      if (k >= 1) this.panelD = 0;
    }
    if (this.shakeT > 0) this.shakeT -= dt;
  }

  draw() {
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const r = c.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)),
      h = Math.max(1, Math.round(r.height * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#000';
    g.fillRect(0, 0, w, h);
    const s = w / W;
    const sh = this.shakeT > 0 ? this.shakeA : 0;
    g.setTransform(s * this.cam.z, 0, 0, s * this.cam.z, s * (W / 2 - this.cam.x * this.cam.z + (Math.random() - 0.5) * sh), s * (H / 2 - this.cam.y * this.cam.z + (Math.random() - 0.5) * sh));
    g.imageSmoothingEnabled = true;
    this.drawBg(g);
    const list = [...this.actors.values()].filter((a) => a.show).sort((a, b) => a.y - b.y);
    for (const a of list) this.drawActor(g, a);
    if (this.scene === 'hall' || this.scene === 'attic') this.vignette(g, this.scene === 'attic' ? 0.55 : Math.min(0.7, 0.15 + this.floor.depth * 0.05));
  }

  private vignette(g: CanvasRenderingContext2D, k: number) {
    const gr = g.createRadialGradient(W / 2, H / 2, 120, W / 2, H / 2, 380);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${k})`);
    g.fillStyle = gr;
    g.fillRect(-50, -50, W + 100, H + 100);
  }

  private drawActor(g: CanvasRenderingContext2D, a: Actor) {
    const walk = a.anim === 'walk' ? Math.sin(this.time * 12) : 0;
    const bob = a.anim === 'idle' ? Math.sin(this.time * 2 + a.x) * 0.8 : Math.abs(walk) * 2;
    if (a.anim === 'lie') {
      g.fillStyle = '#e9ecef';
      g.fillRect(a.x - 60, a.y - 26, 120, 26);
      g.fillStyle = '#1d2327';
      g.fillRect(a.x - 40, a.y - 40, 70, 16);
      this.head(g, a, a.x + 46, a.y - 46, 26);
      return;
    }
    const x = a.x,
      y = a.y;
    // 그림자
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.beginPath();
    g.ellipse(x, y, 18, 4, 0, 0, Math.PI * 2);
    g.fill();
    if (a.anim === 'climb') {
      g.strokeStyle = '#c7b48a';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y - 140);
      g.lineTo(x, y + 60);
      g.stroke();
    }
    // 다리
    g.fillStyle = '#15191c';
    g.fillRect(x - 9 + walk * 3, y - 30, 7, 30);
    g.fillRect(x + 2 - walk * 3, y - 30, 7, 30);
    // 몸통 (검은 정장 + 셔츠 + 검은 넥타이)
    g.fillStyle = a.id === 'passenger' ? '#4a4d4a' : '#1d2327';
    g.beginPath();
    g.roundRect(x - 14, y - 66 - bob, 28, 40, 6);
    g.fill();
    g.fillStyle = '#d9d6cf';
    g.fillRect(x - 4, y - 66 - bob, 8, 16);
    g.fillStyle = '#0c0e10';
    g.fillRect(x - 1.5, y - 64 - bob, 3, 18);
    g.fillStyle = a.color;
    g.fillRect(x - 14, y - 66 - bob, 28, 3);
    this.head(g, a, x, y - 86 - bob, 34);
    if (a.label) {
      g.font = '600 10px system-ui,sans-serif';
      g.textAlign = 'center';
      g.fillStyle = 'rgba(0,0,0,.6)';
      const tw = g.measureText(a.label).width + 10;
      g.beginPath();
      g.roundRect(x - tw / 2, y + 6, tw, 15, 4);
      g.fill();
      g.fillStyle = '#e8ece9';
      g.fillText(a.label, x, y + 17);
    }
  }

  private head(g: CanvasRenderingContext2D, a: Actor, cx: number, cy: number, size: number) {
    const im = a.photo ? this.img(a.photo) : undefined;
    g.save();
    g.beginPath();
    g.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22);
    g.clip();
    if (im?.complete && im.naturalWidth) {
      g.translate(cx, cy);
      if (a.face < 0) g.scale(-1, 1);
      g.drawImage(im, -size / 2, -size / 2, size, size);
    } else {
      g.fillStyle = a.id === 'passenger' ? '#6e716c' : a.color;
      g.fillRect(cx - size / 2, cy - size / 2, size, size);
      if (a.id === 'passenger') {
        g.fillStyle = 'rgba(0,0,0,.35)';
        g.fillRect(cx - size / 2, cy - 2, size, 6);
      }
    }
    g.restore();
    g.strokeStyle = a.color;
    g.lineWidth = 1.5;
    g.beginPath();
    g.roundRect(cx - size / 2, cy - size / 2, size, size, size * 0.22);
    g.stroke();
  }

  private text(g: CanvasRenderingContext2D, t: string, x: number, y: number, size = 12, color = '#e8ece9', align: CanvasTextAlign = 'center') {
    g.font = `600 ${size}px system-ui,sans-serif`;
    g.textAlign = align;
    g.fillStyle = color;
    g.fillText(t, x, y);
  }

  private floorLine(g: CanvasRenderingContext2D, wall: string, floor: string, y = 300) {
    g.fillStyle = wall;
    g.fillRect(-60, -60, W + 120, y + 60);
    g.fillStyle = floor;
    g.fillRect(-60, y, W + 120, H - y + 60);
    g.fillStyle = 'rgba(0,0,0,.25)';
    g.fillRect(-60, y, W + 120, 3);
  }

  private drawBg(g: CanvasRenderingContext2D) {
    const t = this.time;
    switch (this.scene) {
      case 'street': {
        const sky = g.createLinearGradient(0, 0, 0, 260);
        sky.addColorStop(0, '#6f7f8c');
        sky.addColorStop(1, '#c9c2b4');
        g.fillStyle = sky;
        g.fillRect(-60, -60, W + 120, 380);
        const r = rnd(7);
        for (let x = -40; x < W + 40; x += 46 + r() * 30) {
          const bh = 90 + r() * 120;
          g.fillStyle = `hsl(205,10%,${26 + r() * 10}%)`;
          g.fillRect(x, 260 - bh, 44, bh);
          g.fillStyle = 'rgba(255,240,200,.18)';
          for (let wy = 260 - bh + 8; wy < 250; wy += 14) for (let wx = x + 5; wx < x + 40; wx += 10) if (r() > 0.55) g.fillRect(wx, wy, 5, 7);
        }
        g.fillStyle = '#2f3437';
        g.fillRect(-60, 260, W + 120, 120);
        g.fillStyle = '#4b5154';
        g.fillRect(-60, 290, W + 120, 30);
        g.fillStyle = '#d8d2b0';
        for (let x = -40; x < W; x += 60) g.fillRect(x, 340, 30, 3);
        // 본부 건물
        g.fillStyle = '#3d3a35';
        g.fillRect(470, 120, 150, 170);
        g.fillStyle = '#c8b98a';
        g.fillRect(528, 240, 34, 50);
        this.text(g, '관리국', 545, 230, 11, '#d9cfae');
        break;
      }
      case 'office': {
        this.floorLine(g, '#2b3438', '#3b3632');
        // 지하 구역
        g.fillStyle = 'rgba(10,14,18,.45)';
        g.fillRect(452, -60, 260, 420);
        g.fillStyle = '#596469';
        g.fillRect(450, 40, 3, 260);
        this.text(g, '지하 ↓', 500, 56, 11, '#9fb0b6');
        const zones: [number, string][] = [
          [70, '잼트리 자리'],
          [180, '사무실'],
          [285, '탕비실'],
          [385, '정비·보급실'],
          [500, '감정실'],
          [595, '격리 연구실'],
        ];
        for (const [x, name] of zones) {
          g.fillStyle = 'rgba(255,255,255,.06)';
          g.fillRect(x - 44, 130, 88, 120);
          g.fillStyle = '#222a2e';
          g.fillRect(x - 36, 250, 72, 20);
          g.fillStyle = '#11181c';
          g.fillRect(x - 14, 226, 28, 22);
          g.fillStyle = 'rgba(120,200,190,.35)';
          g.fillRect(x - 12, 228, 24, 16);
          this.text(g, name, x, 120, 11, '#cfd8d4');
        }
        // 탕비실 문패
        g.fillStyle = '#d8d2b0';
        g.fillRect(262, 140, 46, 12);
        this.text(g, '관계자 외', 285, 150, 8, '#3a2f20');
        // 형광등
        g.fillStyle = 'rgba(230,240,230,.5)';
        for (let x = 30; x < W; x += 120) g.fillRect(x, 18, 70, 4);
        break;
      }
      case 'elevator_in': {
        this.floorLine(g, '#6d6248', '#3a352b', 310);
        g.fillStyle = '#867a5b';
        for (let x = 120; x < 540; x += 70) g.fillRect(x, 40, 2, 270);
        g.fillStyle = `rgba(255,248,210,${0.5 + Math.sin(t * 40) * 0.04 + (Math.random() < 0.01 ? -0.3 : 0)})`;
        g.fillRect(200, 22, 240, 6);
        // 점검표
        g.fillStyle = '#e6dfc8';
        g.fillRect(150, 110, 70, 92);
        g.fillStyle = '#6d6553';
        for (let i = 0; i < 7; i++) g.fillRect(156, 122 + i * 10, 58, 1);
        g.strokeStyle = '#a33';
        g.strokeRect(172, 186, 40, 10);
        this.text(g, '정기 점검표', 185, 119, 8, '#3a3427');
        this.text(g, '서명', 162, 195, 7, '#3a3427');
        // 거울
        g.fillStyle = 'rgba(190,205,210,.35)';
        g.fillRect(270, 70, 100, 150);
        g.strokeStyle = '#a8996f';
        g.strokeRect(270, 70, 100, 150);
        // 패널
        g.fillStyle = '#54504a';
        g.fillRect(470, 120, 40, 110);
        g.fillStyle = '#d7c98f';
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          g.arc(490, 134 + i * 16, 5, 0, Math.PI * 2);
          g.fill();
        }
        // 스피커
        g.fillStyle = '#3a3630';
        g.fillRect(300, 30, 40, 10);
        for (let x = 303; x < 338; x += 5) {
          g.fillStyle = '#1d1b18';
          g.fillRect(x, 32, 2, 6);
        }
        break;
      }
      case 'lobby_wrong':
      case 'lobby_real': {
        const real = this.scene === 'lobby_real';
        this.floorLine(g, real ? '#5b6a70' : '#6b6243', real ? '#8f8a80' : '#5d5646');
        g.fillStyle = real ? 'rgba(255,255,255,.08)' : 'rgba(255,230,140,.08)';
        for (let x = -40; x < W; x += 80) g.fillRect(x, 300, 40, 60);
        g.fillStyle = real ? 'rgba(250,250,240,.7)' : `rgba(255,235,150,${0.55 + (Math.random() < 0.02 ? -0.4 : 0)})`;
        for (let x = 40; x < W; x += 140) g.fillRect(x, 20, 80, 5);
        // 안내판
        g.fillStyle = '#2b2a26';
        g.fillRect(70, 120, 120, 60);
        this.text(g, real ? '안내' : '내안', 130, 140, 12, '#e2d7a8');
        this.text(g, real ? '1F 로비' : '1F 비로', 130, 160, 10, '#c9bf96');
        // 시계
        g.strokeStyle = '#d8d0b0';
        g.lineWidth = 2;
        g.beginPath();
        g.arc(330, 90, 22, 0, Math.PI * 2);
        g.stroke();
        const a = (real ? 1 : -1) * t * 0.5;
        g.beginPath();
        g.moveTo(330, 90);
        g.lineTo(330 + Math.cos(a) * 16, 90 + Math.sin(a) * 16);
        g.stroke();
        // 엘리베이터 문
        g.fillStyle = '#7b7768';
        g.fillRect(470, 150, 100, 150);
        g.fillStyle = '#5c594e';
        g.fillRect(519, 150, 2, 150);
        if (real) {
          g.fillStyle = 'rgba(255,255,230,.5)';
          g.fillRect(20, 160, 30, 140);
        }
        break;
      }
      case 'panel': {
        g.fillStyle = '#4b4740';
        g.fillRect(-60, -60, W + 120, H + 120);
        g.fillStyle = '#5c584f';
        g.fillRect(150, 20, 340, 320);
        g.strokeStyle = '#2f2c27';
        g.strokeRect(150, 20, 340, 320);
        const items = this.panelText.split(/\s+/).filter(Boolean);
        items.forEach((label, i) => {
          const col = i % 4,
            row = Math.floor(i / 4);
          const x = 200 + col * 80,
            y = 60 + row * 54;
          if (y > 320) return;
          const exit = label === 'EXIT';
          g.fillStyle = exit ? '#7a2a22' : '#d8cc96';
          g.beginPath();
          g.arc(x, y, 16, 0, Math.PI * 2);
          g.fill();
          g.strokeStyle = '#2f2c27';
          g.stroke();
          this.text(g, label, x, y + 4, label.length > 3 ? 9 : 11, exit ? '#ffd9cc' : '#2f2a20');
        });
        break;
      }
      case 'hall': {
        const ft = this.floor.type;
        const base = TYPE_COLOR[ft] ?? '#3a4a52';
        this.floorLine(g, base, '#1e1f1f');
        for (let x = 30; x < W; x += 150) {
          g.fillStyle = 'rgba(0,0,0,.35)';
          g.fillRect(x, 160, 60, 140);
          g.fillStyle = 'rgba(255,255,255,.08)';
          g.fillRect(x + 48, 230, 6, 6);
        }
        if (ft === 'replica') {
          for (let x = 30; x < W; x += 150) this.text(g, `${400 + (x / 150) | 0}호`, x + 30, 152, 10, '#e1d9b8');
        }
        if (ft === 'trial') {
          g.fillStyle = 'rgba(200,40,40,.7)';
          g.font = '700 22px system-ui,sans-serif';
          g.textAlign = 'center';
          g.fillText('30초 안에 셋을 찾아라', W / 2, 90);
        }
        if (ft === 'chase') {
          g.fillStyle = `rgba(120,0,0,${0.15 + Math.sin(t * 3) * 0.08})`;
          g.fillRect(-60, -60, 200, 420);
        }
        g.fillStyle = 'rgba(255,240,200,.35)';
        for (let x = 50; x < W; x += 160) g.fillRect(x, 24, 60, 4);
        this.text(g, `${depthLabel(this.floor.depth)} · ${TYPE_LABEL[ft]}`, 14, 22, 12, '#e8e2c8', 'left');
        break;
      }
      case 'attic': {
        this.floorLine(g, '#3a2c1c', '#241a10');
        g.fillStyle = '#5a4630';
        g.fillRect(-60, 40, W + 120, 26);
        g.fillRect(-60, 90, W + 120, 16);
        g.fillStyle = '#6e5a3e';
        for (let x = 0; x < W; x += 110) g.fillRect(x, 40, 8, 260);
        // 지도
        g.strokeStyle = '#cbbf9b';
        g.lineWidth = 1;
        g.strokeRect(400, 120, 140, 90);
        g.beginPath();
        g.moveTo(410, 140);
        g.lineTo(450, 140);
        g.lineTo(450, 180);
        g.lineTo(520, 180);
        g.moveTo(480, 130);
        g.lineTo(480, 200);
        g.stroke();
        this.text(g, '여기 오래 있지 마', 470, 230, 12, '#d9c9a0');
        // 배낭·로프
        g.fillStyle = '#4b5a3c';
        g.beginPath();
        g.roundRect(250, 268, 40, 32, 6);
        g.fill();
        g.strokeStyle = '#cdbb8a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(590, -20);
        g.lineTo(590, 300);
        g.stroke();
        this.text(g, '귀환 로프', 590, 318, 10, '#cdbb8a');
        // 비상등
        g.fillStyle = `rgba(255,80,40,${0.4 + Math.sin(t * 2) * 0.2})`;
        g.fillRect(40, 20, 12, 8);
        break;
      }
      case 'shaft': {
        g.fillStyle = '#0d0f10';
        g.fillRect(-60, -60, W + 120, H + 120);
        g.fillStyle = '#1c2023';
        g.fillRect(200, -60, 16, 420);
        g.fillRect(424, -60, 16, 420);
        const top = g.createLinearGradient(0, -60, 0, 120);
        top.addColorStop(0, 'rgba(255,240,200,.45)');
        top.addColorStop(1, 'rgba(255,240,200,0)');
        g.fillStyle = top;
        g.fillRect(216, -60, 208, 180);
        g.strokeStyle = '#c7b48a';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(320, -60);
        g.lineTo(320, 420);
        g.stroke();
        break;
      }
      case 'medbay': {
        this.floorLine(g, '#dfe4e2', '#b9c0bd');
        g.fillStyle = 'rgba(255,255,255,.7)';
        for (let x = 60; x < W; x += 160) g.fillRect(x, 20, 80, 5);
        g.fillStyle = '#9aa5a2';
        g.fillRect(160, 250, 200, 14);
        g.fillRect(170, 264, 6, 36);
        g.fillRect(344, 264, 6, 36);
        g.fillStyle = '#c63';
        g.fillRect(520, 90, 24, 24);
        g.fillStyle = '#fff';
        g.fillRect(529, 94, 6, 16);
        g.fillRect(524, 99, 16, 6);
        break;
      }
      case 'exit_car': {
        const sky = g.createLinearGradient(0, 0, 0, 280);
        sky.addColorStop(0, '#131a26');
        sky.addColorStop(1, '#2c3442');
        g.fillStyle = sky;
        g.fillRect(-60, -60, W + 120, 400);
        g.fillStyle = '#1b1d20';
        g.fillRect(-60, 270, W + 120, 120);
        g.fillStyle = '#0d0e10';
        g.beginPath();
        g.roundRect(330, 210, 220, 70, 10);
        g.fill();
        g.fillStyle = 'rgba(160,190,220,.25)';
        g.fillRect(360, 220, 120, 26);
        g.fillStyle = 'rgba(255,240,180,.8)';
        g.fillRect(540, 250, 12, 8);
        const beam = g.createLinearGradient(550, 0, 700, 0);
        beam.addColorStop(0, 'rgba(255,240,180,.35)');
        beam.addColorStop(1, 'rgba(255,240,180,0)');
        g.fillStyle = beam;
        g.beginPath();
        g.moveTo(552, 250);
        g.lineTo(720, 220);
        g.lineTo(720, 300);
        g.lineTo(552, 258);
        g.fill();
        break;
      }
      case 'pasta': {
        this.floorLine(g, '#5a3b2a', '#3a2a20');
        g.fillStyle = 'rgba(255,200,120,.25)';
        for (let x = 60; x < W; x += 140) {
          g.beginPath();
          g.arc(x, 40, 18, 0, Math.PI * 2);
          g.fill();
        }
        g.fillStyle = '#e9e1d0';
        g.fillRect(260, 250, 140, 10);
        g.fillStyle = '#7a4a2e';
        g.fillRect(270, 260, 6, 40);
        g.fillRect(384, 260, 6, 40);
        g.fillStyle = '#c84';
        g.beginPath();
        g.arc(300, 246, 8, 0, Math.PI * 2);
        g.arc(360, 246, 8, 0, Math.PI * 2);
        g.fill();
        break;
      }
      default:
        g.fillStyle = '#111';
        g.fillRect(-60, -60, W + 120, H + 120);
    }
  }
}
