// 눌러 보기 전수점검 · 묶음 「misc」 시작 상태 (2026-11-09)
// 남은 못 누른 동작들이 나오는 상태를 만든다. 누르기마다 새 페이지가 chat·char·store 로 다시 뜨므로 여기서는 저장되는 것만 꾸민다
// (화면 상태는 --from 길로). 환경변수 MISC_PREP 에 쉼표로 적은 것만 (기본: 전부). rule · pending · wiki · world
//  - rule    : 이 기기 설정(prefs.rules)에 규칙 하나(id rtest1) → 지침 › 규칙 화면(ed-rule-to·지우기·정말 지우기·취소)
//  - pending : 상황판 세계($goei_world).pending.an 에 요청 대기 → 커스텀 탭 「요청 취소」(mission-cancel)
//  - wiki    : 채팅 로어북에 위키 문서(WIKI｜시험 문서) → 위키 문서 화면 「삭제」(wiki-delete)
//  - world   : 설정 창 세계 탭에서 ① 첫 요원 기록 「지우기」(ed-restore) ② 조직 「시험 조직」(이름 바꾸기·지우기·거점 추가·시작 칸으로)
//              ③ 조직 「시험 조직 둘」: 요원 한 명 소속 → 로어 칸 지움 → 「명부에만 있음」(ed-make-rec) ④ 시작 화면: 묶음 추가·시험 조직 시작 칸으로·A00 장면 추가
//              → 닫기(바로 저장)로 카드에 남긴다
import { closeEditor, goNode, openEditor, sleep as wait } from '../../tests/qc-settings-harness.mjs';

const WIKI_PREFIX = 'WIKI｜';

export default async (page, { kind, vp, log, sleep, openWin, settle }) => {
  const want = new Set((process.env.MISC_PREP || 'rule,pending,wiki,world').split(',').map((s) => s.trim()).filter(Boolean));
  const say = (...m) => log(`[misc:${vp}/${kind}]`, ...m);

  if (want.has('rule')) {
    await page.evaluate(() => {
      const p = JSON.parse(window.__store['p:goei:prefs'] || '{}');
      p.rules = [{ id: 'rtest1', title: '시험 규칙', text: 'One speaker, three sentences at most.', to: ['RP'], on: true }];
      window.__store['p:goei:prefs'] = JSON.stringify(p);
    });
    say('규칙 rtest1 심음');
  }

  if (want.has('pending') && kind !== 'picker') {
    const ok = await page.evaluate(() => {
      const ss = window.__chat.scriptstate || (window.__chat.scriptstate = {});
      const raw = ss.$goei_world;
      if (!raw) return false;
      const w = JSON.parse(raw);
      w.pending = { ...(w.pending || {}), an: '시험 괴이 요청' };
      ss.$goei_world = JSON.stringify(w);
      return true;
    });
    say(ok ? '요청 대기(pending.an) 심음' : '세계 상태가 없어 요청 대기를 못 심음');
  }

  if (want.has('wiki') && kind !== 'picker') {
    await page.evaluate((prefix) => {
      const chat = window.__chat;
      const lore = Array.isArray(chat.localLore) ? chat.localLore : (chat.localLore = []);
      const meta = { title: '시험 문서', mode: 'expand', model: 'aux', created: Date.now(), length: 'short', sources: ['QC 괴이'], primarySources: ['QC 괴이'], writingRequest: '', direct: false };
      const json = JSON.stringify(meta).replace(/--/g, '-\\u002d');
      lore.push({ key: '', secondkey: '', comment: prefix + '시험 문서', content: `[NW_PRIVATE_BEGIN]\n<!--NW_META:${json}-->\n== 개요 ==\n점검용으로 넣은 문서예요.\n[NW_PRIVATE_END]`, mode: 'normal', insertorder: 0, alwaysActive: false, selective: false, useRegex: false });
    }, WIKI_PREFIX);
    say('위키 문서 「시험 문서」 심음');
  }

  if (want.has('world') && kind !== 'picker') {
    const click = async (sel, ms = 350) => {
      const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.click(); return true; }, sel);
      if (!ok) say(`못 찾음: ${sel}`);
      await sleep(ms);
      return ok;
    };
    const type = async (sel, v) => page.evaluate(([s, val]) => { const el = document.querySelector(s); if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); } return !!el; }, [sel, v]);
    const firstSel = (nth) => page.evaluate((n) => { const rows = document.querySelectorAll('.gw [data-action="ed-sel"]'); const el = rows[n]; if (!el) return ''; el.click(); return el.dataset.value; }, nth);

    await openWin(page).catch(() => {});
    await settle(page);
    await openEditor(page, 'agent');
    await sleep(300);
    // ① 첫 요원 기록 지우기 → 「지움」 상태 (되살리기 단추가 나온다)
    const delName = await firstSel(0);
    await sleep(300);
    await click('.gw [data-action="ed-delete"]');
    say(`요원 「${delName}」 기록 지움`);
    // ② 조직 둘 추가
    await goNode(page, 'org');
    for (const name of ['시험 조직', '시험 조직 둘']) {
      await click('.gw [data-action="ed-add-toggle"]');
      await type('.gw [name="ed-new-name"]', name);
      await click('.gw [data-action="ed-add"]', 500);
    }
    await closeEditor(page, true); // 바로 저장 → 명부 줄이 생긴다
    await sleep(500);
    await openEditor(page, 'agent');
    await sleep(300);
    // ③ 두 번째 요원을 「시험 조직 둘」 소속으로 → 그 조직의 로어 칸만 지움 (명부 줄은 소속 요원이 있어 남는다)
    const agentName = await firstSel(1);
    await sleep(300);
    const picked = await page.evaluate(() => { const el = [...document.querySelectorAll('.gw [data-action="dir-org-pick"]')].find((b) => b.dataset.value.startsWith('시험 조직 둘|')); if (!el) return false; el.click(); return true; });
    say(picked ? `요원 「${agentName}」 → 시험 조직 둘` : '소속 칩(시험 조직 둘)을 못 찾음');
    await sleep(300);
    await goNode(page, 'org');
    const got = await page.evaluate(() => { const el = [...document.querySelectorAll('.gw [data-action="ed-sel"]')].find((b) => b.dataset.value === '시험 조직 둘'); if (!el) return false; el.click(); return true; });
    await sleep(300);
    if (got) await click('.gw [data-action="ed-delete"]');
    say(got ? '시험 조직 둘: 로어 칸 지움(명부에만 있음)' : '시험 조직 둘 줄이 없음');
    // ④ 시작 화면: 묶음 추가 · 시험 조직을 시작 칸으로 · A00 장면 추가
    await goNode(page, 'start');
    await click('.gw [data-action="dir-group-add"]');
    await click('.gw [data-action="dir-fac-play"][data-value="1|시험 조직"]');
    await click('.gw [data-action="dir-start-open"][data-value="A00"]');
    await click('.gw [data-action="dir-scene-add"][data-value="A00"]');
    await closeEditor(page, true);
    await sleep(600);
    const notice = await page.evaluate(() => document.querySelector('.gw .gw-confirm, .gx-err')?.textContent || '');
    if (notice) say('닫을 때 알림:', notice.slice(0, 120));
    say('세계 꾸미기 끝');
  }
};
