// 눌러 보기 전수점검 · 소지품(items) 묶음 시작 상태 (2026-11-09)
// 기본 makeBase 의 items/shop 상태 위에: 물건 고치기 켬($it_edit), 잔고 직접 수정 켬($st_wallet_edit),
// 합칠 짝이 되는 소모품 하나 더(굵은 소금 ↔ 소금 한 줌), 가계부 거래 줄(본문·직접·상점)을 심는다.
// 물건 「고치기」·「합치기」·가계부 「잔고 고치기」·「거래 지우기」 단추가 화면에 나오게 하기 위함.
export default async (page, { kind, log, sleep }) => {
  await page.evaluate(() => {
    const ss = (window.__chat.scriptstate ||= {});
    ss.$it_edit = '1';
    ss.$st_wallet_edit = '1';
    // 소모품 짝 하나 더 (이름에 「소금」이 같아 합칠 수 있음)
    try {
      const it = JSON.parse(ss.$st_items || '{"list":[],"log":[]}');
      if (!it.list.some((x) => x.id === 'i_salt2')) it.list.push({ id: 'i_salt2', name: '소금 한 줌', desc: '종이에 싸 둠', effect: '부정한 것을 물린다', use: true, uses: 2, state: 'ok', from: 'story', anchor: 'c1', quote: '소금을 한 줌 집어 주머니에 넣었다', at: '2026-11-07T00:00:00Z' });
      if (!it.log.length) it.log.push(
        { id: 'l1', item: 'i_salt', name: '굵은 소금', what: 'get', by: 'manual', anchor: '', at: '2026-11-07T00:00:00Z' },
        { id: 'l2', item: 'i_salt', name: '굵은 소금', what: 'use', by: 'use', n: 1, anchor: 'c1', at: '2026-11-07T00:10:00Z' },
      );
      ss.$st_items = JSON.stringify(it);
    } catch (e) { console.warn('items start-mod: 물건 못 심음', String(e)); }
    // 가계부 줄 (core/wallet.ts WalletEntry): 본문 거래(기준 메시지 c1)·직접 조정(기준 없음)·상점 구입
    if (!ss.$st_wallet || !/"log":\[\s*\{/.test(ss.$st_wallet)) {
      const w = { start: 140000, log: [
        { id: 'w1', anchor: 'c1', amount: -4500, memo: '편의점 삼각김밥·커피', src: 'story', quote: '삼각김밥과 캔커피를 사서 4,500원을 냈다', at: '2026-11-07T00:00:00Z' },
        { id: 'w2', anchor: '', amount: 50000, memo: '잔고 수정', src: 'manual', at: '2026-11-07T00:05:00Z' },
        { id: 'w3', anchor: 'c1', amount: -18000, memo: '손전등', src: 'store', at: '2026-11-07T00:08:00Z' },
      ] };
      ss.$st_wallet = JSON.stringify(w);
    }
  });
  await sleep(100);
  log(`items start-mod(${kind}): 고치기·잔고 수정 켬, 소금 한 줌·가계부 3줄 심음`);
};
