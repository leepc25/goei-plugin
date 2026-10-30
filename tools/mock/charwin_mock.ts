// 통합 캐릭터 창 배치 시안 (2026-10-30). 게임 코드 아님: 지금 있는 도트 HUD 그림·글꼴로 칸 배치만 보여 준다.
import { pixelText } from '../../src/game/action/ui/pixelHud';
import { HUD_ART } from '../../src/game/action/ui/pixelHudArt';
import { ITEM_IMG, KEY_IMG, KIT_IMG, KIT_META, PIXEL_FONT_URL, TOUCH_IMG } from '../../src/game/action/ui/kit.gen';
import { PIXEL_FONT } from '../../src/game/action/ui/kit';

const W = 1280, H = 720;
const load = (src: string) => new Promise<HTMLImageElement>((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
const INK = '#e6e4dc', DIM = '#8a9096', GOOD = '#8fe08a', GOLD = '#ffd36a', RED = '#ff7a6a';

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

  const T = (s: string, x: number, y: number, col = INK, size = 11, align: 'left' | 'center' | 'right' = 'left', sc = 2) => {
    const t = pixelText(s, col, size); const w = t.width * sc;
    c.drawImage(t, Math.round(align === 'center' ? x - w / 2 : align === 'right' ? x - w : x), y, w, t.height * sc);
  };
  // 9칸 자르기 틀 (sc배)
  const nine = (k: string, x: number, y: number, w: number, h: number, sc = 2) => {
    const im = img['kit_' + k]; const m = (KIT_META as any)[k]; const [t, r, b, l] = m.slice; const iw = m.w, ih = m.h;
    const sx = [0, l, iw - r, iw], sy = [0, t, ih - b, ih];
    const dx = [x, x + l * sc, x + w - r * sc, x + w], dy = [y, y + t * sc, y + h - b * sc, y + h];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) c.drawImage(im, sx[j], sy[i], sx[j + 1] - sx[j], sy[i + 1] - sy[i], dx[j], dy[i], dx[j + 1] - dx[j], dy[i + 1] - dy[i]);
  };
  const draw = (k: string, x: number, y: number, sc = 1) => { const im = img[k]; c.drawImage(im, x, y, im.naturalWidth * sc, im.naturalHeight * sc); };

  // 뒤: 게임 화면을 어둡게
  c.drawImage(img.bg, 0, 0, W, H); c.fillStyle = 'rgba(5,7,10,0.72)'; c.fillRect(0, 0, W, H);

  // 창
  const X = 60, Y = 34, WW = 1160, HH = 652;
  nine('panel', X, Y, WW, HH);

  // ── 머리 줄
  draw('hud_portrait', X + 40, Y + 36);
  const pw = img.hud_portrait.naturalWidth, ph = img.hud_portrait.naturalHeight;
  c.save(); c.beginPath(); c.rect(X + 48, Y + 44, pw - 16, ph - 16); c.clip();
  c.drawImage(img.body, 2, 0, 58, 58, X + 48, Y + 44, (pw - 16), (pw - 16)); c.restore();
  T('에일린', X + 40 + pw + 16, Y + 40, INK, 22, 'left', 1);
  T('관리국 1팀 · 사격형', X + 40 + pw + 18, Y + 72, DIM);
  T('상태  출동 중 · 명일아파트 4층', X + 40 + pw + 18, Y + 98, GOLD);
  const hx = X + 560, hy = Y + 46; draw('hud_hp', hx, hy);
  const hi = (HUD_ART as any).hp.inner as number[];
  c.fillStyle = '#c8473f'; c.fillRect(hx + hi[0], hy + hi[1], (hi[2] - hi[0]) * 0.72, hi[3] - hi[1]);
  T('체력  684 / 950', hx, hy + 44, INK);
  draw('hud_gauge', hx, hy + 76); T('필살', hx + (HUD_ART as any).gauge.w + 10, hy + 74, DIM);

  // 구역 틀
  const box = (x: number, y: number, w: number, h: number, title: string) => { nine('row', x, y, w, h, 2); T(title, x + 16, y + 10, GOLD); };
  const top = Y + 150;

  // ── 왼쪽: 전신 + 기본 능력치
  box(X + 30, top, 300, 466, '능력치');
  c.drawImage(img.body, X + 40, top + 54, 62, 234);
  const stats: [string, number, number][] = [['힘', 3, 0], ['민', 8, 1], ['체', 4, 0], ['지', 6, 0], ['정', 4, 0]];
  stats.forEach(([n, v, up], i) => {
    const yy = top + 60 + i * 44; T(n, X + 120, yy, INK);
    for (let p = 0; p < 10; p++) { c.fillStyle = p < v ? (p >= v - up ? GOOD : '#d8d4c8') : '#2e353c'; c.fillRect(X + 152 + p * 15, yy + 6, 11, 14); c.fillStyle = '#07090b'; c.fillRect(X + 152 + p * 15, yy + 20, 11, 2); }
    T(String(v), X + 316, yy, up ? GOOD : INK, 11, 'right');
  });
  const der: [string, string, string][] = [['최대 체력', '950', ''], ['근접 피해', '0.94', ''], ['사격 피해', '1.09', '1.24'], ['속도', '1.05', ''], ['기술 쿨', '0.98', '0.90'], ['받는 피해', '1.01', '']];
  der.forEach(([n, a, b], i) => {
    const yy = top + 300 + i * 27; T(n, X + 46, yy, DIM, 11, 'left', 2);
    T(b ? `${a} → ${b}` : a, X + 316, yy, b ? GOOD : INK, 11, 'right');
  });

  // ── 가운데: 기술
  const mx = X + 350; box(mx, top, 400, 250, '기술');
  const sk: [string, string][] = [['attack', '약공'], ['attack', '강공'], ['shoot', '사격'], ['shoot', '충전'], ['unique', '고유'], ['ult', '필살']];
  sk.forEach(([ic, n], i) => {
    const sx = mx + 22 + (i % 3) * 124, sy = top + 46 + Math.floor(i / 3) * 96;
    draw('hud_slot', sx, sy); const s = img.hud_slot; const ti = img['touch_' + ic];
    c.drawImage(ti, sx + (s.naturalWidth - 40) / 2, sy + (s.naturalHeight - 40) / 2, 40, 40);
    T(n, sx + s.naturalWidth + 6, sy + 18, i === 2 ? GOLD : INK);
    if (i === 2) { c.strokeStyle = GOLD; c.lineWidth = 2; c.strokeRect(sx - 3, sy - 3, s.naturalWidth + 6, s.naturalHeight + 6); }
  });
  T('사격 · 연사  한 발 7 · 과열 9%/발', mx + 22, top + 236 - 20, INK);

  // 소지품 (가운데 아래)
  box(mx, top + 262, 400, 204, '소지품');
  const quick = ['medkit', 'flash', 'flash', 'energy'];
  quick.forEach((k, i) => {
    const sx = mx + 22 + i * 64, sy = top + 304; draw('hud_item', sx, sy);
    c.drawImage(img['item_' + k], sx + 8, sy + 8, 40, 40); c.drawImage(img['key_' + (i + 1)], sx - 4, sy - 6, 20, 20);
  });
  T('퀵칸', mx + 300, top + 318, DIM);
  const bag = ['bandage', 'antidote', 'salt', 'ammo', '', '', '', ''];
  bag.forEach((k, i) => {
    const sx = mx + 22 + i * 46, sy = top + 400; c.drawImage(img.kit_slot, sx, sy, 42, 42);
    if (k) c.drawImage(img['item_' + k], sx + 7, sy + 7, 28, 28);
  });
  T('가방 4/8', mx + 22, top + 364, DIM);

  // ── 오른쪽: 퍽
  const rx = mx + 412; box(rx, top, 330, 466, '퍽');
  T('고유', rx + 18, top + 46, GOLD);
  const badge = (x: number, y: number, col: string, mark: string) => {
    c.drawImage(img.kit_slot, x, y, 56, 56); c.fillStyle = col; c.fillRect(x + 10, y + 10, 36, 36);
    c.fillStyle = '#0b0d10'; c.fillRect(x + 14, y + 14, 28, 28); T(mark, x + 28, y + 20, col, 11, 'center', 2);
  };
  badge(rx + 18, top + 72, GOLD, '?'); T('준비된 사수', rx + 86, top + 78, INK); T('멀리 있는 적 사격 +15%', rx + 86, top + 104, DIM, 11, 'left', 1);
  T('임시 (이번 괴이)  4', rx + 18, top + 148, INK);
  const tmp: [string, string][] = [['#b4b8bc', '?'], ['#b4b8bc', '?'], ['#b4b8bc', '?'], ['#d05040', '?']];
  tmp.forEach(([col, m], i) => badge(rx + 18 + i * 64, top + 174, col, m));
  for (let i = 4; i < 8; i++) c.drawImage(img.kit_slot, rx + 18 + (i - 4) * 64, top + 240, 56, 56);
  // 고른 퍽 카드
  nine('row', rx + 18, top + 310, 292, 140, 2);
  T('탄 +1', rx + 34, top + 322, GOLD); T('공용 퍽 · 사격', rx + 296, top + 322, DIM, 11, 'right', 1);
  T('기본 사격이 한 번에', rx + 34, top + 352, INK); T('두 발 나간다.', rx + 34, top + 380, INK);
  T('퍽 그림은 미정(카드·뱃지 디자인 후 교체)', rx + 34, top + 420, DIM, 11, 'left', 1);

  // 아래 안내
  T('Tab 닫기 · 방향키 칸 이동 · E 자세히', X + WW / 2, Y + HH - 26, DIM, 11, 'center', 1);
}
main();
