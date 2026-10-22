"""게임 NPC 자유 대화용 인물 시트 (src/game/action/npc/sheets.json).

원본 카드(card/원본_봇카드.jpeg 뒤에 붙은 charx의 card.json) 로어북에서 「### Character -」 항목만 꺼내
대화에 필요 없는 칸(외모)을 빼고 줄인다. 플러그인에서는 지금 채팅 카드의 로어북을 다시 읽어 같은 규칙
(npc/sheet.ts trimSheet)으로 줄이므로, 이 파일은 시연판과 로어북을 못 읽었을 때의 대체본이다.
CBS({{getvar::st_faction}} 등)는 그대로 둔다. 게임이 상황에 맞게 푼다.

    python3 tools/npc_sheets.py
"""
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CARD = ROOT / 'card' / '원본_봇카드.jpeg'
OUT = ROOT / 'src' / 'game' / 'action' / 'npc' / 'sheets.json'

# npc/sheet.ts trimSheet와 같은 규칙
DROP = {'Appearance'}
CAP = {'Background': 2, 'Abilities': 2}
LIMIT = 2600


def trim(text: str) -> str:
    parts = re.split(r'^(#### .+)$', text.strip(), flags=re.M)
    out = [parts[0].strip()]
    for i in range(1, len(parts), 2):
        head = parts[i][5:].strip()
        body = parts[i + 1].strip() if i + 1 < len(parts) else ''
        if head in DROP:
            continue
        lines = [l for l in body.split('\n') if l.strip() and l.strip() != '---']
        if head in CAP:
            keep, n = [], 0
            for l in lines:
                if l.lstrip().startswith('- '):
                    n += 1
                    if n > CAP[head]:
                        break
                keep.append(l)
            lines = keep
        out.append(f'#### {head}\n' + '\n'.join(lines))
    s = '\n\n'.join(x for x in out if x)
    return s if len(s) <= LIMIT else s[:LIMIT].rsplit('\n', 1)[0]


def main() -> None:
    raw = CARD.read_bytes()
    z = zipfile.ZipFile(io.BytesIO(raw[raw.index(b'PK\x03\x04'):]))
    card = json.loads(z.read('card.json'))
    sheets = {}
    for e in card['data']['character_book']['entries']:
        c = e.get('content', '')
        if not c.startswith('### Character'):
            continue
        sheets[e['comment']] = trim(c)
    OUT.write_text(json.dumps(sheets, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
    print(f'{len(sheets)}명, {OUT.stat().st_size // 1024}KB → {OUT.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
