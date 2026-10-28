// QC 03 · 설정 창 「세계」 탭 전수: 기록 종류 전부(요원·조직·괴이·파밍·부록)에서 목록·검색·고르기·추가·수정·삭제·되돌리기·저장,
// 저장 뒤 카드 명부(setCharacterToIndex) 반영, 미저장 닫기 확인창, 기본 정보, 세력 관계(대칭 on/off·메모·공통 규칙·포함 스위치), 거점.
// 세 뷰포트 (폰은 목록 대신 드롭다운).
// 사용법: node tests/qc-settings-world-browser.mjs <fixture.json> [pc|phone|land|all]
import assert from 'node:assert/strict';
import { auditDom, boot, closeEditor, clickSel, goNode, launch, loadFixture, openEditor, openWin, setInput, sleep, VIEWPORTS } from './qc-settings-harness.mjs';

const fx = loadFixture(process.argv[2]);
const which = process.argv[3] ?? 'all';
const vps = which === 'all' ? Object.keys(VIEWPORTS) : [which];
const browser = await launch();

const KINDS = ['agent', 'org', 'anomaly', 'site', 'appendix'];
const PICK = { agent: '쟈알디', org: '극단', anomaly: '소라 랜드', site: '달빛 타투샵', appendix: null };
const dirOf = (page) => page.evaluate(() => JSON.parse(window.__char.globalLore.find((e) => e.comment === 'Directory').content));
const dirty = (page) => page.evaluate(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty') ?? false);
const settle = () => sleep(120);

for (const vp of vps) {
  const phone = vp !== 'pc';
  const { page, errors } = await boot(browser, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2' } }, vp);
  await openWin(page);
  await page.waitForSelector('.gx-tabhead');
  await openEditor(page, 'agent');
  const counts = {};
  const log = [];
  for (const kind of KINDS) {
    await goNode(page, kind);
    await page.waitForSelector('.gw .gw-list-pane');
    // 목록 수 = 왼쪽 메뉴 개수 배지
    const n = await page.locator('.gw .gw-list .gw-row').count();
    const badge = Number(await page.textContent(`.gw .gw-tree-item[data-value="${kind}"] em`));
    assert.equal(n, badge, `${kind}: 목록 ${n} = 배지 ${badge}`);
    counts[kind] = n;
    // 폰: 목록·검색은 숨고 드롭다운 하나
    const listVisible = await page.evaluate(() => { const l = document.querySelector('.gw .gw-list'); return !!l && getComputedStyle(l).display !== 'none'; });
    const pickVisible = await page.evaluate(() => { const l = document.querySelector('.gw .gw-list-pick'); return !!l && getComputedStyle(l).display !== 'none'; });
    assert.equal(listVisible, !phone, `${kind} ${vp}: 목록 ${phone ? '숨김' : '보임'}`);
    assert.equal(pickVisible, phone, `${kind} ${vp}: 드롭다운 ${phone ? '보임' : '숨김'}`);
    const opts = await page.locator('.gw .gw-list-pick option').count();
    assert.equal(opts, n, `${kind}: 드롭다운 항목 수`);
    const a = await auditDom(page, '.gw');
    assert.deepEqual(a.missing, [], `${kind} ${vp}: 이름 없는 단추`);
    if (phone) assert.deepEqual(a.overflow, [], `${kind} ${vp}: 가로 넘침`);
    const pick = PICK[kind] ?? (await page.$eval('.gw .gw-list .gw-row b', (e) => e.textContent));
    // 검색
    if (!phone) {
      await setInput(page, '.gw [data-input="ed-q"]', pick.slice(0, 2), 'input');
      await settle();
      const hits = await page.$$eval('.gw .gw-list .gw-row b', (els) => els.map((e) => e.textContent));
      assert.ok(hits.includes(pick) && hits.length < n, `${kind}: 검색 「${pick.slice(0, 2)}」 → ${hits.length}개`);
      await setInput(page, '.gw [data-input="ed-q"]', '없는이름zz', 'input');
      await settle();
      assert.ok((await page.textContent('.gw .gw-list')).includes('맞는 기록이 없어요'));
      await setInput(page, '.gw [data-input="ed-q"]', '', 'input');
      await settle();
      // 고르기 (목록)
      await page.evaluate((name) => [...document.querySelectorAll('.gw .gw-row')].find((b) => b.dataset.value === name).click(), pick);
    } else {
      // 고르기 (드롭다운)
      await page.evaluate((name) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }, pick);
    }
    await page.waitForFunction((name) => document.querySelector('.gw .gw-detail h2')?.textContent?.includes(name), pick);
    assert.ok(await page.$('.gw .gw-basic .dir-panel'), `${kind}: 기본 정보`);
    assert.ok((await page.locator('.gw .gw-fields .gw-field').count()) >= 1, `${kind}: 로어 칸`);
    // 수정 → 고침 배지 → 저장 → 카드 명부 반영
    const firstKey = await page.$eval('.gw .gw-fields [data-input="ed-field"]', (e) => e.dataset.key);
    const fid = firstKey.split('|')[2];
    const sel = `.gw [data-input="ed-field"][data-key="${firstKey.replace(/"/g, '\\"')}"]`;
    await setInput(page, sel, `qc ${kind} 글`, 'input');
    await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.ok((await page.textContent('.gw .gw-save-state')).includes('고친 것 있음'));
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty') && document.querySelector('.gw .gw-save-state')?.textContent?.includes('저장됨'));
    const dir = await dirOf(page);
    assert.equal(dir.세계?.[kind]?.[pick]?.fields?.[fid], `qc ${kind} 글`, `${kind}: 카드 명부 세계.${kind}.${pick}.${fid}`);
    assert.ok((await page.textContent(`.gw .gw-row[data-value="${pick}"]`)).includes('고침') || phone, `${kind}: 고침 배지`);
    // 기본으로 (ed-restore): 덧쓰기 지움 → 저장
    await clickSel(page, '.gw [data-action="ed-restore"]');
    await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.equal((await dirOf(page)).세계?.[kind]?.[pick], undefined, `${kind}: 기본으로 → 덧쓰기 없음`);
    // 지우기 (기본 세계 기록) → 지움 배지 → 되살리기
    await clickSel(page, '.gw [data-action="ed-delete"]');
    await page.waitForSelector('.gw [data-action="ed-restore"]');
    assert.ok((await page.textContent('.gw .gw-detail')).includes('지웠어요'), `${kind}: 지움 안내`);
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.equal((await dirOf(page)).세계?.[kind]?.[pick]?.deleted, true, `${kind}: 지움이 카드에`);
    assert.equal(Number(await page.textContent(`.gw .gw-tree-item[data-value="${kind}"] em`)), n - 1, `${kind}: 배지 하나 줄어듦`);
    await clickSel(page, '.gw [data-action="ed-restore"]');
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.equal((await dirOf(page)).세계?.[kind]?.[pick], undefined, `${kind}: 되살림`);
    // 추가: 빈 이름 → 아무것도 안 됨, 같은 이름 → 알림, 새 이름 → 추가 배지 · 삭제하면 목록에서 사라짐
    await clickSel(page, '.gw [data-action="ed-add-toggle"]');
    await page.waitForSelector('.gw .gw-add [name="ed-new-name"]');
    await setInput(page, '.gw [name="ed-new-name"]', pick, 'input');
    await clickSel(page, '.gw [data-action="ed-add"]');
    await page.waitForFunction(() => document.querySelector('.gw .gw-notice.err')?.textContent?.includes('같은 이름'));
    await setInput(page, '.gw [name="ed-new-name"]', `새 ${kind}`, 'input');
    await clickSel(page, '.gw [data-action="ed-add"]');
    await page.waitForFunction((k) => document.querySelector('.gw .gw-detail h2')?.textContent?.includes(`새 ${k}`), kind);
    assert.ok((await page.textContent('.gw .gw-detail h2')).includes('카드에만 있음'));
    assert.equal(Number(await page.textContent(`.gw .gw-tree-item[data-value="${kind}"] em`)), n + 1);
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.ok((await dirOf(page)).세계?.[kind]?.[`새 ${kind}`], `${kind}: 새 기록 저장`);
    // 저장 뒤 명부 줄이 생겼는지 (요원·괴이·파밍·조직·부록 모두 명부 줄은 세계 기록과 별개 — 「명부 줄이 없어요」 안내만 없으면 된다)
    await clickSel(page, '.gw [data-action="ed-delete"]');
    await page.waitForFunction((k) => !document.querySelector('.gw .gw-detail h2')?.textContent?.includes(`새 ${k}`), kind);
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.equal((await dirOf(page)).세계?.[kind]?.[`새 ${kind}`], undefined, `${kind}: 삭제 저장`);
    // 저장하면 가상 로어북(세력 폴더 등)에서 명부 줄이 생기는 종류(조직)는 기록을 지워도 명부 줄이 남는다 (설계: 명부 줄과 세계 기록은 별개).
    // 그 줄은 「로어 칸 없음」으로 보이고 기본 정보의 지우기로 뺀다
    const after = Number(await page.textContent(`.gw .gw-tree-item[data-value="${kind}"] em`));
    if (after === n + 1) {
      await page.evaluate((name) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }, `새 ${kind}`);
      await page.waitForFunction((k) => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('명부에만 있음'), kind);
      const del = kind === 'org' ? `.gw [data-action="dir-org-del"][data-value="새 ${kind}"]` : `.gw [data-action="dir-ext-del"][data-value="새 ${kind}"]`;
      assert.ok(await page.$(del), `${kind}: 남은 명부 줄을 지울 단추`);
      await clickSel(page, del);
      await settle();
      await clickSel(page, '.gw [data-action="ed-save"]');
      await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
      log.push(`${kind}: 기록을 지워도 명부 줄이 남아 기본 정보에서 따로 지움`);
    }
    assert.equal(Number(await page.textContent(`.gw .gw-tree-item[data-value="${kind}"] em`)), n, `${kind}: 지운 뒤 개수`);
    // 되돌리기: 고친 뒤 ed-revert → 확인 → 되돌림
    await page.evaluate((name) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }, pick);
    await page.waitForFunction((name) => document.querySelector('.gw .gw-detail h2')?.textContent?.includes(name), pick);
    await setInput(page, sel, 'revert me', 'input');
    await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    await clickSel(page, '.gw [data-action="ed-revert"]');
    await page.waitForSelector('.gw [data-action="ed-revert-force"]');
    await clickSel(page, '.gw [data-action="ed-confirm-no"]');
    assert.equal(await dirty(page), true, `${kind}: 취소하면 고친 것 그대로`);
    await clickSel(page, '.gw [data-action="ed-revert"]');
    await clickSel(page, '.gw [data-action="ed-revert-force"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
    assert.notEqual(await page.$eval(sel, (e) => e.value), 'revert me', `${kind}: 되돌림`);
  }
  // 미저장 닫기: 확인창 → 취소 → 열린 채 / 저장 안 하고 닫기 → 닫히고 초안 버림
  await goNode(page, 'agent');
  await page.evaluate((name) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }, '쟈알디');
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('쟈알디'));
  await setInput(page, '.gw [data-input="ed-field"][data-key="agent|쟈알디|voice"]', '닫기 시험', 'input');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  await clickSel(page, '.gw .gw-top [data-action="ed-close"]');
  await page.waitForSelector('.gw [data-action="ed-close-force"]');
  await clickSel(page, '.gw [data-action="ed-confirm-no"]');
  assert.equal(await page.evaluate(() => document.querySelector('.gw').hidden), false, '취소 → 열린 채');
  // Esc 도 닫기 (확인창이 없을 때만)
  await page.keyboard.press('Escape');
  await page.waitForSelector('.gw [data-action="ed-close-force"]');
  await clickSel(page, '.gw [data-action="ed-close-force"]');
  await page.waitForFunction(() => document.querySelector('.gw').hidden === true);
  await openEditor(page, 'agent');
  await page.evaluate((name) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = name; s.dispatchEvent(new Event('change', { bubbles: true })); }, '쟈알디');
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('쟈알디'));
  assert.notEqual(await page.$eval('.gw [data-input="ed-field"][data-key="agent|쟈알디|voice"]', (e) => e.value), '닫기 시험', '저장 안 하고 닫으면 초안 버림');
  assert.equal(await dirty(page), false);

  // 요원 기본 정보: Roster 포함 스위치 · 소속 칩 · 성별 칩 → 저장 → 명부
  await clickSel(page, '.gw [data-action="ed-roster-toggle"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  await clickSel(page, '.gw [data-action="dir-gender"][data-value="M|쟈알디"]');
  await settle();
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  {
    const d = await dirOf(page);
    assert.equal(d.세계.agent['쟈알디'].rosterOff, true, 'Roster 제외 저장');
    assert.equal(d.요원['쟈알디'].gender, 'M', '성별 저장');
    await clickSel(page, '.gw [data-action="ed-roster-toggle"]');
    await clickSel(page, '.gw [data-action="dir-gender"][data-value="F|쟈알디"]');
    await settle();
    await clickSel(page, '.gw [data-action="ed-save"]');
    await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  }
  // 추가 칸·순서·글로 가져오기·조립 글 보기
  await setInput(page, '.gw [name="ed-extra-name"]', '취미', 'input');
  await clickSel(page, '.gw [data-action="ed-extra-add"]');
  await page.waitForSelector('.gw .gw-field.extra');
  await setInput(page, '.gw [name="ed-extra-name"]', '취미', 'input');
  await clickSel(page, '.gw [data-action="ed-extra-add"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-notice.err')?.textContent?.includes('같은 이름의 칸'));
  const orderBefore = await page.$$eval('.gw .gw-fields [data-field-row]', (els) => els.map((e) => e.dataset.fieldRow));
  await clickSel(page, '.gw .gw-field.extra [data-action="ed-field-up"]');
  await settle();
  const orderAfter = await page.$$eval('.gw .gw-fields [data-field-row]', (els) => els.map((e) => e.dataset.fieldRow));
  assert.equal(orderAfter.indexOf('x:취미'), orderBefore.indexOf('x:취미') - 1, '위로');
  await clickSel(page, '.gw [data-action="ed-order-reset"]');
  await settle();
  assert.deepEqual(await page.$$eval('.gw .gw-fields [data-field-row]', (els) => els.map((e) => e.dataset.fieldRow)), orderBefore, '기본 순서로');
  await clickSel(page, '.gw .gw-field.extra [data-action="ed-extra-del"]');
  await settle();
  assert.equal(await page.$('.gw .gw-field.extra'), null, '칸 지우기');
  await clickSel(page, '.gw [data-action="ed-preview"]');
  await page.waitForSelector('.gw .gw-preview');
  assert.ok((await page.textContent('.gw .gw-preview')).includes('Jyaldi'), '조립 글');
  await clickSel(page, '.gw [data-action="ed-preview"]');
  // 추가 칸을 넣었다 뺐고 순서도 기본으로 돌려서 고친 것이 없다 (덧쓰기가 기본과 같으면 저절로 지워진다)
  assert.equal(await dirty(page), false, '기본과 같아지면 고친 것 없음');

  // 조직: 세력별 다른 글 (코드 검사) · 세력 관계도 포함 스위치
  await goNode(page, 'org');
  await page.evaluate(() => { const s = document.querySelector('.gw .gw-list-pick'); s.value = '극단'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('극단'));
  await setInput(page, '.gw [name="ed-variant-new"]', 'zzz', 'input');
  await clickSel(page, '.gw [data-action="ed-variant-add"]');
  await page.waitForFunction(() => document.querySelector('.gw .gw-notice.err')?.textContent?.includes('A00 꼴'));
  await setInput(page, '.gw [name="ed-variant-new"]', 'b00', 'input');
  await clickSel(page, '.gw [data-action="ed-variant-add"]');
  await page.waitForSelector('.gw [data-action="ed-variant"][data-value="B00"].on');
  await setInput(page, '.gw [data-input="ed-field"][data-key="org|극단|intro"]', 'B00 시점 소개', 'input');
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  assert.equal((await dirOf(page)).세계.org['극단'].variants.B00.intro, 'B00 시점 소개', '세력별 글 저장');
  await clickSel(page, '.gw [data-action="ed-restore"]');
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));

  // 세력 관계: 대칭 ON → 반대 방향도, OFF → 한쪽만, 메모, 공통 규칙, 포함 스위치
  await goNode(page, 'relations');
  await page.waitForSelector('.gw .gw-rel-rows');
  const pickOrg = async (name) => {
    if (phone) await page.evaluate((n) => { const s = document.querySelector('.gw .gw-list-pick'); s.value = n; s.dispatchEvent(new Event('change', { bubbles: true })); }, name);
    else await clickSel(page, `.gw [data-action="ed-rel-pick"][data-value="${name}"]`);
    await page.waitForFunction((n) => document.querySelector('.gw .gw-head h2')?.textContent?.startsWith(n), name);
  };
  const stageOf = (a, b) => page.evaluate(([a, b]) => [...document.querySelectorAll(`.gw [data-action="ed-rel-set"][data-value^="${a}>${b}:"]`)].find((x) => x.classList.contains('on'))?.dataset.value.split(':')[1], [a, b]);
  await pickOrg('극단');
  assert.ok(await page.$('.gw [data-action="ed-rel-sym"].on'), '대칭 기본 켬');
  await clickSel(page, '.gw [data-action="ed-rel-set"][data-value="극단>병원:friendly"]');
  await settle();
  assert.equal(await stageOf('극단', '병원'), 'friendly');
  await pickOrg('병원');
  assert.equal(await stageOf('병원', '극단'), 'friendly', '대칭: 반대 방향도');
  await clickSel(page, '.gw [data-action="ed-rel-sym"]');
  await settle();
  assert.equal(await page.$('.gw [data-action="ed-rel-sym"].on'), null, '대칭 끔');
  await clickSel(page, '.gw [data-action="ed-rel-set"][data-value="병원>극단:wary"]');
  await settle();
  await pickOrg('극단');
  assert.equal(await stageOf('극단', '병원'), 'friendly', '대칭 OFF: 한쪽만');
  await clickSel(page, '.gw [data-action="ed-rel-sym"]');
  await settle();
  await setInput(page, '.gw [data-input="ed-rel-memo"][data-key="극단>병원"]', '메모 글', 'input');
  await setInput(page, '.gw [data-input="ed-rules"]', '공통 규칙 글', 'input');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  {
    const d = await dirOf(page);
    assert.equal(d.세계.relations.pairs['극단>병원'].stage, 'friendly');
    assert.equal(d.세계.relations.pairs['극단>병원'].memo, '메모 글');
    assert.equal(d.세계.relations.pairs['병원>극단'].stage, 'wary');
    assert.equal(d.세계.relations.common, '공통 규칙 글');
  }
  await clickSel(page, '.gw [data-action="ed-rules-reset"]');
  await settle();
  assert.equal(await page.isDisabled('.gw [data-action="ed-rules-reset"]'), true, '공통 규칙 기본으로 → 단추 잠김');
  // 포함 스위치: 끄면 단계 줄이 사라지고 목록에 제외 배지
  await clickSel(page, '.gw [data-action="ed-rel-org"]');
  await settle();
  assert.equal(await page.$('.gw .gw-rel-rows'), null, '제외 → 단계 줄 없음');
  assert.ok((await page.textContent('.gw .gw-list-pick')).includes('극단 (제외)'), '드롭다운에 제외');
  await clickSel(page, '.gw [data-action="ed-rel-org"]');
  await settle();
  await page.waitForSelector('.gw .gw-rel-rows');
  await clickSel(page, '.gw [data-action="ed-rel-preview"]');
  await page.waitForSelector('.gw .gw-preview');
  assert.ok((await page.textContent('.gw .gw-preview')).includes('The Troupe'), 'Faction 지침 보기');
  await clickSel(page, '.gw [data-action="ed-revert"]');
  await clickSel(page, '.gw [data-action="ed-revert-force"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));

  // 거점: 목록 → 열기 → 보임/숨김·조직·지역 드롭다운·이름 바꾸기 → 저장. 지도 클릭 위치 (지도 그림이 있을 때)
  await goNode(page, 'base');
  await page.waitForSelector('.gw .gw-basepage .dir-row');
  const baseN = await page.locator('.gw .gw-basepage .dir-row').count();
  assert.equal(baseN, Number(await page.textContent('.gw .gw-tree-item[data-value="base"] em')), '거점 수 = 배지');
  await clickSel(page, '.gw .gw-basepage [data-action="dir-open"][data-value="관리국 본부"]');
  await page.waitForSelector('.gw .gw-basepage .dir-row.open .dir-panel');
  await clickSel(page, '.gw [data-action="dir-base-show"][data-value="0|관리국 본부"]');
  await settle();
  await page.evaluate(() => { const s = document.querySelector('.gw select[data-change="dir-base-sido"]'); s.value = '03'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await settle();
  const sidoNow = await page.$eval('.gw select[data-change="dir-base-sido"]', (e) => e.value);
  assert.equal(sidoNow, '03', '지역 바꿈');
  assert.ok(!(await page.$$eval('.gw select[data-change="dir-base-gu"] option', (os) => os.map((o) => o.value))).includes('종로구'), '지역을 바꾸면 시군구 목록도 그 지역 것 (편집 창 다시 그림)');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  // 지도 그림이 떠 있으면 누른 자리가 위치(%)
  const hasMap = await page.evaluate(() => !!document.querySelector('.gw .dir-map[data-base-pick] img'));
  if (hasMap) {
    await page.waitForFunction(() => document.querySelector('.gw .dir-map[data-base-pick] img')?.complete);
    const box = await page.$eval('.gw .dir-map[data-base-pick] img', (img) => { img.scrollIntoView({ block: 'center' }); const r = img.getBoundingClientRect(); return { x: r.left + r.width * 0.25, y: r.top + r.height * 0.75 }; });
    await page.mouse.click(box.x, box.y);
    await settle();
    const pin = await page.$eval('.gw .dir-mappin', (e) => e.style.left + ' ' + e.style.top);
    assert.ok(/^2[45](\.\d)?% 7[45](\.\d)?%$/.test(pin), `지도 클릭 위치 ${pin}`);
  }
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  {
    const d = await dirOf(page);
    assert.equal(d.거점['관리국 본부'].show, false, '거점 숨김 저장');
    assert.equal(d.거점['관리국 본부'].sido, '03', '거점 지역 저장');
    if (hasMap) assert.ok(Math.abs(d.거점['관리국 본부'].x - 25) < 2 && Math.abs(d.거점['관리국 본부'].y - 75) < 2, '거점 좌표 저장');
  }
  // 거점 추가·이름 바꾸기·지우기
  await clickSel(page, '.gw .gw-basepage [data-action="dir-add-toggle"]');
  await page.waitForSelector('.gw [name="dir-base-new"]');
  await setInput(page, '.gw [name="dir-base-new"]', '시험 거점', 'input');
  await clickSel(page, '.gw [data-action="dir-base-new"]');
  await page.waitForSelector('.gw .dir-row.open [name="dir-base-name"]');
  await setInput(page, '.gw [name="dir-base-name"]', '시험 거점 2', 'input');
  await clickSel(page, '.gw [data-action="dir-base-rename"]');
  await settle();
  assert.ok(await page.$('.gw [data-action="dir-base-del"][data-value="시험 거점 2"]'), '이름 바꾸기');
  await clickSel(page, '.gw [data-action="dir-base-del"][data-value="시험 거점 2"]');
  await settle();
  assert.equal(await page.locator('.gw .gw-basepage .dir-row').count(), baseN, '지우기');
  await clickSel(page, '.gw [data-action="ed-revert"]');
  await clickSel(page, '.gw [data-action="ed-revert-force"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));

  // 괴이 공통 머리말: 고치면 덧쓰기, 기본으로
  await goNode(page, 'anomaly');
  await page.evaluate(() => { const d = document.querySelector('.gw .gw-anote'); if (d && !d.open) d.querySelector('summary').click(); });
  await settle();
  await setInput(page, '.gw [data-input="ed-anote"]', '머리말 고침', 'input');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  assert.equal((await dirOf(page)).세계.anomalyNote, '머리말 고침');
  await page.evaluate(() => { const d = document.querySelector('.gw .gw-anote'); if (d && !d.open) d.querySelector('summary').click(); });
  await clickSel(page, '.gw [data-action="ed-anote-reset"]');
  await settle();
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  assert.equal((await dirOf(page)).세계?.anomalyNote, undefined);
  // 발생 후보 토글 (목록 줄) → 명부 preset
  await page.evaluate(() => { const s = document.querySelector('.gw .gw-list-pick'); s.value = '소라 랜드'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForFunction(() => document.querySelector('.gw .gw-detail h2')?.textContent?.includes('소라 랜드'));
  await clickSel(page, '.gw .gw-detail h2 .gw-pre');
  await page.waitForFunction(() => document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  assert.equal((await dirOf(page)).괴이['소라 랜드'].preset, false, '발생 후보 OFF 저장');
  await clickSel(page, '.gw .gw-detail h2 .gw-pre');
  await clickSel(page, '.gw [data-action="ed-save"]');
  await page.waitForFunction(() => !document.querySelector('.gw .gw-save')?.classList.contains('dirty'));
  assert.equal((await dirOf(page)).괴이['소라 랜드'].preset, true);

  await closeEditor(page, true);
  assert.deepEqual(errors, [], `${vp}: 오류`);
  console.log(`PASS 세계 탭 [${vp}]: 기록 ${JSON.stringify(counts)}`);
  for (const l of log) console.log('  ·', l);
  await page.close();
}
await browser.close();
