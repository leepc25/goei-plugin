// 상호작용 안내: 글자 대신 작은 도트 아이콘 (검수 4-2). 물건 앞에 섰을 때 요원 머리 위에만 뜬다.
// 모양은 아래를 가리키는 손가락 없는 화살표 + 반짝임 한 점. 도트 1칸 = 4px.

const SHAPE = [
  '..###..',
  '..#o#..',
  '..#o#..',
  '###o###',
  '#ooooo#',
  '.#ooo#.',
  '..#o#..',
  '...#...',
];
const D = 4;

/** x: 화면 가운데, y: 아이콘 아래 끝(머리 위), tick: 30Hz 틱 (위아래로 살짝 흔들림) */
export function drawHintIcon(c: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  const bob = Math.round(Math.sin(tick / 5) * 1.5) * D;
  const w = SHAPE[0].length * D;
  const ox = Math.round(x - w / 2);
  const oy = Math.round(y - SHAPE.length * D + bob);
  c.save();
  c.imageSmoothingEnabled = false;
  // 도트 둥근 판(어두운 바탕 + 금색 테두리): 벽의 세로선·문틈에 붙어 막대처럼 읽히지 않게 따로 떠 보이는 표식 (검수 12-4)
  const P = 4;
  const R = 9; // 판 반지름(칸)
  const cx = Math.round(x),
    cy = Math.round(oy + (SHAPE.length * D) / 2);
  for (let gy = -R; gy <= R; gy++)
    for (let gx = -R; gx <= R; gx++) {
      const d = Math.hypot(gx, gy);
      if (d > R + 0.3) continue;
      c.fillStyle = d > R - 1.2 ? '#c89a3a' : d > R - 2.2 ? '#1a1410' : 'rgba(20,16,12,0.82)';
      c.fillRect(cx + gx * P - P / 2, cy + gy * P - P / 2, P, P);
    }
  for (let r = 0; r < SHAPE.length; r++)
    for (let k = 0; k < SHAPE[r].length; k++) {
      const ch = SHAPE[r][k];
      if (ch === '.') continue;
      c.fillStyle = ch === '#' ? '#1a1410' : r < 3 ? '#fff4c8' : '#f0c860';
      c.fillRect(ox + k * D, oy + r * D, D, D);
    }
  c.restore();
}
