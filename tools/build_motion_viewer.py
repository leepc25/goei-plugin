"""docs/동작표/*.md, docs/동작표/NPC/*.md → 한 장짜리 HTML 보기 화면.
사용: python3 tools/build_motion_viewer.py <등록그림 폴더> <pack/_index.tsv> <출력.html> [<NPC 그림 폴더> <NPC list.json>]"""
import base64, io, json, re, sys, glob, os
from PIL import Image

IMG, IDX, OUT = sys.argv[1:4]
NPC_IMG, NPC_LIST = (sys.argv[4:6] + [None, None])[:2]
ROOT = os.path.join(os.path.dirname(__file__), '..', 'docs', '동작표')
GRP = {'1': '관리국', '2': '가짜 관리국', '3': '백일몽', '4': '중립', '5': '개체'}

def uri(path):
    im = Image.open(path).convert('RGBA')
    im = im.crop(im.getchannel('A').getbbox())
    b = io.BytesIO(); im.save(b, 'PNG', optimize=True)
    return 'data:image/png;base64,' + base64.b64encode(b.getvalue()).decode()

def strip_md(t):
    t = re.sub(r'\*\*(.+?)\*\*', r'\1', t)
    return t.replace('`', '')

idx = [l.split('\t') for l in open(IDX, encoding='utf-8').read().split('\n') if l]
chars = []
for head, ko, en, d, cid in idx:
    no = '.'.join(re.findall(r'### (\d+)\.(\d+)', head)[0])
    title = head.split(' — ', 1)[1] if ' — ' in head else ''
    f = '00_베이스_및_쟈알디.md' if ko == '쟈알디' else f'{no}_{ko}.md'
    s = open(os.path.join(ROOT, f), encoding='utf-8').read()
    if ko == '쟈알디':
        s = s[s.index('## 1. 쟈알디'):]
    lines = s.split('\n')
    rows, meta, notes, seen = [], [], [], False
    for l in lines:
        m = re.match(r'\| (\d+) \|', l)
        if m:
            c = [x.strip() for x in l.strip().strip('|').split('|')]
            p = c[5].split('<br>')
            rows.append({'n': int(c[0]), 'name': c[1], 'dir': c[2], 'fr': c[3], 'pose': c[4],
                         'en': p[0].strip(), 'ko': (p[1].strip().strip('（）()') if len(p) > 1 else ''),
                         'cost': c[6]})
            seen = True
        elif l.startswith('- ') and not seen:
            meta.append(strip_md(l[2:]))
        elif l.startswith('- ') and seen:
            notes.append(strip_md(l[2:]))
    side, obl = ('west', 'south-west') if d.startswith('W') else ('east', 'south-east')
    cost = sum(int(re.match(r'\d+', r['cost']).group()) for r in rows if re.match(r'\d+', r['cost']))
    chars.append({'no': no, 'ko': ko, 'en': en, 'grp': GRP[no[0]], 'title': title, 'dir': d,
                  'combat': len(rows) <= 35, 'meta': meta, 'notes': notes, 'rows': rows, 'cost': cost,
                  'img': [uri(f'{IMG}/{cid}_{obl}.png'), uri(f'{IMG}/{cid}_{side}.png')]})
chars.sort(key=lambda c: [int(x) for x in c['no'].split('.')])

NPC_ORDER = ['관리국', '가짜 관리국', '백일몽', '협회', '프리랜서', '경찰', '불량배', '상인', '의사', '간호사', '청소부', '학생', '시민']
npcs = []
if NPC_LIST:
    for i, n in enumerate(json.load(open(NPC_LIST, encoding='utf-8'))):
        ko = n['ko']; s = open(os.path.join(ROOT, 'NPC', ko + '.md'), encoding='utf-8').read()
        rows, meta, notes, seen = [], [], [], False
        for l in s.split('\n'):
            m = re.match(r'\| (\d+) \|', l)
            if m:
                c = [x.strip() for x in l.strip().strip('|').split('|')]
                p = c[5].split('<br>')
                rows.append({'n': int(c[0]), 'name': c[1], 'dir': c[2], 'fr': c[3], 'pose': c[4],
                             'en': p[0].strip(), 'ko': (p[1].strip().strip('（）()') if len(p) > 1 else ''), 'cost': c[6]})
                seen = True
            elif l.startswith('- '):
                (notes if seen else meta).append(strip_md(l[2:]))
        d = 'W/SW' if any(r['dir'] in ('W', 'SW') for r in rows) else 'E/SE'
        side, obl = ('west', 'south-west') if d.startswith('W') else ('east', 'south-east')
        kind = next(k for k in NPC_ORDER if ko.startswith(k))
        cost = sum(int(re.match(r'\d+', r['cost']).group()) for r in rows if re.match(r'\d+', r['cost']))
        npcs.append({'no': f'n{i}', 'ko': ko, 'en': n['name'], 'grp': kind, 'title': '일반 NPC', 'dir': d, 'npc': True,
                     'combat': True, 'meta': meta, 'notes': notes, 'rows': rows, 'cost': cost,
                     'img': [uri(f'{NPC_IMG}/{n["id"]}_{obl}.png'), uri(f'{NPC_IMG}/{n["id"]}_{side}.png')]})
    import functools
    def nkey(c):
        k = NPC_ORDER.index(c['grp']); t = c['ko'][len(c['grp']):].strip()
        return (k, t)
    npcs.sort(key=nkey)
    for i, c in enumerate(npcs): c['no'] = f'n{i}'

lst = open(os.path.join(ROOT, '00_목록.md'), encoding='utf-8').read()
checks = [strip_md(re.sub(r'^\d+\. ', '', l)) for l in lst.split('## 사용자 확인이 필요한 것')[1].split('\n') if re.match(r'^\d+\. ', l)]

np = os.path.join(ROOT, 'NPC', '00_목록.md')
if NPC_LIST and os.path.exists(np):
    t = open(np, encoding='utf-8').read().split('## 사용자 확인이 필요한 것')[1]
    checks += ['[NPC] ' + strip_md(re.sub(r'^\d+\. ', '', l)) for l in t.split('\n') if re.match(r'^\d+\. ', l)]

tpl = open(os.path.join(os.path.dirname(__file__), 'motion_viewer_template.html'), encoding='utf-8').read()
data = json.dumps({'chars': chars, 'npcs': npcs, 'checks': checks, 'total': sum(c['cost'] for c in chars), 'ntotal': sum(c['cost'] for c in npcs)}, ensure_ascii=False)
open(OUT, 'w', encoding='utf-8').write(tpl.replace('/*DATA*/null', data))
print(OUT, os.path.getsize(OUT) // 1024, 'KB', len(chars), len(npcs))
