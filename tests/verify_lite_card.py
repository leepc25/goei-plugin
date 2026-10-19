#!/usr/bin/env python3
"""경량 카드 검증: python3 tests/verify_lite_card.py <원본> <경량.charx>"""
import json, re, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_lite_card import read_module, MANIFEST_COMMENT  # noqa: E402
from cbs import render  # noqa: E402

src, lite = sys.argv[1], sys.argv[2]
zs, zl = zipfile.ZipFile(src), zipfile.ZipFile(lite)
cs, cl = json.loads(zs.read('card.json'))['data'], json.loads(zl.read('card.json'))['data']
ms, ml = read_module(zs.read('module.risum')), read_module(zl.read('module.risum'))
checks = []
def check(name, ok, detail=''):
    checks.append((name, bool(ok), detail))

check('Lua 트리거 없음', ml['trigger'] == [])
check('정규식 3개만 유지 (상태창은 플러그인)', [r['comment'] for r in ml['regex']] == ['🖼️에셋줄바꿈', '🖼️에셋출력', '🖼️에셋리퀘제거'])
check('유지한 정규식은 원본과 동일', all(r in ms['regex'] for r in ml['regex']))
check('저수준 접근 꺼짐', cl['extensions']['risuai'].get('lowLevelAccess') is False)
check('첫 메시지에 CBS 없음', '{{' not in cl['first_mes'], len(cl['first_mes']))
bg = cl['extensions']['risuai']['backgroundHTML']
check('배경 HTML 24KB 이하', len(bg) < 24000, len(bg))
check('상태창 CSS 포함', '.dv.dv-status' in bg and '.ib-asset-hover' in bg)
MOVED = ('Settings', '통합설정', 'Agent roster', 'World catalog', 'Faction display', 'Phone tabs', 'Start trigger', 'LB Backend')
# 지침은 고친 채로 들어간다 (안 쓰는 섹션 빼기·LB Backend 합치기·대기 줄 문구). 아래에서 따로 본다
TIDIED = ('GNet', 'Phone', 'Wiki')
orig_books = [e for e in ms['lorebook'] if e['comment'] not in MOVED + TIDIED]
orig_lore = {(e['comment'], e['content']) for e in orig_books}
lite_lore = [e for e in ml['lorebook'] if e['comment'] not in (MANIFEST_COMMENT, 'Directory') + TIDIED and not e['comment'].startswith('WIKI｜') and e['comment'] not in ('📖위키', '📖위키 기본 문서')]
FAC_VARS = re.compile(r'\{\{getvar::fac_(codes|ac|pool)\}\}')
def unplaced(e):
    c = e['content']
    if e['comment'] == '📜Faction':
        return re.sub(r'\s+', ' ', c.replace('{{getvar::fac_extra}}', '')).strip()
    return FAC_VARS.sub('', c) if e['comment'] == '🏷️Tag' else c
orig_unplaced = {(e['comment'], re.sub(r'\s+', ' ', e['content']).strip() if e['comment'] == '📜Faction' else e['content']) for e in orig_books}
check('로어북 원본 그대로(옮긴 목록·새 세력 자리표시자만 제외)', {(e['comment'], unplaced(e)) for e in lite_lore} == orig_unplaced and len(lite_lore) == len(orig_books))
tag = next(e for e in ml['lorebook'] if e['comment'] == '🏷️Tag')['content']
fac = next(e for e in ml['lorebook'] if e['comment'] == '📜Faction')['content']
check('🏷️Tag·📜Faction에 새 세력 자리표시자', all(f'{{{{getvar::fac_{k}}}}}' in tag for k in ('codes', 'ac', 'pool')) and '{{getvar::fac_extra}}' in fac)
book = next((e for e in ml['lorebook'] if e['comment'] == 'Directory'), None)
check('Directory: 키 없음·상시 아님(모델에게 안 감)', book and book['key'] == '' and not book.get('alwaysActive'))
check('옮긴 옛 데이터 로어북 없음', not any(e['comment'] in MOVED for e in ml['lorebook']))
dd = json.loads(book['content'])
check('명부에 거점·호칭·괴담톡 탭·시작 로어북', all(k in dd for k in ('거점', '호칭', '괴담톡 탭', '시작 로어북')) and len(dd['거점']) == 6)
secs = lambda c: dict(re.findall(r'@@SECTION ([^\n]+)\n([\s\S]*?)\n@@END', c))
orig_s = {n: secs(next(e for e in ms['lorebook'] if e['comment'] == n)['content']) for n in TIDIED + ('LB Backend',)}
lite_s = {n: secs(next(e for e in ml['lorebook'] if e['comment'] == n)['content']) for n in TIDIED}
check('GNet에 LB Backend 생성 틀이 합쳐짐', all(lite_s['GNet'][k] == orig_s['LB Backend'][k] for k in ('SYSTEM', 'OUTPUT', 'JAILBREAK', 'JOB')))
check('지침 섹션 본문은 원본 그대로 (대기 줄 문구만 고침)', all(lite_s[n][k] == {**orig_s['LB Backend'], **orig_s[n]}[k] for n in TIDIED for k in lite_s[n] if (n, k) != ('Phone', 'PATCH')))
check('card.json 로어북 = 모듈 로어북', [e['comment'] for e in cl['character_book']['entries']] == [e['comment'] for e in ml['lorebook']])
import subprocess, tempfile
with tempfile.TemporaryDirectory() as tmp:
    a, b = Path(tmp) / 'a.json', Path(tmp) / 'b.json'
    a.write_text(json.dumps(ms['lorebook'], ensure_ascii=False), encoding='utf-8')
    b.write_text(json.dumps(ml['lorebook'], ensure_ascii=False), encoding='utf-8')
    cmp = json.loads(subprocess.run(['node', str(Path(__file__).resolve().parents[1] / 'scripts' / 'migrate-lore.mjs'), '--compare', str(a), str(b)], check=True, capture_output=True, text=True).stdout)
check('플러그인이 읽는 상황판 목록·이름 찾기·요원·조직이 원본과 같음', cmp['catalog'] and cmp['registry'] and cmp['agents'] and cmp['orgs'] and cmp['saved'], cmp)
check('Settings 로어북 없음', not any(e['comment'] in ('Settings', '통합설정') for e in ml['lorebook']))
check('제작자 코멘트에 Settings 안내 없음', 'Settings' not in cl['creator_notes'].split('원본 제작 노트')[0])
man = json.loads(next(e for e in ml['lorebook'] if e['comment'] == MANIFEST_COMMENT)['content'])
check('매니페스트 키 비어 있음(자동 활성화 안 됨)', next(e for e in ml['lorebook'] if e['comment'] == MANIFEST_COMMENT)['key'] == '')
alt = cl['alternate_greetings']
bad = []
for key, idx in man['greetings'].items():
    f, l, fm = key.split('-')
    want = re.sub(r'^\s*(<br>\s*)*', '', render(cs['first_mes'], {'st_faction': f, 'st_lang': l, 'st_fm': fm})).strip()
    if alt[idx] != want:
        bad.append(key)
check('추가 인사말 = 원본 분기 렌더 결과', not bad, bad[:5])
check('분기 수', len(man['greetings']) == 66, len(man['greetings']))
names_s = set(zs.namelist()) - {'card.json', 'module.risum', 'charx.json'}
names_l = set(zl.namelist()) - {'card.json', 'module.risum'}
check('에셋 파일 전부 유지', names_s == names_l, len(names_l))
check('에셋 목록 유지', cs.get('assets') == cl.get('assets'))
check('설명·로어북 외 필드 유지', cs['description'] == cl['description'])
for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL'), name, detail if detail != '' else '')
sys.exit(0 if all(ok for _, ok, _ in checks) else 1)
