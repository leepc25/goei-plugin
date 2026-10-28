#!/usr/bin/env python3
"""원본 카드(charx 또는 charx 가 붙은 JPEG)의 module.risum 을 JSON 으로 푼다.
단위 시험의 「실제 카드」 묶음(advanced·directory·factions·gnet·phone·player·settings·wiki·world)이 이 파일을 읽는다.

사용법: python3 tests/extract_module.py [원본 카드] [결과 json]
  기본값: card/원본_봇카드.jpeg → dist-test/real-module.json   (npm run build 가 부른다)
"""
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
from build_lite_card import read_module  # noqa: E402

src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'card' / '원본_봇카드.jpeg'
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'dist-test' / 'real-module.json'
with zipfile.ZipFile(src) as z:
    module = read_module(z.read('module.risum'))
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(json.dumps({'module': module, 'type': 'risuModule'}, ensure_ascii=False), encoding='utf-8')
print(f'{dst}: lorebook {len(module.get("lorebook", []))} entries, regex {len(module.get("regex", []))}')
