// 출시 전 QC · 본편 요청·응답·표시 파이프라인의 순수 로직 (docs/qc/02_request_pipeline.md).
// 고친 것의 회귀 시험 + 극값·깨진 입력. 실행: node --test tests/qc-pipeline.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  seedBody, SEED_OPEN, SEED_CLOSE, lore, withWorldLore, isVirtual, evaluate, withStatusBlock, STATUS_HEAD, cleanOutput, hasWorldTags,
  processOutput, startWorldVars, readWorld, parseCatalog, DEFAULT_SETTINGS, imgtag, budget, findStatusTags, setStatusColumns,
} from '../dist-test/core.mjs';

const dir = await mkdtemp(join(tmpdir(), 'goei-qc-pipe-'));
await build({ entryPoints: ['src/core/people/request.ts'], outdir: dir, bundle: true, platform: 'node', format: 'esm', outExtension: { '.js': '.mjs' }, logLevel: 'silent' });
const PR = await import(pathToFileURL(join(dir, 'request.mjs')));

// ── 시드 ──
test('seedBody: 표식·장식 줄을 떼고 CBS 를 푼다', () => {
  const raw = `${SEED_OPEN}\n@@dont_activate\n### {{#if {{equal::{{getvar::st_faction}}::A00}}}}Bureau{{/if}} ({{user}})\n본문\n\n---\n\n@@dont_activate\n@@depth 0\n둘째\n${SEED_CLOSE}`;
  const out = seedBody(raw, { vars: { $st_faction: 'A00' }, user: '유저' });
  assert.equal(out, '### Bureau (유저)\n본문\n\n---\n\n둘째');
  assert.equal(seedBody(raw, { vars: {} }), '###  ({{user}})\n본문\n\n---\n\n둘째', '유저 이름을 모르면 {{user}} 그대로');
  assert.equal(seedBody('', { vars: {} }), '');
  assert.equal(seedBody(`${SEED_OPEN}\n\n${SEED_CLOSE}`, { vars: {} }), '');
});

// ── 로어 덩어리 자리 ──
test('insertLoreBlock: 인사말 앞 → 채팅 첫 글 앞 → system 아닌 첫 메시지 앞 순서로 찾는다', () => {
  const { insertLoreBlock, LORE_MARK } = lore;
  const msgs = [{ role: 'system', content: '설명' }, { role: 'assistant', content: '인사말 원문이다.' }, { role: 'user', content: '첫 글' }];
  assert.equal(insertLoreBlock(msgs, '로어', ['인사말 원문이다.', '첫 글'])[1].content, `${LORE_MARK}\n로어`, '인사말 앞');
  assert.equal(insertLoreBlock(msgs, '로어', ['', '첫 글'])[2].content, `${LORE_MARK}\n로어`, '인사말이 없으면 첫 글 앞');
  assert.equal(insertLoreBlock(msgs, '로어', ['없는 글', '없는 글'])[1].content, `${LORE_MARK}\n로어`, '못 찾으면 system 아닌 첫 메시지 앞');
  assert.equal(insertLoreBlock(msgs, '로어', '첫 글')[2].content, `${LORE_MARK}\n로어`, '문자열 하나도 받는다');
  assert.equal(insertLoreBlock(msgs, '  ', ['첫 글']).length, 3, '빈 덩어리는 끼우지 않음');
});

// ── Risu 방식 + 가상 항목 ──
test('computeLore: 자리 항목 없는 카드의 Risu 방식은 가상 항목만 플러그인이 고른다', () => {
  const real = [{ key: 'folder:ag', comment: '🙂요원', mode: 'folder', content: '' }, { comment: '아무개', key: '아무개', folder: 'folder:ag', mode: 'normal', insertorder: 600, content: '아무개 글' }];
  const books = withWorldLore(real);
  assert.ok(books.some(isVirtual) && !lore.hasSlots(books));
  const chat = { message: [{ role: 'user', data: 'Jyaldi 와 아무개가 왔다.' }], scriptstate: {} };
  const opts = lore.loreOptions({ globalLore: books }, chat, 'risu');
  const got = lore.computeLore(books, chat, opts);
  assert.ok(got.picks.some((p) => p.entry.name === '쟈알디') && got.picks.some((p) => p.entry.name === '아무개'), 'Risu 방식 추정에는 둘 다');
  assert.ok(got.vars.$goei_lore_agent.includes('Jyaldi') && !got.vars.$goei_lore_agent.includes('아무개 글'), '끼우는 글은 가상 항목만 (진짜 항목은 Risu 가 켠다)');
  const plugin = lore.computeLore(books, chat, lore.loreOptions({ globalLore: books }, chat, 'plugin'));
  assert.ok(plugin.vars.$goei_lore_agent.includes('아무개 글'), '플러그인 방식은 둘 다');
  // 자리 항목이 있는 옛 카드의 Risu 방식은 자리를 비운다
  const old = [...real, ...['Faction', 'Mystic', 'Anomaly', 'Agent'].map((n) => ({ comment: `📚Lore slot · ${n}`, key: '', alwaysActive: true, mode: 'normal', content: '' }))];
  const oldGot = lore.computeLore(old, chat, lore.loreOptions({ globalLore: old }, chat, 'risu'));
  assert.equal(oldGot.vars.$goei_lore_agent, '');
});

// ── 인물 기록 시트 빼기 ──
test('stripSheets: 공백·줄바꿈이 달라도 그 글만 뺀다 (엉뚱한 범위를 자르지 않는다)', () => {
  const sheet = '### Character - Jyaldi\n#### Identity\n- Role: Chief ({{user}})\n\n---';
  const msgs = [{ role: 'system', content: `## RP\n### Play Principles\n- 규칙\n\n---\n\n${sheet}\n\n### Character - Aileen\n- 남김` }];
  const out = PR.stripSheets(msgs, [sheet.replace(/\n/g, '\n  ')]);
  assert.ok(out[0].content.includes('### Play Principles\n- 규칙') && out[0].content.includes('### Character - Aileen\n- 남김'), '다른 글은 그대로');
  assert.ok(!out[0].content.includes('Role: Chief'), '시트는 빠짐');
  assert.equal(PR.stripSheets(msgs, ['없는 시트'])[0], msgs[0], '없으면 그대로');
  assert.equal(PR.stripSheets(msgs, [])[0], msgs[0]);
});

// ── 상태창 블록 ──
test('withStatusBlock: 깨진 태그 (칸 부족·초과·전각·닫는 괄호 없음·여러 개)', () => {
  setStatusColumns({});
  const cols = ['date', 'time', 'weather', 'temp', 'place', 'target', 'companions', 'deployed', 'identity', 'wallet'];
  const run = (line) => withStatusBlock([{ role: 'assistant', content: `답.\n${line}` }, { role: 'user', content: '다음' }], '', { cols, wallet: 140000 }).find((m) => m.content.startsWith(STATUS_HEAD))?.content;
  assert.ok(run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]').includes('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음|없음|없음|없음|140000]'), '6칸 → 10칸');
  assert.ok(run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음|없음|없음|관리국/신입|1|덤|덤]').includes('|관리국/신입|140000]'), '칸 초과는 버림');
  assert.ok(run('【▣｜2025.01.01｜02:47 AM｜☀️｜4°C｜관리국｜없음｜없음｜없음｜관리국/신입｜1】').includes('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음|없음|없음|관리국/신입|140000]'), '전각');
  assert.ok(run('[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음|없음|없음|관리국/신입|1').includes('|관리국|'), '닫는 괄호 없음');
  assert.ok(run('[▣|2025.01.01|02:47 AM|☀️|4°C|첫|없음]\n[▣|2025.01.01|03:00 AM|☀️|4°C|둘|없음]').includes('|둘|'), '여러 개면 마지막');
  assert.equal(run('상태창 없음'), undefined);
  assert.ok(run('[▣|날짜?|시각?|☀️|4°C|관리국|없음]').includes('[▣|날짜?|시각?|☀️|4°C|관리국|없음]'), '못 읽는 줄은 그대로');
  // 두 번 불러도 블록 하나, 본문은 그대로
  const msgs = [{ role: 'assistant', content: '본문 `|` 표 | a | b |\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]' }, { role: 'user', content: '다음' }];
  const once = withStatusBlock(msgs, '', { cols, wallet: null });
  assert.equal(once[0].content, '본문 `|` 표 | a | b |');
  assert.equal(withStatusBlock(once, '', { cols, wallet: null }).length, once.length);
});

// ── cleanOutput: 본문 훼손 없음 ──
test('cleanOutput: 코드 블록·HTML·이모지·| 가 든 본문은 그대로, 태그만 지우고 상태창은 끝으로', () => {
  const body = '```js\nconst a = [1, 2] | 3;\n```\n<b>굵게</b> 🙂 표 | a | b |\n[AN|서울|x|활성|B|없음|상황] 뒤 글\n{0시간 3분 전}\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]\n맨 끝 글';
  const out = cleanOutput(body);
  assert.ok(out.startsWith('```js\nconst a = [1, 2] | 3;\n```\n<b>굵게</b> 🙂 표 | a | b |'));
  assert.ok(out.includes(' 뒤 글') && !out.includes('[AN|') && !out.includes('{0시간'));
  assert.ok(out.endsWith('맨 끝 글\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|없음]'), `상태창은 끝으로: ${out}`);
  assert.equal(cleanOutput('태그 없음'), '태그 없음');
  assert.equal(hasWorldTags('[AN |x]'), true);
  assert.equal(hasWorldTags('[ANx|'), false);
});

// ── 상황판 극값 ──
test('processOutput: Math.random 극값(0·0.999)·확률 0·상한 0·TTL 에서도 상한을 넘지 않고 예외가 없다', () => {
  const worldBook = { 괴이: [[true, '소라 랜드', '소라 랜드', 'Sora Land', []], [true, '명일 아파트', '명일 아파트', 'Myeongil Apartment', []]], '미스틱 사이트': [[true, '달빛 서점', '달빛 서점', 'Moon Books', []]], 랜드마크: [[true, '관리국 본부', '관리국', '관리국', 'Bureau HQ', '02', '종로구', 52.6, 44.6, []]] };
  const roster = { version: 2, refill: 2, characters: [{ id: 'P001', name: '쟈알디', english: 'Jyaldi', lore: '쟈알디', aliases: [], affiliation: 'A00', rank: '팀장', department: '종합대응팀', roster_for: ['A00'], phone_tabs: [] }] };
  const catalog = parseCatalog([{ comment: 'World catalog', content: JSON.stringify(worldBook) }, { comment: 'Agent roster', content: JSON.stringify(roster) }]);
  for (const rng of [() => 0, () => 0.999, () => 0.5]) {
    for (const S of [{ ...DEFAULT_SETTINGS }, { ...DEFAULT_SETTINGS, preset_p: 0, random_p: 0, incident_p: 0, mystic_p: 0 }, { ...DEFAULT_SETTINGS, preset_cap: 0, random_cap: 0, incident_cap: 0, mystic_cap: 0 }, { ...DEFAULT_SETTINGS, preset_ttl: 0, random_ttl: 0, incident_ttl: 0, mystic_ttl: 0 }, { ...DEFAULT_SETTINGS, preset_cap: 99, random_cap: 99 }]) {
      const vars = startWorldVars(catalog, S, 'A00', rng);
      let chat = { message: [{ role: 'user', data: 'hi' }], scriptstate: { $st_faction: 'A00', $st_pick: 'A00', $ib_affiliation: '관리국', ...vars } };
      for (let i = 0; i < 6; i++) {
        const text = `본문 ${i}\n[AN|서울특별시 종로구|괴이${i}|활성|B|없음|상황]\n[▣|2025.01.0${i + 1}|02:47 AM|☀️|4°C|관리국|없음]`;
        chat = { ...chat, message: [...chat.message, { role: 'user', data: `u${i}` }, { role: 'char', data: text }] };
        const next = processOutput(chat, chat.message.length - 1, text, catalog, S, rng);
        assert.ok(next, '바꿀 것이 있다');
        chat = next;
        const w = readWorld(chat);
        const auto = (k) => w.an.filter((e) => e.origin === 'auto' && e.kind === k).length;
        assert.ok(auto('preset') <= S.preset_cap && auto('random') <= S.random_cap, `자동 발생은 상한 안: ${auto('preset')}/${S.preset_cap} ${auto('random')}/${S.random_cap}`);
        assert.ok(w.inc.filter((e) => e.origin === 'auto').length <= S.incident_cap);
        assert.ok(w.ms.filter((e) => e.origin === 'auto').length <= S.mystic_cap);
        assert.ok(w.an.length <= S.preset_cap + S.random_cap + S.extra_cap + 1, '모델이 만든 것도 여유분 안');
        assert.equal(chat.message.at(-1).data, `본문 ${i}\n[▣|2025.01.0${i + 1}|02:47 AM|☀️|4°C|관리국|없음]`);
      }
      assert.equal(processOutput(chat, chat.message.length - 1, chat.message.at(-1).data, catalog, S, rng), null, '같은 응답은 다시 처리하지 않음');
    }
  }
});

// ── 이미지 태그 ──
test('imgtag: 이름에 기호가 있거나 모르는 이름이면 칸을 그리지 않고, 요청에서는 최근 n개 밖만 지운다', () => {
  const pick = (n) => (n === 'Jyaldi_smile' ? 'Jyaldi_smile' : null);
  const out = imgtag.renderImgTags('a <img={{x}}_smile> b <img=Jyaldi_smile> c <img=Nobody_smile>', pick, 0);
  assert.equal((out.match(/class="gim"/g) ?? []).length, 1);
  assert.ok(!out.includes('{{x}}') && !out.includes('Nobody'));
  const msgs = [{ role: 'system', content: '<img=Jyaldi_smile>' }, { role: 'assistant', content: 'a <img=Jyaldi_smile>' }, { role: 'user', content: 'b' }, { role: 'assistant', content: 'c <img=Jyaldi_smile>' }, { role: 'user', content: 'd' }];
  assert.equal(imgtag.stripOldImgTags(msgs, 0), msgs, '0이면 그대로');
  const one = imgtag.stripOldImgTags(msgs, 1);
  assert.deepEqual(one.map((m) => m.content.includes('<img=')), [true, false, false, false, false], 'system 은 세지 않고 최근 1개만');
  const three = imgtag.stripOldImgTags(msgs, 3);
  assert.deepEqual(three.map((m) => m.content.includes('<img=')), [true, false, false, true, false]);
  assert.equal(imgtag.stripOldImgTags(msgs, 30), msgs, '전부 안이면 같은 배열');
});

// ── CBS ──
test('cbs: 중첩·미지 변수·{{user}}·#when 비교·{{? 식}}', () => {
  const env = { vars: { $a: '1', $name: '조용한 아저씨 말투' }, char: '봇' };
  assert.equal(evaluate('{{#if {{equal::{{getvar::a}}::1}}}}예{{:else}}아니{{/if}}', env), '예');
  assert.equal(evaluate('{{#if {{equal::{{getvar::b}}::1}}}}예{{:else}}아니{{/if}}', env), '아니', '없는 변수는 null');
  assert.equal(evaluate('{{getvar::b}}', env), 'null');
  assert.equal(evaluate('{{user}}·{{char}}', env), '{{user}}·봇', '이름을 모르면 {{user}} 그대로');
  assert.equal(evaluate('{{user}}', { ...env, user: '유저' }), '유저');
  assert.equal(evaluate('{{#when::a::vis::1}}켬{{/when}}{{#when::a::vis::2}}끔{{/when}}', env), '켬');
  assert.equal(evaluate('{{#if {{? {{getvar::a}} + 2 == 3}}}}셋{{/if}}', env), '셋');
  assert.equal(evaluate('{{#if {{? {{getvar::name}} == "조용한 아저씨 말투"}}}}맞음{{/if}}', env), '맞음', '띄어쓰기 있는 글 비교');
  assert.equal(evaluate('{{#if {{not::0}}}}A{{/if}}{{#if {{and::1::0}}}}B{{/if}}{{#if {{or::1::0}}}}C{{/if}}', env), 'AC');
  assert.equal(evaluate('{{unknown::x}} 그대로 {{#if 1}}열림', env), '{{unknown::x}} 그대로 {{#if 1}}열림', '모르는 태그·안 닫힌 블록은 그대로');
  assert.equal(evaluate('{{#if 1}}{{#if 0}}안{{:else}}속{{/if}}밖{{/if}}', env), '속밖', '중첩');
  assert.equal(evaluate('깨진 {{ 끝', env), '깨진 {{ 끝');
  assert.equal(evaluate('{{length::abc}}{{trim:: x }}', env), '3x');
});

// ── 참고 기록 총 상한 ──
test('fitTotal: 합이 상한 안이면 그대로, 넘으면 비율로 나눠 다시 만든다', () => {
  const part = (cap, text) => ({ cap, build: (c) => text.slice(0, c * 2) });
  assert.deepEqual(budget.fitTotal([part(100, 'a'.repeat(50)), part(100, 'b'.repeat(50))], 0), ['a'.repeat(50), 'b'.repeat(50)], '0이면 제한 없음');
  const out = budget.fitTotal([part(1000, 'a'.repeat(4000)), part(1000, 'b'.repeat(4000))], 100);
  assert.ok(out.every((t) => t.length <= 200) && out.every((t) => t.length > 0), `나눠 담음: ${out.map((t) => t.length)}`);
});

// ── findStatusTags 가 $& 같은 글자를 그대로 돌려준다 (표시 치환은 함수로) ──
test('findStatusTags: 값에 $& 가 있어도 원문 그대로', () => {
  const t = findStatusTags('[▣|2025.01.01|02:47 AM|☀️|4°C|R$&D 연구소|$\' 목표]')[0];
  assert.equal(t.place, 'R$&D 연구소');
  assert.equal(t.target, "$' 목표");
});
