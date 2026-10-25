# 에일린 테스트룸 완성본(agent-motion-set: game-src/action/eileen/motion_v3/에일린_테스트룸.html)에서
# 필드·게임 주인공에 쓰는 동작 시트와 기준점을 그대로 뽑는다 (2026-10-25 사용자 지시: 테스트룸 완성 캐릭터를 쓸 것).
# 시트는 테스트룸 build.py가 정리한 그대로(떨어진 점 지움 등). 다시 그리거나 고치지 않는다.
# 사용: git show 'origin/claude/agent-motion-set:game-src/action/eileen/motion_v3/에일린_테스트룸.html' > /tmp/eroom.html
#       python3 tools/build_field_eileen.py /tmp/eroom.html
import base64, io, json, sys
from pathlib import Path
from PIL import Image
CLIPS = ['1', '3', '4', '5', '6', '7', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22', '23', '25', '26', '27', '39', 'W']
s = Path(sys.argv[1]).read_text(encoding='utf-8')
i = s.index('const A = ') + len('const A = ')
A, _ = json.JSONDecoder().raw_decode(s[i:])
out = Path('game-pack/test-people')
meta = {}
for k in CLIPS:
    a = A[k]
    # 무손실 WebP로 저장 (PNG의 약 30%, 도트 그대로)
    Image.open(io.BytesIO(base64.b64decode(a['src'].split(',', 1)[1]))).save(out / f'eileen_{k}.webp', 'WEBP', lossless=True, method=6)
    meta[k] = {key: a[key] for key in ('name', 'dir', 'n', 'w', 'h', 'bot', 'foot', 'cx')}
(out / 'eileen.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(CLIPS), 'clips')
