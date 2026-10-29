# 에일린 테스트룸 완성본(agent-motion-set: game-src/action/eileen/motion_v3/에일린_테스트룸.html)에서
# 필드·게임 주인공에 쓰는 동작 시트와 기준점을 그대로 뽑는다 (2026-10-25 사용자 지시: 테스트룸 완성 캐릭터를 쓸 것).
# 시트는 테스트룸 build.py가 정리한 그대로(떨어진 점 지움 등). 다시 그리거나 고치지 않는다.
# 사용: git show 'origin/claude/agent-motion-set:game-src/action/eileen/motion_v3/에일린_테스트룸.html' > /tmp/eroom.html
#       python3 tools/build_field_eileen.py /tmp/eroom.html
import base64, io, json, sys
from pathlib import Path
from PIL import Image
# 테스트룸 동작 전부 (사용자 2026-10-25: 감정 표현도 키 없이 다 넣는다 — NPC·연출이 core.onPress('nod') 등으로 부른다)
CLIPS = None
s = Path(sys.argv[1]).read_text(encoding='utf-8')
i = s.index('const A = ') + len('const A = ')
A, _ = json.JSONDecoder().raw_decode(s[i:])
out = Path('game-pack/test-people')
meta = {}
for k in (CLIPS or list(A.keys())):
    if k not in A: continue
    a = A[k]
    # 무손실 WebP로 저장 (PNG의 약 30%, 도트 그대로)
    Image.open(io.BytesIO(base64.b64decode(a['src'].split(',', 1)[1]))).save(out / f'eileen_{k}.webp', 'WEBP', lossless=True, method=6)
    if k not in A: continue
    meta[k] = {key: v for key, v in a.items() if key != 'src'}
(out / 'eileen.json').write_text(json.dumps(meta, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
# PixelLab 이펙트 그림(테스트룸 vfx): 시트 + 장 목록·기준점
j = s.index('const VFX = ') + len('const VFX = ')
V, _ = json.JSONDecoder().raw_decode(s[j:])
vmeta = {}
for name, v in V.items():
    Image.open(io.BytesIO(base64.b64decode(v['src'].split(',', 1)[1]))).save(out / f'vfx_{name}.webp', 'WEBP', lossless=True, method=6)
    vmeta[name] = {'frames': v['frames'], 'pivot': v['pivot']}
(out / 'eileen_vfx.json').write_text(json.dumps(vmeta, separators=(',', ':')), encoding='utf-8')
print(len(meta), 'clips', len(vmeta), 'vfx')
