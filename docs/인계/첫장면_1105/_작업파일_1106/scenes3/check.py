import re, sys, json, glob
NEW = ["suspicious","worried","relieved","disgusted","determined","jealous","pleading","forced smiling","indifferent","guilty","pouting","angry smile","expressionless","tormented","crazy smile"]
pics = json.load(open('/home/user/goei-plugin/src/data/install/pictures.json'))
names = sorted({x[0].split('_',1)[0] for x in pics if '_' in x[0]})
base = sorted({x[0].split('_',1)[1] for x in pics if '_' in x[0]})
pool = set(base) | set(NEW)
BAN = ["{{user}}", "정부기관", "government", "이면세계", "이면의 문"]
def scenes(path):
    t = open(path, encoding='utf-8').read()
    parts = re.split(r'^=== (P\d{3})\s*$', t, flags=re.M)
    out = {}
    for i in range(1, len(parts), 2):
        out[parts[i]] = parts[i+1].strip('\n')
    return out
def check(pid, s):
    errs = []
    L = len(s)
    tags = re.findall(r'<img=([^>]+)>', s)
    for tg in tags:
        if '_' not in tg: errs.append(f'bad tag {tg}'); continue
        n, k = tg.split('_', 1)
        if n not in names: errs.append(f'unknown name {n}')
        if k not in pool: errs.append(f'unknown kw {k}')
    for a, b in zip(tags, tags[1:]):
        if a == b: errs.append(f'consecutive dup {a}')
    if len(set(tags)) != len(tags): errs.append(f'repeated tags {[t for t in tags if tags.count(t)>1]}')
    need = 8 if L >= 1800 else 6
    if len(tags) < need: errs.append(f'only {len(tags)} tags for {L} chars')
    for b in BAN:
        if b in s: errs.append(f'banned {b}')
    lines = [l for l in s.split('\n') if l.strip()]
    last = lines[-1].strip()
    if not (last.startswith('"') and last.endswith('"')) and not (last.startswith('[') and last.endswith(']')):
        errs.append(f'last line not dialogue: {last[:40]}')
    if re.search(r'<img=[^>]+>\s*$', s): errs.append('ends with tag')
    return L, len(tags), errs
if __name__ == '__main__':
    files = sys.argv[1:] or sorted(glob.glob('/tmp/claude-0/-home-user/827ff656-0ba5-5c94-936c-cbbb8cb832b9/scratchpad/scenes3/b*.ko.txt'))
    tot = 0
    for f in files:
        for pid, s in scenes(f).items():
            L, n, errs = check(pid, s); tot += 1
            print(pid, L, n, 'OK' if not errs else errs)
    print('total', tot)
