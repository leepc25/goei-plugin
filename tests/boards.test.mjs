import test from 'node:test';
import assert from 'node:assert/strict';
import { boards } from '../dist-test/core.mjs';
const { boardState, boardWrite, viewSite } = boards;

test('사이트 변수는 괴담넷 이름으로 비추고 되돌린다', () => {
  const ss = { '$gn_raw': 'GN', '$lb_cfg_lb-gn.mood': 'a', '$gal_raw': 'GAL', '$lb_cfg_lb-gal.mood': 'b', '$gn_nick': '나', '$x': 1 };
  const v = boardState(ss, 'gal');
  assert.equal(v.$gn_raw, 'GAL');
  assert.equal(v['$lb_cfg_lb-gn.mood'], 'b');
  assert.equal(v.$gn_nick, '나');
  assert.equal(v.$gal_raw, undefined);
  assert.equal(viewSite(v), 'gal');
  const out = boardWrite({ scriptstate: ss }, { scriptstate: { ...v, '$gn_raw': 'GAL2', '$gn_keyfigures': '[]', '$gn_nick': '너' } }, 'gal').scriptstate;
  assert.equal(out.$gal_raw, 'GAL2');
  assert.equal(out.$gn_raw, 'GN');
  assert.equal(out.$gal_keyfigures, '[]');
  assert.equal(out.$gn_keyfigures, undefined);
  assert.equal(out.$gn_nick, '너');
  assert.equal(out.$gn_site, undefined);
  const gn = boardWrite({ scriptstate: ss }, { scriptstate: { ...boardState(ss, 'gn'), '$gn_raw': 'GN2' } }, 'gn').scriptstate;
  assert.equal(gn.$gn_raw, 'GN2');
  assert.equal(gn.$gal_raw, 'GAL');
  assert.equal(gn.$gn_site, undefined);
});
