// 필드 시연판 (release/demo/goei-field-demo.html, 11-02): 플러그인 창 없이 본 게임(필드·인물 팩)을 그대로 연다.
// 인물·배경 팩은 저장소의 game-pack/<폴더>/ 원본 파일을 그대로 받는다 (빌드가 window.__GOEI_PACK_MANIFEST__ 에 폴더·파일 목록을 넣는다).
// 받는 곳: ?base=<주소> > 주소가 githack/raw 이면 그 커밋 > ?ref=<브랜치·커밋> > claude/merge-1101.
// 다리(bridge)는 시험(tests/field-harness.mjs)과 같은 가짜: 모델 대화는 고정 답, 지갑·저장은 메모리.
import { mountGame } from '../main';

type Manifest = Record<string, { dir: string; files: string[]; atlas: unknown }>;
const M: Manifest = (window as unknown as { __GOEI_PACK_MANIFEST__?: Manifest }).__GOEI_PACK_MANIFEST__ ?? {};
const q = new URLSearchParams(location.search);
const base = (() => {
  const b = q.get('base');
  if (b) return b.replace(/\/$/, '');
  const m = /\/leepc25\/goei-plugin\/(.+?)\/release\/demo\//.exec(location.pathname);
  const ref = q.get('ref') || (m ? m[1] : 'claude/merge-1101');
  return `https://raw.githubusercontent.com/leepc25/goei-plugin/${ref}`;
})();
const fileOf = (id: string, f: string) => { const p = M[id]; if (!p) return ''; const n = p.files.includes(f) ? f : p.files.includes(f + '.png') ? f + '.png' : ''; return n ? `${base}/game-pack/${p.dir}/${n}` : ''; };
const MIME: Record<string, string> = { png: 'image/png', webp: 'image/webp', json: 'application/json', txt: 'text/plain' };
const blobs = new Map<string, Promise<string>>();
const assets = {
  ready: async (id: string) => id in M,
  // json 등 글자 파일은 blob 주소로 돌려 줘야 fetch 가 CORS 없이 읽는다; 그림도 같은 길
  url: async (id: string, f: string) => {
    const u = fileOf(id, f); if (!u) return '';
    if (!blobs.has(u)) blobs.set(u, fetch(u).then(async (r) => { if (!r.ok) throw new Error(`${r.status} ${u}`); const b = await r.blob(); return URL.createObjectURL(new Blob([b], { type: MIME[u.split('.').pop() ?? ''] ?? b.type })); }));
    return blobs.get(u)!.catch(() => '');
  },
  bytes: async (id: string, f: string) => { const u = fileOf(id, f); if (!u) return null; const r = await fetch(u); return r.ok ? new Uint8Array(await r.arrayBuffer()) : null; },
  atlas: async (id: string) => (M[id]?.atlas as never) ?? null,
  list: async () => Object.keys(M).map((id) => ({ id, bytes: 0, ready: true, old: false })),
};
const minute = (() => { const h = Number(q.get('hour')); return (Number.isFinite(h) && q.has('hour') ? h : 10) * 60; })();
const card = { card: '괴이', faction: 'A00', player: '', agents: [], anomalies: [], sites: [], events: [], minute };
const turns: unknown[] = [];
const state = () => ({ visitor: { agentId: '', name: q.get('char') || '에일린' }, agents: [{ id: 'jaemtri', name: '잼트리', state: '대기', situation: '사무실', room: 'office' }], turns: [...turns] });
const saves = new Map<string, unknown>();
let won = 140000; let fd: unknown = null; let prefs: unknown = null;
const vp = { full: false, rotated: false, mode: null as string | null, async enter(k = 'browser') { this.mode = k; }, async exit() { this.mode = null; }, toLocal: (x: number, y: number, el: Element) => { const r = el.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, onChange: () => () => {} };
// ?start=stage=... (시험 tests/engine·qc-combat): modules.ts boot 은 visit 이 있으면 늘 제목 화면이라, 그때는 visit 없이 연다
const visit = {
    state: async () => state(),
    send: async (id: string, text: string) => { turns.push({ id: String(turns.length), at: Date.now(), agentId: id, name: id, user: text, reply: '(시연판: 모델 없음) 응, 알았어.' }); return state(); },
    sendMob: async (mob: { id: string; name: string; place?: string }, text: string) => { turns.push({ id: String(turns.length), at: Date.now(), agentId: mob.id, name: mob.name, user: text, reply: '(시연판: 모델 없음) 네? 저요?', room: mob.place }); return state(); },
};
const bridge = {
  api: 1, slot: 0,
  uiPrefs: { load: async () => prefs, save: (t: unknown) => { prefs = t; } },
  ...(q.has('start') ? {} : { visit }),
  wallet: { balance: async () => won, add: async (n: number) => (won += n) },
  fieldState: { load: async () => fd, save: async (t: unknown) => void (fd = t) },
  field: { record: async () => {}, entry: async () => ({ allow: true, presence: 'none', site: 'hq', minute }) },
  talk: { model: async () => '(시연판: 모델 없음) 응, 후배.', lore: async () => null, recent: async () => [] },
  saves: { list: async () => [], read: async (s: string) => saves.get(s) ?? null, write: async (s: string, d: unknown) => void saves.set(s, d), remove: async (s: string) => void saves.delete(s), last: async () => (saves.size ? 0 : null) },
  assets,
  card: async () => card, photo: async () => '', report: () => {},
  viewport: vp, waiting: () => false, onWaiting: () => () => {}, narrow: () => false, close: () => {}, onHidden: () => () => {},
};
const box = document.getElementById('box')!;
mountGame(box, bridge as never);
