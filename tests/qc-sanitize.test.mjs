// QC 개선 나3 (2026-10-29): 요청 조립의 마지막 정리 단계 core/sanitize.ts stripMarkers.
// 플러그인 표식 전수 제거 · 본문 유지 · 멱등 · 정상 요청은 같은 배열 · 깨진 입력에도 던지지 않음. 실행: node --test tests/qc-sanitize.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sceneRecord, startRecord, setUnsent, phone, SEED_OPEN, SEED_CLOSE, unwrapScenes, unwrapCalls, stripStartCard, stripUnsentMark, applySeedLifetime } from '../dist-test/core.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-qc-sanitize-'));
await build({ entryPoints: ['src/core/sanitize.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const { stripMarkers, stripMarkerText, hasPluginMarkers, PLUGIN_MARKERS } = await import(pathToFileURL(join(dir, 'sanitize.mjs')));

const usr = (c) => ({ role: 'user', content: c });
const bot = (c) => ({ role: 'assistant', content: c });
const sys = (c) => ({ role: 'system', content: c });
const texts = (out) => out.map((m) => m.content).filter((c) => typeof c === 'string');
const noMarkers = (out) => texts(out).every((c) => !PLUGIN_MARKERS.some((k) => c.includes(k)) && !/%%[A-Z_/]+%%/.test(c));

/** 플러그인이 채팅에 남기는 표식을 전부 담은 요청 (각 단계가 하나도 돌지 않은 원문 모양) */
function rawRequest() {
  return [
    sys('SYSTEM'),
    sys(`<!-- goei:lore -->\n## RP Guidance\n규칙\n${SEED_OPEN}\n### Character - Jyaldi\n시드 본문\n${SEED_CLOSE}\n### Character - Aileen\n고른 로어`),
    bot('첫 장면\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국 본부|없음]'),
    usr(startRecord('시작 화면에서 적은 첫 상황')),
    bot('[AN|명일 아파트|발생] 괴이가 나타났다.\n[🔓|부록 하나]\n[▣|2025.01.01|03:00 AM|☀️|4°C|관리국 본부|명일 아파트]'),
    usr(sceneRecord({ target: '명일 아파트', party: '쟈알디' }, '{{user}} moves to 명일 아파트 with 쟈알디.') + '\n추가 요청'),
    usr(phone.callRecord('에일린', '지원 요청')),
    usr(setUnsent('아직 안 보낸 글', true)),
    usr('마지막 행동'),
  ];
}

test('PLUGIN_MARKERS: 코드의 표식 상수와 같은 글 (dispatch·phone·seed)', () => {
  const sample = rawRequest().map((m) => m.content).join('\n');
  for (const k of PLUGIN_MARKERS) assert.ok(sample.includes(k), `원문 표본에 ${k}`);
  assert.ok(hasPluginMarkers(sample));
  assert.ok(!hasPluginMarkers('%% 할인 50%% 글'), '우리 표식이 아닌 %% 는 표식이 아님');
  assert.ok(!hasPluginMarkers(null) && !hasPluginMarkers(12));
});

test('stripMarkers: 표식 전수 제거, 본문·다른 메시지는 그대로', () => {
  const inp = rawRequest();
  const out = stripMarkers(inp);
  assert.ok(noMarkers(out), `표식 없음: ${JSON.stringify(texts(out))}`);
  assert.equal(out.length, inp.length, '메시지 수 유지 (합치지 않음)');
  assert.equal(out[0], inp[0], '표식 없는 메시지는 같은 객체');
  assert.equal(out[1].content, '<!-- goei:lore -->\n## RP Guidance\n규칙\n### Character - Jyaldi\n시드 본문\n### Character - Aileen\n고른 로어', '시드: 표식만 떼고 본문 유지');
  assert.equal(out[3].content, '시작 화면에서 적은 첫 상황');
  assert.equal(out[5].content, '{{user}} moves to 명일 아파트 with 쟈알디.\n추가 요청', '지시문: 표식 줄만');
  assert.equal(out[6].content, '{{user}} places a phone call to 에일린.\n\n지원 요청');
  assert.equal(out[7].content, '아직 안 보낸 글');
  assert.equal(out[2].content, inp[2].content, '상태창 줄은 지우지 않음 (모델 자신의 출력, 다음 턴에 필요)');
  assert.equal(out[4].content, inp[4].content, '기본은 상황판 태그도 그대로 (괴이 카드가 아닐 수 있음)');
  assert.ok(texts(out).some((c) => c.includes('[▣|')), '상태창은 남음');
});

test('stripMarkers: worldTags 옵션(괴이 카드)이면 지난 응답의 상황판 태그·해금 표시도 지운다, 사용자 글은 건드리지 않음', () => {
  const inp = [bot('[AN|명일 아파트|발생] 괴이가 나타났다.\n[🔓|부록 하나]\n[▣|a|b]'), usr('[AN|내 글|x] 사용자가 쓴 괄호')];
  const out = stripMarkers(inp, { worldTags: true });
  assert.ok(!out[0].content.includes('[AN|') && !out[0].content.includes('[🔓|'), out[0].content);
  assert.ok(out[0].content.includes('괴이가 나타났다.') && out[0].content.includes('[▣|a|b]'));
  assert.equal(out[1], inp[1], 'assistant 아닌 메시지는 그대로');
});

test('stripMarkers: 멱등 — 두 번 돌려도 같고, 각 단계가 정상 처리한 결과에는 바뀌는 것이 없다(같은 배열)', () => {
  const once = stripMarkers(rawRequest());
  const twice = stripMarkers(once);
  assert.equal(twice, once, '표식이 없으면 같은 배열 객체');
  // 정상 경로: 단계들이 지운 뒤 모양 (unwrap·stripStartCard·stripUnsentMark·applySeedLifetime)
  let m = unwrapCalls(unwrapScenes(rawRequest()).messages).messages;
  m = m.map((x) => (typeof x.content === 'string' ? { ...x, content: applySeedLifetime(stripStartCard(stripUnsentMark(x.content)), true) } : x));
  assert.ok(noMarkers(m), '정상 단계가 이미 지움');
  assert.equal(stripMarkers(m), m, '정상 결과는 그대로 통과');
  const clean = [sys('S'), usr('안녕'), bot('반가워\n[▣|a|b]')];
  assert.equal(stripMarkers(clean), clean);
  assert.equal(stripMarkers(clean, { worldTags: true }), clean);
});

test('stripMarkers: 깨진 입력에도 던지지 않는다', () => {
  assert.equal(stripMarkers(null), null);
  assert.equal(stripMarkers(undefined), undefined);
  assert.equal(stripMarkers('글'), '글');
  const weird = [null, undefined, 3, 'x', { role: 'user' }, { role: 'user', content: null }, { role: 'user', content: ['a', { type: 'image' }] }, usr('%%SEED%%'), usr('%%SCENE_CARD:zz%%\n본문\n%%/SCENE_CARD%%'), usr('%%/PHONE_CALL%%만'), usr('%%GOEI_UNSENT%%%%GOEI_UNSENT%%')];
  const out = stripMarkers(weird, { worldTags: true });
  assert.equal(out.length, weird.length);
  for (let i = 0; i < 7; i++) assert.equal(out[i], weird[i], `이상한 항목 ${i} 는 그대로`);
  assert.equal(out[7].content, '');
  assert.equal(out[8].content, '%%SCENE_CARD:zz%%\n본문', 'hex 가 아닌 지시문 머리는 우리 표식이 아니라 두고 닫는 표식만');
  assert.equal(out[9].content, '만');
  assert.equal(out[10].content, '');
  assert.ok(noMarkers(out.filter((m) => m && typeof m.content === 'string').filter((m) => m !== out[8])));
});

test('stripMarkerText: 줄바꿈 정리 (앞뒤 빈 줄이 늘어나지 않음, CRLF)', () => {
  assert.equal(stripMarkerText('앞\r\n%%GOEI_START%%\r\n본문\r\n%%/GOEI_START%%\r\n%%GOEI_UNSENT%%'), '앞\r\n본문');
  assert.equal(stripMarkerText(`${SEED_OPEN}\n\n\n본문\n\n\n${SEED_CLOSE}\n뒤`), '\n\n본문\n\n뒤');
  assert.equal(stripMarkerText('표식 없음'), '표식 없음');
});
