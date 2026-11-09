// 눌러 보기 전수점검 · 「phone」 묶음 시작 상태 (2026-11-09).
// 괴담톡에 대화방·단톡방·답장 실패 방·보기 전용 방·공지(두 세력, 두 쪽)·직접 추가 연락처가 있는 상태를 만든다.
// 연락처 id 는 실제 화면(연락처 탭)에서 읽어 와서 쓴다 (명부가 바뀌어도 맞게).
// 쓰는 저장 칸: $ph_state(방) · $ph_bulletins(공지) · $ph_contacts(직접 추가) · $ph_views(보기 전용 방) · $st_unread_phone
export default async (page, { kind, vp, log, sleep, openWin, settle }) => {
  // 창이 닫혀 있으면 연다
  await openWin(page).catch(() => {});
  await settle(page);
  await sleep(200);
  // 괴담톡 탭으로 (PC 왼쪽 메뉴 nav-tab, 폰 하단 바 tab)
  await page.evaluate(() => {
    const b = document.querySelector('.gx [data-action="nav-tab"][data-value="phone"], .gx [data-action="tab"][data-value="phone"]');
    b?.click();
  });
  await page.waitForSelector('.ph-app', { timeout: 5000 }).catch(() => log('괴담톡 화면이 안 뜸'));
  await sleep(300);
  // 연락처 탭 전부 돌며 id·이름 모으기 (첫 탭에 셋 미만이면 다음 탭도)
  const info = await page.evaluate(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const tabs = [...document.querySelectorAll('.ph-app [data-action="ph-ctab"]')].map((b) => b.dataset.value);
    const people = [];
    const seen = new Set();
    const grab = () => {
      for (const b of document.querySelectorAll('.ph-app [data-action="ph-dm"]')) {
        const id = b.dataset.value;
        if (seen.has(id)) continue;
        seen.add(id);
        people.push({ id, name: b.querySelector('.ph-who-name b')?.textContent?.trim() || b.querySelector('b')?.textContent?.trim() || id });
      }
    };
    grab();
    for (const t of tabs) {
      if (people.length >= 4) break;
      document.querySelector(`.ph-app [data-action="ph-ctab"][data-value="${t}"]`)?.click();
      await sleep(250);
      grab();
    }
    return { tabs, people, faction: String(window.__chat.scriptstate.$st_faction ?? '') };
  });
  log(`괴담톡 연락처 탭 ${info.tabs.join(',')} · 사람 ${info.people.length}명 (${info.people.slice(0, 4).map((p) => p.name).join(', ')})`);
  if (info.people.length < 2) { log('연락처가 둘 미만이라 방을 못 만든다'); return; }
  const [p1, p2, p3 = p2] = info.people;

  // 시각: 본편 상태표 2025.01.01 02:47 기준. 날짜 구분선이 나오게 전날 것도 섞는다
  const T = (h, m, prevDay = false) => `${prevDay ? '2024.12.31' : '2025.01.01'} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  let mid = 0;
  const msg = (sender, text, time, extra = {}) => ({ id: ++mid, sender, text, time, kind: 'message', audience: [], ...extra });
  const person = (p) => ({ id: p.id, name: p.name });

  // ① 1:1 방: 45개 (한 화면 40개 넘김 → 「이전 대화 더 보기」), 전날 것·반응·쉼 섞기, 안 읽음 2
  const dm1 = { id: `dm_${p1.id}`, kind: 'dm', members: [p1.id], people: { [p1.id]: person(p1) }, messages: [], draft: '', unread: 2, readThrough: 0 };
  for (let i = 0; i < 45; i++) {
    const prev = i < 10;
    const h = prev ? 23 : 1 + Math.floor(i / 20), m = (i * 7) % 60;
    const me = i % 3 === 0;
    dm1.messages.push(msg(me ? 'me' : p1.id, me ? `나 ${i + 1}번째 말. 지금 어디쯤이야?` : `${p1.name} ${i + 1}번째 답. 거의 다 왔어. 조금만 기다려.`, T(h, m, prev), i === 44 ? { reactions: '👍1' } : {}));
    if (i === 20) dm1.messages.push({ id: ++mid, sender: p1.id, text: '…', time: T(h, m), kind: 'pause', audience: [] });
  }
  dm1.readThrough = mid - 2;

  // ② 단톡방: 이름·주제 있음, 초대 기록 + 대화 5개, 반응 붙은 말풍선
  const g1 = { id: 'g_1', kind: 'group', name: '야간조', topic: '순찰 보고', members: [p2.id, p3.id], people: { [p2.id]: person(p2), [p3.id]: person(p3) }, messages: [], draft: '', unread: 1, readThrough: 0 };
  g1.messages.push({ id: ++mid, sender: 'system', text: `${p2.name}, ${p3.name}님을 초대했어요.`, time: T(2, 10), kind: 'invite', audience: [], participant: p2.id });
  g1.messages.push(msg(p2.id, '다들 위치 보고 바람', T(2, 11)));
  g1.messages.push(msg(p3.id, '동쪽 출입구. 이상 없음', T(2, 12), { reactions: '👍2' }));
  g1.messages.push(msg('me', '나는 관람차 아래', T(2, 13)));
  g1.messages.push(msg(p2.id, '거기 소리 들리면 바로 말해', T(2, 14)));
  g1.messages.push(msg(p3.id, '사진 찍어 둘게', T(2, 15)));
  g1.readThrough = mid - 1;

  // ③ 답장을 못 받은 1:1 방: 내 말 하나 + pending 오류 → 「다시 시도」「건너뛰기」
  const dm2 = { id: `dm_${p2.id}`, kind: 'dm', members: [p2.id], people: { [p2.id]: person(p2) }, messages: [], draft: '', unread: 0, readThrough: 0 };
  const sent = msg('me', '지금 통화 돼?', T(2, 40));
  dm2.messages.push(sent);
  dm2.pending = { message: sent.id, status: 'error', action: { type: 'send' } };

  const st = { version: 2, seq: 1, mid, rooms: { [dm1.id]: dm1, [g1.id]: g1, [dm2.id]: dm2 }, order: [dm1.id, g1.id, dm2.id] };

  // ④ 공지: 내 소속 + 다른 소속, 35개 (한 쪽 30개 → 쪽수 단추), 안 읽음 섞기
  const fac = info.faction || 'A00';
  const other = fac === 'A00' ? 'B00' : 'A00';
  const cats = ['공지', '업무', '시설', '인사', '안전'];
  const items = [];
  for (let i = 0; i < 35; i++) {
    const mine = i % 4 !== 3;
    items.push({ id: i + 1, order: i + 1, read: i < 23, channel: mine ? fac : other, channelName: mine ? '관리국' : '다른 조직', issuer: mine ? '관리국 총무과' : '외부 연락망', category: cats[i % 5], title: `${i + 1}번째 공지: ${['야간 순찰 조 편성', '장비 반납 기한', '출입증 재발급', '소라 랜드 관람차 접근 금지', '보고서 양식 변경'][i % 5]}`, text: `본문 ${i + 1}.\n오늘 02시 기준으로 적용됩니다.\n문의는 총무과로.`, time: T(0, (i * 3) % 60) });
  }
  const bulletins = { version: 2, seq: 35, items, checks: {}, seen: {} };

  // ⑤ 직접 추가한 연락처 (기타 탭) → 「삭제」 단추. 기타(T05) 탭이 안 보이면 모든 연락처 공개를 켠다
  const custom = { version: 1, seq: 1, items: [{ id: 'c_custom_1', name: '김배달', note: '자주 시키는 치킨집 사장' }] };

  // ⑥ 보기 전용 방 (사이드스토리): 대화·쉼·생략·시각 줄, 안 읽음
  const view = { id: 'v_test1', preset: 'side', name: '야식 토론', pov: p1.id, people: [person(p1), person(p2)], unread: true, time: T(2, 30),
    messages: [
      { sender: '-', type: 'time', text: T(2, 20) },
      { sender: p1.id, type: 'text', text: '치킨이냐 피자냐' },
      { sender: p2.id, type: 'text', text: '당연히 치킨', reactions: '😂1' },
      { sender: p1.id, type: 'pause', text: '…' },
      { sender: p2.id, type: 'skip', text: '' },
      { sender: p2.id, type: 'text', text: '근무 끝나고 시키자' },
    ] };

  await page.evaluate(({ st, bulletins, custom, view, needAll }) => {
    const s = window.__chat.scriptstate;
    s.$ph_state = JSON.stringify(st);
    s.$ph_bulletins = JSON.stringify(bulletins);
    s.$ph_contacts = JSON.stringify(custom);
    s.$ph_views = JSON.stringify([view]);
    s.$st_unread_phone = '1';
    if (needAll) s.$ph_all_contacts = '1';
  }, { st, bulletins, custom, view, needAll: !info.tabs.includes('T05') });
  if (!info.tabs.includes('T05')) log('기타(T05) 탭이 없어 「모든 연락처 공개」를 켠다');
  // 상황판으로 돌아가 둔다 (--from 으로 괴담톡을 새로 누르게)
  await page.evaluate(() => document.querySelector('.gx [data-action="nav-tab"][data-value="board"], .gx [data-action="tab"][data-value="board"]')?.click());
  await sleep(200);
  log(`괴담톡 시작 상태: 방 3(1:1 45개·단톡·답장 실패) · 공지 ${items.length} · 직접 연락처 1 · 보기 전용 방 1 (${vp}/${kind})`);
};
