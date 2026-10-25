// 통합 테스트룸 화면 검사: 인물을 바꿔 가며 동작을 눌러 스크린샷을 찍는다.
// 사용(저장소 맨 위): node game-src/action/testroom3/qa/shots.cjs [인물키…]
const { chromium } = require('playwright');
const path = require('path');
const OUT = __dirname, PAGE = 'file://' + path.resolve(__dirname, '../out/index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } });
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
  await page.goto(PAGE);
  await page.waitForFunction(() => window.__room && window.__room.CK);
  const keys = process.argv.slice(2).length ? process.argv.slice(2) : await page.evaluate(() => [...document.querySelectorAll('#chsel option')].map(o => o.value));
  const cv = page.locator('#cv');
  const shot = async (name) => { await cv.screenshot({ path: path.join(OUT, name + '.png') }); };
  const tap = async (k, hold = 60) => { await page.keyboard.down(k); await sleep(hold); await page.keyboard.up(k); };
  const report = [];
  for (const key of keys) {
    await page.evaluate(k => window.__room.setChar(k), key);
    await page.waitForFunction(k => window.__room.CK === k, key);
    await page.evaluate(() => { const f = document.getElementById('fs'); if (!f.checked) f.click(); });   // 필살기 게이지 무시
    await cv.click(); await sleep(300);
    const tag = key.replace(/[^\w.가-힣]/g, '_');
    const pose = async () => page.evaluate(() => { const r = window.__room, P = r.P; return { id: P.clip && P.clip.id, mode: P.mode, x: Math.round(P.x), face: P.face }; });
    await shot(`${tag}_00_대기`);
    await page.keyboard.down('ArrowRight'); await sleep(350); await shot(`${tag}_01_걷기`); await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft'); await sleep(300); await shot(`${tag}_02_걷기_왼쪽`); await page.keyboard.up('ArrowLeft');
    await page.keyboard.down('ArrowRight'); await sleep(80); await page.keyboard.up('ArrowRight'); await sleep(300);
    // 약1~3, 강
    await tap('KeyZ'); await sleep(120); await shot(`${tag}_03_약1`);
    await tap('KeyZ'); await sleep(140); await shot(`${tag}_04_약2`);
    await tap('KeyZ'); await sleep(150); await shot(`${tag}_05_약3`);
    await sleep(400); await tap('KeyX'); await sleep(230); await shot(`${tag}_06_강`);
    await sleep(700); await tap('KeyC'); await sleep(110); await shot(`${tag}_07_회피`);
    await sleep(600); await tap('KeyA', 30); await sleep(260); await shot(`${tag}_08_원거리`);
    await sleep(900); await tap('KeyS', 40); await sleep(450); await shot(`${tag}_09_고유기술`);
    await sleep(1200);
    await page.keyboard.down('KeyS'); await sleep(1500); await shot(`${tag}_10_충전`); await page.keyboard.up('KeyS'); await sleep(260); await shot(`${tag}_11_충전방출`);
    await sleep(1500); await tap('KeyF'); await sleep(500); await shot(`${tag}_12_필살기_컷인`); await sleep(1300); await shot(`${tag}_13_필살기`);
    await sleep(2500); await tap('KeyV', 300); await sleep(100);
    await page.keyboard.down('KeyV'); await sleep(250); await shot(`${tag}_14_막기`); await page.keyboard.up('KeyV'); await sleep(400);
    await tap('Digit1'); await sleep(200); await shot(`${tag}_15_맞기`); await sleep(600);
    await tap('Space'); await sleep(260); await shot(`${tag}_16_점프`); await sleep(800);
    await tap('Digit2'); await sleep(1300); await shot(`${tag}_17_쓰러짐`); await tap('Space'); await sleep(900);
    await tap('Digit6'); await sleep(200); await shot(`${tag}_18_끄덕이기`); await sleep(1200);
    await tap('KeyL'); await sleep(1600); await shot(`${tag}_19_주저앉기`); await tap('KeyL'); await sleep(700);
    report.push({ key, last: await pose(), errs: errs.splice(0) });
  }
  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
