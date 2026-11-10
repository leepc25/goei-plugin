// 망상홈쇼핑 방송 화면 확인 (2026-11-11, 작업용): node tests/_br_homeshop.mjs <사진 폴더>
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
</chat>`;
const browser = await launch();
const REPLY = '첫 답.\n[▣|2025.01.01|02:47 AM|☀️|4°C|관리국|QC 괴이]';
for (const [vp, size] of [['pc', { width: 1280, height: 800, touch: false }], ['phone', 'phone']]) {
  const chat = { message: [{ role: 'user', data: '출동', chatId: 'u1' }, { role: 'char', data: REPLY, chatId: 'c1' }], scriptstate: { $st_faction: 'A00', $st_lang: 'ko', $st_fm: '2', $st_fixed_theme: 'dark', $st_anomaly_on: '1', $pp_on: '0' } };
  const { page, errors } = await boot(browser, fx, chat, size, { store: { 'p:goei:data-homeshop': distPack('goei-data-homeshop'), 'p:goei:data-items': distPack('goei-data-items') } });
  let n = 0;
  const shot = async (tag) => { await page.screenshot({ path: `${OUT}/${vp}-${String(++n).padStart(2, '0')}-${tag}.png` }); };
  const click = (sel) => page.evaluate((s) => { const els = [...document.querySelectorAll(s)]; const el = els.find((e) => e.getBoundingClientRect().width > 0) || els[0]; if (!el) return false; el.click(); return true; }, sel);
  await openWin(page); await page.waitForTimeout(300);
  if (await page.evaluate(() => document.querySelector('.gw')?.hidden === false)) await closeEditor(page, true);
  await page.waitForTimeout(300);
  await page.evaluate((r) => { window.__llm = [{ type: 'success', result: r }]; }, SHOW);
  if (vp === 'pc') { if (!(await page.locator('.br').count())) await click('[data-action="nav-tab"][data-value="net"]'); await click('.br-bm[data-value="hs"]'); }
  else { await click('.gx-cgrip'); await click('[data-action="br-site"][data-value="hs"]'); }
  await page.waitForSelector('.hs-scr', { timeout: 6000 });
  await shot('connecting');
  await page.waitForSelector('.hs-l3', { timeout: 15000 });
  const call = await page.evaluate(() => window.__calls.llm.at(-1).messages.map((m) => m.content).join('\n'));
  assert.ok(call.includes('<cue>') && call.includes('와이드'), '방송 절이 요청문에 들어감');
  if (process.env.GIF) {
    // 움직임 확인용: 방송 칸을 0.2초마다 찍는다 (GIF=장수)
    const box = await page.locator(vp === 'pc' ? '.hs-row' : '.hs-win').boundingBox();
    mkdirSync(`${OUT}/gif-${vp}`, { recursive: true });
    for (let i = 0; i < Number(process.env.GIF); i++) { await page.screenshot({ path: `${OUT}/gif-${vp}/${String(i).padStart(3, '0')}.png`, clip: { x: box.x, y: box.y, width: Math.min(box.width, 1280 - box.x), height: Math.min(box.height, 800 - box.y) } }); await page.waitForTimeout(120); }
    await page.close();
    continue;
  }
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(2600); await shot(`t${i}`); }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, '가로 넘침 없음');
  await click('[data-action="hs-page"][data-value="sched"]'); await page.waitForTimeout(300); await shot('sched');
  await openEditor(page, 'set:hs'); await page.waitForTimeout(300); await shot('set');
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
