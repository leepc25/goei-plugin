// 게임 HUD: 1280×720 캔버스 위에 그린다. 엔진은 HudState 만 채운다.
// 왼쪽 위 요원(체력·능력·필살), 가운데 위 층·규칙 변형, 오른쪽 위 재화·총애·규칙서, 아래 탄약·아이템·대사.
// 터치 버튼이 보이면 compact: 아이템 줄은 터치 버튼이 대신 보여 주고 탄약은 요원 칸 아래로 올라간다.
import { H as H0, W as W0 } from './stage';

// 지금 그리는 HUD 의 논리 크기 (캔버스 크기 ÷ HUD 배율). draw 가 정한다
let W = W0,
  H = H0;

export const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

export interface HudItem {
  label: string;
  count: number;
  /** 재사용 대기 0~1 (1 = 막 씀) */
  cd?: number;
}
export interface HudState {
  agent: { name: string; color?: string; portrait?: CanvasImageSource | null };
  hp: number;
  maxHp: number;
  energy?: number;
  maxEnergy?: number;
  /** 필살 게이지 0~100 */
  gauge: number;
  /** 슈퍼아머 단계 0~3 */
  armor?: number;
  status?: { label: string; good: boolean }[];
  weapon?: { name: string; mag: number; magMax: number; reserve: number; reload?: number | null; temp?: { name: string; uses: number } | null } | null;
  items: HudItem[];
  floor: { depth: string; name: string; variant?: string };
  rules?: { text: string; fresh?: boolean }[];
  ruleCount?: { found: number; sent: number };
  /** 승강기 총애 -3~+3 */
  favor: number;
  money: { cash: number; budget: number; research: number; teeth: number };
  boss?: { name: string; hp: number; max: number } | null;
  /** 조사·줍기 안내 (게임 화면 좌표) */
  prompt?: { text: string; key: string; x: number; y: number } | null;
  meters?: { label: string; v: number; max: number; color: string }[];
  timer?: { label: string; sec: number } | null;
  message?: string;
  device?: 'kb' | 'touch' | 'pad';
  compact?: boolean;
  /** HUD 배율. 기본: 터치(compact)면 1.2, 아니면 1. 폰에서 글자가 작지 않게 */
  scale?: number;
}

interface Toast {
  text: string;
  color: string;
  t: number;
}

const C = {
  plate: 'rgba(7,11,15,0.84)',
  edge: 'rgba(200,220,230,0.16)',
  text: '#ece6d4',
  dim: '#9aa6ab',
  hp: '#d8443c',
  hpLow: '#ff2a2a',
  trail: '#f3e2c0',
  energy: '#4aa8e8',
  gauge: '#f2b632',
  favorUp: '#f2c94c',
  favorDown: '#d8443c',
  rule: '#a9e0a0',
  amber: '#f0b45a',
};

export function font(size: number, weight = 700) {
  return `${weight} ${size}px ${FONT}`;
}
/** 외곽선 글자 */
export function label(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 16, color = C.text, align: CanvasTextAlign = 'left', weight = 700) {
  c.font = font(size, weight);
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineJoin = 'round';
  c.lineWidth = Math.max(3, size / 4.5);
  c.strokeStyle = 'rgba(0,0,0,0.85)';
  c.strokeText(s, x, y);
  c.fillStyle = color;
  c.fillText(s, x, y);
}
export function plate(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r = 8) {
  c.beginPath();
  c.roundRect(x, y, w, h, r);
  c.fillStyle = C.plate;
  c.fill();
  c.strokeStyle = C.edge;
  c.lineWidth = 1;
  c.stroke();
}
function bar(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, v: number, color: string, back = 'rgba(0,0,0,0.6)') {
  c.fillStyle = back;
  c.fillRect(x, y, w, h);
  c.fillStyle = color;
  c.fillRect(x, y, Math.max(0, Math.min(1, v)) * w, h);
}

export class Hud {
  private trail = -1;
  private trailHold = 0;
  private lastHp = -1;
  private hurtT = 0;
  private toasts: Toast[] = [];
  private t = 0;
  private lastFavor: number | null = null;
  private favorPulse = 0;
  private lastFloor = '';
  private lastMoney: Record<string, number> = {};
  private moneyPulse: Record<string, number> = {};
  private itemFlash = [0, 0, 0, 0];
  private lastItems: number[] = [];

  toast(text: string, color = C.text) {
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 5) this.toasts.shift();
  }
  reset() {
    this.trail = -1;
    this.lastHp = -1;
    this.lastFavor = null;
    this.lastMoney = {};
    this.lastItems = [];
  }

  draw(c: CanvasRenderingContext2D, s: HudState, dt: number) {
    this.t += dt;
    this.track(s, dt);
    c.save();
    const k = s.scale ?? (s.compact ? 1.2 : 1);
    W = c.canvas.width / k;
    H = c.canvas.height / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    if (s.prompt) s = { ...s, prompt: { ...s.prompt, x: s.prompt.x / k, y: s.prompt.y / k } };
    this.agent(c, s);
    this.floor(c, s);
    this.right(c, s);
    if (s.compact) {
      if (s.weapon) this.ammoCompact(c, s.weapon);
    } else {
      if (s.weapon) this.ammo(c, s.weapon);
      this.items(c, s.items, s.device);
    }
    if (s.boss) this.boss(c, s.boss, s.compact);
    this.meters(c, s);
    if (s.message) this.message(c, s.message, s.compact);
    if (s.prompt) this.prompt(c, s.prompt, s.device);
    this.drawToasts(c, dt);
    c.restore();
  }

  private track(s: HudState, dt: number) {
    if (this.lastHp < 0 || this.trail < 0) this.trail = s.hp;
    if (this.lastHp >= 0 && s.hp < this.lastHp) (this.hurtT = 0.35), (this.trailHold = 0.5);
    this.lastHp = s.hp;
    if (this.trail < s.hp) this.trail = s.hp;
    else if (this.trailHold > 0) this.trailHold -= dt;
    else this.trail = Math.max(s.hp, this.trail - s.maxHp * dt * 0.6);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.lastFavor !== null && s.favor !== this.lastFavor) {
      this.favorPulse = 1.2;
      this.toast(`총애 ${s.favor > this.lastFavor ? '+' : ''}${s.favor - this.lastFavor}`, s.favor > this.lastFavor ? C.favorUp : C.favorDown);
    }
    this.lastFavor = s.favor;
    this.favorPulse = Math.max(0, this.favorPulse - dt);
    const names: Record<string, string> = { cash: '현금', budget: '예산', research: '연구 자료', teeth: '이빨' };
    for (const k of Object.keys(names)) {
      const v = s.money[k as keyof HudState['money']];
      const old = this.lastMoney[k];
      if (old !== undefined && v > old) (this.moneyPulse[k] = 0.8), this.toast(`${names[k]} +${v - old}`, '#e8e0b0');
      this.lastMoney[k] = v;
      this.moneyPulse[k] = Math.max(0, (this.moneyPulse[k] ?? 0) - dt);
    }
    s.items.forEach((it, i) => {
      if (this.lastItems[i] !== undefined && it.count !== this.lastItems[i]) this.itemFlash[i] = 0.5;
      this.lastItems[i] = it.count;
      this.itemFlash[i] = Math.max(0, this.itemFlash[i] - dt);
    });
    const fk = s.floor.depth + s.floor.name;
    if (fk !== this.lastFloor) this.lastFloor = fk;
  }

  private agent(c: CanvasRenderingContext2D, s: HudState) {
    const x = 16,
      y = 14;
    plate(c, x, y, 404, 96, 10);
    // 얼굴 칸: 둥근 네모
    c.save();
    c.beginPath();
    c.roundRect(x + 10, y + 10, 72, 72, 12);
    c.clip();
    c.fillStyle = s.agent.color ?? '#5a6a74';
    c.fillRect(x + 10, y + 10, 72, 72);
    if (s.agent.portrait) c.drawImage(s.agent.portrait, x + 10, y + 10, 72, 72);
    else label(c, s.agent.name.slice(0, 1), x + 46, y + 60, 36, '#fff', 'center', 800);
    if (this.hurtT > 0) (c.fillStyle = `rgba(255,40,40,${this.hurtT * 1.6})`), c.fillRect(x + 10, y + 10, 72, 72);
    c.restore();
    const bx = x + 94;
    label(c, s.agent.name, bx, y + 26, 18);
    if (s.armor) label(c, '◆'.repeat(s.armor), bx + c.measureText(s.agent.name).width + 10, y + 25, 13, C.amber);
    // 체력: 10 단위 눈금, 깎인 만큼 밝은 띠가 늦게 따라온다
    const bw = 296,
      bh = 18,
      by = y + 34;
    const low = s.hp / s.maxHp < 0.25;
    c.fillStyle = 'rgba(0,0,0,0.65)';
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = C.trail;
    c.fillRect(bx, by, (bw * this.trail) / s.maxHp, bh);
    c.fillStyle = low ? (Math.sin(this.t * 10) > 0 ? C.hpLow : C.hp) : C.hp;
    c.fillRect(bx, by, (bw * Math.max(0, s.hp)) / s.maxHp, bh);
    c.fillStyle = 'rgba(255,255,255,0.18)';
    c.fillRect(bx, by, (bw * Math.max(0, s.hp)) / s.maxHp, 5);
    c.fillStyle = 'rgba(0,0,0,0.45)';
    for (let v = 10; v < s.maxHp; v += 10) c.fillRect(bx + Math.round((bw * v) / s.maxHp), by, 1, bh);
    c.strokeStyle = 'rgba(255,255,255,0.25)';
    c.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
    label(c, `${Math.ceil(Math.max(0, s.hp))} / ${s.maxHp}`, bx + bw - 6, by + 14, 13, '#fff', 'right');
    // 능력
    if (s.maxEnergy) bar(c, bx, by + 26, 200, 6, (s.energy ?? 0) / s.maxEnergy, C.energy);
    // 필살 게이지
    const full = s.gauge >= 100;
    const gy = by + 39;
    bar(c, bx, gy, 200, 9, s.gauge / 100, full ? `hsl(${40 + Math.sin(this.t * 8) * 10},95%,${60 + Math.sin(this.t * 8) * 12}%)` : C.gauge);
    if (full) {
      c.save();
      c.shadowColor = C.gauge;
      c.shadowBlur = 12 + Math.sin(this.t * 8) * 6;
      c.strokeStyle = C.gauge;
      c.strokeRect(bx - 1, gy - 1, 202, 11);
      c.restore();
    }
    label(c, full ? `필살 ${s.device === 'pad' ? 'RT' : 'W'}` : '필살', bx + 208, gy + 10, 12, full ? C.gauge : C.dim);
    if (s.maxEnergy) label(c, '능력', bx + 208, by + 33, 12, C.dim);
    // 상태
    let sx = x;
    const sy = y + (s.compact && s.weapon ? 142 : 102);
    for (const st of s.status ?? []) {
      c.font = font(12);
      const w = c.measureText(st.label).width + 14;
      c.beginPath();
      c.roundRect(sx, sy, w, 20, 10);
      c.fillStyle = st.good ? 'rgba(60,140,90,0.85)' : 'rgba(150,50,50,0.85)';
      c.fill();
      label(c, st.label, sx + 7, sy + 15, 12, '#fff');
      sx += w + 6;
    }
  }

  private floor(c: CanvasRenderingContext2D, s: HudState) {
    const f = s.floor;
    c.font = font(26, 800);
    const dw = c.measureText(f.depth).width;
    c.font = font(17);
    const nw = c.measureText(f.name).width;
    const w = Math.max(dw + nw + 40, 200);
    // 터치(compact): 가운데 위는 비워 두고 오른쪽 재화 아래에 붙인다
    const x = s.compact ? W - 16 - w : W / 2 - w / 2,
      y = s.compact ? 58 : 12;
    plate(c, x, y, w, f.variant ? 64 : 44, 10);
    label(c, f.depth, x + 16, y + 32, 26, '#fff', 'left', 800);
    label(c, f.name, x + 28 + dw, y + 30, 17, '#d8d0bc');
    if (f.variant) label(c, `변형 · ${f.variant}`, x + w / 2, y + 54, 13, C.amber, 'center');
  }

  private right(c: CanvasRenderingContext2D, s: HudState) {
    const m = s.money;
    const items: [string, number, (c: CanvasRenderingContext2D, x: number, y: number) => void][] = [
      ['cash', m.cash, iconCash],
      ['budget', m.budget, iconBudget],
      ['research', m.research, iconResearch],
      ['teeth', m.teeth, iconTooth],
    ];
    const R = W;
    const step = s.compact ? 86 : 102,
      mw = step * 4 + 12;
    const x0 = R - 16 - mw;
    plate(c, x0, 12, mw, 40, 10);
    items.forEach(([k, v, ic], i) => {
      const x = x0 + 12 + i * step;
      ic(c, x + 10, 32);
      const p = this.moneyPulse[k] ?? 0;
      label(c, String(v), x + 26, 39, 17 + p * 4, p > 0 ? '#fff4c0' : C.text);
    });
    // 총애: -3 ~ +3 일곱 칸
    const down = s.compact ? (s.floor.variant ? 70 : 50) : 0;
    const fy = 60 + down,
      fx = R - 16 - 260;
    plate(c, fx, fy, 260, 34, 10);
    label(c, '총애', fx + 12, fy + 23, 14, C.dim);
    for (let i = -3; i <= 3; i++) {
      const cx = fx + 92 + (i + 3) * 24,
        cy = fy + 17;
      const on = (s.favor > 0 && i > 0 && i <= s.favor) || (s.favor < 0 && i < 0 && i >= s.favor);
      c.beginPath();
      if (i === 0) c.rect(cx - 2, cy - 7, 4, 14);
      else c.arc(cx, cy, 7, 0, Math.PI * 2);
      c.fillStyle = i === 0 ? '#889' : on ? (i > 0 ? C.favorUp : C.favorDown) : 'rgba(255,255,255,0.12)';
      if (on && this.favorPulse > 0) (c.shadowColor = c.fillStyle as string), (c.shadowBlur = 14 * this.favorPulse);
      c.fill();
      c.shadowBlur = 0;
    }
    label(c, (s.favor > 0 ? '+' : '') + s.favor, fx + 248, fy + 23, 14, s.favor > 0 ? C.favorUp : s.favor < 0 ? C.favorDown : C.dim, 'right');
    // 규칙서
    const rules = s.rules ?? [];
    if (rules.length || s.ruleCount) {
      const rh = 30 + rules.length * 22;
      const rx = R - 16 - 360,
        ry = 102 + down;
      plate(c, rx, ry, 360, rh, 10);
      label(c, '규칙서', rx + 12, ry + 21, 14, C.rule);
      if (s.ruleCount) label(c, `찾음 ${s.ruleCount.found} · 송신 ${s.ruleCount.sent}`, rx + 348, ry + 21, 12, C.dim, 'right');
      rules.forEach((r, i) => {
        const col = r.fresh ? (Math.sin(this.t * 9) > 0 ? '#fff6a0' : C.rule) : '#cfd8cf';
        let t = r.text;
        c.font = font(13, 600);
        while (c.measureText(t).width > 330 && t.length > 4) t = t.slice(0, -2);
        if (t !== r.text) t += '…';
        label(c, t, rx + 12, ry + 44 + i * 22, 13, col, 'left', 600);
      });
    }
  }

  private ammo(c: CanvasRenderingContext2D, w: NonNullable<HudState['weapon']>) {
    const x = 16,
      y = H - 16 - 74;
    plate(c, x, y, 280, 74, 10);
    label(c, w.temp ? `${w.temp.name} · ${w.temp.uses}회` : w.name, x + 12, y + 22, 13, w.temp ? C.amber : C.dim);
    const empty = w.mag <= 0;
    label(c, String(w.mag), x + 12, y + 60, 32, empty ? C.hpLow : '#fff', 'left', 800);
    c.font = font(32, 800);
    const mw = c.measureText(String(w.mag)).width;
    label(c, `/ ${w.reserve}`, x + 18 + mw, y + 60, 16, C.dim);
    // 탄창 눈금 또는 재장전
    const px = x + 120,
      py = y + 36;
    if (w.reload != null) {
      bar(c, px, py + 6, 148, 10, w.reload, '#e8e0b0');
      label(c, '재장전', px, py + 34, 13, '#e8e0b0');
    } else {
      const n = Math.min(w.magMax, 24);
      const step = 148 / n;
      for (let i = 0; i < n; i++) {
        const filled = i < Math.ceil((w.mag / w.magMax) * n);
        c.fillStyle = filled ? '#f0d890' : 'rgba(255,255,255,0.12)';
        c.fillRect(px + i * step, py, Math.max(2, step - 2), 22);
      }
      if (w.mag <= Math.ceil(w.magMax * 0.25)) label(c, w.reserve > 0 ? 'R 재장전' : '탄 없음', px, py + 40, 12, C.hpLow);
    }
  }
  private ammoCompact(c: CanvasRenderingContext2D, w: NonNullable<HudState['weapon']>) {
    const x = 16,
      y = 116;
    plate(c, x, y, 220, 34, 9);
    label(c, `${w.mag}`, x + 12, y + 25, 20, w.mag <= 0 ? C.hpLow : '#fff', 'left', 800);
    label(c, `/ ${w.reserve}`, x + 46, y + 24, 13, C.dim);
    if (w.reload != null) bar(c, x + 96, y + 13, 110, 8, w.reload, '#e8e0b0');
    else {
      const n = Math.min(w.magMax, 16),
        step = 110 / n;
      for (let i = 0; i < n; i++) {
        c.fillStyle = i < Math.ceil((w.mag / w.magMax) * n) ? '#f0d890' : 'rgba(255,255,255,0.12)';
        c.fillRect(x + 96 + i * step, y + 9, Math.max(2, step - 2), 16);
      }
    }
  }

  private items(c: CanvasRenderingContext2D, items: HudItem[], device?: string) {
    const n = 4,
      s = 62,
      g = 8;
    const x0 = W / 2 - (n * s + (n - 1) * g) / 2,
      y = H - 16 - s;
    const padKeys = ['↑', '→', '↓', '←'];
    for (let i = 0; i < n; i++) {
      const it = items[i] ?? { label: '', count: 0 };
      const x = x0 + i * (s + g);
      plate(c, x, y, s, s, 9);
      if (this.itemFlash[i] > 0) {
        c.fillStyle = `rgba(255,240,180,${this.itemFlash[i]})`;
        c.beginPath();
        c.roundRect(x, y, s, s, 9);
        c.fill();
      }
      const dim = it.count <= 0;
      label(c, it.label, x + s / 2, y + 38, 15, dim ? '#5a6266' : C.text, 'center');
      label(c, device === 'pad' ? padKeys[i] : String(i + 1), x + 7, y + 17, 12, C.dim);
      label(c, `${it.count}`, x + s - 7, y + s - 7, 14, dim ? '#5a6266' : '#fff', 'right');
      if (it.cd && it.cd > 0) {
        c.save();
        c.beginPath();
        c.moveTo(x + s / 2, y + s / 2);
        c.arc(x + s / 2, y + s / 2, s, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * it.cd);
        c.closePath();
        c.clip();
        c.fillStyle = 'rgba(0,0,0,0.55)';
        c.fillRect(x, y, s, s);
        c.restore();
      }
    }
  }

  private boss(c: CanvasRenderingContext2D, b: NonNullable<HudState['boss']>, compact?: boolean) {
    const w = 640,
      x = W / 2 - w / 2,
      y = compact ? 84 : H - 128;
    label(c, b.name, x, y - 6, 16, '#f0c0b0');
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(x, y, w, 14);
    c.fillStyle = '#b02a2a';
    c.fillRect(x, y, (w * Math.max(0, b.hp)) / b.max, 14);
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.fillRect(x, y, (w * Math.max(0, b.hp)) / b.max, 4);
    c.strokeStyle = 'rgba(255,200,180,0.5)';
    c.strokeRect(x + 0.5, y + 0.5, w - 1, 13);
  }

  private meters(c: CanvasRenderingContext2D, s: HudState) {
    let y = s.floor.variant ? 96 : 76;
    if (s.boss && s.compact) y += 34;
    if (s.timer) {
      const t = Math.max(0, s.timer.sec);
      label(c, `${s.timer.label} ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, W / 2, y + 18, 20, t < 10 ? C.hpLow : '#bfe0f0', 'center', 800);
      y += 30;
    }
    for (const m of s.meters ?? []) {
      label(c, m.label, W / 2 - 110, y + 11, 12, m.color, 'right');
      bar(c, W / 2 - 100, y + 2, 200, 9, m.v / m.max, m.color);
      y += 18;
    }
  }

  private message(c: CanvasRenderingContext2D, text: string, compact?: boolean) {
    c.font = font(17, 600);
    let t = text;
    while (c.measureText(t).width > 900 && t.length > 4) t = t.slice(0, -2);
    if (t !== text) t += '…';
    const w = c.measureText(t).width + 40;
    const y = compact ? H - 210 : H - 128;
    plate(c, W / 2 - w / 2, y, w, 36, 18);
    label(c, t, W / 2, y + 25, 17, '#fff8e6', 'center', 600);
  }

  private prompt(c: CanvasRenderingContext2D, p: NonNullable<HudState['prompt']>, device?: string) {
    const bob = Math.sin(this.t * 5) * 3;
    const key = device === 'pad' ? 'B' : device === 'touch' ? '조사' : p.key;
    c.font = font(15);
    const kw = Math.max(28, c.measureText(key).width + 14);
    const tw = c.measureText(p.text).width;
    const w = kw + tw + 22;
    const x = Math.max(8, Math.min(W - w - 8, p.x - w / 2)),
      y = Math.max(8, p.y - 40 + bob);
    plate(c, x, y, w, 32, 8);
    c.beginPath();
    c.roundRect(x + 5, y + 5, kw, 22, 5);
    c.fillStyle = '#ece6d4';
    c.fill();
    c.font = font(14, 800);
    c.fillStyle = '#111';
    c.textAlign = 'center';
    c.fillText(key, x + 5 + kw / 2, y + 21);
    label(c, p.text, x + kw + 13, y + 22, 15, '#fff');
  }

  private drawToasts(c: CanvasRenderingContext2D, dt: number) {
    let y = 160;
    for (const t of this.toasts) {
      t.t += dt;
      const a = t.t < 0.15 ? t.t / 0.15 : t.t > 2.2 ? Math.max(0, 1 - (t.t - 2.2) / 0.5) : 1;
      c.globalAlpha = a;
      label(c, t.text, 22 + (1 - Math.min(1, t.t / 0.15)) * -20, y, 15, t.color);
      c.globalAlpha = 1;
      y += 22;
    }
    this.toasts = this.toasts.filter((t) => t.t < 2.7);
  }
}

const shared = new Hud();
/** 간단히 쓰기: 공용 Hud 하나로 그린다 (dt 초) */
export function drawHud(c: CanvasRenderingContext2D, s: HudState, dt = 1 / 60) {
  shared.draw(c, s, dt);
}

// 재화 아이콘 (그림 대신 도형)
function iconCash(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#5fae6a';
  c.fillRect(x - 10, y - 6, 20, 12);
  c.strokeStyle = '#d8f0d0';
  c.lineWidth = 1;
  c.strokeRect(x - 9.5, y - 5.5, 19, 11);
  c.beginPath();
  c.arc(x, y, 3, 0, Math.PI * 2);
  c.stroke();
}
function iconBudget(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#d8b040';
  c.beginPath();
  c.arc(x, y, 8, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#7a5a10';
  c.font = font(10, 800);
  c.textAlign = 'center';
  c.fillText('결', x, y + 4);
}
function iconResearch(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#5aa8e0';
  c.beginPath();
  c.moveTo(x - 3, y - 8);
  c.lineTo(x + 3, y - 8);
  c.lineTo(x + 3, y - 2);
  c.lineTo(x + 8, y + 7);
  c.lineTo(x - 8, y + 7);
  c.lineTo(x - 3, y - 2);
  c.closePath();
  c.fill();
}
function iconTooth(c: CanvasRenderingContext2D, x: number, y: number) {
  c.fillStyle = '#f2efe6';
  c.beginPath();
  c.moveTo(x - 7, y - 6);
  c.quadraticCurveTo(x, y - 10, x + 7, y - 6);
  c.lineTo(x + 5, y + 8);
  c.lineTo(x + 1, y + 2);
  c.lineTo(x - 1, y + 2);
  c.lineTo(x - 5, y + 8);
  c.closePath();
  c.fill();
}

/** 지도 (Z): 가 본 층 목록 + 지금 층 띠 */
export interface MapState {
  floors: { label: string; current: boolean }[];
  strip: { w: number; color: string; tag?: string }[];
  /** 지금 위치 0~1 */
  at: number;
}
export function drawMap(c: CanvasRenderingContext2D, m: MapState) {
  W = c.canvas.width;
  H = c.canvas.height;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = 'rgba(3,6,9,0.82)';
  c.fillRect(0, 0, W, H);
  label(c, '지도', 80, 90, 28, '#fff', 'left', 800);
  label(c, 'Z · Esc 닫기', W - 80, 90, 14, '#9aa6ab', 'right');
  // 층 기록 (세로)
  plate(c, 80, 120, 260, 520, 12);
  label(c, '내려온 층', 100, 152, 15, '#9aa6ab');
  m.floors.slice(-18).forEach((f, i) => label(c, `${f.current ? '▶ ' : '  '}${f.label}`, 100, 182 + i * 25, 15, f.current ? '#f2c94c' : '#d8d0bc', 'left', f.current ? 800 : 600));
  // 지금 층 (가로 띠)
  const x = 380,
    y = 300,
    w = 820;
  plate(c, x - 20, y - 70, w + 40, 190, 12);
  label(c, '이번 층', x, y - 38, 15, '#9aa6ab');
  const total = m.strip.reduce((a, s) => a + s.w, 0) || 1;
  let px = x;
  for (const s of m.strip) {
    const sw = (s.w / total) * w;
    c.fillStyle = s.color;
    c.fillRect(px, y, Math.max(1, sw - 2), 40);
    if (s.tag) label(c, s.tag, px + sw / 2, y + 66, 12, '#d8d0bc', 'center');
    px += sw;
  }
  const ax = x + m.at * w;
  c.fillStyle = '#f2c94c';
  c.beginPath();
  c.moveTo(ax, y - 4);
  c.lineTo(ax - 8, y - 18);
  c.lineTo(ax + 8, y - 18);
  c.closePath();
  c.fill();
  c.restore();
}
