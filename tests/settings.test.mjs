import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { settings as S, asset as A, DEFAULT_SETTINGS } from '../dist-test/core.mjs';

const REAL = '/mnt/project-files/analysis/extracted/module.json';
const realLore = existsSync(REAL) ? (() => { const m = JSON.parse(readFileSync(REAL, 'utf8')); return m.lorebook ?? m.module?.lorebook; })() : null;
const book = (obj) => [{ comment: 'Settings', content: JSON.stringify(obj) }];

test('Settings lorebook gives card defaults like the original', { skip: !realLore }, () => {
  assert.deepEqual(S.basicDefaults(realLore), { anomalyOn: true, assetOn: true, assetModel: 'main', assetLimit: 2, agentLimit: 12, supportOn: true });
  const w = S.worldSettings(realLore);
  assert.equal(w.preset_cap, 2);
  assert.equal(w.incident_p, 50);
  assert.equal(w.mystic_ttl, 24);
  assert.equal(w.extra_ms_cap, 3);
});

test('chat variables override, invalid values fall back', () => {
  const lore = book({ 기본설정: { '에셋 모델': '보조', '캐릭터당 이미지 수': 9, '요원 표시 인원': 5, '지원 투입': false }, 괴이생성: { '프리셋 괴이 상한': 4, '인시던트 발생 확률': 150, '랜덤 괴이 RP 유지 시간': 1.5 } });
  assert.deepEqual(S.basicDefaults(lore), { anomalyOn: true, assetOn: true, assetModel: 'aux', assetLimit: 2, agentLimit: 5, supportOn: false });
  const s = S.basicSettings(lore, { $st_asset_on: '0', $st_agent_limit: '30', $st_asset_limit: '3' });
  assert.equal(s.assetOn, false);
  assert.equal(s.agentLimit, 5);
  assert.equal(s.assetLimit, 3);
  const w = S.worldSettings(lore, { $st_agent_limit: '0' });
  assert.equal(w.preset_cap, 4);
  assert.equal(w.incident_p, DEFAULT_SETTINGS.incident_p);
  assert.equal(w.random_ttl, 1.5);
  assert.equal(w.agent_limit, 0);
  assert.deepEqual(S.missingBasicVars(lore, S.basicVars(s)), null);
  assert.deepEqual(S.missingBasicVars(lore, { $st_asset_on: '0' }), { $st_asset_model: 'aux', $st_asset_limit: '2', $st_agent_limit: '5', $st_support_on: '0' });
  assert.deepEqual(S.basicDefaults(undefined), S.BASIC_DEFAULTS);
  assert.equal(S.basicDefaults(book({ 기본설정: { 상황판: false } })).anomalyOn, false);
  assert.equal(S.basicDefaults(book({ 기본설정: { 통합관제: false } })).anomalyOn, false);
});

const IMG = {
  characters: ['Aileen', 'Lee Ha'],
  sfw_keywords: ['default', 'smile', 'angry'],
  kor_to_eng: { 에일린: 'Aileen', 이하: 'Lee Ha' },
};
const imgLore = [{ comment: 'Image tag', content: JSON.stringify(IMG) }];

test('Image tag data is validated', () => {
  const d = A.readImageData(imgLore);
  assert.deepEqual(d.characters, ['Aileen', 'Lee Ha']);
  assert.equal(d.aliases.get('에일린'), 'Aileen');
  assert.throws(() => A.readImageData([]), /Image tag/);
  assert.throws(() => A.readImageData([{ comment: 'Image tag', content: '{"characters":["Bad_Name"],"sfw_keywords":["a"]}' }]), /사용할 수 없는/);
  assert.throws(() => A.readImageData([{ comment: 'Image tag', content: '{"characters":["A"],"sfw_keywords":["a"],"kor_to_eng":{"가":"B"}}' }]), /characters에 없는/);
});

test('asset pass numbers paragraphs, keeps the status block and enforces limits', () => {
  const d = A.readImageData(imgLore);
  const body = '<img=Aileen_default>\n\n에일린이 웃었다.\n\n바람이 분다.\n\n에일린은 화가 났다.\n\n에일린이 다시 웃었다.\n[▣|상태|12:00]';
  const job = A.planAsset(body, d, 2);
  assert.ok(job);
  assert.equal(job.paras.length, 4);
  assert.ok(job.trailing.startsWith('[▣|'));
  const prompt = job.messages[0].content;
  assert.match(prompt, /\[1\] 에일린이 웃었다\./);
  assert.match(prompt, /Allowed Character Names[^\n]*\nAileen\n/);
  assert.doesNotMatch(prompt, /Lee Ha \(/);
  assert.match(prompt, /limit is 2 tags PER character/);
  const resp = 'Here:\n```json\n[{"line":1,"tag":"<img=\\"Aileen_smile\\">"},{"line":1,"tag":"<img=\\"Aileen_angry\\">"},{"line":2,"tag":"<img=\\"Aileen_fly\\">"},{"line":3,"tag":"<img=\\"Aileen_angry\\">"},{"line":4,"tag":"<img=\\"Aileen_smile\\">"},{"line":9,"tag":"<img=\\"Aileen_smile\\">"}]\n```';
  const out = A.finishAsset(job, resp, d, 2);
  assert.equal(out, '에일린이 웃었다.\n\n<img=Aileen_smile>\n\n바람이 분다.\n\n에일린은 화가 났다.\n\n<img=Aileen_angry>\n\n에일린이 다시 웃었다.\n[▣|상태|12:00]');
  assert.equal(A.finishAsset(job, '[]', d, 2), null);
  assert.equal(A.planAsset('바람만 분다.', d, 2), null);
  // 이름 뒤 조사는 인정, 다른 단어의 일부는 아님
  assert.deepEqual(A.activeCharacters('이하은이 왔다. 에일린에게 말했다.', d), ['Aileen']);
});

test('feature defaults keep only setting variables', () => {
  const p = S.setPrefs({ vars: { '$ph_model': 'main', '$lb_cfg_lb-gn.privacy': '3', '$nw_length': 'short', '$ph_state': '{}', '$gn_raw': 'x', '$nw_mode': 1 } });
  assert.deepEqual(p.vars, { '$ph_model': 'main', '$lb_cfg_lb-gn.privacy': '3', '$nw_length': 'short' });
  S.setPrefs({});
});
