// 필드 게임 시연판 (2026-10-28): 리스가 받는 게임 코드(dist/game/goei-game.js)와 팩 전부를 HTML 한 장에 넣고,
// 가짜 bridge(tests/field-harness.mjs와 같은 것)로 필드 모드를 띄운다. 3D 에일린·중림 지하상가 확인용.
// 사용: npm run build 후 node scripts/field-demo.mjs → release/demo/goei-field.html
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const DIST = 'dist/game';
const code = readFileSync(`${DIST}/goei-game.js`, 'utf8').replace(/<\/script/gi, '<\\/script');
const packs = {};
for (const f of readdirSync(DIST)) if (f.endsWith('.pack')) packs[f.replace(/\.pack$/, '')] = readFileSync(`${DIST}/${f}`).toString('base64');

const boot = `(async () => {
  const unb = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const parse = (b) => {
    const len = b[8] | (b[9] << 8) | (b[10] << 16) | (b[11] << 24);
    const head = JSON.parse(new TextDecoder().decode(b.subarray(12, 12 + len)));
    const files = new Map();
    for (const [name, start, size] of head.files) files.set(name, b.subarray(12 + len + start, 12 + len + start + size));
    return { atlas: head.atlas ?? null, files };
  };
  const P = Object.fromEntries(Object.entries(window.__GOEI_PACKS__).map(([k, v]) => [k, parse(unb(v))]));
  const MIME = { png: 'image/png', webp: 'image/webp', json: 'application/json', ogg: 'audio/ogg', mp3: 'audio/mpeg', txt: 'text/plain' };
  const saves = new Map(), turns = [];
  let won = 140000;
  const state = () => ({ visitor: { agentId: '', name: '에일린' }, agents: [{ id: 'jaemtri', name: '잼트리', state: '대기', situation: '사무실', room: 'office' }], turns: [...turns] });
  const vp = { full: false, rotated: false, mode: null, async enter(k = 'browser') { this.mode = k; try { await document.documentElement.requestFullscreen(); } catch {} }, async exit() { this.mode = null; try { await document.exitFullscreen(); } catch {} }, toLocal: (x, y, el) => { const r = el.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, onChange: () => () => {} };
  const bridge = {
    api: 1, slot: 0,
    uiPrefs: { load: async () => null, save: () => {} },
    visit: { state: async () => state(), send: async (id, text) => { turns.push({ id: String(turns.length), at: Date.now(), agentId: id, name: '잼트리', user: text, reply: '응.' }); return state(); } },
    wallet: { balance: async () => won, add: async (n) => (won += n) },
    field: { record: async () => {}, entry: async () => ({ allow: true, presence: 'none', site: 'hq', minute: 22 * 60 }) },
    talk: { model: async () => '응, 후배.', lore: async () => null, recent: async () => [] },
    saves: { list: async () => [], read: async (s) => saves.get(s) ?? null, write: async (s, d) => void saves.set(s, d), remove: async (s) => void saves.delete(s), last: async () => (saves.size ? 0 : null) },
    assets: {
      ready: async (id) => !!P[id],
      url: async (id, f) => { const b = P[id]?.files.get(f) ?? P[id]?.files.get(f + '.png'); return b ? URL.createObjectURL(new Blob([b], { type: MIME[f.split('.').pop()] ?? 'application/octet-stream' })) : ''; },
      bytes: async (id, f) => P[id]?.files.get(f) ?? null,
      atlas: async (id) => P[id]?.atlas ?? null,
      list: async () => Object.keys(P).map((id) => ({ id, bytes: 0, ready: true, old: false })),
    },
    card: async () => null, photo: async () => '', report: () => {},
    viewport: vp, waiting: () => false, onWaiting: () => () => {}, narrow: () => false, close: () => {}, onHidden: () => () => {},
  };
  window.__goeiGame.mount(document.getElementById('box'), bridge);
  // 주소 끝 #jr: 본부에 들어가면 바로 중림 지하상가로
  if (location.hash === '#jr') { const t = setInterval(() => { const e = window.__goeiEngine; if (e?.inHub && e.world) { clearInterval(t); e.world.stage.jump('jr_b1', 900, 540); } }, 300); }
})();`;

const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>괴이봇 필드 시연 (3D 에일린)</title><style>
html,body{margin:0;height:100%;background:#000;overflow:hidden}
.gx-fieldhost{position:fixed;inset:0;overflow:hidden}.gx-game{position:absolute;inset:0}.gx-game-box{position:absolute;inset:0}
.gx-game.gx-panelfull{position:absolute;inset:0;z-index:60}
</style></head><body><main class="gx-fieldhost"><div class="gx-game"><div class="gx-game-box" id="box"></div></div></main>
<script>window.__GOEI_PACKS__=${JSON.stringify(packs)}</script>
<script>${code}</script>
<script>${boot}</script></body></html>`;
writeFileSync('release/demo/goei-field.html', html);
console.log('release/demo/goei-field.html', (html.length / 1048576).toFixed(1) + 'MB');
