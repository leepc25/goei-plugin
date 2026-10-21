/**
 * 아이템과 무기 시험판. 회색 상자 방 하나에서 줍기·탄·임시 무기·투척·파괴·드랍·중림 상인을 만져 본다.
 * 전투 엔진 대신 아주 단순한 몸과 적을 쓴다(엔진 통합은 「게임 전투와 조작」 몫).
 */
import { ITEMS, PROPS, RELICS, SIGNATURES, VENDORS, WEAPONS, type VendorId } from './data';
import { createField, placeProp, rand, rollDrops, slowAt, inSalt, spawnPickup, stepField, attack, spawnBullet, type Field, type ItemEvent, type Target } from './field';
import { createItemRun, DEFAULT_LOADOUT, startReload, consumeWard, usesAmmo, type ItemRun } from './inventory';
import { buy, openShop, sell, sellPrice, type Shop } from './shop';
import { drawItemIcon } from './icons';

const W = 1280,
  H = 720,
  DT = 1 / 30;
const LANE = { y0: 480, y1: 680 };
const AGENTS: Record<string, string> = { jyaldi: '쟈알디', aileen: '에일린', deadpole: '데드폴', gorgodio: '고르고디오', kyuras: '큐라스' };
const ENEMY: Record<string, { name: string; hp: number; speed: number; dmg: number; human: boolean; color: string }> = {
  anomaly: { name: '괴이', hp: 40, speed: 80, dmg: 8, human: false, color: '#7d5a8a' },
  fakeAgent: { name: '가짜 요원', hp: 55, speed: 95, dmg: 9, human: true, color: '#5a6a7d' },
  gunner: { name: '사격 요원', hp: 45, speed: 70, dmg: 7, human: true, color: '#4d6e8a' },
  swordsman: { name: '검사', hp: 70, speed: 110, dmg: 12, human: true, color: '#3c3c46' },
  daydream: { name: '백일몽', hp: 50, speed: 90, dmg: 8, human: true, color: '#8a7a4d' },
  midboss: { name: '중간 보스', hp: 220, speed: 60, dmg: 16, human: false, color: '#8a3c3c' },
};

interface Mob {
  id: number;
  kind: string;
  x: number;
  y: number;
  hp: number;
  max: number;
  dir: number;
  wind: number;
  cd: number;
  stun: number;
  down: number;
  kx: number;
  bleed: number;
  flash: number;
}
interface Me {
  x: number;
  y: number;
  z: number;
  vz: number;
  dir: number;
  hp: number;
  max: number;
  bleed: number;
  taint: number;
  energy: number;
  gauge: number;
  inv: number;
  swing: number;
  hurt: number;
}
interface State {
  agent: string;
  run: ItemRun;
  field: Field;
  me: Me;
  mobs: Mob[];
  log: { text: string; t: number }[];
  pops: { text: string; x: number; y: number; t: number; color: string }[];
  vendor: { id: VendorId; x: number; y: number };
  shop: Shop | null;
  wave: number;
}

let S: State;
const keys = new Set<string>();
const pressed = new Set<string>();

function newRoom(agent: string, seed = (Date.now() & 0xffff) + 1): State {
  const field = createField(seed, 3, { x0: 40, x1: 1240, ...LANE });
  const run = createItemRun(agent, DEFAULT_LOADOUT);
  run.cash = 40;
  const st: State = {
    agent,
    run,
    field,
    me: { x: 200, y: 590, z: 0, vz: 0, dir: 1, hp: 100, max: 100, bleed: 0, taint: 1, energy: 60, gauge: 0.2, inv: 0, swing: 0, hurt: 0 },
    mobs: [],
    log: [],
    pops: [],
    vendor: { id: 'madeokhee', x: 1170, y: 500 },
    shop: null,
    wave: 0,
  };
  // 부서지는 것(뒤쪽 벽)과 던질 것(바닥)
  const p: [string, number, number][] = [
    ['crackedwall', 90, 488],
    ['crate', 330, 500],
    ['drawer', 450, 494],
    ['mailbox', 560, 496],
    ['locker', 680, 492],
    ['barrel', 800, 520],
    ['barrel', 860, 540],
    ['chair', 360, 640],
    ['pot', 470, 660],
    ['extinguisher', 580, 630],
    ['tv', 700, 655],
    ['table', 980, 660],
    ['bin', 1060, 610],
  ];
  for (const [id, x, y] of p) placeProp(field, id, x, y);
  // 바로 만져 볼 임시 무기 두 묶음
  const a = spawnPickup(field, 'weapon', 260, 650, 'pipe');
  const b = spawnPickup(field, 'weapon', 300, 540, 'smg');
  for (const q of [a, b]) Object.assign(q, { vx: 0, vy: 0, vz: 0, z: 0 });
  S = st;
  spawnWave();
  return st;
}
let mobId = 1;
function spawnWave() {
  const sets = [
    ['anomaly', 'anomaly', 'gunner'],
    ['fakeAgent', 'swordsman', 'anomaly'],
    ['daydream', 'gunner', 'anomaly', 'anomaly'],
    ['midboss'],
  ];
  const set = sets[S.wave % sets.length];
  S.wave++;
  set.forEach((k, i) => {
    const d = ENEMY[k];
    S.mobs.push({ id: mobId++, kind: k, x: 1000 - i * 70, y: 520 + ((i * 53) % 150), hp: d.hp, max: d.hp, dir: -1, wind: 0, cd: 1 + i * 0.4, stun: 0, down: 0, kx: 0, bleed: 0, flash: 0 });
  });
  say(`적 ${set.length}체: ${set.map(k => ENEMY[k].name).join(', ')}`);
}
function say(text: string) {
  S.log.push({ text, t: 4 });
  if (S.log.length > 5) S.log.shift();
}
function pop(text: string, x: number, y: number, color = '#fff') {
  S.pops.push({ text, x, y, t: 1, color });
}
const nm = (id?: string) => (id ? (ITEMS[id]?.name ?? WEAPONS[id]?.name ?? PROPS[id]?.name ?? RELICS[id]?.name ?? id) : '');

// ---------- 한 틱 ----------
function step() {
  const me = S.me,
    run = S.run;
  if (S.shop) {
    pressed.clear();
    return;
  }
  // 이동
  let mx = 0,
    my = 0;
  if (keys.has('ArrowLeft')) mx--;
  if (keys.has('ArrowRight')) mx++;
  if (keys.has('ArrowUp')) my--;
  if (keys.has('ArrowDown')) my++;
  mx += joy.x;
  my += joy.y;
  const len = Math.hypot(mx, my);
  if (len > 1) {
    mx /= len;
    my /= len;
  }
  const sp = (run.carry ? 170 : 230) * slowAt(S.field, me.x, me.y);
  if (me.hurt <= 0) {
    me.x = Math.max(60, Math.min(1220, me.x + mx * sp * DT));
    me.y = Math.max(LANE.y0, Math.min(LANE.y1, me.y + my * sp * 0.6 * DT));
    if (Math.abs(mx) > 0.2) me.dir = Math.sign(mx);
  }
  if (pressed.has('Space') && me.z === 0) me.vz = 620;
  me.vz -= 1900 * DT;
  me.z = Math.max(0, me.z + me.vz * DT);
  if (me.z === 0) me.vz = 0;
  me.inv = Math.max(0, me.inv - DT);
  me.swing = Math.max(0, me.swing - DT);
  me.hurt = Math.max(0, me.hurt - DT);
  if (me.bleed > 0) {
    me.bleed -= DT;
    me.hp = Math.max(1, me.hp - me.max * 0.01 * DT);
  }
  if (pressed.has('KeyR')) startReload(run) && say('재장전');
  // 상인
  const nearVendor = Math.hypot(me.x - S.vendor.x, (me.y - S.vendor.y) * 1.6) < 110;
  const targets: Target[] = S.mobs.filter(m => m.hp > 0).map(m => ({ id: m.id, x: m.x, y: m.y, z: 0, w: m.kind === 'midboss' ? 110 : 70, h: m.kind === 'midboss' ? 220 : 170, human: ENEMY[m.kind].human }));
  let interact = pressed.has('KeyE');
  if (interact && nearVendor && !run.carry) {
    S.shop = openShop(S.vendor.id, run, S.field.depth, S.field.seed ^ 0x5151);
    renderShop();
    interact = false;
  }
  let use: number | undefined;
  for (let i = 0; i < 4; i++) if (pressed.has('Digit' + (i + 1))) use = i;
  // A: 물건을 들었거나 근접 임시 무기면 아이템 모듈이, 아니면 고유 근접(여기서 흉내)
  let atk = false;
  if (pressed.has('KeyA') && me.swing <= 0) {
    const r = attack(S.field, run, me, targets, { damage: 12, reach: 110 });
    handle(r.events);
    me.swing = 0.28;
    if (!r.handled && !r.events.some(e => e.t === 'throw')) {
      for (const t of targets) if (Math.abs(t.x - (me.x + me.dir * 60)) < 55 + t.w / 2 && Math.abs(t.y - me.y) < 40) handle([{ t: 'hit', target: t.id, damage: 12, knockback: 90, knockdown: false, x: t.x, y: t.y, source: 'fist' }]);
    }
  }
  // S: 탄 없는 요원은 고유 원거리를 여기서 흉내
  const shootNow = pressed.has('KeyS'),
    shootHeld = keys.has('KeyS');
  if (shootNow && !usesAmmo(run) && !(run.held && WEAPONS[run.held.id].cls === 'gun') && run.shotCd <= 0) {
    spawnBullet(S.field, me, 9, 40, 520, 'signature', 0);
    run.shotCd = 0.35;
  }
  const ev = stepField(
    S.field,
    run,
    me,
    { interact, attack: atk, shoot: shootNow, shootHeld: shootHeld && !shootNow, use },
    targets,
    DT,
    { hp: me.hp, max: me.max, bleed: me.bleed > 0, taint: me.taint, energy: me.energy, energyMax: 100, gauge: me.gauge },
  );
  handle(ev);
  // 적
  for (const m of S.mobs) {
    m.flash = Math.max(0, m.flash - DT);
    if (m.hp <= 0) continue;
    const d = ENEMY[m.kind];
    if (m.bleed > 0) {
      m.bleed -= DT;
      m.hp -= 4 * DT;
      if (m.hp <= 0) kill(m);
    }
    m.x += m.kx * DT;
    m.kx *= 0.85;
    if (m.stun > 0) {
      m.stun -= DT;
      continue;
    }
    if (m.down > 0) {
      m.down -= DT;
      continue;
    }
    m.cd -= DT;
    const dx = me.x - m.x,
      dy = me.y - m.y;
    m.dir = Math.sign(dx) || m.dir;
    if (m.wind > 0) {
      m.wind -= DT;
      if (m.wind <= 0) {
        if (Math.abs(dx) < 100 && Math.abs(dy) < 40 && me.z < 60) hurtMe(d.dmg, m);
        m.cd = 1.4 + rand(S.field) * 0.8;
      }
      continue;
    }
    const want = m.kind === 'gunner' ? 260 : 80;
    let vx = 0,
      vy = 0;
    if (Math.abs(dx) > want) vx = Math.sign(dx);
    else if (Math.abs(dx) < want - 60 && m.kind === 'gunner') vx = -Math.sign(dx);
    if (Math.abs(dy) > 12) vy = Math.sign(dy);
    const slow = slowAt(S.field, m.x, m.y);
    const nx = m.x + vx * d.speed * slow * DT,
      ny = m.y + vy * d.speed * 0.6 * slow * DT;
    // 소금 원: 괴이는 못 들어온다
    if (!(d.human === false && inSalt(S.field, nx, ny))) {
      m.x = Math.max(60, Math.min(1220, nx));
      m.y = Math.max(LANE.y0, Math.min(LANE.y1, ny));
    }
    if (m.cd <= 0) {
      if (m.kind === 'gunner' && Math.abs(dy) < 30) {
        if (Math.abs(dx) < 420) {
          hurtMe(d.dmg, m);
          m.cd = 2.2;
          pop('탕', m.x, m.y - 150, '#ffd27a');
        }
      } else if (Math.abs(dx) < 100 && Math.abs(dy) < 40) m.wind = 0.45;
    }
  }
  S.mobs = S.mobs.filter(m => m.hp > 0 || m.flash > 0);
  if (!S.mobs.some(m => m.hp > 0) && !S.log.some(l => l.text.startsWith('정리'))) say('정리 끝. 「적 다시」로 다음 무리');
  for (const l of S.log) l.t -= DT;
  for (const p of S.pops) {
    p.t -= DT;
    p.y -= 40 * DT;
  }
  S.pops = S.pops.filter(p => p.t > 0);
  pressed.clear();
}
function hurtMe(dmg: number, m: Mob) {
  const me = S.me;
  if (me.inv > 0) return;
  if (consumeWard(S.run)) {
    pop('부적', me.x, me.y - 220, '#e9d77a');
    me.inv = 0.6;
    return;
  }
  me.hp = Math.max(0, me.hp - dmg);
  me.inv = 0.6;
  me.hurt = 0.2;
  if (m.kind === 'swordsman') me.bleed = 8;
  pop('-' + dmg, me.x, me.y - 220, '#ff7a7a');
  if (me.hp <= 0) {
    say('후송. 방을 다시 만든다');
    setTimeout(() => newRoom(S.agent), 600);
  }
}
function kill(m: Mob) {
  m.hp = 0;
  m.flash = 0.3;
  const ev = rollDrops(S.field, S.run, m.kind, m.x, m.y);
  S.me.gauge = Math.min(1, S.me.gauge + 0.1);
  handle(ev);
}
function handle(ev: ItemEvent[]) {
  const me = S.me,
    run = S.run;
  for (const e of ev) {
    switch (e.t) {
      case 'hit': {
        const m = S.mobs.find(x => x.id === e.target);
        if (!m || m.hp <= 0) break;
        m.hp -= e.damage;
        m.flash = 0.12;
        m.wind = 0;
        m.kx += Math.sign(m.x - me.x || 1) * e.knockback * 2;
        if (e.stun) m.stun = Math.max(m.stun, e.stun);
        if (e.knockdown) m.down = 0.9;
        if (e.status === 'bleed') m.bleed = 5;
        if (e.damage) pop(String(e.damage), m.x, m.y - 190, e.source === 'signature' ? '#cfe' : '#fff');
        else if (e.stun) pop('기절', m.x, m.y - 190, '#fff6a0');
        if (m.hp <= 0) kill(m);
        break;
      }
      case 'pickup':
        if (e.kind === 'cash') pop('+' + e.amount + '원', e.x, e.y - 40, '#e6d36a');
        else if (e.kind === 'shard') pop('+' + e.amount + ' 파편', e.x, e.y - 40, '#c77dff');
        else if (e.kind === 'heal') {
          me.hp = Math.min(me.max, me.hp + me.max * 0.08);
          pop('+8%', e.x, e.y - 40, '#5fbf6a');
        } else if (e.kind === 'ammo') pop('탄 +', e.x, e.y - 40, '#d6b64a');
        else say(`주움: ${nm(e.ref)}`);
        break;
      case 'full':
        say(e.kind === 'ammo' ? '탄이 가득' : e.kind === 'relic' ? '가방 6칸이 가득' : `칸이 가득: ${nm(e.ref)}`);
        break;
      case 'use': {
        const f = e.effect;
        if (f.type === 'heal') me.hp = Math.min(me.max, me.hp + me.max * f.ratio);
        if (f.type === 'cure') {
          if (f.status === 'bleed') me.bleed = 0;
          if (f.status === 'taint') me.taint = Math.max(0, me.taint - 1);
          if (f.heal) me.hp = Math.min(me.max, me.hp + me.max * f.heal);
        }
        if (f.type === 'energy') me.energy = Math.min(100, me.energy + f.amount);
        if (f.type === 'gauge') me.gauge = Math.min(1, me.gauge + f.amount);
        say(`${e.slot + 1}번 ${nm(e.id)}`);
        break;
      }
      case 'equip':
        say(`손에 ${nm(e.weapon)} (${WEAPONS[e.weapon].cls === 'gun' ? 'S로 쏘기' : 'A로 휘두르기'})${e.dropped ? ` · ${nm(e.dropped)} 내려놓음` : ''}`);
        break;
      case 'weaponBreak':
        say(`${nm(e.weapon)} ${WEAPONS[e.weapon].cls === 'gun' ? '탄이 떨어져 버림' : '부러짐'}`);
        break;
      case 'lift':
        say(`${nm(e.prop)} 들어 올림 · A 던지기, E 내려놓기`);
        break;
      case 'break':
        break;
      case 'dry':
        say('탄이 없다. 줍거나 중림에서 사기');
        pop('딸깍', me.x, me.y - 220, '#aaa');
        break;
      case 'reload':
        pop('재장전', me.x, me.y - 230, '#cfe');
        break;
      case 'drop':
        break;
    }
  }
  void run;
}

// ---------- 그리기 ----------
let ctx: CanvasRenderingContext2D;
function draw() {
  const g = ctx;
  g.fillStyle = '#1b2125';
  g.fillRect(0, 0, W, H);
  // 벽과 바닥
  g.fillStyle = '#2a3237';
  g.fillRect(0, 120, W, LANE.y0 - 120);
  for (let x = 0; x < W; x += 160) {
    g.fillStyle = '#323b41';
    g.fillRect(x + 6, 150, 148, 230);
  }
  g.fillStyle = '#3a4248';
  g.fillRect(0, LANE.y0 - 20, W, H - LANE.y0 + 20);
  g.strokeStyle = '#444d53';
  g.lineWidth = 1;
  for (let y = LANE.y0; y < H; y += 40) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
  }
  // 효과 구역(바닥)
  for (const z of S.field.zones) {
    const a = 1 - z.t / z.life;
    g.save();
    g.translate(z.x, z.y);
    g.scale(1, 0.5);
    g.beginPath();
    g.arc(0, 0, z.r * (z.kind === 'flash' || z.kind === 'blast' ? 0.4 + 0.6 * (1 - a) : 1), 0, Math.PI * 2);
    if (z.kind === 'salt') {
      g.strokeStyle = `rgba(240,240,240,${0.5 + 0.3 * a})`;
      g.lineWidth = 6;
      g.setLineDash([10, 8]);
      g.stroke();
    } else {
      g.fillStyle =
        z.kind === 'smoke' ? `rgba(180,186,190,${0.45 * Math.min(1, a * 3)})` : z.kind === 'flash' ? `rgba(255,255,230,${0.8 * a})` : z.kind === 'shock' ? `rgba(120,200,255,${0.6 * a})` : `rgba(255,140,60,${0.7 * a})`;
      g.fill();
    }
    g.restore();
  }
  // y 순서로
  type D = { y: number; f: () => void };
  const list: D[] = [];
  const v = S.vendor;
  list.push({
    y: v.y,
    f: () => {
      g.fillStyle = '#4a3f2c';
      g.fillRect(v.x - 60, v.y - 150, 120, 150);
      g.fillStyle = '#6b5a3a';
      g.fillRect(v.x - 70, v.y - 60, 140, 14);
      drawItemIcon(g, v.id, v.x - 24, v.y - 140, 48);
      label(VENDORS[v.id].name, v.x, v.y - 160, '#e6d36a');
      if (Math.hypot(S.me.x - v.x, (S.me.y - v.y) * 1.6) < 110) label('E 거래', v.x, v.y - 20, '#fff');
    },
  });
  for (const e of S.field.ents) {
    if (e.type === 'prop') {
      const d = PROPS[e.prop];
      list.push({
        y: e.y,
        f: () => {
          shadow(e.x, e.y, d.w / 2);
          g.fillStyle = e.flash > 0 ? '#fff' : d.use === 'break' ? '#5b5248' : '#55606a';
          g.fillRect(e.x - d.w / 2, e.y - d.h, d.w, d.h);
          g.strokeStyle = d.use === 'break' ? '#8a7a64' : '#86a0b0';
          g.lineWidth = 2;
          g.strokeRect(e.x - d.w / 2, e.y - d.h, d.w, d.h);
          const s = Math.min(48, d.w - 8, d.h - 8);
          drawItemIcon(g, e.prop, e.x - s / 2, e.y - d.h / 2 - s / 2, s);
          if (d.use !== 'throw' && e.hp < d.hp) {
            g.fillStyle = '#000';
            g.fillRect(e.x - 20, e.y - d.h - 10, 40, 4);
            g.fillStyle = '#d6b64a';
            g.fillRect(e.x - 20, e.y - d.h - 10, (40 * e.hp) / d.hp, 4);
          }
        },
      });
    } else {
      const p = e;
      list.push({
        y: p.y,
        f: () => {
          shadow(p.x, p.y, 12);
          const bob = p.z === 0 ? Math.sin(p.age * 5) * 3 : 0;
          const id = p.kind === 'cash' || p.kind === 'shard' || p.kind === 'heal' ? p.kind : p.kind === 'ammo' ? (SIGNATURES[S.agent].ammo === 'rifle' ? 'ammo-rifle' : 'ammo-pistol') : p.ref!;
          const s = p.kind === 'weapon' || p.kind === 'relic' || p.kind === 'item' ? 34 : 24;
          if (p.kind === 'weapon' || p.kind === 'relic') {
            g.fillStyle = 'rgba(255,230,120,0.18)';
            g.beginPath();
            g.arc(p.x, p.y - p.z - s / 2 + bob, s * 0.75, 0, Math.PI * 2);
            g.fill();
          }
          drawItemIcon(g, id, p.x - s / 2, p.y - p.z - s + bob, s);
        },
      });
    }
  }
  for (const m of S.mobs) {
    const d = ENEMY[m.kind];
    const w = m.kind === 'midboss' ? 110 : 70,
      h = m.down > 0 ? 50 : m.kind === 'midboss' ? 220 : 170;
    list.push({
      y: m.y,
      f: () => {
        shadow(m.x, m.y, w / 2);
        g.globalAlpha = m.hp <= 0 ? m.flash / 0.3 : 1;
        g.fillStyle = m.flash > 0 ? '#fff' : m.wind > 0 ? '#c46a4a' : d.color;
        g.fillRect(m.x - w / 2, m.y - h, w, h);
        g.fillStyle = '#111';
        g.fillRect(m.x + m.dir * w * 0.2 - 4, m.y - h + 20, 8, 8);
        g.globalAlpha = 1;
        if (m.hp > 0) {
          g.fillStyle = '#000';
          g.fillRect(m.x - 30, m.y - h - 14, 60, 5);
          g.fillStyle = '#d65a5a';
          g.fillRect(m.x - 30, m.y - h - 14, (60 * m.hp) / m.max, 5);
          label(d.name + (m.stun > 0 ? ' · 기절' : m.bleed > 0 ? ' · 출혈' : ''), m.x, m.y - h - 20, '#ccc');
        }
      },
    });
  }
  const me = S.me;
  list.push({
    y: me.y,
    f: () => {
      shadow(me.x, me.y, 34);
      const top = me.y - me.z - 180;
      g.fillStyle = me.inv > 0 && Math.floor(me.inv * 20) % 2 ? '#fff' : '#cfd6da';
      g.fillRect(me.x - 30, top, 60, 180);
      g.fillStyle = '#28313a';
      g.fillRect(me.x - 30, top + 60, 60, 70);
      g.fillStyle = '#111';
      g.fillRect(me.x + me.dir * 12 - 4, top + 22, 8, 8);
      // 손에 든 것
      const hx = me.x + me.dir * 34,
        hy = top + 90;
      if (S.run.carry) {
        const d = PROPS[S.run.carry.prop];
        g.fillStyle = '#55606a';
        g.fillRect(me.x - d.w / 2, top - d.h + 10, d.w, d.h);
        drawItemIcon(g, d.id, me.x - 20, top - d.h / 2 - 10, 40);
      } else if (S.run.held) {
        g.save();
        g.translate(hx, hy);
        g.scale(me.dir, 1);
        if (me.swing > 0 && WEAPONS[S.run.held.id].cls === 'melee') g.rotate(-1.2 + (0.28 - me.swing) * 8);
        drawItemIcon(g, S.run.held.id, -6, -30, 44);
        g.restore();
      }
      if (me.swing > 0.15 && !S.run.held && !S.run.carry) {
        g.fillStyle = 'rgba(255,255,255,0.5)';
        g.fillRect(me.x + (me.dir > 0 ? 30 : -110), top + 70, 80, 16);
      }
      if (S.run.reloadT > 0) {
        const sig = SIGNATURES[S.agent];
        g.fillStyle = '#000';
        g.fillRect(me.x - 30, top - 14, 60, 5);
        g.fillStyle = '#cfe';
        g.fillRect(me.x - 30, top - 14, 60 * (1 - S.run.reloadT / sig.reload), 5);
      }
      label(AGENTS[S.agent], me.x, top - 22, '#fff');
    },
  });
  for (const p of S.field.projs)
    list.push({
      y: p.y,
      f: () => {
        if (p.kind === 'bullet') {
          g.strokeStyle = p.ref === 'signature' ? '#bff' : '#ffd27a';
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(p.x, p.y - p.z);
          g.lineTo(p.x - Math.sign(p.vx) * 30, p.y - p.z);
          g.stroke();
        } else {
          shadow(p.x, p.y, 14);
          g.save();
          g.translate(p.x, p.y - p.z);
          g.rotate(p.life * 12 * Math.sign(p.vx));
          drawItemIcon(g, p.ref, -22, -22, 44);
          g.restore();
        }
      },
    });
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.f();
  for (const p of S.pops) {
    g.globalAlpha = Math.min(1, p.t * 2);
    label(p.text, p.x, p.y, p.color, 22);
    g.globalAlpha = 1;
  }
  drawHud();
}
function shadow(x: number, y: number, r: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}
function label(t: string, x: number, y: number, c: string, size = 16) {
  ctx.font = `bold ${size}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(t, x, y);
  ctx.fillStyle = c;
  ctx.fillText(t, x, y);
}
export const SLOT_RECT = (i: number) => ({ x: 470 + i * 88, y: 14, w: 78, h: 78 });
function drawHud() {
  const g = ctx,
    run = S.run,
    me = S.me;
  g.fillStyle = 'rgba(10,14,16,0.85)';
  g.fillRect(0, 0, W, 106);
  // 체력
  g.fillStyle = '#000';
  g.fillRect(20, 20, 300, 18);
  g.fillStyle = me.bleed > 0 ? '#e05050' : '#5fbf6a';
  g.fillRect(20, 20, (300 * me.hp) / me.max, 18);
  if (me.taint) {
    g.fillStyle = '#7a4fa0';
    g.fillRect(320 - 60 * me.taint, 20, 60 * me.taint, 18);
  }
  g.font = 'bold 14px system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillStyle = '#fff';
  g.fillText(`체력 ${Math.ceil(me.hp)}${me.bleed > 0 ? ' · 출혈' : ''}${me.taint ? ` · 오염 ${me.taint}` : ''}${run.ward ? ` · 부적 ${run.ward}` : ''}`, 24, 34);
  // 능력·필살
  g.fillStyle = '#000';
  g.fillRect(20, 44, 300, 6);
  g.fillStyle = '#4fb3b3';
  g.fillRect(20, 44, 3 * me.energy, 6);
  g.fillStyle = '#000';
  g.fillRect(20, 54, 300, 6);
  g.fillStyle = '#e08a3c';
  g.fillRect(20, 54, 300 * me.gauge, 6);
  // 탄
  const sig = SIGNATURES[S.agent];
  g.fillStyle = '#ddd';
  g.font = 'bold 16px system-ui, sans-serif';
  g.fillText(
    sig.ammo === 'none' ? `${sig.ranged} · 탄 없음 (${sig.resource})` : `${sig.ranged}  ${run.mag}/${sig.mag}  예비 ${run.reserve}${run.reloadT > 0 ? '  재장전…' : run.mag === 0 && run.reserve === 0 ? '  탄 없음' : ''}`,
    20,
    82,
  );
  // 현금·파편
  g.fillStyle = '#e6d36a';
  g.fillText(`현금 ${run.cash}`, 340, 34);
  g.fillStyle = '#c77dff';
  g.fillText(`파편 ${run.shards}`, 340, 58);
  if (run.debt) {
    g.fillStyle = '#d65a5a';
    g.fillText(`빚 ${run.debt}`, 340, 82);
  }
  // 1~4
  for (let i = 0; i < 4; i++) {
    const r = SLOT_RECT(i),
      s = run.loadout[i];
    g.fillStyle = '#20282d';
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#4a565d';
    g.lineWidth = 2;
    g.strokeRect(r.x, r.y, r.w, r.h);
    g.fillStyle = '#8a969c';
    g.font = 'bold 13px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(String(i + 1), r.x + 5, r.y + 15);
    if (s) {
      drawItemIcon(g, s.id, r.x + 15, r.y + 10, 48);
      g.fillStyle = '#fff';
      g.textAlign = 'right';
      g.font = 'bold 15px system-ui, sans-serif';
      g.fillText('×' + s.n, r.x + r.w - 5, r.y + r.h - 6);
      if (run.itemCd > 0) {
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(r.x, r.y, r.w, r.h * (run.itemCd / 0.35));
      }
    }
  }
  // 손
  const hx = 836;
  g.fillStyle = '#20282d';
  g.fillRect(hx, 14, 150, 78);
  g.strokeStyle = '#6b5a3a';
  g.strokeRect(hx, 14, 150, 78);
  g.textAlign = 'left';
  g.font = 'bold 13px system-ui, sans-serif';
  g.fillStyle = '#8a969c';
  g.fillText('손', hx + 5, 30);
  if (run.held) {
    const w = WEAPONS[run.held.id];
    drawItemIcon(g, w.id, hx + 8, 34, 50);
    g.fillStyle = '#fff';
    g.fillText(w.name, hx + 62, 46);
    g.fillStyle = '#bbb';
    g.fillText(`${w.cls === 'gun' ? '탄' : '내구'} ${run.held.uses}/${w.uses}`, hx + 62, 66);
    g.fillText(w.cls === 'gun' ? '총 묶음' : '한 손 근접', hx + 62, 84);
  } else if (run.carry) {
    drawItemIcon(g, run.carry.prop, hx + 8, 34, 50);
    g.fillStyle = '#fff';
    g.fillText(PROPS[run.carry.prop].name, hx + 62, 56);
  } else {
    g.fillStyle = '#6a767c';
    g.fillText('고유 무기만', hx + 30, 60);
  }
  // 가방 6
  for (let i = 0; i < 6; i++) {
    const x = 1000 + (i % 3) * 44,
      y = 14 + Math.floor(i / 3) * 40;
    g.fillStyle = '#20282d';
    g.fillRect(x, y, 38, 36);
    g.strokeStyle = '#5a4e2c';
    g.strokeRect(x, y, 38, 36);
    const b = run.bag[i];
    if (b) drawItemIcon(g, b.id, x + 3, y + 2, 32);
  }
  g.fillStyle = '#8a969c';
  g.font = 'bold 12px system-ui, sans-serif';
  g.fillText('가방', 1136, 30);
  // 기록
  g.textAlign = 'left';
  S.log.forEach((l, i) => {
    g.globalAlpha = Math.max(0, Math.min(1, l.t));
    g.font = 'bold 15px system-ui, sans-serif';
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText(l.text, 20, 136 + i * 22);
    g.fillStyle = '#e8ecee';
    g.fillText(l.text, 20, 136 + i * 22);
  });
  g.globalAlpha = 1;
}

// ---------- 상인 화면 (DOM) ----------
let shopBox: HTMLElement;
function renderShop() {
  const shop = S.shop;
  if (!shop) {
    shopBox.hidden = true;
    return;
  }
  const v = VENDORS[shop.vendor],
    run = S.run;
  shopBox.hidden = false;
  const rows = shop.offers
    .map(
      o => `<button class="row" data-k="${o.key}" ${o.stock <= 0 ? 'disabled' : ''}>
        <canvas width="44" height="44" data-icon="${o.kind === 'ammo' ? 'ammo-' + o.ref : o.kind === 'clinic' ? 'backalley' : o.kind === 'loan' ? 'shinyuri' : o.kind === 'gamble' ? 'vending' : o.ref}"></canvas>
        <span class="t"><b>${o.name}</b><small>${o.desc}</small></span>
        <span class="p">${o.kind === 'loan' ? '빌리기' : o.hpCost ? '체력 20%' : o.price + '원'}${o.stock > 0 && o.kind !== 'loan' ? `<small>남음 ${o.stock}</small>` : o.stock <= 0 ? '<small>품절</small>' : ''}</span>
      </button>`,
    )
    .join('');
  const bag = shop.buys
    ? `<h4>회수물 팔기</h4><div class="bag">${
        run.bag
          .map((b, i) => (b ? `<button class="row" data-sell="${i}"><canvas width="44" height="44" data-icon="${b.id}"></canvas><span class="t"><b>${b.name}</b></span><span class="p">${sellPrice(shop, b.value)}원</span></button>` : ''))
          .join('') || '<p class="empty">가방이 비었다</p>'
      }</div>`
    : '';
  shopBox.innerHTML = `<div class="panel">
    <header><canvas width="48" height="48" data-icon="${shop.vendor}"></canvas><div><b>${v.name}</b><small>${v.title}</small></div><span class="cash">현금 ${run.cash}${run.debt ? ` · 빚 ${run.debt}` : ''}</span></header>
    <p class="say">「${shop.greet}」</p>
    <div class="list">${rows}</div>${bag}
    <p class="msg" id="shopmsg"></p>
    <footer><button data-next>다른 상인 보기</button><button data-close>나가기</button></footer></div>`;
  shopBox.querySelectorAll<HTMLCanvasElement>('canvas[data-icon]').forEach(c => drawItemIcon(c.getContext('2d')!, c.dataset.icon!, 0, 0, c.width));
}
function shopClick(ev: Event) {
  const b = (ev.target as HTMLElement).closest('button');
  if (!b || !S.shop) return;
  const msg = (t: string) => {
    const m = shopBox.querySelector('#shopmsg');
    if (m) m.textContent = t;
  };
  if (b.dataset.close !== undefined) {
    say(VENDORS[S.shop.vendor].bye);
    S.shop = null;
    renderShop();
    return;
  }
  if (b.dataset.next !== undefined) {
    const ids = Object.keys(VENDORS) as VendorId[];
    S.vendor.id = ids[(ids.indexOf(S.vendor.id) + 1) % ids.length];
    S.shop = openShop(S.vendor.id, S.run, S.field.depth, S.field.seed ^ 0x5151);
    renderShop();
    return;
  }
  if (b.dataset.sell !== undefined) {
    const got = sell(S.shop, S.run, +b.dataset.sell);
    renderShop();
    msg(`${got}원 받음`);
    return;
  }
  const k = b.dataset.k;
  if (!k) return;
  const r = buy(S.shop, S.run, k);
  if (!r.ok) {
    renderShop();
    msg({ cash: '현금이 모자라', stock: '품절', full: '1~4칸이 가득', ammoFull: '탄이 가득', loan: '빚부터 갚아' }[r.why]);
    return;
  }
  const me = S.me;
  if (r.heal) me.hp = Math.min(me.max, me.hp + me.max * r.heal);
  if (r.cure?.includes('bleed')) me.bleed = 0;
  if (r.cure?.includes('taint')) me.taint = 0;
  if (r.hpCost) me.hp = Math.max(1, me.hp - me.max * r.hpCost);
  renderShop();
  msg(`받음: ${r.got}`);
}

// ---------- 입력 ----------
const joy = { x: 0, y: 0 };
const CODES: Record<string, string> = { KeyZ: 'KeyA', KeyX: 'KeyS', Enter: 'KeyE', KeyW: 'ArrowUp' };
function bindKeys(canvas: HTMLCanvasElement) {
  addEventListener('keydown', e => {
    if ((e.target as HTMLElement).tagName === 'SELECT') return;
    const c = e.code;
    if (c === 'Escape' && S.shop) {
      S.shop = null;
      renderShop();
      return;
    }
    if (!keys.has(c)) pressed.add(c);
    keys.add(c);
    if (c.startsWith('Arrow') || c === 'Space') e.preventDefault();
  });
  addEventListener('keyup', e => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  void CODES;
  // 캔버스의 1~4 칸 누르기
  canvas.addEventListener('pointerdown', e => {
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    for (let i = 0; i < 4; i++) {
      const s = SLOT_RECT(i);
      if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) pressed.add('Digit' + (i + 1));
    }
  });
}
function bindTouch(root: HTMLElement) {
  const stick = root.querySelector<HTMLElement>('.stick')!,
    knob = stick.querySelector<HTMLElement>('i')!;
  let pid = -1,
    cx = 0,
    cy = 0;
  stick.addEventListener('pointerdown', e => {
    pid = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stick.setPointerCapture(pid);
    move(e);
  });
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    const R = stick.offsetWidth / 2;
    let dx = (e.clientX - cx) / R,
      dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) {
      dx /= l;
      dy /= l;
    }
    joy.x = Math.abs(dx) < 0.2 ? 0 : dx;
    joy.y = Math.abs(dy) < 0.25 ? 0 : dy;
    knob.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  stick.addEventListener('pointermove', move);
  const end = (e: PointerEvent) => {
    if (e.pointerId !== pid) return;
    pid = -1;
    joy.x = joy.y = 0;
    knob.style.transform = '';
  };
  stick.addEventListener('pointerup', end);
  stick.addEventListener('pointercancel', end);
  root.querySelectorAll<HTMLElement>('[data-code]').forEach(b => {
    const c = b.dataset.code!;
    b.addEventListener('pointerdown', e => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      pressed.add(c);
      keys.add(c);
      b.classList.add('on');
    });
    const up = () => {
      keys.delete(c);
      b.classList.remove('on');
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
  });
}

const CSS = `
html,body{margin:0;height:100%;background:#0e1214;color:#e8ecee;font-family:system-ui,-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
#app{position:fixed;inset:0;display:flex;align-items:center;justify-content:center}
.wrap{position:relative;width:min(100vw,calc(100vh * 16 / 9));aspect-ratio:16/9}
canvas.stage{display:block;width:100%;height:100%}
.top{position:absolute;top:15.5%;right:1%;display:flex;gap:6px;z-index:3}
.top select,.top button{font:inherit;font-size:13px;padding:6px 10px;border-radius:8px;border:1px solid #4a565d;background:#20282d;color:#e8ecee}
.help{position:fixed;left:10px;bottom:10px;font-size:12px;line-height:1.6;color:#aab4b9;background:rgba(10,14,16,.8);padding:8px 12px;border-radius:8px;z-index:2}
.touch{display:none}
@media (pointer:coarse){.help{display:none}.touch{display:block}}
.stick{position:fixed;left:18px;bottom:18px;width:130px;height:130px;border-radius:50%;background:rgba(255,255,255,.08);border:2px solid rgba(255,255,255,.18);z-index:4;touch-action:none}
.stick i{position:absolute;left:35%;top:35%;width:30%;height:30%;border-radius:50%;background:rgba(255,255,255,.35)}
.btns{position:fixed;right:12px;bottom:12px;display:grid;grid-template-columns:repeat(3,52px);gap:8px;z-index:4}
.btns b{display:flex;align-items:center;justify-content:center;height:48px;border-radius:12px;background:rgba(32,40,45,.7);border:2px solid #4a565d;font-size:14px;touch-action:none}
.btns b.big{background:rgba(70,60,40,.8);border-color:#8a7a50}
.stick{width:110px;height:110px}
.btns b.on{background:#4a565d}
.shop{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:10;padding:16px;box-sizing:border-box}
.shop[hidden]{display:none}
.panel{background:#1b2226;border:1px solid #3a464d;border-radius:14px;width:min(560px,100%);max-height:100%;overflow:auto;padding:16px;box-sizing:border-box}
.panel header{display:flex;align-items:center;gap:10px}
.panel header div{display:flex;flex-direction:column}
.panel header small{color:#8a969c}
.panel .cash{margin-left:auto;color:#e6d36a;font-weight:700}
.panel .say{color:#cfd6da;margin:10px 0}
.panel h4{margin:14px 0 6px;color:#8a969c;font-size:13px}
.row{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:#232d32;border:1px solid #33404a;border-radius:10px;color:inherit;font:inherit;padding:8px 10px;margin:0 0 6px;cursor:pointer}
.row:disabled{opacity:.45}
.row .t{display:flex;flex-direction:column;flex:1;min-width:0}
.row .t small{color:#8a969c;font-size:12px}
.row .p{display:flex;flex-direction:column;align-items:flex-end;color:#e6d36a;font-weight:700;white-space:nowrap}
.row .p small{color:#8a969c;font-weight:400;font-size:11px}
.panel .msg{min-height:20px;color:#9fd9a6;margin:8px 0}
.panel .empty{color:#6a767c;text-align:center;padding:8px}
.panel footer{display:flex;gap:8px;justify-content:flex-end}
.panel footer button{font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #4a565d;background:#2c383e;color:#e8ecee}
`;

export function mountItemsDemo(root: HTMLElement) {
  const st = document.createElement('style');
  st.textContent = CSS;
  document.head.appendChild(st);
  root.innerHTML = `<div id="app"><div class="wrap"><canvas class="stage" width="${W}" height="${H}"></canvas>
  <div class="top"><select id="agent">${Object.entries(AGENTS)
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join('')}</select><button id="wave">적 다시</button><button id="reset">방 다시</button></div></div></div>
  <div class="help">←→↑↓ 이동 · Space 점프 · A 근접/던지기 · S 사격 · R 재장전 · E 줍기·들기·거래 · 1~4 아이템</div>
  <div class="touch"><div class="stick"><i></i></div>
  <div class="btns"><b data-code="KeyE">E</b><b data-code="KeyR">R</b><b data-code="Space">점프</b><i></i><b data-code="KeyS">S</b><b data-code="KeyA" class="big">A</b></div></div>
  <div class="shop" hidden></div>`;
  const canvas = root.querySelector<HTMLCanvasElement>('canvas.stage')!;
  ctx = canvas.getContext('2d')!;
  shopBox = root.querySelector<HTMLElement>('.shop')!;
  shopBox.addEventListener('click', shopClick);
  const sel = root.querySelector<HTMLSelectElement>('#agent')!;
  sel.addEventListener('change', () => {
    newRoom(sel.value);
    sel.blur();
  });
  root.querySelector('#wave')!.addEventListener('click', e => {
    spawnWave();
    (e.target as HTMLElement).blur();
  });
  root.querySelector('#reset')!.addEventListener('click', e => {
    newRoom(S.agent);
    (e.target as HTMLElement).blur();
  });
  bindKeys(canvas);
  bindTouch(root);
  newRoom('jyaldi');
  let acc = 0,
    last = performance.now();
  const frame = (now: number) => {
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      step();
      acc -= DT;
    }
    draw();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  (globalThis as unknown as { __items: () => State }).__items = () => S;
}
if (typeof document !== 'undefined' && document.getElementById('items-demo')) mountItemsDemo(document.getElementById('items-demo')!);
