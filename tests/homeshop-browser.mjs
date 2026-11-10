// 망상홈쇼핑 방송 화면 확인 (2026-11-11, 작업용): node tests/homeshop-browser.mjs <사진 폴더>
// 인터넷 즐겨찾기로 열기 → 편성(상품·큐시트·채팅) 한 번 호출 → 방송이 큐시트대로 흐른다 → 설정 페이지
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { boot, closeEditor, closeWin, goNode, launch, loadFixture, openEditor, openWin } from './qc-settings-harness.mjs';
import { distPack } from './data-init.mjs';

const OUT = process.argv[2] || '.scratch/br-homeshop';
const fx = loadFixture(new URL('../.scratch/fixture/fixture.json', import.meta.url).pathname);
mkdirSync(OUT, { recursive: true });
export const SHOW = `<shop-identity>
sells: 망상홈쇼핑
</shop-identity>
<owner>
</owner>
<shelf>
행운의 무전기|무이자 6회|사용|walkie talkie|0.4|건전지 없이도 누군가 받습니다. 스티커: 밤 12시 이후 응답 금지.|누군가 받는다|
잠들지 않는 베개|무이자 3회|사용|pillow|0.8|베고 누우면 아침까지 눈이 떠 있습니다. 스티커: 뒤집어 쓰지 말 것.|잠이 오지 않는다|
한 번 더 울리는 자명종|무이자 12회|사용|alarm clock|0.5|끈 뒤에도 한 번 더 울립니다. 스티커: 세 번째는 듣지 말 것.|한 번 더 울린다|
</shelf>
<title>
금요 심야 특집
</title>
<cue>
#1
와이드|말하기|고객님들, 오늘도 잠 못 드셨죠? 잘 오셨습니다.|-
상품|신남|오늘 첫 상품, 행운의 무전기입니다!|-
바스트|속삭임|건전지가 없어도 누군가는 꼭 받아요.|-
와이드|놀람|이 구성이 오늘 방송에서만, 무이자 여섯 번!|가격 공개
바스트|다급|지금 전화가 밀려들고 있습니다, 서두르세요!|주문 폭주
전화|말하기|네 고객님, 연결됐습니다. 거기 어디세요?|전화 연결
바스트|차가움|…끊지 마세요.|응시
와이드|카운트|남은 수량이 빠르게 줄고 있습니다!|남은 수량 -12
바스트|웃음|매진 임박입니다, 고객님.|매진 임박
#2
와이드|말하기|다음 상품입니다.|-
바스트|신남|잠들지 않는 베개!|가격 공개
#3
와이드|말하기|마지막 상품입니다.|-
바스트|다급|한 번 더 울리는 자명종!|매진
</cue>
<chat>
ㅇㅇ|2번 재입고 되나요
???|여기 안에 있어요
민지맘|저거 진짜 들려요?
야식왕|지난주 산 거 아직 안 깸
???|나가는 길 아시는 분
하루|6회면 몇 번 불려가요?
rose|진행자 눈 왜저럼
익명|방청 신청했는데 답이 없어요
</chat>
<peek>
수신 전용. 송신 버튼은 장식입니다.
베갯잇 안쪽에 이름을 적지 마십시오.
세 번째 알람은 본인 부담.
</peek>
<operator>
인사|네, 망상홈쇼핑입니다. 주문 도와드리겠습니다, 고객님.
확정|주문 접수되었습니다. 출연 일정은 저희가 따로 연락드립니다.
맞교환|물건 잘 받았습니다. 돌려드리지는 않습니다.
</operator>`;
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0', $st_wallet: JSON.stringify({ start: 140000, log: [] }) } };
  const { page, errors } = await boot(browser, fx, chat, size, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
  let n = 0;
  const shot = async (tag) => { await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
  const goHs = async () => {
    if (vp === 'pc') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); }
    else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="hs"]'); }
  };
  await goHs();
  await page.waitForSelector('.hs-scr', { timeout: 6000 });
  await shot('connecting');
  await page.waitForSelector('.hs-l3', { timeout: 15000 });
  const call = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
  assert.ok(call.includes('<cue>') && call.includes('와이드'), '방송 절이 요청문에 들어감');
  if (process.env.GIF) {
    // 움직임 확인용: 방송 칸을 0.2초마다 찍는다 (GIF=장수)
    const box = await page.locator(vp === 'pc' ? '.hs-bd' : '.hs-main').boundingBox();
    mkdirSync(`${OUT}/gif-${vp}`, { recursive: true });
    for (let i = 0; i < Number(process.env.GIF); i++) { await page.screenshot({ path: `${OUT}/gif-${vp}/${String(i).padStart(3, '0')}.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 1280 - box.x), height: Math.min(box.height, 800 - box.y) } }); await page.waitForTimeout(120); }
    await page.close();
    continue;
  }
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(2600); await shot(`t${i}`); }
  const ss = () => page.evaluate(() => window.__chat.scriptstate);
  await page.evaluate(() => document.querySelector('.hs-sec')?.scrollIntoView({ block: 'end' })); await page.waitForTimeout(300); await shot('lineup');
  await page.evaluate(() => document.querySelector('.hs-gnb')?.scrollIntoView({ block: 'start' }));
  // 스티커 보기 → 들추기
  await click('[data-action="hs-pop"][data-value="peek"]'); await page.waitForTimeout(200);
  await click('[data-action="hs-lift"]'); await page.waitForTimeout(200); await shot('peek');
  assert.ok((await page.textContent('.hs-under')).includes('수신 전용'), '스티커 아래 글');
  await click('.hs-pop header [data-action="hs-pop"]');
  // 채팅 보내기: 한 번 더 호출 → 진행자 반응이 끼어든다
  await page.evaluate(() => { window.__llm = [{ type: 'success', result: '<cue>\n바스트|웃음|은하제 고객님, 좋은 질문이십니다!|-\n</cue>\n<chat>\n민지맘|ㅋㅋㅋ 읽어줬다\n???|읽지 마세요\n</chat>' }]; });
  await page.fill('[data-input="hs-say"]', '진짜 누가 받아요?');
  await click('[data-action="hs-say"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.hs-chlog p')].some((p) => p.textContent.includes('읽어줬다')), null, { timeout: 30000 });
  assert.ok(await page.evaluate(() => [...document.querySelectorAll('.hs-chlog p.me')].some((p) => p.textContent.includes('진짜 누가 받아요?'))), '내 채팅 줄');
  await page.waitForFunction(() => [...document.querySelectorAll('.hs-chlog p.host')].some((p) => p.textContent.includes('좋은 질문')), null, { timeout: 30000 });
  await shot('say');
  // 전화 주문: 무이자 할부 → 장부 + 택배 상자, 가계부는 그대로
  const wallet0 = (await ss()).$st_wallet;
  await click('[data-action="hs-pop"][data-value="call"]'); await page.waitForTimeout(200); await shot('call');
  assert.ok((await page.textContent('.hs-op')).includes('주문 도와드리겠습니다'), '상담원 인사');
  await click('[data-action="hs-order"]');
  await page.waitForFunction(() => (window.__chat.scriptstate.$hs_orders || '').includes('무전기'));
  await page.waitForTimeout(300); await shot('call-done');
  let st = await ss();
  const o1 = JSON.parse(st.$hs_orders)[0];
  assert.equal(o1.n, 6); assert.equal(o1.dues.length, 6);
  assert.ok(o1.dues.every((d, i) => d - (i ? o1.dues[i - 1] : o1.turn) >= 6 && d - (i ? o1.dues[i - 1] : o1.turn) <= 12), '호출 턴 간격 6~12');
  assert.ok(st.$st_items.includes('택배 상자(미개봉)'), '소지품에 택배 상자');
  assert.equal(st.$st_wallet, wallet0, '가계부는 안 건드림');
  await click('.hs-pop footer [data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300); await shot('orders');
  assert.ok((await page.textContent('.hs-ol')).includes('6회 남음'));
  // 방청 신청
  await click('.hs-menu [data-action="hs-pop"][data-value="aud"]'); await page.waitForTimeout(200);
  assert.equal(await page.locator('[data-action="hs-aud"][disabled]').count(), 1, '동의 전에는 신청 못 함');
  await click('[data-action="hs-agree"]'); await page.waitForTimeout(200); await shot('aud');
  await click('[data-action="hs-aud"]');
  await page.waitForFunction(() => !!window.__chat.scriptstate.$hs_aud); await page.waitForTimeout(200); await shot('aud-done');
  await click('.hs-pop footer [data-action="hs-pop"]');
  // 소지품에서 택배 상자 열기
  const boxId = o1.boxId;
  await click('[data-action="nav-tab"][data-value="items"]'); await page.waitForTimeout(300);
  await click(`[data-action="items-open"][data-value="${boxId}"]`); await page.waitForTimeout(300); await shot('box');
  assert.equal(await page.locator('[data-action="hs-box-open"]').count(), 1, '소지품 상세에 「열기」');
  await click('[data-action="hs-box-open"]');
  await page.waitForFunction(() => JSON.parse(window.__chat.scriptstate.$hs_orders)[0].openKey !== undefined, null, { timeout: 8000 });
  st = await ss();
  const live = JSON.parse(st.$st_items).list.filter((x) => !x.soldAt).map((x) => x.name);
  assert.ok(live.includes('행운의 무전기') && !live.some((n) => n.includes('택배 상자')), `상자를 열면 실제 물건: ${live}`);
  await page.waitForTimeout(300); await shot('box-opened');
  await click('[data-action="items-close"]'); await goHs(); await page.waitForTimeout(400);
  await click('[data-action="hs-page"][data-value="orders"]'); await page.waitForTimeout(300); await shot('orders-opened');
  assert.ok((await page.textContent('.hs-ol:last-of-type')).includes('수령 확인'));
  await click('[data-action="hs-page"][data-value=""]'); await page.waitForTimeout(300);

  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  await click('[data-action="hs-page"][data-value="sched"]'); await page.waitForTimeout(300); await shot('sched');
  await openEditor(page, 'set:hs'); await page.waitForTimeout(300); await shot('set');
  await click('.gw [data-action="hs-retry"][data-value="n:+"]'); await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.__chat.scriptstate.$hs_retry), '2', '자동 다시 연결 증감');
  await goNode(page, 'guide:Hs'); await page.waitForTimeout(300); await shot('guide');
  // 독립 창: 본편 카드 「접속하기」 → 상황판 없이 인터넷 창만 망상홈쇼핑으로 (고유 상점 @web)
  await closeEditor(page, true).catch(() => {}); await closeWin(page); await page.waitForTimeout(200);
  const html = await page.evaluate(() => window.__calls.handlers.display('TV를 켰다.\n[shop: 망상홈쇼핑|@web:hs]'));
  assert.ok(html.includes('data-goei-shop="hs"'), '접속하기 카드');
  await page.evaluate((h) => { const d = document.createElement('div'); d.id = 'chat-card'; d.style.cssText = 'position:fixed;left:20px;top:240px;width:340px;z-index:1'; d.innerHTML = h; document.body.appendChild(d); }, html);
  await page.evaluate(() => window.__calls.handlers.display('TV를 켰다.\n[shop: 망상홈쇼핑|@web:hs]'));
  await page.click('#chat-card [data-goei-shop]');
  await page.evaluate(() => { document.getElementById('chat-card').style.visibility = 'hidden'; });
  await page.waitForSelector('.gx-netsolo .hs-scr', { timeout: 8000 }).catch(async (e) => { await shot('solo-fail'); throw e; });
  await page.waitForTimeout(2500); await shot('solo');
  if (errors.length) console.log(vp, 'page errors:', errors.slice(0, 5));
  assert.deepEqual(errors, []);
  console.log(vp, 'ok');
  await page.close();
}
await browser.close();
