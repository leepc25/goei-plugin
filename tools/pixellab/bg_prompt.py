"""배경 요청문 틀 (docs/배경_생성_공용지침.md 2장). 칸만 채운 장면 명세(JSON)로 요청문과 요청 JSON을 만든다.
고정 문장(카메라·화풍)은 여기서만 정한다. 빠진 칸·금지 낱말·2,000자 초과면 만들지 않는다.

사용:
  python3 tools/pixellab/bg_prompt.py <명세.json>            → 같은 폴더에 <이름>_prompt.txt, <이름>_req.json
  python3 tools/pixellab/bg_prompt.py <명세.json> --sketch <밑그림.png> "<밑그림 쓰는 법>"
  python3 tools/pixellab/bg_prompt.py <명세.json> --no-ref1      → 참고 그림 1(헐값매입) 없이

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
  items       [{full, why, keep, text, at, drop_ok}, ...]  (12~28줄, 한 줄에 물건 1~2개)
              at = 자리 묶음("back wall, right part" / "left wall" / "floor, left" / "on the counter"). 같은 at끼리 묶여 「Back wall, right part: a; b.」로 한 번만 적힌다
  shadow      명암 대비 한 줄: 어디가 밝고 어디가 짙은 그림자인지
  palette     팔레트: 대비 있게 (어둡거나 바랜 바탕 + 밝은 포인트)
  no          추가로 그리지 말 것 (예: ["doors", "doorways", "blood"])
"""
import json, sys, os, base64, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# 고정은 카메라 높이·각도뿐. 원근·바닥 몫·양옆 벽은 장면마다 다르게 정한다(사용자 10-30: 「소실점 없음·양끝 벽」은 상황에 따라)
CAMERA = "Camera at standing eye height, about 20 degrees above the floor, looking slightly down."
# 통로(벨트스크롤 이어 붙이기)용: 20도로는 뒷벽선이 78%까지 내려가 벽이 사람의 2.2배, 바닥 22%(중림 앞골목 ① v1·v2) → 더 내려다봄 (사용자 10-31 허락)
CAMERAS = {'room': CAMERA, 'corridor': "Camera a little above standing eye height, looking down at about 35 degrees."}
VIEW = {
    'one-point': "One-point perspective, side walls receding toward the middle.",
    'flat': "Flat front view, no vanishing point.",
}
# 채우기 정도: 장면마다 정한다 (사용자 10-30: 채우기 문구를 일괄로 빼지 말 것)
DENSITY = {
    'packed': "PACKED WITH STUFF, every area filled, no empty wall, no empty floor corner.",   # 헐값매입 1차 문장
    # 더 강조(사용자 10-30 대박 알선): 벽·선반·탁자 위까지 잔물건으로
    'packed+': "VERY CLUTTERED: every wall, shelf and corner packed with small props.",
    'normal': "",
    'bare': "Sparse and bare, only the listed things.",
}
SIDES = {
    'both': "Both side walls are visible, a closed room.",
    'left': "Only the left side wall is visible; on the right the room continues past the image edge.",
    'right': "Only the right side wall is visible; on the left the room continues past the image edge.",
    'none': "No side walls: the room keeps going past both image edges.",
}
STYLE = "dense, highly detailed pixel art, crisp pixel clusters, selective dark outline, rich medium-to-detailed shading"
ALWAYS_NO = ["people", "chairs", "sofas", "benches", "coffee tables", "clocks"]   # 소파 앞 낮은 탁자는 소파처럼 오브젝트로(사용자 10-30: 대박 알선 바닥 한가운데 좌식 탁자)
BANNED = [  # 채우기 문구는 density 칸으로만 넣는다(아래)
          r"\bchair\b", r"\bsofa\b", r"\bcoffee tables?\b", r"\blow tables?\b", r"\bbench\b", r"\bclock\b", r"\bbucket\b.*\bdrip\b", r"\bleak\b", r"\bcurtain\b.*\brail\b"]
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
    if spec['density'] not in DENSITY: raise SystemExit('density는 packed|packed+|normal|bare')
    errs = []
    # 물건마다 at(자리 묶음: "back wall", "left wall", "floor, left", "on the counter" …)이 있으면 자리를 묶음 머리에 한 번만 적는다.
    # 「on the back wall」을 줄마다 되풀이하던 글자를 아껴 물건을 덜 뺀다(사용자 10-30: 문법 구조 바꿔)
    groups = {}
    for it in spec['items']:
        at = (it.get('at') or '').strip() if isinstance(it, dict) else ''
        t = ((it.get('text') if isinstance(it, dict) else it) or '').strip()
        if spec.get('mode') == 'loose': pass   # 느슨한 틀(헐값매입 최초 방식): 자리 지정 없이 나열
        elif at:
            if not re.search(r'wall|floor|ceiling', at.lower()) and not at.lower().startswith('on the '): errs.append(f'at이 모호함(벽·바닥·천장 또는 on the 가구): {at}')
        elif not any(w in t.lower() for w in PLACE_WORDS): errs.append(f'자리 말 없음: {t}')
        groups.setdefault(at, []).append(t)
    spec = dict(spec, items=[t for g in groups.values() for t in g])
    text_all = ' '.join([spec['place'], spec['floor'], spec['walls'], spec['shadow']] + list(groups) + spec['items']).lower()
    for pat in BANNED:
        if re.search(pat, text_all): errs.append(f'금지 표현: /{pat}/')
    n = len(spec['items'])
    if not 10 <= n <= 28: errs.append(f'물건 줄 수 {n} (10~28줄, 한 줄 1~2개)')
    if errs: raise SystemExit('\n'.join(errs))
    no = ALWAYS_NO + [x for x in spec.get('no', []) if x not in ALWAYS_NO]
    things = ' '.join((f"{at[0].upper() + at[1:]}: " if at else '') + '; '.join(ts) + '.' for at, ts in groups.items())
    if spec.get('mode') == 'loose':
        # 사용자 10-30: 「너무 컨트롤하려 해서 결과가 나빠진다」 — 헐값매입 최초 요청문처럼 물건을 풍성하게 한 덩어리로 나열, 자리·크기 숫자 없음
        return "\n".join([
            f"Pixel art game background of {spec['place']}, {spec['time']}. {CAMERAS[spec.get('camera', 'room')]} {VIEW[spec['view']]} The floor fills {spec['floor_share']} of the image. {SIDES[spec['sides']]}",
            f"FLOOR: {spec['floor']}.",
            DENSITY[spec['density']].rstrip('.') + ": " + '; '.join(spec['items']) + ".",
            f"WALL: {spec['walls']}.",
            f"LIGHT: {spec['shadow']}.",
            f"STYLE: {STYLE}, {spec['palette']}, no dithering, no blur. No " + ", ".join(no[:-1]) + " or " + no[-1] + ".",
        ])
    no = ALWAYS_NO + [x for x in spec.get('no', []) if x not in ALWAYS_NO]
    parts = [
        f"Pixel art game background: {spec['place']}, {spec['time']}, {spec['light']}.",
        f"{CAMERAS[spec.get('camera', 'room')]} {VIEW[spec['view']]} The floor fills {spec['floor_share']} of the image. {SIDES[spec['sides']]}",
        f"FLOOR: {spec['floor']}.",
        f"WALLS: {spec['walls']}.",
        (DENSITY[spec['density']] + " " if DENSITY[spec['density']] else "") + "THINGS (a standing adult is 150 pixels tall): " + things,
        f"LIGHT: {spec['shadow']}.",
        f"STYLE: {STYLE}, {spec['palette']}, no dithering, no blur. No " + ", ".join(no[:-1]) + " or " + no[-1] + ".",
    ]
    return "\n".join(parts)


def main():
    """한 번에: 1차 상세안·2차 정제(명세) → 요청문 만들기 → 점검 → 검토서. 실패해도 검토서는 쓰고, 요청 JSON은 통과할 때만 만든다."""
    spec_path = sys.argv[1]
    spec = json.load(open(spec_path, encoding='utf-8'))
    text = build(spec)
    from bg_check import check, cut_words, REVIEW_Q, load_prev
    fails, warns = check(spec, text, load_prev(spec_path))
    out = os.path.dirname(os.path.abspath(spec_path))
    br = spec.get('brief', {})
    L = [f"# 검토서 {spec['name']}", '', f"방 {spec.get('room')} · 분위기 {spec.get('mood')} · 문 {spec.get('doors')} · 원근 {spec['view']} · 바닥 {spec['floor_share']} · 양옆 {spec['sides']} · 채우기 {spec['density']}", '',
         '## 점검 결과', ''] + [f'- FAIL {f}' for f in fails] + [f'- WARN {w}' for w in warns] + (['- 통과'] if not fails and not warns else []) + \
        ['', '## 근거', '', f"- 위키: {br.get('wiki', '')}", f"- 설계안: {br.get('design', '')}"] + [f"- 사용자: {u}" for u in br.get('user', [])] + \
        ['', '## 설계안·위키 항목 대조', ''] + [f"- {b.get('src')} → " + (', '.join(f'{i}번' for i in b['by']) if isinstance(b.get('by'), list) else str(b.get('by'))) for b in br.get('items', [])] + \
        ['', '## 1차 상세안 → 2차 정제', '', '| # | 1차 (상세) | 근거 | 남길 낱말 | 2차 (실제) | 뺀 낱말(이유) |', '|---|---|---|---|---|---|']
    for i, it in enumerate(spec['items']):
        cut = cut_words(it.get('full', ''), (it.get('at') or '') + ' ' + it.get('text', '')); dok = {k.lower(): v for k, v in (it.get('drop_ok') or {}).items()}
        cs = '; '.join(w + '(' + str(dok.get(w, '**이유 없음**')) + ')' for w in cut)
        L.append(f"| {i} | {it.get('full')} | {it.get('why')} | {', '.join(it.get('keep', []))} | {(it.get('at') + ': ') if it.get('at') else ''}{it.get('text')} | {cs} |")
    rv = spec.get('review') or {}
    L += ['', '## 3차 자가 검토', ''] + [f"- {q}\n  - {rv.get(k) or '**답 없음**'}" for k, q in REVIEW_Q.items()]
    L += ['', f'## 2차 요청문 ({len(text)}자)', '', '```', text, '```']
    open(os.path.join(out, f"{spec['name']}_review.md"), 'w', encoding='utf-8').write('\n'.join(L) + '\n')
    for f in fails: print('FAIL', f)
    for w in warns: print('WARN', w)
    if fails: raise SystemExit(f"점검 실패 {len(fails)}건: 요청 JSON 안 만듦. 검토서 {spec['name']}_review.md")
    open(os.path.join(out, f"{spec['name']}_prompt.txt"), 'w', encoding='utf-8').write(text)
    req = json.load(open(os.path.join(ROOT, 'tools/pixellab/req/base_req.json')))
    req['description'] = text
    req['reference_images'] = req['reference_images'][:1]
    req['reference_images'][0]['usage_description'] = REF1_USAGE
    if '--no-ref1' in sys.argv: req['reference_images'] = []   # 참고 그림 1의 배치가 따라 들어와서 뺄 때(사용자 10-30 진료실 v4)
    if '--sketch' in sys.argv:
        i = sys.argv.index('--sketch'); p, usage = sys.argv[i + 1], sys.argv[i + 2]
        from PIL import Image
        w, h = Image.open(p).size
        req['reference_images'].append({'image': {'type': 'base64', 'base64': base64.b64encode(open(p, 'rb').read()).decode(), 'format': 'png'},
                                        'size': {'width': w, 'height': h}, 'usage_description': usage[:500]})
    json.dump(req, open(os.path.join(out, f"{spec['name']}_req.json"), 'w'))
    print(f"통과: {spec['name']} {len(text)}자, 물건 {len(spec['items'])}개, 참고 그림 {len(req['reference_images'])}장 → _prompt.txt, _req.json, _review.md")


if __name__ == '__main__':
    main()
