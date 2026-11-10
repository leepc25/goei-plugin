#!/usr/bin/env python3
"""소지품 그림 표의 윗말(상위 말)을 채우고 검사한다. 규칙: docs/물건그림_윗말_규칙.md

  python3 tools/icon_upper.py            검사만 (표를 바꾸지 않음)
  python3 tools/icon_upper.py --apply    game-src/items/upper/*.txt 의 윗말을 표의 up 칸에 적고 윗말의 대표 그림(head_rep)을 정함

매칭기는 윗말을 head_rep 으로만 찾는다(윗말 → 대표 그림 한 장). up 칸은 어느 그림이 어느 윗말에 드는지 적어 둔 기록이라
매칭에 쓰이지 않는다 — head 에 윗말을 넣으면 「봉지라면 → 짜왕」처럼 끝 글자만 같은 이름이 그 무리 아무 그림에나 붙는다.

윗말 표(upper/종류.txt) 한 줄: 「넓은 윗말 > 가까운 윗말: 이름 이름 …」 또는 「윗말: 이름 …」. 대표로 삼을 이름 앞에 * .
이름의 띄어쓰기는 _ 로 적는다. 표에 있는 것은 지우지 않고 덧붙이기만 한다.
"""
import json
import re, re, sys, glob, os, collections

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
    # 그림 줄에 덧붙이는 것: 몸통 말(_head.txt)·다른 이름(_keywords.txt)·종류 옮기기(_kind.txt)
    def pairs(fname):
        path = os.path.join(UPPER, fname)
        if not os.path.exists(path):
            return
        for line in open(path, encoding='utf-8'):
            line = line.strip()
            if line and not line.startswith('#') and ':' in line:
                a, b = line.split(':', 1)
                yield a.strip(), [x.strip() for x in b.split(',') if x.strip()]
    extra = 0
    for fname, col in (('_head.txt', 'head'), ('_keywords.txt', 'keywords')):
        for nm, words in pairs(fname) or []:
            if nm not in by_name:
                problems[f'{fname} 의 이름이 그림 표에 없음'].append(nm)
            for r in by_name.get(nm, []):
                for w in words:
                    if w not in r.setdefault(col, []):
                        r[col].append(w)
                        extra += 1
    for nm, words in pairs('_kind.txt') or []:
        if nm not in by_name:
            problems['_kind.txt 의 이름이 그림 표에 없음'].append(nm)
        for r in by_name.get(nm, []):
            if r['kind'] != words[0]:
                r['kind'] = words[0]
                extra += 1
    plain_named.clear()
    for r in rows:
        if r['kind'] not in SPECIAL:
            plain_named.setdefault(r['name'], r)
    for r in rows:
        if r['kind'] not in SPECIAL:
            for k in r.get('keywords') or []:
                if KO.search(k):
                    plain_named.setdefault(k, r)
    rep_name = read_rep()
    problems = collections.defaultdict(list)
    added = 0
    for r in rows:  # up 칸은 매번 윗말 표에서 새로 만든다 (표에서 옮기거나 뺀 것이 남지 않게)
        r.pop('up', None)
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

    # 이름이 여러 낱말인 그림: 끝 낱말이 윗말 표의 이름·윗말이면 그 윗말을 물려받고, 아니면 _tail.txt 의 끝 낱말 줄
    up_of_name = {}   # 윗말 표의 이름 → [가까운, 넓은]
    wide_of = {}      # 윗말 → 넓은 윗말
    for kind, wide, near, members in upper:
        if wide:
            wide_of.setdefault(near, wide)
        for name, _ in members:
            up_of_name.setdefault(name, [u for u in (near, wide) if u])
    tails = {}
    tpath = os.path.join(UPPER, '_tail.txt')
    if os.path.exists(tpath):
        for line in open(tpath, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or ':' not in line:
                continue
            left, right = line.split(':', 1)
            ups = [x.strip() for x in left.split('>')]
            wide, near = (ups[0], ups[1]) if len(ups) == 2 else (None, ups[0])
            for w in right.split():
                tails.setdefault(w, [u for u in (near, wide) if u])
    known_upper = set(members_of) | set(wide_of) | set(wide_of.values())
    none = set()
    npath = os.path.join(UPPER, '_none.txt')
    if os.path.exists(npath):
        none = {l.strip() for l in open(npath, encoding='utf-8') if l.strip() and not l.startswith('#')}
    for r in rows:
        if id(r) in seen or ' ' not in r['name']:
            continue
        w = r['name'].split()[-1]
        if w in tails:
            ups = tails[w]
        elif w in up_of_name:
            ups = [w] + up_of_name[w]
        elif w in known_upper or w in rep or w in by_name:
            ups = [w] + ([wide_of[w]] if w in wide_of else [])
        elif r['name'] in none:
            continue
        else:
            problems['윗말 없는 여러 낱말 이름'].append(f'{r["kind"]}: {r["name"]}')
            continue
        seen.add(id(r))
        up = r.setdefault('up', [])
        for u in ups[:2]:
            if u != r['name']:
                members_of[u].append((r, False))
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
            elif not named and u in by_name:  # 그 말 그대로인 그림이 성인·신체·괴이 종류뿐이면 그 그림 (딜도·귀)
                want = by_name[u][0]['file']
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

    # 분류마다 같은 뜻으로 쓰는 말 (_same.txt) → 표의 up_same {말(띄어쓰기 없음): 분류}. 대분류(종류)는 '@food'
    KIND_KEYS = {'food', 'wear', 'tool', 'device', 'medical', 'consumable', 'charm', 'weapon', 'paper', 'valuable', 'key', 'seal', 'anomaly', 'adult', 'body', 'misc'}
    flat = lambda x: re.sub(r'[\s_]+', '', x).lower()
    all_up = set()
    for r in rows:
        all_up.update(r.get('up') or [])
    taken = {}  # 그림 이름·다른 이름(붙여 쓴 것) → 그림 이름
    for r in rows:
        for k in [r['name']] + list(r.get('keywords') or []) + list(r.get('head') or []):
            taken.setdefault(flat(k), r['name'])
    taken_kw = {}
    for r in rows:
        for k in [r['name']] + list(r.get('keywords') or []):
            taken_kw.setdefault(flat(k), r['name'])
    for k, f in rep.items():  # 대표 그림이 정해진 말 (수술도구 → 수술용 메스)
        taken.setdefault(flat(k), k)
    up_flat = {flat(u): u for u in all_up}
    # 매칭기가 이미 어느 그림으로 찾아 주는 말(성수 → 성수병, 표본병 → 괴이 표본 병)은 tools/icon_same_check.mjs 가 _same_skip.txt 에 적는다
    skip = set()
    n_skip = 0
    kpath = os.path.join(UPPER, '_same_skip.txt')
    if os.path.exists(kpath):
        skip = {flat(l.split('→')[0]) for l in open(kpath, encoding='utf-8') if l.strip() and not l.startswith('#')}
    same = {}
    n_cat = 0
    spath = os.path.join(UPPER, '_same.txt')
    if os.path.exists(spath):
        for line in open(spath, encoding='utf-8'):
            line = line.strip()
            if not line or line.startswith('#') or ':' not in line:
                continue
            cat, right = line.split(':', 1)
            cat = cat.strip()
            if cat.startswith('@'):
                if cat[1:] not in KIND_KEYS:
                    problems['같은 말 표(_same.txt)의 분류가 없음'].append(cat)
                    continue
            elif cat not in all_up:
                problems['같은 말 표(_same.txt)의 분류가 없음'].append(cat)
                continue
            n_cat += 1
            for w in right.split():
                if w.startswith('!'):  # 분류 이름과 같은 말이어도 이 분류로 (음식 = 음식 종류 전체)
                    same[flat(w[1:])] = cat
                    continue
                f = flat(w)
                if len(f) < 2:
                    problems['같은 말이 한 글자라 뺌'].append(f'{cat}: {w}')
                elif f in GENERIC:
                    problems['같은 말이 군말이라 뺌'].append(f'{cat}: {w}')
                elif f in up_flat:
                    if up_flat[f] != cat:
                        problems['같은 말이 다른 분류 이름이라 뺌 (그 분류가 먼저)'].append(f'{cat}: {w}')
                elif f in skip and not cat.startswith('@'):  # 대분류 말(식품·음식물)은 매칭기가 끝 글자로 엉뚱한 그림(즉석식품·식물)을 찾던 것이라 빼지 않는다
                    n_skip += 1
                elif f in (taken if KO.search(w) else taken_kw) and (taken if KO.search(w) else taken_kw)[f] != cat:  # 영어 말은 몸통 말(head)은 보지 않는다 — weapon·drink 같은 말이 아무 그림의 몸통 말로 적혀 있어서
                    problems['같은 말이 어느 그림의 이름이라 뺌 (그 그림이 먼저)'].append(f'{cat}: {w} → {taken[f]}')
                elif f in same:
                    if same[f] != cat:
                        problems['같은 말이 두 분류에 있음 (먼저 적은 분류)'].append(f'{w}: {same[f]} / {cat}')
                else:
                    same[f] = cat
    # 분류 이름 그대로인 그림의 영어 이름(과자 그림의 snack)은 그 분류의 영어 말
    n_auto = 0
    cat_names = set()
    for kind, wide, near, members in upper:
        cat_names.update(u for u in (wide, near) if u)
    for ups in tails.values():
        cat_names.update(ups)
    for r in rows:
        if r['name'] in cat_names and r['name'] in all_up:
            for k in r.get('keywords') or []:
                f = flat(k)
                if not KO.search(k) and len(f) >= 3 and f not in same and f not in up_flat:
                    same[f] = r['name']
                    n_auto += 1
    print(f'분류 이름 그림의 영어 이름에서 온 말 {n_auto}개')
    table['up_same'] = same
    # 골고루 뽑는 분류 = 윗말 표·끝 낱말 표의 왼쪽에 적은 분류. 이름 끝 낱말을 물려받아 생긴 무리(사용한 콘돔 → 콘돔)는 그 물건 자체라 뽑지 않는다
    cats = set()
    for kind, wide, near, members in upper:
        cats.update(u for u in (wide, near) if u)
    for ups in tails.values():
        cats.update(ups)
    table['up_cats'] = sorted(c for c in cats if c in all_up)
    print(f'같은 말: 분류 {n_cat}개, 말 {len(same)}개 (매칭기가 이미 그림을 찾는 말 {n_skip}개는 뺌)')

    for k, v in problems.items():
        print(f'\n■ {k} — {len(v)}')
        for x in v[:400]:
            print('  ', x)
    print(f'\n줄에 덧붙인 것 {extra}개')
    print(f'윗말 {len(members_of)}개, up 칸에 적은 윗말 {added}개, 대표 지정 {rep_set}개')
    if apply:
        json.dump(table, open(TABLE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        print('표에 썼음:', TABLE)
    else:
        print('(검사만 했음. 표에 넣으려면 --apply)')


if __name__ == '__main__':
    main()
