// 통합 캐릭터 창 배치 시안 4 (2026-10-30). 게임 코드 아님: 칸 배치만 본다(틀·그림은 임시).
// 왼쪽 = 인물(얼굴·체력·기본 능력치·전투 수치) 고정 / 가운데 세로 탭 / 오른쪽 = 목록 + 자세히. 주소 ?tab=skill|item|perk
import { pixelText } from '../../src/game/action/ui/pixelHud';
import { HUD_ART } from '../../src/game/action/ui/pixelHudArt';
import { ITEM_IMG, KEY_IMG, KIT_IMG, KIT_META, PIXEL_FONT_URL, TOUCH_IMG } from '../../src/game/action/ui/kit.gen';
import { PIXEL_FONT } from '../../src/game/action/ui/kit';

const W = 1280, H = 720;
const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
const INK = '#e6e4dc', DIM = '#8a9096', GOOD = '#8fe08a', GOLD = '#ffd36a', RED = '#e0705f', LINE = '#2a3138';
const TAB = new URLSearchParams(location.search).get('tab') || 'perk';

async function main() {
  const ff = new FontFace(PIXEL_FONT, `url(${PIXEL_FONT_URL})`); await ff.load(); (document as any).fonts.add(ff);
  const cv = document.getElementById('c') as HTMLCanvasElement; cv.width = W; cv.height = H;
  const c = cv.getContext('2d')!; c.imageSmoothingEnabled = false;
  const img: Record<string, HTMLImageElement> = {};
  for (const [k, v] of Object.entries(KIT_IMG)) img['kit_' + k] = await load(v);
  for (const [k, v] of Object.entries(HUD_ART)) img['hud_' + k] = await load((v as any).src);
  for (const [k, v] of Object.entries(ITEM_IMG)) img['item_' + k] = await load(v);
  for (const [k, v] of Object.entries(TOUCH_IMG)) img['touch_' + k] = await load(v);
  for (const [k, v] of Object.entries(KEY_IMG)) img['key_' + k] = await load(v);
  img.body = await load('eileen.png'); img.bg = await load('bg.png');

  const T = (s: string, x: number, y: number, col = INK, size = 22, align: 'left' | 'center' | 'right' = 'left') => {
    const t = pixelText(s, col, size, null);
    c.drawImage(t, Math.round(align === 'center' ? x - t.width / 2 : align === 'right' ? x - t.width : x), Math.round(y));
  };
  const nine = (k: string, x: number, y: number, w: number, h: number, sc = 2) => {
    const im = img['kit_' + k]; const m = (KIT_META as any)[k]; const [t, r, b, l] = m.slice; const iw = m.w, ih = m.h;
    const sx = [0, l, iw - r, iw], sy = [0, t, ih - b, ih];
    const dx = [x, x + l * sc, x + w - r * sc, x + w], dy = [y, y + t * sc, y + h - b * sc, y + h];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.drawImage(im, sx[j], sy[i], sx[j + 1] - sx[j], sy[i + 1] - sy[i], dx[j], dy[i], dx[j + 1] - dx[j], dy[i + 1] - dy[i]);
  };
  const well = (x: number, y: number, w: number, h: number) => { c.fillStyle = '#0c0f13'; c.fillRect(x, y, w, h); c.fillStyle = '#1d2329'; c.fillRect(x, y, w, 2); c.fillRect(x, y, 2, h); };
  const hr = (x: number, y: number, w: number) => { c.fillStyle = LINE; c.fillRect(x, y, w, 2); };
  const sel = (x: number, y: number, w: number, h: number) => { c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(x + 1, y + 1, w - 2, h - 2); };
  const head = (s: string, x: number, y: number, w: number, right = '') => { T(s, x, y, GOLD); if (right) T(right, x + w, y, DIM, 22, 'right'); hr(x, y + 30, w); };

  c.drawImage(img.bg, 0, 0, W, H); c.fillStyle = 'rgba(5,7,10,0.75)'; c.fillRect(0, 0, W, H);
  const X = 80, Y = 34, WW = 1120, HH = 652;
  nine('panel', X, Y, WW, HH);
  const P = 30;                       // 틀 안쪽 여백
  const top = Y + P, bot = Y + HH - P;

  // ═══ 왼쪽: 인물 (폭 330)
  const L = X + P, LW = 330;
  well(L, top, LW, bot - top);
  const lx = L + 18, lw = LW - 36;
  // 얼굴 + 이름 + 체력
  c.fillStyle = '#1a2026'; c.fillRect(lx, top + 16, 88, 88);
  c.drawImage(img.body, 4, 0, 52, 52, lx + 2, top + 18, 84, 84);
  T('에일린', lx + 104, top + 18, INK, 33);
  T('사격형 · 관리국', lx + 104, top + 58, DIM);
  c.fillStyle = '#2e353c'; c.fillRect(lx + 104, top + 88, lw - 104, 12); c.fillStyle = '#c8473f'; c.fillRect(lx + 104, top + 88, (lw - 104) * 0.72, 12);
  T('체력', lx, top + 118, DIM); T('684 / 950', lx + lw, top + 118, INK, 22, 'right');
  // 기본 능력치
  let y = top + 162; head('기본 능력치', lx, y, lw); y += 44;
  const stats: [string, number, number][] = [['힘', 3, 0], ['민', 8, 1], ['체', 4, 0], ['지', 6, 0], ['정', 4, 0]];
  for (const [n, v, up] of stats) {
    T(n, lx, y, INK);
    for (let p = 0; p < 10; p++) { c.fillStyle = p < v ? (p >= v - up ? GOOD : '#cfcabd') : '#262d34'; c.fillRect(lx + 36 + p * 21, y + 4, 17, 16); }
    T(String(v), lx + lw, y, up ? GOOD : INK, 22, 'right'); y += 28;
  }
  // 전투 수치 (100 = 기준)
  y += 8; head('전투 수치', lx, y, lw); y += 42;
  const der: [string, string, string?][] = [['근접 공격', '94'], ['사격 공격', '109', '124'], ['이능 공격', '102'], ['받는 피해', '−1%'], ['이동 속도', '105'], ['기술 쿨', '−2%', '−10%'], ['상태 이상', '−5%']];
  for (const [n, a, b] of der) { T(n, lx, y, DIM); T(b ? `${a} ▸ ${b}` : a, lx + lw, y, b ? GOOD : INK, 22, 'right'); y += 26; }

  // ═══ 가운데: 세로 탭 (폭 76)
  const R0 = L + LW + 14;
  const tabs: [string, string, string][] = [['skill', '기술', 'attack'], ['item', '가방', ''], ['perk', '퍽', 'ult']];
  tabs.forEach(([k, n, ic], i) => {
    const ty = top + i * 96, on = k === TAB;
    c.fillStyle = on ? '#1c232a' : '#0c0f13'; c.fillRect(R0, ty, 76, 88);
    if (on) { c.fillStyle = GOLD; c.fillRect(R0, ty, 4, 88); }
    if (ic) c.drawImage(img['touch_' + ic], R0 + 20, ty + 8, 40, 40); else c.drawImage(img.item_medkit, R0 + 20, ty + 8, 40, 40);
    T(n, R0 + 40, ty + 56, on ? GOLD : DIM, 22, 'center');
  });
  T('Q ▲', R0 + 38, top + 300, DIM, 22, 'center'); T('E ▼', R0 + 38, top + 330, DIM, 22, 'center');

  // ═══ 오른쪽: 목록 | 자세히
  const R = R0 + 90, RW = X + WW - P - R;
  well(R, top, RW, bot - top);
  const listW = 330, LX = R + 18, DX = R + listW + 30, DW = RW - listW - 48;
  c.fillStyle = LINE; c.fillRect(R + listW + 12, top + 16, 2, bot - top - 32);

  if (TAB === 'perk') {
    head('고유', LX, top + 16, listW - 18);
    // 앰블럼 (64×64): 둥근 테 + 그림 자리
    const emb = (x: number, y: number, rim: string, on = false) => {
      c.fillStyle = rim; c.beginPath(); c.arc(x + 32, y + 32, 30, 0, 7); c.fill();
      c.fillStyle = '#121820'; c.beginPath(); c.arc(x + 32, y + 32, 24, 0, 7); c.fill();
      T('?', x + 32, y + 21, '#4a525a', 22, 'center');
      if (on) sel(x - 4, y - 4, 72, 72);
    };
    emb(LX, top + 60, GOLD);
    T('준비된 사수', LX + 80, top + 80, INK);
    head('이번 괴이', LX, top + 146, listW - 18, '7');
    const rims = ['#b4b8bc', '#b4b8bc', '#b4b8bc', RED, '#b4b8bc', '#7a2030', '#b4b8bc'];
    rims.forEach((r, i) => emb(LX + (i % 4) * 78, top + 192 + Math.floor(i / 4) * 78, r, i === 0));
    for (let i = rims.length; i < 16; i++) { const ex = LX + (i % 4) * 78, ey = top + 192 + Math.floor(i / 4) * 78; c.strokeStyle = '#1d2329'; c.lineWidth = 2; c.beginPath(); c.arc(ex + 32, ey + 32, 29, 0, 7); c.stroke(); }
    // 자세히: 카드
    const cw = 200, chh = 300, cx = DX + (DW - cw) / 2, cy = top + 16;
    nine('slot', cx, cy, cw, chh, 2); c.fillStyle = '#b4b8bc'; c.fillRect(cx + 14, cy + 14, cw - 28, 4);
    c.fillStyle = '#121820'; c.fillRect(cx + 36, cy + 30, 128, 128); T('그림 128', cx + 100, cy + 82, '#3a424a', 22, 'center');
    T('탄 +1', cx + 100, cy + 170, GOLD, 33, 'center');
    T('공용 퍽 · 사격', cx + 100, cy + 212, DIM, 22, 'center');
    T('★ ☆ ☆', cx + 100, cy + 242, GOLD, 22, 'center');
    T('기본 사격이 두 발 나간다.', DX, top + 336, INK);
    hr(DX, top + 374, DW);
    T('능력치 변화', DX, top + 390, DIM);
    T('사격 공격', DX, top + 424, INK); T('109 ▸ 124', DX + DW, top + 424, GOOD, 22, 'right');
    T('탄 수', DX, top + 454, INK); T('1 ▸ 2', DX + DW, top + 454, GOOD, 22, 'right');
  } else if (TAB === 'skill') {
    head('기술', LX, top + 16, listW - 18);
    const sk: [string, string, string][] = [['attack', '약공', 'A'], ['attack', '강공', 'S'], ['shoot', '사격', 'D'], ['shoot', '충전', 'D 길게'], ['unique', '고유', 'Q'], ['ult', '필살', 'W']];
    sk.forEach(([ic, n, key], i) => {
      const ry = top + 60 + i * 68; c.fillStyle = '#121820'; c.fillRect(LX, ry, 56, 56); c.drawImage(img['touch_' + ic], LX + 8, ry + 8, 40, 40);
      T(n, LX + 72, ry + 16, i === 2 ? GOLD : INK); T(key, LX + listW - 18, ry + 16, DIM, 22, 'right');
      if (i === 2) sel(LX - 6, ry - 6, listW - 6, 68);
    });
    c.fillStyle = '#121820'; c.fillRect(DX, top + 16, 96, 96); c.drawImage(img.touch_shoot, DX + 16, top + 32, 64, 64);
    T('사격', DX + 112, top + 24, GOLD, 33); T('사격 · 물리', DX + 112, top + 70, DIM);
    hr(DX, top + 132, DW);
    const rows: [string, string, string?][] = [['피해', '7', '8'], ['연사', '초당 6발'], ['과열', '발당 9%'], ['쿨', '없음']];
    rows.forEach(([a, b, d], i) => { T(a, DX, top + 150 + i * 32, DIM); T(d ? `${b} ▸ ${d}` : b, DX + DW, top + 150 + i * 32, d ? GOOD : INK, 22, 'right'); });
    hr(DX, top + 290, DW);
    T('권총을 빠르게 연사한다.', DX, top + 306, INK); T('오래 쏘면 과열돼 멈춘다.', DX, top + 336, INK);
  } else {
    head('퀵슬롯', LX, top + 16, listW - 18);
    ['medkit', 'flash', 'flash', 'energy'].forEach((k, i) => { const sx = LX + i * 78, sy = top + 60; c.fillStyle = '#121820'; c.fillRect(sx, sy, 64, 64); c.drawImage(img['item_' + k], sx + 8, sy + 8, 48, 48); c.drawImage(img['key_' + (i + 1)], sx - 6, sy - 8, 22, 22); });
    head('가방', LX, top + 146, listW - 18, '4 / 16');
    const bag = ['bandage', 'antidote', 'salt', 'ammo'];
    for (let i = 0; i < 16; i++) { const sx = LX + (i % 4) * 78, sy = top + 192 + Math.floor(i / 4) * 78; c.fillStyle = '#121820'; c.fillRect(sx, sy, 64, 64); if (bag[i]) c.drawImage(img['item_' + bag[i]], sx + 8, sy + 8, 48, 48); if (i === 1) sel(sx - 4, sy - 4, 72, 72); }
    c.fillStyle = '#121820'; c.fillRect(DX, top + 16, 96, 96); c.drawImage(img.item_antidote, DX + 8, top + 24, 80, 80);
    T('해독제', DX + 112, top + 24, GOLD, 33); T('소모품 · 1개', DX + 112, top + 70, DIM);
    hr(DX, top + 132, DW);
    T('오염·독 상태를 없앤다.', DX, top + 150, INK);
    const btn = (s: string, x: number, y: number, w: number) => { nine('row', x, y, w, 44, 2); T(s, x + w / 2, y + 10, INK, 22, 'center'); };
    btn('사용', DX, top + 210, DW); btn('퀵슬롯에 넣기', DX, top + 264, DW); btn('버리기', DX, top + 318, DW);
  }
  T('Tab 닫기 · Q/E 탭 · 방향키 고르기 · Space 확인', X + WW / 2, Y + HH + 6, DIM, 22, 'center');
}
main();
