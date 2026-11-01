// 통합 캐릭터 창 시안 (2026-11-01, 설계 docs/설계_통합창_퍽.md 2-2).
// 한 화면 1280×720(도트 2배 기준 640×360)에 머리·능력치·기술·퍽·소지품을 한꺼번에 그린다. 탭 없음.
// 틀은 HUD 그림(초상·기술 칸·체력 막대·아이템 칸)과 kit 판을 그대로 쓰고, 칸 사이 판은 도트 모서리를 깎은 남색 판으로 코드가 그린다.
// 아직 게임에 연결하지 않았다: 배치가 정해지면 Tab/일시정지 메뉴에 붙인다.
import { hudArtImage, pixelIcon, pixelText, putText, type SkillIcon } from './pixelHud';
import { kitPiece, kitSlice, nine } from './kit';

export interface CharWindowData {
  name: string; team: string; state: string; face?: CanvasImageSource | null;
  hp: number; maxHp: number;
  stats: { label: string; base: string; now?: string }[];
  skills: { key: string; label: string; icon: SkillIcon; name: string; off?: boolean }[];
  pick: { skill: number; desc: string[]; nums: string };
  unique: { name: string; effect: string; badge?: CanvasImageSource | null };
  perks: { name: string; effect: string; badge?: CanvasImageSource | null }[];
  perkSlots: number; perkPick: number;
  quick: { label: string; count: number }[]; bag: { label: string; count: number }[]; bagSlots: number;
  money: string;
}

const INK = '#e6e4dc', DIM = '#7d8790', GOLD = '#ffd66b', UP = '#7fe08a', DOWN = '#ff7a6b';
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
  for (let yy = -r; yy <= r; yy += 2) {
    const half = Math.floor(Math.sqrt(r * r - yy * yy) / 2) * 2;
    c.fillStyle = Math.abs(yy) > r - 4 || half < 6 ? RIM_D : SOCKET;
    c.fillRect(cx - half, cy + yy, half * 2, 2);
    c.fillStyle = RIM_D; c.fillRect(cx - half, cy + yy, 2, 2); c.fillRect(cx + half - 2, cy + yy, 2, 2);
  }
}
function title(c: CanvasRenderingContext2D, s: string, x: number, y: number) {
  putText(c, pixelText(s, GOLD, 22), x, y);
}
/** 고른 칸 표시: 금색 도트 모서리 네 개 */
function corners(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = GOLD;
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.fillRect(sx > 0 ? px : px - 10, sy > 0 ? py : py - 2, 10, 2);
    c.fillRect(sx > 0 ? px : px - 2, sy > 0 ? py : py - 10, 2, 10);
  }
}

export function drawCharWindow(c: CanvasRenderingContext2D, d: CharWindowData, W = 1280, H = 720) {
  c.save();
  c.imageSmoothingEnabled = false;
  c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(0, 0, W, H);
  // 바깥 틀: 메뉴와 같은 kit 판
  const panel = kitPiece('panel');
  if (panel) nine(c, panel, kitSlice('panel'), 16, 16, W - 32, H - 32, 2);
  else plate(c, 16, 16, W - 32, H - 32, NAVY_D);

  /* ── 머리 ── */
  const hx = 56, hy = 52;
  plate(c, 48, 44, W - 96, 112);
  const P = hudArtImage('portrait');
  if (d.face) c.drawImage(d.face, hx + 8, hy + 8, 64, 64);
  if (P) c.drawImage(P, hx, hy + 8 - 8);
  putText(c, pixelText(d.name, INK, 33), hx + 100, hy + 6);
  putText(c, pixelText(d.team, DIM, 22), hx + 100, hy + 46);
  // 상태 태그
  const tag = pixelText(d.state, '#9fd7ff', 22);
  plate(c, hx + 100 + pixelText(d.team, DIM, 22).width + 16, hy + 40, tag.width + 20, 34, '#16284a');
  putText(c, tag, hx + 100 + pixelText(d.team, DIM, 22).width + 26, hy + 46);
  // 체력
  const HP = hudArtImage('hp');
  const bx = 560, by = hy + 14;
  putText(c, pixelText('체력', DIM, 22), bx, by - 2);
  if (HP) {
    c.drawImage(HP, bx + 60, by);
    const [ix0, iy0, ix1, iy1] = [17, 5, 225, 14], r = d.hp / d.maxHp;
    c.fillStyle = '#4fc25a'; c.fillRect(bx + 60 + ix0, by + iy0, Math.round((ix1 - ix0) * r), iy1 - iy0);
    c.fillStyle = '#8be38f'; c.fillRect(bx + 60 + ix0, by + iy0, Math.round((ix1 - ix0) * r), 2);
  }
  putText(c, pixelText(`${d.hp} / ${d.maxHp}`, INK, 22), bx + 60, by + 30);
  // 고유 퍽 (머리 오른쪽)
  const ux = W - 56 - 64 - 220, uy = hy + 4;
  if (d.unique.badge) c.drawImage(d.unique.badge, ux, uy, 64, 64); else socket(c, ux + 32, uy + 32, 30);
  putText(c, pixelText('고유 퍽', GOLD, 11), ux + 76, uy + 2);
  putText(c, pixelText(d.unique.name, INK, 22), ux + 76, uy + 18);
  putText(c, pixelText(d.unique.effect, DIM, 11), ux + 76, uy + 46);

  /* ── 가운데 세 칸 ── */
  const top = 168, mh = 392;
  // 능력치
  const sx0 = 48, sw = 300;
  plate(c, sx0, top, sw, mh);
  title(c, '능력치', sx0 + 20, top + 14);
  d.stats.forEach((s, i) => {
    const yy = top + 62 + i * 50;
    putText(c, pixelText(s.label, DIM, 22), sx0 + 20, yy);
    if (s.now && s.now !== s.base) {
      const better = parseFloat(s.now) > parseFloat(s.base) !== /받는|쿨|경직/.test(s.label);
      const nt = pixelText(s.now, better ? UP : DOWN, 22);
      putText(c, nt, sx0 + sw - 20, yy, 'right');
      putText(c, pixelText(`${s.base} →`, DIM, 11), sx0 + sw - 26 - nt.width, yy + 8, 'right');
    } else putText(c, pixelText(s.base, INK, 22), sx0 + sw - 20, yy, 'right');
  });
  // 기술
  const kx0 = sx0 + sw + 12, kw = 420;
  plate(c, kx0, top, kw, mh);
  title(c, '기술', kx0 + 20, top + 14);
  const SL = hudArtImage('slot');
  d.skills.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = kx0 + 30 + col * 128, y = top + 60 + row * 92;
    if (SL) c.drawImage(SL, x, y);
    pixelIcon(c, k.icon, x + 25, y + 25, 2, k.off ? '#3b4148' : INK);
    putText(c, pixelText(k.key, GOLD, 11), x + 54, y + 4);
    putText(c, pixelText(k.label, k.off ? '#4a525a' : INK, 22), x + 54, y + 20);
    if (i === d.pick.skill) corners(c, x - 6, y - 6, 62 + 60, 62);
  });
  const pk = d.skills[d.pick.skill];
  const dy0 = top + 250;
  c.fillStyle = RIM_D; c.fillRect(kx0 + 20, dy0 - 10, kw - 40, 2);
  putText(c, pixelText(pk.name, GOLD, 22), kx0 + 20, dy0);
  d.pick.desc.forEach((l, i) => putText(c, pixelText(l, INK, 11), kx0 + 20, dy0 + 34 + i * 18));
  putText(c, pixelText(d.pick.nums, '#9fd7ff', 11), kx0 + 20, dy0 + 34 + d.pick.desc.length * 18 + 8);
  // 퍽
  const px0 = kx0 + kw + 12, pw = W - 48 - px0;
  plate(c, px0, top, pw, mh);
  title(c, '퍽', px0 + 20, top + 14);
  putText(c, pixelText(`괴이 안에서 얻은 퍽 ${d.perks.length} / ${d.perkSlots}`, DIM, 11), px0 + 70, top + 22);
  const per = Math.floor((pw - 30) / 76);
  for (let i = 0; i < d.perkSlots; i++) {
    const x = px0 + 18 + (i % per) * 76, y = top + 52 + Math.floor(i / per) * 76;
    const p = d.perks[i];
    if (p?.badge) c.drawImage(p.badge, x, y, 64, 64); else socket(c, x + 32, y + 32, 28);
    if (i === d.perkPick) corners(c, x - 4, y - 4, 72, 72);
  }
  const pp = d.perks[d.perkPick];
  if (pp) {
    const yy = top + 52 + Math.ceil(d.perkSlots / per) * 76 + 24;
    c.fillStyle = RIM_D; c.fillRect(px0 + 20, yy - 10, pw - 40, 2);
    putText(c, pixelText(pp.name, GOLD, 22), px0 + 20, yy);
    putText(c, pixelText(pp.effect, INK, 11), px0 + 20, yy + 34);
    putText(c, pixelText('괴이를 나오면 사라짐', DIM, 11), px0 + 20, yy + 54);
  }

  /* ── 소지품 ── */
  const iy = top + mh + 12, ih = H - 44 - iy;
  plate(c, 48, iy, W - 96, ih);
  title(c, '소지품', 68, iy + 14);
  const IT = hudArtImage('item');
  const slotAt = (x: number, it?: { label: string; count: number }, k?: string) => {
    if (SL) c.drawImage(SL, x, iy + 46);
    if (it) {
      putText(c, pixelText(it.label, INK, 11), x + 25, iy + 62, 'center');
      if (it.count > 1) putText(c, pixelText(String(it.count), GOLD, 11), x + 44, iy + 80, 'right');
    }
    if (k) putText(c, pixelText(k, GOLD, 11), x + 4, iy + 48);
  };
  void IT;
  putText(c, pixelText('퀵칸', DIM, 11), 180, iy + 22);
  for (let i = 0; i < 4; i++) slotAt(68 + i * 56, d.quick[i], String(i + 1));
  putText(c, pixelText(`가방 ${d.bag.length} / ${d.bagSlots}`, DIM, 11), 330, iy + 22);
  for (let i = 0; i < d.bagSlots; i++) slotAt(330 + i * 56, d.bag[i]);
  const ex = 330 + d.bagSlots * 56 + 30;
  putText(c, pixelText('장비', DIM, 22), ex, iy + 14);
  putText(c, pixelText('(나중)', '#4a525a', 22), ex, iy + 46);
  putText(c, pixelText('현금', DIM, 22), W - 68, iy + 14, 'right');
  putText(c, pixelText(d.money, GOLD, 22), W - 68, iy + 46, 'right');
  putText(c, pixelText('Tab 닫기', DIM, 11), W - 40, H - 36, 'right');
  c.restore();
}
