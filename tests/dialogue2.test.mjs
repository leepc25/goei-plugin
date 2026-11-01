// 새 대사 자료 읽기 (src/game/world/dialogue2.ts): 칸 열쇠 → 소속·평판 24갈래, chars 먼저, 상대가 주인공이 아니면 other, NPC 파일 고르기, gzip 팩 풀기
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const dir = await mkdtemp(join(tmpdir(), 'goei-dialogue2-'));
await build({ entryPoints: ['src/game/world/dialogue2.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const D = await import(pathToFileURL(join(dir, 'dialogue2.mjs')));

const cell24 = (lines) => Object.fromEntries(['A00', 'B00', 'C00', 'D00', 'E00', 'etc'].map((f) => [f, Object.fromEntries(['friend', 'neutral', 'wary', 'hostile'].map((r) => [r, Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, v.map((s) => `${f}/${r}/${s}`)]))]))]));
const 잼트리 = {
  name: '잼트리', faction: 'A00',
  facing: cell24({ greet: ['안녕', '왔네', '어서'], talk: ['나중에', '바빠', '잠깐'], hit1: ['아야'], hit2: ['그래'] }),
  chars: { 쟈알디: { greet: ['부장님, 블랙이시죠.', '부장님 오셨어요.', '부장님, 한숨부터요?'] } },
  react: cell24({ follow_yes: ['같이 가요'] }),
  expel: cell24({ warn: ['거기까지'] }),
  expel_other: { warn: ['손님, 거기까지예요.'] },
  combat: { ...cell24({ start: ['시작'], faint: ['으'] }), other: { start: ['저쪽 싸움'] } },
  social: { mate_greet: ['안녕~'], mate: { 쟈알디: ['부장님 커피'] }, topics: { 커피: { open: ['커피 마셔요'], reply: ['좋죠'] } } },
  situation: { crowd: ['뭐야'], alert: ['경보네'] },
  time: { morning: ['아침'], day: ['낮'], evening: ['저녁'], night: ['밤'] },
};
const data = { 'c_잼트리': 잼트리 };
const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };

test('칸 열쇠 하나로 소속·평판 24갈래를 푼다 (모르는 소속은 etc, 평판 없음은 neutral)', () => {
  const d = new D.Dialogue2(async () => null, () => 0, data);
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'A00', stance: 'friendly' }), 'A00/friend/안녕');
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'B00', stance: 'hostile' }), 'B00/hostile/안녕');
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'F00', stance: null }), 'etc/neutral/안녕', '명부 세력(F00~)은 etc, 평판 모르면 neutral');
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'C00', stance: 'favorable' }), 'C00/friend/안녕', '호의도 friend');
  assert.equal(d.line('named', '잼트리', 'facing.A00.wary.talk', { faction: 'B00' }), 'A00/wary/나중에', '풀어 쓴 경로도 그대로');
  assert.equal(d.line('named', '잼트리', 'time', { faction: 'A00', hour: 7 }), '아침');
  assert.equal(d.line('named', '잼트리', 'time', { faction: 'A00', hour: 22 }), '밤');
  assert.equal(d.line('named', '잼트리', 'situation.alert', { faction: 'A00' }), '경보네');
  assert.equal(d.line('named', '잼트리', 'social.topics.커피.open', { faction: 'A00' }), '커피 마셔요');
  assert.equal(d.line('named', '잼트리', 'busy.work', { faction: 'A00' }), null, '없는 칸은 null (억지로 안 끼움)');
  assert.equal(d.line('named', '없는사람', 'facing.greet', { faction: 'A00' }), null);
});

test('주인공이 아는 인물로 플레이 중이면 chars.<인물> 칸 먼저, 그 칸이 없으면 소속 칸', () => {
  const d = new D.Dialogue2(async () => null, () => 0, data);
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'A00', stance: 'neutral', player: '쟈알디' }), '부장님, 블랙이시죠.');
  assert.equal(d.line('named', '잼트리', 'facing.talk', { faction: 'A00', stance: 'neutral', player: '쟈알디' }), 'A00/neutral/나중에', 'chars 에 talk 이 없으면 소속 칸');
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'A00', stance: 'neutral', player: '큐라스' }), 'A00/neutral/안녕', '관계 없는 인물은 소속 칸');
});

test('상대가 주인공이 아니면 expel_other · combat.other, 수다는 상대 인물 칸 먼저', () => {
  const d = new D.Dialogue2(async () => null, () => 0, data);
  assert.equal(d.line('named', '잼트리', 'expel.warn', { faction: 'A00', target: '{user}' }), 'A00/neutral/거기까지');
  assert.equal(d.line('named', '잼트리', 'expel.warn', { faction: 'A00', target: '행인' }), '손님, 거기까지예요.');
  assert.equal(d.line('named', '잼트리', 'combat.start', { faction: 'A00', target: '불량배' }), '저쪽 싸움');
  assert.equal(d.line('named', '잼트리', 'react.follow_yes', { faction: 'A00', target: '행인' }), null, 'other 칸이 없는 묶음은 null');
  assert.equal(d.line('named', '잼트리', 'social.mate', { faction: 'A00', partner: '쟈알디' }), '부장님 커피');
  assert.equal(d.line('named', '잼트리', 'social.mate', { faction: 'A00', partner: '큐라스' }), '안녕~', '관계 칸이 없으면 mate_greet');
});

test('최근에 쓴 줄은 피한다', () => {
  const d = new D.Dialogue2(async () => null, seq([0, 0, 0, 0.5, 0.99]), data);
  const got = [];
  for (let i = 0; i < 3; i++) got.push(d.line('named', '잼트리', 'facing.greet', { faction: 'A00', stance: 'neutral' }));
  assert.deepEqual(new Set(got).size, 3, `${got}`);
});

test('NPC 파일 고르기: 원형·성별·거점 소속', () => {
  assert.equal(D.npcFileOf('행인', '여', null), '행인_여');
  assert.equal(D.npcFileOf('의사', '여', null), '의사_남', '의사는 남자 그림만');
  assert.equal(D.npcFileOf('간호사', '남', null), '간호사_여');
  assert.equal(D.npcFileOf('편의점 점원', '남', null), '상인_남');
  assert.equal(D.npcFileOf('경비', '여', 'A00'), '경비_여');
  assert.equal(D.npcFileOf('경비', '남', null), '경비_남', '소속 모르면 관리국 파일');
  assert.equal(D.npcFileOf('경비', '여', 'B00'), '가짜 관리국 진압부대_남', '가짜 관리국은 남성만');
  assert.equal(D.npcFileOf('행정 직원', '남', 'B00'), '가짜 관리국 검사부대_남');
  assert.equal(D.npcFileOf('관리국 요원', '여', 'C00'), '백일몽 직원_여');
  assert.equal(D.npcFileOf('안내 직원', '남', 'E00'), '프리랜서_남');
  assert.equal(D.npcFileOf('경비', '여', 'F00'), '협회 직원_여', '명부 세력은 협회 직원 파일');
  assert.equal(D.npcFileOf(undefined, '남', null), null);
});

test('gzip 팩 파일을 받아 풀고, 받기 전에는 null 이다가 받은 뒤 줄이 나온다', async () => {
  const files = { 'c_잼트리.json.gz': gzipSync(Buffer.from(JSON.stringify(잼트리))) };
  const d = new D.Dialogue2(async (f) => (files[f] ? new Uint8Array(files[f]) : null), () => 0);
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'A00' }), null, '아직 안 받음 (받기 시작)');
  await d.prefetch('named', ['잼트리']);
  assert.equal(d.line('named', '잼트리', 'facing.greet', { faction: 'A00' }), 'A00/neutral/안녕');
  assert.equal(d.has('named', '잼트리'), true);
  await d.prefetch('mob', ['없는파일']);
  assert.equal(d.has('mob', '없는파일'), false);
});

test('대사 팩(game-pack/dialogue)은 인물 52·NPC 30, 파일마다 gzip JSON 이 새 구조다', async () => {
  const dirp = 'game-pack/dialogue';
  const list = await readdir(dirp);
  const idx = JSON.parse(await readFile(join(dirp, 'index.json'), 'utf8'));
  assert.equal(idx.chars.length, 52);
  assert.equal(idx.npc.length, 30);
  for (const n of idx.chars) assert.ok(list.includes(`c_${n}.json.gz`), n);
  for (const n of idx.npc) assert.ok(list.includes(`n_${n}.json.gz`), n);
  assert.deepEqual(JSON.parse(await readFile(join(dirp, 'pack.json'), 'utf8')), { id: 'dialogue', required: true });
  const txt = await D.gunzipText(new Uint8Array(await readFile(join(dirp, 'c_잼트리.json.gz'))));
  const j = JSON.parse(txt);
  assert.equal(j.name, '잼트리');
  for (const g of ['facing', 'react', 'busy', 'companion', 'injured', 'combat', 'shower', 'social', 'situation', 'time']) assert.ok(j[g], g);
  assert.equal(j.facing.A00.friend.greet.length, 3);
  const g = JSON.parse(await D.gunzipText(new Uint8Array(await readFile(join(dirp, 'n_경비_여.json.gz')))));
  for (const c of ['warn', 'attack', 'attack_weapon', 'attack_threat', 'pass_companion', 'pass_permit', 'alarm']) { assert.equal(g.expel.D00.neutral[c].length, 3, c); assert.equal(g.expel_other[c].length, 3, c); }
  assert.equal(g.situation.alert.length, 3);
});
