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
    # 잇기(EXTEND)는 원본 = 이어 그릴 그림의 요청문(사용자 11-01 11:47). PROMPT_ORIG=<그 요청문> 이면 그 문장과만 대조, 빠짐 하나라도 있으면 실패
    if os.environ.get('PROMPT_ORIG'):
        orig = Path(os.environ['PROMPT_ORIG']).read_text(encoding='utf-8')
        # PROMPT_ALLOW='앞머리1|앞머리2': 사용자에게 보여 준 바뀐 문장(장소 줄·분위기 구절)만 「바뀜 허용」 (2026-11-02 격리팀 실험실)
        allow = tuple(a for a in os.environ.get('PROMPT_ALLOW', '').split('|') if a)
        for s in sents(orig):
            hit = s in new
            if not hit and allow and s.startswith(allow) and any(n.startswith(s[:40]) for n in sents(new)):
                rows.append(('바뀜 허용', s[:70])); continue
            rows.append(('그대로' if hit else '빠짐', s[:70])); ok &= hit
        for s in sents(new):
            if s not in orig: rows.append(('새 문장', s[:90]))
        return ok, rows
    # 2026-11-01 14:29 사용자 「그래」: 샤워실은 양옆 벽에 샤워기를 달아야 해서 「옆벽 없음·양 끝 트임」 문장을 뺀다 (SIDE_WALLS=1일 때만)
    must = [m for m in MUST if not (os.environ.get('SIDE_WALLS') == '1' and m.startswith('The back wall, floor and ceiling run straight on past'))]
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
