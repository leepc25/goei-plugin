"""새 대사 팩 (game-pack/dialogue/): game-src/dialogue2/ 의 인물·NPC 대사 파일을 gzip 으로 묶는다.

- 이름 인물: game-src/dialogue2/characters/<이름>.json → c_<이름>.json.gz
- NPC: game-src/dialogue2/npc/<원형>_<남|여>.json → n_<원형>_<남|여>.json.gz
- 목록: index.json {chars:[이름…], npc:[파일 이름…]}
게임은 bridge.assets.bytes('dialogue', 파일) 로 받아 DecompressionStream('gzip') 으로 푼다 (src/game/world/dialogue2.ts).
팩은 required (시작 화면 「받기」에서 코드와 함께 받는다). 16MB → 약 3MB.
사용법: python3 tools/build_dialogue2_pack.py
"""
import gzip
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'game-src/dialogue2'
OUT = ROOT / 'game-pack/dialogue'


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob('*.json.gz'):
        old.unlink()
    chars, npc = [], []
    total = packed = 0
    for sub, prefix, names in (('characters', 'c_', chars), ('npc', 'n_', npc)):
        for f in sorted((SRC / sub).glob('*.json')):
            d = json.loads(f.read_text(encoding='utf-8'))
            raw = json.dumps(d, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
            # mtime 0: 내용이 같으면 바이트도 같게 (팩 지문이 쓸데없이 바뀌지 않게)
            gz = gzip.compress(raw, compresslevel=9, mtime=0)
            (OUT / f'{prefix}{f.stem}.json.gz').write_bytes(gz)
            names.append(f.stem)
            total += len(raw)
            packed += len(gz)
    (OUT / 'pack.json').write_text(json.dumps({'id': 'dialogue', 'required': True}) + '\n', encoding='utf-8')
    (OUT / 'index.json').write_text(json.dumps({'version': 2, 'chars': chars, 'npc': npc}, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f'{OUT}: 인물 {len(chars)} · NPC {len(npc)} · {total / 1048576:.1f}MB → {packed / 1048576:.1f}MB')


main()
