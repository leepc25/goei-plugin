import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// 수정 전 HTML을 다시 전달했던 회귀를 막는다. 배포 파일 자체의 내장 자산을 검사한다.
test('공유 플레이 HTML은 현재 일반 체형 자산과 계획된 핵심 전투 프레임을 내장한다', () => {
  const html = readFileSync('release/demo/goei-jyaldi-normal.html', 'utf8');
  assert.equal(html,readFileSync('dist/goei-action-demo.html','utf8'),'배포 HTML에 최신 코드까지 포함');
  const match = html.match(/window\.__GOEI_ACTION_ART__=(\{.*?\})<\/script>/s);
  assert.ok(match, '자산이 내장된 단일 HTML');
  const embedded = JSON.parse(match[1]);
  const atlas = embedded.atlas.action;
  const plan = JSON.parse(readFileSync('game-src/action/jyaldi-production-v3.json', 'utf8'));
  assert.equal(atlas.profile, 'normal-v3');
  assert.equal(atlas.source, plan.sample.sourceSha256);
  assert.equal(atlas.nativeHeight, 128);
  assert.equal(atlas.displayHeight, 256);
  assert.equal(atlas.scale, 2);
  for (const [name, count] of Object.entries({
    walk: 12,
    run: 12,
    melee1: 10,
    melee2: 12,
    melee3: 16,
    shot: 6,
    skill: 14,
    ult: 24,
    cutin: 12,
  })) {
    assert.equal(atlas.clips[name].length, count, name);
    assert.equal(new Set(atlas.clips[name]).size, count, '한 포즈 반복으로 장수 채우기 금지: ' + name);
  }
  const bytes = Buffer.from(embedded.files['a-jyaldi-action'].split(',')[1], 'base64');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(readFileSync('game-pack/action/a-jyaldi-action.png')).digest('hex'),
  );
  assert.ok(html.includes('일반 체형 2배 도트'));
  assert.ok(Buffer.byteLength(html) < 2 * 1024 * 1024, '독립 시연판 2MiB 미만 예산');
});
