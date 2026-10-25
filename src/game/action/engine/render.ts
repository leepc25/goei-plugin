// 그리기: 1280×720 논리 캔버스. 배경(회색 상자) → 그림자 → 몸(깊이 순) → 효과 → 어둠 → 판정 보기 → 컷인 → HUD.
import { pfont } from './pxfont';
import { drawPropArt } from '../art/bg';
import { drawGoSign } from '../ui/title';
import { PIXEL, SCREEN_H, SCREEN_W, type Body, type WBox } from './contract';
import { snapTo, spr } from './view';
import type { Art } from './art';
import { Bullet } from './bodies';
import { Fighter } from './fighter';
import type { Player } from './player';
import type { World } from './world';
import { drawSupply } from './itemsLink';
import { drawTestPlayer } from '../art/testPeople';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Renderer {
  draw(w: World, alpha: number): void;
}

export function makeRenderer(ctx: CanvasRenderingContext2D, art: Art, opt: { hud: boolean }): Renderer {
  const ghosts: { x: number; y: number; clip: string; frame: number; origin: number; dir: 1 | -1; t: number }[] = [];

  function background(w: World, camX: number) {
    const f = w.floor;
    const pal = f.palette ?? { wall: '#2b343a', floor: '#3a4247', accent: '#5b6a72' };
    const [top] = w.lane;
    ctx.fillStyle = '#0d1114';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    if (f.drawBackground) {
      ctx.save();
      ctx.translate(-camX, 0);
      f.drawBackground(ctx, camX);
      ctx.restore();
      return;
    }
    const wallTop = 110;
    ctx.fillStyle = pal.wall;
    ctx.fillRect(0, wallTop, SCREEN_W, top - wallTop - 20);
    // 벽 판넬·기둥 (시차 없이 바닥과 같이 흐름)
    const step = 320;
    for (let x = Math.floor(camX / step) * step; x < camX + SCREEN_W + step; x += step) {
      const sx = x - camX;
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(sx, wallTop, 26, top - wallTop - 20);
      ctx.fillStyle = pal.accent;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(sx + 70, wallTop + 70, 150, 90);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.05)';
      ctx.fillRect(sx + 26, wallTop, 6, top - wallTop - 20);
    }
    // 걸레받이
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, top - 34, SCREEN_W, 14);
    // 바닥
    const g = ctx.createLinearGradient(0, top - 20, 0, SCREEN_H);
    g.addColorStop(0, pal.floor);
    g.addColorStop(1, '#1a1f22');
    ctx.fillStyle = g;
    ctx.fillRect(0, top - 20, SCREEN_W, SCREEN_H - top + 20);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 2;
    for (let x = Math.floor(camX / 160) * 160; x < camX + SCREEN_W + 400; x += 160) {
      const sx = x - camX;
      ctx.beginPath();
      ctx.moveTo(sx, top - 20);
      ctx.lineTo(sx - (SCREEN_W / 2 - sx) * 0.35, SCREEN_H);
      ctx.stroke();
    }
    for (const y of [top + 30, top + 90, top + 160]) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SCREEN_W, y);
      ctx.stroke();
    }
    // 출구 표시
    const ex = (f.exitX ?? f.length - 80) - camX;
    if (Number.isFinite(ex) && ex > -100 && ex < SCREEN_W + 100) {
      ctx.fillStyle = 'rgba(80,200,120,0.18)';
      ctx.fillRect(ex, wallTop + 120, 90, top - wallTop - 140);
      ctx.fillStyle = '#7fe0a0';
      ctx.font = pfont(22).f;
      ctx.fillText('출구', ex + 22, wallTop + 110);
    }
  }

  function drawProps(w: World, camX: number, list: readonly World['props'][number][] = w.props) {
    for (const p of list) {
      const sx = p.x - camX;
      if (sx < -p.w - 200 || sx > SCREEN_W + p.w + 200) continue;
      if (p.kind === 'hubdoor' || p.kind === 'hubspot') continue; // 본부 문·자리는 본부 장면(hub.ts)이 그린다
      if (p.actor) {
        // 사람 대역: 플레이어 클립을 색만 바꿔서
        const a = p.actor;
        const list = art.clips[a.clip ?? 'idle'];
        const fr = list ? Math.floor(w.tick / 5) % list.length : 0;
        ctx.save();
        if (a.hue) ctx.filter = `hue-rotate(${a.hue}deg) saturate(1.3)`;
        const ok = sprite(a.clip ?? 'idle', fr, 0, sx, p.y, a.face ?? -1);
        ctx.restore();
        if (!ok) {
          ctx.fillStyle = '#59636a';
          ctx.fillRect(sx - 20, p.y - 200, 40, 200);
        }
        continue;
      }
      // 배경 물건 그림(art/bg)이 있으면 그것, 없으면 회색 상자 대역
      // 그림이 아직 없는 소품은 회색 상자 대역을 그리지 않는다 (재검수 3-1). 판정 보기(H)일 때만 상자
      if (p.kind === 'item' && drawSupply(ctx, p.label, sx, p.y, w.tick)) continue;
      if (!drawPropArt(ctx, p.kind, p.label, sx, p.y, w.floor.type) && w.showBoxes) {
        ctx.fillStyle = p.kind === 'door' || p.kind === 'elevator' ? '#4d5b63' : p.kind === 'pickup' ? '#c9a640' : '#59636a';
        ctx.fillRect(sx - p.w / 2, p.y - p.h, p.w, p.h);
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.strokeRect(sx - p.w / 2, p.y - p.h, p.w, p.h);
      }
    }
  }

  /** 가려진 요원 윤곽을 다시 그릴 때 모든 그림 투명도에 곱한다 */
  let ghostK = 1;
  function sprite(clip: string, frame: number, origin: number, x: number, y: number, dir: 1 | -1, alpha = 1) {
    const list = art.clips[clip];
    const fi = list?.[Math.min(frame, list.length - 1)];
    if (!fi || !art.atlas) return false;
    ctx.save();
    ctx.globalAlpha = alpha * ghostK;
    snapTo(ctx, x, y);
    if (dir < 0) ctx.scale(-1, 1);
    const P = PIXEL * spr(y);
    ctx.drawImage(art.atlas, fi.sx, fi.sy, fi.w, fi.h, (fi.ox - origin) * P, fi.oy * P, fi.w * P, fi.h * P);
    ctx.restore();
    return true;
  }

  function grayBody(b: Body, ox: number, oy: number) {
    const fr = b.frame();
    ctx.fillStyle = b.team === 'enemy' ? '#7a848b' : '#9aa6ad';
    for (const h of fr.hurt) ctx.fillRect(h.x0 - ox, h.y - h.z1 - oy, h.x1 - h.x0, h.z1 - h.z0);
  }

  function drawPlayer(p: Player, x: number, y: number, z: number, w: World) {
    if (p.ally) sprite(p.ally.clip, p.ally.f, 0, x + (p.ally.x - p.x), y + (p.ally.y - p.y), p.ally.dir);
    const a = p.anim();
    // 필드 시험 캐릭터가 있으면 그 그림 (서기 / 움직이면 달리기)
    if (drawTestPlayer(ctx, a.clip, a.frame, p.clipLen(a.clip), x, y - z, p.dir)) return;
    const blink = p.invuln > 0 && w.tick % 4 < 2 ? 0.5 : 1;
    if (!sprite(a.clip, a.frame, a.origin, x, y - z, p.dir, blink)) {
      ctx.fillStyle = '#c0453a';
      ctx.fillRect(x - 20, y - z - 190, 40, 190);
    }
    // 든 물건: 캐릭터 그림과 따로, 손 고정점(또는 머리 위)에 물건 그림의 손잡이를 맞춰 그린다
    const held = p.heldAt();
    if (held && p.carry && w.drawHeld) w.drawHeld(ctx, p.carry, x + p.dir * held.dx, y - z - held.dz, held.deg, p.dir);
    // 잔상: 회피·돌진·달리기
    if (p.moveKey === 'evade' || p.moveKey === 'dash' || (p.running && w.tick % 3 === 0)) {
      if (w.tick % 2 === 0) ghosts.push({ x: p.x, y: p.y - p.z, clip: a.clip, frame: a.frame, origin: a.origin, dir: p.dir, t: 8 });
    }
  }

  function drawFx(w: World, camX: number) {
    for (const f of w.fxs) {
      const k = f.t / f.life;
      const sx = f.x - camX;
      const sy = f.y - f.z;
      ctx.save();
      switch (f.kind) {
        case 'spark':
        case 'spark-big': {
          const big = f.kind === 'spark-big';
          const n = big ? 12 : 8;
          const r = (big ? 150 : 90) * (0.45 + k);
          // 가운데 흰 섬광
          if (k < 0.6) {
            ctx.fillStyle = `rgba(255,255,255,${0.95 - k * 1.5})`;
            ctx.beginPath();
            ctx.arc(sx, sy, (big ? 64 : 40) * (1 - k * 0.8), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.strokeStyle = k < 0.3 ? '#ffffff' : '#ffd36a';
          ctx.lineWidth = big ? 11 : 8;
          for (let i = 0; i < n; i++) {
            const an = (i / n) * Math.PI * 2 + (f.seed % 10);
            ctx.beginPath();
            ctx.moveTo(sx + Math.cos(an) * r * 0.3, sy + Math.sin(an) * r * 0.3);
            ctx.lineTo(sx + Math.cos(an) * r, sy + Math.sin(an) * r);
            ctx.stroke();
          }
          if (k < 0.35) {
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(sx, sy, f.kind === 'spark' ? 14 : 26, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'ring': {
          const s = Number(f.text ?? 2);
          ctx.strokeStyle = `rgba(255,240,200,${1 - k})`;
          ctx.lineWidth = s >= 3 ? 8 : 4;
          ctx.beginPath();
          ctx.ellipse(sx, sy, (s >= 3 ? 150 : 80) * k + 10, (s >= 3 ? 90 : 50) * k + 6, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'boom': {
          // 도트 불꽃: 8px 칸으로 쌓은 울퉁불퉁한 덩어리(흰·노랑·주황·검붉은 3~4단) + 바깥으로 튀는 파편 (원판 금지, 검수 5-2)
          const D = 8;
          const r = 30 + 110 * Math.min(1, k * 2.2);
          const fade = 1 - k;
          const cols = k < 0.15 ? ['#ffffff', '#fff3b0', '#ffd24a'] : k < 0.5 ? ['#fff0a0', '#ffb43c', '#e0601e'] : ['#ff9a3c', '#b8401a', '#4a2a22'];
          const rnd = (i: number) => {
            const v = Math.sin(f.seed * 12.9898 + i * 78.233) * 43758.5453;
            return v - Math.floor(v);
          };
          ctx.globalAlpha = Math.min(1, fade * 1.6);
          for (let gy = -r; gy <= r; gy += D)
            for (let gx = -r; gx <= r; gx += D) {
              const an = Math.atan2(gy, gx);
              const edge = r * (0.72 + 0.28 * Math.sin(an * 5 + f.seed) * Math.cos(an * 3 - f.seed * 0.7));
              const d = Math.hypot(gx, gy * 1.25);
              if (d > edge) continue;
              const t = d / edge;
              ctx.fillStyle = t < 0.4 ? cols[0] : t < 0.75 ? cols[1] : cols[2];
              ctx.fillRect(Math.round((sx + gx) / D) * D, Math.round((sy + gy) / D) * D, D, D);
            }
          ctx.fillStyle = k < 0.4 ? '#ffd24a' : '#6a3a28';
          for (let i = 0; i < 14; i++) {
            const an = rnd(i) * Math.PI * 2;
            const dist = r * (0.9 + rnd(i + 40) * 0.9) * Math.min(1, k * 1.6 + 0.2);
            const sz = D * (rnd(i + 80) < 0.5 ? 1 : 0.5);
            ctx.fillRect(Math.round(sx + Math.cos(an) * dist), Math.round(sy + Math.sin(an) * dist * 0.7 + 60 * k * k), sz, sz);
          }
          break;
        }
        case 'dust':
          ctx.fillStyle = `rgba(200,200,190,${0.5 * (1 - k)})`;
          for (let i = -1; i <= 1; i += 2) {
            ctx.beginPath();
            ctx.ellipse(sx + i * (20 + 50 * k), sy - 6, 22 * (1 - k * 0.5), 10, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        case 'flash':
          ctx.fillStyle = '#fff6c8';
          ctx.beginPath();
          ctx.arc(sx, sy, 22 * (1 - k), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'text':
          ctx.globalAlpha = 1 - k;
          ctx.fillStyle = '#fff';
          ctx.font = pfont(26).f;
          ctx.textAlign = 'center';
          ctx.fillText(f.text ?? '', sx, sy - 30 * k);
          break;
      }
      ctx.restore();
    }
  }

  function boxes(w: World, camX: number) {
    const all = [w.player as Body, ...w.bodies];
    const rect = (b: WBox, col: string) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x0 - camX, b.y - b.z1, b.x1 - b.x0, b.z1 - b.z0);
      ctx.beginPath();
      ctx.moveTo(b.x0 - camX, b.y);
      ctx.lineTo(b.x1 - camX, b.y);
      ctx.stroke();
    };
    for (const b of all) {
      const f = b.frame();
      for (const h of f.hurt) rect(h, '#3dff7a');
      for (const h of f.hit) rect(h, h.grab ? '#ffe03d' : '#ff3d3d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(b.x - camX - 3, b.y - 3, 6, 6);
    }
    ctx.fillStyle = '#ffffffcc';
    ctx.font = '16px monospace';
    const p = w.player;
    ctx.fillText(`판정 보기 · ${p.state} 장 ${p.mf} · x ${p.x.toFixed(0)} y ${p.y.toFixed(0)} z ${p.z.toFixed(0)} · 틱 ${w.tick}`, 20, SCREEN_H - 16);
  }

  function hud(w: World) {
    const p = w.player;
    // 체력
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(20, 20, 420, 92);
    ctx.fillStyle = '#e8eef0';
    ctx.font = pfont(20).f;
    ctx.fillText('쟈알디', 34, 46);
    ctx.fillStyle = '#3a2224';
    ctx.fillRect(120, 30, 300, 18);
    ctx.fillStyle = p.hp < p.hpMax * 0.3 ? '#ff5148' : '#e2b23c';
    ctx.fillRect(120, 30, (300 * p.hp) / p.hpMax, 18);
    // 필살·가드
    ctx.fillStyle = '#222b30';
    ctx.fillRect(120, 54, 300, 8);
    ctx.fillStyle = p.gauge >= 100 ? (w.tick % 10 < 5 ? '#ffffff' : '#6ad0ff') : '#3f9fd6';
    ctx.fillRect(120, 54, 3 * p.gauge, 8);
    ctx.fillStyle = '#222b30';
    ctx.fillRect(120, 66, 300, 5);
    ctx.fillStyle = '#9ad08a';
    ctx.fillRect(120, 66, 3 * p.guardMeter, 5);
    // 탄
    ctx.font = pfont(16).f;
    ctx.fillStyle = '#c9d3d8';
    ctx.fillText('탄', 34, 98);
    for (let i = 0; i < p.mag; i++) {
      ctx.fillStyle = i < p.ammo ? '#ffd36a' : '#3a4247';
      ctx.fillRect(60 + i * 14, 84, 9, 18);
    }
    ctx.fillStyle = '#c9d3d8';
    ctx.fillText(`/ ${p.reserve}${p.moveKey === 'reload' ? '  재장전…' : ''}`, 60 + p.mag * 14 + 6, 98);
    ctx.fillText(p.skillCd > 0 ? `폭파 ${Math.ceil(p.skillCd / 30)}` : '폭파 준비', 300, 98);
    // 아이템
    w.items.forEach((it, i) => {
      const x = 460 + i * 64;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, 20, 58, 58);
      ctx.fillStyle = '#8e9aa1';
      ctx.font = pfont(14).f;
      ctx.fillText(String(i + 1), x + 4, 36);
      if (it) {
        ctx.fillStyle = it.n > 0 ? '#e8eef0' : '#5a646a';
        ctx.fillText(it.label, x + 4, 58);
        ctx.fillText(`×${it.n}`, x + 30, 74);
      }
    });
    // 콤보
    if (p.combo >= 2) {
      ctx.save();
      ctx.font = pfont(54).f;
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffd36a';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 6;
      ctx.strokeText(`${p.combo} HIT`, SCREEN_W - 30, 80);
      ctx.fillText(`${p.combo} HIT`, SCREEN_W - 30, 80);
      ctx.restore();
    }
    // 보스
    const boss = w.boss();
    if (boss) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(240, SCREEN_H - 62, 800, 40);
      ctx.fillStyle = '#e8eef0';
      ctx.font = pfont(18).f;
      ctx.fillText(boss.label, 252, SCREEN_H - 36);
      ctx.fillStyle = '#5a1e1e';
      ctx.fillRect(470, SCREEN_H - 50, 556, 16);
      ctx.fillStyle = '#ff5148';
      ctx.fillRect(470, SCREEN_H - 50, (556 * boss.hp) / boss.hpMax, 16);
    }
  }

  function overlayText(w: World) {
    if (w.goT > 0 && !w.paused && w.tick % 20 < 13) {
      drawGoSign(ctx, 790, 18, w.tick / 30); // 천장 띠(아이템 칸 오른쪽): 문·게시판을 가리지 않게 (독립 검수)
    }
    if (w.banner && opt.hud) {
      const a = Math.min(1, w.banner.t / 15);
      ctx.fillStyle = `rgba(0,0,0,${0.6 * a})`;
      ctx.fillRect(0, 170, SCREEN_W, 70);
      ctx.fillStyle = `rgba(232,238,240,${a})`;
      ctx.font = pfont(34).f;
      ctx.textAlign = 'center';
      ctx.fillText(w.banner.text, SCREEN_W / 2, 217);
      ctx.textAlign = 'left';
    }
    if (w.subtitle && opt.hud) {
      ctx.font = pfont(24).f;
      ctx.textAlign = 'center';
      const tw = ctx.measureText(w.subtitle.text).width;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect(SCREEN_W / 2 - tw / 2 - 18, 130, tw + 36, 40);
      ctx.fillStyle = '#fff';
      ctx.fillText(w.subtitle.text, SCREEN_W / 2, 159);
      ctx.textAlign = 'left';
    }
  }

  function cutin(w: World) {
    const k = 1 - w.cutin / 22;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
    ctx.fillStyle = '#b8352c';
    const bandY = 230;
    ctx.fillRect(0, bandY, SCREEN_W, 260);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    for (let i = 0; i < 18; i++) {
      const y = bandY + ((i * 37 + w.tick * 23) % 260);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(SCREEN_W, y);
      ctx.stroke();
    }
    const x = lerp(-400, 260, Math.min(1, k * 3));
    if (art.cutin) {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(art.cutin, x - 200, bandY - 40, 340, 340);
    }
    ctx.font = pfont(72).f;
    ctx.fillStyle = '#fff';
    ctx.fillText('전부 폭파', x + 220, bandY + 160);
  }

  return {
    draw(w: World, alpha: number) {
      ctx.imageSmoothingEnabled = false;
      const shake = w.shakeT > 0 ? (w.tick % 2 ? 1 : -1) * w.shakeP * 2 : 0;
      const camX = Math.round(lerp(w.prevCamX, w.camX, alpha));
      ctx.save();
      ctx.translate(shake, w.shakeT > 0 ? (w.tick % 3) - 1 : 0);
      background(w, camX);
      // 바닥 물건은 몸과 함께 깊이(y) 순서로 그린다: 물건 앞(아래)에 선 몸은 물건 위에, 뒤에 선 몸은 물건에 가려진다 (검수 7)
      // 층이 넘긴 깊이 줄(뒷줄 사물함 등)도 같은 순서에 섞는다
      type Deep = { y: number; prop?: World['props'][number]; layer?: NonNullable<typeof w.floor.depthLayers>[number] };
      const layers = w.floor.depthLayers ?? [];
      const props: Deep[] = [...w.props.map((p) => ({ y: p.y, prop: p })), ...layers.map((l) => ({ y: l.y, layer: l }))].sort((a, b) => a.y - b.y);
      const all = [w.player as Body, ...w.bodies].filter((b) => b.alive);
      let pi = 0;
      const propsUpTo = (y: number) => {
        while (pi < props.length && props[pi].y <= y) {
          const d = props[pi++];
          if (d.prop) drawProps(w, camX, [d.prop]);
          else if (d.layer) {
            const l = d.layer;
            ctx.save();
            ctx.translate(-camX, 0);
            l.draw(ctx);
            ctx.restore();
          }
        }
      };
      propsUpTo(w.lane[0]);
      for (const u of w.underlays) u(ctx, camX);
      const pos = (b: Body) => {
        const f = b as Partial<Fighter>;
        return { x: lerp(f.px ?? b.x, b.x, alpha), y: lerp(f.py ?? b.y, b.y, alpha), z: lerp(f.pz ?? b.z, b.z, alpha) };
      };
      // 그림자
      for (const b of all) {
        if (b.kind === 'bullet' || !(b instanceof Fighter)) continue;
        const q = pos(b);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.ellipse(q.x - camX, q.y, 46 * Math.max(0.5, 1 - q.z / 400), 12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      // 잔상
      for (const g of ghosts) {
        sprite(g.clip, g.frame, g.origin, g.x - camX, g.y, g.dir, (g.t / 8) * 0.35);
        g.t--;
      }
      for (let i = ghosts.length - 1; i >= 0; i--) if (ghosts[i].t <= 0) ghosts.splice(i, 1);
      // 적 모듈 몸은 월드 좌표로 그린다 (엔진 기본 몸은 발 기준 지역 좌표)
      const worldSpace = (b: Body) => !(b instanceof Fighter) && !(b instanceof Bullet);
      for (const b of all) {
        const back = (b as { drawBack?: (c: CanvasRenderingContext2D) => void }).drawBack;
        if (!back) continue;
        ctx.save();
        ctx.translate(-camX, 0);
        back.call(b, ctx);
        ctx.restore();
      }
      all.sort((a, b) => a.y - b.y);
      for (const b of all) {
        const q = pos(b);
        propsUpTo(q.y);
        const jitter = b.stop > 0 && b !== w.player ? (w.tick % 2 ? 3 : -3) : 0;
        if (b === w.player) drawPlayer(w.player, q.x - camX, q.y, q.z, w);
        else if (b.draw && worldSpace(b)) {
          ctx.save();
          ctx.translate(-camX + jitter, 0);
          b.draw(ctx, w);
          ctx.restore();
        } else if (b.draw) {
          ctx.save();
          ctx.translate(Math.round(q.x - camX + jitter), Math.round(q.y - q.z));
          b.draw(ctx, w);
          ctx.restore();
        } else grayBody(b, camX - jitter, 0);
      }
      propsUpTo(Infinity);
      // 요원이 앞쪽 물건에 가려지면 윤곽을 비쳐 보인다 (완전히 사라지지 않게, 검수 8)
      {
        const pl = w.player;
        if (pl.alive && (w.props.some((p) => p.y > pl.y + 2 && Math.abs(p.x - pl.x) < p.w / 2 + 50 && !['hubdoor', 'hubspot', 'door', 'elevator', 'hatch'].includes(p.kind)) || layers.some((l) => l.occludedSilhouette !== false && l.y > pl.y + 2 && pl.x > l.x0 - 50 && pl.x < l.x1 + 50))) {
          const q = pos(pl);
          ctx.save();
          ctx.globalAlpha = 0.4;
          ghostK = 0.4;
          drawPlayer(pl, q.x - camX, q.y, q.z, w);
          ghostK = 1;
          ctx.restore();
        }
      }
      // 실제 조사 대상의 표식. 전투 중에도 잠김 이유는 HUD에서 읽을 수 있다.
      // 표식은 HUD 안내 띠 안에서 그린다. 머리 위 표식과 안내 띠가 겹치지 않게 한다.
      w.hintShown = false;
      drawFx(w, camX);
      if (w.floor.drawForeground) {
        ctx.save();
        ctx.translate(-camX, 0);
        w.floor.drawForeground(ctx, camX, w);
        ctx.restore();
      } else if (w.light < 1) {
        ctx.fillStyle = `rgba(0,0,0,${(1 - w.light) * 0.9})`;
        ctx.fillRect(0, 0, SCREEN_W, SCREEN_H);
      }
      if (w.showBoxes) boxes(w, camX);
      ctx.restore();
      if (w.cutin > 0) cutin(w);
      if (opt.hud) hud(w);
      overlayText(w);
    },
  };
}
