#!/usr/bin/env python3
"""경량 카드(charx)에서 브라우저 시험용 fixture.json 을 만든다: python3 tests/editor-fixture.py <경량.charx> <fixture.json>"""
import json, sys, zipfile
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'tools'))
from build_lite_card import read_module  # noqa: E402

z = zipfile.ZipFile(sys.argv[1])
card = json.loads(z.read('card.json'))['data']
module = read_module(z.read('module.risum'))
Path(sys.argv[2]).write_text(json.dumps({'name': card['name'], 'globalLore': module['lorebook'], 'alternateGreetings': card.get('alternate_greetings', [])}, ensure_ascii=False), encoding='utf-8')
print('fixture:', sys.argv[2], len(module['lorebook']), 'lore entries')
