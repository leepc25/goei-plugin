// 전수: 플러그인이 고르는 모든 로어북(세력·파밍·괴이·요원)을 제 이름·키·명부의 이름·영문명·별칭으로 불렀을 때 켜지는지.
// 2026-11-12 사용자: 「착한 친구」(명부에서 브라우니 별칭)가 키에 없어 로어북이 안 읽힘 → 항목 하나가 아니라 전부 본다.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lore, withWorldLore, readDirectory } from '../dist-test/core.mjs';

const books = withWorldLore([{ comment: 'Directory', key: '', mode: 'normal', content: readFileSync(new URL('../src/data/install/directory.json', import.meta.url), 'utf8') }]);
const dir = readDirectory(books);
const entries = lore.managedEntries(books).filter((e) => !e.appendix);
const hangul = (s) => /[가-힣]/.test(s);
const picked = (text) => {
  const chat = { message: [{ role: 'char', data: '사무실은 조용했다.' }, { role: 'user', data: text }], scriptstate: {} };
  return lore.computeLore(books, chat, lore.loreOptions({ globalLore: books }, chat, 'plugin')).picks.map((p) => p.entry.name);
};
const plain = (n) => (hangul(n) ? `어제 ${n}에 대한 이야기를 들었다.` : `I heard about ${n} yesterday.`);
const quoted = (n) => (hangul(n) ? `어제 「${n}」에 대한 이야기를 들었다.` : `I heard about "${n}" yesterday.`);
const honor = (n) => `어제 ${n} 씨를 만났다.`;
const callsOf = (e) => {
  const row = e.kind === 'agent' ? dir.agents.find((x) => x.lore === e.name) : e.kind === 'anomaly' ? dir.anomalies.find((x) => x.lore === e.name) : e.kind === 'site' ? dir.sites.find((x) => x.lore === e.name) : undefined;
  const all = [e.name, ...e.rawKeys, ...(e.kind === 'agent' ? [row?.name] : []), row?.english, ...(row?.aliases ?? [])].filter((t) => typeof t === 'string' && [...t.replace(/\s+/g, '')].length >= 2);
  return [...new Set(all)];
};

test('모든 항목: 부르는 말마다 키가 있고, 그 말로 부르면 켜진다 (확증 키는 따옴표, 두 글자 이름은 호칭과 함께)', () => {
  assert.ok(entries.length >= 140, `항목 ${entries.length}개`);
  const miss = [];
  for (const e of entries) {
    for (const call of callsOf(e)) {
      const key = e.keys.find((k) => k.text.toLowerCase() === call.toLowerCase());
      if (!key) { miss.push(`${e.name}: 「${call}」 키 없음`); continue; }
      const text = key.rule === 'confirm' ? quoted(call) : key.rule === 'alias' ? honor(call) : plain(call);
      if (!picked(text).includes(e.name)) miss.push(`${e.name}: 「${call}」(${key.rule}) 안 켜짐 ← ${text}`);
    }
  }
  assert.deepEqual(miss, []);
});

test('붙여 써도 켜진다: 세 글자 넘는 장소·괴이 이름 (착한친구키링, 여우상담실)', () => {
  const miss = [];
  for (const e of entries.filter((x) => x.kind !== 'agent')) {
    const name = e.name.replace(/\s+/g, '');
    if (!hangul(name) || name === e.name || /[^가-힣\w]/.test(name)) continue;
    const key = e.keys.find((k) => k.text === e.name);
    if (!picked(key?.rule === 'confirm' ? quoted(name) : plain(name)).includes(e.name)) miss.push(`${e.name} → ${name}`);
  }
  assert.deepEqual(miss, []);
});

test('「착한 친구」: 명부 별칭으로 브라우니가 켜지고, 「착한 친구 키링」은 키링이 켜진다', () => {
  assert.ok(picked('착한 친구가 말을 걸었다.').includes('브라우니'));
  assert.ok(picked('착한친구 얘기 들었어?').includes('브라우니'));
  assert.deepEqual(picked('착한 친구 키링을 주웠다.'), ['착한 친구 키링'], '긴 이름이 이긴다');
});

test('확증·두 글자 규칙은 그대로: 흔한 낱말은 그냥 나와서는 켜지지 않는다', () => {
  assert.ok(!picked('브라우니를 구워 먹었다.').includes('브라우니'));
  assert.ok(!picked('병원에 다녀왔다.').includes('병원'));
  assert.ok(!picked('도형을 그렸다.').includes('이도형'));
});
