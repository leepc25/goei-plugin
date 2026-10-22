// 본부 3판 배치 (docs/본부_설계_2판.md): 한 줄 건물, 방 문은 복도 북쪽, 방에서는 화면 아래로 나온다.
// 문은 서로 이어지고, 들어온 자리·쓰는 자리는 집기 상자 밖이며, 집기는 걷는 띠 안에 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({ stdin: { contents: `export * from './src/game/action/hq/map'; export { insideProp } from './src/game/action/engine/propBlock';`, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', target: 'es2022', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const byId = M.SCENE_BY_ID;
const fresh = M.HQ_SCENES.filter((s) => !s.legacy);
const solid = (sc) => sc.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 }));

test('본부: 층은 1F·2F·B1·B2뿐 (3층 없음)', () => {
  assert.deepEqual([...new Set(fresh.map((s) => s.floor))].sort(), ['1F', '2F', 'B1', 'B2']);
});

test('본부: 문은 서로 이어진다 (A→B 문이면 B에 A로 돌아오는 문)', () => {
  for (const sc of M.HQ_SCENES) {
    for (const d of sc.doors) {
      if (!d.to) continue;
      const back = byId[d.to]?.doors.find((q) => q.id === d.toDoor);
      assert.ok(back, `${sc.id}.${d.id} → ${d.to}.${d.toDoor} 없음`);
      assert.equal(back.to, sc.id, `${d.to}.${d.toDoor}가 ${sc.id}로 돌아오지 않음`);
    }
  }
});

test('본부: 복도의 방 문은 전부 북쪽, 방은 화면 아래로 나온다 (1층 정문만 남쪽)', () => {
  for (const sc of fresh) {
    const isHall = ['lobby', 'f2', 'b1', 'b2'].includes(sc.id);
    for (const d of sc.doors) {
      if (isHall) assert.ok(d.side !== 'S' || (sc.id === 'lobby' && d.id === 'main'), `${sc.id}.${d.id} 복도 남쪽 문`);
      else if (d.to) assert.equal(d.side, 'S', `${sc.id}.${d.id} 방 출구가 아래가 아님`);
    }
  }
});

test('본부: 층마다 가운데 코어(계단·엘리베이터)와 이정표', () => {
  for (const id of ['lobby', 'f2', 'b1', 'b2']) {
    const sc = byId[id];
    const elev = sc.doors.find((d) => d.kind === 'elevator');
    assert.ok(elev, `${id} 엘리베이터`);
    assert.ok(sc.doors.some((d) => d.kind.startsWith('stairs') && Math.abs(d.x - elev.x) < 300), `${id} 계단이 코어에 없음`);
    assert.ok(sc.fixtures.some((f) => f.kind === 'directory'), `${id} 이정표`);
  }
});

test('본부: 집기는 걷는 띠 안, 들어오는 자리·쓰는 자리는 집기 밖', () => {
  for (const sc of fresh) {
    const S = solid(sc);
    for (const b of sc.boxes) assert.ok(b.y - b.d >= M.LANE_TOP - 2 && b.y - b.d <= M.LANE_BOT, `${sc.id} ${b.kind} 띠 밖`);
    for (const s of sc.spots) if (s.y !== undefined) assert.ok(!S.some((p) => M.insideProp(p, s.x, s.y)), `${sc.id} 자리 ${s.id}가 집기 안`);
    for (const d of sc.doors) {
      const y = d.side === 'S' ? M.LANE_BOT - 14 : M.LANE_TOP + 16;
      assert.ok(!S.some((p) => M.insideProp(p, d.x, y)), `${sc.id} 문 ${d.id} 앞이 막힘`);
      assert.ok(d.x > 0 && d.x < sc.length, `${sc.id} 문 ${d.id} 장면 밖`);
    }
  }
});

test('본부: 종합대응팀 사무실 문은 코어 바로 옆', () => {
  const f2 = byId.f2;
  const elev = f2.doors.find((d) => d.kind === 'elevator');
  const office = f2.doors.find((d) => d.id === 'office');
  const others = f2.doors.filter((d) => d.to && !d.kind.startsWith('stairs') && d.id !== 'office');
  assert.ok(others.every((d) => Math.abs(d.x - elev.x) >= Math.abs(office.x - elev.x)), '다른 방 문이 더 가깝다');
});
