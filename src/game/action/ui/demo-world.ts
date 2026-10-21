// 시연용 세계 그리기: 회색 상자 층(graybox sim)을 상자로 그리되 그림자·조명·림라이트·피격 섬광은 ui/fx 로.
// 실제 도트가 들어오면 이 자리는 전투 스레드의 렌더러가 맡는다.
import { TYPE_COLOR } from '../graybox/data';
import { LANE_MIN, type Floor } from '../graybox/gen';
import { agentDef, wallAhead, H, W, type Ent, type Run } from '../graybox/sim';
import { Fx } from './fx';
import { label } from './hud';

const PROP_COLOR: Record<string, string> = { sign: '#e0c060', door: '#8ab', lockdoor: '#a88', key: '#ee8', servicedoor: '#c8a060', hatch: '#c8a060', panel: '#9cf', mirror: '#cde', rope: '#e0b070', phone: '#9f9', pickup: '#8f8', table: '#b98', checklist: '#ff9', crate: '#a97', exit: '#0f0' };

export function currentFloor(run: Run): Floor {
  return run.phase === 'service' && run.service ? run.service : run.floor;
}
export function cameraX(run: Run): number {
  const f = currentFloor(run);
  return Math.max(0, Math.min(f.width - W, run.player.x - W / 2));
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** 몸통 상자 (그림 대신). 위는 밝게, 아래는 어둡게, 진한 외곽선 */
function body(o: CanvasRenderingContext2D, w: number, h: number, color: string, dir: number) {
  const g = o.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, shade(color, 1.25));
  g.addColorStop(1, shade(color, 0.6));
  o.fillStyle = g;
  o.beginPath();
  o.roundRect(0, h * 0.18, w, h * 0.82, 6);
  o.fill();
  // 머리
  o.beginPath();
  o.arc(w / 2, h * 0.11, Math.min(w * 0.36, h * 0.11), 0, Math.PI * 2);
  o.fill();
  o.strokeStyle = 'rgba(0,0,0,0.85)';
  o.lineWidth = 2;
  o.beginPath();
  o.roundRect(1, h * 0.18 + 1, w - 2, h * 0.82 - 2, 6);
  o.stroke();
  // 바라보는 쪽
  o.fillStyle = 'rgba(0,0,0,0.8)';
  o.fillRect(dir > 0 ? w * 0.62 : w * 0.18, h * 0.08, w * 0.2, h * 0.04);
}

export function drawWorld(c: CanvasRenderingContext2D, run: Run, fx: Fx, size: number) {
  const f = currentFloor(run);
  const p = run.player;
  const cam = cameraX(run);
  const sh = fx.camera();
  const dark = f.type === 'dark';
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#05080c';
  c.fillRect(0, 0, W, H);
  c.translate(-cam + sh.x, sh.y);
  // 벽과 바닥
  for (const ch of f.chunks) {
    if (ch.x + ch.w < cam - 40 || ch.x > cam + W + 40) continue;
    const col = TYPE_COLOR[f.type];
    const g = c.createLinearGradient(0, 0, 0, ch.laneMin);
    g.addColorStop(0, shade(col, 0.55));
    g.addColorStop(1, shade(col, 1.1));
    c.fillStyle = g;
    c.fillRect(ch.x, 0, ch.w + 1, ch.laneMin);
    // 걸레받이
    c.fillStyle = shade(col, 0.45);
    c.fillRect(ch.x, ch.laneMin - 26, ch.w + 1, 8);
    // 바닥: 안쪽이 어둡고 앞쪽이 밝다
    const fg = c.createLinearGradient(0, ch.laneMin - 18, 0, H);
    fg.addColorStop(0, ch.kind === 'attic' ? '#3e3320' : '#161d21');
    fg.addColorStop(1, ch.kind === 'attic' ? '#6a5634' : '#2a353b');
    c.fillStyle = fg;
    c.fillRect(ch.x, ch.laneMin - 18, ch.w + 1, H - ch.laneMin + 18);
    c.strokeStyle = 'rgba(255,255,255,0.04)';
    c.lineWidth = 1;
    for (let x = ch.x; x < ch.x + ch.w; x += 80) {
      c.beginPath();
      c.moveTo(x, ch.laneMin - 18);
      c.lineTo(x + (x - (cam + W / 2)) * 0.25, H);
      c.stroke();
    }
    // 벽 장식: 층 유형마다 다른 창·문틀 느낌
    c.fillStyle = 'rgba(0,0,0,0.22)';
    for (let x = ch.x + 60; x < ch.x + ch.w - 80; x += 220) c.fillRect(x, 120, 110, ch.laneMin - 200);
    c.fillStyle = 'rgba(255,255,255,0.035)';
    for (let x = ch.x + 60; x < ch.x + ch.w - 80; x += 220) c.fillRect(x + 6, 126, 98, 6);
    if (ch.kind === 'step' || ch.kind === 'ledge') (c.fillStyle = '#36464c'), c.fillRect(ch.feature![0], ch.laneMin - 80, ch.feature![1] - ch.feature![0], ch.laneMax - ch.laneMin + 120);
    if (ch.kind === 'gap') (c.fillStyle = '#000'), c.fillRect(ch.feature![0], ch.laneMin - 20, ch.feature![1] - ch.feature![0], H);
    if (ch.low) (c.fillStyle = '#2d2418'), c.fillRect(ch.feature![0], 0, ch.feature![1] - ch.feature![0], LANE_MIN - 110);
    const tag: Record<string, string> = { guardian: '수호자 방', goal: '시험 목표 방', attic: '다락방 · 휴식·송신·로프', hall_start: '엘리베이터 홀', hall_end: '엘리베이터 홀' };
    if (tag[ch.kind]) label(c, tag[ch.kind], ch.x + ch.w / 2, 190, 20, 'rgba(236,230,212,0.55)', 'center');
  }
  const wallX = wallAhead(run, f, p.x);
  if (wallX !== null) {
    c.fillStyle = '#4a1c1c';
    c.fillRect(wallX, 0, 24, H);
    c.fillStyle = 'rgba(255,90,90,0.5)';
    c.fillRect(wallX, 0, 3, H);
  }
  // 소품
  for (const pr of f.props) {
    if (pr.x + pr.w < cam - 40 || pr.x > cam + W + 40) continue;
    Fx.shadow(c, pr.x + pr.w / 2, pr.y + pr.h, pr.w * 1.1);
    c.fillStyle = pr.used ? '#333a3e' : PROP_COLOR[pr.kind] ?? '#888';
    c.beginPath();
    c.roundRect(pr.x, pr.y, pr.w, pr.h, 4);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.8)';
    c.lineWidth = 2;
    c.stroke();
  }
  // 추격하는 것
  if (run.chaserX > -5000) {
    const g = c.createLinearGradient(run.chaserX - 420, 0, run.chaserX, 0);
    g.addColorStop(0, 'rgba(60,0,0,0.95)');
    g.addColorStop(1, 'rgba(160,20,20,0.6)');
    c.fillStyle = g;
    c.fillRect(run.chaserX - 420, 0, 420, H);
    label(c, '뒤의 것', run.chaserX - 120, 300, 26, '#ff8080', 'center', 900);
  }
  // 존재 + 요원 (안쪽부터)
  type Body = { x: number; y: number; z: number; w: number; h: number; color: string; dir: number; flash: number; ent?: Ent; player?: boolean; alpha: number; outline?: string };
  const bodies: Body[] = [];
  for (const e of run.ents) {
    if (!e.alive || !e.spawned) continue;
    if (e.special === 'invisible' && Math.abs(e.x - p.x) > 160 && p.lit <= 0) continue;
    const sc = (size / 128) * (e.guardian ? 1.15 : 1);
    const w = e.w * sc,
      h = e.h * sc;
    const color = e.guardian ? '#b03030' : e.special === 'passenger' ? '#4a9a7a' : e.hostile ? (e.elite ? '#d07040' : '#9a4a4a') : '#7a7a80';
    bodies.push({ x: e.x, y: e.y, z: e.z, w, h, color, dir: e.dir, flash: e.flash, ent: e, alpha: 1, outline: e.stun > 0 ? '#ffe060' : undefined });
  }
  {
    const a = agentDef(run.agent);
    const h = (p.crouch ? size * 0.6 : size) * 2,
      w = size * 0.55;
    bodies.push({ x: p.x, y: p.y, z: p.z, w, h, color: a.color, dir: p.dir, flash: p.flash, player: true, alpha: p.inv > 0 && Math.floor(run.time * 20) % 2 ? 0.55 : 1, outline: p.guarding ? '#8cf' : undefined });
  }
  bodies.sort((a, b) => a.y - b.y);
  for (const b of bodies) Fx.shadow(c, b.x, b.y, b.w * 1.4, b.z);
  for (const b of bodies) {
    const x = b.x - b.w / 2,
      y = b.y - b.h - b.z;
    c.globalAlpha = b.alpha;
    const draw = (o: CanvasRenderingContext2D) => body(o, b.w, b.h, b.color, b.dir);
    c.save();
    c.translate(x, y);
    draw(c);
    c.restore();
    if (b.flash > 0) fx.tint(c, x, y, b.w, b.h, draw, '#ffffff', 0.9);
    if (b.outline) {
      c.strokeStyle = b.outline;
      c.lineWidth = 3;
      c.strokeRect(x - 3, y + b.h * 0.18 - 3, b.w + 6, b.h * 0.82 + 6);
    }
    c.globalAlpha = 1;
    const e = b.ent;
    if (e) {
      if (e.hostile && e.hp < e.max) {
        c.fillStyle = 'rgba(0,0,0,0.7)';
        c.fillRect(b.x - 34, y - 14, 68, 6);
        c.fillStyle = '#e04040';
        c.fillRect(b.x - 34, y - 14, (68 * Math.max(0, e.hp)) / e.max, 6);
      }
      if (e.armor) label(c, '◆'.repeat(e.armor), b.x, y - 20, 12, '#fc8', 'center');
      if (e.state === 'windup') label(c, '!', b.x, y - 26, 30, '#ffe040', 'center', 900);
      if (!e.hostile || e.guardian || e.elite) label(c, `${e.label}${e.elite ? '★' : ''}`, b.x, y + b.h + 22, 13, 'rgba(236,230,212,0.8)', 'center');
    }
  }
  for (const bl of run.bolts) {
    c.fillStyle = bl.enemy ? '#ff7a6a' : '#fff0a0';
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 10;
    c.fillRect(bl.x - 10, bl.y - bl.z - 3, 20, 5);
    c.shadowBlur = 0;
  }
  c.restore();
  // 어둠: 요원 손전등 + 승강기 패널 불빛. 그 위에 빛을 향한 테두리(림라이트)
  if (dark) {
    const lights: { x: number; y: number; r: number; color?: string; flicker?: boolean }[] = [{ x: p.x + p.dir * 40, y: p.y - size, r: p.lit > 0 ? 560 : 250, color: p.lit > 0 ? 'rgba(255,220,150,0.16)' : 'rgba(255,200,140,0.08)', flicker: true }];
    for (const pr of f.props) if (pr.kind === 'panel' || pr.kind === 'phone' || pr.kind === 'exit') lights.push({ x: pr.x + pr.w / 2, y: pr.y + pr.h / 2, r: 170, color: 'rgba(120,190,255,0.12)' });
    fx.darkness(c, lights, 0.94, cam - sh.x, -sh.y);
    c.save();
    c.translate(-cam + sh.x, sh.y);
    for (const b of bodies) {
      const x = b.x - b.w / 2,
        y = b.y - b.h - b.z;
      let best = lights[0],
        bd = Infinity;
      for (const l of lights) {
        const d = Math.hypot(l.x - b.x, l.y - (y + b.h / 2));
        if (d < bd) (bd = d), (best = l);
      }
      const draw = (o: CanvasRenderingContext2D) => body(o, b.w, b.h, b.color, b.dir);
      // 요원은 등 뒤에서 푸른 테두리, 다른 존재는 가장 가까운 빛 쪽 테두리
      if (b.player) fx.rim(c, x, y, b.w, b.h, draw, b.x - b.dir * 300, y + b.h * 0.3, '#a8c8ff', 0.7, 4);
      else if (bd < best.r * 1.6) fx.rim(c, x, y, b.w, b.h, draw, best.x, best.y, '#ffd9a0', Math.max(0.25, 1 - bd / (best.r * 1.6)), 4);
      // 어둠 속 적의 눈
      if (b.ent?.hostile && bd > 220) {
        c.fillStyle = '#ff3a2a';
        c.shadowColor = '#ff3a2a';
        c.shadowBlur = 8;
        const ex = b.x + b.dir * b.w * 0.15;
        c.fillRect(ex - 7, y + b.h * 0.1, 4, 3);
        c.fillRect(ex + 3, y + b.h * 0.1, 4, 3);
        c.shadowBlur = 0;
      }
    }
    c.restore();
  }
  c.save();
  c.translate(-cam + sh.x, sh.y);
  fx.drawWorld(c);
  c.restore();
}

/** 타이틀 뒤 배경: 낡은 엘리베이터 문과 깜빡이는 층 표시 */
export function drawTitleBg(c: CanvasRenderingContext2D, t: number) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1014');
  g.addColorStop(1, '#1a1410');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const dx = 820,
    dw = 340,
    dy = 170,
    dh = 470;
  c.fillStyle = '#2a2f33';
  c.fillRect(dx - 30, dy - 30, dw + 60, dh + 30);
  const open = Math.max(0, Math.sin(t * 0.35)) ** 6 * 30;
  for (const side of [0, 1]) {
    const x = side ? dx + dw / 2 + open : dx - open;
    const dg = c.createLinearGradient(x, 0, x + dw / 2, 0);
    dg.addColorStop(0, '#4c5458');
    dg.addColorStop(1, '#3a4044');
    c.fillStyle = dg;
    c.fillRect(x, dy, dw / 2, dh);
  }
  c.fillStyle = '#000';
  c.fillRect(dx + dw / 2 - open, dy, open * 2, dh);
  c.fillStyle = 'rgba(255,60,30,0.25)';
  c.fillRect(dx + dw / 2 - open, dy, open * 2, dh);
  // 층 표시
  c.fillStyle = '#100604';
  c.fillRect(dx + dw / 2 - 70, dy - 110, 140, 60);
  const flick = Math.sin(t * 13) > 0.92 || Math.sin(t * 2.1) > 0.97;
  const floors = ['1', 'B1', 'B3', 'B7', 'B12', '??'];
  label(c, flick ? floors[Math.floor(t * 7) % floors.length] : floors[Math.floor(t / 3) % floors.length], dx + dw / 2, dy - 66, 36, flick ? '#ff3020' : '#ff8a40', 'center', 900);
  // 점검표
  c.fillStyle = '#d8d0bc';
  c.fillRect(dx - 110, dy + 120, 60, 84);
  c.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 6; i++) c.fillRect(dx - 104, dy + 132 + i * 11, 48, 2);
  // 먼지
  c.fillStyle = 'rgba(236,230,212,0.25)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 197 + t * 12 * (1 + (i % 3))) % W,
      y = (i * 131 + t * 8 * (1 + (i % 2))) % H;
    c.fillRect(x, y, 2, 2);
  }
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.75)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  c.restore();
}
