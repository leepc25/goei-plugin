"""첫 방(종합대응팀 사무실) 통그림 → 게임 도트.

입력: game-src/art/start-room/raw_room.png, raw_workstation.png (GPT 원본 1672×941)
출력: game-pack/start-room/room.png, workstation.png (둘 다 640×360, 도트 1px = 화면 2px)
책상·의자는 화면 자리(균일 0.55배, (90,107.5))에 미리 놓은 뒤 줄여서 방과 칸이 어긋나지 않게 한다.
방과 가구는 한 팔레트를 쓴다. 줄이기는 bg_pixelize와 같은 칸별 다수결(B안).

사용: python3 tools/startroom_pixelize.py [색 수, 기본 64]
"""
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bg_pixelize as bp  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'game-src/art/start-room'
OUT = ROOT / 'game-pack/start-room'
WORLD = (1280, 720)
DOT = (640, 360)


def main() -> None:
    bp.COLORS = int(sys.argv[1]) if len(sys.argv) > 1 else 64
    room = Image.open(SRC / 'raw_room.png').convert('RGB').resize(WORLD, Image.Resampling.LANCZOS)
    ws = Image.open(SRC / 'raw_workstation.png').convert('RGBA')
    ws = ws.resize((round(ws.width * .55), round(ws.height * .55)), Image.Resampling.LANCZOS)
    placed = Image.new('RGBA', WORLD, (0, 0, 0, 0))
    placed.alpha_composite(ws, (90, 108))
    room, placed = bp.tone(room), bp.tone(placed)
    pal = bp.place_palette([room, placed.convert('RGB')])
    bp.ink(bp.mode_down(room, DOT, pal), False).convert('RGB').quantize(256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).save(OUT / 'room.png', optimize=True)
    bp.ink(bp.mode_down(placed, DOT, pal), True).save(OUT / 'workstation.png', optimize=True)


if __name__ == '__main__':
    main()
