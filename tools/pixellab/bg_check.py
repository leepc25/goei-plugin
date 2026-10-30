"""배경 요청 명세 점검 (docs/배경_생성_공용지침.md). bg_prompt.py가 만들기 전에 반드시 돌린다(실패하면 만들지 않음).

장면 명세(JSON)에 아래를 더 적는다:
  room        방 종류: waiting_room | exam_room | operating_room | shop | office | corridor   (tools/pixellab/room_items.json)
  brief       근거 문서: {"wiki": "위키 문단 원문", "design": "설계안 문단 원문", "user": ["사용자 결정 1", ...]}
  must        반드시 들어가야 할 것(위키·설계안·사용자 결정에서): [{"kw": "찾을 낱말", "from": "근거"}]
  mood        "clean" | "worn"  (clean이면 더러움 낱말을 경고)
  doors       그릴 문 수 (0이면 문 낱말 금지)
  items       [{"text": "자리 말 + 물건", "why": "넣는 근거(위키/설계안/방의 쓰임/사용자)"}, ...]   ← why 없으면 실패
  sized       픽셀 크기를 적어도 되는 물건 낱말들 (큰 가구·문만). 나머지 물건에 숫자가 있으면 실패

점검 (실패 = FAIL, 확인 필요 = WARN):
  1 빠뜨림: must 낱말이 요청문에 없음
  2 엉뚱함: 이 방에 있으면 안 되는 물건(room_items.json), 전역 금지(의자·시계·누수·커튼 레일·사람)
  3 근거 없음: why가 빈 물건
  4 크기: 숫자 크기가 사람 150px 기준 상식 범위를 벗어남 / sized 밖 물건에 숫자
  5 자리: 손님 물건이 직원 쪽(접수대 뒤 등)에 있음, 자리 말 없음
  6 문: doors와 문 언급 수가 다름
  7 오버: 한 물건 설명이 18낱말 초과, 같은 낱말 반복 4번 이상, 같은 물건 두 번
  8 분위기: clean인데 더러움 낱말
  9 틀: 명암(shadow) 칸에 그림자 낱말 없음, 바닥에 빛·그림자 없음, 2,000자 초과
"""
import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = json.load(open(os.path.join(ROOT, 'tools/pixellab/room_items.json'), encoding='utf-8'))
DIRT = ['dirty', 'dust', 'grime', 'stain', 'rust', 'trash', 'litter', 'mold', 'filthy']
STOP = set('a an the of and with on in at to its it is as by for from one two left right back front wall side'.split())


def check(spec, prompt):
    fails, warns = [], []
    low = prompt.lower()
    room = spec.get('room')
    if room not in DB['rooms']: fails.append(f'room 칸이 없거나 모름: {room}')
    for k in ('brief', 'must', 'mood', 'doors', 'sized'):
        if k not in spec: fails.append(f'{k} 칸이 없음')
    items = spec.get('items', [])
    # 3 근거 (1차 상세안: full·why·keep 필수, 2차: text)
    for it in items:
        if not isinstance(it, dict): fails.append(f'물건은 {{full, why, keep, text}} 형식이어야 함: {it}'); continue
        name = it.get('text') or it.get('full')
        for k in ('full', 'why', 'keep', 'text'):
            if not it.get(k): fails.append(f'1차/2차 칸 {k} 없음: {name}')
        # 정제 점검: keep 낱말이 2차 문장에 남았는지
        for kw in it.get('keep', []):
            if kw.lower() not in (it.get('text') or '').lower(): fails.append(f'정제하다 빠짐 "{kw}": {it.get("text")}')
    texts = [(it['text'] if isinstance(it, dict) else it) for it in items]
    # 1 빠뜨림
    for m in spec.get('must', []):
        if m['kw'].lower() not in low: fails.append(f'빠뜨림: "{m["kw"]}" ({m.get("from", "")})')
    # 2 엉뚱함
    for w in DB['global_not']:
        for t in texts:
            if w in t.lower(): fails.append(f'금지 물건 "{w}": {t}')
    for w in DB['rooms'].get(room, {}).get('not_here', []):
        if w in low: fails.append(f'이 방({room})에 있으면 안 됨: "{w}"')
    # 4 크기
    sized = [s.lower() for s in spec.get('sized', [])]
    for t in texts:
        nums = re.findall(r'(\d+)\s*(?:by\s*(\d+)\s*)?pixels?(?:\s*(tall|long|wide))?', t)
        if not nums: continue
        if not any(s in t.lower() for s in sized): fails.append(f'크기 숫자는 큰 가구·문만(sized): {t}')
        for key, (lo, hi) in DB['sizes'].items():
            if key in t.lower():
                for a, b, unit in nums:
                    h = int(b) if b else int(a)   # "A by B" 는 B가 높이(가구 길이×높이) 또는 높이×폭 — 둘 중 큰 쪽이 높이인 문은 따로
                    if key == 'door' or key in ('fridge', 'refrigerator'): h = max(int(a), int(b or 0))
                    if unit == 'long' or unit == 'wide': continue
                    if not lo <= h <= hi: fails.append(f'크기 {key} {h}px: 사람 150px 기준 {lo}~{hi}px 밖: {t}')
    # 5 자리
    for t in texts:
        tl = t.lower()
        if any(v in tl for v in DB['visitor_things']) and any(s in tl for s in DB['staff_place_words']):
            fails.append(f'손님 물건이 직원 쪽에: {t}')
    # 6 문
    n_door = len(re.findall(r'\bdoors?\b', ' '.join(texts).lower()))
    if spec.get('doors') == 0 and n_door: fails.append(f'문 0개로 정했는데 물건에 문이 {n_door}번 나옴')
    if spec.get('doors', 0) > 0 and n_door < spec['doors']: fails.append(f'문 {spec["doors"]}개인데 {n_door}번만 나옴')
    # 7 오버
    for t in texts:
        if len(t.split()) > 18: warns.append(f'설명이 김({len(t.split())}낱말): {t}')
    words = [w for w in re.findall(r'[a-z]+', ' '.join(texts).lower()) if w not in STOP and len(w) > 3]
    for w, c in Counter(words).items():
        if c >= 4: warns.append(f'같은 낱말 {c}번: {w}')
    heads = [re.sub(r'^(center:|on the [a-z ]+? |at the [a-z ]+? |in the [a-z ]+? |next to [a-z ]+? |beside [a-z ]+? |above [a-z ]+? |left of [a-z ]+? |right of [a-z ]+? )', '', t.lower())[:25] for t in texts]
    for h, c in Counter(heads).items():
        if c > 1: warns.append(f'같은 물건 두 번?: {h}')
    # 8 분위기
    if spec.get('mood') == 'clean':
        for w in DIRT:
            if w in low: warns.append(f'깨끗한 방인데 더러움 낱말: {w}')
    # 9 틀
    if not re.search(r'shadow', spec.get('shadow', '').lower()): fails.append('명암 칸에 그림자(shadow)가 없음')
    if not re.search(r'light|shadow|glow|pool', spec.get('floor', '').lower()): warns.append('바닥 칸에 빛·그림자 없음')
    if len(prompt) > 2000: fails.append(f'{len(prompt)}자 > 2000')
    return fails, warns


def report(spec, prompt):
    fails, warns = check(spec, prompt)
    print(f'== 점검: {spec.get("name")} ({len(prompt)}자, 물건 {len(spec.get("items", []))}줄)')
    for f in fails: print('FAIL', f)
    for w in warns: print('WARN', w)
    if not fails and not warns: print('통과')
    return not fails


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from bg_prompt import build
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    ok = report(spec, build(spec))
    sys.exit(0 if ok else 1)
