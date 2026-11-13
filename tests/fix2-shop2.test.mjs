// 전수검사 11-13 고침 (쇼핑몰·가계부): 1:1 상담 줄의 응답 키, 상태창 잔고 맞춤은 모델이 칸을 바꿨을 때만
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/shop2';
await mkdir(dir, { recursive: true });
const file = join(dir, 'bundle.mjs');
await build({
  stdin: { contents: `export { mallEvents } from './src/core/malls'; export { syncWalletToStatus, addWalletEntry, aliveAnchors, walletBalance, WALLET_SYNC_MEMO } from './src/core/wallet';`, resolveDir: process.cwd(), loader: 'ts' },
  outfile: file, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', loader: { '.txt': 'text', '.md': 'text' },
});
const M = await import(pathToFileURL(file).href);

const tag = (n) => `본문\n[▣|2025.01.01|10:15 PM|🌫️|9°C|거리|없음|없음|대기|관리국/요원|${n}]`;

test('1:1 상담: 창을 열어 둔 채 다음 턴에 이어 한 말도 넘어가고, 지난 턴 줄은 다시 안 간다', () => {
  const msgs = [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: '본문', chatId: 'c1' }, { role: 'user', data: 'b', chatId: 'u2' }, { role: 'char', data: '다음', chatId: 'c2' }];
  const desk = { agent: { name: '김' }, anchor: 'c1', past: [], talk: [{ who: 'sys', text: '연결' }, { who: 'op', text: '안녕하세요', k: 'c1' }, { who: 'me', text: '가불 되나요', k: 'c1' }, { who: 'op', text: '불가합니다.', k: 'c1' }, { who: 'me', text: '그럼 언제 돼요', k: 'c2' }, { who: 'op', text: '다음 달입니다.', k: 'c2' }] };
  const ev = M.mallEvents({ message: msgs, scriptstate: { $bm_desk: JSON.stringify(desk) } });
  assert.equal(ev.length, 1, ev.join('\n'));
  assert.ok(ev[0].includes('그럼 언제 돼요') && ev[0].includes('다음 달입니다.'), ev[0]);
  assert.ok(!ev[0].includes('가불 되나요') && !ev[0].includes('연결'), ev[0]);
  // 키 없는 옛 줄은 상담 키(anchor)를 따른다
  const old = { ...desk, anchor: 'c2', talk: [{ who: 'sys', text: '연결' }, { who: 'me', text: '옛 말' }, { who: 'op', text: '옛 답' }] };
  const ev2 = M.mallEvents({ message: msgs, scriptstate: { $bm_desk: JSON.stringify(old) } });
  assert.ok(ev2.length === 1 && ev2[0].includes('옛 말'), ev2.join('\n'));
  assert.deepEqual(M.mallEvents({ message: msgs, scriptstate: { $bm_desk: JSON.stringify({ ...old, anchor: 'c1' }) } }), []);
});

test('상태창 잔고 맞춤: 모델이 잔고 칸을 안 바꿨으면 갱신기 지출을 되돌리지 않는다', () => {
  const t = Date.UTC(2026, 10, 13, 1, 0);
  const c = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: tag(140000), chatId: 'c1', time: t }] };
  const alive = M.aliveAnchors(c);
  const w0 = { start: 140000, log: [] };
  // 응답 직후: 바뀐 게 없다
  assert.equal(M.syncWalletToStatus(w0, c), null);
  // 갱신기가 택시비 −30,000 을 적은 뒤 다시 맞춰도 맞춤 줄이 안 생긴다
  const w1 = M.addWalletEntry(w0, { id: 'g1', anchor: 'c1', amount: -30000, memo: '택시비', src: 'story' });
  const r1 = M.syncWalletToStatus(w1, c);
  const w1b = r1 ?? w1;
  assert.equal(M.walletBalance(w1b, alive), 110000);
  assert.ok(!w1b.log.some((e) => e.memo === M.WALLET_SYNC_MEMO));
  // 응답 뒤 직접 수정(+60,000)은 갱신기가 끝날 때 되돌려지지 않는다
  const w2 = M.addWalletEntry(w0, { id: 'm1', anchor: '', amount: 60000, memo: '잔고 수정', src: 'manual', at: new Date(t + 5000).toISOString() });
  const r2 = M.syncWalletToStatus(w2, c);
  assert.equal(M.walletBalance(r2 ?? w2, alive), 200000);
});

test('상태창 잔고 맞춤: 모델이 잔고 칸을 바꿨으면 그대로 맞추고, 갱신기가 같은 거래를 읽으면 맞춤 줄이 빠진다', () => {
  const t = Date.UTC(2026, 10, 13, 1, 0);
  const c = { message: [{ role: 'user', data: 'a', chatId: 'u1' }, { role: 'char', data: tag(110000), chatId: 'c1', time: t }] };
  const alive = M.aliveAnchors(c);
  const w0 = { start: 140000, log: [] };
  const s1 = M.syncWalletToStatus(w0, c);
  assert.equal(M.walletBalance(s1, alive), 110000);
  assert.ok(s1.log.some((e) => e.memo === M.WALLET_SYNC_MEMO && e.amount === -30000));
  const w1 = M.addWalletEntry(s1, { id: 'g1', anchor: 'c1', amount: -30000, memo: '택시비', src: 'story' });
  const s2 = M.syncWalletToStatus(w1, c) ?? w1;
  assert.equal(M.walletBalance(s2, alive), 110000);
  assert.ok(!s2.log.some((e) => e.memo === M.WALLET_SYNC_MEMO), '같은 거래를 두 번 세지 않는다');
});
