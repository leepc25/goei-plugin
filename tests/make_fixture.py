#!/usr/bin/env python3
"""경량 카드에서 브라우저 테스트용 캐릭터 스냅샷을 만든다: make_fixture.py <경량.charx> <out.json>
지도·세력·인물 이미지는 out.json 옆 assets/ 에 풀고, additionalAssets 에 [이름, 경로, 확장자]로 적는다."""
import json, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_lite_card import read_module  # noqa: E402
z = zipfile.ZipFile(sys.argv[1])
out = Path(sys.argv[2])
card = json.loads(z.read('card.json'))['data']
mod = read_module(z.read('module.risum'))
(out.parent / 'assets').mkdir(parents=True, exist_ok=True)
assets = []
for a in card.get('assets', []):
    if a['name'] == 'main':
        continue
    src = a['uri'].replace('embeded://', '')
    path = f"assets/{a['name']}.{a['ext']}"
    (out.parent / path).write_bytes(z.read(src))
    assets.append([a['name'], path, a['ext']])
out.write_text(json.dumps({
    'name': card['name'], 'type': 'character', 'firstMessage': card['first_mes'],
    'alternateGreetings': card['alternate_greetings'], 'globalLore': mod['lorebook'], 'additionalAssets': assets,
}, ensure_ascii=False))
