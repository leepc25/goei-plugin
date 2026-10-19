import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

// 수정 전 HTML을 다시 전달했던 회귀를 막는다. 배포 파일 자체의 내장 자산을 검사한다.
test('공유 플레이 HTML은 현재 일반 체형 자산과 계획된 핵심 전투 프레임을 내장한다', () => {
  const html = readFileSync('release/demo/goei-jyaldi-normal.html', 'utf8');
  assert.equal(
    html,
    readFileSync('dist/goei-action-demo.html', 'utf8'),
    '배포 HTML에 최신 코드까지 포함',
  );
  const match = html.match(/window\.__GOEI_ACTION_ART__=(\{.*?\})<\/script>/s);
  assert.ok(match, '자산이 내장된 단일 HTML');
  const embedded = JSON.parse(match[1]);
  const atlas = embedded.atlas.action;
  assert.deepEqual(atlas, JSON.parse(readFileSync('game-pack/action/atlas.json', 'utf8')).action, '새 유지 시간과 클립까지 현재 아틀라스와 일치');
  const plan = JSON.parse(readFileSync('game-src/action/jyaldi-production-v3.json', 'utf8'));
  assert.equal(atlas.profile, 'normal-v4');
  assert.equal(atlas.source, plan.sample.sourceSha256);
  assert.equal(atlas.nativeHeight, 128);
  assert.equal(atlas.displayHeight, 256);
  assert.equal(atlas.scale, 2);
  for (const [name, count] of Object.entries({
    walk: 4,
    run: 4,
    melee1: 5,
    melee2: 5,
    melee3: 6,
    crouchwalk: 4,
    lowkick: 3,
    airattack: 3,
    airfire: 3,
    dashattack: 4,
    hurt: 2,
    victory: 2,
    defeat: 2,
    shot: 6,
    skill: 14,
    ult: 24,
    cutin: 12,
  })) {
    assert.equal(atlas.clips[name].length, count, name);
    assert.equal(
      new Set(atlas.clips[name]).size,
      count,
      '한 포즈 반복으로 장수 채우기 금지: ' + name,
    );
  }
  const bytes = Buffer.from(embedded.files['a-jyaldi-action'].split(',')[1], 'base64');
  assert.equal(
    createHash('sha256').update(bytes).digest('hex'),
    createHash('sha256').update(readFileSync('game-pack/action/a-jyaldi-action.png')).digest('hex'),
  );
  assert.ok(html.includes('일반 체형 2배 도트'));
  assert.equal(html, readFileSync('release/demo/goei-jyaldi-action-v4.html', 'utf8'));
  assert.ok(html.includes('동작 훈련'));
  assert.ok(
    Math.max(...atlas.frameTimes.melee1) / Math.min(...atlas.frameTimes.melee1) >= 6,
    '핵심 자세의 완급',
  );
  const referenced = new Set(Object.values(atlas.clips).flat());
  assert.equal(referenced.size, atlas.frames.length, '참조되지 않는 그림은 배포하지 않음');
  assert.ok(Buffer.byteLength(html) < 2 * 1024 * 1024, '독립 시연판 2MiB 미만 예산');
});
