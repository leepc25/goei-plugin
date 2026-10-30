"""배경 요청문 틀 (docs/배경_생성_공용지침.md 2장). 칸만 채운 장면 명세(JSON)로 요청문과 요청 JSON을 만든다.
고정 문장(카메라·화풍)은 여기서만 정한다. 빠진 칸·금지 낱말·2,000자 초과면 만들지 않는다.

사용:
  python3 tools/pixellab/bg_prompt.py <명세.json>            → 같은 폴더에 <이름>_prompt.txt, <이름>_req.json
  python3 tools/pixellab/bg_prompt.py <명세.json> --sketch <밑그림.png> "<밑그림 쓰는 법>"

명세 칸 (모두 영어 문장 조각, 끝 마침표 없이):
  name        파일 이름 (예: op_v4)
  place       장소 한 줄: 무엇을 하는 곳, 상태, "in a run-down 1990s Seoul underground arcade"
  time        예: "late night"
  light       빛 한 줄: 예: "harsh fluorescent light"
  sides       양옆 벽: "both" | "left" (왼쪽만 벽, 오른쪽 열림) | "right"
  floor       바닥 재질·사용감·빛 웅덩이·그림자
  walls       벽 재질·얼룩·걸레받이; 천장 조명
  items       [ "자리 말 + 물건 묘사", ... ]  (12~28줄, 한 줄에 물건 1~2개, 자리 말 필수: on the back wall / left / right / in front / center ...)
  shadow      명암 대비 한 줄: 어디가 밝고 어디가 짙은 그림자인지
  palette     팔레트: 대비 있게 (어둡거나 바랜 바탕 + 밝은 포인트)
  no          추가로 그리지 말 것 (예: ["doors", "doorways", "blood"])
"""
import json, sys, os, base64, re

CAMERA = ("Camera about 20 degrees above the floor looking down: the floor fills the lower half, "
          "the back wall shows only as a low strip with its baseboard along the top edge. No vanishing point.")
SIDES = {
    'both': "Plain wall stubs at both ends, a closed room.",
    'left': "A plain wall stub on the left only; on the right the room keeps going past the image edge, cut off by the frame.",
    'right': "A plain wall stub on the right only; on the left the room keeps going past the image edge, cut off by the frame.",
}
STYLE = "dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading"
ALWAYS_NO = ["people", "chairs", "sofas", "benches", "clocks"]
BANNED = [r"\bfill(ed)?\b.*\bevery\b", r"\bpacked\b", r"\bno empty\b", r"\bkeep empty\b", r"\bleave empty\b",   # 채우기·비우기 지시문 금지
          r"\bchair\b", r"\bsofa\b", r"\bbench\b", r"\bclock\b", r"\bbucket\b.*\bdrip\b", r"\bleak\b", r"\bcurtain\b.*\brail\b"]
PLACE_WORDS = ("back wall", "left", "right", "front", "center", "middle", "corner", "beside", "next to", "behind", "above", "in front of", "on the")
REF1_USAGE = ("Copy only the camera angle, the low viewing height, the perspective, the pixel density and the level of detail "
              "and shading of this image. Do not copy any of its objects, furniture, layout, room shape or colors.")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def build(spec):
    need = ['name', 'place', 'time', 'light', 'sides', 'floor', 'walls', 'items', 'shadow', 'palette']
    miss = [k for k in need if not spec.get(k)]
    if miss: raise SystemExit(f'빈 칸: {miss}')
    if spec['sides'] not in SIDES: raise SystemExit('sides는 both|left|right')
    errs = []
    for it in spec['items']:
        if not any(w in it.lower() for w in PLACE_WORDS): errs.append(f'자리 말 없음: {it}')
    text_all = ' '.join([spec['place'], spec['floor'], spec['walls'], spec['shadow']] + spec['items']).lower()
    for pat in BANNED:
        if re.search(pat, text_all): errs.append(f'금지 표현: /{pat}/')
    n = len(spec['items'])
    if not 12 <= n <= 28: errs.append(f'물건 줄 수 {n} (12~28줄, 한 줄 1~2개)')
    if errs: raise SystemExit('\n'.join(errs))
    no = ALWAYS_NO + [x for x in spec.get('no', []) if x not in ALWAYS_NO]
    parts = [
        f"Pixel art game background: {spec['place']}, {spec['time']}, {spec['light']}.",
        f"{CAMERA} {SIDES[spec['sides']]}",
        f"FLOOR (lower half): {spec['floor']}.",
        f"WALLS: {spec['walls']}.",
        "THINGS (a standing adult is 150 pixels tall): " + "; ".join(spec['items']) + ".",
        f"LIGHT: {spec['shadow']}.",
        f"STYLE: {STYLE}, {spec['palette']}, no dithering, no blur. No " + ", ".join(no[:-1]) + " or " + no[-1] + ".",
    ]
    return "\n".join(parts)


def main():
    spec_path = sys.argv[1]
    spec = json.load(open(spec_path, encoding='utf-8'))
    text = build(spec)
    if len(text) > 2000: raise SystemExit(f'{len(text)}자: 2,000자를 넘음. 묘사 말고 군더더기를 줄일 것')
    out = os.path.dirname(os.path.abspath(spec_path))
    open(os.path.join(out, f"{spec['name']}_prompt.txt"), 'w', encoding='utf-8').write(text)
    req = json.load(open(os.path.join(ROOT, 'tools/pixellab/req/base_req.json')))
    req['description'] = text
    req['reference_images'] = req['reference_images'][:1]
    req['reference_images'][0]['usage_description'] = REF1_USAGE
    if '--sketch' in sys.argv:
        i = sys.argv.index('--sketch'); p, usage = sys.argv[i + 1], sys.argv[i + 2]
        from PIL import Image
        w, h = Image.open(p).size
        req['reference_images'].append({'image': {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'},
                                        'size': {'width': w, 'height': h}, 'usage_description': usage[:500]})
    json.dump(req, open(os.path.join(out, f"{spec['name']}_req.json"), 'w'))
    print(f"{spec['name']}: {len(text)}자, 물건 {len(spec['items'])}개, 참고 그림 {len(req['reference_images'])}장")
    print(text)


if __name__ == '__main__':
    main()
