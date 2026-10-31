// QC(시작기·설치·업데이트 영역, 2026-10-28): 카드 업데이트 합치기의 옛 판 카드 경우. 먼저 npm run build (dist-test/core.mjs)
import test from 'node:test';
import assert from 'node:assert/strict';
import { planUpdate, cardVersion } from '../dist-test/core.mjs';

const manifest = (version) => ({ comment: 'Plugin manifest', content: JSON.stringify({ schema: 1, plugin: 'goei-plugin', version, greetings: {} }), key: '', mode: 'normal' });
const slots = ['Faction', 'Mystic', 'Anomaly', 'Agent'].map((k) => ({ comment: `📚Lore slot · ${k}`, content: '{{getvar::goei_lore_x}}', key: '', mode: 'normal', alwaysActive: true }));

test('옛 판 카드(자리 항목 4개)를 새 판으로: 자리 항목은 빠지고 직접 넣은 항목·명부는 남는다', () => {
  const char = {
    name: '내 이름',
    globalLore: [
      { comment: 'Directory', content: '{"schema":1,"내가 고친 값":1}', key: '', mode: 'normal' },
      ...slots,
      { comment: '내가 넣은 로어북', content: '메모', key: '', mode: 'normal' },
      manifest('0.16.60'),
    ],
    customscript: [],
  };
  const payload = { schema: 1, version: '0.17.8', minPlugin: '0.17.0', data: { globalLore: [{ comment: 'Directory', content: '{"schema":1}', key: '', mode: 'normal' }, manifest('0.17.8')], customscript: [] } };
  const plan = planUpdate(char, payload);
  const names = plan.next.globalLore.map((e) => e.comment);
  assert.ok(!names.some((n) => n.startsWith('📚Lore slot')), `자리 항목 없음: ${names}`);
  assert.ok(names.includes('내가 넣은 로어북'));
  assert.match(plan.next.globalLore.find((e) => e.comment === 'Directory').content, /내가 고친 값/, '명부 보존');
  assert.equal(cardVersion(plan.next.globalLore), '0.17.8');
  assert.equal(plan.lore.kept, 1, '직접 넣은 항목만 「유지」로 센다');
  assert.equal(plan.lore.protected, 1, '명부 보존');
});

test('새 카드에 같은 이름의 자리 항목이 있으면 그대로 합친다 (자리 항목을 쓰는 판끼리)', () => {
  const char = { globalLore: [...slots, manifest('0.16.50')], customscript: [] };
  const payload = { schema: 1, version: '0.16.60', minPlugin: '0.16.0', data: { globalLore: [...slots.map((s) => ({ ...s, content: 'new' })), manifest('0.16.60')], customscript: [] } };
  const plan = planUpdate(char, payload);
  const got = plan.next.globalLore.filter((e) => e.comment.startsWith('📚Lore slot'));
  assert.equal(got.length, 4);
  assert.ok(got.every((e) => e.content === 'new'));
  assert.equal(plan.lore.replaced, 5, '자리 항목 4 + 매니페스트');
});
