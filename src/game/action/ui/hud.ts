// 게임 HUD: 1280×720 캔버스 위에 그린다. 엔진은 HudState 만 채운다.
import { KEYMAP } from '../engine/input';
// 오락실식: 왼쪽 위 한 묶음(얼굴·체력·필살·탄), 오른쪽 위 구석 층 글자, 왼쪽 아래 아이템 아이콘, 아래 대사.
// 지금 장소는 일시정지 메뉴(statusHtml). 옛 승강기 총애·출동 재화·규칙서 표시는 2026-10-28에 지웠다.
// 터치 버튼이 보이면 compact: 아이템은 터치 버튼이 대신 보여 준다.
import { agentFaces, kitImage, kitPiece, kitSlice, nine, PIXEL_FONT } from './kit';
import { drawPixelCard, drawPixelHotbar, drawPixelItems, hotbarSize, pixelHudReady, type PixelSlot } from './pixelHud';
import { ITEM_IMG } from './kit.gen';
import { H as H0, W as W0 } from './stage';
import { setExplorationMap } from './mapLayout';
import type { NavigationFeedback } from '../engine/navigationFeedback';
import { drawHintIcon } from '../engine/hint';

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
  /** 아래 자막을 이 x(캔버스 px) 오른쪽에 (왼쪽 아래 기술 칸 줄) */
  messageLeft?: number;
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
  /** 필드: 시각과 장소 이름 (우상단 작게) */
  field?: { clock?: string; place?: string; wallet?: string };
  boss?: { name: string; hp: number; max: number } | null;
  /** 구형 조사 안내. 좌표는 호환을 위해 받고 고정 안내 영역에 표시한다. */
  prompt?: { text: string; key: string; x: number; y: number } | null;
  /** 읽기 전용 출입·목표 안내. 엔진 연결은 navigation-feedback-round2.patch 참조. */
  navigation?: NavigationFeedback;
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
/** 말줄임표까지 폭에 포함한다. UTF-16 중간을 잘라 아이콘을 깨뜨리지 않는다. */
function fitText(c: CanvasRenderingContext2D, text: string, width: number): string {
  if (c.measureText(text).width <= width) return text;
  const chars = Array.from(text);
  while (chars.length && c.measureText(chars.join('') + '…').width > width) chars.pop();
  return chars.join('') + '…';
}
function wrapText(c: CanvasRenderingContext2D, text: string, width: number, maxRows: number): string[] {
  const rows: string[] = [];
  let line = '';
  const chars = Array.from(text.replace(/\s+/g, ' '));
  for (let i = 0; i < chars.length; i++) {
    if (line && c.measureText(line + chars[i]).width > width) {
      rows.push(line);
      if (rows.length === maxRows - 1) return [...rows, fitText(c, chars.slice(i).join(''), width)];
      line = '';
    }
    line += chars[i];
  }
  if (line) rows.push(line);
  return rows;
}
/** HUD 밖(효과 층)에서도 도트 글꼴로 쓰게 켠다/끈다 */
export function setPixelText(on: boolean) {
  pixelOn = on;
}

/** 상태 효과 칩 (필드 주인공 칸: 전투 HUD는 meterRows가 같은 모양으로 그린다) */
export function statusChips(c: CanvasRenderingContext2D, list: { label: string; good: boolean }[], x: number, y: number) {
  let cx = x;
  for (const st of list) {
    c.font = font(13, 800);
    const w = c.measureText(st.label).width + 14;
    c.beginPath();
    c.roundRect(cx, y, w, 22, 11);
    c.fillStyle = st.good ? 'rgba(60,140,90,0.9)' : 'rgba(150,50,50,0.9)';
    c.fill();
    label(c, st.label, cx + 7, y + 16, 13, '#fff', 'left', 800);
    cx += w + 6;
  }
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
  private lastFloor = '';
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
    this.lastItems = [];
  }

  draw(c: CanvasRenderingContext2D, s: HudState, dt: number) {
    setExplorationMap(c.canvas, false);
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
    if (!s.compact && !(s.agent.portrait && pixelHudReady())) this.items(c, s.items, s.device); // 도트 칸이면 초상화 칸 아래에 그렸다
    if (s.boss) this.boss(c, s.boss, s.compact);
    this.timer(c, s);
    if (s.message) this.message(c, s.message, s.compact, (s.messageLeft ?? 0) / k);
    this.navigation(c, s);
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
    const x = s.compact ? 100 : 22,
      y = 18,
      fs = 80;
    if (s.agent.portrait && pixelHudReady()) {
      const end = drawPixelCard(c, { name: s.agent.name, face: s.agent.portrait, hp: s.hp, maxHp: s.maxHp, trail: this.trail, hurtT: this.hurtT, gauge: s.gauge, superKey: s.device === 'pad' ? 'RT' : s.device === 'touch' ? '' : superKey(), armor: s.armor, t: this.t }, x - 6, y - 4);
      const iy = s.compact ? end : this.pixelItems(c, s.items, s.device, x + 78, end + 6);
      if (s.weapon) this.ammo(c, s.weapon, x + 90, iy + 26);
      this.meterRows(c, s, x, Math.max(y + fs + 52, iy + (s.weapon ? 40 : 10)));
      return;
    }
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
      bw = s.compact ? 250 : 300;
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
      gw = s.compact ? 180 : 220,
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
      label(c, s.device === 'pad' ? 'RT' : s.device === 'touch' ? '필살' : superKey(), bx + gw + 10, gy + 12, 15, C.gauge, 'left', 900);
    }
    // 탄: 총알 그림 + 큰 숫자
    if (s.weapon) this.ammo(c, s.weapon, bx, gy + gh + 30);
    this.meterRows(c, s, x, y + fs + 52);
  }

  private meterRows(c: CanvasRenderingContext2D, s: HudState, x: number, my: number) {
    // 가드 같은 상황 막대는 묶음 아래
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
    label(c, `예비 ${w.reserve}`, x + 26 + mw, y, 16, C.dim, 'left', 800);
    c.font = font(16, 800);
    const ex = x + 34 + mw + c.measureText(`예비 ${w.reserve}`).width + 8;
    if (w.temp) label(c, `${w.temp.name} ${w.temp.uses}회`, ex, y, 15, C.amber, 'left', 800);
    else if (w.reload != null) {
      bar(c, ex, y - 12, 90, 8, w.reload, '#e8e0b0', '#000');
      label(c, '재장전', ex + 98, y, 14, '#e8e0b0', 'left', 800);
    } else if (w.mag <= Math.ceil(w.magMax * 0.25)) label(c, w.reserve > 0 ? '재장전!' : '탄 없음', ex, y, 15, Math.sin(this.t * 8) > 0 ? C.hpLow : '#fff', 'left', 900);
  }

  /** 층: 오른쪽 위 구석에 글자만 (판 없음). 바뀔 때는 Fx 층 제목이 크게 알린다 */
  private floor(c: CanvasRenderingContext2D, s: HudState) {
    const f = s.floor;
    if (s.field) {
      const r = W - (s.compact ? 100 : 20);
      if (s.field.clock) label(c, s.field.clock, r, 34, 26, '#fff', 'right', 900);
      if (s.field.place) label(c, s.field.place, r, 56, 15, C.amber, 'right', 800);
      if (s.field.wallet) label(c, s.field.wallet, r, 76, 15, '#cfe3c8', 'right', 800);
    }
    if (!f.depth) return;
    const right = W - (s.compact ? 100 : 20);
    label(c, f.depth, right, 44, 32, '#fff', 'right', 900);
    if (f.variant) label(c, f.variant, right, 68, 15, C.amber, 'right', 800);
  }

  /** 아이템: 아이콘만 (글자 없음), 체력 막대 오른쪽 위 천장 띠. 바닥(물건·자막)과 겹치지 않게 (독립 검수: UI 안전영역).
   * 터치 화면에서는 터치 버튼이 대신 보여 준다 */
  /** 아이템 칸 넷 (도트, 필살 게이지 아래). 돌려주는 값 = 아래 끝 y */
  private pixelItems(c: CanvasRenderingContext2D, items: HudItem[], device: string | undefined, x: number, y: number): number {
    return drawPixelItems(c, items, x, y, [], this.itemFlash, (it, ix, iy, sz) => drawHudItemIcon(c, it, ix, iy, sz));
  }

  private items(c: CanvasRenderingContext2D, items: HudItem[], device?: string) {
    const n = 4,
      s = 52,
      g = 8;
    const x0 = 482,
      y = 22;
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
      // The exploration minimap occupies the upper centre on landscape phones.
      y = H - 128;
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
    // 아이템(482..714, 22..74) 아래, 미니맵 왼쪽. 터치 미니맵은 x=560부터다.
    const x = s.compact ? 340 : 482, y = s.compact ? 174 : 116;
    c.font = font(15);
    const text = fitText(c, `${s.timer.label} ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`, s.compact ? 120 : 230);
    label(c, text, x, y, 15, t < 10 ? C.hpLow : '#bfe0f0');
  }

  /** 필드 주인공 칸 (전투 HUD가 없는 본부·거점): 왼쪽 아래 도트 얼굴 + 이름 + 체력 + 필살 게이지. 터치·좁은 화면은 왼쪽 위(아래는 스틱 자리).
   * 돌려주는 값 = 칸 오른쪽 끝 x (자막을 그 오른쪽에 둔다) */
  /** 필드(방문) 오른쪽 위: 필드 시각·장소·잔고 (전투 HUD를 안 그리는 필드에서) */
  drawFieldCorner(c: CanvasRenderingContext2D, f: HudState['field'], compact?: boolean) {
    if (!f) return;
    c.save();
    const k = compact ? 1.2 : 1;
    W = c.canvas.width / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    const r = W - (compact ? 100 : 20);
    if (f.clock) label(c, f.clock, r, 34, 26, '#fff', 'right', 900);
    if (f.place) label(c, f.place, r, 56, 15, C.amber, 'right', 800);
    if (f.wallet) label(c, f.wallet, r, f.clock || f.place ? 76 : 34, 15, '#cfe3c8', 'right', 800);
    c.restore();
  }

  drawFieldCard(c: CanvasRenderingContext2D, s: { name: string; face?: CanvasImageSource | null; hp: number; maxHp: number; gauge?: number; sub?: string; compact?: boolean; top?: boolean; items?: HudItem[]; device?: string; status?: { label: string; good: boolean }[] }, dt = 1 / 60): number {
    this.t += dt;
    c.save();
    const k = s.compact ? 1.2 : 1;
    W = c.canvas.width / k;
    H = c.canvas.height / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    pixelOn = true;
    const fs = 64, bw = 200, bh = 14;
    const x = 28, y = s.top ? 28 : H - fs - 28;
    // 체력이 줄면 얼굴이 붉게 번쩍, 붉은 띠가 늦게 따라온다 (전투 HUD와 같은 느낌)
    if (this.lastHp >= 0 && s.hp < this.lastHp) (this.hurtT = 0.35), (this.trailHold = 0.5);
    if (this.trail < 0 || this.trail < s.hp) this.trail = s.hp;
    else if (this.trailHold > 0) this.trailHold -= dt;
    else this.trail = Math.max(s.hp, this.trail - s.maxHp * dt * 0.6);
    this.lastHp = s.hp;
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (pixelHudReady()) {
      const cy = s.top ? 14 : H - 170;
      const end = drawPixelCard(c, { name: s.name, face: s.face, hp: s.hp, maxHp: s.maxHp, trail: this.trail, hurtT: this.hurtT, gauge: s.gauge, superKey: superKey(), t: this.t }, 16, cy);
      const iy = s.items && !s.compact ? this.pixelItems(c, s.items, s.device, 16 + 84, end + 6) : end;
      if (s.status?.length) statusChips(c, s.status, 16 + 84, iy + 8);
      pixelOn = false;
      c.restore();
      return (16 + 340) * k;
    }
    // 칸 뒤 어두운 판
    c.fillStyle = 'rgba(6,10,14,0.72)';
    c.fillRect(x - 12, y - 12, fs + bw + 52, fs + 24);
    c.fillStyle = '#141b20';
    c.fillRect(x, y, fs, fs);
    c.save();
    c.imageSmoothingEnabled = false;
    if (s.face) c.drawImage(s.face, x, y, fs, fs);
    else label(c, s.name.slice(0, 1) || '?', x + fs / 2, y + fs * 0.7, 34, '#fff', 'center', 900);
    c.restore();
    if (this.hurtT > 0) (c.fillStyle = `rgba(255,40,40,${this.hurtT * 1.2})`), c.fillRect(x, y, fs, fs);
    const pf = kitPiece('portrait');
    if (pf) nine(c, pf, kitSlice('portrait'), x - 8, y - 8, fs + 16, fs + 16, 1);
    else (c.strokeStyle = C.frame), (c.lineWidth = 3), c.strokeRect(x - 1.5, y - 1.5, fs + 3, fs + 3);
    const bx = x + fs + 18;
    label(c, s.name, bx, y + 16, 18, C.name, 'left', 900);
    if (s.sub) {
      c.font = font(18, 900);
      label(c, s.sub, bx + c.measureText(s.name).width + 10, y + 16, 13, C.amber, 'left', 800);
    }
    const by = y + 26;
    const r = Math.max(0, Math.min(1, s.hp / s.maxHp));
    c.fillStyle = '#000';
    c.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
    c.fillStyle = '#3a1410';
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = C.trail;
    c.fillRect(bx, by, (bw * this.trail) / s.maxHp, bh);
    c.fillStyle = r < 0.25 ? (Math.sin(this.t * 10) > 0 ? C.hpLow : C.hp) : r < 0.5 ? C.hpMid : C.hp;
    c.fillRect(bx, by, Math.round(bw * r), bh);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(bx, by + 2, Math.round(bw * r), 2);
    const bf = kitPiece('bar');
    if (bf) nine(c, bf, kitSlice('bar'), bx - 14, by - 7, bw + 28, bh + 14, 1);
    label(c, `${Math.max(0, Math.ceil(s.hp))}`, bx + bw - 4, by + bh - 2, 12, '#fff', 'right', 900);
    if (s.gauge !== undefined) {
      const gy = by + bh + 8, gw = 150, gh = 8, full = s.gauge >= 100;
      c.fillStyle = '#000';
      c.fillRect(bx - 2, gy - 2, gw + 4, gh + 4);
      bar(c, bx, gy, gw, gh, s.gauge / 100, full ? `hsl(${40 + Math.sin(this.t * 8) * 10},95%,${60 + Math.sin(this.t * 8) * 12}%)` : C.gaugeFill, '#10181c');
      if (full) label(c, `필살 ${superKey()}`, bx + gw + 8, gy + 9, 12, C.gauge, 'left', 900);
    }
    pixelOn = false;
    c.restore();
    return (x + fs + bw + 40) * k;
  }

  /** 말풍선 (본부 대사): x = 말하는 사람 가운데, y = 머리 위(풍선 꼬리 끝), 캔버스 px. who가 있으면 위에 이름 */
  drawSpeech(c: CanvasRenderingContext2D, p: { x: number; y: number; who: string; text: string; compact?: boolean }) {
    c.save();
    const k = p.compact ? 1.2 : 1;
    c.setTransform(k, 0, 0, k, 0, 0);
    W = c.canvas.width / k;
    pixelOn = true;
    const U = 2;
    c.font = font(22);
    const lines = wrapText(c, p.text, 400, 3);
    const tw = Math.max(...lines.map((l) => Math.ceil(c.measureText(l).width)), p.who ? Math.ceil(c.measureText(p.who).width) * 0.55 : 0);
    const nameH = p.who ? 18 : 0, lh = 26, padX = 12, padY = 8;
    const w = tw + padX * 2, h = nameH + lines.length * lh + padY * 2 - 4;
    const tail = 10;
    let x = Math.round(p.x / k - w / 2);
    x = Math.max(8, Math.min(W - w - 8, x));
    const y = Math.round(Math.max(8, p.y / k - tail - h));
    const box = (bx: number, by: number, bw: number, bh: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(bx + U, by, bw - 2 * U, bh);
      c.fillRect(bx, by + U, bw, bh - 2 * U);
    };
    box(x + U, y + U * 2, w, h, 'rgba(0,0,0,0.35)');
    box(x - U, y - U, w + 2 * U, h + 2 * U, '#0b0f12');
    box(x, y, w, h, '#cfc8b4');
    box(x + U, y + U, w - 2 * U, h - 2 * U, '#1a2026');
    // 꼬리: 말하는 사람 쪽 (계단 모양)
    const tx = Math.round(Math.max(x + 10, Math.min(x + w - 18, p.x / k - 4)));
    for (let i = 0; i < tail / U; i++) {
      const tw2 = Math.max(U, 10 - i * U * 2);
      c.fillStyle = '#0b0f12'; c.fillRect(tx + (10 - tw2) / 2 - U, y + h + i * U - U, tw2 + 2 * U, U + U);
      c.fillStyle = '#cfc8b4'; c.fillRect(tx + (10 - tw2) / 2, y + h + i * U - U, tw2, U);
    }
    c.textAlign = 'left'; c.textBaseline = 'middle';
    let ty = y + padY + 2;
    if (p.who) {
      c.font = font(11);
      c.fillStyle = '#ffcf6a';
      c.fillText(p.who, x + padX, ty + 6);
      ty += nameH;
    }
    c.font = font(22);
    c.fillStyle = '#f2ecdc';
    lines.forEach((l, i) => c.fillText(l, x + padX, ty + lh / 2 + i * lh - 2));
    pixelOn = false;
    c.restore();
  }

  /** 상호작용 안내: 캐릭터 옆에 뜨는 도트 말풍선 (키 단추 + 짧은 말). x,y = 캐릭터 머리 옆 화면 px(캔버스 px), side = 말풍선이 뻗는 쪽 */
  drawPrompt(c: CanvasRenderingContext2D, p: { x: number; y: number; side: 1 | -1; key: string; text: string; locked?: boolean; compact?: boolean }) {
    c.save();
    const k = p.compact ? 1.2 : 1;
    c.setTransform(k, 0, 0, k, 0, 0);
    pixelOn = true;
    const U = 2; // 도트 한 칸
    c.font = font(22);
    const tw = Math.ceil(c.measureText(p.text).width);
    const cap = 30, gap = 8, padX = 10, h = 40;
    const w = padX + cap + gap + tw + padX + (p.locked ? 20 : 0);
    const bob = Math.round(Math.sin(performance.now() / 260) * 2);
    let x = Math.round(p.x / k + (p.side > 0 ? 0 : -w)), y = Math.round(p.y / k - h / 2 + bob);
    // 계단 모서리 판 (도트): 바깥 어두운 테 → 밝은 테 → 안
    const box = (bx: number, by: number, bw: number, bh: number, col: string) => {
      c.fillStyle = col;
      c.fillRect(bx + U, by, bw - 2 * U, bh);
      c.fillRect(bx, by + U, bw, bh - 2 * U);
    };
    box(x + U, y + U * 2, w, h, 'rgba(0,0,0,0.35)'); // 그림자
    box(x - U, y - U, w + 2 * U, h + 2 * U, '#0b0f12');
    box(x, y, w, h, p.locked ? '#c98a1c' : '#cfc8b4');
    box(x + U, y + U, w - 2 * U, h - 2 * U, '#1a2026');
    // 꼬리: 캐릭터 쪽으로
    const tx = p.side > 0 ? x - U * 3 : x + w + U;
    c.fillStyle = p.locked ? '#c98a1c' : '#cfc8b4';
    c.fillRect(tx, y + h / 2 - U, U * 2, U * 2);
    c.fillRect(p.side > 0 ? tx + U * 2 : tx - U, y + h / 2 - U * 2, U, U * 4);
    // 키 단추
    const kx = x + padX, ky = y + (h - cap) / 2;
    box(kx, ky + U, cap, cap, '#6e6656');
    box(kx, ky, cap, cap - U, p.locked ? '#5a4a2a' : '#f2ead6');
    c.font = font(22);
    c.fillStyle = p.locked ? '#c9b48a' : '#1a2026';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(p.key, kx + cap / 2, ky + cap / 2);
    // 말 (잠김이면 자물쇠)
    let txx = kx + cap + gap;
    if (p.locked) {
      c.fillStyle = '#ffcf6a';
      c.fillRect(txx + 2, y + 18, 12, 10);
      c.fillRect(txx + 4, y + 12, 2, 6); c.fillRect(txx + 10, y + 12, 2, 6); c.fillRect(txx + 4, y + 11, 8, 2);
      c.fillStyle = '#1a2026'; c.fillRect(txx + 7, y + 21, 2, 4);
      txx += 20;
    }
    c.textAlign = 'left';
    c.fillStyle = p.locked ? '#ffcf6a' : '#f2ecdc';
    c.fillText(p.text, txx, y + h / 2 + 1);
    pixelOn = false;
    c.restore();
  }

  /** 왼쪽 아래 기술 칸 줄 (도트, PixelLab 틀). 돌려주는 값 = 오른쪽 끝 x (캔버스 px) */
  drawSkillBox(c: CanvasRenderingContext2D, s: SkillBoxState, dt = 1 / 60): number {
    this.t += dt;
    if (!pixelHudReady()) return 0;
    c.save();
    const k = s.compact ? 1.2 : 1;
    W = c.canvas.width / k;
    H = c.canvas.height / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    const sz = hotbarSize(s.slots.length);
    const end = drawPixelHotbar(c, s.slots, 16, H - sz.h - 10, this.t);
    c.restore();
    return end * k;
  }

  /** 아래 자막 한 줄만 (본부처럼 전투 HUD가 없는 화면) */
  drawMessage(c: CanvasRenderingContext2D, text: string, compact?: boolean, left = 0) {
    // 본부는 draw()를 거치지 않는다. 직전 출동의 W/H/배율을 재사용하지 않는다.
    c.save();
    const k = compact ? 1.2 : 1;
    W = c.canvas.width / k;
    H = c.canvas.height / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    this.message(c, text, compact, left / k);
    c.restore();
  }

  /** 본부의 전투 HUD 없는 화면에서도 동일한 안내 영역을 쓴다. */
  drawNavigation(c: CanvasRenderingContext2D, navigation: NavigationFeedback, compact = false, device?: HudState['device']) {
    c.save();
    const k = compact ? 1.2 : 1;
    W = c.canvas.width / k;
    H = c.canvas.height / k;
    c.setTransform(k, 0, 0, k, 0, 0);
    pixelOn = true;
    // 본부에는 전투 HUD가 없으므로 빈 상단을 쓴다. 복도 인물의 얼굴을 가리지 않는다.
    this.navigation(c, { navigation, compact, device }, 20);
    pixelOn = false;
    c.restore();
  }

  private message(c: CanvasRenderingContext2D, text: string, compact?: boolean, left = 0) {
    c.font = font(17, 600);
    let t = text;
    // left = 왼쪽 아래 주인공 칸 끝: 자막은 그 오른쪽 남은 폭 가운데
    const cx = left ? (left + W) / 2 : W / 2;
    t = fitText(c, t, Math.min(900, left ? W - left - 40 : W - (compact ? 240 : 64)));
    const w = c.measureText(t).width + 40;
    // 화면 맨 아래 띠: 몸통을 가로지르지 않게 (독립 검수: 자막이 캐릭터 허리를 관통)
    const y = H - 44;
    plate(c, cx - w / 2, y, w, 36, 18);
    label(c, t, cx, y + 25, 17, '#fff8e6', 'center', 600);
  }

  private navigation(c: CanvasRenderingContext2D, s: Pick<HudState, 'navigation' | 'prompt' | 'compact' | 'device'>, top?: number) {
    const nav = s.navigation;
    if (!nav && !s.prompt) return;
    // 상단 상태·미니맵, 하단 보스·자막·터치 버튼과 분리한 고정 안내 띠.
    const y = top ?? (s.compact ? 220 : 204);
    const x = s.compact ? 100 : 20, width = W - x * 2;
    const lines: { text: string; color: string }[] = [];
    if (nav?.objective) lines.push({ text: `현재 목표 · ${nav.objective}`, color: C.rule });
    const target = nav?.target;
    if (target) {
      const key = target.kind === 'locked' ? '잠김' : target.kind === 'decoration' ? '장식' : s.device === 'pad' ? 'B' : s.device === 'touch' || s.compact ? '조사' : 'E';
      lines.push({ text: `[${key}] ${target.text}${target.reason ? ` · ${target.reason}` : ''}`, color: target.kind === 'locked' ? C.amber : C.text });
    } else if (s.prompt) {
      const key = s.device === 'pad' ? 'B' : s.device === 'touch' || s.compact ? '조사' : s.prompt.key;
      lines.push({ text: `[${key}] ${s.prompt.text}`, color: C.text });
    }
    if (!lines.length) return;
    c.font = font(15);
    // 도트 글꼴에 없는 원문자도 잠금 번호를 읽을 수 있게 숫자로 표시한다.
    const rows = lines.flatMap(line => wrapText(c, line.text.replace(/[①②③④]/g, ch => `${'①②③④'.indexOf(ch) + 1}번`), width - 64, 2).map(text => ({ ...line, text })));
    plate(c, x, y, width, rows.length * 28 + 14);
    rows.forEach((row, i) => label(c, row.text, x + 12, y + 27 + i * 28, 15, row.color));
    if (target) {
      c.save();
      c.translate(x + width - 24, y + rows.length * 28 - 2);
      c.scale(0.4, 0.4);
      drawHintIcon(c, 0, 0, 0, target.kind === 'locked' ? 'locked' : target.kind === 'decoration' ? 'decoration' : 'available');
      c.restore();
    }
  }

  private drawToasts(c: CanvasRenderingContext2D, dt: number) {
    let y = this.last?.navigation || this.last?.prompt ? (this.last.compact ? 220 : 204) + 154 : 196;
    for (const t of this.toasts) {
      t.t += dt;
      const a = t.t < 0.15 ? t.t / 0.15 : t.t > 2.2 ? Math.max(0, 1 - (t.t - 2.2) / 0.5) : 1;
      c.globalAlpha = a;
      const x = this.last?.compact ? 100 : 22;
      c.font = font(15);
      label(c, fitText(c, t.text, W - x * 2), x + (1 - Math.min(1, t.t / 0.15)) * -20, y, 15, t.color);
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

/** 일시정지 메뉴에 넣을 지금 상태 (장소) */
export function statusHtml(s: HudState | null): string {
  if (!s) return '';
  const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
  const rows = [
    s.floor.depth || s.floor.name ? `<tr><th>층</th><td>${esc((s.floor.depth && !s.floor.name.startsWith(s.floor.depth) ? [s.floor.depth, s.floor.name] : [s.floor.name || s.floor.depth]).filter(Boolean).join(' · '))}${s.floor.variant ? ` · ${esc(s.floor.variant)}` : ''}</td></tr>` : '',
  ];
  return `<table>${rows.join('')}</table>`;
}

export interface SkillBoxState {
  compact?: boolean;
  slots: PixelSlot[];
}

/** 필살기 키 이름: 지금 키 배치(에일린이면 F)에서 찾는다 */
function superKey(): string {
  const code = Object.keys(KEYMAP).find((k) => KEYMAP[k] === 'super');
  return code ? code.replace(/^Key/, '') : 'W';
}
