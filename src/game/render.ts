// 캔버스 그리기. 그림은 늘이거나 줄이지 않고 기기 픽셀 기준 정수 배율로만 키운다.
import { ATLAS, BACKS, SHEETS, type Frame } from './assets';
import { CAMP, ENEMIES, ROOMS, TUNE, type AgentId, type BackId, type EnemyId } from './data';
import { alive, footY, frameOf, type Run, type Unit } from './sim';

const H = TUNE.sceneH;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error('그림을 불러오지 못했습니다'));
    img.src = src;
  });
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sheets = new Map<string, HTMLImageElement>();
  private backs = new Map<string, HTMLImageElement>();
  /** 기기 픽셀 기준 배율 (논리 1픽셀 = 기기 k픽셀) */
  k = 1;
  /** 논리 화면 폭 */
  w = 480;
  /** 위에서 잘라 낸 높이 (논리 픽셀) */
  top = 0;
  private cam = 0;
  ready = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  async load(): Promise<void> {
    await Promise.all([
      ...Object.entries(SHEETS).map(async ([k, v]) => this.sheets.set(k, await loadImage(v))),
      ...Object.entries(BACKS).map(async ([k, v]) => this.backs.set(k, await loadImage(v!))),
    ]);
    this.ready = true;
  }

  /** 들어갈 칸의 CSS 크기에 맞춰 배율과 논리 폭을 정한다 */
  layout(cssW: number, cssH: number, dpr: number): void {
    const devW = Math.max(1, Math.floor(cssW * dpr));
    const devH = Math.max(1, Math.floor(cssH * dpr));
    // 천장 쪽은 20%까지 잘라 내고 더 크게 보여 준다
    this.k = Math.max(1, Math.min(Math.floor(devH / (H * 0.8)), Math.floor(devW / 360)));
    this.w = Math.min(960, Math.floor(devW / this.k));
    // 남는 높이는 위로 늘려 천장을 이어 그린다 (음수 = 위로 늘어난 만큼)
    this.top = H - Math.floor(devH / this.k);
    const cw = this.w * this.k;
    const ch = (H - this.top) * this.k;
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.canvas.style.width = `${cw / dpr}px`;
    this.canvas.style.height = `${ch / dpr}px`;
  }

  private back(run: Run): BackId {
    return run.phase === 'camp' || (run.phase === 'retreat' && run.pt > 0.6) ? CAMP.back : ROOMS[run.rooms[run.room]].back;
  }

  private camera(run: Run, snap: boolean): number {
    const team = run.units.filter((u) => u.side === 'a');
    const foes = run.units.filter((u) => u.side === 'e' && alive(u));
    let goal: number;
    if (run.phase === 'camp' || !team.length) goal = 0;
    else {
      const front = Math.max(...team.map((u) => u.x));
      const back = Math.min(...team.map((u) => u.x));
      const near = foes.length ? Math.min(...foes.map((u) => u.x)) : Infinity;
      if (near - front < this.w * 0.75) goal = (back + Math.min(near + 60, back + this.w - 40)) / 2 - this.w / 2;
      else goal = front - this.w * 0.45;
    }
    goal = Math.max(0, goal);
    this.cam = snap ? goal : this.cam + (goal - this.cam) * 0.08;
    return Math.round(this.cam);
  }

  draw(run: Run, snapCam = false): void {
    if (!this.ready) return;
    const c = this.ctx;
    c.setTransform(this.k, 0, 0, this.k, 0, -this.top * this.k);
    c.imageSmoothingEnabled = false;
    const cam = run.phase === 'fade' && run.pt < 0.05 ? this.camera(run, true) : this.camera(run, snapCam);
    run.cam = cam;
    // 배경: 320×180을 2배로 이어 붙인다
    const bg = this.backs.get(this.back(run));
    if (bg) {
      const tw = bg.width * 2;
      for (let x = -(cam % tw); x < this.w; x += tw) {
        c.drawImage(bg, x, 0, tw, H);
      }
      if (this.top < 0) {
        // 남는 위쪽은 배경 맨 윗줄 색에서 어둠으로 번지게
        const g = c.createLinearGradient(0, this.top, 0, 0);
        g.addColorStop(0, '#05070a');
        g.addColorStop(1, this.topColor(bg));
        c.fillStyle = g;
        c.fillRect(0, this.top, this.w, -this.top);
      }
    }
    const units = [...run.units].sort((a, b) => a.lane - b.lane || (a.side === 'e' ? 1 : 0) - (b.side === 'e' ? 1 : 0));
    for (const u of units) this.shadow(u, cam);
    for (const u of units) this.unit(u, cam);
    this.effects(run, cam);
    this.bossBar(run);
    if (run.phase === 'fade' || run.phase === 'retreat') {
      const a = run.phase === 'fade' ? 1 - run.pt / 0.6 : Math.min(1, run.pt / 0.6) - Math.max(0, (run.pt - 0.6) / 0.6);
      c.fillStyle = `rgba(0,0,0,${Math.max(0, Math.min(1, a))})`;
      c.fillRect(0, this.top, this.w, H - this.top);
    }
  }

  private tops = new Map<HTMLImageElement, string>();
  private topColor(bg: HTMLImageElement): string {
    let v = this.tops.get(bg);
    if (!v) {
      const cv = document.createElement('canvas');
      cv.width = bg.width;
      cv.height = 3;
      const cx = cv.getContext('2d')!;
      cx.drawImage(bg, 0, 0);
      const d = cx.getImageData(0, 0, bg.width, 3).data;
      let r = 0, gr = 0, b = 0;
      for (let i = 0; i < d.length; i += 4) (r += d[i]), (gr += d[i + 1]), (b += d[i + 2]);
      const n = d.length / 4;
      v = `rgb(${Math.round(r / n)},${Math.round(gr / n)},${Math.round(b / n)})`;
      this.tops.set(bg, v);
    }
    return v;
  }

  private scaleOf(u: Unit): number {
    return u.side === 'e' ? ENEMIES[u.kind as EnemyId].scale : 1;
  }

  private shadow(u: Unit, cam: number): void {
    if (u.side === 'e' && u.act === 'dead' && u.gone > 0.8) return;
    const c = this.ctx;
    const s = this.scaleOf(u);
    const x = Math.round(u.x - cam);
    const y = footY(u);
    c.fillStyle = 'rgba(0,0,0,.35)';
    c.fillRect(x - 14 * s, y - 2, 28 * s, 3);
    c.fillRect(x - 10 * s, y - 3, 20 * s, 5);
  }

  private unit(u: Unit, cam: number): void {
    const f: Frame = ATLAS[u.kind as AgentId | EnemyId][frameOf(u)];
    const img = this.sheets.get(u.kind);
    if (!f || !img) return;
    const [sx, sy, w, h, ax, ay] = f;
    const s = this.scaleOf(u);
    const c = this.ctx;
    const x = Math.round(u.x - cam);
    const y = footY(u);
    if (x < -200 || x > this.w + 200) return;
    c.save();
    if (u.side === 'e' && u.act === 'dead') c.globalAlpha = Math.max(0, 1 - Math.max(0, u.gone - 0.8) / 0.8);
    // 적은 왼쪽(분대 쪽)을 본다
    if (u.side === 'e') {
      c.translate(x, 0);
      c.scale(-1, 1);
      c.drawImage(img, sx, sy, w, h, -ax * s, y - ay * s, w * s, h * s);
      if (u.flash > 0) this.flashOver(img, sx, sy, w, h, -ax * s, y - ay * s, s);
    } else {
      c.drawImage(img, sx, sy, w, h, x - ax, y - ay, w, h);
      if (u.flash > 0) this.flashOver(img, sx, sy, w, h, x - ax, y - ay, 1);
    }
    c.restore();
    if (u.side === 'e' && !ENEMIES[u.kind as EnemyId].boss && alive(u) && u.hp < u.max) {
      const bw = 26;
      const top = y - ATLAS[u.kind as EnemyId][0]![6] - 8;
      c.fillStyle = 'rgba(0,0,0,.6)';
      c.fillRect(x - bw / 2 - 1, top - 1, bw + 2, 4);
      c.fillStyle = '#e0524a';
      c.fillRect(x - bw / 2, top, Math.max(1, Math.round((bw * u.hp) / u.max)), 2);
    }
  }

  private flashOver(img: HTMLImageElement, sx: number, sy: number, w: number, h: number, dx: number, dy: number, s: number): void {
    const c = this.ctx;
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.55;
    c.drawImage(img, sx, sy, w, h, dx, dy, w * s, h * s);
    c.globalCompositeOperation = 'source-over';
    c.globalAlpha = 1;
  }

  private effects(run: Run, cam: number): void {
    const c = this.ctx;
    for (const f of run.fx) {
      const p = f.t / f.life;
      const x = Math.round(f.x - cam);
      if (f.kind === 'num' || f.kind === 'heal') {
        const y = Math.round(f.y - p * 16);
        c.globalAlpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        c.font = `700 ${f.big ? 14 : 11}px system-ui, sans-serif`;
        c.textAlign = 'center';
        c.lineWidth = 3;
        c.strokeStyle = 'rgba(0,0,0,.85)';
        c.strokeText(f.kind === 'heal' ? `+${f.text}` : f.text!, x, y);
        c.fillStyle = f.kind === 'heal' ? '#7be3a3' : f.big ? '#ffd166' : '#f4f1ea';
        c.fillText(f.kind === 'heal' ? `+${f.text}` : f.text!, x, y);
        c.globalAlpha = 1;
      } else if (f.kind === 'boom') {
        const r = Math.round(10 + p * 34);
        c.globalAlpha = 1 - p;
        c.fillStyle = '#ffb347';
        pixelRing(c, x, Math.round(f.y), r, 3);
        c.fillStyle = '#fff1c1';
        pixelRing(c, x, Math.round(f.y), Math.round(r * 0.6), 2);
        c.globalAlpha = 1;
      } else if (f.kind === 'ring') {
        c.globalAlpha = 1 - p;
        c.fillStyle = '#9ff0d0';
        pixelRing(c, x, Math.round(f.y), Math.round(12 + p * 30), 2);
        c.globalAlpha = 1;
      } else if (f.kind === 'bind') {
        c.fillStyle = 'rgba(190,140,255,.85)';
        const ph = Math.floor(f.t * 8) % 2;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + ph * 0.5;
          c.fillRect(Math.round(x + Math.cos(a) * 16) - 1, Math.round(f.y + Math.sin(a) * 6) - 1, 3, 2);
        }
      }
    }
  }

  private bossBar(run: Run): void {
    const boss = run.units.find((u) => u.side === 'e' && ENEMIES[u.kind as EnemyId].boss && alive(u));
    if (!boss) return;
    const c = this.ctx;
    const bw = Math.min(260, this.w - 40);
    const x = Math.round((this.w - bw) / 2);
    c.fillStyle = 'rgba(0,0,0,.65)';
    const y = this.top + 10;
    c.fillRect(x - 2, y, bw + 4, 8);
    c.fillStyle = '#c8433b';
    c.fillRect(x, y + 2, Math.max(1, Math.round((bw * boss.hp) / boss.max)), 4);
    c.font = '700 11px system-ui, sans-serif';
    c.textAlign = 'center';
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(0,0,0,.85)';
    c.strokeText(ENEMIES[boss.kind as EnemyId].name, this.w / 2, y + 24);
    c.fillStyle = '#f4f1ea';
    c.fillText(ENEMIES[boss.kind as EnemyId].name, this.w / 2, y + 24);
  }
}

/** 도트 느낌의 원: 작은 사각형을 둘레에 찍는다 */
function pixelRing(c: CanvasRenderingContext2D, cx: number, cy: number, r: number, size: number): void {
  const n = Math.max(8, Math.round(r * 0.9));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    c.fillRect(Math.round(cx + Math.cos(a) * r) - (size >> 1), Math.round(cy + Math.sin(a) * r * 0.45) - (size >> 1), size, size);
  }
}
