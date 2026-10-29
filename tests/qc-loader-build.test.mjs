// QC(시작기·설치·업데이트 영역, 2026-10-28): 빌드 결과물의 조각 나누기·합치기 왕복과 지문, release 폴더와 dist 가 같은 판인지.
// 먼저 npm run build. release/version.json 의 플러그인 판이 package.json 과 다르면(릴리스 전 개발 중) release 대조는 건너뛴다.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pkg = JSON.parse(read('package.json'));

/** src/loader/body.ts bodyHash · scripts/build.mjs textHash 와 같은 식 */
function fnv(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/** 조각 목록(stem.json)과 조각 파일을 이어 붙인 글이 원본과 같고, 조각마다 200KB 이하이며 서로게이트 쌍을 가르지 않는지 */
function roundTrip(dir, indexName, whole) {
  const index = JSON.parse(read(`${dir}/${indexName}`));
  const parts = index.parts.map((n) => read(`${dir}/${n}`));
  const joined = parts.join('');
  assert.equal(joined, whole, `${indexName}: 조각을 이으면 원본`);
  assert.equal(index.length, whole.length, `${indexName}: length = JS 글자 수`);
  for (const [i, p] of parts.entries()) {
    assert.ok(Buffer.byteLength(p) <= 200_000, `${index.parts[i]} 가 200KB 를 넘음`);
    const first = p.charCodeAt(0);
    assert.ok(!(first >= 0xdc00 && first <= 0xdfff), `${index.parts[i]} 가 서로게이트 쌍 가운데서 시작`);
  }
  return index;
}

test('본체 조각: 이어 붙이면 goei-body.js, 판·길이·지문이 맞음', { skip: !existsSync(new URL('dist/goei-body.js', root)) }, () => {
  const body = read('dist/goei-body.js');
  const index = roundTrip('dist', 'goei-body.json', body);
  assert.equal(index.version, pkg.version);
  assert.match(body, new RegExp(`^// goei-body ${pkg.version.replace(/\./g, '\\.')}\\n`));
  assert.equal(index.hash, fnv(body), '목록의 hash = 본체 글 FNV-1a');
  // sha256(개선 나2): 이어 붙인 본체 전체의 UTF-8 바이트, 소문자 hex 64자. 조각마다는 넣지 않는다
  assert.match(index.sha256, /^[0-9a-f]{64}$/);
  assert.equal(index.sha256, createHash('sha256').update(body, 'utf8').digest('hex'), '목록의 sha256 = 본체 UTF-8 sha256');
  assert.deepEqual(Object.keys(index).sort(), ['hash', 'length', 'parts', 'sha256', 'version'], '목록 열쇠 (조각별 지문 없음)');
  // 글자 하나만 바뀌어도(길이 같음) 지문이 다르다 — 시작기가 길이만 보던 구멍
  const broken = body.slice(0, 1000) + (body[1000] === 'a' ? 'b' : 'a') + body.slice(1001);
  assert.equal(broken.length, body.length);
  assert.notEqual(fnv(broken), index.hash);
  assert.notEqual(createHash('sha256').update(broken, 'utf8').digest('hex'), index.sha256);
});

// 자료 팩 (개선 나1, docs/qc/09_개선_나_1.md): 세계·설치 자료는 본체에 없고 goei-data-<이름>.json + .N.txt 로. 본체에 박힌 지문 = 팩의 지문
test('자료 팩 조각: 이어 붙이면 팩 글, 지문이 본체에 박혀 있고, 본체에는 자료가 없다', { skip: !existsSync(new URL('dist/goei-data-world.json', root)) }, async () => {
  const { worldPackText, installPackText, textHash } = await import('../scripts/data-pack.mjs');
  const body = read('dist/goei-body.js');
  for (const [name, text, probe] of [['goei-data-world', worldPackText(), 'Sora Land Amusement Park'], ['goei-data-install', installPackText(), '"texts":[']]) {
    const index = roundTrip('dist', name + '.json', text);
    assert.equal(index.name, name);
    assert.equal(index.version, pkg.version);
    assert.equal(index.hash, textHash(text), `${name}: 목록의 hash = 팩 글 FNV-1a`);
    assert.equal(index.sha256, createHash('sha256').update(text, 'utf8').digest('hex'), `${name}: sha256`);
    assert.deepEqual(Object.keys(index).sort(), ['hash', 'length', 'name', 'parts', 'sha256', 'version']);
    // 본체에 박힌 지문 (core/datapack.ts 의 __WORLD_PACK__·__INSTALL_PACK__ define)
    // esbuild 가 define 글을 작은따옴표 문자열로 낸다: '{"hash":"…","sha256":"…","length":N}'
    assert.ok(body.includes(`"hash":"${index.hash}","sha256":"${index.sha256}","length":${index.length}`), `${name}: 본체에 같은 지문(hash·sha256·length)이 박혀 있음`);
    assert.ok(text.includes(probe) && !body.includes(probe), `${name}: 자료 본문은 팩에만 있고 본체에는 없음`);
  }
  const w = JSON.parse(worldPackText());
  assert.deepEqual([w.schema, w.kind], [1, 'world']);
  assert.deepEqual([Object.keys(w.agent).length, Object.keys(w.org).length, Object.keys(w.anomaly).length, Object.keys(w.site).length, Object.keys(w.appendix).length, Object.keys(w.relations.pairs).length], [55, 17, 63, 11, 4, 78]);
  const i = JSON.parse(installPackText());
  assert.deepEqual([i.schema, i.kind, i.greetings.texts.length, i.icon.file], [1, 'install', 57, 'icon.png']);
  // 본체 크기: 자료를 뺀 뒤 (개선 나1 전 3.42MB · 18조각)
  assert.ok(Buffer.byteLength(body) < 2_300_000, `본체 ${Buffer.byteLength(body)} 바이트 < 2.3MB`);
  // 세계 자료 한 파일(goei-data-world.txt, 릴리스 zip 에 넣어 받기 창의 「파일로 넣기」로): 조각을 이은 글과 같다
  assert.equal(read('dist/goei-data-world.txt'), worldPackText(), 'goei-data-world.txt = 팩 글 전체');
  // 시험용 예외 주입(src/body.ts faultOn 의 GOEI_TEST 블록)은 배포 본체에 없고 시험 본체(dist-test/goei-body.js)에만 있다
  assert.ok(!body.includes('__goeiFaultSteps'), '배포 본체에 예외 주입 전역 읽기가 없음');
  const testBody = read('dist-test/goei-body.js');
  assert.ok(testBody.includes('__goeiFaultSteps'), '시험 본체에는 있음');
  assert.equal(/^\/\/ goei-body (\S+)/.exec(testBody)?.[1], pkg.version, '시험 본체도 같은 판');
});

test('게임 코드 조각: 이어 붙이면 goei-game.js', { skip: !existsSync(new URL('dist/game/goei-game.js', root)) }, () => {
  const code = read('dist/game/goei-game.js');
  const index = JSON.parse(read('dist/game/index.json'));
  const joined = index.code.parts.map((n) => read(`dist/game/${n}`)).join('');
  assert.equal(joined, code);
  assert.equal(index.code.length, code.length);
  assert.equal(index.code.bytes, Buffer.byteLength(code));
  for (const n of index.code.parts) assert.ok(Buffer.byteLength(read(`dist/game/${n}`)) <= 200_000, n);
  for (const p of index.packs) {
    const whole = readFileSync(new URL(`dist/game/${p.id}.pack`, root));
    const joined = Buffer.concat(p.parts.map((n) => readFileSync(new URL(`dist/game/${n}`, root))));
    assert.ok(joined.equals(whole), `${p.id}: 조각을 이으면 팩`);
    assert.equal(p.bytes, whole.length);
    for (const n of p.parts) assert.ok(readFileSync(new URL(`dist/game/${n}`, root)).length <= 512 * 1024, n);
  }
});

test('토크나이저 조각: 이어 붙이면 순위표 JSON, 길이·지문', { skip: !existsSync(new URL('dist/tok-o200k.json', root)) }, () => {
  const index = JSON.parse(read('dist/tok-o200k.json'));
  const text = index.parts.map((n) => read(`dist/${n}`)).join('');
  assert.equal(text.length, index.length);
  const r = JSON.parse(text);
  assert.equal(typeof r.pat_str, 'string');
  assert.equal(typeof r.bpe_ranks, 'string');
  assert.equal(index.name, 'o200k_base');
});

test('위키 기본 문서 조각(release): 이어 붙이면 GOEIWIKI1 묶음, 길이', { skip: !existsSync(new URL('release/wiki-base.json', root)) }, () => {
  const index = JSON.parse(read('release/wiki-base.json'));
  const text = index.parts.map((n) => read(`release/${n}`)).join('');
  assert.equal(text.length, index.length);
  assert.ok(text.startsWith('GOEIWIKI1:'));
  for (const n of index.parts) assert.ok(Buffer.byteLength(read(`release/${n}`)) <= 200_000, n);
});

// release 폴더 자체의 짜임새: 시작기 머리의 판 = 본체 목록의 판 = 조각을 이은 본체 첫 줄의 판 = version.json = card-update.json.
// (dist 와 같은 내용인지는 릴리스 때 사람이 복사하므로 여기서 대조하지 않는다. 소스를 고치면 당연히 달라진다)
// + 자료 팩(개선 나1)을 쓰는 본체(글에 goei-data-world 가 있음)면 release 에 goei-data-world.*·goei-data-install.* 이 있고 그 지문이 본체에 박힌 것과 같아야 한다
//   (릴리스는 사람이 복사하므로 팩을 빠뜨리거나 옛 팩을 남기면 업데이트한 모든 사용자가 「올라오지 않았어요」에서 멈춘다)
test('release 폴더: 시작기·본체 조각·version.json·card-update.json 이 같은 판, 자료 팩이 본체와 같은 지문', { skip: !existsSync(new URL('release/goei-body.json', root)) }, () => {
  const loader = read('release/goei-plugin.js');
  const ver = /^\/\/@version (\S+)/m.exec(loader)?.[1];
  assert.ok(ver, '시작기 머리에 //@version');
  assert.match(loader, /^\/\/@update-url https:\/\/.*\/release\/goei-plugin\.js$/m, '//@update-url 이 release 폴더를 가리킴');
  const rel = JSON.parse(read('release/goei-body.json'));
  assert.equal(rel.version, ver, 'goei-body.json 판 = 시작기 판');
  const body = rel.parts.map((n) => read(`release/${n}`)).join('');
  assert.equal(body.length, rel.length);
  assert.equal(/^\/\/ goei-body (\S+)/.exec(body)?.[1], ver, '본체 첫 줄의 판 = 시작기 판');
  if (typeof rel.hash === 'string') assert.equal(rel.hash, fnv(body));
  if (typeof rel.sha256 === 'string') assert.equal(rel.sha256, createHash('sha256').update(body, 'utf8').digest('hex'));
  const v = JSON.parse(read('release/version.json'));
  assert.equal(v.plugin, ver);
  assert.equal(v.card, ver);
  const upd = JSON.parse(read('release/card-update.json'));
  assert.equal(upd.version, v.card);
  assert.equal(upd.minPlugin, v.minPlugin);
  const text = upd.parts.map((n) => read(`release/${n}`)).join('');
  assert.equal(text.length, upd.length);
  const game = JSON.parse(read('release/game/index.json'));
  assert.equal(game.version, ver, 'release/game/index.json 판');
  if (body.includes('goei-data-world')) {
    for (const name of ['goei-data-world', 'goei-data-install']) {
      assert.ok(existsSync(new URL(`release/${name}.json`, root)), `release/${name}.json 이 있어야 함 (자료 팩을 쓰는 본체)`);
      const index = JSON.parse(read(`release/${name}.json`));
      assert.equal(index.version, ver, `${name}: 목록 판 = 시작기 판`);
      const joined = index.parts.map((n) => read(`release/${n}`)).join('');
      roundTrip('release', `${name}.json`, joined);
      assert.equal(index.hash, fnv(joined), `${name}: 목록 hash = 조각을 이은 글 FNV`);
      assert.equal(index.sha256, createHash('sha256').update(joined, 'utf8').digest('hex'), `${name}: 목록 sha256`);
      assert.ok(body.includes(`"hash":"${index.hash}","sha256":"${index.sha256}","length":${index.length}`), `${name}: release 본체에 같은 지문이 박혀 있음 (팩과 본체가 같은 빌드)`);
    }
  }
});
