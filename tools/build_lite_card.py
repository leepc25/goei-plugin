#!/usr/bin/env python3
"""괴이봇 원본 charx(또는 JPEG에 붙은 charx)에서 플러그인용 경량 카드를 만든다.

원본 파일은 읽기만 한다. 결과물:
  - Lua 트리거 없음, 저수준 접근 없음
  - 시작/설정/지도/프리셋/괴담넷/위키/폰 패널 정규식 제거 (플러그인이 담당)
  - 285KB짜리 CBS 첫 메시지를 분기별 추가 인사말로 분리 (CBS 계산 없음)
  - 배경 HTML은 상태창·에셋 표시용 CSS만 남김
  - 로어북: 옛 데이터 로어북은 명부(Directory)로 옮기고, LB Backend는 GNet에 합치고, 안 쓰는 지침 섹션은 빼고,
    ⚙️설정 폴더에 플러그인 매니페스트(Plugin manifest) 1개 추가. card.json 로어북도 모듈과 똑같이 맞춘다

사용법: python3 tools/build_lite_card.py <원본.charx|원본.jpeg> <결과.charx>
"""
import base64
import gzip
import hashlib
import json
import subprocess
import tempfile
import re
import struct
import sys
import uuid
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from cbs import render  # noqa: E402

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
RPACK = (TOOLS / 'rpack_map.bin').read_bytes()
ENCODE, DECODE = RPACK[:256], RPACK[256:]

MANIFEST_COMMENT = 'Plugin manifest'
OLD_MANIFEST = '괴이봇 플러그인 매니페스트'
SETTINGS_FOLDER_NAME = '⚙️설정'
MANIFEST_KEY = ''  # 빈 키: Risu가 키워드로 활성화하지 않음
# 상태창(📊상태창)은 v0.16.31부터 플러그인이 그린다
KEEP_REGEX = ('🖼️에셋줄바꿈', '🖼️에셋출력', '🖼️에셋리퀘제거')
STATUS_CSS = re.compile(r'(\.dv-status|\.dv-time|\.dv-date|\.dv-wx|\.dv-loc|\.dv-target|\.ib-asset)')

GHOST_SVG = (
    '<svg width="30" height="30" viewBox="0 0 24 24" fill="#5EEAD4" aria-hidden="true"><path fill-rule="evenodd" '
    'd="M11.5 2.5C7.8 2.5 5.5 5.2 5.5 8.8V10.3L3.9 9.1C2.2 7.9 .6 10.1 2 11.5L5.5 15C5.8 19.5 9.3 22 13.7 22C18.1 22 21 '
    '19.6 22 16.8C19.4 18.3 17.5 17.8 17.5 15.5V15L21 11.5C22.4 10.1 20.8 7.9 19.1 9.1L17.5 10.3V8.5C17.5 5 15.1 2.5 11.5 '
    '2.5ZM10.2 9A1.2 1.6 0 1 0 7.8 9A1.2 1.6 0 1 0 10.2 9ZM15.2 9A1.2 1.6 0 1 0 12.8 9A1.2 1.6 0 1 0 15.2 9ZM12.5 13A1 1.5 '
    '0 1 0 10.5 13A1 1.5 0 1 0 12.5 13Z"></path></svg>'
)
_CARD = ('max-width:34em;margin:18px auto;padding:22px 22px 18px;border-radius:20px;background:#0B1215;'
         'border:1px solid #24343B;color:#E6EEEC;line-height:1.65;font-size:15px;'
         'box-shadow:0 20px 40px -24px rgba(0,0,0,.8)')
_LOGO = ('display:inline-grid;place-items:center;width:52px;height:52px;border-radius:16px;background:#10302C;'
         'margin-bottom:10px')
_KICK = 'font-family:monospace;font-size:11px;letter-spacing:.28em;color:#5EEAD4;opacity:.85'

def _title(text, signal):
    """제목 「괴이: 이면세계」: 크게, 이면(뒷면)이라는 뜻을 살려 아래로 흐리게 비친 반사 (플러그인 main.ts titleHtml과 같은 모양)"""
    line = (f'<span style="color:{text}">괴이</span><span style="color:{signal};font-weight:300;margin:0 .18em 0 .06em">:</span>'
            f'<span style="color:{signal}">이면세계</span>')
    font = 'font-size:2.1em;font-weight:800;letter-spacing:.08em;line-height:1.15;white-space:nowrap'
    return (f'<div style="margin:10px 0 0;{font}">{line}</div>'
            f'<div aria-hidden="true" style="{font};line-height:1;margin:-.06em 0 .02em;transform:scaleY(-1);opacity:.3;'
            '-webkit-mask-image:linear-gradient(to top,#000,transparent 60%);mask-image:linear-gradient(to top,#000,transparent 60%)">'
            f'{line}</div>')


LANDING = (
    f'<div data-goei="landing" style="{_CARD};text-align:center">'
    f'<span style="{_LOGO}">{GHOST_SVG}</span>'
    f'<div style="{_KICK}">ANOMALY SIMULATION</div>'
    + _title('#E6EEEC', '#5EEAD4') +
    '<div style="color:#9DB0AC">유령 버튼을 눌러 시작하세요</div></div>'
)


def _step(n, title, body):
    return ('<div style="display:flex;gap:12px;align-items:flex-start;margin:10px 0">'
            f'<span style="flex:none;width:26px;height:26px;border-radius:9px;background:#10302C;color:#5EEAD4;'
            f'font-family:monospace;font-weight:700;display:grid;place-items:center;font-size:13px">{n}</span>'
            f'<div><b>{title}</b><div style="color:#9DB0AC;font-size:14px">{body}</div></div></div>')


def _chip(t):
    return (f'<span style="display:inline-block;margin:3px 4px 3px 0;padding:3px 10px;border-radius:999px;'
            f'background:#121B1F;border:1px solid #24343B;font-size:13px;color:#C9D6D3">{t}</span>')


def creator_notes(original):
    h3 = 'margin:18px 0 6px;font-size:12px;letter-spacing:.14em;color:#8FA39F;font-weight:700'
    orig = (original or '').strip()
    return (
        f'<div style="{_CARD}">'
        f'<div style="display:flex;align-items:center;gap:12px"><span style="{_LOGO};margin:0;flex:none">{GHOST_SVG}</span>'
        f'<div><div style="{_KICK}">ANOMALY SIMULATION</div>'
        '<div style="font-size:1.3em;font-weight:700">괴이: 이면세계</div>'
        '<div style="color:#9DB0AC;font-size:13px">괴이봇 2탄 기반 · 플러그인 전용</div></div></div>'
        f'<div style="{h3}">준비</div>'
        + _step(1, '플러그인 설치', '설정 → 플러그인에서 goei-plugin.js를 추가해요.')
        + _step(2, '에셋 모듈 임포트', '캐릭터 이미지 출력에 필요해요.')
        + f'<div style="{h3}">플레이</div>'
        + _step(1, '유령 버튼', '채팅창 구석의 유령 버튼을 눌러요.')
        + _step(2, '세력 · 첫 장면 · 언어', '고른 뒤 출발을 누르면 첫 장면이 열려요.')
        + _step(3, '진행 중에도 같은 버튼', '상황판, 지도, 괴담톡, 괴담넷, 위키를 이 창에서 써요.')
        + f'<div style="{h3}">창에서 쓰는 기능</div>'
        + ''.join(_chip(t) for t in ('상황판', '지도·출동', '커스텀 임무', '괴담톡', '괴담넷', '위키', '설정'))
        + f'<div style="{h3}">설정</div>'
        '<div style="color:#9DB0AC;font-size:14px">테마, 에셋 출력, 요원 표시 인원, 괴이 발생 수치는 플러그인 창의 '
        '<b style="color:#E6EEEC">설정</b>에서 바꿔요. 시작 화면 오른쪽 위 버튼으로 새 채팅 기본값도 미리 정할 수 있어요. '
        '로어북을 고칠 필요는 없어요.</div>'
        f'<div style="{h3}">괴이 · 요원 추가</div>'
        '<div style="color:#9DB0AC;font-size:14px">로어북을 <b style="color:#E6EEEC">🚧괴이</b>(괴이), <b style="color:#E6EEEC">🎁파밍</b>(특수), '
        '<b style="color:#E6EEEC">🙂요원</b>(요원) 폴더에 넣으면 플러그인이 알아서 불러와요. 영문명, 발생 후보, 요원 소속 조직 같은 세부값은 '
        '설정 → <b style="color:#E6EEEC">카드 명부</b>에서 고치고, 카드 로어북 「괴이봇 명부」에 저장돼 카드와 함께 공유돼요.</div>'
        '<div style="margin-top:16px;padding:10px 12px;border-radius:12px;background:#121B1F;border:1px solid #24343B;'
        'color:#9DB0AC;font-size:13px">원본 카드의 Lua와 무거운 패널을 뺀 판이라 채팅이 가벼워요. '
        '이 카드는 플러그인(goei-plugin.js)이 있어야 제대로 돌아가요.</div>'
        + (f'<details style="margin-top:14px"><summary style="cursor:pointer;color:#8FA39F;font-size:13px">원본 제작 노트</summary>'
           f'\n\n{orig}\n\n</details>' if orig else '')
        + '</div>'
    )


def load_scenarios():
    return json.loads((ROOT / 'src' / 'data' / 'scenarios.json').read_text(encoding='utf-8'))


def read_module(raw):
    if raw[0] != 111 or raw[1] != 0:
        raise ValueError('module.risum 형식이 아닙니다')
    n = struct.unpack('<I', raw[2:6])[0]
    return json.loads(bytes(DECODE[b] for b in raw[6:6 + n]).decode('utf-8'))['module']


def write_module(module):
    body = json.dumps({'module': module, 'type': 'risuModule'}, ensure_ascii=False, indent=2).encode('utf-8')
    enc = bytes(ENCODE[b] for b in body)
    return bytes([111, 0]) + struct.pack('<I', len(enc)) + enc + bytes([0])


def css_blocks(s):
    out, depth, start = [], 0, 0
    for i, ch in enumerate(s):
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth == 0:
                out.append(s[start:i + 1].strip())
                start = i + 1
    return out


def keep_status_rules(css):
    """상태창·에셋 표시 규칙만 남긴다. @media 안의 @media(hover:hover)처럼 중첩된 묶음도 따라 들어간다."""
    keep = []
    for block in css_blocks(css):
        head = block[:block.find('{')].strip()
        if head.startswith('@media') or head.startswith('@supports'):
            inner = keep_status_rules(block[block.find('{') + 1:-1])
            if inner:
                keep.append(head + ' {\n' + '\n'.join(inner) + '\n}')
        elif head == '.dv' or STATUS_CSS.search(head):
            keep.append(block)
    return keep


THEMES = (('dark', '{{#if {{equal::{{getvar::st_fixed_theme}}::dark}}}}'),
          ('paper', '{{#if {{equal::{{getvar::st_fixed_theme}}::paper}}}}'),
          ('', '{{#if {{not_equal::{{getvar::st_fixed_theme}}::dark}}}}{{#if {{not_equal::{{getvar::st_fixed_theme}}::paper}}}}'))


def status_css(background_html):
    """원본 배경 CSS는 테마(st_fixed_theme: 기본·dark·paper)별 CBS 분기로 되어 있다.
    테마마다 분기를 풀어 상태창·에셋 규칙만 뽑고, 같은 CBS 조건으로 다시 감싼다."""
    css = ''.join(re.findall(r'<style[^>]*>(.*?)</style>', background_html or '', re.S))
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    parts = []
    for theme, cond in THEMES:
        rules = keep_status_rules(render(css, {'st_fixed_theme': theme or 'null'}))
        if '{{' in ''.join(rules):
            raise ValueError('배경 CSS에 해석되지 않은 CBS가 남았습니다')
        parts.append(cond + '\n' + '\n'.join(rules) + '\n' + '{{/if}}' * cond.count('{{#if'))
    return '<style>\n' + '\n'.join(parts) + '\n</style>'


def build_openings(first_mes, scenarios):
    """Return (alternate_greetings, greeting_index_by_key)."""
    greetings, index = [], {}
    empty_index = None
    for faction in scenarios['factions']:
        code = faction['code']
        for lang in scenarios['languages']:
            for sc in faction['scenarios']:
                key = f"{code}-{lang['code']}-{sc['fm']}"
                if sc['kind'] == 'preset':
                    continue
                text = render(first_mes, {'st_faction': code, 'st_lang': lang['code'], 'st_fm': str(sc['fm'])})
                text = re.sub(r'^\s*(<br>\s*)*', '', text).strip()
                if sc['kind'] == 'direct':
                    if text:
                        raise ValueError(f'{key}: 직접 입력 시나리오에 첫 메시지가 있습니다')
                    if empty_index is None:
                        empty_index = len(greetings)
                        greetings.append('')
                    index[key] = empty_index
                    continue
                if not text:
                    raise ValueError(f'{key}: 첫 메시지 분기가 비어 있습니다')
                if '{{' in text.replace('{{user}}', '').replace('{{char}}', ''):
                    raise ValueError(f'{key}: 해석되지 않은 CBS가 남았습니다')
                index[key] = len(greetings)
                greetings.append(text)
    return greetings, index


SETTINGS_BOOKS = ('Settings', '통합설정')


def migrate_directory(entries):
    """괴이·미스틱 사이트·요원·거점·세력 호칭·괴담톡 탭·첫 턴 로어북을 명부(Directory)로 옮긴다 (플러그인과 같은 코드를 node로 실행, 먼저 npm run build)"""
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / 'in.json', Path(tmp) / 'out.json'
        src.write_text(json.dumps(entries, ensure_ascii=False), encoding='utf-8')
        subprocess.run(['node', str(ROOT / 'scripts' / 'migrate-lore.mjs'), str(src), str(dst)], check=True)
        return json.loads(dst.read_text(encoding='utf-8'))


WIKI_FOLDER_KEY = '\uf000folder:6f1c2a7e-wiki-0000-0000-goeiwiki0001'
WIKI_FOLDER_NAME = '📖위키'


WIKI_PACK_COMMENT = '📖위키 기본 문서'
WIKI_PACK_HEAD = 'GOEIWIKI1:'  # core/wiki.ts WIKI_PACK_HEAD와 같게


def add_wiki_base(entries):
    """card/wiki-base.json(scripts/wiki-import.mjs가 모은 위키 기본 문서)을 「📖위키」 폴더의 항목 하나로 넣는다.
    문서가 많아(2MB 넘음) 카드가 무거워지지 않게 {제목: 본문} JSON을 gzip+base64로 줄인다. 플러그인이 창을 열 때 한 번 푼다(core/wiki.ts prepareBaseDocs).
    키 없는 비활성 항목이라 모델 프롬프트에는 들어가지 않는다"""
    path = ROOT / 'card' / 'wiki-base.json'
    if not path.exists():
        return entries
    docs = json.loads(path.read_text(encoding='utf-8'))
    entries = [e for e in entries if e.get('folder') != WIKI_FOLDER_KEY and e.get('key') != WIKI_FOLDER_KEY]
    entries.append({'key': WIKI_FOLDER_KEY, 'comment': WIKI_FOLDER_NAME, 'content': '', 'mode': 'folder', 'insertorder': 100,
                    'alwaysActive': False, 'secondkey': '', 'selective': False, 'bookVersion': 2})
    raw = json.dumps(docs, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    packed = WIKI_PACK_HEAD + base64.b64encode(gzip.compress(raw, compresslevel=9, mtime=0)).decode('ascii')
    entries.append({'key': '', 'secondkey': '', 'comment': WIKI_PACK_COMMENT, 'content': packed, 'mode': 'normal', 'insertorder': 0,
                    'alwaysActive': False, 'selective': False, 'useRegex': False, 'folder': WIKI_FOLDER_KEY, 'bookVersion': 2})
    return entries


# 본편 로어북 고르기 (플러그인 core/lore.ts). 네 폴더 항목은 @@dont_activate로 Risu가 켜지 않고,
# 플러그인이 고른 글을 자리 항목 4개가 채팅 변수로 읽는다. 키 정리: docs/호출키_검토_1019.md
MANAGED_FOLDERS = {'세력': 'org', '조직': 'org', '파밍': 'site', '괴이': 'anomaly', '요원': 'agent'}
LORE_SLOTS = [  # core/lore.ts SLOTS와 같게
    ('📚Lore slot · Faction', 'goei_lore_org', 200),
    ('📚Lore slot · Mystic', 'goei_lore_site', 400),
    ('📚Lore slot · Anomaly', 'goei_lore_anomaly', 500),
    ('📚Lore slot · Agent', 'goei_lore_agent', 600),
]
DONT_ACTIVATE = '@@dont_activate'
# 순서가 100이던 요원 넷: 다른 요원과 같은 600으로
AGENT_ORDER_FIX = {'큐라스', '송주익', '윤병수', '제이'}
# {로어북: (뺄 키, 더할 키)}. 없는 키를 빼라고 하면 빌드를 멈춘다 (원본이 바뀌었는지 알 수 있게)
KEY_EDITS = {
    '관리국': (['bureau'], []),
    '백일몽': ([], ['백일몽 주식회사']),
    '협회': (['프리랜서', 'freelancer', 'Association'], []),
    '교황청': (['수녀'], []),
    '이슬람 서울중앙성원': (['성전사'], []),
    '발푸르기스 협회': (['마녀', 'Witch', 'Sorcerer', 'Sorcery'], []),
    '무명찬란교': (['Chanrangyo', 'Ireum'], []),
    '병원': (['Hospital'], []),
    '극단': (['Troupe'], []),
    '세계정치 게시판': ([], ['세계정치 게시판']),
    '사장': (['President'], []),
    '도필헌': (['Guk-jang', 'Gukjang'], []),
    '제이': (['Ban-jang', 'Banjang', 'Guard Chief'], []),
    '고연지': (['Son-gil', 'Songil', 'Ui-won', 'Uiwon'], []),
    '윤지아': (['Son-gil', 'Songil', 'Ui-won', 'Uiwon', 'Jia', 'Ji-a'], []),
    '마덕희': (['Heol-gap', 'Heolgap', 'Mae-ip', 'Maeip'], []),
    '문혜란': (['Dae-bak', 'Daebak', 'Al-seon', 'Alseon'], []),
    '신유리': (['Consulting', 'Yeong-chang', 'Yeongchang', 'Yuri'], []),
    '블라렛': (['교황청', '바티칸', '수녀', '기독교 상점', 'Vatican', 'Christian goods shop'], []),
    '살라딘': (['이슬람', '지하드', 'Islam', 'Jihad'], []),
    '아벤샤': (['발푸르기스', '마도사', '마법사', '마녀', 'Walpurgis', 'Sorcerer', 'Sorceress', 'Witch'], []),
    '세크리엠': (['흡혈귀', '뱀파이어', 'Vampire'], []),
    '탐미주의': (['심미주의', 'Aesthete'], []),
    '인류의 신비전': (['humanity', 'mysteries', 'mystery'], []),
    '예술가의 지하실': (['Basement'], ['예술가의 지하실']),
    '교회': (['Church'], []),
    '강변': (['Riverside'], []),
    '미술관': (['Art Museum'], []),
    '인스피레이션 호텔': (['Inspiration'], []),
    '한여름 밤의 꿈': (['Midsummer Night', "Midsummer Night's Dream"], []),
    '꿈과 희망의 극단': (['Dream and Hope'], []),
    '살아있는 보육원': (['보육원', 'Orphanage'], []),
    '생체 공장': (['Bio Factory', 'Biofactory'], []),
    '강서 대학병원': (['University Hospital'], []),
    '강북 특설병원': (['Special Hospital'], []),
    '한설인육공장': (['butcher shop', 'Human Meat Factory'], []),
    '광기로 점철된 성당': (['Corrupted cathedral', 'Beelzebub'], []),
    '기괴한 방탈출 카페': (['방탈출', 'Escape Room'], ['기괴한 방탈출 카페']),
    '유쾌 테마파크': (['AMUSEMENT THEME PARK'], []),
    '헝그리 행맨': (['abandoned kindergarten', '버려진 유지원'], []),
    '반짝반짝 용궁': (['용궁', 'Dragon Palace'], ['반짝반짝 용궁']),
    '성 안티쿠스 기숙학교': (['기숙학교', 'Boarding School'], []),
    '화요퀴즈쇼': (['브라우니', 'Brownie'], []),
    '해피엔딩 홀': (['무명찬란교', 'Mumyeong Chanran-gyo', 'Happy Ending'], ['해피엔딩 홀']),
    '세광역': (['세광특별시', 'Segwang Special City'], []),
    '차원 승강기': (['승강기', '차원승강기'], []),
    '어두운 정원': (['Dark Garden'], []),
    '거대한 세상': (['Giant World'], []),
    '욕망의 방': (['Desire Room'], []),
    '달빛 타투샵': (['달빛타투샵'], []),
    '이정 책방': (['이정책방', 'Yijeong Bookstore'], []),
    '도깨비 공방': (['도깨비공방'], []),
    '얼굴 없는 장터': (['Faceless Market'], []),
    '여우상담실': (['여우 상담실'], []),
    '착한 친구 키링': (['착한 친구', '좋은 친구', 'Good friend', 'Kind friend'], ['착한 친구 키링']),
    '우주 쇼핑몰': (['우주쇼핑'], []),
    '친절한 씨앗 키트': (['씨앗 키트', 'Seed Kit'], ['친절한 씨앗 키트']),
    '이빨 요정': (['Tooth Fairy', '이빨나무', '이빨요정', '치아 나무', '치아나무', '치아 요정', '치아요정'], []),
}


def key_print(key):
    """키 지문 (core/update.ts keyPrint와 같게): 쉼표로 나눠 다듬고 다시 이은 글의 FNV-1a 32비트"""
    norm = ','.join(k.strip() for k in str(key or '').split(',') if k.strip())
    h = 0x811c9dc5
    for b in norm.encode('utf-8'):
        h = ((h ^ b) * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def _folder_word(name):
    return re.sub(r'[^\w]', '', name or '').replace('_', '')


def lore_activation(entries):
    """키 정리 + @@dont_activate + 자리 항목. 카드가 낸 적 있는 키 지문(원래 키, 정리한 키)을 돌려준다 (매니페스트 keys)"""
    kinds = {e['key']: MANAGED_FOLDERS[w] for e in entries if e.get('mode') == 'folder' and (w := _folder_word(e.get('comment'))) in MANAGED_FOLDERS}
    edits = dict(KEY_EDITS)
    prints = {}
    for e in entries:
        kind = kinds.get(e.get('folder'))
        if not kind or e.get('mode') == 'folder' or not str(e.get('key') or '').strip():
            continue
        name = e.get('comment', '')
        keys = [k.strip() for k in str(e['key']).split(',') if k.strip()]
        before = key_print(e['key'])
        drop, add = edits.pop(name, ([], []))
        missing = [k for k in drop if k not in keys]
        if missing:
            raise SystemExit(f'키 정리 실패: {name}에 {missing} 키가 없어요')
        keys = [k for k in keys if k not in drop]
        if kind == 'agent':
            # 로마자는 하이픈 쓴 것 하나만 (Gi-seok, Giseok → Gi-seok). 플러그인이 하이픈·띄어쓰기 변형을 같게 본다
            hyph = {k.replace('-', '').lower() for k in keys if '-' in k}
            keys = [k for k in keys if '-' in k or k.lower() not in hyph]
        keys += [k for k in add if k not in keys]
        e['key'] = ', '.join(keys)
        if name in AGENT_ORDER_FIX:
            e['insertorder'] = 600
        if not e.get('content', '').lstrip().startswith(DONT_ACTIVATE):
            e['content'] = DONT_ACTIVATE + '\n' + e.get('content', '')
        prints[name] = sorted({before, key_print(e['key'])})
    if edits:
        raise SystemExit(f'키 정리 실패: 로어북을 찾지 못했어요 {sorted(edits)}')
    settings = next(e for e in entries if e.get('mode') == 'folder' and e.get('comment') == SETTINGS_FOLDER_NAME)
    names = {c for c, _, _ in LORE_SLOTS}
    entries = [e for e in entries if e.get('comment') not in names]
    for comment, var, order in LORE_SLOTS:
        entries.append({'key': '', 'secondkey': '', 'comment': comment, 'content': '{{getvar::' + var + '}}', 'mode': 'normal',
                        'insertorder': order, 'alwaysActive': True, 'selective': False, 'useRegex': False,
                        'folder': settings['key'], 'bookVersion': 2})
    return entries, prints


# 원본 지침 문장 고치기 (주석 이름, 옛 문장, 새 문장). 옛 문장이 없으면 빌드를 멈춘다
LORE_PATCHES = [
    ('Phone',
     'For conversational pacing only, use type="pause", sender="-", content=a brief pause without external events.',
     'For a time gap only, use type="pause", sender="-", content=a short elapsed-time marker in Korean such as "잠시 후" or "10분 후" (at most 12 characters). '
     'A pause never narrates: no names, actions, emotions, sounds or scene description. Put such things in the NPC\'s own message text or omit them.'),
]


def patch_lore(entries):
    for comment, old, new in LORE_PATCHES:
        hit = [e for e in entries if e.get('comment') == comment and old in (e.get('content') or '')]
        if not hit:
            raise SystemExit(f'로어북 고치기 실패: {comment}')
        for e in hit:
            e['content'] = e['content'].replace(old, new)
    return entries


# 플러그인이 읽지 않는 섹션 (원본 Lightboard가 쓰던 것)
DEAD_SECTIONS = {
    'GNet': ['MANIFEST.LB', 'LB.FORMAT', 'LB.INTERACTION', 'LB.THOUGHTS', 'LB.THOUGHTS-INTERACTION', 'REACT.FORMAT',
             'INCOMING.FORMAT', 'TITLE.FORMAT', 'LB.LEGACY_OUTPUT'],
    'LB Backend': ['LBDATA', 'LIGHTBOARD-CHAR-DESC', 'LIGHTBOARD-MAX-CONTEXT', 'THOUGHTS', 'OUTRO'],
}
GUIDE_HEADERS = {
    'GNet': '<!-- GNet: 괴담넷 생성 지침. 플러그인이 요청마다 필요한 섹션만 골라 씁니다. 자동 활성화 OFF / 키워드 비움. 섹션 구분 줄은 그대로 두세요. -->',
    'Phone': '<!-- Phone: 괴담톡 생성 지침. 플러그인이 요청마다 필요한 섹션만 골라 씁니다. 자동 활성화 OFF / 키워드 비움. 섹션 구분 줄은 그대로 두세요. -->',
    'Wiki': '<!-- Wiki: 위키 생성 지침. 플러그인이 요청마다 필요한 섹션만 골라 씁니다. 자동 활성화 OFF / 키워드 비움. 섹션 구분 줄은 그대로 두세요. -->',
}


def tidy_guides(entries):
    """안 쓰는 섹션을 빼고, LB Backend(괴담넷 생성 틀)를 GNet 끝으로 합치고, 지침 머리 주석을 지금 구조에 맞게 바꾼다"""
    by = {e.get('comment'): e for e in entries if e.get('comment') in ('GNet', 'LB Backend', 'Phone', 'Wiki')}
    if set(by) != {'GNet', 'LB Backend', 'Phone', 'Wiki'}:
        raise SystemExit(f'지침 로어북이 모자라요: {sorted(by)}')
    for name, dead in DEAD_SECTIONS.items():
        text = by[name]['content']
        for sec in dead:
            text, n = re.subn(r'@@SECTION ' + re.escape(sec) + r'\n[\s\S]*?\n@@END\n*', '', text)
            if n != 1:
                raise SystemExit(f'{name} 로어북에 {sec} 섹션이 없어요')
        by[name]['content'] = text
    lb = by['LB Backend']['content']
    by['GNet']['content'] = by['GNet']['content'].rstrip() + '\n\n' + lb[re.search(r'^@@SECTION ', lb, re.M).start():].strip() + '\n'
    for name, head in GUIDE_HEADERS.items():
        text = by[name]['content']
        by[name]['content'] = head + '\n\n' + re.sub(r'^\s*<!--[\s\S]*?-->\s*', '', text)
    return [e for e in entries if e.get('comment') != 'LB Backend']


def to_ccv3(e):
    """모듈 로어북 항목 → card.json character_book 항목 (Risu가 내보내는 모양)"""
    folder = e.get('mode') == 'folder'
    out = {
        'keys': [e.get('key', '')] if folder else str(e.get('key', '')).split(','),
        'content': e.get('content', ''), 'extensions': {}, 'enabled': True, 'insertion_order': e.get('insertorder', 100),
        'constant': bool(e.get('alwaysActive')), 'selective': bool(e.get('selective')), 'name': e.get('comment', ''),
        'comment': e.get('comment', ''), 'case_sensitive': False, 'use_regex': bool(e.get('useRegex')), 'mode': e.get('mode', 'normal'),
    }
    if e.get('selective') and e.get('secondkey'):
        out['secondary_keys'] = str(e['secondkey']).split(',')
    if e.get('folder'):
        out['folder'] = e['folder']
    return out


def drop_settings(entries):
    """설정값은 플러그인 창·저장소로 옮겼으므로 Settings 로어북은 Lite 카드에 넣지 않는다"""
    return [e for e in entries if e.get('comment') not in SETTINGS_BOOKS]


UPDATE_FILE = 'card-update.json'
# Risu 웹은 외부 파일을 프록시로 받는데, 1MB 넘는 파일은 제대로 못 받는다(v0.16.3에서 빈 객체가 옴).
# 그래서 카드 데이터를 작은 조각(card-update.N.txt)으로 나누고 card-update.json에는 목록만 둔다.
UPDATE_PART_BYTES = 200_000


def write_update(folder, payload):
    folder = Path(folder)
    for old in folder.glob('card-update.*.txt'):
        old.unlink()
    text = json.dumps(payload, ensure_ascii=False)
    parts, buf, size = [], [], 0
    for ch in text:
        n = len(ch.encode('utf-8'))
        if size + n > UPDATE_PART_BYTES:
            parts.append(''.join(buf))
            buf, size = [], 0
        buf.append(ch)
        size += n
    if buf:
        parts.append(''.join(buf))
    names = []
    for i, part in enumerate(parts, 1):
        name = f'card-update.{i}.txt'
        (folder / name).write_text(part, encoding='utf-8')
        names.append(name)
    index = {'schema': payload['schema'], 'version': payload['version'], 'minPlugin': payload['minPlugin'],
             'parts': names, 'length': len(text.encode('utf-16-le')) // 2}  # JS 글자 수(UTF-16)
    (folder / UPDATE_FILE).write_text(json.dumps(index, ensure_ascii=False), encoding='utf-8')
    return len(names)
CARD_NAME = '괴이: 이면세계'  # 정식 이름 (src/ui/brand.ts BRAND.name과 같게)


def update_payload(data, risu, module, version, min_plugin):
    """플러그인 창의 「업데이트」가 받는 카드 데이터 (Risu 캐릭터 객체 이름, 사진·에셋·이름 제외). core/update.ts CARD_FIELDS와 맞춘다"""
    return {
        'schema': 1,
        'version': version,
        'minPlugin': min_plugin,  # 카드가 실제로 요구하는 플러그인 (package.json goei.minPlugin). 카드만 바뀐 판은 옛 플러그인에서도 받게
        'data': {
            'characterVersion': version,
            'firstMessage': data.get('first_mes', ''),
            'alternateGreetings': data.get('alternate_greetings', []),
            'creatorNotes': data.get('creator_notes', ''),
            'desc': data.get('description', ''),
            'personality': data.get('personality', ''),
            'scenario': data.get('scenario', ''),
            'exampleMessage': data.get('mes_example', ''),
            'systemPrompt': data.get('system_prompt', ''),
            'postHistoryInstructions': data.get('post_history_instructions', ''),
            'backgroundHTML': risu.get('backgroundHTML', ''),
            'lowLevelAccess': False,
            'virtualscript': '',
            'triggerscript': [],
            'globalLore': module['lorebook'],
            'customscript': module['regex'],  # Risu 캐릭터 필드 이름
        },
    }


# 위키 이미지 (assets/wiki 의 괴이·특수·세력). 파일명이 곧 에셋 이름 = 명부 영문명 (src/host/assets.ts mainPic·facePic)
WIKI_DIRS = ('Anomalies', 'Mystic Sites', 'Factions', 'Situations')  # Situations: 그림 없는 상황의 종류별 공용 그림
# 요원 기본 그림 「영문명_default」 (사용자가 2026-10-19 올림). 큰 사진이자 얼굴 틀로 자르는 원본 (src/host/assets.ts AGENT_CROPS)
AGENT_DIR = 'agents'
# 예전 시작 화면 세력 기본 그림. 사진 규칙에서 뺐다 (세력 그림은 명부 영문명)
DROP_ASSETS = {'f01', 'f02', 'f03', 'f04', 'f05'}


def add_wiki_assets(data, others):
    """카드 에셋에 위키 이미지를 넣는다. 카드에 같은 이름(대소문자 무시)이 있으면 카드 것을 둔다"""
    assets = data.setdefault('assets', [])
    for a in [a for a in assets if a.get('name') in DROP_ASSETS]:
        assets.remove(a)
        path = a.get('uri', '').replace('embeded://', '')
        others.pop(path, None)
        others.pop(f"x_meta/{Path(path).stem}.json", None)
    have = {str(a.get('name', '')).lower() for a in assets}
    added = 0
    files = [f for folder in WIKI_DIRS for f in sorted((ROOT / 'assets' / 'wiki' / folder).glob('*.avif'))]
    files += sorted((ROOT / 'assets' / AGENT_DIR).glob('*_default.avif'))
    for f in files:
        if f.stem.lower() in have:
            continue
        have.add(f.stem.lower())
        added += 1
        path = f'assets/other/image/wiki{added:03d}.avif'
        assets.append({'type': 'x-risu-asset', 'uri': f'embeded://{path}', 'name': f.stem, 'ext': 'avif'})
        others[path] = f.read_bytes()
        others[f'x_meta/wiki{added:03d}.json'] = b'{"type":"AVIF"}'
    return added


def shrink_maps(others):
    """원본 지도(1402px)를 assets/maps 의 줄인 지도(1100px, AVIF 품질 50)로 바꾼다. 이름·경로는 그대로"""
    swapped = 0
    for f in sorted((ROOT / 'assets' / 'maps').glob('map*.avif')):
        path = f'assets/other/image/{f.name}'
        if path in others:
            others[path] = f.read_bytes()
            swapped += 1
    return swapped


PIC_DIR = 'pic'


def card_pictures(data, others):
    """카드 사진 목록 [이름, 지문, 확장자, 바이트]. 창의 업데이트가 지문이 바뀐 카드 사진만 받아 바꾼다 (src/host/picpack.ts)"""
    out = []
    for a in data.get('assets', []):
        path = str(a.get('uri', '')).replace('embeded://', '')
        if a.get('type') != 'x-risu-asset' or path not in others:
            continue
        b = others[path]
        out.append([a['name'], hashlib.sha1(b).hexdigest()[:12], a.get('ext') or Path(path).suffix[1:], len(b)])
    return out


def write_pictures(folder, pictures, data, others):
    """사진을 「pic/지문.확장자」로 쓴다 (저장소 release 폴더에서 창이 받는다). 지난 판 파일은 지운다"""
    folder = Path(folder) / PIC_DIR
    folder.mkdir(parents=True, exist_ok=True)
    by_name = {a['name']: str(a.get('uri', '')).replace('embeded://', '') for a in data.get('assets', [])}
    keep = set()
    for name, digest, ext, _ in pictures:
        f = folder / f'{digest}.{ext}'
        keep.add(f.name)
        if not f.exists():
            f.write_bytes(others[by_name[name]])
    for old in folder.iterdir():
        if old.name not in keep:
            old.unlink()
    return len(keep)


def main(src, dst):
    scenarios = load_scenarios()
    with zipfile.ZipFile(src) as z:
        names = z.namelist()
        card = json.loads(z.read('card.json'))
        module = read_module(z.read('module.risum')) if 'module.risum' in names else None
        others = {n: z.read(n) for n in names if n not in ('card.json', 'module.risum', 'charx.json')}

    data = card['data']
    wiki_assets = add_wiki_assets(data, others)
    maps = shrink_maps(others)
    pictures = card_pictures(data, others)
    risu = data.setdefault('extensions', {}).setdefault('risuai', {})
    lore = (module or {}).get('lorebook') or (data.get('character_book') or {}).get('entries') or []
    regex = (module or {}).get('regex') or risu.get('customScripts') or []

    greetings, greeting_index = build_openings(data['first_mes'], scenarios)
    pkg = json.loads((ROOT / 'package.json').read_text(encoding='utf-8'))
    version = pkg['version']
    min_plugin = pkg.get('goei', {}).get('minPlugin', version)
    manifest = {
        'schema': 1,
        'plugin': 'goei-plugin',
        'version': version,
        'source': {'name': data.get('name'), 'version': data.get('character_version')},
        'greetings': greeting_index,
        # 사진·에셋 지문: 카드 업데이트(글 내용만 옮김)로 못 옮기는 사진이 바뀌었는지 창이 알 수 있게
        # 카드 사진 [이름, 지문, 확장자, 바이트]: 업데이트가 지문이 바뀐 것만 받아 바꾼다
        'pictures': pictures,
        'assets': hashlib.sha1(''.join(f'{n}:{hashlib.sha1(b).hexdigest()};' for n, b in sorted(others.items())).encode()).hexdigest()[:12],
    }
    # Risu 캐릭터 정보의 「캐릭터 버전」도 이 카드 버전으로 (원본의 2.4가 남지 않게)
    data['character_version'] = version
    lore = [e for e in lore if e.get('comment') not in (MANIFEST_COMMENT, OLD_MANIFEST)]
    lore = add_wiki_base(migrate_directory(tidy_guides(patch_lore(drop_settings(lore)))))
    lore, manifest['keys'] = lore_activation(lore)
    settings = next(e for e in lore if e.get('mode') == 'folder' and e.get('comment') == SETTINGS_FOLDER_NAME)
    lore.append({
        'key': MANIFEST_KEY, 'secondkey': '', 'insertorder': 0, 'comment': MANIFEST_COMMENT,
        'content': json.dumps(manifest, ensure_ascii=False), 'mode': 'normal', 'alwaysActive': False,
        'selective': False, 'useRegex': False, 'folder': settings['key'], 'bookVersion': 2,
    })
    kept_regex = [r for r in regex if r.get('comment') in KEEP_REGEX]
    missing = set(KEEP_REGEX) - {r.get('comment') for r in kept_regex}
    if missing:
        raise ValueError(f'유지할 정규식이 없습니다: {missing}')

    data['name'] = CARD_NAME
    data['first_mes'] = LANDING
    data['alternate_greetings'] = greetings
    data['creator_notes'] = creator_notes(data.get('creator_notes'))
    risu['backgroundHTML'] = status_css(risu.get('backgroundHTML'))
    risu['lowLevelAccess'] = False
    risu['virtualscript'] = ''
    risu.pop('triggerscript', None)
    risu.pop('customScripts', None)
    if data.get('character_book'):
        data['character_book']['entries'] = [to_ccv3(e) for e in lore]

    lite_module = {
        'name': f"{data['name']} Module",
        'description': f"Module for {data['name']}",
        'id': str(uuid.uuid4()),
        'trigger': [],
        'regex': kept_regex,
        'lorebook': lore,
        'assets': [],
    }
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('card.json', json.dumps(card, ensure_ascii=False, indent=1))
        z.writestr('module.risum', write_module(lite_module))
        for name, blob in others.items():
            z.writestr(name, blob, compress_type=zipfile.ZIP_STORED)
    payload = update_payload(data, risu, lite_module, version, min_plugin)
    parts = write_update(Path(dst).parent, payload)
    pic_files = write_pictures(Path(dst).parent, pictures, data, others)
    # 창이 열릴 때 받는 작은 버전 정보 (플러그인·카드를 같은 버전으로 함께 낸다)
    Path(dst).with_name('version.json').write_text(json.dumps(
        {'card': version, 'plugin': version, 'minPlugin': payload['minPlugin']}), encoding='utf-8')
    print(json.dumps({
        'output': str(dst), 'update': UPDATE_FILE, 'parts': parts, 'greetings': len(greetings), 'lore': len(lore), 'regex': len(kept_regex), 'wikiAssets': wiki_assets, 'maps': maps, 'pictures': pic_files,
        'backgroundHTML': len(risu['backgroundHTML']), 'first_mes': len(LANDING),
    }, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
