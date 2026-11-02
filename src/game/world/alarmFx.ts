// 거점 경보 경광등 (10-31 사용자: 화면 UI 가 아니라 장면 안 경광등 효과). 천장 경광등이 돌며 빨간 빛줄기가 장면을 쓸고, 장면 전체가 붉게 맥박친다.
// 그리는 자리: 필드 overlay (월드 좌표 × zoom 의 화면 px)
/** len = 장면 길이, laneTop = 걷는 띠 위 끝(월드), z = 필드 배율, t = 초, from·to = 그릴 월드 x 범위 */
export function drawAlarmLights(c: CanvasRenderingContext2D, len: number, laneTop: number, z: number, t: number, from: number, to: number): void {
  c.save();
  // 장면 전체 붉은 맥박 (사이렌 한 바퀴 1.6초에 맞춤)
  const pulse = 0.5 + 0.5 * Math.sin((t / 1.6) * Math.PI * 2);
  c.fillStyle = `rgba(255,24,16,${(0.05 + 0.07 * pulse).toFixed(3)})`;
  c.fillRect(Math.max(0, from) * z, 0, (Math.min(len, to) - Math.max(0, from)) * z, (laneTop + 400) * z);
  c.globalCompositeOperation = 'lighter';
  const ly = Math.max(36, laneTop - 430);   // 천장
  const gap = 520;
  for (let i = 0, x = gap / 2; x < len; i++, x += gap) {
    if (x < from - 500 || x > to + 500) continue;
    const a = t * 4.2 + i * 1.3;
    const toward = Math.sin(a);          // 앞(보는 쪽)을 향할수록 밝다
    const sweep = Math.cos(a);           // 옆으로 쓸고 가는 쪽
    const bx = x * z, by = ly * z;
    // 빛줄기: 경광등에서 바닥 쪽으로 퍼지는 삼각형
    const reach = 520 * z;
    const ex = bx + sweep * reach, ey = (laneTop + 160) * z;
    const half = (90 + 60 * Math.abs(toward)) * z;
    const g = c.createLinearGradient(bx, by, ex, ey);
    const al = 0.12 + 0.28 * Math.max(0, toward);
    g.addColorStop(0, `rgba(255,60,40,${al.toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,30,20,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(bx, by);
    c.lineTo(ex - half, ey);
    c.lineTo(ex + half, ey);
    c.closePath();
    c.fill();
    // 경광등 몸: 작은 빨간 돔 + 눈부심
    const glow = c.createRadialGradient(bx, by, 0, bx, by, (40 + 50 * Math.max(0, toward)) * z);
    glow.addColorStop(0, `rgba(255,120,90,${(0.35 + 0.5 * Math.max(0, toward)).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(255,0,0,0)');
    c.fillStyle = glow;
    c.fillRect(bx - 100 * z, by - 100 * z, 200 * z, 200 * z);
  }
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#5a0d0a';
  for (let x = gap / 2; x < len; x += gap) {
    if (x < from - 500 || x > to + 500) continue;
    c.fillRect((x - 9) * z, (ly - 6) * z, 18 * z, 10 * z);
    c.fillStyle = '#ff3a2a';
    c.fillRect((x - 6) * z, (ly - 12) * z, 12 * z, 7 * z);
    c.fillStyle = '#5a0d0a';
  }
  c.restore();
}
