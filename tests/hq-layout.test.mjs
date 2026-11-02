// 본부 배치: 층 복도는 확정 배경 그림 6장(hq/painted.ts, 2026-10-25), 방 문은 복도 북쪽, 방에서는 화면 아래로 나온다.
// 문은 서로 이어지고, 들어온 자리·쓰는 자리는 집기 상자 밖이며, 집기는 걷는 띠 안에 있다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const out = await build({ stdin: { contents: `export * from './src/game/action/hq/map'; export { insideProp } from './src/game/action/engine/propBlock'; import { PAINTED } from './src/game/action/hq/painted'; export const PAINTED_DOORS = (id) => PAINTED[id].doors;`, resolveDir: '.', loader: 'ts' }, bundle: true, format: 'esm', target: 'es2022', write: false });
const M = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const byId = M.SCENE_BY_ID;
const fresh = M.HQ_SCENES.filter((s) => !s.legacy && !s.id.startsWith('jr_') && !s.id.startsWith('by_') && s.floor !== 'out');   // by_ = 백일몽 본사(11-02). 바깥 거리(11-02 그림 장면: 종로·영등포)는 건물 밖
const JR = ['jr_entry', 'jr_b1', 'jr_alley', 'jr_b2', 'jr_daebak', 'jr_heolgap', 'jr_youngchang', 'jr_songil', 'jr_jinryo', 'jr_op'];
const solid = (sc) => sc.boxes.filter((b) => b.solid).map((b) => ({ x: b.x, y: b.y, w: b.w, back: b.d + 6, front: 8 }));

const HALLS = ['lobby', 'f2', 'f3', 'b1', 'b2', 'b3', 'sdra_lobby', 'sdra_f2', 'sdra_b1'];  // sdra_lobby·sdra_f2·sdra_b1 = 협회 1·2·지하1층 (11-02)
test('본부: 층은 3F·2F·1F·B1·B2·B3 (배경 그림 6장)', () => {
  assert.deepEqual([...new Set(fresh.map((s) => s.floor))].sort(), ['1F', '2F', '3F', 'B1', 'B2', 'B3']);
  for (const id of HALLS) assert.equal(byId[id].painted, id, `${id} 그림`);
});

test('본부: 문은 서로 이어진다 (A→B 문이면 B에 A로 돌아오는 문)', () => {
  for (const sc of M.HQ_SCENES) {
    for (const d of sc.doors) {
      if (!d.to || (sc.id === 'by_lobby' && d.id === 'main')) continue;   // 백일몽 로비 정문: 강남 거리 생길 때까지 종로 거리로 한쪽만 (11-02)
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
      else if (d.to && !(sc.painted && d.kind === 'exit' && M.PAINTED_DOORS(sc.painted)[d.id]) && HALLS.includes(d.to)) assert.equal(d.side, 'S', `${sc.id}.${d.id} 방 출구 방향`);   // 맵 에디터 방(샤워실)은 그림 속 옆벽 문으로 나간다. 방→방 문(격리팀 사무실 → 의무실, 11-02 사용자: 「거기 통해서 들어가는 건데」)은 뒷벽 문
    }
  }
});

test('본부: 층마다 엘리베이터, 계단은 3층~B1 위아래 층의 계단으로 (B2·B3는 엘리베이터만)', () => {
  for (const id of HALLS) {
    const sc = byId[id];
    assert.ok(sc.doors.some((d) => d.kind === 'elevator'), `${id} 엘리베이터`);
    assert.ok(M.ELEVATOR.some((e) => e.scene === id), `${id} 엘리베이터 단추`);
    const st = sc.doors.find((d) => d.kind === 'stairs');
    // 본부는 새 그림(11-01, 엘리베이터만)이라 1층 포함 모든 층 계단 없음
    if (['b2', 'b3', 'f3', 'f2', 'b1', 'lobby', 'sdra_lobby', 'sdra_f2', 'sdra_b1'].includes(id)) { assert.ok(!st, `${id} 계단 없음`); continue; }
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
      assert.ok(d.to || d.locked || d.bus, `${id}.${d.id} 갈 곳 없음`);
    }
  }
  // 버스 정류장(11-02): 종로·영등포·중림 정류장 문끼리 노선 고르기로 오간다
  for (const id of ['street', 'sdra_street', 'by_street', 'jr_entry']) assert.ok(byId[id].doors.some((d) => d.bus && M.PAINTED_DOORS(id)[d.id]), `${id} 버스 정류장`);
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

// 백일몽 본사(11-02): 13층·15층 복도는 같은 그림, 문은 서로 이어지고 엘리베이터는 백일몽 층끼리만
test('백일몽: 13·15층 문 연결과 엘리베이터 건물 구분', () => {
  const BY = M.HQ_SCENES.filter((s) => s.id.startsWith('by_'));
  assert.ok(BY.length >= 11);
  for (const sc of BY) for (const d of sc.doors) {
    if (!d.to) continue;
    const to = byId[d.to]; assert.ok(to, `${sc.id}.${d.id} → ${d.to}`);
    assert.ok(to.doors.some((x) => x.id === d.toDoor), `${sc.id}.${d.id} → ${d.to}.${d.toDoor}`);
    const back = to.doors.find((x) => x.id === d.toDoor);
    if (back.to && !(sc.id === 'by_lobby' && d.id === 'main')) assert.equal(back.to, sc.id, `${d.to}.${d.toDoor} 돌아오기`);   // 로비 정문은 강남 거리 생길 때까지 종로 거리로 한쪽만
  }
  assert.equal(byId.by_f13.painted, 'by_f13'); assert.ok(byId.by_f15.length < byId.by_f13.length);   // 15층 = 휴게실 앞에서 자름
  const by = M.ELEVATOR.filter((e) => e.bldg === 'by').map((e) => e.scene).sort();
  assert.deepEqual(by, ['by_f13', 'by_f15', 'by_f17', 'by_lobby']);
  // 17층 연구1팀 문 → 연구실 → 오른쪽 옆벽 의무실(관리국 그림 재사용) (사용자 11-02 15:55)
  const lab = M.HQ_SCENES.find((s) => s.id === 'by_lab');
  assert.deepEqual(lab.doors.map((d) => [d.id, d.to]), [['out', 'by_f17'], ['infirmary', 'by_infirmary']]);
  assert.equal(M.HQ_SCENES.find((s) => s.id === 'by_f17').doors.find((d) => d.id === 'office').to, 'by_lab');
  assert.equal(M.HQ_SCENES.find((s) => s.id === 'by_infirmary').painted, 'infirmary');
  assert.ok(!byId.by_f15.doors.find((d) => d.id === 'rest'));
  assert.equal(byId.by_office.painted, 'office');
  const owners = (id) => byId[id].spots.filter((p) => p.owner).map((p) => p.owner);
  assert.deepEqual(owners('by_office'), ['이자헌', '은하제', '박민성', '백사헌', '고영은', '강이학', '장허운']);
  assert.deepEqual(owners('by_elite'), ['백석주', '진나솔', '이성해']); assert.equal(byId.by_elite.painted, 'office_riot');
});

// 가짜 관리국 본부(11-02 사용자 15:50): 관리국 본부 장면을 fb_ 로 그대로 복사, 이름만 종합대응팀 → 검사부대, 진압팀 → 진압부대
test('가짜 관리국: 관리국 장면 복사·문 연결·엘리베이터·이름', () => {
  const FB = M.HQ_SCENES.filter((s) => s.id.startsWith('fb_'));
  assert.equal(FB.length, 20);
  for (const sc of FB) {
    const src = byId[sc.id.slice(3)];
    assert.equal(sc.painted, src.painted, `${sc.id} 그림 = 관리국 그림`);
    assert.ok(!/종합대응팀|진압팀/.test(sc.name + sc.doors.map((d) => d.label ?? '').join()), `${sc.id} 이름`);
    for (const d of sc.doors) {
      if (!d.to) continue;
      assert.ok(d.to.startsWith('fb_'), `${sc.id}.${d.id} → ${d.to} 같은 건물`);
      const back = byId[d.to].doors.find((x) => x.id === d.toDoor);
      assert.ok(back, `${sc.id}.${d.id} → ${d.to}.${d.toDoor}`);
      if (back.to) assert.equal(back.to, sc.id, `${d.to}.${d.toDoor} 돌아오기`);
    }
  }
  assert.equal(byId.fb_office.name, '검사부대'); assert.equal(byId.fb_swat.name, '진압부대');
  const owners = (id) => byId[id].spots.filter((p) => p.owner).map((p) => p.owner);
  assert.deepEqual(owners('fb_office'), ['이도형', '고영훈', '노기균', '송주익']);
  assert.deepEqual(owners('fb_swat'), ['곽성주', '조성춘', '윤병수', '김성진', '송진섭']);
  assert.deepEqual(M.ELEVATOR.filter((e) => e.bldg === 'fb').map((e) => e.scene).sort(), ['fb_b1', 'fb_b2', 'fb_b3', 'fb_f2', 'fb_f3', 'fb_lobby']);
  assert.ok(byId.fb_street.doors.some((d) => d.bus === '종로'), '정류장은 종로 하나 (11-02 사용자 16:46): 소속으로 앞면·뒷면을 고른다');
});
