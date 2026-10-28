// 리스 필드 모드 재현 시험 틀 (2026-10-25: 리스에서만 보이는 문제 — 좁은 창, 상황창 틀, NPC 대화창, 임무 창구).
// dist/game/goei-game.js(리스가 받는 게임 코드)를 상황창 본문 크기의 상자에 올리고, 가짜 bridge(visit·field·talk·저장·팩)를 준다.
// 사용: node tests/field-harness.mjs [폭] [높이] [shots 폴더]  → window.__h (page)로 시험한다. 다른 시험이 import해서 쓴다.
import { createRequire } from 'node:module';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/usr/lib/node_modules/')('playwright')); }

const DIST = resolve(new URL('../dist/game', import.meta.url).pathname);

/** 선택: card = bridge.card() 가 줄 본편 스냅숏(시각 minute 등), uiPrefs = $hq_ui 설정 JSON 글, people = 인물 기록·세력 평판 (factions 배열), query = 주소 ?seed=…&hour=… */
export async function openField({ width = 1873, height = 1082, panel = true, card = null, uiPrefs = null, people = null, query = '' } = {}) {
  const code = readFileSync(`${DIST}/goei-game.js`, 'utf8');
  const packs = {};
  for (const f of readdirSync(DIST)) if (f.endsWith('.pack')) packs[f.replace(/\.pack$/, '')] = readFileSync(`${DIST}/${f}`).toString('base64');
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width, height } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // 주소 ?seed·hour: about:blank 에서는 history.replaceState 가 막힌다 → 가짜 주소로 먼저 가고(setContent 는 주소를 유지) 그 위에 내용을 쓴다
  if (query) {
    await page.route('http://goei.test/**', (r) => r.fulfill({ contentType: 'text/html', body: '<!doctype html><html></html>' }));
    await page.goto(`http://goei.test/${query.startsWith('?') ? query : `?${query}`}`);
  }
  // 상황창: 왼쪽 메뉴 줄 · 가운데 본문(필드) · 오른쪽 신분증 줄 (리스 플러그인 창 흉내)
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:#111}
    .gx-panel{position:absolute;inset:14px;display:grid;grid-template-columns:${panel ? '72px 1fr 220px' : '1fr'};border-radius:24px;overflow:hidden;background:#05080a}
    .side{background:#1a2226}.gx-fieldhost{position:relative;overflow:hidden}
    .gx-game{position:absolute;inset:0}.gx-game-box{position:absolute;inset:0}
    .gx-game.gx-panelfull{position:absolute;inset:0;z-index:60}
  </style></head><body><div class="gx-panel">${panel ? '<div class="side"></div>' : ''}<main class="gx-fieldhost"><div class="gx-game"><div class="gx-game-box" id="box"></div></div></main>${panel ? '<div class="side"></div>' : ''}</div></body></html>`);
  await page.addScriptTag({ content: code });
  await page.evaluate(async ({ packs, card, uiPrefs, people }) => {
    const unb = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const parse = (b) => {
      const len = b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24);
      const head = JSON.parse(new TextDecoder().decode(b.subarray(12, 12 + len)));
      const files = new Map();
      for (const [name, start, size] of head.files) files.set(name, b.subarray(12 + len + start, 12 + len + start + size));
      return { atlas: head.atlas ?? null, files };
    };
    const P = Object.fromEntries(Object.entries(packs).map(([k, v]) => [k, parse(unb(v))]));
    const MIME = { png: 'image/png', webp: 'image/webp', json: 'application/json', ogg: 'audio/ogg', mp3: 'audio/mpeg', txt: 'text/plain' };
    const saves = new Map();
    const h = window.__h = { records: [], sent: [], closed: 0, full: null, won: 140000, trades: [], prefs: uiPrefs, factions: people?.factions ?? [], peopleList: people?.people ?? [] };
    const turns = [];
    const state = () => ({ visitor: { agentId: '', name: '에일린' }, agents: [{ id: 'jaemtri', name: '잼트리', state: '대기', situation: '사무실', room: 'office' }], turns: [...turns] });
    const vp = { full: false, rotated: false, mode: null, async enter(k = 'browser') { this.mode = k; h.full = k; }, async exit() { this.mode = null; h.full = null; }, toLocal: (x, y, el) => { const r = el.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, onChange: () => () => {} };
    const bridge = {
      api: 1, slot: 0,
      uiPrefs: { load: async () => h.prefs, save: (t) => { h.prefs = t; } },
      ...(people ? { people: { people: async () => h.peopleList, sheet: async () => null, factions: async () => h.factions, onChange: () => () => {} } } : {}),
      visit: { state: async () => state(), send: async (id, text) => { h.sent.push([id, text]); turns.push({ id: String(turns.length), at: Date.now(), agentId: id, name: '잼트리', user: text, reply: '응.' }); return state(); } },
      wallet: { balance: async () => h.won, add: async (n, m) => { h.won += n; h.trades.push([n, m]); return h.won; } },
      field: { record: async (ev) => void h.records.push(ev), entry: async () => ({ allow: true, presence: 'none', site: 'hq', minute: 22 * 60 }) },
      talk: { model: async () => '응, 후배.', lore: async () => null, recent: async () => [] },
      saves: { list: async () => [], read: async (s) => saves.get(s) ?? null, write: async (s, d) => void saves.set(s, d), remove: async (s) => void saves.delete(s), last: async () => (saves.size ? 0 : null) },
      assets: {
        ready: async (id) => !!P[id],
        url: async (id, f) => { const b = P[id]?.files.get(f) ?? P[id]?.files.get(f + '.png'); return b ? URL.createObjectURL(new Blob([b], { type: MIME[f.split('.').pop()] ?? 'application/octet-stream' })) : ''; },
        bytes: async (id, f) => P[id]?.files.get(f) ?? null,
        atlas: async (id) => P[id]?.atlas ?? null,
        list: async () => Object.keys(P).map((id) => ({ id, bytes: 0, ready: true, old: false })),
      },
      card: async () => card, photo: async () => '', report: () => {},
      viewport: vp, waiting: () => false, onWaiting: () => () => {}, narrow: () => false, close: () => void h.closed++, onHidden: () => () => {},
    };
    h.bridge = bridge;
    h.unmount = window.__goeiGame.mount(document.getElementById('box'), bridge);
    // 다시 붙이기 (열고 닫기 반복 시험): h.remount()
    h.remount = () => { h.unmount?.(); h.unmount = window.__goeiGame.mount(document.getElementById('box'), bridge); };
  }, { packs, card, uiPrefs, people });
  return { browser: b, page, errors };
}

/** 타이틀 → 필드 들어가기 → 본부 */
export async function enterHub(page) {
  await page.waitForFunction(() => window.__goeiEngine);
  for (let i = 0; i < 60 && !(await page.evaluate(() => !!window.__goeiEngine?.inHub && !!window.__goeiEngine.world)); i++) {
    const btn = page.locator('button:visible', { hasText: /필드 입장|새로 시작|들어가기|계속/ }).first();
    if (await btn.count()) await btn.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1200);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [w, hh, shots] = [Number(process.argv[2] || 1873), Number(process.argv[3] || 1082), process.argv[4]];
  const { browser, page, errors } = await openField({ width: w, height: hh });
  await enterHub(page);
  console.log('hub', await page.evaluate(() => ({ scene: window.__goeiEngine.world.stage.current()?.id, inHub: window.__goeiEngine.inHub })));
  if (shots) await page.screenshot({ path: `${shots}/field-hub.png` });
  console.log('errors', errors.slice(0, 5));
  await browser.close();
}
