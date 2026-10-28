// QC 03 · 시작 화면 전수: 세력 전부 × 언어(ko/en) × 시나리오 전부(직접 입력·커스텀 임무 포함)를 세 뷰포트에서 실제로 출발시켜
// 저장된 chat(fmIndex·scriptstate·시드·명단)을 확인한다. 캐릭터로 플레이, 재선택(staged), 시작 전/뒤 설정 창 범위, 랜딩 메시지도.
// 사용법: node tests/qc-settings-start-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { boot, chatOf, closeWin, launch, loadFixture, openEditor, closeEditor, openWin, setChat, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const { fixture, manifest } = fx;
const scenarios = JSON.parse((await import('node:fs')).readFileSync(new URL('../src/data/scenarios.json', import.meta.url), 'utf8'));
const directory = JSON.parse(fixture.globalLore.find((e) => e.comment === 'Directory').content);

const browser = await launch();
let starts = 0;
/** 출발 뒤 저장을 기다린다. 안 되면 알림·단추 상태를 같이 보여 준다 */
async function waitStart(page, label) {
  try {
    await page.waitForFunction(() => window.__calls.setChat.length >= 1, null, { timeout: 15000 });
  } catch (e) {
    const info = await page.evaluate(() => ({ notice: document.querySelector('.gx-foot [role=alert]')?.textContent, disabled: document.querySelector('.gx-start')?.disabled, txt: document.querySelector('.gx-start')?.textContent, shown: document.querySelector('.gx')?.style.display }));
    throw new Error(`${label}: 출발 뒤 저장 안 됨 ${JSON.stringify(info)}`);
  }
}

for (const vp of vps) {
  const { page, errors } = await boot(browser, fx, { message: [], scriptstate: {} }, vp);
  await openWin(page);
  await page.waitForSelector('.gx-fac');
  const facs = await page.$$eval('.gx-fac', (els) => els.map((e) => e.dataset.value));
  assert.deepEqual(facs, scenarios.factions.map((f) => f.code), `${vp}: 세력 카드 다섯`);
  assert.equal(await page.isDisabled('.gx-start'), true, '소속 전 출발 불가');

  const fresh = async () => {
    await closeWin(page);
    await setChat(page, { message: [], scriptstate: {} });
    await openWin(page);
    await page.waitForSelector('.gx-fac');
  };

  for (const f of scenarios.factions) {
    for (const lang of ['ko', 'en']) {
      for (const sc of f.scenarios) {
        await fresh();
        await page.evaluate((c) => document.querySelector(`.gx-fac[data-value="${c}"]`).click(), f.code);
        await page.waitForFunction((c) => document.querySelector('.gx-fac.on')?.dataset.value === c, f.code);
        await page.evaluate((l) => document.querySelector(`.gx-seg[data-value="${l}"]`).click(), lang);
        await page.evaluate((fm) => document.querySelector(`.gx-sc[data-value="${fm}"]`).click(), sc.fm);
        await page.waitForFunction((fm) => document.querySelector('.gx-sc.on')?.dataset.value === String(fm), sc.fm);
        // 기본 시나리오 표시: 세력을 고른 직후 기본값이 눌려 있었는지는 아래 defaultScenario 로 따로 본다
        if (sc.kind === 'direct') {
          assert.equal(await page.isDisabled('.gx-start'), true, `${f.code}-${lang}-${sc.fm}: 빈 상황이면 출발 불가`);
          await page.fill('[data-input="start-note"]', `상황 ${f.code} ${lang} ${sc.fm}`);
          await page.waitForFunction(() => !document.querySelector('.gx-start').disabled);
        } else {
          assert.equal(await page.isDisabled('.gx-start'), false, `${f.code}-${lang}-${sc.fm}: 출발 가능`);
        }
        const sum = await page.textContent('.gx-foot-sum');
        assert.ok(sum.includes(sc.label), `요약 줄에 장면 이름: ${sum}`);
        await page.evaluate(() => document.querySelector('.gx-start').click());
        await waitStart(page, `${f.code}-${lang}-${sc.fm}`);
        const saved = await page.evaluate(() => window.__calls.setChat[0]);
        starts++;
        const key = `${f.code}-${lang}-${sc.fm}`;
        const direct = f.scenarios.find((s) => s.kind === 'direct');
        const expectIdx = manifest.greetings[key] ?? (sc.kind === 'preset' && direct ? manifest.greetings[`${f.code}-${lang}-${direct.fm}`] : undefined);
        assert.equal(saved.fmIndex, expectIdx, `${key}: fmIndex`);
        assert.ok(Number.isInteger(saved.fmIndex) && saved.fmIndex < fixture.alternateGreetings.length, `${key}: 인사말 범위`);
        const ss = saved.scriptstate;
        assert.equal(ss.$st_faction, f.code, `${key}: 세력`);
        assert.equal(ss.$st_lang, lang);
        assert.equal(ss.$st_fm, String(sc.fm));
        assert.equal(ss.$st_pick, f.code);
        assert.equal(ss.$ib_affiliation, f.affiliation ?? ss.$ib_affiliation);
        // 시드: 명부 「시작 로어북」에 그 조합이 있으면 %%SEED%% 묶음, 없으면(직접 입력·커스텀 임무 일부) 빈 글
        if ((directory['시작 로어북']?.[`${f.code}-${sc.fm}`] ?? []).length) assert.match(String(ss.$seed_lore ?? ''), /^%%SEED%%/, `${key}: 시드`);
        else assert.equal(ss.$seed_lore, '', `${key}: 시드 없음`);
        assert.equal(ss.$st_anomaly_on, '1', `${key}: 상황판 켬`);
        assert.ok(typeof ss.$goei_world === 'string' && JSON.parse(ss.$goei_world), `${key}: 세계 변수`);
        assert.equal(typeof ss.$ag_report, 'string', `${key}: 요원 보고`);
        assert.equal(ss.$st_fixed_theme, 'dark', `${key}: 테마 기본값`);
        // 기본값에서 온 변수: 괴이 생성 수치는 전부 채팅에 적힌다
        for (const k of ['preset_cap', 'random_p', 'incident_ttl', 'landmark_share', 'extra_ms_cap']) assert.ok(ss[`$wg_${k}`] !== undefined, `${key}: $wg_${k}`);
        if (sc.kind === 'opening') {
          const text = fixture.alternateGreetings[saved.fmIndex];
          assert.ok(text.length > 100, `${key}: 첫 장면 글`);
          // 언어: 영어 첫 장면은 한글이 거의 없다
          const hangul = (text.match(/[가-힣]/g) ?? []).length;
          if (lang === 'en') assert.ok(hangul < text.length * 0.05, `${key}: 영어 첫 장면 (한글 ${hangul})`);
          else assert.ok(hangul > 50, `${key}: 한국어 첫 장면`);
          await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
          assert.equal(saved.message.length, 0, `${key}: 메시지 없음`);
          const hinted = await page.evaluate((t) => window.__calls.handlers.display(t), text);
          assert.ok(hinted.includes('data-goei-card="opening"') && hinted.includes('data-goei-repick'), `${key}: 첫 장면 아래 안내`);
        } else if (sc.kind === 'direct') {
          assert.equal(fixture.alternateGreetings[saved.fmIndex], '', `${key}: 빈 인사말`);
          assert.equal(saved.message.length, 1);
          assert.ok(saved.message[0].data.includes(`상황 ${f.code} ${lang} ${sc.fm}`), `${key}: 적은 상황`);
          await page.waitForFunction(() => window.__calls.send?.length >= 1 && document.querySelector('.gx')?.style.display === 'none');
          await page.evaluate(() => { window.__calls.send = []; });
        } else {
          // 커스텀 임무: 창은 열린 채 첫 장면 고르기 화면
          await page.waitForSelector('.gx-mbox, .gx-mlist, [data-action="repick"]');
          assert.ok(await page.$('[data-action="repick"]'), `${key}: 다시 고르기 단추`);
          assert.equal(fixture.alternateGreetings[saved.fmIndex], '', `${key}: 커스텀 임무도 빈 인사말`);
          // 다시 고르기 → 시작 화면 (staged)
          await page.evaluate(() => document.querySelector('[data-action="repick"]').click());
          await page.waitForSelector('.gx-fac.on');
          assert.equal(await page.getAttribute('.gx-fac.on', 'data-value'), f.code, `${key}: 재선택에 세력 유지`);
          assert.equal(await page.getAttribute('.gx-sc.on', 'data-value'), String(sc.fm));
          assert.ok((await page.textContent('.gx-head small')).includes('다시 고를 수 있어요'));
        }
      }
    }
    // 세력을 (다른 세력에서) 고른 직후 기본 시나리오가 눌려 있다. 같은 세력을 다시 고르면 이전 선택이 남는다 (의도: 마지막 선택 기억)
    await fresh();
    const other = scenarios.factions.find((x) => x.code !== f.code).code;
    await page.evaluate((c) => document.querySelector(`.gx-fac[data-value="${c}"]`).click(), other);
    await page.waitForFunction((c) => document.querySelector('.gx-fac.on')?.dataset.value === c, other);
    await page.evaluate((c) => document.querySelector(`.gx-fac[data-value="${c}"]`).click(), f.code);
    await page.waitForFunction((c) => document.querySelector('.gx-fac.on')?.dataset.value === c, f.code);
    assert.equal(await page.getAttribute('.gx-sc.on', 'data-value'), String(scenarios.defaultScenario[f.code] ?? f.scenarios[0].fm), `${f.code}: 기본 장면`);
    const n = await page.locator('.gx-sc').count();
    assert.equal(n, f.scenarios.length, `${f.code}: 장면 ${f.scenarios.length}개`);
    assert.ok((await page.textContent('.gx-h2-sub')).includes(`${n}개`));
    // 캐릭터로 플레이: 주인공 카드가 있으면 준비된 첫 장면은 숨고 직접 입력·커스텀만
    const who = await page.$$eval('.gx-whoc', (els) => els.map((e) => e.dataset.value));
    assert.equal(who[0], '', `${f.code}: 첫 카드는 내 페르소나`);
    const agents = directory.요원?.filter?.((a) => (a.roster_for ?? []).includes(f.code)) ?? [];
    if (who.length > 1) {
      await page.evaluate((id) => document.querySelector(`.gx-whoc[data-value="${id}"]`).click(), who[1]);
      await page.waitForFunction(() => document.querySelector('.gx-whoc.on')?.dataset.value !== '');
      const left = await page.$$eval('.gx-sc', (els) => els.map((e) => e.dataset.value));
      assert.deepEqual(left, f.scenarios.filter((s) => s.kind !== 'opening').map((s) => String(s.fm)), `${f.code}: 캐릭터 플레이는 직접 입력·커스텀만`);
      const on = await page.getAttribute('.gx-sc.on', 'data-value');
      assert.ok(left.includes(on), `${f.code}: 고른 장면이 남은 것 중 하나 (${on})`);
      const direct = f.scenarios.find((s) => s.kind === 'direct');
      await page.evaluate((fm) => document.querySelector(`.gx-sc[data-value="${fm}"]`).click(), direct.fm);
      await page.fill('[data-input="start-note"]', '캐릭터 플레이 시작');
      await page.evaluate(() => document.querySelector('.gx-start').click());
      await waitStart(page, `${f.code} 캐릭터 플레이`);
      const saved = await page.evaluate(() => window.__calls.setChat[0]);
      assert.equal(saved.scriptstate.$st_player, who[1], `${f.code}: 주인공 저장`);
      assert.equal(saved.scriptstate.$st_fm, String(direct.fm));
      await page.waitForFunction(() => document.querySelector('.gx')?.style.display === 'none');
      await page.evaluate(() => { window.__calls.send = []; });
      starts++;
    } else {
      assert.equal(agents.length, 0, `${f.code}: 요원 명단이 없어 주인공 후보 없음`);
    }
  }

  // 재선택(staged): 첫 전송 전 다시 열면 이전 선택이 눌려 있고, 다른 장면으로 바꿔 출발하면 덮어쓴다
  await fresh();
  await page.evaluate(() => document.querySelector('.gx-fac[data-value="A00"]').click());
  await page.evaluate(() => document.querySelector('.gx-seg[data-value="ko"]').click());
  await page.evaluate(() => document.querySelector('.gx-sc[data-value="3"]').click());
  await page.evaluate(() => document.querySelector('.gx-start').click());
  await page.waitForFunction(() => window.__calls.setChat.length >= 1 && document.querySelector('.gx')?.style.display === 'none');
  await openWin(page);
  await page.waitForSelector('.gx-fac.on');
  assert.equal(await page.getAttribute('.gx-fac.on', 'data-value'), 'A00', '재선택: 세력 복원');
  assert.equal(await page.getAttribute('.gx-sc.on', 'data-value'), '3', '재선택: 장면 복원');
  assert.ok((await page.textContent('.gx-head small')).includes('다시 고를 수 있어요'));
  // 시작 전(staged) 설정 창: 「이 채팅」 없음, 테마를 바꾸면 이 채팅에도 적힌다
  await openEditor(page, 'set:screen');
  assert.equal(await page.$('.gw-set [data-action="set-scope"][data-value="chat"]'), null, '시작 전에는 「이 채팅」 범위 없음');
  assert.ok((await page.textContent('.gw-where')).includes('시작 전'));
  await page.evaluate(() => document.querySelector('.gw-set [data-action="set-theme"][data-value="light"]').click());
  await page.waitForFunction(() => window.__chat.scriptstate.$st_fixed_theme === 'light' && JSON.parse(window.__store['p:goei:prefs']).theme === 'light');
  assert.equal(await page.evaluate(() => document.querySelector('.gx').dataset.theme), 'light', '창 배색도 바로');
  await closeEditor(page);
  await page.evaluate(() => document.querySelector('.gx-fac[data-value="B00"]').click());
  await page.evaluate(() => document.querySelector('.gx-sc[data-value="2"]').click());
  await page.evaluate(() => document.querySelector('.gx-start').click());
  await page.waitForFunction(() => window.__calls.setChat.length >= 2);
  const again = await page.evaluate(() => window.__calls.setChat.at(-1));
  assert.equal(again.scriptstate.$st_faction, 'B00', '재선택 덮어쓰기');
  assert.equal(again.fmIndex, manifest.greetings['B00-ko-2']);
  assert.equal(again.scriptstate.$st_fixed_theme, 'light', '시작 전에 고른 테마가 채팅에');
  // 기본값 되돌리기 (다음 뷰포트에 영향 없게 새 페이지를 쓰지만 저장소도 비운다)
  await page.evaluate(() => { delete window.__store['p:goei:prefs']; });

  // 시작 뒤 설정 창: 범위 「이 채팅」 기본, 「새 채팅 기본값」 전환
  await closeWin(page);
  await setChat(page, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문' }], scriptstate: { ...again.scriptstate } });
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'set:board');
  assert.ok(await page.$('.gw-set [data-action="set-scope"][data-value="chat"].on'), '시작 뒤 기본 범위는 이 채팅');
  assert.ok((await page.textContent('.gw-where')).includes('현재 채팅'));
  await closeEditor(page);
  await closeWin(page);

  assert.deepEqual(errors, [], `${vp}: 페이지 오류`);
  console.log(`PASS 시작 화면 [${vp}]: ${starts}회 출발`);
  await page.close();
}

console.log(`PASS 시작 화면 전수 (${starts}회 출발, 뷰포트 ${vps.join('·')})`);
await browser.close();
