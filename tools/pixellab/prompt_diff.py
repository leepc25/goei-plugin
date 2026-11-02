"""배경 요청문을 3층 원본(specs/hq_f3_v3_p1f_prompt.txt)과 문장 단위로 대조한다 (2026-11-01 사용자: 「몇백 번을 말해도 지침을 안 지킨다」).
- 원본 문장 중 「빠짐」이 있으면 실패(종료 코드 1). 바뀐 문장은 표로 보여 준다.
- 장소 줄(첫 문장)·문 줄·제외 목록 줄은 원래 바꾸는 자리라 「바뀜 허용」으로 표시.
사용: python3 tools/pixellab/prompt_diff.py <요청문.txt>   — 생성 스크립트가 보내기 전에 자동으로 부른다."""
import re, sys
from pathlib import Path
ORIG = Path(__file__).resolve().parents[2] / 'game-src/art/pixellab-hq-20261031/specs/hq_f3_v3_p1f_prompt.txt'
# 3층 원본에서 그 층 고유라 바꿔도 되는 문장(장소·문·옆벽·제외 목록)
ALLOW = ('Pixel art side-scrolling game background:', 'Elevator doors', 'On the left side of the back wall', 'No people')
# 반드시 들어 있어야 하는 핵심 구절(꽉 채우기 등)
MUST = ['Seen from the front at standing eye height, slightly from above; the walkable floor fills the lower third of the image.',
        'Pack the whole image with detail everywhere: walls, floor, ceiling and corners all full of objects and texture',
        'with real depth', 'Everything else is up to you.', 'Rich lighting with clear shadows.',
        'Dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich shading, no dithering, no blur.',
        'The floor is one seamless polished surface with no tiles and no grid lines',
        'The back wall, floor and ceiling run straight on past the']
def sents(t): return [s.strip() for s in re.split(r'(?<=\.)\s+', t.strip()) if s.strip()]
def check(path):
    new = Path(path).read_text(encoding='utf-8')
    ok = True; rows = []
    import os
    # 2026-11-01 14:29 사용자 「그래」: 샤워실은 양옆 벽에 샤워기를 달아야 해서 「옆벽 없음·양 끝 트임」 문장을 뺀다 (SIDE_WALLS=1일 때만)
    must = [m for m in MUST if not (os.environ.get('SIDE_WALLS') == '1' and m.startswith('The back wall, floor and ceiling run straight on past'))]
    # 2026-11-01 화장실·휴게실(설비·가구는 오브젝트, 바닥 비움): 사용자 확정 화장실 p1 문장 「Pack the walls and ceiling with detail and texture everywhere, nothing left plain」로 꽉 채우기 문장을 대신한다 (NO_FILL=1일 때만)
    if os.environ.get('NO_FILL') == '1':
        must = ['Pack the walls and ceiling with detail and texture everywhere, nothing left plain' if m.startswith('Pack the whole image') else m for m in must]
    for m in must:
        hit = m in new
        rows.append(('그대로' if hit else '빠짐', m[:70]))
        ok &= hit
    for s in sents(ORIG.read_text(encoding='utf-8')):
        if s in new: continue
        if s.startswith(ALLOW): rows.append(('바뀜 허용', s[:70]))
        elif not any(m in s for m in MUST): rows.append(('바뀜', s[:70]))
    for s in sents(new):
        if s not in ORIG.read_text(encoding='utf-8'): rows.append(('새 문장', s[:90]))
    return ok, rows
if __name__ == '__main__':
    ok, rows = check(sys.argv[1])
    for a, b in rows: print(f'{a}\t{b}')
    print('통과' if ok else '실패: 원본 핵심 문장이 빠짐 — 보내지 않는다'); sys.exit(0 if ok else 1)
