// 제목 화면 뒤 배경: 낡은 엘리베이터 문과 깜빡이는 층 표시. 엔진 제목 장면과 시연판이 같이 쓴다.
import { label } from './hud';

/** 타이틀 뒤 배경: 낡은 엘리베이터 문과 깜빡이는 층 표시 */
export function drawTitleBg(c: CanvasRenderingContext2D, t: number) {
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  const W = c.canvas.width,
    H = c.canvas.height;
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0b1014');
  g.addColorStop(1, '#1a1410');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const dx = 820,
    dw = 340,
    dy = 170,
    dh = 470;
  c.fillStyle = '#2a2f33';
  c.fillRect(dx - 30, dy - 30, dw + 60, dh + 30);
  const open = Math.max(0, Math.sin(t * 0.35)) ** 6 * 30;
  for (const side of [0, 1]) {
    const x = side ? dx + dw / 2 + open : dx - open;
    const dg = c.createLinearGradient(x, 0, x + dw / 2, 0);
    dg.addColorStop(0, '#4c5458');
    dg.addColorStop(1, '#3a4044');
    c.fillStyle = dg;
    c.fillRect(x, dy, dw / 2, dh);
  }
  c.fillStyle = '#000';
  c.fillRect(dx + dw / 2 - open, dy, open * 2, dh);
  c.fillStyle = 'rgba(255,60,30,0.25)';
  c.fillRect(dx + dw / 2 - open, dy, open * 2, dh);
  // 층 표시
  c.fillStyle = '#100604';
  c.fillRect(dx + dw / 2 - 70, dy - 110, 140, 60);
  const flick = Math.sin(t * 13) > 0.92 || Math.sin(t * 2.1) > 0.97;
  const floors = ['1', 'B1', 'B3', 'B7', 'B12', '??'];
  label(c, flick ? floors[Math.floor(t * 7) % floors.length] : floors[Math.floor(t / 3) % floors.length], dx + dw / 2, dy - 66, 36, flick ? '#ff3020' : '#ff8a40', 'center', 900);
  // 점검표
  c.fillStyle = '#d8d0bc';
  c.fillRect(dx - 110, dy + 120, 60, 84);
  c.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 6; i++) c.fillRect(dx - 104, dy + 132 + i * 11, 48, 2);
  // 먼지
  c.fillStyle = 'rgba(236,230,212,0.25)';
  for (let i = 0; i < 40; i++) {
    const x = (i * 197 + t * 12 * (1 + (i % 3))) % W,
      y = (i * 131 + t * 8 * (1 + (i % 2))) % H;
    c.fillRect(x, y, 2, 2);
  }
  const v = c.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.75)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  c.restore();
}
