"""배경 요청 명세 점검. 0번 규칙: 물건은 빼지 않는다(앞 판 대조·removed_items·글자 수 때문인 omit은 실패)
 (docs/배경_생성_공용지침.md). bg_prompt.py가 만들기 전에 반드시 돌린다(실패하면 만들지 않음).

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
  10 정제: 1차(full)에서 2차(text)로 줄이며 뺀 낱말마다 drop_ok {낱말: 이유}가 없으면 실패
  11 대조: brief.items [{src: 설계안·위키 항목, by: [물건 줄 번호] | "omit: 이유"}] 없거나 빈 항목이면 실패
  13 자리 말: full에 있는 벽·바닥·천장·앞뒤 말(LOC_PHRASES)은 text에서 못 뺌, 「left:」「right:」처럼 모호한 자리는 실패
  12 3차: review {fit, place, size, brief, meaning, over, frame} 자가 검토 답이 없으면 실패
"""
import json, os, re, sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB = json.load(open(os.path.join(ROOT, 'tools/pixellab/room_items.json'), encoding='utf-8'))
DIRT = ['dirty', 'dust', 'grime', 'stain', 'rust', 'trash', 'litter', 'mold', 'filthy']
STOP = set('a an the of and with on in at to its it is as by for from one two left right back front wall side'.split())


# 자리·연결 말(뜻 없는 군말). 물건·재질·색·크기 낱말은 여기 넣지 않는다 → 빼면 이유를 적어야 함
FILLER = set('a an the of and with on in at to its it is as by for from into onto about some each both side sides part '
             'room directly against next beside above below under over through top bottom front back left right center '
             'standing facing hanging holding showing laid out its their this that'.split())


LOC_PHRASES = ['back wall', 'left wall', 'right wall', 'side wall', 'floor', 'ceiling', 'corner', 'in front of', 'behind']


def cut_words(full, text):
    tl = text.lower(); out = []
    for w in re.findall(r"[a-z][a-z\-]*", full.lower()):
        if w in FILLER or len(w) < 3 or w in tl or w.rstrip('s') in tl: continue
        if w not in out: out.append(w)
    return out


# 3차 자가 검토: 2차 요청문을 다 쓴 뒤 내가 직접 읽고 칸마다 답한다(spec.review). 빈 답·짧은 답이면 실패
REVIEW_Q = {
    'fit': '이 방에 안 맞는 물건이 2차 문장에 있나? 줄마다 확인한 결과',
    'place': '손님 물건이 직원 쪽에 있거나, 캐릭터가 못 다가가는 자리에 꼭 필요한 것이 있나?',
    'size': '큰 가구·문 크기가 서 있는 사람 150px(에일린) 기준으로 맞나? 숫자로',
    'brief': '위키·설계안·사용자 결정 중 빠진 것이 있나? 있으면 왜 뺐나',
    'meaning': '2차로 줄이며 1차 뜻이 바뀌거나 중요한 세부(기구·재질·잠금 등)가 빠졌나?',
    'over': '이유 없는 채움 물건·같은 물건 두 번·쓸데없이 긴 설명이 있나?',
    'frame': '원근·바닥 몫·양옆 벽·문·채우기가 이 장면에 정한 대로인가?',
}


def load_prev(spec_path):
    """같은 폴더에서 바로 앞 판 명세(이름_v<n> 중 n이 가장 큰 아래 판)를 찾는다. 없으면 None."""
    d, f = os.path.split(os.path.abspath(spec_path)); m = re.match(r'(.+)_v(\d+)\.json$', f)
    if not m: return None
    olds = sorted((int(g.group(1)), g.group(0)) for g in (re.match(rf'{re.escape(m.group(1))}_v(\d+)\.json$', x) for x in os.listdir(d)) if g and int(g.group(1)) < int(m.group(2)))
    return json.load(open(os.path.join(d, olds[-1][1]), encoding='utf-8')) if olds else None


def obj_words(it):
    # 물건 낱말: keep 중 자리·크기·꼴 말이 아닌 것
    return {k.lower() for k in it.get('keep', []) if not re.search(r'wall|floor|ceiling|front|behind|side|left|right|\d|closed|facing|same|high|one$|away|between', k.lower())}


def check(spec, prompt, prev=None):
    fails, warns = [], []
    # 0 물건은 빼지 않는다 (사용자 10-30: 「다시는 물건을 빼지 마라」). 2,000자는 군말을 줄여 맞춘다
    if spec.get('removed_items'): fails.append(f'물건을 뺌(removed_items): {list(spec["removed_items"])} — 물건은 빼지 않는다, 군말을 줄일 것')
    for b in spec.get('brief', {}).get('items', []):
        if isinstance(b.get('by'), str) and b['by'].startswith('omit:') and re.search(r'2000|2,000|글자|자 수|길이', b['by']): fails.append(f'글자 수 때문에 설계안 항목을 뺌: {b.get("src")} — 물건은 빼지 않는다')
    if prev:
        new_words = set().union(*[obj_words(it) for it in spec.get('items', []) if isinstance(it, dict)]) if spec.get('items') else set()
        new_fulls = {it.get('full') for it in spec.get('items', []) if isinstance(it, dict)}
        old_items = [it for it in prev.get('items', []) if isinstance(it, dict)] + [{'full': k} for k in (prev.get('removed_items') or {})]
        for it in old_items:
            if it.get('full') in new_fulls: continue
            ow = obj_words(it)
            if not ow or not any(any(w in nw or nw in w for nw in new_words) for w in ow): fails.append(f'앞 판({prev.get("name")})에 있던 물건을 뺌: {it.get("text") or it.get("full")} — 물건은 빼지 않는다')
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
            if kw.lower() not in ((it.get('at') or '') + ' ' + (it.get('text') or '')).lower(): fails.append(f'정제하다 빠짐 "{kw}": {it.get("text")}')
        # 자리 말(어느 벽·바닥·천장)은 이유를 적어도 못 뺀다 (진료실 v3·v4: 「on the back wall」을 빼서 엑스레이가 왼벽, 주삿바늘 상자가 바닥으로)
        fl, tl2 = (it.get('full') or '').lower(), ((it.get('at') or '') + ' ' + (it.get('text') or '')).lower()   # at(자리 묶음 머리)도 그 줄의 말
        for ph in LOC_PHRASES:
            if re.search(rf'\b{ph}\b', fl) and not re.search(rf'\b{ph}\b', tl2): fails.append(f'자리 말 "{ph}"을 뺌(못 뺌): {it.get("text")}')
        if not it.get('at') and re.match(r'^(left|right|center|middle)\s*:', tl2.strip()): fails.append(f'자리가 모호함(벽인지 바닥인지): "{tl2.split(":")[0]}:" → "against the left wall" / "on the floor at left, ..." 처럼: {it.get("text")}')
        # 줄이며 뺀 낱말: 하나하나 빼도 되는 이유(drop_ok: {낱말: 이유})가 있어야 함
        cut = cut_words(it.get('full', ''), (it.get('at') or '') + ' ' + it.get('text', ''))
        ok = {k.lower(): v for k, v in (it.get('drop_ok') or {}).items() if str(v).strip()}
        bad = [w for w in cut if w not in ok]
        if bad: fails.append(f'이유 없이 뺀 낱말 {bad}: {it.get("text")}')
    texts = [(it['text'] if isinstance(it, dict) else it) for it in items]
    # 1-0 설계안·위키 항목 대조: brief.items = [{"src": "원문 항목", "by": [물건 줄 번호(0부터)] 또는 "omit: 이유"}]
    bi = spec.get('brief', {}).get('items')
    if bi is None: fails.append('brief.items(설계안·위키 항목 목록과 맡는 줄)가 없음')
    for b in bi or []:
        by = b.get('by')
        if isinstance(by, str) and by.startswith('칸:'):   # 물건 줄이 아니라 floor·walls·light 같은 칸이 맡음 → 그 칸에 그 낱말이 실제로 있어야 함
            f, _, kw = by[2:].strip().partition(' ')
            if kw.strip().lower() not in str(spec.get(f, '')).lower(): fails.append(f'설계안 항목 "{b.get("src")}": {f} 칸에 "{kw.strip()}" 없음')
        elif isinstance(by, str):
            if not by.startswith('omit:') or len(by) < 8: fails.append(f'설계안 항목을 이유 없이 뺌: {b.get("src")}')
        elif not by or any((not isinstance(i, int)) or i >= len(items) for i in by): fails.append(f'설계안 항목을 맡는 물건 줄이 없음: {b.get("src")}')
    # 1 빠뜨림
    for m in spec.get('must', []):
        if m['kw'].lower() not in low: fails.append(f'빠뜨림: "{m["kw"]}" ({m.get("from", "")})')
    # 2 엉뚱함
    for w in DB['global_not']:
        for t in texts:
            if w in t.lower(): fails.append(f'금지 물건 "{w}": {t}')
    for w in DB['rooms'].get(room, {}).get('not_here', []):
        if w in low: fails.append(f'이 방({room})에 있으면 안 됨: "{w}"')
    # 2-1 사람 부르는 말: 「staff behind it」「patient side」 같은 말이 있으면 No people이 있어도 사람이 그려짐(대기실 v6: 접수대 뒤에 사람)
    for it in items:
        if not isinstance(it, dict): continue
        tt = ((it.get('at') or '') + ' ' + (it.get('text') or '')).lower()
        for w in DB.get('people_words', []):
            if re.search(rf"\b{w}\b", tt): fails.append(f'사람을 부르는 말 "{w}"(사람이 그려짐, room side·empty walkway처럼): {tt.strip()}')
    # 2-2 간판: 글씨를 지어내 엉터리 한글이 나옴(대기실 v6 「킨료정」) → 글씨 없는 그림 표시로
    for t in texts:
        if re.search(r'\bsign\b|signboard|sign board', t.lower()) and 'no letters' not in t.lower() and not re.search(r'reading "[^"]+"', t): fails.append(f'간판에 글씨가 지어내짐 → "no letters"와 그림 표시, 또는 정확한 글자(reading "OPEN")를 적을 것: {t}')
    # 4 크기
    sized = [s.lower() for s in spec.get('sized', [])]
    for t in texts:
        nums = re.findall(r'(\d+)\s*(?:by\s*(\d+)\s*)?pixels?(?:\s*(tall|long|wide))?', t)
        if not nums: continue
        if not any(s in t.lower() for s in sized): fails.append(f'크기 숫자는 큰 가구·문만(sized): {t}')
        tl = t.lower()
        for m in re.finditer(r'(\d+)\s*(?:by\s*(\d+)\s*)?pixels?(?:\s*(tall|long|wide))?', tl):
            # 숫자 바로 앞에 나온 가구 낱말만 그 숫자의 주인 (문 줄에 「away from the counter」가 있어도 counter 크기로 재지 않음)
            before = {k: tl.rfind(k, 0, m.start()) for k in DB['sizes']}
            key = max(before, key=before.get)
            if before[key] < 0: continue
            lo, hi = DB['sizes'][key]
            for a, b, unit in [m.groups()]:
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
            if re.search(rf'\b{w}', low): warns.append(f'깨끗한 방인데 더러움 낱말: {w}')
    # 9 틀
    if not re.search(r'shadow', spec.get('shadow', '').lower()): fails.append('명암 칸에 그림자(shadow)가 없음')
    if not re.search(r'light|shadow|glow|pool', spec.get('floor', '').lower()): warns.append('바닥 칸에 빛·그림자 없음')
    if len(prompt) > 2000: fails.append(f'{len(prompt)}자 > 2000')
    # 10 3차 자가 검토
    rv = spec.get('review') or {}
    for k, q in REVIEW_Q.items():
        if len(str(rv.get(k, '')).strip()) < 10: fails.append(f'3차 검토 답 없음 review.{k}: {q}')
    return fails, warns


def report(spec, prompt, prev=None):
    fails, warns = check(spec, prompt, prev)
    print(f'== 점검: {spec.get("name")} ({len(prompt)}자, 물건 {len(spec.get("items", []))}줄)')
    for f in fails: print('FAIL', f)
    for w in warns: print('WARN', w)
    if not fails and not warns: print('통과')
    return not fails


if __name__ == '__main__':
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from bg_prompt import build
    spec = json.load(open(sys.argv[1], encoding='utf-8'))
    ok = report(spec, build(spec), load_prev(sys.argv[1]))
    sys.exit(0 if ok else 1)
