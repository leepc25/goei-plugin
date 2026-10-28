// QC 03 · 설정 창 「지침」·「점검」 탭: 기본 지침 7종 절 단위 편집·저장·되돌리기(합치면 원문과 같음), 이미지 지침 페이지,
// 추가 규칙(추가·대상·켬/끔·삭제·상한 100개·글자 상한), 점검(상태 점검·요청 기록·설정 내보내기 JSON·저장소 사용량·가져오기·지우기). 세 뷰포트.
// 사용법: node tests/qc-settings-guides-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditDom, boot, clickSel, closeEditor, goNode, launch, loadFixture, openEditor, openWin, prefsOf, setInput, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const browser = await launch();
const GUIDES = ['RP', 'Directive', 'Tag', 'GNet', 'Phone', 'Wiki', 'Visit'];
const settle = () => sleep(150);
// 기본 지침 원문 (플러그인에 내장된 것과 같은 파일)
const defaults = {
  GNet: readFileSync(new URL('../src/data/guides/gnet.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
  Phone: readFileSync(new URL('../src/data/guides/phone.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
  Wiki: readFileSync(new URL('../src/data/guides/wiki.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
  Directive: readFileSync(new URL('../src/data/guides/directive.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
  RP: readFileSync(new URL('../src/data/guides/rp.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
  Tag: readFileSync(new URL('../src/data/guides/tag.txt', import.meta.url), 'utf8').replace(/\r/g, ''),
};

for (const vp of vps) {
  const phone = vp !== 'pc';
  const { page, errors } = await boot(browser, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } }, vp);
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'guide:RP');

  // ── 기본 지침: 절마다 고치고 저장 → prefs.guides, 다른 절은 원문 그대로. 되돌리기 → 삭제 ──
  for (const g of GUIDES) {
    await goNode(page, `guide:${g}`);
    await page.waitForSelector(`.gw textarea[data-key="${g}|0"]`);
    const n = await page.locator('.gw .gw-guide-secs textarea').count();
    assert.ok(n >= 1, `${g}: 절 ${n}`);
    assert.ok((await page.textContent('.gw .gw-head h2')).includes(`${n}절`), `${g}: 머리에 절 수`);
    assert.equal(await page.isDisabled(`.gw [data-action="ed-guide-save"][data-value="${g}"]`), true, `${g}: 고치기 전엔 저장 잠김`);
    const a = await auditDom(page, '.gw');
    assert.deepEqual(a.missing, [], `${g} ${vp}: 이름 없는 단추`);
    if (phone) assert.deepEqual(a.overflow, [], `${g} ${vp}: 가로 넘침`);
    // 마지막 절을 고친다
    const i = n - 1;
    const body = await page.$eval(`.gw textarea[data-key="${g}|${i}"]`, (e) => e.value);
    await setInput(page, `.gw textarea[data-key="${g}|${i}"]`, `${body}\nQC ${g} 추가 줄`, 'input');
    await page.waitForFunction((g) => !document.querySelector(`.gw [data-action="ed-guide-save"][data-value="${g}"]`)?.disabled, g);
    await clickSel(page, `.gw [data-action="ed-guide-save"][data-value="${g}"]`);
    await page.waitForFunction((g) => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').guides?.[g], g);
    const saved = (await prefsOf(page)).guides[g];
    assert.ok(saved.includes(`QC ${g} 추가 줄`), `${g}: 저장된 글에 고친 줄`);
    if (defaults[g]) {
      // 고친 절 말고는 원문과 같다: 저장 글에서 추가 줄을 빼면 원문
      assert.equal(saved.replace(`\nQC ${g} 추가 줄`, ''), defaults[g], `${g}: 절을 합치면 원문 그대로`);
    }
    assert.ok((await page.textContent('.gw .gw-head h2')).includes('고침'), `${g}: 머리에 고침`);
    assert.ok((await page.textContent('.gw .gw-head')).includes('저장했어요'), `${g}: 저장 안내`);
    // 다른 노드에 갔다 와도 같은 글
    await goNode(page, 'rule:new');
    await goNode(page, `guide:${g}`);
    assert.ok((await page.$eval(`.gw textarea[data-key="${g}|${i}"]`, (e) => e.value)).includes(`QC ${g} 추가 줄`), `${g}: 다시 열어도 고친 글`);
    // 기본으로
    await clickSel(page, `.gw [data-action="ed-guide-reset"][data-value="${g}"]`);
    await page.waitForFunction((g) => !JSON.parse(window.__store['p:goei:prefs'] ?? '{}').guides?.[g], g);
    assert.equal(await page.$eval(`.gw textarea[data-key="${g}|${i}"]`, (e) => e.value), body, `${g}: 기본으로`);
    // 기본 글과 같게 고쳐서 저장하면 기본으로 저장
    await setInput(page, `.gw textarea[data-key="${g}|${i}"]`, `${body}x`, 'input');
    await setInput(page, `.gw textarea[data-key="${g}|${i}"]`, body, 'input');
    await page.waitForFunction((g) => !document.querySelector(`.gw [data-action="ed-guide-save"][data-value="${g}"]`)?.disabled || true, g);
    if (!(await page.isDisabled(`.gw [data-action="ed-guide-save"][data-value="${g}"]`))) {
      await clickSel(page, `.gw [data-action="ed-guide-save"][data-value="${g}"]`);
      await settle();
      assert.equal((await prefsOf(page)).guides?.[g], undefined, `${g}: 기본 글과 같으면 저장 안 함`);
    }
  }
  // 저장 상한 120,000자: 넘기면 저장하지 않고 안내
  await goNode(page, 'guide:RP');
  const big = 'x'.repeat(121000);
  await setInput(page, '.gw textarea[data-key="RP|0"]', big, 'input');
  await page.waitForFunction(() => !document.querySelector('.gw [data-action="ed-guide-save"][data-value="RP"]')?.disabled);
  await clickSel(page, '.gw [data-action="ed-guide-save"][data-value="RP"]');
  await settle();
  assert.equal((await prefsOf(page)).guides?.RP, undefined, '120,000자 넘는 지침은 저장 안 함');
  assert.ok((await page.textContent('.gw .gw-head')).includes('120,000자까지'), '상한 안내');
  await clickSel(page, '.gw [data-action="ed-guide-reset"][data-value="RP"]');
  await settle();

  // ── 이미지 지침 페이지 (guide:Image): 틀 저장·기본값·미리보기·대상 체크·임의 추가·표정 세트 ──
  await goNode(page, 'guide:Image');
  await page.waitForSelector('.gw .ip-pane');
  await setInput(page, '.gw [name="ip-template"]', '내 틀 {characters} {keywords}', 'input');
  await clickSel(page, '.gw [data-action="ip-template-save"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgPrompt === '내 틀 {characters} {keywords}');
  await clickSel(page, '.gw [data-action="ip-preview"]');
  await page.waitForSelector('.gw .ip-preview');
  assert.ok((await page.textContent('.gw .ip-preview')).startsWith('내 틀 '), '미리보기에 내 틀');
  await clickSel(page, '.gw [data-action="ip-template-reset"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgPrompt === undefined);
  const firstName = await page.$eval('.gw .ip-names input[type="checkbox"]', (e) => e.dataset.key);
  await page.evaluate(() => { const c = document.querySelector('.gw .ip-names input[type="checkbox"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((n) => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesOff ?? []).includes(n), firstName);
  assert.ok(await page.$(`.gw .ip-name.off`), '끈 이름 표시');
  await page.evaluate(() => { const c = document.querySelector('.gw .ip-names input[type="checkbox"]'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction((n) => !(JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesOff ?? []).includes(n), firstName);
  await clickSel(page, '.gw [data-action="ip-extra-add"]');
  await settle();
  assert.ok((await page.textContent('.gw .ip-pane')).includes('영문명을 적어 주세요'), '빈 이름 → 안내');
  await setInput(page, '.gw [name="ip-extra"]', 'Qc<Name>_x', 'input');
  await clickSel(page, '.gw [data-action="ip-extra-add"]');
  await page.waitForFunction(() => (JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesExtra ?? []).includes('QcNamex'));
  await clickSel(page, '.gw [data-action="ip-extra-del"][data-value="QcNamex"]');
  await page.waitForFunction(() => !(JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgNamesExtra ?? []).length);
  await setInput(page, '.gw [name="ip-keywords"]', 'Smile, ANGRY,, sad', 'input');
  await clickSel(page, '.gw [data-action="ip-keywords-save"]');
  await page.waitForFunction(() => JSON.stringify(JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgKeywords) === '["smile","angry","sad"]');
  await clickSel(page, '.gw [data-action="ip-keywords-reset"]');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').imgKeywords === undefined);

  // ── 추가 규칙 ──
  await goNode(page, 'rule:new');
  await page.waitForSelector('.gw [data-action="ed-rule-new"]');
  assert.ok((await page.textContent('.gw .gw-head-act')).includes('0/100'), '규칙 수/상한');
  await clickSel(page, '.gw [data-action="ed-rule-new"]');
  await page.waitForSelector('.gw textarea[data-input="ed-rule-text"]');
  const ruleId = await page.$eval('.gw textarea[data-input="ed-rule-text"]', (e) => e.dataset.key);
  assert.ok(await page.$(`.gw .gw-tree-item[data-value="rule:${ruleId}"]`), '새 규칙이 목록에');
  await setInput(page, '.gw input[data-input="ed-rule-title"]', '대사 길이', 'input');
  await setInput(page, '.gw textarea[data-input="ed-rule-text"]', 'Three sentences max.', 'input');
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').rules?.[0]?.text === 'Three sentences max.', null, { timeout: 5000 });
  assert.equal((await prefsOf(page)).rules[0].title, '대사 길이');
  assert.deepEqual((await prefsOf(page)).rules[0].to, ['RP'], '기본 대상 본편');
  // 대상 칩: 괴담넷 추가, 본편 빼기
  await clickSel(page, `.gw [data-action="ed-rule-to"][data-value="${ruleId}|GNet"]`);
  await page.waitForFunction(() => JSON.stringify(JSON.parse(window.__store['p:goei:prefs'] ?? '{}').rules?.[0]?.to) === '["RP","GNet"]');
  await clickSel(page, `.gw [data-action="ed-rule-to"][data-value="${ruleId}|RP"]`);
  await page.waitForFunction(() => JSON.stringify(JSON.parse(window.__store['p:goei:prefs'] ?? '{}').rules?.[0]?.to) === '["GNet"]');
  assert.ok((await page.textContent('.gw .gw-head')).includes('괴담넷 지침 끝에'), '대상 안내');
  // 켬/끔
  await clickSel(page, `.gw [data-action="ed-rule-on"][role="switch"]`);
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').rules?.[0]?.on === false);
  assert.ok((await page.textContent(`.gw .gw-tree-item[data-value="rule:${ruleId}"]`)).includes('끔'), '목록 배지 끔');
  await clickSel(page, `.gw [data-action="ed-rule-on"][role="switch"]`);
  await page.waitForFunction(() => JSON.parse(window.__store['p:goei:prefs'] ?? '{}').rules?.[0]?.on === true);
  // 글자 상한: 제목 80·본문 20,000 (maxlength)
  assert.equal(await page.$eval('.gw input[data-input="ed-rule-title"]', (e) => e.maxLength), 80);
  assert.equal(await page.$eval('.gw textarea[data-input="ed-rule-text"]', (e) => e.maxLength), 20000);
  // 둘째 규칙 → 목록 순서 = 만든 순서, 첫 규칙 삭제(확인) → 둘째가 열림
  await goNode(page, 'rule:new');
  await clickSel(page, '.gw [data-action="ed-rule-new"]');
  await page.waitForSelector('.gw textarea[data-input="ed-rule-text"]');
  const rule2 = await page.$eval('.gw textarea[data-input="ed-rule-text"]', (e) => e.dataset.key);
  assert.deepEqual(await page.$$eval('.gw .gw-tree-item[data-value^="rule:r"]', (els) => els.map((e) => e.dataset.value)), [`rule:${ruleId}`, `rule:${rule2}`], '목록 순서 = 만든 순서');
  await goNode(page, `rule:${ruleId}`);
  await clickSel(page, `.gw [data-action="ed-rule-del"]`);
  await page.waitForSelector('.gw [data-action="ed-rule-del-yes"]');
  await clickSel(page, '.gw [data-action="ed-rule-del-no"]');
  assert.ok(await page.$('.gw [data-action="ed-rule-del"]'), '취소');
  await clickSel(page, `.gw [data-action="ed-rule-del"]`);
  await clickSel(page, '.gw [data-action="ed-rule-del-yes"]');
  await page.waitForFunction((r2) => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === `rule:${r2}`, rule2);
  assert.equal((await prefsOf(page)).rules.length, 1);
  await clickSel(page, `.gw [data-action="ed-rule-del"]`);
  await clickSel(page, '.gw [data-action="ed-rule-del-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-tree-item.on')?.dataset.value === 'guide:RP');
  assert.equal((await prefsOf(page)).rules, undefined, '다 지우면 rules 없음');
  // 상한 100개: 99개를 저장소에 바로 넣고 창을 다시 열어 하나 더 → 100, 그다음은 안내
  await closeEditor(page, true);
  await page.evaluate(() => {
    const p = JSON.parse(window.__store['p:goei:prefs'] ?? '{}');
    p.rules = Array.from({ length: 99 }, (_, i) => ({ id: `r${i}`, title: `규칙 ${i}`, text: 'x', to: ['RP'], on: true }));
    window.__store['p:goei:prefs'] = JSON.stringify(p);
  });
  // 저장소를 직접 바꿨으니 플러그인이 다시 읽게 창을 닫았다 연다 (openApp 은 prefs 를 다시 읽지 않으므로 setItem 경로로 올린다)
  await page.evaluate(() => window.__button.cb());
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'manage:backup');
  await page.waitForSelector('.gw textarea[data-input="man-import-text"]');
  assert.equal(await page.isDisabled('.gw [data-action="man-import"]'), true, '빈 글칸이면 적용 잠김');
  await setInput(page, '.gw textarea[data-input="man-import-text"]', await page.evaluate(() => window.__store['p:goei:prefs']), 'input');
  // 회귀: 붙여 넣으면 다시 그리지 않아도 「적용」이 풀린다
  assert.equal(await page.isDisabled('.gw [data-action="man-import"]'), false, '글을 넣으면 적용 풀림');
  await clickSel(page, '.gw [data-action="man-import"]');
  await page.waitForSelector('.gw [data-action="man-import-yes"]');
  await clickSel(page, '.gw [data-action="man-import-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-head')?.textContent?.includes('가져왔어요'));
  await goNode(page, 'rule:new');
  assert.ok((await page.textContent('.gw .gw-head-act')).includes('99/100'));
  await clickSel(page, '.gw [data-action="ed-rule-new"]');
  await page.waitForSelector('.gw textarea[data-input="ed-rule-text"]');
  assert.equal((await prefsOf(page)).rules.length, 100);
  await goNode(page, 'rule:new');
  assert.equal(await page.isDisabled('.gw [data-action="ed-rule-new"]'), true, '100개면 새 규칙 잠김');
  // 저장소를 비워 되돌린다
  await page.evaluate(() => { delete window.__store['p:goei:prefs']; });
  await goNode(page, 'manage:backup');
  await setInput(page, '.gw textarea[data-input="man-import-text"]', '{}', 'input');
  await clickSel(page, '.gw [data-action="man-import"]');
  await page.waitForSelector('.gw [data-action="man-import-yes"]');
  await clickSel(page, '.gw [data-action="man-import-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-head')?.textContent?.includes('가져왔어요'));
  assert.deepEqual(await prefsOf(page), { basic: {}, world: {} }, '빈 설정 가져오기');

  // ── 점검 탭 ──
  await goNode(page, 'manage:diag');
  await page.waitForSelector('.gw .gw-setbody .ps-row');
  const diag = await page.textContent('.gw .gw-setbody');
  assert.ok(diag.includes('괴이 카드') && diag.includes('진행 중') && diag.includes('메시지 2개'), `상태 점검 내용: ${diag.slice(0, 200)}`);
  assert.ok(/플러그인[^·]{0,120}v\d+\.\d+\.\d+/.test(diag.replace(/\s+/g, ' ')), '플러그인 버전 (줄 이름 · 설명 · 배지 순)');
  await goNode(page, 'manage:log');
  await page.waitForSelector('.gw .gw-setbody');
  assert.ok((await page.textContent('.gw .gw-setbody')).includes('실패한 요청이 없어요'));
  await page.waitForFunction(() => !document.querySelector('.gw .gw-setbody')?.textContent?.includes('읽는 중'));
  assert.ok((await page.textContent('.gw .gw-setbody')).includes('아직 갱신 기록이 없어요'));
  // 설정 내보내기: JSON = prefs, 저장소 사용량 = 실제 글자 수
  await goNode(page, 'set:screen');
  await clickSel(page, '.gw [data-action="set-nav"][data-value="right"]');
  await settle();
  await goNode(page, 'manage:backup');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-setbody')?.textContent?.includes('…'));
  const exported = await page.$eval('.gw textarea[data-man-export]', (e) => e.value);
  assert.deepEqual(JSON.parse(exported), await prefsOf(page), '내보내기 JSON = 저장된 기기 설정');
  const sizeTxt = await page.evaluate(() => [...document.querySelectorAll('.gw .ps-row')].find((r) => r.querySelector('.gw-tokens') && r.textContent.includes('기기 설정'))?.querySelector('.gw-tokens')?.textContent);
  const rawLen = await page.evaluate(() => window.__store['p:goei:prefs'].length);
  assert.equal(sizeTxt, rawLen >= 1000 ? `${Math.round(rawLen / 1000)}KB` : `${rawLen}B`, `저장소 사용량 ${sizeTxt} (실제 ${rawLen})`);
  // 위키 기본 문서·토크나이저는 없음 → 「없음」, 지우기 단추 없음
  const rows = await page.$$eval('.gw .ps-row', (els) => els.map((r) => r.textContent.replace(/\s+/g, ' ')));
  assert.ok(rows.some((r) => r.includes('위키 기본 문서') && r.includes('없음')), '위키 문서 없음 표시');
  // 가져오기: 잘못된 JSON → 오류, 배열 → 오류, 올바른 것 → 적용 (nav 사라짐)
  await setInput(page, '.gw textarea[data-input="man-import-text"]', '{broken', 'input');
  await clickSel(page, '.gw [data-action="man-import"]');
  await page.waitForSelector('.gw [data-action="man-import-yes"]');
  await clickSel(page, '.gw [data-action="man-import-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gx-err')?.textContent?.includes('가져오지 못했어요'));
  await setInput(page, '.gw textarea[data-input="man-import-text"]', '[1,2]', 'input');
  await clickSel(page, '.gw [data-action="man-import"]');
  await page.waitForSelector('.gw [data-action="man-import-yes"]');
  await clickSel(page, '.gw [data-action="man-import-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gx-err')?.textContent?.includes('설정 JSON 이 아니에요'));
  await setInput(page, '.gw textarea[data-input="man-import-text"]', '{"dim": 25, "nav": "bogus", "editorWidth": 30}', 'input');
  await clickSel(page, '.gw [data-action="man-import"]');
  await page.waitForSelector('.gw [data-action="man-import-yes"]');
  await clickSel(page, '.gw [data-action="man-import-yes"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-head')?.textContent?.includes('가져왔어요'));
  assert.deepEqual(await prefsOf(page), { basic: {}, world: {}, dim: 25 }, '틀린 값은 버리고 맞는 값만');
  // 복사 (헤드리스에선 클립보드가 막혀 글을 골라 둔다) · 내려받기
  await clickSel(page, '.gw [data-action="man-copy"]');
  await settle();
  assert.ok(/복사했어요|Ctrl\+C/.test(await page.textContent('.gw .gw-head')), '복사 안내');
  await clickSel(page, '.gw [data-action="man-download"]');
  await settle();
  assert.ok((await page.textContent('.gw .gw-head')).includes('내려받기'), '내려받기 안내');
  // 설치 페이지: 점검표
  await goNode(page, 'install');
  await page.waitForSelector('.gw .gw-inst-list');
  const a = await auditDom(page, '.gw');
  assert.deepEqual(a.missing, [], `install ${vp}: 이름 없는 단추`);
  if (phone) assert.deepEqual(a.overflow, [], `install ${vp}: 가로 넘침`);
  for (const n of ['manage:diag', 'manage:log', 'manage:backup', 'rule:new']) {
    await goNode(page, n);
    const a2 = await auditDom(page, '.gw');
    assert.deepEqual(a2.missing, [], `${n} ${vp}: 이름 없는 단추`);
    if (phone) assert.deepEqual(a2.overflow, [], `${n} ${vp}: 가로 넘침`);
  }
  await closeEditor(page, true);
  assert.deepEqual(errors, [], `${vp}: 오류`);
  console.log(`PASS 지침·점검 탭 [${vp}]`);
  await page.close();
}
await browser.close();
