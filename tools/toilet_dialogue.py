"""화장실 침입 대사 칸 (toilet, 11-01): 검사·합치기.
칸: toilet.<소속 A00~E00·etc>.<friend·neutral·wary·hostile>.<intrude·stay1·stay2·same_open>, 칸마다 3줄. 조각에 든 칸만 검사·덧붙임.
규칙: 한 줄 한 문장, 쉼표 많아야 하나, 같은 파일 안 줄 겹침 없음, 층 숫자 없음, 주인공 호칭 없음.
사용법:
  python3 tools/toilet_dialogue.py check <조각.json> <대상 대사 파일.json>   # 조각 검사
  python3 tools/toilet_dialogue.py merge <조각 폴더>                         # 조각을 대사 파일 toilet 칸으로 넣기
조각 파일 이름 = 대상 대사 파일 이름(characters/쟈알디.json → 쟈알디.json, npc/경비_여.json → 경비_여.json).
"""
import json, re, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'game-src/dialogue2'
FACS = ['A00', 'B00', 'C00', 'D00', 'E00', 'etc']
REPS = ['friend', 'neutral', 'wary', 'hostile']
SLOTS_ALL = ['intrude', 'stay1', 'stay2', 'same_open']  # same_open: 같은 성별 주인공이 밖에서 칸 문을 엶 (11-01 사용자)
ADDR = re.compile(r'(선배|후배님|요원님|씨[,!?. ]|씨$|님[,!?. ]|님$|손님|고객님|자기야|아가씨|총각|형씨|언니|오빠|누나|형님)')


def lines_of(x):
    if isinstance(x, str): yield x
    elif isinstance(x, list):
        for v in x: yield from lines_of(v)
    elif isinstance(x, dict):
        for k, v in x.items():
            if k not in ('name', 'faction', 'sex'): yield from lines_of(v)


def target(name):
    for sub in ('characters', 'npc'):
        p = SRC / sub / f'{name}.json'
        if p.exists(): return p
    raise SystemExit(f'대상 파일 없음: {name}')


def check(frag, tgt):
    probs = []
    SLOTS = [k for k in SLOTS_ALL if k in frag.get('A00', {}).get('friend', {})]
    if sorted(frag) != sorted(FACS): probs.append(f'소속 키 {sorted(frag)}')
    old = set(lines_of(json.loads(tgt.read_text(encoding='utf-8'))))
    seen = {}
    for fac in FACS:
        for rep in REPS:
            for slot in SLOTS:
                p = f'{fac}.{rep}.{slot}'
                ls = frag.get(fac, {}).get(rep, {}).get(slot)
                if not isinstance(ls, list) or len(ls) != 3:
                    probs.append(f'{p}: 3줄 아님'); continue
                for s in ls:
                    if not isinstance(s, str) or not s.strip(): probs.append(f'{p}: 빈 줄'); continue
                    if re.findall(r'[.?!]', s.rstrip('.?!…~')): probs.append(f'{p}: 여러 문장 「{s}」')
                    if s.count(',') > 1: probs.append(f'{p}: 쉼표 {s.count(",")}개 「{s}」')
                    if re.search(r'\d+ ?층|[일이삼사오]층', s): probs.append(f'{p}: 층 숫자 「{s}」')
                    if ADDR.search(s): probs.append(f'{p}: 호칭? 「{s}」')
                    if s in old: probs.append(f'{p}: 기존 줄과 겹침 「{s}」')
                    if s in seen: probs.append(f'{p}: {seen[s]}와 겹침 「{s}」')
                    seen[s] = p
    return probs


def main():
    cmd, *a = sys.argv[1:]
    if cmd == 'check':
        frag = json.loads(Path(a[0]).read_text(encoding='utf-8'))
        probs = check(frag, Path(a[1]))
        print(*(probs or ['문제 없음']), sep='\n')
        sys.exit(1 if probs else 0)
    if cmd == 'merge':
        bad = 0
        for f in sorted(Path(a[0]).glob('*.json')):
            frag = json.loads(f.read_text(encoding='utf-8'))
            tgt = target(f.stem)
            probs = check(frag, tgt)
            if probs:
                bad += 1; print(f.stem, *probs, sep='\n  '); continue
            raw = tgt.read_text(encoding='utf-8')
            d = json.loads(raw)
            out = {}
            for k, v in d.items():
                if k == 'toilet': continue
                out[k] = v
                if k == 'shower': out['toilet'] = d.get('toilet', {})
            out.setdefault('toilet', d.get('toilet', {}))
            for fac in FACS:
                for rep in REPS:
                    out['toilet'].setdefault(fac, {}).setdefault(rep, {}).update(frag[fac][rep])
            tgt.write_text(json.dumps(out, ensure_ascii=False, indent=1) + ('\n' if raw.endswith('\n') else ''), encoding='utf-8')
            print(f.stem, '넣음')
        sys.exit(1 if bad else 0)


main()
