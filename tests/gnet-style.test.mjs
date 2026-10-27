// 괴담넷 성격 전환: 설정 style(gal·net·wpf)에 따라 지침 소개·말투·주제 절이 바뀌고 메뉴 이름이 바뀐다 (큰 틀은 그대로)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { evaluate, GN_DEFAULTS, gnetLabel } from '../dist-test/core.mjs';

const patches = JSON.parse(readFileSync('card/gnet-style.json', 'utf8'));
const pick = (label) => Object.values(patches).map((v) => [v.old, v.new]).find(([o]) => o.includes(label));
const ev = (text, style) => evaluate(text, { vars: { '$lb_cfg_lb-gn.style': style } });

test('설정: 기본 net(괴담넷), 이름 표', () => {
  assert.equal(GN_DEFAULTS.style, 'net');
  assert.equal(gnetLabel({}), '괴담넷');
  assert.equal(gnetLabel({ '$lb_cfg_lb-gn.style': 'gal' }), '괴담갤');
  assert.equal(gnetLabel({ '$lb_cfg_lb-gn.style': 'wpf' }), '세정게');
  assert.equal(gnetLabel({ '$lb_cfg_lb-gn.style': 'zzz' }), '괴담넷');
});

test('지침 패치: 성격마다 소개·말투·주제가 하나씩만 남는다', () => {
  const [, about] = pick('괴담넷 is a Korean anonymous public forum');
  const [, tone] = pick('Default to Korean DCInside-style');
  const [, topics] = pick('Use local rumors, eyewitness reports');
  for (const [style, name, other] of [['gal', '괴담갤', '세계정치'], ['net', '괴담넷 is a Korean anonymous forum', '괴담갤'], ['wpf', '세계정치 게시판', '괴담갤']]) {
    const a = ev(about, style);
    assert.ok(a.includes(name) && !a.includes(other), `${style} about`);
    assert.ok(!a.includes('{{'), `${style} about 잔여 CBS`);
    const t = ev(tone, style);
    assert.ok(t.includes('Default to Korean DCInside-style'), `${style} 기본 말투 유지`);
    assert.equal(t.includes('World Politics Forum texture'), style === 'wpf');
    assert.equal(t.includes('trade flavor'), style === 'net');
    const p = ev(topics, style);
    assert.equal(p.includes('conspiracy threads'), style === 'wpf');
    assert.equal(p.includes('scary stories'), style === 'gal');
    assert.equal(p.includes('Use local rumors, eyewitness reports'), style === 'net');
    assert.ok(!p.includes('{{'), `${style} topics 잔여 CBS`);
  }
});
