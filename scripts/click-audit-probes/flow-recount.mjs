// click-audit --probe: 호출 흐름 토큰이 설정·지침을 바꾼 뒤 다시 세어지는지 (11-09 「다시 세기」 단추 없앤 것 확인)
// 쓰기: node scripts/click-audit.mjs --vp pc --start board --from 'ed-open|set:screen' --probe scripts/click-audit-probes/flow-recount.mjs --out .scratch/ca-flowprobe
// 순서: 호출 흐름 열어 토큰 읽기 → 인물 Director 칸 바꾸기 → 호출 흐름 다시 → 지침 글칸에 문장 더하기 → 호출 흐름 다시. 단계마다 노드별 「요청 N토큰」을 적는다
const press = async (page, sel) => {
  const ok = await page.evaluate((s) => { const el = document.querySelector(s); if (!el) return false; el.scrollIntoView({ block: 'center' }); el.click(); return true; }, sel);
  await page.waitForTimeout(400);
  return ok;
};
const goNode = async (page, node) => {
  // 노드가 지금 탭에 없으면 탭을 하나씩 바꿔 가며 찾는다 (호출 흐름은 「기능」 탭에 있다)
  for (const tab of ['', 'set', 'guide', 'manage', 'world']) {
    if (tab) await press(page, `[data-action="ed-tab"][data-value="${tab}"]`);
    if (await page.$(`[data-action="ed-node"][data-value="${node}"]`)) break;
  }
  return press(page, `[data-action="ed-node"][data-value="${node}"]`);
};
const readFlow = async (page) => {
  for (let i = 0; i < 40; i++) {
    const busy = await page.evaluate(() => /세는 중/.test(document.querySelector('.gw')?.textContent || ''));
    if (!busy) break;
    await page.waitForTimeout(250);
  }
  return page.evaluate(() => {
    const out = {};
    for (const n of document.querySelectorAll('.pp-fn')) { const name = n.querySelector('.pp-fn-name b')?.textContent.trim(); const t = (n.textContent.match(/요청 (?:약 )?([\d,]+)토큰/) || [])[1]; if (name) out[name] = t ?? n.textContent.replace(/\s+/g, ' ').slice(0, 60); }
    out._head = document.querySelector('.pp-flow-head')?.textContent.replace(/\s+/g, ' ').slice(0, 160);
    out._recountBtn = !!document.querySelector('[data-action="man-flow-recount"]');
    return out;
  });
};

export default async function (page, { vp, shots, log }) {
  const steps = [];
  const snap = async (what) => {
    await goNode(page, 'manage:flow');
    const tok = await readFlow(page);
    const shot = `${vp}_probe_flow_${steps.length}.png`;
    await page.screenshot({ path: `${shots}/${shot}` });
    steps.push({ what, tok, shot });
    log(`${vp} 호출 흐름(${what}): ${Object.entries(tok).filter(([k]) => !k.startsWith('_')).map(([k, v]) => `${k} ${v}`).join(' · ')}`);
  };
  await snap('처음');
  // 1) 설정 바꾸기: 인물 → Director 다른 칸으로
  await goNode(page, 'set:people');
  const cur = await page.evaluate(() => document.querySelector('[data-action="pp-set"][data-value^="director="].on')?.dataset.value);
  const next = await page.evaluate((c) => [...document.querySelectorAll('[data-action="pp-set"][data-value^="director="]')].map((b) => b.dataset.value).find((v) => v !== c && v !== 'director=off'), cur);
  if (next) await press(page, `[data-action="pp-set"][data-value="${next}"]`);
  await snap(`설정 바꾼 뒤 (Director ${cur} → ${next})`);
  // 2) 지침 바꾸기: 지침 탭 첫 노드부터 글칸 있는 곳을 찾아 문장 더하기
  await press(page, '[data-action="ed-tab"][data-value="guide"]');
  const nodes = await page.evaluate(() => [...document.querySelectorAll('[data-action="ed-node"]')].map((b) => b.dataset.value).filter((v) => v.startsWith('guide:')).sort((x, y) => (y === 'guide:Updater') - (x === 'guide:Updater'))); // 갱신 지침 먼저: 본편 칸은 마지막 실측값이라 지침으로 안 바뀐다
  let edited = '';
  for (const n of nodes) {
    await press(page, `[data-action="ed-node"][data-value="${n}"]`);
    const ta = await page.$('textarea[data-input="ed-guide-sec"]');
    if (!ta) continue;
    await ta.scrollIntoViewIfNeeded();
    await ta.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' 점검용 문장을 하나 더 붙여 토큰이 늘었는지 봅니다.');
    await page.evaluate(() => document.activeElement?.blur());
    await page.waitForTimeout(500);
    edited = `${n} (글칸 끝: …${(await ta.inputValue()).slice(-24)})`;
    break;
  }
  await snap(`지침 바꾼 뒤 (${edited || '글칸 못 찾음'})`);
  return steps;
}
