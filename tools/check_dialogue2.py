"""새 대사 자료 검사 (game-src/dialogue2/characters/*.json, 10-31).
한 줄 = 한 문장(말풍선 하나), 같은 줄 돌려 쓰기 금지(인물 파일 안), 칸마다 후보 6줄, 다나까체 인물은 반말 끝 금지(--danakka 인물 이름).
사용법: python3 tools/check_dialogue2.py [--danakka 쟈알디,...]
"""
import json, re, sys
from collections import Counter
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
danakka = set(sys.argv[sys.argv.index('--danakka') + 1].split(',')) if '--danakka' in sys.argv else set()
bad = 0
for f in sorted((ROOT / 'game-src/dialogue2/characters').glob('*.json')):
    d = json.loads(f.read_text(encoding='utf-8'))
    L, pools = [], []
    def walk(x, p=''):
        if isinstance(x, list):
            if all(isinstance(v, str) for v in x): pools.append((p, x))
            for v in x: walk(v, p)
        elif isinstance(x, dict):
            for k, v in x.items():
                if k in ('name', 'faction'): continue
                walk(v, p + '.' + k)
        elif isinstance(x, str): L.append((p, x))
    walk(d)
    probs = []
    probs += [f'겹침: {s}' for s, n in Counter(s for _, s in L).items() if n > 1]
    probs += [f'여러 문장 {p}: {s}' for p, s in L if re.findall(r'[.?!]', s.rstrip('.?!…'))]
    probs += [f'후보 {len(x)}줄 {p}' for p, x in pools if len(x) != 6]
    if d.get('name') in danakka:
        probs += [f'반말 {p}: {s}' for p, s in L if re.search(r'(해|야|어|줘|봐|거야|게|래|니|렴|자)[.?!]?$', s) and not re.search(r'(해라|봐라|하자)[.?]?$', s)]
    size = len(json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode())
    print(f'{d.get("name")}: {len(L)}줄, {size / 1024:.1f}KB', *(probs or ['문제 없음']), sep='\n  ')
    bad += len(probs)
sys.exit(1 if bad else 0)
