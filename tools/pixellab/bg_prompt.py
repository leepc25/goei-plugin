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
  view        원근: "one-point" (소실점, 양옆 벽이 안쪽으로 모임) | "flat" (소실점 없는 정면)
  floor_share 바닥이 차지하는 몫: 예 "the lower third", "the lower 40 percent"
  density     채우기: "packed" (헐값매입 1차 문장: 빽빽하게, 빈 벽·바닥 구석 없이) | "normal" (문구 없음) | "bare" (휑하게)
  sides       양옆 벽: "both" | "left" (왼쪽만 벽, 오른쪽 열림) | "right" | "none"
  floor       바닥 재질·사용감·빛 웅덩이·그림자
  walls       벽 재질·얼룩·걸레받이; 천장 조명
  items       [ "자리 말 + 물건 묘사", ... ]  (12~28줄, 한 줄에 물건 1~2개, 자리 말 필수: on the back wall / left / right / in front / center ...)
  shadow      명암 대비 한 줄: 어디가 밝고 어디가 짙은 그림자인지
  palette     팔레트: 대비 있게 (어둡거나 바랜 바탕 + 밝은 포인트)
  no          추가로 그리지 말 것 (예: ["doors", "doorways", "blood"])
"""
import json, sys, os, base64, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 고정은 카메라 높이·각도뿐. 원근·바닥 몫·양옆 벽은 장면마다 다르게 정한다(사용자 10-30: 「소실점 없음·양끝 벽」은 상황에 따라)
CAMERA = "Camera at standing eye height, about 20 degrees above the floor, looking slightly down."
VIEW = {
    'one-point': "One-point perspective, side walls receding toward the middle.",
    'flat': "Flat front view, no vanishing point.",
}
# 채우기 정도: 장면마다 정한다 (사용자 10-30: 채우기 문구를 일괄로 빼지 말 것)
DENSITY = {
    'packed': "PACKED WITH STUFF, every area filled, no empty wall, no empty floor corner.",   # 헐값매입 1차 문장
    'normal': "",
    'bare': "Sparse and bare, only the listed things.",
}
SIDES = {
    'both': "Both side walls are visible, a closed room.",
    'left': "Only the left side wall is visible; on the right the room keeps going past the image edge, cut off by the frame.",
    'right': "Only the right side wall is visible; on the left the room keeps going past the image edge, cut off by the frame.",
    'none': "No side walls: the room keeps going past both image edges.",
}
STYLE = "dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading"
ALWAYS_NO = ["people", "chairs", "sofas", "benches", "clocks"]
BANNED = [  # 채우기 문구는 density 칸으로만 넣는다(아래)
          r"\bchair\b", r"\bsofa\b", r"\bbench\b", r"\bclock\b", r"\bbucket\b.*\bdrip\b", r"\bleak\b", r"\bcurtain\b.*\brail\b"]
PLACE_WORDS = ("back wall", "left", "right", "front", "center", "middle", "corner", "beside", "next to", "behind", "above", "in front of", "on the")
REF1_USAGE = ("Copy only the camera angle, the low viewing height, the perspective, the pixel density and the level of detail "
              "and shading of this image. Do not copy any of its objects, furniture, layout, room shape or colors.")
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def build(spec):
    need = ['name', 'place', 'time', 'light', 'view', 'floor_share', 'sides', 'density', 'floor', 'walls', 'items', 'shadow', 'palette']
    miss = [k for k in need if not spec.get(k)]
    if miss: raise SystemExit(f'빈 칸: {miss}')
    if spec['sides'] not in SIDES: raise SystemExit('sides는 both|left|right|none')
    if spec['view'] not in VIEW: raise SystemExit('view는 one-point|flat')
    if spec['density'] not in DENSITY: raise SystemExit('density는 packed|normal|bare')
    errs = []
    spec = dict(spec, items=[(it.get('text') if isinstance(it, dict) else it) or '' for it in spec['items']])
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
        f"{CAMERA} {VIEW[spec['view']]} The floor fills {spec['floor_share']} of the image. {SIDES[spec['sides']]}",
        f"FLOOR: {spec['floor']}.",
        f"WALLS: {spec['walls']}.",
        (DENSITY[spec['density']] + " " if DENSITY[spec['density']] else "") + "THINGS (a standing adult is 150 pixels tall): " + "; ".join(spec['items']) + ".",
        f"LIGHT: {spec['shadow']}.",
        f"STYLE: {STYLE}, {spec['palette']}, no dithering, no blur. No " + ", ".join(no[:-1]) + " or " + no[-1] + ".",
    ]
    return "\n".join(parts)


def main():
    spec_path = sys.argv[1]
    spec = json.load(open(spec_path, encoding='utf-8'))
    text = build(spec)
    from bg_check import report   # 점검을 통과해야만 만든다
    if not report(spec, text): raise SystemExit('점검 실패: 고친 뒤 다시')
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
    # 검토서: 1차 상세안 → 2차 정제(줄인 내용) → 점검 결과
    from bg_check import check
    fails, warns = check(spec, text)
    stop = set('a an the of and with on in at to its it is as by for from'.split())
    L = [f"# 검토서 {spec['name']}", '', f"방 {spec.get('room')} · 분위기 {spec.get('mood')} · 문 {spec.get('doors')} · 원근 {spec['view']} · 바닥 {spec['floor_share']} · 양옆 {spec['sides']} · 채우기 {spec['density']}", '',
         '## 근거', '', f"- 위키: {spec.get('brief', {}).get('wiki', '')}", f"- 설계안: {spec.get('brief', {}).get('design', '')}"] + [f"- 사용자: {u}" for u in spec.get('brief', {}).get('user', [])] + \
        ['', '## 1차 상세안 → 2차 정제', '', '| 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 줄이며 뺀 낱말 |', '|---|---|---|---|---|']
    for it in spec['items']:
        full_w = [w for w in re.findall(r"[a-z\-]+", it['full'].lower()) if w not in stop]
        cut = sorted(set(w for w in full_w if w not in it['text'].lower()))
        L.append(f"| {it['full']} | {it['why']} | {', '.join(it['keep'])} | {it['text']} | {', '.join(cut)} |")
    L += ['', f'## 2차 요청문 ({len(text)}자)', '', '```', text, '```', '', '## 점검', ''] + [f'- FAIL {f}' for f in fails] + [f'- WARN {w}' for w in warns] + (['- 통과'] if not fails and not warns else [])
    open(os.path.join(out, f"{spec['name']}_review.md"), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    print(f"{spec['name']}: {len(text)}자, 물건 {len(spec['items'])}개, 참고 그림 {len(req['reference_images'])}장")
    print(text)


if __name__ == '__main__':
    main()
