// 눌러 보기 전수점검 · 쇼핑몰·상점 결제(mall) 묶음 시작 상태 (2026-11-09)
// kind 'shop'  : makeBase 가 연 채팅 속 상점 위에, 팔던 물건(손전등)에 주인이 값을 부른 상태($st_shop.sell.price)를 심는다
//                → 「판매」 목록에서 손전등을 고르면 판매 상세([판매][흥정][그만])가 나오고, 입력창에 「판매: 손전등 ×」 칩이 뜬다.
// 그 밖(items 등): 인터넷 쇼핑몰 둘(우주 쇼핑몰·백일몽 포인트몰)이 보이고 살 수 있는 상태
//                → 로그인($br_login·$br_nick), 포인트 장부(+300,000 P, 포인트몰이 즐겨찾기에 나오게), 가계부 시작 잔고 1,000,000원,
//                  가짜 보조 모델에 진열대 둘을 넣고 인터넷 → 우주 쇼핑몰 → 포인트몰 → 우주 쇼핑몰 순으로 열어 진열대를 채워 둔다($cos_shop·$bm_shop·$br_tabs).
//                  돌릴 때: PC --from 'nav-tab|net' (우주몰 탭이 바로 열림), 'nav-tab|net>br-tab|1' (포인트몰) / 폰 --from 'br-site|cos' · 'br-site|bm'
const AT = '2026-11-07T00:00:00Z';
const SHELF_COS = `<shop-identity>
sells: 먼 별에서 온 물건, 호신 기기, 이상한 기념품
never: 식품, 약
prices: 우주인이 멋대로 정한 값
</shop-identity>
<owner>반가운 것이다 지구인 손님이여!! 돈을 넣으면 공간을 찢어 던져 주는 것이다.</owner>
<shelf>
은하 손전등|18000|사용|flashlight|0.3|먼 별의 빛을 담은 손전등|어두운 곳을 비춘다|
우주 공구 가방|42000|장비|tool bag|1.2|캔버스 가방, 별무늬|
운석 쇠파이프|7000|무기·사용|iron pipe|2|1m 길이, 운석으로 만듦|둔기로 쓸 수 있다|
외계 최루 스프레이|15000|소모5|pepper spray|0.2|경찰 납품용이라 주장함|잠시 멈춘다|
반중력 장갑|9000|장비|work gloves|0.1|가죽 보강, 조금 뜬다||특가: 25000
보라색 돌|1200000|-|purple stone|0.5|무엇인지 아무도 모른다|가지고 있으면 운이 좋다|희귀
</shelf>`;
const SHELF_BM = `<shop-identity>
sells: 임직원 복지 물품, 사무용품, 건강용품
never: 식품, 약
prices: 포인트 정가
currency: points
</shop-identity>
<owner>백일몽 임직원 여러분의 복지를 위한 포인트몰입니다.</owner>
<shelf>
사무용 손전등|18000|사용|flashlight|0.3|회사 로고가 박힌 손전등|어두운 곳을 비춘다|
명함 지갑|12000|장비|wallet|0.1|가죽, 회사 로고|
안마기|45000|사용|massager|1.0|목·어깨용|피로를 조금 푼다|
텀블러|9000|장비|tumbler|0.3|보온, 회사 로고||특가: 15000
임원용 만년필|500000|장비|fountain pen|0.1|이달의 한정 수량|서명이 잘 된다|희귀
</shelf>`;

const loaded = (page, v) => page.waitForFunction((k) => { try { return !!JSON.parse(window.__chat.scriptstate[k] || 'null')?.loaded; } catch { return false; } }, v, { timeout: 8000 }).then(() => true).catch(() => false);
const click = (page, sel) => page.evaluate((s) => { const b = document.querySelector(s); b?.click(); return !!b; }, sel);

export default async (page, { kind, vp, log, sleep, openWin, settle }) => {
  if (kind === 'shop') {
    // 팔던 물건에 값이 불린 상태
    const ok = await page.evaluate((at) => {
      const ss = (window.__chat.scriptstate ||= {});
      try {
        const st = JSON.parse(ss.$st_shop || 'null');
        if (!st) return false;
        st.sell = { itemId: 'i_light', name: '손전등', desc: 'LED', effect: '어두운 곳을 비춘다', use: true, price: 9000, first: 12000 };
        ss.$st_shop = JSON.stringify(st);
        return true;
      } catch { return false; }
    }, AT);
    log(`mall start-mod(${kind}): 팔기 상태(손전등, 부른 값 9,000 ← 처음 12,000) ${ok ? '심음' : '못 심음($st_shop 없음)'}`);
    return;
  }
  // 쇼핑몰: 로그인·포인트·잔고
  await page.evaluate((at) => {
    const ss = (window.__chat.scriptstate ||= {});
    ss.$br_login = '1';
    ss.$br_nick = '점검자';
    ss.$gn_nick = '점검자';
    ss.$st_points = JSON.stringify({ start: 0, log: [{ id: 'p0', anchor: '', amount: 300000, memo: '점검용 복지 포인트', src: 'manual', at }] });
    let w = { start: 1000000, log: [] };
    try { const o = JSON.parse(ss.$st_wallet || 'null'); if (o && Array.isArray(o.log)) w = { ...o, start: 1000000 }; } catch {}
    ss.$st_wallet = JSON.stringify(w);
  }, AT);
  await page.evaluate(([a, b]) => { window.__llm = [a, b].map((r) => ({ type: 'success', result: r })); }, [SHELF_COS, SHELF_BM]);
  await openWin(page);
  await settle(page);
  const phone = vp !== 'pc';
  // 우주 쇼핑몰 열기 (PC: 왼쪽 메뉴 인터넷 → 즐겨찾기 / 폰: 공용 서랍의 사이트 단추)
  if (phone) await click(page, '[data-action="br-site"][data-value="cos"]');
  else {
    await click(page, '[data-action="nav-tab"][data-value="net"]');
    await sleep(300);
    await click(page, '[data-action="br-login-guest"]');
    await sleep(200);
    await click(page, '[data-action="br-go"][data-value="cos"]');
  }
  const cosOk = await loaded(page, '$cos_shop');
  await sleep(300);
  // 백일몽 포인트몰
  const bmBtn = await click(page, phone ? '[data-action="br-site"][data-value="bm"]' : '[data-action="br-go"][data-value="bm"]');
  const bmOk = bmBtn && (await loaded(page, '$bm_shop'));
  await sleep(300);
  // 우주 쇼핑몰 탭으로 돌아와 둔다 (인터넷을 열면 이 탭이 먼저 보임)
  await click(page, phone ? '[data-action="br-site"][data-value="cos"]' : '[data-action="br-go"][data-value="cos"]');
  await sleep(600);
  // 탭 기록($br_tabs)이 채팅에 저장될 때까지
  await page.waitForFunction(() => /"s":"cos"/.test(String(window.__chat.scriptstate.$br_tabs || '')), null, { timeout: 4000 }).catch(() => log('탭 기록($br_tabs)이 안 저장됨'));
  const ids = await page.evaluate(() => { const g = (k) => { try { return JSON.parse(window.__chat.scriptstate[k]).items.map((x) => `${x.name}=${x.id}`).join(' '); } catch { return '-'; } }; return { cos: g('$cos_shop'), bm: g('$bm_shop') }; });
  log(`mall start-mod(${kind}/${vp}): 우주몰 진열 ${cosOk ? '채움' : '못 채움'} · 포인트몰 ${bmBtn ? (bmOk ? '채움' : '못 채움') : '단추 없음'}\n  cos: ${ids.cos}\n  bm: ${ids.bm}`);
};
