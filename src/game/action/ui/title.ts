// 제목 화면 뒤 배경: 배경 스레드의 도트 승강기 홀(el_hall) 위에 도트 큰 로고. 엔진 제목 장면과 시연판이 같이 쓴다.
// 메뉴(새로 시작·설정·조작법)는 menu.ts 의 title 모양이 열린 문 안에 오락실 글자로 띄운다.
// 그림 묶음(window.__GOEI_BG_ART__)이 없으면 도형으로 그린 문으로 대신한다.
import { FONT } from './hud';
import { PIXEL_FONT } from './kit';

const K = 3; // 도트 1칸 = 화면 3px (벽 220 도트 = 660px)
const DOOR = { x: 160 + 112 * K, y: 50 * K, w: 100 * K, h: 170 * K }; // el_hall_wall_1 의 문 자리
const LAMP = { x: 160 + 132 * K, y: 17 * K, w: 48 * K, h: 10 * K }; // 문 위 층 표시

const imgs = new Map<string, HTMLImageElement | null>();
function art(name: string): HTMLImageElement | null {
  if (!imgs.has(name)) {
    const src = (typeof window !== 'undefined' && (window as { __GOEI_BG_ART__?: Record<string, Record<string, string>> }).__GOEI_BG_ART__?.el_hall?.[name]) || '';
    let im: HTMLImageElement | null = null;
    if (src) (im = new Image()), (im.src = src);
    imgs.set(name, im);
  }
  const im = imgs.get(name);
  return im && im.complete && im.naturalWidth ? im : null;
}

/** 도트 글자: 작은 글씨를 알파 0/1 로 끊고 1칸 검은 테를 둘러 캔버스로 만든다 (확대해서 그린다) */
const textCache = new Map<string, HTMLCanvasElement>();
function pixelText(text: string, size: number, top: string, bottom: string, weight = 900, pixel = false): HTMLCanvasElement {
  // 도트 글꼴은 읽히기 전이면 다음에 다시 만든다 (대역 글꼴로 굳지 않게)
  const ready = pixel && typeof document !== 'undefined' && document.fonts?.check(`11px "${PIXEL_FONT}"`);
  const key = `${text}|${size}|${top}|${bottom}|${weight}|${pixel}|${ready}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const m = document.createElement('canvas').getContext('2d')!;
  m.font = pixel ? `${size}px "${PIXEL_FONT}", ${FONT}` : `${weight} ${size}px ${FONT}`;
  const w = Math.ceil(m.measureText(text).width) + 6,
    h = Math.ceil(size * 1.3) + 6;
  const mask = document.createElement('canvas');
  mask.width = w;
  mask.height = h;
  const g = mask.getContext('2d')!;
  g.font = m.font;
  g.textBaseline = pixel ? 'top' : 'middle';
  g.fillStyle = '#fff';
  g.fillText(text, 3, pixel ? 3 : h / 2 + 1);
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) d.data[i] = d.data[i] > 110 ? 255 : 0;
  g.putImageData(d, 0, 0);
  // 색: 위아래 두 색 띠
  g.globalCompositeOperation = 'source-in';
  const gr = g.createLinearGradient(0, h * 0.25, 0, h * 0.8);
  gr.addColorStop(0, top);
  gr.addColorStop(0.55, top);
  gr.addColorStop(0.56, bottom);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  // 테 + 아래 그림자
  const out = document.createElement('canvas');
  out.width = w + 2;
  out.height = h + 4;
  const o = out.getContext('2d')!;
  const black = document.createElement('canvas');
  black.width = w;
  black.height = h;
  const b = black.getContext('2d')!;
  b.drawImage(mask, 0, 0);
  b.globalCompositeOperation = 'source-in';
  b.fillStyle = '#000';
  b.fillRect(0, 0, w, h);
  for (const [dx, dy] of [[0, 3], [1, 3], [2, 3], [0, 2], [2, 2]]) o.drawImage(black, dx, dy);
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [0, 0], [2, 0], [0, 2], [2, 2]]) o.drawImage(black, dx, dy);
  o.drawImage(mask, 1, 1);
  textCache.set(key, out);
  return out;
}
function blit(c: CanvasRenderingContext2D, im: HTMLCanvasElement, cx: number, y: number, k: number, alpha = 1) {
  c.globalAlpha = alpha;
  c.drawImage(im, Math.round(cx - (im.width * k) / 2), Math.round(y), im.width * k, im.height * k);
  c.globalAlpha = 1;
}

/** 타이틀 뒤 배경 + 로고. title·sub 는 메뉴 대신 여기서 도트 글자로 그린다 */
export function drawTitleBg(c: CanvasRenderingContext2D, t: number, title = '차원 승강기', sub = 'ANOMALY SIMULATION · 관리국 액션') {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.imageSmoothingEnabled = false;
  const W = c.canvas.width,
    H = c.canvas.height;
  const sx = W / 1280,
    sy = H / 720;
  c.scale(sx, sy);
  const wall = art('el_hall_wall_1');
  if (wall) {
    c.fillStyle = '#0a0806';
    c.fillRect(0, 0, 1280, 720);
    c.drawImage(wall, 160, 0, 320 * K, 220 * K);
    const l = art('el_hall_wall_4'),
      r = art('el_hall_wall_2');
    const cut = 160 / K;
    if (l) c.drawImage(l, 320 - cut, 0, cut, 220, 0, 0, 160, 220 * K);
    if (r) c.drawImage(r, 0, 0, cut, 220, 1120, 0, 160, 220 * K);
    const fl = art('el_hall_floor');
    if (fl) {
      const p = c.createPattern(fl, 'repeat');
      if (p) {
        p.setTransform(new DOMMatrix([K, 0, 0, K / 2, 0, 660]));
        c.fillStyle = p;
        c.fillRect(0, 660, 1280, 60);
      }
    }
  } else drawFallback(c, t);
  // 홀 전체를 어둡게, 형광등이 가끔 깜빡인다
  const buzz = Math.sin(t * 23) > 0.96 || (Math.sin(t * 1.3) > 0.985 && Math.sin(t * 40) > 0);
  c.fillStyle = `rgba(4,6,10,${buzz ? 0.72 : 0.5})`;
  c.fillRect(0, 0, 1280, 720);
  // 열린 문 안: 깊은 곳에서 붉은 빛이 숨 쉬듯
  const d = DOOR;
  c.save();
  c.beginPath();
  c.rect(d.x, d.y, d.w, d.h);
  c.clip();
  c.fillStyle = '#030203';
  c.fillRect(d.x, d.y, d.w, d.h);
  const breath = 0.35 + 0.25 * Math.sin(t * 1.4) + (Math.sin(t * 9) > 0.97 ? 0.3 : 0);
  const rg = c.createRadialGradient(d.x + d.w / 2, d.y + d.h + 40, 10, d.x + d.w / 2, d.y + d.h + 40, d.h * 0.95);
  rg.addColorStop(0, `rgba(200,36,20,${breath})`);
  rg.addColorStop(1, 'rgba(60,8,6,0)');
  c.fillStyle = rg;
  c.fillRect(d.x, d.y, d.w, d.h);
  // 문 안 안개 띠
  for (let i = 0; i < 5; i++) {
    const fy = d.y + d.h - 60 - i * 70 + Math.sin(t * 0.7 + i) * 12;
    c.fillStyle = `rgba(120,30,24,${0.08 + 0.04 * Math.sin(t + i * 2)})`;
    c.fillRect(d.x, Math.round(fy / K) * K, d.w, K * 4);
  }
  c.restore();
  // 문 위 층 표시: 붉은 숫자가 제멋대로 바뀐다
  const lp = LAMP;
  c.fillStyle = '#0c0302';
  c.fillRect(lp.x, lp.y, lp.w, lp.h);
  const flick = Math.sin(t * 13) > 0.9 || Math.sin(t * 2.1) > 0.97;
  const floors = ['1', 'B1', 'B3', 'B7', 'B12', '??'];
  const num = pixelText(flick ? floors[Math.floor(t * 9) % floors.length] : floors[Math.floor(t / 2.5) % floors.length], 9, flick ? '#ff3020' : '#ff7a3a', flick ? '#c01810' : '#e05a20');
  c.save();
  c.shadowColor = '#ff4020';
  c.shadowBlur = 14;
  blit(c, num, lp.x + lp.w / 2, lp.y - 3, 2);
  c.restore();
  // 바닥 쪽 그림자 + 가장자리 어둡게
  const v = c.createRadialGradient(640, 380, 220, 640, 380, 820);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.8)');
  c.fillStyle = v;
  c.fillRect(0, 0, 1280, 720);
  // 먼지
  c.fillStyle = 'rgba(236,230,212,0.3)';
  for (let i = 0; i < 36; i++) {
    const x = (i * 197 + t * 12 * (1 + (i % 3))) % 1280,
      y = (i * 131 + t * 8 * (1 + (i % 2))) % 720;
    c.fillRect(Math.round(x / K) * K, Math.round(y / K) * K, K, K);
  }
  // 로고
  const glow = 0.85 + 0.15 * Math.sin(t * 3);
  blit(c, pixelText('관리국 괴이 탐사', 12, '#f0b45a', '#c07a2a', 800), 640, 96, 3);
  c.save();
  c.shadowColor = `rgba(255,90,40,${0.55 * glow})`;
  c.shadowBlur = 30;
  blit(c, pixelText(title, 30, '#fff3d0', '#ffb43a'), 640, 138, 5);
  c.restore();
  blit(c, pixelText(sub, 10, '#c8d0d4', '#9aa6ab', 700), 640, 362, 2);
  // 오락실 구석 글자
  if (Math.sin(t * 3.2) > -0.3) blit(c, pixelText('무료 플레이', 10, '#ffe9a8', '#f0b45a', 800), 1180, 676, 2);
  // 화면 줄
  c.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < 720; y += K) c.fillRect(0, y, 1280, 1);
  c.restore();
}

/** 그림 묶음이 없을 때: 어두운 벽과 도형 문 */
function drawFallback(c: CanvasRenderingContext2D, t: number) {
  const g = c.createLinearGradient(0, 0, 0, 720);
  g.addColorStop(0, '#2a2620');
  g.addColorStop(1, '#14100c');
  c.fillStyle = g;
  c.fillRect(0, 0, 1280, 720);
  c.fillStyle = '#3a342a';
  c.fillRect(0, 660, 1280, 60);
  const d = DOOR;
  c.fillStyle = '#6a5a3a';
  c.fillRect(d.x - 18, d.y - 18, d.w + 36, d.h + 18);
  c.fillStyle = '#000';
  c.fillRect(d.x, d.y, d.w, d.h);
  c.fillStyle = '#6a5a3a';
  c.fillRect(LAMP.x - 6, LAMP.y - 6, LAMP.w + 12, LAMP.h + 12);
  void t;
}

/** 「전진 ▶」 표시 (적을 다 쓰러뜨려 화면 잠금이 풀렸을 때): 도트 글자 + 도트 화살표. x,y 는 왼쪽 위 */
export function drawGoSign(c: CanvasRenderingContext2D, x: number, y: number, t: number) {
  c.save();
  c.imageSmoothingEnabled = false;
  const im = pixelText('전진', 33, '#ffe9a8', '#ffb43a', 700, true);
  const k = 2;
  // 어두운 도트 판을 받쳐 벽·문 위 글씨가 아니라 화면 표시로 읽히게 (독립 검수: 「전진」이 문과 겹침)
  {
    const pw = im.width * k + 12 + 9 * 4 + 8 + 28,
      ph = Math.max(im.height * k, 19 * 4) + 20;
    const px = Math.round(x - 14) & ~3,
      py = Math.round(y + (im.height * k) / 2 - ph / 2) & ~3;
    c.fillStyle = '#0c0f12';
    c.fillRect(px - 4, py - 4, pw + 8, ph + 8);
    c.fillStyle = '#b8873a';
    c.fillRect(px, py, pw, ph);
    c.fillStyle = 'rgba(16,20,24,0.92)';
    c.fillRect(px + 4, py + 4, pw - 8, ph - 8);
  }
  c.drawImage(im, Math.round(x), Math.round(y), im.width * k, im.height * k);
  // 도트 화살표: 4px 칸으로 그린 삼각형, 앞뒤로 살짝 움직인다
  const ax = Math.round(x + im.width * k + 12 + (Math.floor(t * 6) % 2) * 8),
    ay = Math.round(y + (im.height * k) / 2);
  const P = 4;
  for (let i = 0; i < 9; i++) {
    const h = 9 - i;
    c.fillStyle = '#000';
    c.fillRect(ax + i * P - P, ay - h * P - P, P * 2, (h * 2 + 1) * P + P * 2);
  }
  for (let i = 0; i < 9; i++) {
    const h = 9 - i;
    c.fillStyle = i < 5 ? '#ffe9a8' : '#ffb43a';
    c.fillRect(ax + i * P, ay - h * P, P, (h * 2 - 1) * P + P);
  }
  c.restore();
}
