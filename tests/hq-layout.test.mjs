// 본부 배치: 층 복도는 확정 배경 그림 6장(hq/painted.ts, 2026-10-25), 방 문은 복도 북쪽, 방에서는 화면 아래로 나온다.
// 문은 서로 이어지고, 들어온 자리·쓰는 자리는 집기 상자 밖이며, 집기는 걷는 띠 안에 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({ stdin: { contents: `export * from './src/game/action/hq/map'; export { insideProp } from './src/game/action/engine/propBlock'; import { PAINTED } from './src/game/action/hq/painted'; export const PAINTED_DOORS = (id) => PAINTED[id].doors;`, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', target: 'es2022', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const byId = M.SCENE_BY_ID;
const fresh = M.HQ_SCENES.filter((s) => !s.legacy && !s.id.startsWith('jr_'));
const JR = ['jr_entry', 'jr_b1', 'jr_alley', 'jr_b2', 'jr_daebak', 'jr_heolgap', 'jr_youngchang', 'jr_songil', 'jr_jinryo', 'jr_op'];
const solid = (sc) => sc.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 }));

const HALLS = ['lobby', 'f2', 'f3', 'b1', 'b2', 'b3'];
test('본부: 층은 3F·2F·1F·B1·B2·B3 (배경 그림 6장)', () => {
  assert.deepEqual([...new Set(fresh.map((s) => s.floor))].sort(), ['1F', '2F', '3F', 'B1', 'B2', 'B3']);
  for (const id of HALLS) assert.equal(byId[id].painted, id, `${id} 그림`);
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

test('본부: 방은 아래 출구로 복도에 연결', () => {
  for (const sc of fresh) {
    const isHall = HALLS.includes(sc.id);
    for (const d of sc.doors) {
      if (isHall) assert.ok(d.side !== 'S', `${sc.id}.${d.id} 복도 남쪽 문`);
      else if (d.to) assert.equal(d.side, 'S', `${sc.id}.${d.id} 방 출구 방향`);
    }
  }
});

test('본부: 층마다 엘리베이터, 계단은 3층~B1 위아래 층의 계단으로 (B2·B3는 엘리베이터만)', () => {
  for (const id of HALLS) {
    const sc = byId[id];
    assert.ok(sc.doors.some((d) => d.kind === 'elevator'), `${id} 엘리베이터`);
    assert.ok(M.ELEVATOR.some((e) => e.scene === id), `${id} 엘리베이터 단추`);
    const st = sc.doors.find((d) => d.kind === 'stairs');
    if (id === 'b2' || id === 'b3') { assert.ok(!st, `${id} 계단 없음`); continue; }
    assert.ok(st, `${id} 계단`);
    for (const to of [st.up, st.down].filter(Boolean)) {
      const back = byId[to].doors.find((d) => d.kind === 'stairs');
      assert.ok(back && (back.up === id || back.down === id), `${id} 계단 → ${to} 돌아오지 않음`);
    }
  }
});

test('중림: 그림 4장, 문은 그림 문 자리에 있고 서로 이어진다', () => {
  for (const id of JR) {
    const sc = byId[id];
    assert.equal(sc.painted, id, `${id} 그림`);
    for (const d of sc.doors) {
      assert.ok(M.PAINTED_DOORS(id)[d.id], `${id}.${d.id} 그림 문 없음`);
      assert.ok(d.to || d.locked, `${id}.${d.id} 갈 곳 없음`);
    }
  }
  assert.ok(byId.street.doors.some((d) => d.to === 'jr_entry'), '종로 → 중림 임시 연결');
});

test('본부: 그림 문 좌표 안에 문이 있다', () => {
  for (const id of HALLS) for (const d of byId[id].doors) assert.ok(M.PAINTED_DOORS(id)[d.id], `${id}.${d.id} 그림 문 없음`);
});

test('본부: 집기는 걷는 띠 안, 들어오는 자리·쓰는 자리는 집기 밖', () => {
  for (const sc of fresh) {
    const S = solid(sc);
    const lane = sc.lane ?? [M.LANE_TOP, M.LANE_BOT];
    for (const b of sc.boxes) assert.ok(b.y - b.d >= lane[0] - 2 && b.y - b.d <= lane[1], `${sc.id} ${b.kind} 띠 밖`);
    for (const s of sc.spots) if (s.y !== undefined) assert.ok(!S.some((p) => M.insideProp(p, s.x, s.y)), `${sc.id} 자리 ${s.id}가 집기 안`);
    for (const d of sc.doors) {
      const y = d.side === 'S' ? lane[1] - 14 : lane[0] + 16;
      assert.ok(!S.some((p) => M.insideProp(p, d.x, y)), `${sc.id} 문 ${d.id} 앞이 막힘`);
      assert.ok(d.x > 0 && d.x < sc.length, `${sc.id} 문 ${d.id} 장면 밖`);
    }
  }
});
