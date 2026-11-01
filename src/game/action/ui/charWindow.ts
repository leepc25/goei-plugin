// 통합 캐릭터 창 시안 (2026-11-01, 설계 docs/설계_통합창_퍽.md 2-2).
// 창 하나 1280×720. 위 머리(얼굴·이름·소속·상태·체력)는 늘 보이고, 아래는 탭(능력치·기술·퍽·소지품)으로 넘긴다(사용자 11-01: 고유 퍽 없음, 힘민체지정, 탭으로).
// 틀은 HUD 그림(초상·기술 칸·체력 막대·아이템 칸)과 kit 판을 그대로 쓰고, 칸 사이 판은 도트 모서리를 깎은 남색 판으로 코드가 그린다.
// 아직 게임에 연결하지 않았다: 배치가 정해지면 Tab/일시정지 메뉴에 붙인다.
import { hudArtImage, pixelIcon, pixelText, putText, type SkillIcon } from './pixelHud';
import { kitPiece, kitSlice, nine } from './kit';
import { CW_ART } from './charWindowArt';

// PixelLab 조각 한 장(kit_0.png: 큰 판·작은 판·탭·빈 퍽 자리)을 1배로 찍는다
type ArtKey = keyof typeof CW_ART;
const cwImgs: Partial<Record<ArtKey, HTMLImageElement>> = {};
function art(k: ArtKey): HTMLImageElement | null {
  let im = cwImgs[k];
  if (!im) { im = new Image(); im.src = CW_ART[k].src; cwImgs[k] = im; }
  return im.complete && im.naturalWidth ? im : null;
}
/** 9칸 늘리기 (조각 1도트 = k px) */
function stretch(c: CanvasRenderingContext2D, k: ArtKey, x: number, y: number, w: number, h: number, z = 1): boolean {
  const im = art(k);
  if (!im) return false;
  const a = CW_ART[k] as { slice?: readonly number[] };
  const [t, r, b, l] = a.slice ?? [0, 0, 0, 0];
  nine(c, im, [t, r, b, l], x, y, w, h, z);
  return true;
}

export interface CharWindowData {
  name: string; team: string; state: string; face?: CanvasImageSource | null;
  hp: number; maxHp: number;
  /** 힘·민·체·지·정 (1~10, 요원마다 고정). now = 퍽으로 바뀐 값 */
  base: { label: string; v: number; now?: number; what: string }[];
  /** 산출 수치 (docs/퍽/능력치_55명.md) */
  derived: { label: string; v: string; now?: string }[];
  skills: { key: string; label: string; icon: SkillIcon; name: string; off?: boolean }[];
  pick: { skill: number; desc: string[]; nums: string };
  perks: { name: string; effect: string; badge?: CanvasImageSource | null; trait?: boolean }[];
  perkSlots: number; perkPick: number;
  quick: { label: string; count: number }[]; bag: { label: string; count: number }[]; bagSlots: number;
  money: string;
}

const INK = '#e6e4dc', DIM = '#7d8790', GOLD = '#ffd66b', UP = '#7fe08a';
const NAVY = '#101a36', NAVY_D = '#0a1126', RIM_L = '#aeb8c8', RIM_D = '#4a5468', SOCKET = '#070c1c';

/** 도트 판: 모서리 2도트 깎고, 위·왼쪽 밝은 테, 아래·오른쪽 어두운 테 (둥근 상자·표 선 아님) */
function plate(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = NAVY) {
  const u = 2;
  c.fillStyle = RIM_D; c.fillRect(x + 2 * u, y, w - 4 * u, h); c.fillRect(x, y + 2 * u, w, h - 4 * u); c.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  c.fillStyle = RIM_L; c.fillRect(x + 2 * u, y, w - 4 * u, u); c.fillRect(x, y + 2 * u, u, h - 4 * u); c.fillRect(x + u, y + u, u, u);
  c.fillStyle = fill; c.fillRect(x + 2 * u, y + u, w - 4 * u, h - 2 * u); c.fillRect(x + u, y + 2 * u, w - 2 * u, h - 4 * u);
}
/** 빈 뱃지 자리: 도트 원 */
function socket(c: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  const so = art('socket');
  if (so) { c.drawImage(so, cx - 34, cy - 31, 68, 62); return; }
  for (let yy = -r; yy <= r; yy += 2) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy) / 2) * 2;
    c.fillStyle = Math.abs(yy) > r - 4 || half < 6 ? RIM_D : SOCKET;
    c.fillRect(cx - half, cy + yy, half * 2, 2);
    c.fillStyle = RIM_D; c.fillRect(cx - half, cy + yy, 2, 2); c.fillRect(cx + half - 2, cy + yy, 2, 2);
  }
}
/** 고른 칸 표시: 금색 도트 모서리 네 개 */
function corners(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = GOLD;
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.fillRect(sx > 0 ? px : px - 10, sy > 0 ? py : py - 2, 10, 2);
    c.fillRect(sx > 0 ? px : px - 2, sy > 0 ? py : py - 10, 2, 10);
  }
}

export const CHAR_TABS = ['능력치', '기술', '퍽', '소지품'] as const;
export type CharTab = (typeof CHAR_TABS)[number];

export function drawCharWindow(c: CanvasRenderingContext2D, d: CharWindowData, tab: CharTab = '능력치', W = 1280, H = 720) {
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
  const panel = kitPiece('panel');
  if (!stretch(c, 'frame', 16, 16, W - 32, H - 32)) {
    if (panel) nine(c, panel, kitSlice('panel'), 16, 16, W - 32, H - 32, 2);
    else plate(c, 16, 16, W - 32, H - 32, NAVY_D);
  }
  const T = (s: string, col = INK) => pixelText(s, col, 22);
  const B = (s: string, col = INK) => pixelText(s, col, 33);

  /* ── 머리 (늘 보임) ── */
  const hx = 104, hy = 54;
  if (!stretch(c, 'inner', 40, 36, W - 80, 120)) plate(c, 48, 44, W - 96, 104);
  const P = hudArtImage('portrait');
  if (d.face) c.drawImage(d.face, hx + 8, hy + 4, 64, 64);
  if (P) c.drawImage(P, hx, hy - 4);
  putText(c, B(d.name), hx + 100, hy + 2);
  const team = T(d.team, DIM);
  putText(c, team, hx + 100, hy + 46);
  const tag = T(d.state, '#9fd7ff');
  plate(c, hx + 116 + team.width, hy + 40, tag.width + 20, 34, '#16284a');
  putText(c, tag, hx + 126 + team.width, hy + 46);
  const HP = hudArtImage('hp');
  const bx = W - 104 - 20 - 244 - 70, by = hy + 10;
  putText(c, T('체력', DIM), bx, by - 2);
  if (HP) {
    c.drawImage(HP, bx + 70, by);
    const [ix0, iy0, ix1, iy1] = [17, 5, 225, 14], r = d.hp / d.maxHp;
    c.fillStyle = '#4fc25a'; c.fillRect(bx + 70 + ix0, by + iy0, Math.round((ix1 - ix0) * r), iy1 - iy0);
    c.fillStyle = '#8be38f'; c.fillRect(bx + 70 + ix0, by + iy0, Math.round((ix1 - ix0) * r), 2);
  }
  putText(c, T(`${d.hp.toLocaleString()} / ${d.maxHp.toLocaleString()}`), bx + 70 + 244, by + 32, 'right');

  /* ── 탭 줄 ── */
  const ty = 160;
  putText(c, T('Q', DIM), 60, ty + 10);
  let tx = 92;
  for (const name of CHAR_TABS) {
    const on = name === tab, t = T(name, on ? GOLD : DIM), w = t.width + 64;
    c.save(); if (!on) c.globalAlpha = 0.55;
    if (!stretch(c, 'tab', tx, ty, w, 40)) plate(c, tx, ty, w, 44, on ? '#1c2c58' : NAVY_D);
    c.restore();
    if (on) { c.fillStyle = GOLD; c.fillRect(tx + 14, ty + 32, w - 28, 2); }
    putText(c, t, tx + 32, ty + 8);
    tx += w + 8;
  }
  putText(c, T('E', DIM), tx + 6, ty + 10);
  putText(c, T('Tab 닫기', DIM), W - 64, ty + 10, 'right');

  /* ── 본문 ── */
  const top = ty + 48, bh = H - 40 - top, L = 40, R = W - 40;
  if (!stretch(c, 'inner', L, top, R - L, bh)) plate(c, L, top, R - L, bh);
  const SL = hudArtImage('slot');

  if (tab === '능력치') {
    // 왼쪽: 힘민체지정 크게 + 눈금 + 하는 일, 오른쪽: 산출 수치
    d.base.forEach((s, i) => {
      const yy = top + 34 + i * 86, v = s.now ?? s.v;
      putText(c, B(s.label), L + 48, yy);
      putText(c, B(String(v), s.now !== undefined && s.now !== s.v ? UP : GOLD), L + 130, yy, 'right');
      for (let k = 0; k < 10; k++) {
        const px = L + 156 + k * 26, py = yy + 8;
        c.fillStyle = RIM_D; c.fillRect(px, py, 20, 20);
        c.fillStyle = k < s.v ? '#e8c45a' : k < v ? UP : SOCKET; c.fillRect(px + 2, py + 2, 16, 16);
      }
      putText(c, T(s.what, DIM), L + 48, yy + 44);
    });
    const dx0 = L + 640;
    c.fillStyle = RIM_D; c.fillRect(dx0 - 30, top + 24, 2, bh - 48);
    putText(c, T('전투 수치', GOLD), dx0, top + 26);
    d.derived.forEach((s, i) => {
      const yy = top + 72 + i * 44;
      putText(c, T(s.label, DIM), dx0, yy);
      putText(c, T(s.now ?? s.v, s.now && s.now !== s.v ? UP : INK), R - 36, yy, 'right');
    });
  } else if (tab === '기술') {
    d.skills.forEach((k, i) => {
      const x = L + 40 + i * 190, y = top + 34;
      if (SL) c.drawImage(SL, x, y);
      pixelIcon(c, k.icon, x + 25, y + 25, 2, k.off ? '#3b4148' : INK);
      putText(c, T(k.key, GOLD), x + 60, y + 2);
      putText(c, T(k.label, k.off ? '#4a525a' : INK), x + 60, y + 28);
      if (i === d.pick.skill) corners(c, x - 8, y - 8, 140, 66);
    });
    const pk = d.skills[d.pick.skill], y0 = top + 130;
    c.fillStyle = RIM_D; c.fillRect(L + 30, y0 - 14, R - L - 60, 2);
    putText(c, B(pk.name, GOLD), L + 40, y0);
    d.pick.desc.forEach((l, i) => putText(c, T(l), L + 40, y0 + 50 + i * 32));
    putText(c, T(d.pick.nums, '#9fd7ff'), L + 40, y0 + 50 + d.pick.desc.length * 32 + 10);
  } else if (tab === '퍽') {
    const gw = 700, per = Math.floor((gw - 20) / 78);
    for (let i = 0; i < d.perkSlots; i++) {
      const x = L + 48 + (i % per) * 78, y = top + 30 + Math.floor(i / per) * 78;
      const p = d.perks[i];
      if (p?.badge) c.drawImage(p.badge, x, y, 64, 64); else socket(c, x + 32, y + 32, 28);
      if (i === d.perkPick) corners(c, x - 5, y - 5, 74, 74);
    }
    putText(c, T(`이번 괴이에서 얻은 퍽 ${d.perks.length} / ${d.perkSlots}`, DIM), L + 48, top + bh - 46);
    const dx0 = L + gw + 40;
    c.fillStyle = RIM_D; c.fillRect(dx0 - 24, top + 24, 2, bh - 48);
    const pp = d.perks[d.perkPick];
    if (pp) {
      stretch(c, 'inner', dx0 - 16, top + 18, 160, 160);
      if (pp.badge) c.drawImage(pp.badge, dx0, top + 34, 128, 128);
      putText(c, pixelText(pp.trait ? '특성' : '퍽', pp.trait ? '#ff9a8a' : DIM, 22), dx0 + 166, top + 40);
      putText(c, B(pp.name, GOLD), dx0 + 166, top + 72);
      putText(c, T(pp.effect), dx0, top + 186);
      putText(c, T('괴이를 나오면 사라짐', DIM), dx0, top + 222);
    }
  } else {
    const slot = (x: number, y: number, it?: { label: string; count: number }, k?: string, on = false) => {
      if (SL) c.drawImage(SL, x, y);
      if (it) {
        putText(c, T(it.label.slice(0, 2)), x + 25, y + 14, 'center');
        if (it.count > 1) putText(c, pixelText(String(it.count), GOLD, 11), x + 44, y + 34, 'right');
      }
      if (k) putText(c, pixelText(k, GOLD, 11), x + 4, y + 2);
      if (on) corners(c, x - 5, y - 5, 60, 60);
    };
    putText(c, T('퀵칸', GOLD), L + 48, top + 24);
    for (let i = 0; i < 4; i++) slot(L + 48 + i * 62, top + 60, d.quick[i], String(i + 1), i === 0);
    putText(c, T(`가방 ${d.bag.length} / ${d.bagSlots}`, GOLD), L + 48, top + 140);
    for (let i = 0; i < d.bagSlots; i++) slot(L + 48 + (i % 8) * 62, top + 176 + Math.floor(i / 8) * 62, d.bag[i]);
    const dx0 = L + 600;
    c.fillStyle = RIM_D; c.fillRect(dx0 - 24, top + 24, 2, bh - 48);
    const it = d.quick[0];
    if (it) {
      putText(c, B(it.label, GOLD), dx0, top + 24);
      putText(c, T(`${it.count}개`), dx0, top + 72);
      putText(c, T('쓰기 · 버리기', '#9fd7ff'), dx0, top + 108);
    }
    putText(c, T('현금', DIM), dx0, top + bh - 80);
    putText(c, B(d.money, GOLD), dx0, top + bh - 50);
  }
  c.restore();
}
