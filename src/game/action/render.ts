import type { GameArt, Frame } from '../assets';
import { AF } from '../data';
import { WIDTH, HEIGHT, type Run, type Body } from './sim';

/** 기존 팩의 세 시트만 디코딩한다. 점프·가드·컷인은 임시 재사용 포즈다. */
export class ActionRenderer {
  private images = new Map<string, HTMLImageElement>();
  private art: GameArt | null = null;
  private disposed = false;
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d')!;
  }
  async load(art: GameArt) {
    this.art = art;
    await Promise.all(
      ['a-jyaldi', 'e-corner', 'e-watchman', 'bg-belt-school'].map(async (name) => {
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error(`그림 읽기 실패: ${name}`));
          img.src = art.url(name);
        });
        if (!this.disposed) this.images.set(name, img);
      }),
    );
  }
  dispose() {
    this.disposed = true;
    this.images.clear();
    this.art = null;
  }
  private rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  private sprite(b: Body, frame: number, scale = 1.57, x = b.x, y = b.y - b.z) {
    const f: Frame = this.art?.atlas[b.kind]?.[frame] ?? null,
      img = this.images.get(b.kind === 'jyaldi' ? 'a-jyaldi' : `e-${b.kind}`);
    if (!f || !img) return;
    const [sx, sy, w, h, ax, ay] = f,
      c = this.ctx;
    c.save();
    c.translate(Math.round(x), Math.round(y));
    c.scale(b.dir, 1);
    if (b.flash > 0) c.filter = 'brightness(1.8)';
    c.drawImage(
      img,
      sx,
      sy,
      w,
      h,
      Math.round(-ax * scale),
      Math.round(-ay * scale),
      Math.round(w * scale),
      Math.round(h * scale),
    );
    c.restore();
  }
  private frame(b: Body, r: Run) {
    const p = b.kind === 'jyaldi',
      progress = Math.min(0.999, b.t / Math.max(0.01, b.duration));
    if (b.act === 'dead' || b.act === 'down') return p ? AF.down[Math.min(2, Math.floor(progress * 3))] : 22;
    if (b.act === 'rise') return p ? AF.rise[Math.min(1, Math.floor(progress * 2))] : 19;
    if (b.act === 'hurt') return p ? AF.hurt : 19;
    if (b.act === 'skill' || b.act === 'ult') return AF.skill[Math.min(5, Math.floor(progress * 6))];
    if (b.act === 'shot')
      return p ? AF.attack[Math.min(3, Math.floor(progress * 4))] : 7 + Math.min(4, Math.floor(progress * 5));
    if (b.act === 'walk' || b.act === 'dash')
      return p ? AF.walk[Math.floor(r.time * (b.act === 'dash' ? 20 : 11)) % 12] : Math.floor(r.time * 8) % 6;
    return p ? AF.idle : 0;
  }
  draw(r: Run) {
    const c = this.ctx,
      p = r.player;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    this.rect(0, 0, WIDTH, HEIGHT, '#0a111b');
    const bg = this.images.get('bg-belt-school');
    if (bg) c.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    this.rect(0, 385, WIDTH, 300, '#17232caa');
    for (let y = 400; y < 680; y += 48) this.rect(0, y, WIDTH, 2, '#65818a22');
    for (let x = 0; x < WIDTH; x += 128) this.rect(x, 390, 2, 280, '#65818a22');
    this.rect(40, 395, 1200, 3, '#e0b367');
    this.rect(40, 665, 1200, 3, '#e0b367');
    for (const b of [...r.enemies, p].sort((a, b) => a.y - b.y)) {
      if (b.hp <= 0 && b.t > 1) continue;
      this.rect(b.x - 24, b.y - 5, 48, 8, '#0008');
      if (b.act === 'shot' && b.kind !== 'jyaldi' && !b.fired) {
        const x = b.dir > 0 ? b.x : b.x - (b.kind === 'watchman' ? 600 : 100);
        this.rect(x, b.y - 24, b.kind === 'watchman' ? 600 : 100, 48, '#ff574433');
        this.rect(b.x - 7, b.y - 200, 14, 20, '#ffb35c');
      }
      if (b.armor && b.hp > 0) {
        c.strokeStyle = '#e8bd72';
        c.lineWidth = 3;
        c.strokeRect(b.x - 48, b.y - b.z - 170, 96, 176);
      }
      this.sprite(b, this.frame(b, r));
      if (b.act === 'guard' || b.act === 'crouch') {
        this.rect(
          b.x + b.dir * 35 - 4,
          b.y - (b.act === 'crouch' ? 90 : 150),
          8,
          b.act === 'crouch' ? 90 : 150,
          '#80d5e9bb',
        );
        if (b.act === 'crouch') this.rect(b.x - 20, b.y - 100, 40, 4, '#80d5e9');
      }
      if (b.kind !== 'jyaldi' && b.hp > 0) {
        this.rect(b.x - 34, b.y - 188, 68, 6, '#060c12');
        this.rect(b.x - 34, b.y - 188, (68 * b.hp) / b.max, 6, '#e9896d');
      }
      if (b === p && p.inv > 0) {
        this.rect(p.x - 28, p.y + 5, 56, 3, '#90dfed');
      }
    }
    for (const b of r.bolts) {
      this.rect(b.x - 12, b.y - b.z, 24, 4, b.enemy ? '#ff7b6b' : '#ffe5ad');
    }
    for (const f of r.effects) {
      const t = f.t / f.duration,
        radius = f.kind === 'blast' ? 20 + t * 190 : 8 + t * 22,
        x = f.x,
        y = f.y - f.z;
      c.globalAlpha = 1 - t;
      c.strokeStyle = f.kind === 'guard' ? '#9ce5ff' : '#ffd18b';
      c.lineWidth = f.kind === 'blast' ? 8 : 4;
      c.strokeRect(
        Math.round(x - radius),
        Math.round(y - radius * 0.65),
        Math.round(radius * 2),
        Math.round(radius * 1.3),
      );
      this.rect(x - 4, y - radius, 8, radius * 2, '#fff1c1');
      this.rect(x - radius, y - 4, radius * 2, 8, '#fff1c1');
      c.globalAlpha = 1;
    }
    if (r.cutin > 0) {
      this.rect(0, 0, WIDTH, HEIGHT, '#030b17bb');
      this.rect(0, 165, WIDTH, 320, '#172c46');
      for (let i = 0; i < 18; i++) this.rect((i * 99 + r.cutin * 800) % WIDTH, 185 + i * 16, 140, 3, '#cc864b');
      this.sprite({ ...p, dir: 1 }, AF.skill[2], 3.5, 340 + (1 - r.cutin / 0.75) * 80, 530);
      c.fillStyle = '#ffdf9e';
      c.font = 'bold 58px monospace';
      c.fillText('집중 파괴', 660, 330);
      c.font = '22px monospace';
      c.fillText('쟈알디 · 임시 도트 컷인', 665, 380);
    }
    if (r.phase !== 'combat') {
      this.rect(250, 245, 780, 210, '#07121aee');
      c.strokeStyle = '#d9b67a';
      c.lineWidth = 4;
      c.strokeRect(250, 245, 780, 210);
      c.fillStyle = '#f4dfb2';
      c.font = 'bold 42px monospace';
      c.textAlign = 'center';
      c.fillText(r.phase === 'cleared' ? '훈련 완료' : '본부 후송', 640, 330);
      c.font = '24px monospace';
      c.fillText('아래의 새 훈련 버튼으로 다시 시작', 640, 390);
      c.textAlign = 'left';
    }
  }
}
