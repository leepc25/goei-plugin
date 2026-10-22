// 게임 HUD: 1280×720 캔버스 위에 그린다. 엔진은 HudState 만 채운다.
// 오락실식: 왼쪽 위 한 묶음(얼굴·체력·필살·탄), 오른쪽 위 구석 층 글자, 왼쪽 아래 아이템 아이콘, 아래 대사.
// 재화·총애·규칙서 목록은 화면에 늘 띄우지 않는다: 바뀔 때 잠깐 알림, 전체는 일시정지 메뉴(statusHtml).
// 터치 버튼이 보이면 compact: 아이템은 터치 버튼이 대신 보여 준다.
import { agentFaces, kitImage, kitPiece, kitSlice, nine, PIXEL_FONT } from './kit';
import { ITEM_IMG } from './kit.gen';
import { H as H0, W as W0 } from './stage';

// 지금 그리는 HUD 의 논리 크기 (캔버스 크기 ÷ HUD 배율). draw 가 정한다
let W = W0,
  H = H0;

export const FONT = '"Pretendard","Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

export interface HudItem {
  /** 아이템 id (있으면 아이콘 그리개가 이것으로 그린다) */
  id?: string;
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
  hp: '#f6d23a',
  hpLow: '#ff3a2a',
  trail: '#e8402c',
  hpMid: '#f2a62c',
  frame: '#e8dcb8',
  name: '#ffe9a8',
  energy: '#4aa8e8',
  gauge: '#f2b632',
  gaugeFill: '#3ec8f0',
  favorUp: '#f2c94c',
  favorDown: '#d8443c',
  rule: '#a9e0a0',
  amber: '#f0b45a',
};

export function font(size: number, weight = 700) {
  return pixelOn ? pfont(size).f : `${weight} ${size}px ${FONT}`;
}
/** HUD 글자: 도트 글꼴은 11px 배수에서만 또렷하다 (12 이하 = 11, 그 위는 22·33·44) */
export function pfont(size: number) {
  const n = size <= 12 ? 11 : Math.max(22, Math.round(size / 11) * 11);
  return { n, f: `700 ${n}px "${PIXEL_FONT}", ${FONT}` };
}
/** 외곽선 글자 */
export function label(c: CanvasRenderingContext2D, s: string, x: number, y: number, size = 16, color = C.text, align: CanvasTextAlign = 'left', weight = 700) {
  const p = pixelOn ? pfont(size) : null;
  if (p) size = p.n;
  c.font = p ? p.f : font(size, weight);
  c.textAlign = align;
  c.textBaseline = 'alphabetic';
  c.lineJoin = p ? 'miter' : 'round';
  c.lineWidth = p ? Math.max(3, size / 5.5) : Math.max(3, size / 4.5);
  c.strokeStyle = 'rgba(0,0,0,0.85)';
  c.strokeText(s, x, y);
  c.fillStyle = color;
  c.fillText(s, x, y);
}
/** HUD 글자를 도트 글꼴로 (draw 하는 동안만 켠다: 다른 모듈이 label 을 빌려 쓸 때는 원래 글꼴) */
let pixelOn = false;

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
  /** 마지막으로 그린 상태 (일시정지 메뉴가 재화·총애·규칙을 보여 줄 때 쓴다) */
  last: HudState | null = null;
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
    this.last = s;
    pixelOn = true;
    this.agent(c, s);
    this.floor(c, s);
    this.rules(c, s);
    if (!s.compact) this.items(c, s.items, s.device);
    if (s.boss) this.boss(c, s.boss, s.compact);
    this.timer(c, s);
    if (s.message) this.message(c, s.message, s.compact);
    if (s.prompt) this.prompt(c, s.prompt, s.device);
    this.drawToasts(c, dt);
    pixelOn = false;
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

  /** 왼쪽 위 한 묶음: 얼굴 + 이름 + 굵은 체력 막대 + 필살 게이지 + 탄. 판 없이 오락실처럼 */
  private agent(c: CanvasRenderingContext2D, s: HudState) {
    const x = 22,
      y = 18,
      fs = 80;
    // 뒤를 살짝 어둡게 (밝은 배경에서도 읽히게)
    const g = c.createLinearGradient(0, 0, 460, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.5)');
    g.addColorStop(0.75, 'rgba(0,0,0,0.25)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 460, y + fs + 30);
    // 얼굴: 맞으면·위급하면·필살이 차면 표정이 바뀐다
    const r0 = Math.max(0, s.hp) / s.maxHp;
    const faces = s.agent.portrait ? null : agentFaces(s.agent.name);
    const face = faces ? kitImage(faces[this.hurtT > 0 ? 1 : r0 < 0.25 ? 2 : s.gauge >= 100 ? 3 : 0]) : null;
    c.fillStyle = s.agent.color ?? '#5a6a74';
    if (face || s.agent.portrait) c.fillStyle = '#141b20';
    c.fillRect(x, y, fs, fs);
    c.save();
    c.imageSmoothingEnabled = false;
    if (s.agent.portrait) c.drawImage(s.agent.portrait, x, y, fs, fs);
    else if (face) c.drawImage(face, x, y, fs, fs);
    else label(c, s.agent.name.slice(0, 1), x + fs / 2, y + fs * 0.72, 44, '#fff', 'center', 900);
    c.restore();
    if (this.hurtT > 0) (c.fillStyle = `rgba(255,40,40,${this.hurtT * 1.2})`), c.fillRect(x, y, fs, fs);
    const pf = kitPiece('portrait');
    if (pf) nine(c, pf, kitSlice('portrait'), x - 12, y - 12, fs + 24, fs + 24, 2);
    else {
      c.strokeStyle = C.frame;
      c.lineWidth = 3;
      c.strokeRect(x - 1.5, y - 1.5, fs + 3, fs + 3);
    }
    // 능력(고유기) 재사용: 얼굴 아래 얇은 띠
    if (s.maxEnergy) bar(c, x - 2, y + fs + 12, fs + 4, 5, (s.energy ?? 0) / s.maxEnergy, '#e8e2d0', '#000');
    const bx = x + fs + 30,
      bw = 300;
    label(c, s.agent.name, bx, y + 20, 22, C.name, 'left', 900);
    c.font = font(22, 900);
    let ax = bx + c.measureText(s.agent.name).width + 10;
    if (s.armor) label(c, '◆'.repeat(s.armor), ax, y + 19, 15, C.amber), (ax += 50);
    // 체력: 굵은 한 줄. 깎인 만큼 붉은 띠가 늦게 따라온다
    const by = y + 30,
      bh = 24;
    const r = r0;
    const low = r < 0.25;
    c.fillStyle = '#000';
    c.fillRect(bx - 3, by - 3, bw + 6, bh + 6);
    c.fillStyle = '#3a1410';
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = C.trail;
    c.fillRect(bx, by, (bw * this.trail) / s.maxHp, bh);
    const hc = low ? (Math.sin(this.t * 10) > 0 ? C.hpLow : C.hp) : r < 0.5 ? C.hpMid : C.hp;
    c.fillStyle = hc;
    c.fillRect(bx, by, bw * r, bh);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(bx, by + 3, bw * r, 4);
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(bx, by + bh - 5, bw * r, 5);
    const bf = kitPiece('bar');
    if (bf) nine(c, bf, kitSlice('bar'), bx - 22, by - 10, bw + 44, bh + 20, 2);
    // 필살 게이지: 체력 아래, 가득 차면 빛남
    const gy = by + bh + 9,
      gw = 220,
      gh = 12;
    const full = s.gauge >= 100;
    c.fillStyle = '#000';
    c.fillRect(bx - 2, gy - 2, gw + 4, gh + 4);
    bar(c, bx, gy, gw, gh, s.gauge / 100, full ? `hsl(${40 + Math.sin(this.t * 8) * 10},95%,${60 + Math.sin(this.t * 8) * 12}%)` : C.gaugeFill, '#10181c');
    if (full) {
      c.save();
      c.shadowColor = C.gauge;
      c.shadowBlur = 12 + Math.sin(this.t * 8) * 6;
      c.strokeStyle = C.gauge;
      c.lineWidth = 2;
      c.strokeRect(bx - 2, gy - 2, gw + 4, gh + 4);
      c.restore();
      label(c, s.device === 'pad' ? 'RT' : s.device === 'touch' ? '필살' : 'W', bx + gw + 10, gy + 12, 15, C.gauge, 'left', 900);
    }
    // 탄: 총알 그림 + 큰 숫자
    if (s.weapon) this.ammo(c, s.weapon, bx, gy + gh + 30);
    // 가드 같은 상황 막대는 묶음 아래
    let my = y + fs + 22;
    for (const m of s.meters ?? []) {
      label(c, m.label, x, my + 10, 13, m.color, 'left', 800);
      bar(c, x + 40, my + 1, 160, 9, m.v / m.max, m.color, '#000');
      my += 18;
    }
    // 상태
    let sx = x;
    for (const st of s.status ?? []) {
      c.font = font(13, 800);
      const w = c.measureText(st.label).width + 14;
      c.beginPath();
      c.roundRect(sx, my + 4, w, 22, 11);
      c.fillStyle = st.good ? 'rgba(60,140,90,0.9)' : 'rgba(150,50,50,0.9)';
      c.fill();
      label(c, st.label, sx + 7, my + 20, 13, '#fff', 'left', 800);
      sx += w + 6;
    }
  }

  private ammo(c: CanvasRenderingContext2D, w: NonNullable<HudState['weapon']>, x: number, y: number) {
    const empty = w.mag <= 0;
    bullet(c, x + 6, y - 9, empty ? '#7a3a30' : '#f0d890');
    label(c, String(w.mag), x + 20, y, 26, empty ? C.hpLow : '#fff', 'left', 900);
    c.font = font(26, 900);
    const mw = c.measureText(String(w.mag)).width;
    label(c, `/ ${w.reserve}`, x + 26 + mw, y, 16, C.dim, 'left', 800);
    c.font = font(16, 800);
    const ex = x + 34 + mw + c.measureText(`/ ${w.reserve}`).width + 8;
    if (w.temp) label(c, `${w.temp.name} ${w.temp.uses}회`, ex, y, 15, C.amber, 'left', 800);
    else if (w.reload != null) {
      bar(c, ex, y - 12, 90, 8, w.reload, '#e8e0b0', '#000');
      label(c, '재장전', ex + 98, y, 14, '#e8e0b0', 'left', 800);
    } else if (w.mag <= Math.ceil(w.magMax * 0.25)) label(c, w.reserve > 0 ? '재장전!' : '탄 없음', ex, y, 15, Math.sin(this.t * 8) > 0 ? C.hpLow : '#fff', 'left', 900);
  }

  /** 층: 오른쪽 위 구석에 글자만 (판 없음). 바뀔 때는 Fx 층 제목이 크게 알린다 */
  private floor(c: CanvasRenderingContext2D, s: HudState) {
    const f = s.floor;
    if (!f.depth) return;
    label(c, f.depth, W - 20, 44, 32, '#fff', 'right', 900);
    if (f.variant) label(c, f.variant, W - 20, 68, 15, C.amber, 'right', 800);
  }

  /** 규칙서: 새로 찾은 규칙이 있을 때만 오른쪽 위에 잠깐. 전체 목록은 일시정지 메뉴 */
  private rules(c: CanvasRenderingContext2D, s: HudState) {
    const fresh = (s.rules ?? []).filter((r) => r.fresh);
    if (!fresh.length) return;
    let y = s.floor.variant ? 96 : 76;
    if (s.boss && s.compact) y += 34;
    for (const r of fresh.slice(-3)) {
      let t = r.text;
      c.font = font(15, 800);
      while (c.measureText(t).width > 380 && t.length > 4) t = t.slice(0, -2);
      if (t !== r.text) t += '…';
      label(c, `규칙 · ${t}`, W - 20, y + 16, 15, Math.sin(this.t * 9) > 0 ? '#fff6a0' : C.rule, 'right', 800);
      y += 24;
    }
  }

  /** 아이템: 아이콘만 (글자 없음), 왼쪽 아래. 터치 화면에서는 터치 버튼이 대신 보여 준다 */
  private items(c: CanvasRenderingContext2D, items: HudItem[], device?: string) {
    const n = 4,
      s = 56,
      g = 8;
    const x0 = 18,
      y = H - 16 - s;
    const padKeys = ['↑', '→', '↓', '←'];
    for (let i = 0; i < n; i++) {
      const it = items[i] ?? { label: '', count: 0 };
      const x = x0 + i * (s + g);
      const dim = it.count <= 0;
      const sf = kitPiece('slot');
      if (sf) nine(c, sf, kitSlice('slot'), x - 4, y - 4, s + 8, s + 8, 1);
      else {
        c.fillStyle = '#000';
        c.fillRect(x - 2, y - 2, s + 4, s + 4);
        c.fillStyle = dim ? 'rgba(30,34,38,0.8)' : 'rgba(44,50,56,0.92)';
        c.fillRect(x, y, s, s);
      }
      if (this.itemFlash[i] > 0) (c.fillStyle = `rgba(255,240,180,${this.itemFlash[i]})`), c.fillRect(x, y, s, s);
      if (it.label || it.id) {
        c.save();
        c.globalAlpha = dim ? 0.3 : 1;
        drawHudItemIcon(c, it, x + 2, y + 2, s - 4);
        c.restore();
      }
      label(c, device === 'pad' ? padKeys[i] : String(i + 1), x + 4, y + 14, 12, C.dim, 'left', 800);
      if (it.label || it.id) label(c, `${it.count}`, x + s - 4, y + s - 4, 17, dim ? '#6a7276' : '#fff', 'right', 900);
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

  private timer(c: CanvasRenderingContext2D, s: HudState) {
    if (!s.timer) return;
    const t = Math.max(0, s.timer.sec);
    label(c, `${s.timer.label} ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, W / 2, 40, 26, t < 10 ? C.hpLow : '#bfe0f0', 'center', 900);
  }

  /** 아래 자막 한 줄만 (본부처럼 전투 HUD가 없는 화면) */
  drawMessage(c: CanvasRenderingContext2D, text: string, compact?: boolean) {
    this.message(c, text, compact);
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
    let y = 196;
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

/** 총알 하나 (탄 숫자 옆) */
function bullet(c: CanvasRenderingContext2D, x: number, y: number, color: string) {
  c.fillStyle = '#000';
  c.fillRect(x - 5, y - 12, 10, 26);
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(x - 3, y + 12);
  c.lineTo(x - 3, y - 4);
  c.quadraticCurveTo(x, y - 12, x + 3, y - 4);
  c.lineTo(x + 3, y + 12);
  c.closePath();
  c.fill();
  c.fillStyle = 'rgba(0,0,0,0.35)';
  c.fillRect(x - 3, y + 4, 6, 2);
}

/** 아이템 아이콘 그리개. 아이템 모듈의 drawItemIcon(ctx, id, x, y, size) 을 엔진이 setHudItemIcon 으로 넘긴다.
 *  id 가 없거나 그리개가 없으면 이름으로 고른 간단한 도형을 그린다 (글자는 쓰지 않는다) */
type IconDrawer = (c: CanvasRenderingContext2D, id: string, x: number, y: number, size: number) => void;
let iconDrawer: IconDrawer | null = null;
export function setHudItemIcon(fn: IconDrawer | null) {
  iconDrawer = fn;
}
export function drawHudItemIcon(c: CanvasRenderingContext2D, it: { id?: string; label: string }, x: number, y: number, size: number) {
  // GPT 퀵슬롯 아이콘(도트 32×32)이 먼저. 모르는 id는 「모르는 물건」 봉투
  const src = it.id ? ITEM_IMG[it.id] ?? (/탄약|탄창/.test(it.label) ? ITEM_IMG.ammo : ITEM_IMG.unknown) : null;
  const im = src ? kitImage(src) : null;
  if (im) {
    const k = Math.max(1, Math.floor(size / 32));
    const d = 32 * k;
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(im, Math.round(x + (size - d) / 2), Math.round(y + (size - d) / 2), d, d);
    c.restore();
    return;
  }
  if (it.id && iconDrawer) return iconDrawer(c, it.id, x, y, size);
  c.save();
  c.translate(x, y);
  c.scale(size / 32, size / 32);
  const l = it.label;
  const f = (col: string, ...r: number[]) => {
    c.fillStyle = col;
    for (let i = 0; i < r.length; i += 4) c.fillRect(r[i], r[i + 1], r[i + 2], r[i + 3]);
  };
  if (/붕대|봉대|밴드/.test(l)) f('#e8e2d0', 4, 11, 24, 10), f('#c9c0a8', 4, 11, 24, 2, 4, 19, 24, 2), f('#d65a5a', 14, 13, 4, 6, 13, 14, 6, 4);
  else if (/섬광|수류|폭탄|탄$/.test(l)) {
    f('#e08a3c', 9, 10, 14, 18), f('#9aa4ab', 12, 5, 8, 6), f('#4a5258', 19, 3, 6, 3), f('#fff3b0', 12, 14, 3, 8);
  } else if (/주사|각성|제$/.test(l)) {
    f('#9aa4ab', 6, 24, 4, 4), f('#e8ecee', 9, 9, 8, 16), f('#9a7fd1', 10, 14, 6, 10), f('#4a5258', 11, 5, 4, 5, 8, 3, 10, 3), f('#d8d8d8', 12, 25, 2, 6);
  } else if (/약|물약|회복|포션/.test(l)) {
    f('#4a5258', 13, 3, 6, 4), f('#c8d0d4', 12, 7, 8, 4), f('#5fbf6a', 7, 11, 18, 18), f('#9be0a3', 9, 13, 4, 8), f('#e8ecee', 13, 17, 6, 2, 15, 15, 2, 6);
  } else if (/부적|봉인|종이/.test(l)) f('#e6d36a', 8, 4, 16, 24), f('#d65a5a', 11, 8, 10, 2, 15, 8, 2, 16, 11, 16, 10, 2);
  else if (/열쇠|키$/.test(l)) f('#d6b64a', 4, 10, 10, 10, 14, 14, 16, 3, 24, 17, 3, 5, 19, 17, 3, 4), f('#2c383e', 7, 13, 4, 4);
  else if (/손전등|등$/.test(l)) f('#4a5258', 4, 12, 16, 8), f('#9aa4ab', 20, 9, 6, 14), f('#fff3b0', 26, 10, 3, 12);
  else {
    // 모르는 물건: 상자
    f('#a07850', 6, 9, 20, 18), f('#7a5838', 6, 9, 20, 4), f('#d6b64a', 14, 9, 4, 18);
  }
  c.restore();
}

/** 일시정지 메뉴에 넣을 지금 상태 (재화·총애·층·규칙서). 화면에 늘 띄우지 않는 것들 */
export function statusHtml(s: HudState | null): string {
  if (!s) return '';
  const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const m = s.money;
  const fav = s.favor > 0 ? `+${s.favor}` : String(s.favor);
  const rows = [
    s.floor.depth || s.floor.name ? `<tr><th>층</th><td>${esc((s.floor.depth && !s.floor.name.startsWith(s.floor.depth) ? [s.floor.depth, s.floor.name] : [s.floor.name || s.floor.depth]).filter(Boolean).join(' · '))}${s.floor.variant ? ` · ${esc(s.floor.variant)}` : ''}</td></tr>` : '',
    `<tr><th>재화</th><td>현금 ${m.cash} · 예산 ${m.budget} · 연구 자료 ${m.research} · 이빨 ${m.teeth}</td></tr>`,
    `<tr><th>승강기 총애</th><td>${fav}</td></tr>`,
    s.ruleCount ? `<tr><th>규칙서</th><td>찾음 ${s.ruleCount.found} · 송신 ${s.ruleCount.sent}</td></tr>` : '',
    ...(s.rules ?? []).map((r) => `<tr><th></th><td>${esc(r.text)}</td></tr>`),
  ];
  return `<table>${rows.join('')}</table>`;
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
