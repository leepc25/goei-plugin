#!/usr/bin/env python3
"""소지품 그림 표의 윗말(상위 말)을 채우고 검사한다. 규칙: docs/물건그림_윗말_규칙.md

  python3 tools/icon_upper.py            검사만 (표를 바꾸지 않음)
  python3 tools/icon_upper.py --apply    game-src/items/upper/*.txt 의 윗말을 표의 up 칸에 적고 윗말의 대표 그림(head_rep)을 정함

매칭기는 윗말을 head_rep 으로만 찾는다(윗말 → 대표 그림 한 장). up 칸은 어느 그림이 어느 윗말에 드는지 적어 둔 기록이라
매칭에 쓰이지 않는다 — head 에 윗말을 넣으면 「봉지라면 → 짜왕」처럼 끝 글자만 같은 이름이 그 무리 아무 그림에나 붙는다.

윗말 표(upper/종류.txt) 한 줄: 「넓은 윗말 > 가까운 윗말: 이름 이름 …」 또는 「윗말: 이름 …」. 대표로 삼을 이름 앞에 * .
이름의 띄어쓰기는 _ 로 적는다. 표에 있는 것은 지우지 않고 덧붙이기만 한다.
"""
import json, re, sys, glob, os, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TABLE = os.path.join(ROOT, 'game-src/items/icons.json')
UPPER = os.path.join(ROOT, 'game-src/items/upper')
SPECIAL = {'adult', 'body', 'anomaly'}  # 보통 윗말의 대표가 될 수 없는 종류
GENERIC = {'키트', '세트', '장치', '도구', '기계', '용품', '물품', '물건', '패키지', '묶음', '상자'}  # 매칭기 GENERIC 의 한글 (윗말로 못 씀)
KO = re.compile('[가-힣]')


def read_upper():
    """→ [(종류, 넓은 윗말|None, 가까운 윗말, [(이름, 대표?)])]"""
    out = []
    for path in sorted(glob.glob(os.path.join(UPPER, '*.txt'))):
        kind = os.path.basename(path)[:-4]
        if kind.startswith('_'):
            continue
        for n, line in enumerate(open(path, encoding='utf-8'), 1):
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if ':' not in line:
                sys.exit(f'{path}:{n} 「:」가 없음')
            left, right = line.split(':', 1)
            ups = [x.strip() for x in left.split('>')]
            if len(ups) > 2 or not all(ups):
                sys.exit(f'{path}:{n} 윗말은 두 단계까지')
            wide, near = (ups[0], ups[1]) if len(ups) == 2 else (None, ups[0])
            members = [(m.lstrip('*').replace('_', ' '), m.startswith('*')) for m in right.split()]
            out.append((kind, wide, near, members))
    return out


def read_rep():
    """upper/_rep.txt → {윗말: 대표로 삼을 그림 이름}"""
    out = {}
    path = os.path.join(UPPER, '_rep.txt')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and ':' in line:
                u, n = line.split(':', 1)
                out[u.strip()] = n.strip()
    return out


def main():
    apply = '--apply' in sys.argv
    table = json.load(open(TABLE, encoding='utf-8'))
    rows = [r for r in table['icons'] if not r.get('excluded_note')]
    rep = table['head_rep']
    by_name = collections.defaultdict(list)
    for r in rows:
        by_name[r['name']].append(r)
    plain_named = {}  # 이름이 그 말 그대로인 보통 그림
    for r in rows:
        if r['kind'] not in SPECIAL:
            plain_named.setdefault(r['name'], r)
    for r in rows:  # 이름이 없으면 다른 이름(keywords)이 그 말 그대로인 그림 (라면 → 라면 봉지)
        if r['kind'] not in SPECIAL:
            for k in r.get('keywords') or []:
                if KO.search(k):
                    plain_named.setdefault(k, r)
    upper = read_upper()
    rep_name = read_rep()
    problems = collections.defaultdict(list)
    added = 0
    members_of = collections.defaultdict(list)  # 윗말 → [(줄, 대표?)]
    seen = set()

    def pick(kind, name):
        cands = by_name.get(name, [])
        same = [r for r in cands if r['kind'] == kind]
        return same or cands

    for kind, wide, near, members in upper:
        for u in (wide, near):
            if u and (u in GENERIC or u.split()[-1] in GENERIC):
                problems['군말을 윗말로 씀'].append(f'{kind}: {u}')
        for name, star in members:
            hit = pick(kind, name)
            if not hit:
                problems['윗말 표에 있는데 그림 표에 없는 이름'].append(f'{kind}: {name}')
                continue
            for r in hit:
                seen.add(id(r))
                up = r.setdefault('up', [])
                for u in (near, wide):
                    if u and u != r['name']:
                        members_of[u].append((r, star and u == near))
                        if u not in up:
                            up.append(u)
                            added += 1

    # 윗말마다 대표: ① 이름이 그 말 그대로인 보통 그림 ② 표에 * 로 찍은 것 ③ 이미 정해진 것 ④ 없음(검사에 나옴)
    rep_set = 0
    for u, ms in members_of.items():
        want = None
        if u in plain_named and u not in rep_name:
            want = plain_named[u]['file']
        else:
            star = [r for r, s in ms if s]
            named = by_name.get(rep_name.get(u, ''), [])
            if u in rep_name and not named:
                problems['대표 표(_rep.txt)의 이름이 그림 표에 없음'].append(f'{u}: {rep_name[u]}')
            if star:
                want = star[0]['file']
            elif named:
                want = sorted(named, key=lambda r: r['kind'] in SPECIAL)[0]['file']
        if want and rep.get(u) != want:
            if u in rep:
                problems['대표 그림을 바꿈'].append(f'{u}: {rep[u]} → {want}')
            rep[u] = want
            rep_set += 1
        if u not in rep:
            problems['대표 없는 윗말'].append(f'{u} ({len(ms)}줄): ' + ' '.join(r['name'] for r, _ in ms[:6]))

    # 대표 표에만 있는 말(윗말 표에 무리가 없는 몸통 말: 재킷)도 대표로 넣는다
    for u, nm in rep_name.items():
        if u in members_of:
            continue
        named = by_name.get(nm, [])
        if not named:
            problems['대표 표(_rep.txt)의 이름이 그림 표에 없음'].append(f'{u}: {nm}')
        elif rep.get(u) != named[0]['file']:
            rep[u] = named[0]['file']
            rep_set += 1

    kind_of = {r['file']: r['kind'] for r in rows}
    name_of = {r['file']: r['name'] for r in rows}
    for u, f in list(rep.items()):
        if KO.search(u) and kind_of.get(f) in SPECIAL and u in plain_named:
            problems['대표가 성인·신체·괴이 그림이라 그 말 그대로인 보통 그림으로 바꿈'].append(f'{u}: {f} {name_of.get(f)} → {plain_named[u]["file"]}')
            rep[u] = plain_named[u]['file']

    # 윗말 없는 줄: 한 낱말 이름인데 윗말 표에도 없고, 스스로 윗말도 아니고, head 에 이름 말고 다른 한글 말이 없음
    uppers = set(members_of) | {u for u in rep}
    for r in rows:
        if id(r) in seen or ' ' in r['name'] or r['name'] in uppers:
            continue
        kws = {k.lower() for k in r.get('keywords') or []}
        if r.get('up') or any(KO.search(h) and h.lower() not in kws for h in r.get('head') or []):
            continue
        problems['윗말 없는 한 낱말 이름'].append(f'{r["kind"]}: {r["name"]}')

    for k, v in problems.items():
        print(f'\n■ {k} — {len(v)}')
        for x in v[:400]:
            print('  ', x)
    print(f'\n윗말 {len(members_of)}개, up 칸에 적은 윗말 {added}개, 대표 지정 {rep_set}개')
    if apply:
        json.dump(table, open(TABLE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('표에 썼음:', TABLE)
    else:
        print('(검사만 했음. 표에 넣으려면 --apply)')


if __name__ == '__main__':
    main()
