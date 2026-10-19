import type { GameArt, Frame } from '../assets';
import { WIDTH, HEIGHT, type Run, type Body } from './sim';
import { depthScale, SCENE } from './space';
import { clipIndex } from './animation';

/** 전용 동작 아틀라스와 640×360 배경을 정수 좌표로 표시한다. */
export class ActionRenderer {
  private images = new Map<string, HTMLImageElement>();
  private art: GameArt | null = null;
  private disposed = false;
  private preview: { clip: string; phase: number } | null = null;
  readonly ctx: CanvasRenderingContext2D;
  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    this.ctx = canvas.getContext('2d')!;
  }
  async load(art: GameArt) {
    this.art = art;
    await Promise.all(
      ['a-jyaldi-action', 'e-corner', 'e-watchman', 'bg-bureau-action'].map(async (name) => {
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
  private sprite(
    b: Body,
    frame: number,
    scale = b.kind === 'jyaldi' ? (this.art?.atlas.action?.scale ?? 1) : SCENE.enemyScale,
    x = b.x,
    y = b.y - b.z,
  ) {
    const f: Frame =
        (b.kind === 'jyaldi' ? this.art?.atlas.action?.frames : this.art?.atlas[b.kind])?.[frame] ?? null,
      img = this.images.get(b.kind === 'jyaldi' ? 'a-jyaldi-action' : `e-${b.kind}`);
    if (!f || !img) return;
    scale *= depthScale(b.y);
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
  drawPose(run: Run, clip: string, phase: number) {
    const previousCutin = run.cutin;
    this.preview = { clip: clip === 'cutin' ? 'idle' : clip, phase };
    if (clip === 'cutin') run.cutin = Math.max(0.001, 0.75 * (1 - phase));
    this.draw(run);
    run.cutin = previousCutin;
    this.preview = null;
  }
  private frame(b: Body, r: Run) {
    const progress = Math.min(0.999, b.t / Math.max(0.01, b.duration));
    if (b.kind === 'jyaldi') {
      const clips = this.art?.atlas.action?.clips;
      if (this.preview) {
        const frames = clips?.[this.preview.clip] ?? clips?.idle ?? [0];
        return frames[
          clipIndex(this.preview.phase, frames, this.art?.atlas.action?.frameTimes?.[this.preview.clip])
        ];
      }
      let name = b.act === 'idle' ? 'idle' : b.act;
      if (b.z > 0 && !['shot', 'skill', 'ult', 'hurt', 'down', 'dead'].includes(b.act))
        name = b.vz > 100 ? 'jump_up' : b.vz < -100 ? 'jump_down' : 'jump_apex';
      // 능력과 필살기는 전용 클립을 사용한다.
      if (name === 'dead') name = 'down';
      const clip = clips?.[name] ?? clips?.idle ?? [0];
      const phase =
        b.act === 'walk' || b.act === 'run'
          ? b.stride
          : name === 'idle'
            ? (r.time % 1.2) / 1.2
            : name === 'guard' || name === 'crouch'
              ? r.time % 1.0
              : name === 'jump_up'
                ? Math.max(0, Math.min(0.999, (600 - b.vz) / 500))
                : name === 'jump_apex'
                  ? Math.max(0, Math.min(0.999, (100 - b.vz) / 200))
                  : name === 'jump_down'
                    ? Math.min(0.999, -b.vz / 600)
                    : progress;
      return clip[clipIndex(phase, clip, this.art?.atlas.action?.frameTimes?.[name])];
    }
    if (b.act === 'dead' || b.act === 'down') return 22;
    if (b.act === 'rise' || b.act === 'hurt') return 19;
    if (b.act === 'shot') return 7 + Math.min(4, Math.floor(progress * 5));
    return b.act === 'walk' ? Math.floor(b.stride * 6) % 6 : 0;
  }
  draw(r: Run) {
    const c = this.ctx,
      p = r.player;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.imageSmoothingEnabled = false;
    this.rect(0, 0, WIDTH, HEIGHT, '#0a111b');
    const bg = this.images.get('bg-bureau-action');
    if (bg) c.drawImage(bg, 0, 0, WIDTH, HEIGHT);
    for (const b of [...r.enemies, p].sort((a, b) => a.y - b.y)) {
      if (b.hp <= 0 && b.t > 1) continue;
      const visualFrame = b.kind === 'jyaldi' ? this.art?.atlas.action?.frames[this.frame(b, r)] : null;
      const lift = visualFrame
        ? Math.max(0, visualFrame[5] - visualFrame[3]) * (this.art?.atlas.action?.scale ?? 2)
        : 0;
      const ground = depthScale(b.y),
        air = Math.max(0.25, 1 - (b.z + lift) / 240);
      this.rect(b.x - 32 * ground, b.y - 3, 64 * ground, 6, `rgba(0,6,10,${0.24 * air})`);
      this.rect(b.x - 24 * ground, b.y - 2, 48 * ground, 4, `rgba(0,6,10,${0.28 * air})`);
      if (b.kind === 'jyaldi' && b.z === 0) {
        const index = this.frame(b, r),
          contact = this.art?.atlas.action?.contacts?.[index] ?? [];
        for (const [dx, dy] of contact)
          this.rect(
            b.x + dx * b.dir * ground * (this.art?.atlas.action?.scale ?? 2) - 7,
            b.y + dy * ground * (this.art?.atlas.action?.scale ?? 2) - 1,
            14,
            3,
            '#02070bc0',
          );
      }
      if (b.act === 'shot' && b.kind !== 'jyaldi' && !b.fired) {
        const x = b.dir > 0 ? b.x : b.x - (b.kind === 'watchman' ? 600 : 100);
        this.rect(x, b.y - 24, b.kind === 'watchman' ? 600 : 100, 48, '#ff574433');
        this.rect(b.x - 7, b.y - 280, 14, 20, '#ffb35c');
      }
      this.sprite(b, this.frame(b, r));
      if (b.armor && b.hp > 0) {
        this.rect(b.x - 10, b.y + 8, 20, 3, '#e8bd72');
      }
      if (b.act === 'guard' || b.act === 'crouch') {
        const sy = b.y - (b.act === 'crouch' ? 95 : 165);
        for (let i = 0; i < 4; i++) this.rect(b.x + b.dir * (34 + i * 3), sy + i * 5, 3, 10, '#8bdbe3aa');
      }
      if (b.kind !== 'jyaldi' && b.hp > 0) {
        const enemyFrame = this.art?.atlas[b.kind]?.[this.frame(b, r)];
        const healthTop = b.y - (enemyFrame?.[5] ?? 120) * SCENE.enemyScale - 12;
        this.rect(b.x - 34, healthTop, 68, 6, '#060c12');
        this.rect(b.x - 34, healthTop, (68 * b.hp) / b.max, 6, '#e9896d');
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
      const color = f.kind === 'guard' ? '#9ce5ff' : '#ffd18b';
      const rays = f.kind === 'blast' ? 20 : 8;
      for (let i = 0; i < rays; i++) {
        const angle = (i / rays) * Math.PI * 2,
          rad = radius * (i % 2 ? 0.7 : 1);
        const px = Math.round((x + Math.cos(angle) * rad) / 3) * 3,
          py = Math.round((y + Math.sin(angle) * rad * 0.65) / 3) * 3;
        this.rect(px, py, f.kind === 'blast' ? 6 : 3, f.kind === 'blast' ? 6 : 3, color);
      }
      if (t < 0.35) {
        this.rect(x - 5, y - 16, 10, 32, '#fff1d0');
        this.rect(x - 16, y - 5, 32, 10, '#fff1d0');
      }
      c.globalAlpha = 1;
    }
    if (r.cutin > 0) {
      this.rect(0, 0, WIDTH, HEIGHT, '#030b17bb');
      this.rect(0, 165, WIDTH, 320, '#172c46');
      for (let i = 0; i < 18; i++)
        this.rect((i * 99 + r.cutin * 800) % WIDTH, 185 + i * 16, 140, 3, '#cc864b');
      this.sprite(
        { ...p, dir: 1 },
        this.art?.atlas.action?.clips.cutin?.[
          Math.min(
            (this.art?.atlas.action?.clips.cutin?.length ?? 1) - 1,
            Math.floor((1 - r.cutin / 0.75) * (this.art?.atlas.action?.clips.cutin?.length ?? 1)),
          )
        ] ?? 0,
        (this.art?.atlas.action?.scale ?? 2) * 1.5,
        340 + (1 - r.cutin / 0.75) * 80,
        530,
      );
      c.fillStyle = '#ffdf9e';
      c.font = 'bold 58px monospace';
      c.fillText('집중 파괴', 660, 330);
      c.font = '22px monospace';
      c.fillText('쟈알디 · 집중 파괴', 665, 380);
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
