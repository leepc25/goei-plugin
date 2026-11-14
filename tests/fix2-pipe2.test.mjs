// 전수검사 11-13: 설정 저장(noticedReports)·기본값 불러오기·진행 창 단계 이름·캐릭터 플레이 이름 바꾸기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = '/tmp/audit_1113/fix2/pipe2/out';
await mkdir(dir, { recursive: true });
await build({
  entryPoints: ['src/core/settings.ts', 'src/host/prefs.ts', 'src/core/progplan.ts', 'src/core/player.ts'],
  outdir: dir, outbase: 'src', bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent',
});
const mod = (n) => import(pathToFileURL(join(dir, `${n}.mjs`)));
const Set_ = await mod('core/settings');
const Prefs = await mod('host/prefs');
const Plan = await mod('core/progplan');
const Player = await mod('core/player');

test('setPrefs: 띄운 보고서 알림 기억(noticedReports)을 남긴다 (최근 50개)', () => {
  const ids = Array.from({ length: 60 }, (_, i) => `r${i}`);
  const p = Set_.setPrefs({ noticedReports: [...ids, 3, ''] });
  assert.deepEqual(p.noticedReports, ids.slice(-50));
  assert.equal(Set_.setPrefs({}).noticedReports, undefined);
});

test('varDefaultsToLoad: 기본값에 없는 키는 빈 글자로 덮지 않고 지울 목록으로', async () => {
  // prefs 묶음은 settings 를 따로 품으므로 저장소 흉내로 불러 넣는다
  globalThis.risuai = { pluginStorage: { getItem: async () => JSON.stringify({ vars: { '$it_slots': '20' } }), setItem: async () => {} } };
  await Prefs.loadPrefs();
  const r = Prefs.varDefaultsToLoad(['$it_', '$lb_cfg_lb-gn'], { '$it_slots': '12', '$it_carry': '30', '$lb_cfg_lb-gn.incoming_chance': '50', '$st_x': '1' });
  assert.deepEqual(r.set, { '$it_slots': '20' });
  assert.deepEqual(r.drop.sort(), ['$it_carry', '$lb_cfg_lb-gn.incoming_chance'].sort());
  delete globalThis.risuai;
});

test('turnPlan: 이미지 태그·위키 칸이 실제 호출 이름과 맞는다', () => {
  const plan = Plan.turnPlan({ globalLore: [] }, { message: [], scriptstate: { '$st_asset_on': '1', '$st_asset_model': 'aux', '$nw_auto': 'turn', '$ph_auto': '1', '$lb_cfg_lb-gn.lazy': '0' } });
  const by = Object.fromEntries(plan.map((s) => [s.id, s]));
  assert.deepEqual(by.asset?.match, ['이미지 태그 보충']);
  assert.equal(by.asset.label, '이미지 태그');
  assert.deepEqual(by.wiki?.match, ['위키 제목', '위키 글']);
  assert.equal(by.wiki.label, '위키');
  const joints = plan.filter((x) => x.id.startsWith('joint:'));
  assert.equal(joints.length, 1);
  for (const s of joints) {
    const names = s.note.split(' · ');
    assert.ok(s.match.includes(`${[...names].reverse().join('+')} 통합`), '모인 순서가 달라도 같은 칸');
    for (const n of names) assert.ok(s.match.includes(n), '혼자 나간 호출 이름도 같은 칸');
  }
});

test('applyPlayer: 한글 이름은 앞뒤가 다른 한글 낱말일 때 바꾸지 않고, 넣은 주인공 글은 건드리지 않는다', () => {
  const block = '## Player Character\n에일린은 현장 지원 담당';
  const msgs = [{ role: 'system', content: '설명' }, { role: 'system', content: '끝 현장 지원팀' }, { role: 'user', content: '지원이 말했다. 강지원 선배, 지원에게 물었다. 지원이가 웃는다. (지원)' }];
  const out = Player.applyPlayer(msgs, block, '', '지원', '에일린');
  assert.equal(out[1].content, block);
  assert.equal(out[2].content, '끝 현장 지원팀');
  assert.equal(out[3].content, '에일린이 말했다. 강지원 선배, 에일린에게 물었다. 에일린이가 웃는다. (에일린)');
  const b = Player.applyPlayer([{ role: 'user', content: '민수가 문을 연다. 민수는 민수' }], block, '', '민수', '쟈알디');
  assert.equal(b.at(-1).content, '쟈알디가 문을 연다. 쟈알디는 쟈알디');
});

test('applyPlayer: 겹친 조사·서술격·씨/님+조사도 바꾸고, 다른 낱말은 그대로 둔다 (재검토 11-14 ①-4)', () => {
  const block = '## Player Character\nX';
  const run = (text, from = '민수', to = '에일린') => Player.applyPlayer([{ role: 'system', content: 's' }, { role: 'user', content: text }], block, '', from, to).at(-1).content;
  assert.equal(run('민수는 민수였고, 민수에게도 민수로서의 사정이 있었다'), '에일린는 에일린였고, 에일린에게도 에일린로서의 사정이 있었다');
  for (const tail of ['에게는', '였다', '입니다', '씨는', '님이', '로서', '처럼', '라고', '에', '로', '까지', '이다', '이었다', '씨에게는', '님께서는', '이에게도', '한테서만', '예요', '인데']) {
    assert.equal(run(`그때 민수${tail} 그랬다.`), `그때 에일린${tail} 그랬다.`, tail);
    assert.equal(run(`민수${tail}`), `에일린${tail}`, `${tail} (글 끝)`);
  }
  // 이름이 다른 낱말의 일부일 때는 그대로
  for (const word of ['지원팀', '강지원', '지원이사', '지원자', '지원금', '지원인력', '지원부서', '지원사격']) assert.equal(run(`현장 ${word} 소속`, '지원'), `현장 ${word} 소속`, word);
});
