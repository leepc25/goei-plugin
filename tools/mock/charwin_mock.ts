// 통합 캐릭터 창 배치 시안 2 (2026-10-30). 게임 코드 아님: 지금 있는 도트 HUD 그림·글꼴로 칸 배치만 보여 준다.
// 왼쪽 능력치 고정 + 오른쪽 탭(기술·소지품·퍽). 주소 ?tab=skill|item|perk
import { pixelText } from '../../src/game/action/ui/pixelHud';
import { HUD_ART } from '../../src/game/action/ui/pixelHudArt';
import { ITEM_IMG, KEY_IMG, KIT_IMG, KIT_META, PIXEL_FONT_URL, TOUCH_IMG } from '../../src/game/action/ui/kit.gen';
import { PIXEL_FONT } from '../../src/game/action/ui/kit';

const W = 1280, H = 720;
const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
const INK = '#e6e4dc', DIM = '#8a9096', GOOD = '#8fe08a', GOLD = '#ffd36a';
const TAB = new URLSearchParams(location.search).get('tab') || 'skill';

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

  // 글자: 22px 원래 크기(늘리지 않음), 테 없음 → 획이 가늘게
  const T = (s: string, x: number, y: number, col = INK, size = 22, align: 'left' | 'center' | 'right' = 'left') => {
    const t = pixelText(s, col, size, null);
    c.drawImage(t, Math.round(align === 'center' ? x - t.width / 2 : align === 'right' ? x - t.width : x), y);
  };
  const nine = (k: string, x: number, y: number, w: number, h: number, sc = 2) => {
    const im = img['kit_' + k]; const m = (KIT_META as any)[k]; const [t, r, b, l] = m.slice; const iw = m.w, ih = m.h;
    const sx = [0, l, iw - r, iw], sy = [0, t, ih - b, ih];
    const dx = [x, x + l * sc, x + w - r * sc, x + w], dy = [y, y + t * sc, y + h - b * sc, y + h];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.drawImage(im, sx[j], sy[i], sx[j + 1] - sx[j], sy[i + 1] - sy[i], dx[j], dy[i], dx[j + 1] - dx[j], dy[i + 1] - dy[i]);
  };
  const slot = (x: number, y: number, s: number) => nine('slot', x, y, s, s, 2);

  c.drawImage(img.bg, 0, 0, W, H); c.fillStyle = 'rgba(5,7,10,0.72)'; c.fillRect(0, 0, W, H);
  const X = 110, Y = 50, WW = 1060, HH = 620;
  nine('panel', X, Y, WW, HH);

  // ── 왼쪽 고정: 이름·체력·전신·기본 능력치
  const lx = X + 40;
  T('에일린', lx, Y + 40, INK, 33);
  const hy = Y + 90; c.fillStyle = '#2e353c'; c.fillRect(lx, hy, 260, 14); c.fillStyle = '#c8473f'; c.fillRect(lx, hy, 260 * 0.72, 14);
  T('684 / 950', lx + 260, hy + 22, DIM, 22, 'right');
  c.drawImage(img.body, lx, hy + 60, 62, 234);
  const stats: [string, number, number][] = [['힘', 3, 0], ['민', 8, 1], ['체', 4, 0], ['지', 6, 0], ['정', 4, 0]];
  stats.forEach(([n, v, up], i) => {
    const yy = hy + 70 + i * 46; T(n, lx + 90, yy, INK);
    for (let p = 0; p < 10; p++) { c.fillStyle = p < v ? (p >= v - up ? GOOD : '#d8d4c8') : '#2e353c'; c.fillRect(lx + 122 + p * 12, yy + 4, 9, 18); }
    T(String(v), lx + 268, yy, up ? GOOD : INK, 22, 'right');
  });

  // ── 오른쪽: 탭
  const rx = X + 350, ry = Y + 36, rw = WW - 390;
  const tabs: [string, string][] = [['skill', '기술'], ['item', '소지품'], ['perk', '퍽']];
  tabs.forEach(([k, n], i) => {
    const tx = rx + i * 150; nine('row', tx, ry, 140, 48, 2);
    T(n, tx + 70, ry + 12, k === TAB ? GOLD : DIM, 22, 'center');
    if (k === TAB) { c.fillStyle = GOLD; c.fillRect(tx + 14, ry + 42, 112, 3); }
  });
  const cy = ry + 70, ch = HH - 120;
  nine('row', rx, cy, rw, ch, 2);

  if (TAB === 'skill') {
    const sk: [string, string][] = [['attack', '약공'], ['attack', '강공'], ['shoot', '사격'], ['shoot', '충전'], ['unique', '고유'], ['ult', '필살']];
    sk.forEach(([ic, n], i) => {
      const sx = rx + 40 + (i % 3) * 210, sy = cy + 36 + Math.floor(i / 3) * 140;
      slot(sx, sy, 96); c.drawImage(img['touch_' + ic], sx + 20, sy + 20, 56, 56);
      T(n, sx + 48, sy + 104, i === 2 ? GOLD : INK, 22, 'center');
      if (i === 2) { c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(sx - 4, sy - 4, 104, 104); }
    });
    T('사격', rx + 40, cy + 340, GOLD, 33);
    T('권총 연사. 오래 쏘면 과열된다.', rx + 40, cy + 390, INK);
  } else if (TAB === 'item') {
    T('퀵칸', rx + 40, cy + 24, DIM);
    ['medkit', 'flash', 'flash', 'energy'].forEach((k, i) => {
      const sx = rx + 40 + i * 104, sy = cy + 58; slot(sx, sy, 88); c.drawImage(img['item_' + k], sx + 16, sy + 16, 56, 56);
      c.drawImage(img['key_' + (i + 1)], sx - 6, sy - 8, 26, 26);
    });
    T('가방', rx + 40, cy + 176, DIM); T('4 / 12', rx + rw - 40, cy + 176, DIM, 22, 'right');
    const bag = ['bandage', 'antidote', 'salt', 'ammo'];
    for (let i = 0; i < 12; i++) {
      const sx = rx + 40 + (i % 6) * 100, sy = cy + 210 + Math.floor(i / 6) * 100; slot(sx, sy, 88);
      if (bag[i]) c.drawImage(img['item_' + bag[i]], sx + 16, sy + 16, 56, 56);
    }
  } else {
    // 퍽: 카드 크게
    const card = (x: number, y: number, w: number, h: number, rim: string, name: string, on = false) => {
      nine('slot', x, y, w, h, 2); c.fillStyle = rim; c.fillRect(x + 12, y + 12, w - 24, 4);
      c.fillStyle = '#10141a'; c.fillRect(x + 16, y + 22, w - 32, h - 78);
      T('그림', x + w / 2, y + (h - 56) / 2, '#3a424a', 22, 'center');
      T(name, x + w / 2, y + h - 46, on ? GOLD : INK, 22, 'center');
      if (on) { c.strokeStyle = GOLD; c.lineWidth = 3; c.strokeRect(x - 4, y - 4, w + 8, h + 8); }
    };
    T('고유', rx + 40, cy + 22, GOLD);
    card(rx + 40, cy + 56, 150, 200, GOLD, '준비된 사수');
    T('이번 괴이', rx + 230, cy + 22, DIM);
    const tmp: [string, string][] = [['#b4b8bc', '탄 +1'], ['#b4b8bc', '3단 점프'], ['#b4b8bc', '체력 +'], ['#d05040', '무모함']];
    tmp.forEach(([col, n], i) => card(rx + 230 + (i % 2) * 170, cy + 56 + Math.floor(i / 2) * 214, 150, 200, col, n, i === 0));
    T('탄 +1', rx + 40, cy + 300, GOLD, 33);
    T('사격이 두 발', rx + 40, cy + 346, INK);
    T('나간다.', rx + 40, cy + 378, INK);
  }
}
main();
