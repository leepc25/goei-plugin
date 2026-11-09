// 눌러 보기 시작 상태: 인물 기록 (리수폿) 묶음 `people` — 승인·편집 동작이 다 화면에 나오게 꾸민다.
// 상황판 시작 뒤(makeBase board)에서: 응답 몇 개를 더 두고, 채팅의 goeiPeopleV1 에 인물 둘·후보(검토 대기·승인됨·모으는 중)·
// 말투 「변경 승인 대기」 항목·성적 욕망 글·등록 대기 이름·마지막 갱신 기록·지난 항목 20개 넘침을 심는다. 진단 기록도 플러그인 저장소에 둔다.
// 쓰는 곳: node scripts/click-audit.mjs --start board --start-mod scripts/click-audit-starts/people.mjs --from 'nav-tab|records>rec-sub|people>rec-person|쟈알디' …
export default async (page, { kind, log, sleep }) => {
  if (kind !== 'board') return;
  const info = await page.evaluate(() => {
    const chat = window.__chat;
    const msgs = chat.message;
    // 응답 셋 더: 관찰이 서로 다른 메시지 3개 이상에 걸치게 (근거 메시지가 채팅에 있어야 「살아 있는」 관찰)
    const more = [
      ['u2', 'user', '쟈알디에게 괜찮냐고 묻는다.'],
      ['c2', 'char', '쟈알디는 대답 대신 어깨를 으쓱했다. "괜찮아. 신경 쓰지 마." 스팡달이 뒤에서 킥킥 웃었다. 민수라는 신입이 서류를 들고 지나갔다.'],
      ['u3', 'user', '커피를 건넨다.'],
      ['c3', 'char', '쟈알디는 잔을 받아 들고 잠시 말이 없었다. "…고맙다." 짧은 한마디였지만 눈은 피하지 않았다. 민수가 멀리서 인사했다.'],
      ['u4', 'user', '같이 순찰 돌자고 한다.'],
      ['c4', 'char', '"네가 먼저 가. 뒤는 내가 본다." 쟈알디가 무전기를 챙기며 말했다. 스팡달이 "둘이 잘 어울리네" 하고 놀렸다.'],
    ];
    for (const [id, role, data] of more) msgs.push({ role, data, chatId: id });
    const ss = chat.scriptstate;
    // 말투 다변화 2단계(묻기)·원문 보관 켬 → 말투 승인 단추·「보낸 프롬프트 보기」가 나온다. 세력 평판·성격 6축·성적 욕망·이상성욕은 기본 켬
    Object.assign(ss, { $pp_register_variety: 'two', $pp_register_change: 'ask', $pp_keep_raw: '1', $pp_on: ss.$pp_on ?? '1' });
    const at = '2025-01-01T02:47:00.000Z';
    const E = (id, slot, text, anchor, extra = {}) => ({ id, text, src: 'story', anchor, seq: 0, ...extra });
    const seed = (id, slot, text) => ({ id, text, src: 'seed', anchor: '#0', seq: 0 });
    const ob = (id, anchor, reason, strength, confidence) => ({ id, anchor, seq: 0, quote: '', reason, strength, confidence });
    const store = window.__chat.goeiPeopleV1 && typeof window.__chat.goeiPeopleV1 === 'object' ? window.__chat.goeiPeopleV1 : { schema: 1, people: {}, factions: {}, docs: {}, log: [], folded: {}, read: {}, pending: {}, ignored: [] };
    // 지난 항목 20개 넘김: 「주요 행적」에 옛 항목 22개(뒤 항목이 앞 항목을 대체) + 살아 있는 항목 1개 → 「n개 더 보기」
    const hist = [];
    for (let i = 0; i < 23; i++) hist.push({ id: `eh${i}`, text: `행적 ${i + 1}: ${i % 2 ? '순찰 중 괴이 흔적을 보고했다' : '신입 교육을 맡았다'}`, src: i ? 'story' : 'seed', anchor: i ? 'c1' : '#0', seq: i, ...(i ? { replaces: `eh${i - 1}` } : {}) });
    const axes = { relationalInitiative: 35, expressionDirectness: 70, emotionalExpressiveness: 15, guardedness: 72, impulsivity: 30, relationshipPersistence: 65 };
    store.people['쟈알디'] = {
      name: '쟈알디', faction: 'A00', seeded: { from: 'lore', at }, express: 0, aliases: ['Jyaldi'], axes, axesFrom: 'model',
      patterns: ['주인공 앞에서는 평가를 한 박자 늦게 말한다'],
      affinity: { base: 10 }, address: { toUser: '요원', register: '반말' },
      slots: {
        identity: [seed('ei1', 'identity', '관리국 현장 요원. 30대 초반. 짧은 머리, 왼손에 오래된 흉터')],
        personality: [seed('ep1', 'personality', '거짓말을 가장 싫어한다. 칭찬 대신 정확한 평가를 건넨다'), E('ep2', 'personality', '고마움을 말로 길게 하지 않고 짧게 끊는다', 'c3', { quote: '고맙다' })],
        state: [E('es1', 'state', '무전기를 챙기고 순찰 준비 중', 'c4')],
        relationship: [E('er1', 'relationship', '주인공을 아직 시험하는 중이지만 뒤를 맡길 정도는 됐다', 'c4', { target: '@user' }), E('er2', 'relationship', '스팡달의 놀림을 받아 준다', 'c4', { target: '스팡달' })],
        // 말투: 승인 대기 표지가 붙은 항목 (speech.ts 의 「[말투 변경 승인 대기 가까워짐] 이유 / 이유」 꼴)
        speech: [E('esp1', 'speech', '「요원」이라고 부르고 반말. 문장이 짧고 명령형이 많다 [말투 변경 승인 대기 가까워짐] 커피를 받고 고맙다고 함 / 뒤를 맡기겠다고 함 / 눈을 피하지 않음', 'c4', { target: '@user' })],
        behavior: [E('eb1', 'behavior', '위험한 자리에선 자기가 뒤에 선다', 'c4', { quote: '뒤는 내가 본다' })],
        knowledge: [E('ek1', 'knowledge', '주인공이 신입이라는 것을 안다', 'c2')],
        threads: [E('et1', 'threads', '민수의 서류가 무엇인지 확인하려 한다', 'c2')],
        history: hist,
        scene: [E('esc1', 'scene', '사무실 문 앞, 무전기를 든 채', 'c4')],
        'affinity.appraisal': [E('ea1', 'affinity.appraisal', '첫인상: 말이 적고 눈치가 빠른 신입', 'c1', { target: '@user' })],
        'register.context': [E('erc1', 'register.context', '공적인 자리에선 「요원」, 둘만 있을 땐 이름을 부르지 않는다', 'c2', { target: '@user' })],
      },
      candidates: {
        // 검토 대기 (관찰 4·장면 3 이상·확신 55 이상 → 승인·거절 단추)
        k_ready: { id: 'k_ready', axis: 'guardedness', direction: 'down', pattern: '주인공 앞에서 경계를 조금씩 푼다', status: 'collecting', at, evidence: [ob('o1', 'c1', '손을 흔들어 먼저 인사했다', 60, 70), ob('o2', 'c2', '괜찮다고 짧게나마 답했다', 55, 65), ob('o3', 'c3', '커피를 받고 고맙다고 했다', 70, 80), ob('o4', 'c4', '뒤를 맡기겠다고 했다', 75, 85)] },
        // 승인됨 (되돌리기 단추)
        k_done: { id: 'k_done', axis: 'expressionDirectness', direction: 'up', pattern: '요구를 돌려 말하지 않고 바로 말한다', status: 'approved', at, applied: { axis: 'expressionDirectness', before: 62, after: 70 }, evidence: [ob('o5', 'c2', '신경 쓰지 말라고 바로 말했다', 60, 70), ob('o6', 'c3', '고맙다고 바로 말했다', 60, 70), ob('o7', 'c4', '먼저 가라고 지시했다', 70, 80), ob('o8', 'c1', '손짓으로 바로 불렀다', 60, 60)] },
        // 모으는 중 (아직 조건 못 채움)
        k_coll: { id: 'k_coll', axis: 'impulsivity', direction: 'up', pattern: '놀림을 받으면 바로 받아친다', status: 'collecting', at, evidence: [ob('o9', 'c4', '스팡달의 놀림에 눈을 흘겼다', 40, 50)] },
        // 장기 변화(글) 후보도 검토 대기
        k_pat: { id: 'k_pat', axis: 'pattern', direction: 'new', pattern: '주인공에게는 평가 대신 짧은 격려를 한다', status: 'collecting', at, evidence: [ob('o10', 'c1', '손을 흔들었다', 50, 60), ob('o11', 'c2', '괜찮다고 했다', 50, 60), ob('o12', 'c3', '고맙다고 했다', 60, 70), ob('o13', 'c4', '뒤를 봐 주겠다고 했다', 60, 70)] },
      },
      sexual: { desire: { text: '주도권을 쥐는 쪽을 좋아한다. 말보다 손이 먼저 간다. 불을 끄는 것을 싫어한다.', at }, paraphilia: { text: '미확인', at }, desireOn: true, paraphiliaOn: true, explicit: null },
    };
    store.people['스팡달'] = {
      name: '스팡달', faction: 'A00', seeded: { from: 'lore', at }, express: 1, aliases: ['Spangdal'], axes: { relationalInitiative: 70, expressionDirectness: 60, emotionalExpressiveness: 35, guardedness: 40, impulsivity: 60, relationshipPersistence: 75 }, axesFrom: 'default', patterns: [], candidates: {},
      affinity: { base: 20 }, address: { toUser: '후배', register: '반말' },
      slots: { identity: [seed('si1', 'identity', '관리국 선임 요원. 후배를 놀리는 것이 낙')], speech: [E('ssp1', 'speech', '「후배」라고 부르고 반말. 장난스럽게 끝을 늘인다', 'c2', { target: '@user' })] },
    };
    // 변경 기록: 호감 계기·호칭 변경 (쟈알디)
    store.log.push(
      { id: 'cg1', anchor: 'c3', seq: 0, src: 'story', who: '쟈알디', kind: 'cue', cue: '작은친절', reason: '커피를 건네받음', quote: '고맙다' },
      { id: 'cg2', anchor: 'c4', seq: 0, src: 'story', who: '쟈알디', kind: 'cue', cue: '도움', reason: '순찰을 같이 돌자고 함' },
      { id: 'cg3', anchor: 'c2', seq: 1, src: 'story', who: '세력:A00', kind: 'cue', cue: '작은친절', reason: '동료를 챙김' },
    );
    store.factions.A00 = { code: 'A00', name: '관리국', seeded: { at } };
    // 등록 대기 (확인 뒤 등록): 등록·무시 단추
    store.pending['민수'] = { anchor: 'c2', aliases: ['신입'] };
    // 마지막 갱신이 만든 것 → 되돌리기(↶) 단추
    store.lastRun = { at, entries: [{ who: '쟈알디', slot: 'state', id: 'es1' }, { who: '쟈알디', slot: 'scene', id: 'esc1' }], docs: [], changes: ['cg2'], observations: [{ who: '쟈알디', cand: 'k_ready', id: 'o4' }], newPeople: [] };
    // 읽음 표시: c1·c3 읽음 → c2 는 「지난 응답 안 읽음」(지난 응답 읽기 단추), c4 는 「새 응답」
    const hashOf = (m) => { let h = 2166136261; for (const ch of String(m.data).replace(/\s+/g, ' ').trim()) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
    for (const id of ['c1', 'c3']) { const m = msgs.find((x) => x.chatId === id); if (m) store.read[id] = hashOf(m); }
    window.__chat.goeiPeopleV1 = store;
    // 진단 기록 (플러그인 저장소): 성공 1건(보낸 프롬프트·응답 원문 있음)·실패 1건
    const chatKey = `${String(window.__char.chaId ?? 0)}:0:${msgs[0]?.chatId || '#1'}`;
    const rep = { applied: { entries: 3, cues: 1, address: 0, docs: 0, suspicion: 0, newPeople: ['스팡달'], notes: 0, identity: false, taste: 0, openness: 0, factions: 0 }, dropped: [{ kind: 'entry', who: '쟈알디', reason: '인용이 본문에 없음', item: null }], held: [], issues: [{ code: 'no_change', who: '스팡달', reason: '이 구간에서 변화 없음' }], wallet: [], points: [], items: [] };
    const diag = [
      { at: '2025-01-01T02:50:00.000Z', chat: chatKey, reason: 'manual', model: 'aux', people: ['쟈알디', '스팡달'], indexes: [3], sizes: { system: 4200, data: 1800, span: 600 }, outChars: 900, ms: 3200, ok: true, report: rep, system: '## People updater\nRead the span and return JSON.', data: '{"span":[{"m":3,"text":"…"}]}', raw: '{"people":[{"name":"쟈알디","entries":[]}]}' },
      { at: '2025-01-01T02:55:00.000Z', chat: chatKey, reason: 'turn', model: 'aux', people: ['쟈알디'], indexes: [5], sizes: { system: 4200, data: 1700, span: 500 }, outChars: 0, ms: 1200, ok: false, stage: 'model', error: '보조 모델이 빈 답을 돌려줌', system: '## People updater\n…', data: '{}', raw: '' },
    ];
    window.__store['p:goei-people-diag'] = JSON.stringify(diag);
    return { msgs: msgs.map((m) => m.chatId), people: Object.keys(store.people), chatKey, pp_on: ss.$pp_on };
  });
  log('people 시작 상태', JSON.stringify(info));
  await sleep(100);
};
