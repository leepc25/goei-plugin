// 상호작용 안내: 글자 대신 작은 도트 아이콘 (검수 4-2). 물건 앞에 섰을 때 요원 머리 위에만 뜬다.
// 모양은 아래를 가리키는 손가락 없는 화살표 + 반짝임 한 점. 도트 1칸 = 6px.

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
const D = 6;

/** x: 화면 가운데, y: 아이콘 아래 끝(머리 위), tick: 30Hz 틱 (위아래로 살짝 흔들림) */
export function drawHintIcon(c: CanvasRenderingContext2D, x: number, y: number, tick: number) {
  const bob = Math.round(Math.sin(tick / 5) * 1.5) * D;
  const w = SHAPE[0].length * D;
  const ox = Math.round(x - w / 2);
  const oy = Math.round(y - SHAPE.length * D + bob);
  c.save();
  c.imageSmoothingEnabled = false;
  for (let r = 0; r < SHAPE.length; r++)
    for (let k = 0; k < SHAPE[r].length; k++) {
      const ch = SHAPE[r][k];
      if (ch === '.') continue;
      c.fillStyle = ch === '#' ? '#1a1410' : r < 3 ? '#fff4c8' : '#f0c860';
      c.fillRect(ox + k * D, oy + r * D, D, D);
    }
  c.restore();
}
