"""필드 대사 팩 (src/game/world/dialogue.json).

game-src/dialogue/ 의 인물 52명·NPC 14종 대사에서 말풍선(bark)만 뽑고, eco/ 생태계 대사를 합쳐 한 파일로.
게임 코드 팩에 묶여 들어간다(저장소에서 받아 오지 않음). 대화창 첫마디(talk)는 넣지 않는다.
사용법: python3 tools/build_dialogue.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / 'game-src/dialogue'
OUT = ROOT / 'src/game/world/dialogue.json'


def barks(cell):
    """CELL {ally:{bark,talk}, enemy:{...}} → {ally:[...], enemy:[...]}"""
    if not isinstance(cell, dict):
        return None
    return {k: list(v.get('bark', [])) for k, v in cell.items() if isinstance(v, dict)}


def persona(p):
    out = {}
    for k, v in (p or {}).items():
        if k == 'same':
            out['same'] = {r: barks(c) for r, c in v.items()}
        else:
            out[k] = barks(v)
    return out


def main():
    chars, npc = {}, {}
    for f in sorted((D / 'characters').glob('*.json')):
        d = json.loads(f.read_text())
        chars[d['name']] = {
            'faction': d.get('faction'), 'level': d.get('level'), 'address': d.get('address', {}),
            'persona': persona(d.get('persona')), 'time': d.get('time', {}), 'situation': d.get('situation', {}),
            'eco': {},
        }
    for f in sorted((D / 'npc').glob('*.json')):
        d = json.loads(f.read_text())
        # voice = 말투 한 줄 (몹에게 말을 걸 때 모델에 넣는다, 10-31)
        npc[d['type']] = {'faction': d.get('faction'), 'voice': d.get('voice', ''), 'persona': persona(d.get('persona')), 'time': d.get('time', {}), 'situation': d.get('situation', {}), 'eco': {}}
    for f in sorted((D / 'eco/characters').glob('*.json')):
        d = json.loads(f.read_text())
        if d['name'] in chars:
            chars[d['name']]['eco'] = d.get('eco', {})
    for f in sorted((D / 'eco/npc').glob('*.json')):
        d = json.loads(f.read_text())
        if d['type'] in npc:
            npc[d['type']]['eco'] = d.get('eco', {})
    OUT.write_text(json.dumps({'version': 1, 'characters': chars, 'npc': npc}, ensure_ascii=False, separators=(',', ':')))
    print(OUT, OUT.stat().st_size, len(chars), len(npc), sum(1 for c in chars.values() if c['eco']), sum(1 for c in npc.values() if c['eco']))


main()
