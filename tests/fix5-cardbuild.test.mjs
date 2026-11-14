// 카드 빌드 도구(tools/build_lite_card.py)의 로어북 패치 (11-14 재검토 1-5, 사용자 결정 6)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const PY = `
import sys, json, zipfile
sys.path.insert(0, 'tools')
import build_lite_card as b
with zipfile.ZipFile('card/원본_봇카드.jpeg') as z:
    names = z.namelist()
    card = json.loads(z.read('card.json'))
    module = b.read_module(z.read('module.risum')) if 'module.risum' in names else None
lore = (module or {}).get('lorebook') or (card['data'].get('character_book') or {}).get('entries') or []
mid = b.add_extra_lore(b.patch_lore(b.drop_settings(lore)))
mark = 'Outside Summoning'
print(json.dumps({
    'main': [mark in (e.get('content') or '') for e in mid if e.get('comment') == '화요퀴즈쇼'],
    'appendix': [mark in (e.get('content') or '') for e in mid if e.get('comment') == '화요퀴즈쇼 · 합창단 퍼레이드'],
    'patches': [c for c, old, new in b.LORE_PATCHES if mark in new],
}))
`;

test('카드 빌드: 합창단 퍼레이드 절은 부록에만 있고 화요퀴즈쇼 본 항목에 다시 붙지 않는다', () => {
  const r = spawnSync('python3', ['-c', PY], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.deepEqual(out.patches, [], '본 항목에 퍼레이드 절을 붙이는 패치가 없다');
  assert.deepEqual(out.main, [false], '화요퀴즈쇼 본 항목');
  assert.deepEqual(out.appendix, [true], '부록 항목');
});
