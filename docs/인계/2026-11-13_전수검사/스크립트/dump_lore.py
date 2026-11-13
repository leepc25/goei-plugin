# 로어 덤프: src/data/world/*.json 을 기록 하나당 파일 하나로 풀어 /tmp/audit_1113/lore/world/ 에 둔다.
# 검사 스크립트(goei-text-audit-*.js)의 lorg·lan3 등은 이 폴더와 _index.tsv 순서를 읽는다.
# 쓰는 법: python3 -I docs/인계/2026-11-13_전수검사/스크립트/dump_lore.py  (저장소 맨 위에서)
import json, os, re
OUT = '/tmp/audit_1113/lore/world'
for kind in ['agents', 'anomalies', 'orgs', 'sites', 'appendices']:
    d = json.load(open(f'src/data/world/{kind}.json'))
    recs = d['records']
    os.makedirs(f'{OUT}/{kind}', exist_ok=True)
    idx = []
    for name, rec in (recs.items() if isinstance(recs, dict) else enumerate(recs)):
        fn = re.sub(r'[^\w가-힣 ]+', '_', str(name))[:60] + '_.json'
        txt = json.dumps(rec, ensure_ascii=False, indent=1)
        open(f'{OUT}/{kind}/{fn}', 'w').write(txt)
        idx.append(f'{fn}\t{len(txt)}')
    open(f'{OUT}/{kind}/_index.tsv', 'w').write('\n'.join(idx) + '\n')
json.dump(json.load(open('src/data/world/relations.json')), open(f'{OUT}/relations.json', 'w'), ensure_ascii=False, indent=1)
print('ok', OUT)
