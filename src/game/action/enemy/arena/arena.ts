// 적 시험장: 엔진 약속(WorldView·Body)을 흉내 내는 작은 세계 + 회색 상자 요원. 적 모듈만 단독으로 돌려 보기 위한 것.
// 실제 게임 통합은 「게임 전투와 조작」의 engine/modules.ts가 한다.
import { ALL_DEFS, DEF_BY_KIND, Enemy, createEnemy, guardianSpawn, isThreat, moveTiming, planEncounter, budgetFor, signalEnemies, DROP_LABEL, rollIntrusion } from '../index';
import { overlap } from '../geom';
import { ROLE_LABEL, FLOOR_TYPES, type Body, type FloorType, type GameEvent, type Hit, type WorldView } from '../types';
import type { FloorPlan } from '../../engine/contract';
import type { GuardianDef } from '../guardians';
import type { Spawn } from '../spawn';
import { ArenaPlayer, Bullet, type Keys } from './player';
import { ROSTER } from '../roster';

export const FLOOR_LABEL: Record<FloorType, string> = {
  lobby: '로비',
  chase: '추격의 층',
  replica: '재현의 층 · 아파트',
  trial: '시험 층',
  dark: '어둠의 층',
  silent: '침묵의 층',
  puzzle: '퍼즐과 선택의 층',
  service: '정비 구역',
  b12: 'B-12',
};
const FLOOR_COLOR: Record<FloorType, [string, string]> = {
  lobby: ['#2f3b42', '#4a5459'],
  chase: ['#3a2222', '#5a3a36'],
  replica: ['#3d3826', '#5e5640'],
  trial: ['#24384a', '#3e5466'],
  dark: ['#0c0e12', '#1a1c22'],
  silent: ['#243030', '#3b4a48'],
  puzzle: ['#2e2440', '#4a3d62'],
  service: ['#3a2e1c', '#5a4a30'],
  b12: ['#030304', '#0b0b0d'],
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Fx {
  kind: string;
  x: number;
  y: number;
  z: number;
  t: number;
  text?: string;
}

export class ArenaWorld implements WorldView {
  tick = 0;
  bodies: Body[] = [];
  player: ArenaPlayer;
  floor: FloorPlan;
  lane: [number, number] = [500, 680];
  bounds: [number, number] = [0, 1280];
  noise = 0;
  light = 0;
  lightCd = 0;
  rand: () => number;
  fxs: Fx[] = [];
  shakeT = 0;
  shakeP = 0;
  log: string[] = [];
  banner = '';
  bannerT = 0;
  darkT = 0;
  paused = false;
  aiFrozen = false;
  showBoxes = false;
  pending: Body[] = [];
  seen = new Map<string, number>();
  waves: Spawn[][] = [];
  waveIdx = 0;
  depth = 4;
  floorType: FloorType = 'lobby';
  bowls: { x: number; y: number; down: number }[] = [];
  onEvent: ((e: GameEvent) => void) | null = null;

  constructor(seed = 1234) {
    this.rand = mulberry(seed);
    this.player = new ArenaPlayer((x, y, dir) => this.add(new Bullet(x, y, dir)));
    this.floor = this.makeFloor('lobby');
    this.bodies.push(this.player as unknown as Body);
  }
  makeFloor(type: FloorType): FloorPlan {
    return { id: 'arena', title: '적 시험장', type, depth: this.depth, length: 1280, lane: this.lane, startX: 400, encounters: [], props: [] };
  }
  setFloor(type: FloorType) {
    this.floorType = type;
    this.floor = this.makeFloor(type);
    this.bowls = type === 'silent' ? [{ x: 260, y: 560, down: 0 }, { x: 1020, y: 620, down: 0 }] : [];
    this.darkT = 0;
  }
  add(b: Body) {
    this.pending.push(b);
  }
  emit(e: GameEvent) {
    this.onEvent?.(e);
    if (e.type === 'custom') this.custom(e.name, e.data as any);
    else if (e.type === 'bossRoar') this.note(`수호자 포효: ${DEF_BY_KIND[e.kind]?.label ?? e.kind}`);
    else if (e.type === 'enemyDie') this.note(`처치: ${DEF_BY_KIND[e.kind]?.label ?? e.kind}`);
  }
  private custom(name: string, d: any) {
    const p = this.player;
    switch (name) {
      case 'debuff':
        p.debuffs[d.kind] = Math.max(p.debuffs[d.kind] ?? 0, d.ticks);
        break;
      case 'screen':
        if (d.effect === 'dark') this.darkT = d.ticks;
        break;
      case 'evac':
        this.flash('후송! (셋 이상 닿았다)');
        p.hp = p.hpMax;
        p.x = 200;
        break;
      case 'hurtPlayer':
        p.hp -= d.dmg;
        if (d.debuff) p.debuffs[d.debuff.kind] = d.debuff.ticks;
        break;
      case 'enemyDrop':
        this.fx('text', d.x, d.y, 60, (d.drops as { item: keyof typeof DROP_LABEL; n: number }[]).map((x) => `${DROP_LABEL[x.item]} ${x.n}`).join(' · '));
        break;
      case 'ruleKept':
        this.note(`규칙 지킴: ${d.rule}`);
        break;
      case 'ruleBroken':
        this.note(`규칙 어김: ${d.rule}`);
        break;
      case 'guardianCleared':
        this.flash(d.how === 'rule' ? '규칙으로 통과 (보스전 생략)' : d.how === 'endure' ? '버텼다' : '수호자 처치');
        break;
      case 'bossPhase':
        this.flash(d.event === 'visitor' ? '현관문이 열린다…' : `${DEF_BY_KIND[d.kind]?.label ?? d.kind} ${d.phase}단계`);
        break;
      case 'groggy':
        this.note('그로기!');
        break;
      case 'enemyRally':
        this.note('과장님 호명: 부하 강화');
        break;
      case 'enemyEscape':
        this.note('도망쳤다');
        break;
    }
  }
  note(s: string) {
    this.log.push(s);
    if (this.log.length > 6) this.log.shift();
  }
  flash(s: string) {
    this.banner = s;
    this.bannerT = 75;
    this.note(s);
  }
  fx(kind: Fx['kind'], x: number, y: number, z: number, text?: string) {
    this.fxs.push({ kind, x, y, z, t: 0, text });
  }
  shake(ticks: number, power = 3) {
    this.shakeT = Math.max(this.shakeT, ticks);
    this.shakeP = Math.max(this.shakeP, power);
  }
  say(text: string) {
    this.note(text);
  }

  spawn(kind: string, x: number, y: number, opts: { elite?: boolean; affixes?: any } = {}) {
    const e = createEnemy(kind, x, y, this.rand, opts);
    this.add(e);
    return e;
  }
  clear() {
    this.bodies = [this.player as unknown as Body];
    this.pending = [];
    this.waves = [];
    this.waveIdx = 0;
    this.darkT = 0;
  }
  spawnPlan(intrusion: 'bureau' | 'daydream' | null = null) {
    const budget = budgetFor(this.depth, 2, 0, 0, 0);
    const plan = planEncounter({ budget, floor: this.floorType, depth: this.depth, rand: this.rand, intrusion: intrusion ?? rollIntrusion(this.depth, this.rand, 0), allowMid: this.depth >= 5, area: { x0: 0, x1: 1280, y0: 500, y1: 680 } });
    this.waves = plan.waves;
    this.waveIdx = 0;
    this.note(`예산 ${budget} → ${plan.spent} 사용 · 파도 ${plan.waves.length} · 정예 ${plan.elites}${plan.intrusion ? ' · 난입 ' + (plan.intrusion === 'bureau' ? '가짜 관리국' : '백일몽') : ''}`);
    if (!plan.waves.length) this.note('이 층에는 일반 적이 없다');
    this.nextWave();
  }
  nextWave() {
    const wv = this.waves[this.waveIdx];
    if (!wv) return;
    for (const s of wv) this.spawn(s.kind, s.x, s.y, { elite: s.elite, affixes: s.affixes });
    this.banner = `파도 ${this.waveIdx + 1}/${this.waves.length}`;
    this.bannerT = 40;
    this.waveIdx++;
  }
  spawnGuardian() {
    for (const s of guardianSpawn(this.floorType)) this.spawn(s.kind, s.x, s.y);
    if (this.floorType === 'service') this.spawn('predator', 1000, 590);
  }

  interact() {
    const p = this.player;
    signalEnemies(this, { kind: 'greet', x: p.x, y: p.y });
    signalEnemies(this, { kind: 'door', x: p.x, y: p.y });
    signalEnemies(this, { kind: 'plug', x: p.x });
    for (const e of this.bodies) if (e instanceof Enemy && e.kind === 'elder_f' && e.mem.mode === 'table' && Math.abs(e.x - p.x) < 260) signalEnemies(this, { kind: 'mealThanks' });
    for (const b of this.bowls)
      if (Math.abs(b.x - p.x) < 90 && Math.abs(b.y - p.y) < 50 && b.down <= 0) {
        b.down = 120;
        signalEnemies(this, { kind: 'bowl', x: b.x, y: b.y });
      }
  }
  eat() {
    for (const e of this.bodies) if (e instanceof Enemy && e.kind === 'elder_f' && e.mem.mode === 'table') signalEnemies(this, { kind: 'mealEat' });
  }
  flashlight() {
    if (this.lightCd > 0) return;
    this.light = 1;
    this.lightT = 90;
    this.lightCd = 150;
  }
  lightT = 0;

  update(keys: Keys) {
    if (this.paused) return;
    this.tick++;
    const p = this.player;
    if (keys.press.has('E')) this.interact();
    if (keys.press.has('T')) this.eat();
    if (keys.press.has('F')) this.flashlight();
    if (this.lightT > 0 && --this.lightT === 0) this.light = 0;
    if (this.lightCd > 0) this.lightCd--;
    if (this.darkT > 0) this.darkT--;
    for (const b of this.bowls) if (b.down > 0) b.down--;
    if (p.stop > 0) p.stop--;
    else p.input(keys, this);
    // 몸들 한 틱 (히트스톱 중인 몸은 건너뜀)
    for (const b of this.bodies) {
      if (b === p) continue;
      if (b.stop > 0) {
        b.stop--;
        continue;
      }
      if (b instanceof Enemy) {
        if (!this.aiFrozen) b.step(this);
      } else b.step(this);
    }
    if (p.stop <= 0) p.step(this);
    this.noise = Math.max(p.noise, this.noise - 0.03);
    this.collide();
    this.bodies.push(...this.pending);
    this.pending = [];
    this.bodies = this.bodies.filter((b) => b.alive || b === p);
    for (const f of this.fxs) f.t++;
    this.fxs = this.fxs.filter((f) => f.t < 30);
    if (this.shakeT > 0) this.shakeT--;
    else this.shakeP = 0;
    if (this.bannerT > 0) this.bannerT--;
    if (this.waves.length && this.waveIdx < this.waves.length && !this.bodies.some((b) => isThreat(b))) this.nextWave();
    if (this.seen.size > 400) for (const [k, t] of this.seen) if (this.tick - t > 120) this.seen.delete(k);
  }

  collide() {
    const bodies = this.bodies;
    const frames = new Map<Body, ReturnType<Body['frame']>>();
    for (const b of bodies) if (b.alive) frames.set(b, b.frame());
    for (const a of bodies) {
      const fa = frames.get(a);
      if (!fa || !fa.hit.length) continue;
      for (const d of bodies) {
        if (d === a || d.team === a.team || !d.alive) continue;
        const fd = frames.get(d);
        if (!fd || !fd.hurt.length) continue;
        for (const h of fa.hit) {
          const key = h.attackId + ':' + d.id;
          if (this.seen.has(key)) continue;
          if (!fd.hurt.some((b) => overlap(h, b))) continue;
          this.seen.set(key, this.tick);
          const r = d.applyHit(h, this);
          if (r.kind === 'immune') continue;
          const stop = h.stop ?? 3;
          if (!h.grab) ((a.stop = Math.max(a.stop, stop)), (d.stop = Math.max(d.stop, stop)));
          const z = (Math.max(h.z0, fd.hurt[0].z0) + Math.min(h.z1, fd.hurt[0].z1)) / 2;
          const x = (Math.max(h.x0, fd.hurt[0].x0) + Math.min(h.x1, fd.hurt[0].x1)) / 2;
          if (d === this.player) this.fx(r.kind === 'guard' ? 'guard' : 'spark', x, d.y, z, r.kind === 'guard' ? '' : String(h.dmg));
          else {
            this.fx(r.kind === 'guard' ? 'guard' : (h.strength ?? 1) >= 3 ? 'spark-big' : 'spark', x, d.y, z, r.kind === 'armor' ? '아머' : r.kind === 'guard' ? '막힘' : String(h.dmg));
            if ((h.strength ?? 1) >= 3) this.shake(6, 4);
          }
          break;
        }
      }
    }
  }
}

// ─── 그리기 ───────────────────────────────────────────

/** top: 화면 위쪽을 잘라 내는 양 (빈 벽). 휴대폰에서 인물이 크게 보이도록 */
export function draw(ctx: CanvasRenderingContext2D, w: ArenaWorld, top = 0) {
  const [c0, c1] = FLOOR_COLOR[w.floorType];
  ctx.save();
  ctx.clearRect(0, 0, 1280, 720);
  ctx.translate(0, -top);
  // 흔들림은 그리기 전용이라 세계 난수를 쓰지 않는다 (재현성)
  if (w.shakeT > 0) ctx.translate(Math.sin(w.tick * 2.3) * w.shakeP, Math.cos(w.tick * 3.1) * w.shakeP);
  // 뒷벽과 바닥
  ctx.fillStyle = c0;
  ctx.fillRect(0, 0, 1280, w.lane[0] - 10);
  ctx.fillStyle = c1;
  ctx.fillRect(0, w.lane[0] - 10, 1280, 720 - w.lane[0] + 10);
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  for (let x = 0; x < 1280; x += 160) ctx.fillRect(x, w.lane[0] - 10, 2, 720);
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  ctx.fillRect(0, w.lane[0] - 12, 1280, 3);
  ctx.font = '600 22px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.textAlign = 'left';
  ctx.fillText(`${FLOOR_LABEL[w.floorType]} · ${w.depth <= 3 ? 'L' + w.depth : 'B-' + (w.depth - 3)}`, 24, top + 40);
  // 그릇 (침묵의 층)
  for (const b of w.bowls) {
    ctx.fillStyle = b.down > 0 ? '#5d5d5d' : '#9a9a9a';
    ctx.beginPath();
    ctx.ellipse(b.x, b.y - 14, 34, 16, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '600 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('그릇 (E)', b.x, b.y + 22);
  }
  // 바닥 효과(예고·그림자)는 몸 그리기 안에서, 몸은 y 순서
  for (const b of w.bodies) if (b instanceof Enemy) b.drawBack(ctx);
  const sorted = [...w.bodies].sort((a, b) => a.y - b.y);
  for (const b of sorted) {
    if (b === (w.player as unknown as Body)) drawPlayer(ctx, w.player, w);
    else b.draw?.(ctx, w);
  }
  if (w.showBoxes) drawBoxes(ctx, w);
  // 효과
  for (const f of w.fxs) {
    const k = f.t / 30;
    ctx.globalAlpha = 1 - k;
    if (f.kind === 'text') {
      ctx.fillStyle = '#fff6d8';
      ctx.font = '700 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text ?? '', f.x, f.y - f.z - k * 30);
    } else if (f.kind === 'ring') {
      ctx.strokeStyle = '#cfe3ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, 20 + k * 70, 5 + k * 16, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const r = f.kind === 'spark-big' ? 34 : f.kind === 'guard' ? 22 : 18;
      ctx.fillStyle = f.kind === 'guard' ? '#8fd0ff' : '#fff1b0';
      ctx.beginPath();
      ctx.arc(f.x, f.y - f.z, r * (1 - k * 0.6), 0, Math.PI * 2);
      ctx.fill();
      if (f.text) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '800 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(f.text, f.x, f.y - f.z - 30 - k * 20);
      }
    }
    ctx.globalAlpha = 1;
  }
  // 어둠 (어둠의 층·B-12·그림자 퍼뜨리기)
  const dark = w.floorType === 'dark' || w.floorType === 'b12' || w.darkT > 0;
  if (dark) {
    const p = w.player;
    const r = w.floorType === 'b12' ? 140 : 260;
    const g = ctx.createRadialGradient(p.x, p.y - 100, r * 0.3, p.x, p.y - 100, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, w.floorType === 'b12' ? 'rgba(0,0,0,.97)' : 'rgba(0,0,0,.88)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, 1280, 720);
    if (w.light > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,235,170,.18)';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 120);
      ctx.lineTo(p.x + p.dir * 420, p.y - 260);
      ctx.lineTo(p.x + p.dir * 420, p.y + 60);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
  drawHud(ctx, w, 720 - top);
}

function drawPlayer(ctx: CanvasRenderingContext2D, p: ArenaPlayer, w: ArenaWorld) {
  ctx.save();
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, 40, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = p.alive ? (p.inv > 0 && (w.tick >> 1) & 1 ? 0.5 : 1) : 0.25;
  const parts = p.state === 'down' ? [[-50, 50, 0, 34, 'torso']] : p.hurtLocal();
  for (const [a, b, z0, z1, part] of parts as [number, number, number, number, string][]) {
    const x0 = p.x + a * p.dir,
      x1 = p.x + b * p.dir;
    ctx.fillStyle = part === 'head' ? '#e0b48a' : part === 'legs' ? '#2c3e66' : p.state === 'grabbed' ? '#b05050' : '#d94b3c';
    ctx.fillRect(Math.min(x0, x1), p.y - p.z - z1, Math.abs(x1 - x0), z1 - z0);
  }
  // 주먹·발
  const f = p.frame().hit[0];
  if (f) {
    ctx.fillStyle = '#ffe2c0';
    ctx.fillRect(f.x0, p.y - f.z1, f.x1 - f.x0, f.z1 - f.z0);
  }
  if (p.guarding) {
    ctx.strokeStyle = '#8fd0ff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(p.x + p.dir * 30, p.y - 120, 60, -Math.PI / 2.5, Math.PI / 2.5);
    ctx.stroke();
  }
  if (p.state === 'grabbed') {
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`잡힘! 연타 ${p.escape}/8`, p.x, p.y - 230);
  }
  ctx.restore();
}

function drawBoxes(ctx: CanvasRenderingContext2D, w: ArenaWorld) {
  ctx.save();
  ctx.lineWidth = 2;
  for (const b of w.bodies) {
    if (!b.alive) continue;
    const f = b.frame();
    ctx.strokeStyle = '#4cff7a';
    for (const h of f.hurt) ctx.strokeRect(h.x0, h.y - h.z1, h.x1 - h.x0, h.z1 - h.z0);
    for (const h of f.hit) {
      ctx.fillStyle = h.grab ? 'rgba(255,220,40,.35)' : 'rgba(255,40,40,.35)';
      ctx.strokeStyle = h.grab ? '#ffd23c' : '#ff3030';
      ctx.fillRect(h.x0, h.y - h.z1, h.x1 - h.x0, h.z1 - h.z0);
      ctx.strokeRect(h.x0, h.y - h.z1, h.x1 - h.x0, h.z1 - h.z0);
    }
    // 발 기준점과 깊이 폭
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.strokeRect(b.x - 2, b.y - 18, 4, 36);
    if (b instanceof Enemy) {
      ctx.fillStyle = '#ffffff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${b.state}${b.move ? ':' + b.move.id + ' ' + b.mf + '/' + b.move.frames.length : ''} A${Math.max(b.armorBase, b.frameNow()?.armor ?? 0)}`, b.x, b.y + 30);
    }
  }
  ctx.restore();
}

function drawHud(ctx: CanvasRenderingContext2D, w: ArenaWorld, H = 720) {
  const p = w.player;
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(16, 56, 330, 64);
  ctx.fillStyle = '#5a1f1a';
  ctx.fillRect(28, 66, 306, 14);
  ctx.fillStyle = '#e0503a';
  ctx.fillRect(28, 66, (306 * Math.max(0, p.hp)) / p.hpMax, 14);
  ctx.fillStyle = '#fff';
  ctx.font = '600 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`체력 ${Math.max(0, Math.round(p.hp))}${p.invincible ? ' (무적)' : ''}`, 30, 100);
  // 소리 게이지
  ctx.fillStyle = '#233';
  ctx.fillRect(170, 88, 160, 10);
  ctx.fillStyle = w.noise > 0.5 ? '#ff7a50' : '#8fd0ff';
  ctx.fillRect(170, 88, 160 * w.noise, 10);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillText('소리', 172, 114);
  ctx.fillText(w.light > 0 ? '빛 켜짐' : w.lightCd > 0 ? '빛 충전' : '빛 F', 260, 114);
  const debs = Object.entries(p.debuffs).filter(([, t]) => t > 0);
  const DEB: Record<string, string> = { bleed: '출혈', taint: '오염', headache: '두통(반전)', confuse: '혼란', fear: '공포', slow: '둔화', silence: '침묵' };
  debs.slice(0, 3).forEach(([k, t], i) => {
    ctx.fillStyle = 'rgba(120,40,140,.85)';
    ctx.fillRect(16 + i * 110, 126, 104, 24);
    ctx.fillStyle = '#fff';
    ctx.fillText(`${DEB[k] ?? k} ${Math.ceil(t / 30)}`, 22 + i * 110, 144);
  });
  // 수호자 체력 (위쪽 가운데)
  const bosses = w.bodies.filter((b): b is Enemy => b instanceof Enemy && b.boss && b.alive && b.state !== 'dead' && b.kind !== 'touchers');
  bosses.forEach((b, i) => {
    const y = 18 + i * 40;
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(440, y, 500, 32);
    ctx.fillStyle = '#4a1612';
    ctx.fillRect(450, y + 18, 480, 8);
    ctx.fillStyle = '#e0503a';
    ctx.fillRect(450, y + 18, (480 * Math.max(0, b.hp)) / b.hpMax, 8);
    ctx.fillStyle = '#7fd0ff';
    if (b.groggyMax && b.groggyMax < 9000) ctx.fillRect(450, y + 27, (480 * Math.min(1, b.groggy / b.groggyMax)) / 1, 3);
    ctx.fillStyle = '#fff';
    ctx.font = '600 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${b.label} · ${b.phase}단계${b.state === 'stunned' ? ' · 빈틈' : ''}`, 452, y + 14);
  });
  const tou = w.bodies.find((b): b is Enemy => b instanceof Enemy && b.kind === 'touchers' && b.state !== 'dead');
  if (tou) {
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(440, 18, 400, 34);
    ctx.fillStyle = '#e8e0d0';
    ctx.font = '600 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`만지는 것들 · 버티기 ${Math.max(0, Math.ceil((tou.mem.left ?? 0) / 30))}초 · 닿음 ${tou.mem.touching ?? 0}/3`, 640, 41);
  }
  // 기록
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'left';
  w.log.forEach((s, i) => {
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    const tw = ctx.measureText(s).width + 12;
    const y = H - 172 + i * 26;
    ctx.fillRect(16, y - 18, tw, 22);
    ctx.fillStyle = '#e8e4d8';
    ctx.fillText(s, 22, y - 2);
  });
  if (w.bannerT > 0) {
    ctx.globalAlpha = Math.min(1, w.bannerT / 15);
    ctx.fillStyle = 'rgba(0,0,0,.6)';
    ctx.fillRect(340, H / 2 - 60, 600, 64);
    ctx.fillStyle = '#ffe9a8';
    ctx.font = '700 30px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(w.banner, 640, H / 2 - 17);
  }
  if (w.paused) {
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.fillRect(0, 0, 1280, H);
    ctx.fillStyle = '#fff';
    ctx.font = '700 40px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('일시정지', 640, H / 2);
  }
  ctx.restore();
}

/** 도감 한 줄 (선택한 적) */
export function describe(kind: string): string {
  const d = DEF_BY_KIND[kind];
  if (!d) return '';
  const armor = ['없음', '경', '중', '절대'][d.armor];
  const atk = d.attacks
    .map((a) => {
      const t = moveTiming(a.move);
      return `${a.move.label}(예고 ${t.tele}·유효 ${t.active}·마무리 ${t.recover}틱)`;
    })
    .join(', ');
  const g = d as GuardianDef;
  return `${d.label} — ${d.faction === 'guardian' ? '수호자' : ROLE_LABEL[d.role]}${d.mid ? '·중간 보스' : ''} · 체력 ${d.hp} · 아머 ${armor}${d.price ? ' · 가격 ' + d.price : ''}\n${d.note}${g.rule ? '\n약점: ' + g.rule : d.weak ? '\n약점: ' + d.weak : ''}${atk ? '\n공격: ' + atk : ''}`;
}

export const GROUPS: { label: string; kinds: string[] }[] = [
  { label: '차원 승강기', kinds: ROSTER.filter((d) => d.faction === 'elevator').map((d) => d.kind) },
  { label: '재현 · 아파트', kinds: ROSTER.filter((d) => d.faction === 'replica' && d.price > 0).map((d) => d.kind) },
  { label: '가짜 관리국 · 백일몽', kinds: ROSTER.filter((d) => d.faction === 'bureau' || d.faction === 'daydream').map((d) => d.kind) },
  { label: '수호자', kinds: ALL_DEFS.filter((d) => d.faction === 'guardian' && d.kind !== 'elder_m').map((d) => d.kind) },
];
export { FLOOR_TYPES };
export type { Hit };
