// 설정 「상점」 묶음 초안 (11-07): 편집 창 설정 탭의 소지품 페이지를 연 뒤, 같은 틀(ps-group·ps-row·gx-segs·st-text)로 상점 묶음을 끼워 넣어 찍는다.
// 사용법: node docs/인계/상점_1107/mock_settings.mjs  → /mnt/project-files/작업_1107/상점_초안/set_{pc,phone}.png
import { boot, closeEditor, launch, loadFixture, openEditor, openWin, sleep } from '../../../tests/qc-settings-harness.mjs';
const fx = loadFixture(new URL('../../../.scratch/fixture/fixture.json', import.meta.url).pathname);
const seg = (cur, items) => `<div class="gx-segs gx-segs-sm">${items.map(([v, l]) => `<button class="gx-seg${cur === v ? ' on' : ''}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
const onoff = (on) => seg(on ? '1' : '0', [['1', 'ON'], ['0', 'OFF']]);
const text = (v, ph, max = 120) => `<input class="st-text" type="text" maxlength="${max}" value="${v}" placeholder="${ph}">`;
const field = (label, control, help) => `<div class="ps-row"><div class="ps-label"><b>${label}</b>${help ? `<small>${help}</small>` : ''}</div><div class="ps-ctl">${control}</div></div>`;
const group = (title, rows, note = '') => `<section class="ps-group"><h3>${title}</h3>${note ? `<p class="ps-note">${note}</p>` : ''}<div class="ps-rows">${rows.join('')}</div></section>`;
const html = group('상점', [
  field('상점', onoff(true), '켜면 [Inventory] 안내에 「거래할 수 있는 자리면 응답 끝에 [shop: 가게 이름]」 한 줄이 들어가고, 표식이 오면 그 응답 밑에 「상점 열기」 단추가 생겨요. 끄면 표식도 단추도 없어요.'),
  field('진열대 분량', seg('1', [['0', '3~5개'], ['1', '5~8개'], ['2', '8~12개']]), '한 번 열 때 모델이 짜는 물건 수예요. 많을수록 호출이 길어져요.'),
  field('맥락 반영', seg('1', [['1', '맥락'], ['0', '무관']]), '「맥락」은 최근 장면·상태창·진행 중 괴이/사건·신분을 보고 지금 쓸 만한 물건을 짜요. 「무관」은 가게 이름과 세계 설정만 보고 짜요.'),
  field('종류 제한', text('', '비우면 14종 전부 (예: 도구, 부적, 소모품)'), '쉼표로 적은 종류만 진열해요. 소지품 종류 이름과 같아야 해요.'),
  field('값 기준', text('', '비우면 가게 성격과 서울 물가대로'), '값을 정할 때 모델에 주는 한 줄이에요. 등급은 없고, 가게가 어떤 곳인지에 따라 값이 달라져요.'),
  field('다양성', onoff(false), '켜면 후보를 8개 넘게 뽑아 뻔하지 않은 것부터 골라요. 엉뚱한 물건이 늘고 호출이 조금 길어져요.'),
  field('생각 단계', seg('1', [['0', '없음'], ['1', '짧게'], ['2', '자세히']]), '진열대를 짜기 전에 보조 모델이 적는 메모예요. 「짧게」는 낱말 수준, 「자세히」는 단계별 설명. 길수록 토큰이 들어요.'),
  field('지난 진열대 피하기', onoff(true), '같은 가게를 다시 열거나 새로고침할 때 지난 진열대를 넘겨 겹치지 않게 해요. 끄면 매번 처음처럼 짜요.'),
  field('자세히 단추', onoff(true), '상세 팝업의 「자세히」예요. 누르면 보조 모델이 그 물건의 내력·쓰임새를 한 번 더 써 줘요. 끄면 단추가 빠져요.'),
]);
const INTRO = '상점는 메뉴가 아니에요. 본편 모델이 거래할 수 있는 자리라고 표식을 보낼 때만 채팅 속에 「상점 열기」 단추가 생기고, 팝업에서 산 물건은 가계부(상점)와 소지품에 같이 적혀요. 잔고와 소지품은 모델에 넘기지 않아요.';
const b = await launch(); const out = '/mnt/project-files/작업_1107/상점_초안/';
for (const vp of ['pc', 'phone']) {
  const { page } = await boot(b, fx, { message: [{ role: 'user', data: 'hi' }, { role: 'char', data: '본문' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark' } }, vp);
  await openWin(page); await sleep(300);
  if (!(await page.evaluate(() => document.querySelector('.gw')?.hidden === false))) await openEditor(page, 'set:items');
  else { const { goNode } = await import('../../../tests/qc-settings-harness.mjs'); await goNode(page, 'set:items'); }
  await sleep(300);
  await page.evaluate(({ html, intro }) => {
    // 왼쪽 목록: 소지품 밑에 「상점」 추가(선택)
    const it = document.querySelector('.gw .gw-tree-item[data-value="set:items"]');
    if (it && !document.querySelector('.gw .gw-tree-item[data-value="set:shop"]')) {
      const c = it.cloneNode(true); c.dataset.value = 'set:shop'; c.querySelector('span').textContent = '상점'; c.classList.add('on'); it.classList.remove('on');
      c.querySelector('svg').innerHTML = '<path d="M4 9h16l-1 11H5Z"/><path d="M3 9l2-5h14l2 5"/><path d="M9 13v3M15 13v3"/>';
      it.after(c);
    }
    // 오른쪽 본문: 소지품 묶음 자리에 상점 묶음
    const g = document.querySelector('.gw .ps-group'); if (!g) return;
    const box = g.parentElement; box.querySelectorAll('.ps-group').forEach((x) => x.remove()); box.insertAdjacentHTML('afterbegin', html);
    for (const h of document.querySelectorAll('.gw h1, .gw h2, .gw .gw-title, .gw .ph-room-title b')) if (h.textContent.trim() === '소지품') h.textContent = '상점';
    for (const el of document.querySelectorAll('.gw p, .gw small')) if (el.textContent.trim().startsWith('지금 가진 물건')) el.textContent = intro;
  }, { html, intro: INTRO });
  await sleep(200);
  await page.screenshot({ path: `${out}set_${vp}.png` });
  await page.evaluate(() => { let n = document.querySelector('.gw .ps-group'); while (n && !(n.scrollHeight > n.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(n).overflowY))) n = n.parentElement; if (n) n.scrollTop = n.scrollHeight; });
  await sleep(150); await page.screenshot({ path: `${out}set_${vp}2.png` });
  await page.close();
}
await b.close(); console.log('ok');
