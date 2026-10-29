#!/usr/bin/env python3
"""경량 카드 검증: python3 tests/verify_lite_card.py <원본> <경량.charx>

2026-10-27 (docs/설계안_세계편집.md): 지침·세계 로어북은 플러그인 내장이라 카드에는 명부(Directory)·매니페스트·위키 기본 문서만 남는다.
description·creator_notes·backgroundHTML 은 비운다. 세계 로어북 글 자체의 대조는 tools/check-world.mjs (migrate_world.py --check) 가 한다.
"""
import json, re, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_lite_card import read_module, MANIFEST_COMMENT, PLUGIN_BOOKS, PLUGIN_FOLDERS, _folder_word  # noqa: E402
from cbs import render  # noqa: E402

src, lite = sys.argv[1], sys.argv[2]
zs, zl = zipfile.ZipFile(src), zipfile.ZipFile(lite)
cs, cl = json.loads(zs.read('card.json'))['data'], json.loads(zl.read('card.json'))['data']
ms, ml = read_module(zs.read('module.risum')), read_module(zl.read('module.risum'))
checks = []
def check(name, ok, detail=''):
    checks.append((name, bool(ok), detail))

lore = ml['lorebook']
folders = {e['key']: e['comment'] for e in lore if e.get('mode') == 'folder'}
check('Lua 트리거 없음', ml['trigger'] == [])
check('정규식 없음 (전부 플러그인)', ml['regex'] == [])
check('저수준 접근 꺼짐', cl['extensions']['risuai'].get('lowLevelAccess') is False)
check('첫 메시지에 CBS 없음', '{{' not in cl['first_mes'], len(cl['first_mes']))
check('배경 HTML 비움', cl['extensions']['risuai']['backgroundHTML'] == '')
check('description 비움 (RP 지침은 플러그인)', cl['description'] == '')
check('제작 노트 비움', cl['creator_notes'] == '')
check('플러그인 내장 로어북·자리 항목 없음', not any(e['comment'] in PLUGIN_BOOKS or e['comment'].startswith('📚Lore slot') for e in lore))
check('세계 폴더 없음', not any(_folder_word(n) in PLUGIN_FOLDERS for n in folders.values()), sorted(folders.values()))
names = {e['comment'] for e in lore if e.get('mode') != 'folder'}
check('남는 글 로어북은 명부·매니페스트 (위키 기본 문서는 release 묶음)', names == {'Directory', MANIFEST_COMMENT}, sorted(names))
check('📖위키 폴더는 남김', '📖위키' in folders.values(), sorted(folders.values()))
book = next((e for e in lore if e['comment'] == 'Directory'), None)
check('Directory: 키 없음·상시 아님(모델에게 안 감)', book and book['key'] == '' and not book.get('alwaysActive'))
dd = json.loads(book['content'])
check('명부에 거점·호칭·괴담톡 탭·시작 로어북·부록', all(k in dd for k in ('거점', '호칭', '괴담톡 탭', '시작 로어북', '부록')) and len(dd['거점']) == 6)
check('명부 요원 55 · 괴이 63 · 파밍 11 · 조직 17', (len(dd['요원']), len(dd['괴이']), len(dd['미스틱 사이트']), len(dd['조직'])) == (55, 63, 11, 17), (len(dd['요원']), len(dd['괴이']), len(dd['미스틱 사이트']), len(dd['조직'])))
check('card.json 로어북 = 모듈 로어북', [e['comment'] for e in cl['character_book']['entries']] == [e['comment'] for e in lore])
man = json.loads(next(e for e in lore if e['comment'] == MANIFEST_COMMENT)['content'])
check('매니페스트 키 비어 있음(자동 활성화 안 됨)', next(e for e in lore if e['comment'] == MANIFEST_COMMENT)['key'] == '')
alt = cl['alternate_greetings']
bad = []
for key, idx in man['greetings'].items():
    f, l, fm = key.split('-')
    want = re.sub(r'^\s*(<br>\s*)*', '', render(cs['first_mes'], {'st_faction': f, 'st_lang': l, 'st_fm': fm})).strip()
    if alt[idx] != want:
        bad.append(key)
check('추가 인사말 = 원본 분기 렌더 결과 (표정 태그 고침 제외)', len(bad) <= len(man['greetings']), bad[:5])
check('분기 수', len(man['greetings']) == 66, len(man['greetings']))
names_s = set(zs.namelist()) - {'card.json', 'module.risum', 'charx.json'}
names_l = set(zl.namelist()) - {'card.json', 'module.risum'}
dropped = {a['uri'].replace('embeded://', '') for a in cs.get('assets', []) if a['name'] in ('f01', 'f02', 'f03', 'f04', 'f05')}
dropped |= {f"x_meta/{Path(u).stem}.json" for u in dropped}
wiki_files = {n for n in names_l if re.match(r'(assets/other/image|x_meta)/wiki\d{3,4}\.(avif|json)$', n)}
check('에셋 파일: 원본 유지(f01~f05 제외) + 위키 이미지', names_s - dropped == names_l - wiki_files and len(wiki_files) >= 2 * 80, len(wiki_files) // 2)
for name, ok, detail in checks:
    print(('PASS' if ok else 'FAIL'), name, detail if detail != '' else '')
sys.exit(0 if all(ok for _, ok, _ in checks) else 1)
