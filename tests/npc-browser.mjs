// NPC 자유 대화 브라우저 시험: 가짜 모델 다리로 통합판을 열고 본부·층에서 말을 건다. npm run build 뒤 실행.
// SHOTS=폴더 면 PC(1280×720)·폰 가로(844×390) 스크린샷.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || `${execSync('npm root -g').toString().trim()}/playwright`);
const shots = process.env.SHOTS;
const url = pathToFileURL(resolve('dist/goei-action-game.html')).href;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium', headless: true, args: ['--no-sandbox', '--allow-file-access-from-files'] });

// 가짜 모델: 보낸 글에 따라 정해진 답과 태그. 받은 프롬프트는 window.__prompts에 남긴다
const MOCK = () => {
  window.__prompts = [];
  const reply = (sys, user) => {
    if (/싸우자|꺼져/.test(user)) return '그 말, 후회하게 될 거예요.\n[[호감 -1]] [[적대]]';
    if (/약|다쳤/.test(user)) return '이거라도 가져가요. 피 냄새가 너무 나서.\n[[호감 +1]] [[선물 medkit]]';
    if (/단서|규칙/.test(user)) return '인사는 꼭 하고 지나가요. 여기 사람들은 그걸 봐요.\n[[힌트 1]]';
    if (/같이/.test(user)) return '좋아요. 이 방까지만 같이 가죠.\n[[호감 +1]] [[동행]]';
    if (/사|거래|물건/.test(user)) return '현금만 받아요. 보여 줄게요.\n[[거래]]';
    return `${/잼트리/.test(sys) ? '오늘 임무는 창구에 올려 뒀어요. 부장님 결재는 이미 났고요.' : '네, 듣고 있어요. 천천히 말해요.'}\n[[호감 +1]]`;
  };
  return {
    talk: {
      model: async (messages) => {
        window.__prompts.push(messages);
        await new Promise((r) => setTimeout(r, 400));
        return reply(messages[0].content, messages.at(-1).content);
      },
      lore: async () => null,
      recent: async () => ['주인공: 오늘은 좀 쉬자.', '봇: 상황판에 새 사건이 떴다.'],
    },
    card: async () => ({ faction: '', agents: [{ id: 'jaemtri', name: '잼트리', state: '본부 대기', situation: '서류 정리' }], events: [{ kind: 'an', name: '젖은 복도', loc: '3층', state: '조사 중' }] }),
  };
};

async function run(view, tag) {
  const errors = [];
  const ctx = await browser.newContext(view);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const S = (n) => (shots ? page.screenshot({ path: `${shots}/${tag}-${n}.png` }) : null);
  await page.goto(url);
  await page.waitForFunction(() => window.__goeiDemo && window.__goeiEngine);
  await page.evaluate(`window.__goeiDemo.open((${MOCK})())`);
  await page.waitForFunction(() => window.__goeiEngine && window.__goeiNpc);
  await page.getByText('새로 시작').click();
  await page.waitForFunction(() => window.__goeiEngine.inHub && window.__goeiEngine.world);
  await page.waitForTimeout(1500);
  // 잼트리 임무 책상은 E = 임무 창 (2026-10-25 사용자: 일하는 자리에서 대화로 빠져 헷갈림). 자유 대화는 「요원」 자리(사무실 요원들)에서
  const goSpot = (id) => page.evaluate((id) => { const w = window.__goeiEngine.world; const s = w.stage.current().spots.find((q) => q.id === id); w.player.x = s.x; if (s.y !== undefined) w.player.y = s.y; }, id);
  await goSpot('agents');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.gnp:not([hidden])');
  assert.ok((await page.textContent('.gnp-name')).trim(), '대화 상대 이름');
  await S('1-hq-open');
  await page.fill('.gnp-in', '오늘 임무 있어요?');
  await page.press('.gnp-in', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.gnp-log p.wait'));
  const log1 = await page.textContent('.gnp-log');
  assert.match(log1, /듣고 있어요|창구에 올려/);
  assert.doesNotMatch(log1, /\[\[/, '태그는 화면에 안 보인다');
  assert.match(log1, /호감 ↑/);
  const sys = await page.evaluate(() => window.__prompts[0][0].content);
  assert.match(sys, /젖은 복도/, '상황판 사건이 들어간다');
  assert.doesNotMatch(sys, /오늘은 좀 쉬자/, '최근 채팅은 기본으로 안 보낸다');
  // 보낸 뒤 입력칸에서 빠지면(키보드 닫힘) 창은 아래 배치로 돌아온다
  await page.evaluate(() => document.activeElement.blur());
  assert.equal(await page.locator('.gnp.typing').count(), 0);
  await S('2-hq-reply');
  if (view.isMobile) {
    // 폰 소프트 키보드: 입력칸을 누르면 창이 위로 올라가고 입력칸이 이름 바로 아래로 온다. 키보드(아래 55%)는 회색 판으로 흉내
    await page.tap('.gnp-in');
    await page.waitForSelector('.gnp.typing');
    assert.ok(await page.isVisible('.gnp-acts'), '입력 중에도 원래 하던 일 버튼');
    const [r, ih] = await page.evaluate(() => [document.querySelector('.gnp-in').getBoundingClientRect().bottom, innerHeight]);
    assert.ok(r < ih * 0.45, `키보드 위에 입력칸 (${Math.round(r)}/${ih})`);
    await page.evaluate(() => { const k = document.createElement('div'); k.id = 'fakekb'; k.textContent = '(소프트 키보드 자리)'; k.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:55%;background:#3b3f44;color:#aaa;font:16px sans-serif;display:grid;place-items:center;z-index:99999'; document.body.append(k); });
    await S('2b-keyboard');
    await page.evaluate(() => document.getElementById('fakekb').remove());
    await page.evaluate(() => document.activeElement.blur());
  }
  // 입력칸에서 Esc로 빠져나와 E = 원래 하던 일(사무실 창). 일시정지 메뉴는 열리지 않는다
  await page.focus('.gnp-in');
  await page.keyboard.press('Escape');
  assert.ok(await page.isVisible('.gnp'), 'Esc는 입력칸에서만 빠진다');
  await page.keyboard.press('KeyE');
  await page.waitForSelector('.goei-engine-hq:not([hidden])', { state: 'visible' });
  assert.equal(await page.locator('.mn.on').count(), 0, '일시정지 메뉴는 열리지 않는다');
  await S('3-hq-place');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // 잼트리 책상: E 한 번에 바로 임무 창
  await goSpot('jaemtri');
  await page.waitForTimeout(150);
  await page.keyboard.press('KeyE');
  await page.waitForSelector('[data-mission]', { state: 'visible' });
  assert.equal(await page.locator('.gnp:not([hidden])').count(), 0, '임무 책상에서는 대화창이 먼저 뜨지 않는다');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // 사무실 요원: 다른 요원으로 바꾸기 버튼
  const office = await page.evaluate(() => { const w = window.__goeiEngine.world; return w.props.filter((q) => q.kind === 'hubspot').map((q) => q.id); });
  // 층으로: 시험장(훈련장)에서 talkTo로 브라우니(선물·적대)와 상인
  await page.evaluate(() => window.__goeiEngine.start_new('training'));
  await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub);
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__goeiNpc.talkTo('brownie', { gifts: ['medkit'], facts: ['요원이 다쳐 있다'] }));
  await page.waitForSelector('.gnp:not([hidden])');
  await page.fill('.gnp-in', '다쳤어요. 약 있어요?');
  await page.press('.gnp-in', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.gnp-log p.wait'));
  assert.match(await page.textContent('.gnp-log'), /물건을 받았다/);
  await S('4-floor-gift');
  // 싸우자 두 번: 호감이 -2 아래로 가야 적대
  await page.fill('.gnp-in', '꺼져.');
  await page.press('.gnp-in', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.gnp-log p.wait'));
  assert.doesNotMatch(await page.textContent('.gnp-log'), /적대한다/, '호감 0에서는 적대가 안 된다');
  await S('5-floor-angry');
  await page.keyboard.press('Escape');
  // 실제 층: 백일몽 탐사원(이재헌)에게 단서 묻기 → 이 층 규칙 단서 하나
  await page.evaluate(() => window.__goeiNpc.talk.close());
  await page.evaluate(() => window.__goeiEngine.start_new('elevator'));
  // 층 id는 방 진행 뒤 'room:…' (옛 'floor…' 아님): 본부 밖 실제 층이면 된다
  await page.waitForFunction(() => window.__goeiEngine.world && !window.__goeiEngine.inHub && !window.__goeiEngine.world.floor.id.startsWith('hq:'));
  await page.waitForTimeout(2500);
  await page.evaluate(() => { const w = window.__goeiEngine.world; w.player.x = 1100; });
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__goeiNpc.talkTo('leejaheon', { canJoin: true }));
  await page.waitForSelector('.gnp:not([hidden])');
  await page.fill('.gnp-in', '여기 규칙 단서 같은 거 알아요?');
  await page.press('.gnp-in', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.gnp-log p.wait'));
  assert.match(await page.textContent('.gnp-log'), /단서:/);
  assert.match(await page.evaluate(() => window.__prompts.at(-1)[0].content), /차원 승강기/);
  await page.evaluate(() => document.activeElement.blur());
  await S('6-floor-hint');
  if (view.isMobile) {
    await page.tap('.gnp-in');
    await page.waitForSelector('.gnp.typing');
    await S('6b-floor-typing');
    await page.evaluate(() => document.activeElement.blur());
  }
  // 모델 실패 → 미리 쓴 대사
  await page.evaluate(() => { window.__goeiNpc.talk.close(); });
  const blocked = await page.evaluate(() => window.__goeiEngine.world.paused || false);
  assert.ok(errors.length === 0, errors.join('\n'));
  await ctx.close();
  return { office, blocked };
}

try {
  const pc = await run({ viewport: { width: 1280, height: 720 } }, 'pc');
  console.log('PC', pc);
  const phone = await run({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, 'phone');
  console.log('phone', phone);
  console.log('npc-browser OK');
} finally {
  await browser.close();
}
