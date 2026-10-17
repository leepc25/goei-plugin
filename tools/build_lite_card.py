#!/usr/bin/env python3
"""괴이봇 원본 charx(또는 JPEG에 붙은 charx)에서 플러그인용 경량 카드를 만든다.

원본 파일은 읽기만 한다. 결과물:
  - Lua 트리거 없음, 저수준 접근 없음
  - 시작/설정/지도/프리셋/괴담넷/위키/폰 패널 정규식 제거 (플러그인이 담당)
  - 285KB짜리 CBS 첫 메시지를 분기별 추가 인사말로 분리 (CBS 계산 없음)
  - 배경 HTML은 상태창·에셋 표시용 CSS만 남김
  - 로어북은 그대로, 플러그인 매니페스트 엔트리 1개 추가

사용법: python3 tools/build_lite_card.py <원본.charx|원본.jpeg> <결과.charx>
"""
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

MANIFEST_COMMENT = '괴이봇 플러그인 매니페스트'
MANIFEST_KEY = ''  # 빈 키: Risu가 키워드로 활성화하지 않음
KEEP_REGEX = ('🖼️에셋줄바꿈', '🖼️에셋출력', '🖼️에셋리퀘제거', '📊상태창')
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
    """괴이·미스틱 사이트·요원 목록을 「괴이봇 명부」로 옮긴다 (플러그인과 같은 코드를 node로 실행, 먼저 npm run build)"""
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp) / 'in.json', Path(tmp) / 'out.json'
        src.write_text(json.dumps(entries, ensure_ascii=False), encoding='utf-8')
        subprocess.run(['node', str(ROOT / 'scripts' / 'migrate-lore.mjs'), str(src), str(dst)], check=True)
        return json.loads(dst.read_text(encoding='utf-8'))


def drop_settings(entries):
    """설정값은 플러그인 창·저장소로 옮겼으므로 Settings 로어북은 Lite 카드에 넣지 않는다"""
    return [e for e in entries if e.get('comment') not in SETTINGS_BOOKS]


UPDATE_FILE = 'card-update.json'
CARD_NAME = '괴이: 이면세계'  # 정식 이름 (src/ui/brand.ts BRAND.name과 같게)


def update_payload(data, risu, module, version, min_plugin):
    """플러그인 창의 「업데이트」가 받는 카드 데이터 (Risu 캐릭터 객체 이름, 사진·에셋·이름 제외). core/update.ts CARD_FIELDS와 맞춘다"""
    return {
        'schema': 1,
        'version': version,
        'minPlugin': min_plugin,  # 카드가 실제로 요구하는 플러그인 (package.json goei.minPlugin). 카드만 바뀐 판은 옛 플러그인에서도 받게
        'data': {
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
            'customscripts': module['regex'],
        },
    }


def main(src, dst):
    scenarios = load_scenarios()
    with zipfile.ZipFile(src) as z:
        names = z.namelist()
        card = json.loads(z.read('card.json'))
        module = read_module(z.read('module.risum')) if 'module.risum' in names else None
        others = {n: z.read(n) for n in names if n not in ('card.json', 'module.risum', 'charx.json')}

    data = card['data']
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
    }
    lore = [e for e in lore if e.get('comment') != MANIFEST_COMMENT]
    lore = migrate_directory(drop_settings(lore))
    lore.append({
        'key': MANIFEST_KEY, 'secondkey': '', 'insertorder': 0, 'comment': MANIFEST_COMMENT,
        'content': json.dumps(manifest, ensure_ascii=False), 'mode': 'normal', 'alwaysActive': False,
        'selective': False, 'useRegex': False, 'bookVersion': 2,
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
        data['character_book']['entries'] = drop_settings([e for e in data['character_book']['entries']
                                                           if e.get('comment') != MANIFEST_COMMENT])

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
    Path(dst).with_name(UPDATE_FILE).write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
    # 창이 열릴 때 받는 작은 버전 정보 (플러그인·카드를 같은 버전으로 함께 낸다)
    Path(dst).with_name('version.json').write_text(json.dumps(
        {'card': version, 'plugin': version, 'minPlugin': payload['minPlugin']}), encoding='utf-8')
    print(json.dumps({
        'output': str(dst), 'update': UPDATE_FILE, 'greetings': len(greetings), 'lore': len(lore), 'regex': len(kept_regex),
        'backgroundHTML': len(risu['backgroundHTML']), 'first_mes': len(LANDING),
    }, ensure_ascii=False))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
