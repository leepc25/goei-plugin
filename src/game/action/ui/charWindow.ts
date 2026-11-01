// 통합 캐릭터 창 시안 (2026-11-01, 설계 docs/설계_통합창_퍽.md 2-2).
// 창 하나 1280×720. 왼쪽 3분의 1 = 전신 그림·이름·소속·체력·현금(늘 보임), 오른쪽 = 탭(능력치·기술·능력·소지품), 설명은 탭 아래 띠.
// (사용자 11-01: 고유 퍽 없음, 힘민체지정, 탭, 「퍽」 대신 「능력」, 빈 데 없이)
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
  /** 전신 그림(게임 속 평상 대기 첫 장, 오른쪽 보기) */
  body?: CanvasImageSource | null;
  hp: number; maxHp: number;
  /** 힘·민·체·지·정 (1~10, 요원마다 고정). now = 퍽으로 바뀐 값 */
  base: { label: string; v: number; now?: number; what: string }[];
  /** 산출 수치 (docs/퍽/능력치_55명.md) */
  derived: { label: string; v: string; now?: string }[];
  skills: { key: string; label: string; icon: SkillIcon; name: string; off?: boolean }[];
  pick: { skill: number; desc: string[]; nums: string };
  /** 능력 (docs/퍽/퍽_목록_3판.json 그대로): 분류·효과·랭크·조건, 특성은 장점·대가 */
  perks: { name: string; cat: string; effect: string; flavor?: string; rank?: [number, number]; cond?: string; cost?: string; badge?: CanvasImageSource | null; trait?: boolean; grade?: '일반' | '희귀' | '특급' }[];
  perkSlots: number; perkPick: number;
  quick: { label: string; count: number }[]; bag: { label: string; count: number }[]; bagSlots: number;
  money: string;
}

const GRADE_COL = { 일반: '#e6e4dc', 희귀: '#7fb8ff', 특급: '#ffd66b' } as const;
const INK = '#e6e4dc', DIM = '#7d8790', GOLD = '#ffd66b', UP = '#7fe08a';
const EDGE_D = '#05070d', NAVY = '#101a36', NAVY_D = '#0a1126', RIM_L = '#aeb8c8', RIM_D = '#4a5468', SOCKET = '#070c1c';

/** 도트 판: 모서리 2도트 깎고, 위·왼쪽 밝은 테, 아래·오른쪽 어두운 테 (둥근 상자·표 선 아님) */
function plate(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill = NAVY) {
  const u = 2;
  c.fillStyle = RIM_D; c.fillRect(x + 2 * u, y, w - 4 * u, h); c.fillRect(x, y + 2 * u, w, h - 4 * u); c.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
  c.fillStyle = RIM_L; c.fillRect(x + 2 * u, y, w - 4 * u, u); c.fillRect(x, y + 2 * u, u, h - 4 * u); c.fillRect(x + u, y + u, u, u);
  c.fillStyle = fill; c.fillRect(x + 2 * u, y + u, w - 4 * u, h - 2 * u); c.fillRect(x + u, y + 2 * u, w - 2 * u, h - 4 * u);
}
/** 고른 칸 표시: 금색 도트 모서리 네 개 */
/** 고른 칸 표시: 뒤에 밝은 판(glow) + 금색 3px 테 + 굵은 모서리 꺾쇠 */
function glow(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = '#25397a'; c.fillRect(x, y, w, h);
  c.fillStyle = '#30489a'; c.fillRect(x + 8, y + 8, w - 16, h - 16);
}
function corners(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  c.fillStyle = EDGE_D; c.fillRect(x - 1, y - 1, w + 2, 5); c.fillRect(x - 1, y + h - 4, w + 2, 5); c.fillRect(x - 1, y - 1, 5, h + 2); c.fillRect(x + w - 4, y - 1, 5, h + 2);
  c.fillStyle = GOLD; c.fillRect(x, y, w, 3); c.fillRect(x, y + h - 3, w, 3); c.fillRect(x, y, 3, h); c.fillRect(x + w - 3, y, 3, h);
  c.fillStyle = '#fff3c4';
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    c.fillRect(sx > 0 ? px - 3 : px - 19, sy > 0 ? py - 3 : py - 3, 22, 6);
    c.fillRect(sx > 0 ? px - 3 : px - 3, sy > 0 ? py - 3 : py - 19, 6, 22);
  }
}

export const CHAR_TABS = ['능력치', '기술', '능력', '소지품'] as const;
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
  const box = (x: number, y: number, w: number, h: number) => { if (!stretch(c, 'inner', x, y, w, h)) plate(c, x, y, w, h); };
  const SL = hudArtImage('slot');
  const big = (x: number, y: number, s = 100) => { if (SL) c.drawImage(SL, x, y, s, s); };
  const line = (x: number, y: number, w: number) => { c.fillStyle = RIM_D; c.fillRect(x, y, w, 2); };

  /* ── 왼쪽: 인물 (늘 보임) ── */
  const LX = 40, LW = 392, TOP = 40, BOT = H - 40;
  box(LX, TOP, LW, BOT - TOP);
  const cx = LX + LW / 2;
  putText(c, B(d.name), cx, TOP + 22, 'center');
  const team = T(d.team, DIM);
  putText(c, team, cx, TOP + 64, 'center');
  const tag = T(d.state, '#9fd7ff');
  plate(c, Math.round(cx - tag.width / 2 - 10), TOP + 96, tag.width + 20, 34, '#16284a');
  putText(c, tag, cx, TOP + 102, 'center');
  // 전신: 이름 칸 아래 빈 높이에 맞춰(최대 2배), 발이 체력 막대 위에 서게
  const footY = BOT - 128;
  c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(cx - 50, footY - 6, 100, 8); c.fillRect(cx - 40, footY - 8, 80, 12);
  if (d.body) {
    const bc = d.body as HTMLCanvasElement, k = Math.min(2, (footY - (TOP + 146)) / bc.height);
    const bw = Math.round(bc.width * k), bh2 = Math.round(bc.height * k);
    c.drawImage(d.body, Math.round(cx - bw / 2), footY - bh2, bw, bh2);
  }
  // 체력
  const HP = hudArtImage('hp'), hx = Math.round(cx - 122), hy = BOT - 104;
  if (HP) {
    c.drawImage(HP, hx, hy);
    const [ix0, iy0, ix1, iy1] = [17, 5, 225, 14], r = d.hp / d.maxHp;
    c.fillStyle = '#4fc25a'; c.fillRect(hx + ix0, hy + iy0, Math.round((ix1 - ix0) * r), iy1 - iy0);
    c.fillStyle = '#8be38f'; c.fillRect(hx + ix0, hy + iy0, Math.round((ix1 - ix0) * r), 2);
  }
  putText(c, T('체력', DIM), LX + 28, hy + 30);
  putText(c, T(`${d.hp.toLocaleString()} / ${d.maxHp.toLocaleString()}`), LX + LW - 28, hy + 30, 'right');
  putText(c, T('현금', DIM), LX + 28, hy + 62);
  putText(c, T(d.money, GOLD), LX + LW - 28, hy + 62, 'right');

  /* ── 오른쪽: 탭 ── */
  const RX = LX + LW + 16, RW = W - 40 - RX;
  let tx = RX;
  for (const name of CHAR_TABS) {
    const on = name === tab, t = T(name, on ? GOLD : DIM), w = t.width + 64;
    c.save(); if (!on) c.globalAlpha = 0.55;
    if (!stretch(c, 'tab', tx, TOP, w, 40)) plate(c, tx, TOP, w, 44, on ? '#1c2c58' : NAVY_D);
    c.restore();
    if (on) { c.fillStyle = GOLD; c.fillRect(tx + 14, TOP + 32, w - 28, 2); }
    putText(c, t, tx + 32, TOP + 8);
    tx += w + 8;
  }
  putText(c, T('Q · E 탭   Tab 닫기', DIM), RX + RW, TOP + 10, 'right');
  const top = TOP + 50, bh = BOT - top, R = RX + RW;
  box(RX, top, RW, bh);
  const IX = RX + 32;            // 안쪽 왼쪽
  const strip = (h: number) => { const y = BOT - h; line(RX + 20, y, RW - 40); return y + 22; };

  if (tab === '능력치') {
    d.base.forEach((s, i) => {
      const yy = top + 28 + i * 106, v = s.now ?? s.v;
      putText(c, B(s.label), IX, yy);
      putText(c, B(String(v), s.now !== undefined && s.now !== s.v ? UP : GOLD), IX + 82, yy, 'right');
      // 눈금: 막대 전체 폭(260px)은 고정. 10 이하면 10칸, 10을 넘으면 같은 폭 안에서 칸 수만 늘고 칸·간격이 좁아진다
      const n = Math.max(10, v), BW = 260, step = BW / n, gap = Math.max(2, Math.round(step * 0.23));
      for (let k = 0; k < n; k++) {
        const px = Math.round(IX + 104 + k * step), pw = Math.round(IX + 104 + (k + 1) * step) - px - gap, py = yy + 6;
        c.fillStyle = RIM_D; c.fillRect(px, py, pw, 24);
        c.fillStyle = k < Math.min(s.v, 10) ? '#e8c45a' : k < v ? UP : SOCKET; c.fillRect(px + 2, py + 2, Math.max(1, pw - 4), 20);
      }
      putText(c, T(s.what, DIM), IX, yy + 46);
    });
    const dx0 = IX + 446;
    c.fillStyle = RIM_D; c.fillRect(dx0 - 22, top + 24, 2, bh - 48);
    putText(c, T('전투 수치', GOLD), dx0, top + 28);
    d.derived.forEach((s, i) => {
      const yy = top + 82 + i * 58;
      putText(c, T(s.label, DIM), dx0, yy);
      putText(c, T(s.now ?? s.v, s.now && s.now !== s.v ? UP : INK), R - 32, yy, 'right');
    });
  } else if (tab === '기술') {
    d.skills.forEach((k, i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = IX + col * 246, y = top + 30 + row * 130;
      if (i === d.pick.skill) glow(c, x - 8, y - 8, 116, 116);
      big(x, y);
      pixelIcon(c, k.icon, x + 50, y + 50, 4, k.off ? '#3b4148' : INK);
      putText(c, T(k.key, GOLD), x + 10, y + 6);
      putText(c, B(k.label, k.off ? '#4a525a' : INK), x + 114, y + 18);
      putText(c, T(k.name, DIM), x + 114, y + 60);
      if (i === d.pick.skill) corners(c, x - 8, y - 8, 116, 116);
    });
    const pk = d.skills[d.pick.skill];
    let y = strip(286);
    putText(c, B(pk.name, GOLD), IX, y);
    putText(c, T(pk.label, DIM), IX + B(pk.name).width + 16, y + 8);
    y += 54;
    d.pick.desc.forEach((l) => { putText(c, T(l), IX, y); y += 34; });
    putText(c, T(d.pick.nums, '#9fd7ff'), IX, y + 10);
  } else if (tab === '능력') {
    // 뱃지 칸: 보이는 줄 수만큼만 그리고, 넘치면 칸 안에서 줄 단위로 넘어간다(고른 뱃지가 늘 보이게)
    const per = 5, cell = 146, gy0 = top + 28, gyEnd = BOT - 232 - 8;
    const rows = Math.ceil(d.perks.length / per), vis = Math.max(1, Math.floor((gyEnd - gy0 + 18) / cell));
    const pickRow = Math.floor(Math.max(0, d.perkPick) / per);
    const first = Math.min(Math.max(0, pickRow - vis + 1), Math.max(0, rows - vis));
    c.save(); c.beginPath(); c.rect(RX + 8, top + 12, RW - 16, gyEnd - top - 12); c.clip();
    for (let i = first * per; i < Math.min(d.perks.length, (first + vis) * per); i++) {
      const x = IX + 8 + (i % per) * cell, y = gy0 + (Math.floor(i / per) - first) * cell;
      const p = d.perks[i];
      if (i === d.perkPick) glow(c, x - 6, y - 6, 140, 140);
      if (p.badge) c.drawImage(p.badge, x, y, 128, 128);
      if (i === d.perkPick) corners(c, x - 6, y - 6, 140, 140);
    }
    c.restore();
    if (rows > vis) {
      // 스크롤 막대: 오른쪽 끝 얇은 홈 + 금색 손잡이
      const sx = R - 26, sy = gy0 - 6, sh = vis * cell - 12;
      c.fillStyle = SOCKET; c.fillRect(sx, sy, 8, sh);
      const kh = Math.max(24, Math.round(sh * vis / rows)), ky = sy + Math.round((sh - kh) * first / (rows - vis));
      c.fillStyle = GOLD; c.fillRect(sx, ky, 8, kh);
    }
    // 능력이 없을 때(괴이 밖): 흐린 글자 한 줄만
    if (!d.perks.length) putText(c, T('얻은 능력 없음', DIM), RX + RW / 2, top + (BOT - top) / 2 - 16, 'center');
    const pp = d.perks[d.perkPick];
    if (pp) {
      let y = strip(232);
      const nm = B(pp.name, pp.trait ? '#ff9a8a' : GOLD);
      putText(c, nm, IX, y);
      putText(c, T(pp.trait ? '특성' : pp.cat, DIM), IX + nm.width + 16, y + 8);
      // 오른쪽 끝: 등급(색) + 랭크(지금/최대)
      let rx = R - 32;
      if (pp.rank) { const rk = T(`랭크 ${pp.rank[0]} / ${pp.rank[1]}`, INK); putText(c, rk, rx, y + 8, 'right'); rx -= rk.width + 24; }
      if (pp.grade) putText(c, B(pp.grade, GRADE_COL[pp.grade]), rx, y + 2, 'right');
      y += 50;
      if (pp.flavor) { putText(c, T(`「${pp.flavor}」`, '#c9c3b0'), IX, y); y += 40; }
      if (pp.trait) {
        putText(c, T(`장점  ${pp.effect}`, UP), IX, y);
        putText(c, T(`대가  ${pp.cost ?? ''}`, '#ff7a6b'), IX, y + 36);
      } else {
        putText(c, T(pp.effect), IX, y);
        if (pp.cond) putText(c, T(`조건  ${pp.cond}`, '#9fd7ff'), IX, y + 36);
      }
    }
  } else {
    const slot = (x: number, y: number, it?: { label: string; count: number }, k?: string, on = false) => {
      if (on) glow(c, x - 6, y - 6, 112, 112);
      big(x, y);
      if (it) {
        putText(c, B(it.label.slice(0, 2)), x + 50, y + 30, 'center');
        if (it.count > 1) putText(c, T(String(it.count), GOLD), x + 88, y + 66, 'right');
      }
      if (k) putText(c, T(k, GOLD), x + 10, y + 6);
      if (on) corners(c, x - 6, y - 6, 112, 112);
    };
    putText(c, T('퀵슬롯', GOLD), IX, top + 22);
    for (let i = 0; i < 4; i++) slot(IX + i * 118, top + 56, d.quick[i], String(i + 1), i === 0);
    putText(c, T(`가방 ${d.bag.length} / ${d.bagSlots}`, GOLD), IX, top + 176);
    const per = 6;
    for (let i = 0; i < d.bagSlots; i++) slot(IX + (i % per) * 118, top + 212 + Math.floor(i / per) * 110, d.bag[i]);
    const it = d.quick[0];
    if (it) {
      const y = strip(108);
      putText(c, B(it.label, GOLD), IX, y + 8);
      putText(c, T(`${it.count}개`, DIM), IX + B(it.label).width + 16, y + 16);
      const bw = 150;
      // 퀵슬롯 등록·해제 안내: 고른 채 1~4(패드 십자키) = 그 칸에 넣기, 같은 숫자 한 번 더 = 빼기
      putText(c, T('1~4  퀵슬롯 등록·해제', DIM), R - 32 - 2 * bw - 16 - 28, y + 14, 'right');
      for (const [j, name] of ['쓰기', '버리기'].entries()) {
        const bx2 = R - 32 - (2 - j) * bw - (1 - j) * 16;
        if (!stretch(c, 'tab', bx2, y, bw, 52)) plate(c, bx2, y, bw, 52);
        putText(c, T(name, j === 0 ? GOLD : INK), bx2 + bw / 2, y + 14, 'center');
      }
    }
  }
  c.restore();
}
